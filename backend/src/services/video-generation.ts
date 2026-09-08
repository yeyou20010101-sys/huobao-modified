import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { resolveUserConfig } from './ai.js'
import { now } from '../utils/response.js'
import { downloadFile, readImageAsVideoReferenceDataUrl } from '../utils/storage.js'
import { storageUserIdFromDramaId } from '../utils/ownership.js'
import { resolveReferenceVideoWebUrl } from '../utils/reference-video-url.js'
import { getVideoAdapter } from './adapters/registry'
import type { AIConfig } from './adapters/types'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess, logTaskWarn, redactUrl } from '../utils/task-logger.js'
import { beginTask, refundTaskByRef, settleTaskByRef, storyboardBillingIds } from './billing.js'

interface GenerateVideoParams {
  storyboardId?: number
  dramaId?: number
  prompt: string
  model?: string
  referenceMode?: string
  imageUrl?: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  referenceImageUrls?: string[]
  referenceVideoUrls?: string[]
  duration?: number
  aspectRatio?: string
  configId?: number
  userId: number
}

function markVideoFailed(id: number, errorMsg: string) {
  db.update(schema.videoGenerations)
    .set({ status: 'failed', errorMsg, updatedAt: now() })
    .where(eq(schema.videoGenerations.id, id))
    .run()
  refundTaskByRef('video_generations', id, errorMsg)
}

/** Seedance 等视频模型要求至少一张参考图或一段参考视频 */
function assertVideoHasReferenceMedia(params: GenerateVideoParams) {
  const hasImage = !!params.imageUrl?.trim()
  const hasFirst = !!params.firstFrameUrl?.trim()
  const hasLast = !!params.lastFrameUrl?.trim()
  const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0
  const hasVideos = (params.referenceVideoUrls?.length ?? 0) > 0
  if (hasImage || hasFirst || hasLast || hasRefs || hasVideos) return
  throw new Error('请至少提供首帧、尾帧、参考图或参考视频之一后再生成视频')
}

export async function generateVideo(params: GenerateVideoParams): Promise<number> {
  assertVideoHasReferenceMedia(params)
  const ts = now()
  const config = resolveUserConfig('video', params.configId, params.userId)
  if (!config) throw new Error('No active video AI config')

  const res = db.insert(schema.videoGenerations).values({
    userId: params.userId,
    storyboardId: params.storyboardId,
    dramaId: params.dramaId,
    prompt: params.prompt,
    model: params.model || config.model,
    provider: config.provider,
    referenceMode: params.referenceMode || 'none',
    imageUrl: params.imageUrl,
    firstFrameUrl: params.firstFrameUrl,
    lastFrameUrl: params.lastFrameUrl,
    referenceImageUrls: params.referenceImageUrls ? JSON.stringify(params.referenceImageUrls) : null,
    referenceVideoUrls: params.referenceVideoUrls ? JSON.stringify(params.referenceVideoUrls) : null,
    duration: params.duration || 5,
    aspectRatio: params.aspectRatio || '16:9',
    status: 'processing',
    createdAt: ts,
    updatedAt: ts,
  }).run()

  const lastId = Number(res.lastInsertRowid)
  const billingIds = storyboardBillingIds(params.storyboardId, params.dramaId)
  try {
    beginTask({
      userId: params.userId,
      taskType: 'video',
      provider: config.provider,
      model: params.model || config.model,
      dramaId: billingIds.dramaId,
      episodeId: billingIds.episodeId,
      storyboardId: billingIds.storyboardId,
      refType: 'video_generations',
      refId: lastId,
      idempotencyKey: `video:${lastId}`,
    })
  } catch (err) {
    db.delete(schema.videoGenerations).where(eq(schema.videoGenerations.id, lastId)).run()
    throw err
  }
  logTaskStart('VideoTask', 'enqueue', {
    id: lastId,
    provider: config.provider,
    storyboardId: params.storyboardId,
    dramaId: params.dramaId,
    referenceMode: params.referenceMode || 'none',
    duration: params.duration || 5,
  })
  logTaskPayload('VideoTask', 'enqueue params', {
    id: lastId,
    config: {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    params,
  })
  processVideoGeneration(lastId, config).catch(err => {
    logTaskError('VideoTask', 'process', { id: lastId, error: err.message })
    console.error(`Video generation ${lastId} failed:`, err)
  })
  return lastId
}

async function processVideoGeneration(id: number, config: AIConfig) {
  const adapter = getVideoAdapter(config.provider)

  try {
    const rows = db.select().from(schema.videoGenerations).where(eq(schema.videoGenerations.id, id)).all()
    const record = rows[0]
    if (!record) return
    logTaskProgress('VideoTask', 'build-request', {
      id,
      provider: config.provider,
      storyboardId: record.storyboardId,
      referenceMode: record.referenceMode,
    })

    const resolvedImageUrl = await normalizeVideoReferenceUrl(record.imageUrl)
    const resolvedFirstFrameUrl = await normalizeVideoReferenceUrl(record.firstFrameUrl)
    const resolvedLastFrameUrl = await normalizeVideoReferenceUrl(record.lastFrameUrl)
    const resolvedReferenceImageUrls = await normalizeVideoReferenceUrls(record.referenceImageUrls)
    const resolvedReferenceVideoUrls = await normalizeReferenceVideoUrls(record.referenceVideoUrls)

    // 使用 Adapter 构建请求
    const { url, method, headers, body } = adapter.buildGenerateRequest(config, {
      id: record.id,
      model: record.model,
      prompt: record.prompt,
      referenceMode: record.referenceMode,
      imageUrl: resolvedImageUrl,
      firstFrameUrl: resolvedFirstFrameUrl,
      lastFrameUrl: resolvedLastFrameUrl,
      referenceImageUrls: resolvedReferenceImageUrls ? JSON.stringify(resolvedReferenceImageUrls) : null,
      referenceVideoUrls: resolvedReferenceVideoUrls.length ? JSON.stringify(resolvedReferenceVideoUrls) : null,
      duration: record.duration,
      aspectRatio: record.aspectRatio,
    })
    logTaskProgress('VideoTask', 'request', {
      id,
      provider: config.provider,
      method,
      url: redactUrl(url),
      model: record.model,
      referenceMode: record.referenceMode,
    })
    logTaskPayload('VideoTask', 'request payload', {
      id,
      method,
      url,
      headers,
      body,
    })

    const resp = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    })

    if (!resp.ok) throw new Error(`API error ${resp.status}: ${await resp.text()}`)
    const result = await resp.json() as any

    const { isAsync, taskId, videoUrl } = adapter.parseGenerateResponse(result)

    if (!isAsync && videoUrl) {
      logTaskProgress('VideoTask', 'sync-complete', { id, videoUrl })
      // 同步模式
      await handleVideoComplete(id, videoUrl, record.duration)
      return
    }

    // 异步模式：更新 taskId，开始轮询
    db.update(schema.videoGenerations)
      .set({ taskId, status: 'processing', updatedAt: now() })
      .where(eq(schema.videoGenerations.id, id))
      .run()
    logTaskProgress('VideoTask', 'poll-start', { id, taskId, provider: config.provider })

    // Vidu 没有轮询端点，跳过轮询（依赖 Webhook 回调）
    if (adapter.provider === 'vidu') {
      logTaskProgress('VideoTask', 'webhook-wait', { id, taskId, provider: adapter.provider })
      return
    }

    pollVideoTask(id, config, taskId!, record.storyboardId)
  } catch (err: any) {
    logTaskError('VideoTask', 'process', { id, provider: config.provider, error: err.message })
    markVideoFailed(id, err.message)
  }
}

async function normalizeVideoReferenceUrl(value: string | null | undefined): Promise<string | null> {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('data:image/')) return raw
  if (raw.startsWith('static/') || raw.startsWith('/static/')) {
    const localPath = raw.startsWith('/static/') ? raw.slice(1) : raw
    try {
      return await readImageAsVideoReferenceDataUrl(localPath)
    } catch (err) {
      logTaskWarn('VideoTask', 'reference-read-failed', { path: localPath, error: (err as Error).message })
      return null
    }
  }
  return raw
}

async function normalizeVideoReferenceUrls(raw: string | null | undefined): Promise<string[]> {
  if (!raw) return []
  let refs: string[] = []
  try {
    refs = JSON.parse(raw)
  } catch {
    refs = []
  }
  const normalized = await Promise.all(
    Array.from(new Set(refs.map((item) => String(item || '').trim()).filter(Boolean))).map((item) => normalizeVideoReferenceUrl(item)),
  )
  return normalized.filter((item): item is string => !!item)
}

async function normalizeReferenceVideoUrl(value: string | null | undefined): Promise<string | null> {
  try {
    // Seedance 要求 reference_video 为公网 web URL，不能传 data:video
    return await resolveReferenceVideoWebUrl(value)
  } catch (err) {
    logTaskWarn('VideoTask', 'reference-video-resolve-failed', {
      value: String(value || '').slice(0, 120),
      error: (err as Error).message,
    })
    throw err
  }
}

async function normalizeReferenceVideoUrls(raw: string | null | undefined): Promise<string[]> {
  if (!raw) return []
  let refs: string[] = []
  try {
    refs = JSON.parse(raw)
  } catch {
    refs = []
  }
  const unique = Array.from(new Set(refs.map((item) => String(item || '').trim()).filter(Boolean)))
  const normalized: string[] = []
  for (const item of unique) {
    const resolved = await normalizeReferenceVideoUrl(item)
    if (resolved) normalized.push(resolved)
  }
  return normalized
}

async function pollVideoTask(id: number, config: AIConfig, taskId: string, storyboardId?: number | null) {
  const adapter = getVideoAdapter(config.provider)

  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 10000))
    try {
      const { url, method, headers } = adapter.buildPollRequest(config, taskId)
      logTaskProgress('VideoTask', 'poll-request', {
        id,
        taskId,
        provider: config.provider,
        method,
        url: redactUrl(url),
        attempt: i + 1,
      })
      const resp = await fetch(url, { method, headers })
      if (!resp.ok) continue
      const result = await resp.json() as any

      const pollResp = adapter.parsePollResponse(result)

      if (pollResp.status === 'completed' && pollResp.videoUrl) {
        logTaskSuccess('VideoTask', 'poll-complete', { id, taskId, videoUrl: pollResp.videoUrl })
        await handleVideoComplete(id, pollResp.videoUrl, null, storyboardId)
        return
      }
      if (pollResp.status === 'failed') {
        const errMsg = pollResp.error || 'Video generation failed'
        logTaskError('VideoTask', 'poll-failed', { id, taskId, error: errMsg })
        markVideoFailed(id, errMsg)
        return
      }
    } catch (err: any) {
      if (i === 299) {
        logTaskError('VideoTask', 'poll-timeout', { id, taskId, error: err.message })
        markVideoFailed(id, `Timeout: ${err.message}`)
        return
      }
      logTaskWarn('VideoTask', 'poll-retry', { id, taskId, attempt: i + 1, error: err.message })
    }
  }
  markVideoFailed(id, 'Timeout: video polling exhausted')
}

async function handleVideoComplete(id: number, videoUrl: string, duration: number | null | undefined, storyboardId?: number | null) {
  const [record] = db.select().from(schema.videoGenerations).where(eq(schema.videoGenerations.id, id)).all()
  const storageUserId = storageUserIdFromDramaId(record?.dramaId, record?.userId || 0)
  const localPath = await downloadFile(videoUrl, 'videos', storageUserId)
  db.update(schema.videoGenerations)
    .set({ videoUrl, localPath, status: 'completed', completedAt: now(), updatedAt: now() })
    .where(eq(schema.videoGenerations.id, id))
    .run()
  logTaskSuccess('VideoTask', 'downloaded', { id, localPath, storyboardId, duration })

  if (storyboardId) {
    db.update(schema.storyboards)
      .set({ videoUrl: localPath, duration: duration || undefined, updatedAt: now() })
      .where(eq(schema.storyboards.id, storyboardId))
      .run()
  }
  settleTaskByRef('video_generations', id)
}
