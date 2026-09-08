import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest, notFound, taskError } from '../utils/response.js'
import { now } from '../utils/response.js'
import { generateImage } from '../services/image-generation.js'
import { generateVideo } from '../services/video-generation.js'
import { getActiveConfig, getConfigById } from '../services/ai.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { requireUser } from '../middleware/auth.js'
import { getOwnedCreateJob } from '../utils/ownership.js'
import { assertUserCanUseMediaPath } from '../utils/storage.js'
import {
  assertCreateAssetsValid,
  buildCreateReferencePrompt,
  normalizeCreateAssets,
  splitCreateAssets,
  type CreateAssetInput,
} from '../utils/create-reference-prompt.js'

const app = new Hono()

const DEFAULT_IMAGE_MODEL = 'doubao-seedream-5-0-lite-260128'
const DEFAULT_VIDEO_MODEL = 'doubao-seedance-2-0-260128'

function resolveCreateConfig(mediaType: 'image' | 'video', userId: number, configId?: number) {
  if (configId != null && Number.isFinite(configId)) {
    const config = getConfigById(configId, userId)
    if (!config) throw new Error('所选模型配置不存在或未启用')
    return config
  }
  const fallback = getActiveConfig(mediaType, userId)
  if (!fallback) {
    throw new Error(mediaType === 'image'
      ? '未配置图片 AI 服务，请先在设置中添加'
      : '未配置视频 AI 服务，请先在设置中添加')
  }
  return fallback
}

/** 兼容旧单附件字段 */
function resolveAssetsFromBody(body: any): CreateAssetInput[] {
  const fromAssets = normalizeCreateAssets(body.assets)
  if (fromAssets.length) return fromAssets

  const mediaPath = String(body.media_path || '').trim().replace(/^\//, '')
  const mediaType = String(body.media_type || body.output_type || '').trim()
  if (!mediaPath.startsWith('static/')) return []
  if (mediaType === 'image') {
    return [{ path: mediaPath, kind: 'image', role: 'extra' }]
  }
  if (mediaType === 'video') {
    return [{ path: mediaPath, kind: 'video', role: 'main_video' }]
  }
  return []
}

function toPublicJob(row: typeof schema.createJobs.$inferSelect) {
  let assets: CreateAssetInput[] = []
  if (row.assetsJson) {
    try {
      assets = normalizeCreateAssets(JSON.parse(row.assetsJson))
    } catch {
      assets = []
    }
  }
  return {
    id: row.id,
    kind: row.kind,
    output_type: row.kind,
    generation_id: row.generationId,
    prompt: row.prompt,
    media_path: row.mediaPath,
    assets,
    status: row.status,
    result_path: row.resultPath,
    error_msg: row.errorMsg,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt,
  }
}

/** 根据底层 generation 同步 create_jobs 状态 */
function syncJobFromGeneration(job: typeof schema.createJobs.$inferSelect) {
  if (!job.generationId) return job
  if (job.status === 'completed' || job.status === 'failed') return job

  if (job.kind === 'image') {
    const [gen] = db.select().from(schema.imageGenerations)
      .where(eq(schema.imageGenerations.id, job.generationId)).all()
    if (!gen) return job
    if (gen.status === 'completed' && (gen.localPath || gen.imageUrl)) {
      const resultPath = gen.localPath || gen.imageUrl || null
      db.update(schema.createJobs).set({
        status: 'completed',
        resultPath,
        completedAt: gen.completedAt || now(),
        updatedAt: now(),
      }).where(eq(schema.createJobs.id, job.id)).run()
      return { ...job, status: 'completed', resultPath, completedAt: gen.completedAt || now(), updatedAt: now() }
    }
    if (gen.status === 'failed') {
      db.update(schema.createJobs).set({
        status: 'failed',
        errorMsg: gen.errorMsg || '图片生成失败',
        updatedAt: now(),
      }).where(eq(schema.createJobs.id, job.id)).run()
      return { ...job, status: 'failed', errorMsg: gen.errorMsg || '图片生成失败', updatedAt: now() }
    }
    return job
  }

  const [gen] = db.select().from(schema.videoGenerations)
    .where(eq(schema.videoGenerations.id, job.generationId)).all()
  if (!gen) return job
  if (gen.status === 'completed' && (gen.localPath || gen.videoUrl)) {
    const resultPath = gen.localPath || gen.videoUrl || null
    db.update(schema.createJobs).set({
      status: 'completed',
      resultPath,
      completedAt: gen.completedAt || now(),
      updatedAt: now(),
    }).where(eq(schema.createJobs.id, job.id)).run()
    return { ...job, status: 'completed', resultPath, completedAt: gen.completedAt || now(), updatedAt: now() }
  }
  if (gen.status === 'failed') {
    db.update(schema.createJobs).set({
      status: 'failed',
      errorMsg: gen.errorMsg || '视频生成失败',
      updatedAt: now(),
    }).where(eq(schema.createJobs.id, job.id)).run()
    return { ...job, status: 'failed', errorMsg: gen.errorMsg || '视频生成失败', updatedAt: now() }
  }
  return job
}

// POST /create/generate
app.post('/generate', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const prompt = String(body.prompt || '').trim()
  const outputType = String(body.output_type || body.media_type || '').trim() as 'image' | 'video'
  const assets = resolveAssetsFromBody(body)

  if (!prompt) return badRequest(c, 'prompt is required')
  if (outputType !== 'image' && outputType !== 'video') {
    return badRequest(c, 'output_type must be image or video')
  }
  if (assets.some(asset => !assertUserCanUseMediaPath(user, asset.path))) {
    return notFound(c)
  }

  const ts = now()
  try {
    assertCreateAssetsValid(outputType, assets)
    const configId = body.config_id != null ? Number(body.config_id) : undefined
    logTaskStart('CreateAPI', 'generate', {
      outputType,
      assetCount: assets.length,
      configId,
    })

    const config = resolveCreateConfig(outputType, user.id, configId)
    const [cfgRow] = db.select().from(schema.aiServiceConfigs)
      .where(eq(schema.aiServiceConfigs.id, config.id)).all()
    if (cfgRow && cfgRow.serviceType !== outputType) {
      throw new Error(outputType === 'image'
        ? '所选配置不是图片模型，请重新选择'
        : '所选配置不是视频模型，请重新选择')
    }

    const composedPrompt = buildCreateReferencePrompt(prompt, assets)
    const { imagePaths, videoPaths } = splitCreateAssets(assets)

    let generationId: number
    if (outputType === 'image') {
      generationId = await generateImage({
        prompt: composedPrompt,
        model: config.model || DEFAULT_IMAGE_MODEL,
        referenceImages: imagePaths,
        configId: config.id,
        userId: user.id,
      })
    } else {
      const hasVideos = videoPaths.length > 0
      const hasImages = imagePaths.length > 0
      const referenceMode = hasVideos && hasImages
        ? 'multimodal'
        : hasVideos
          ? 'reference_video'
          : 'multiple'

      generationId = await generateVideo({
        prompt: composedPrompt,
        model: config.model || DEFAULT_VIDEO_MODEL,
        referenceMode,
        referenceImageUrls: hasImages ? imagePaths : undefined,
        referenceVideoUrls: hasVideos ? videoPaths : undefined,
        duration: Number(body.duration) || 5,
        aspectRatio: body.aspect_ratio || 'adaptive',
        configId: config.id,
        userId: user.id,
      })
    }

    const res = db.insert(schema.createJobs).values({
      userId: user.id,
      kind: outputType,
      generationId,
      prompt,
      mediaPath: assets[0]?.path || null,
      assetsJson: JSON.stringify(assets),
      status: 'processing',
      createdAt: ts,
      updatedAt: ts,
    }).run()

    const jobId = Number(res.lastInsertRowid)
    const [job] = db.select().from(schema.createJobs).where(eq(schema.createJobs.id, jobId)).all()
    logTaskSuccess('CreateAPI', 'generate', { jobId, generationId, kind: outputType })
    return created(c, toPublicJob(job))
  } catch (err: any) {
    logTaskError('CreateAPI', 'generate', { error: err.message })
    return taskError(c, err, err.message || '创建任务失败')
  }
})

// GET /create/generate/:id
app.get('/generate/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return badRequest(c, 'invalid id')

  const row = getOwnedCreateJob(id, user.id)
  if (!row) return notFound(c, '任务不存在')

  const synced = syncJobFromGeneration(row)
  return success(c, toPublicJob(synced))
})

export default app
