/**
 * TTS 语音合成服务
 * 支持 MiniMax、阿里云百炼（CosyVoice / Qwen-TTS）、火山豆包语音
 */
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { getAudioConfigById } from './ai.js'
import { getTTSAdapter } from './adapters/registry.js'
import type { TTSParsedAudio } from './adapters/types.js'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess, redactUrl } from '../utils/task-logger.js'
import { userStorageAbsDir, toStaticRelative } from '../utils/storage.js'
import { randomUUID } from 'crypto'
import { beginTask, refundTask, settleTask } from './billing.js'

interface TTSParams {
  text: string
  voice: string
  model?: string
  speed?: number
  emotion?: string
  configId?: number | null
  userId: number
  storageUserId?: number
  dramaId?: number | null
  episodeId?: number | null
  storyboardId?: number | null
}

async function audioBufferFromParsed(parsed: TTSParsedAudio): Promise<Buffer> {
  if (parsed.audioHex) {
    return Buffer.from(parsed.audioHex, 'hex')
  }
  if (parsed.audioBase64) {
    return Buffer.from(parsed.audioBase64, 'base64')
  }
  if (parsed.audioUrl) {
    const resp = await fetch(parsed.audioUrl)
    if (!resp.ok) {
      throw new Error(`Failed to download TTS audio: ${resp.status}`)
    }
    const arr = await resp.arrayBuffer()
    return Buffer.from(arr)
  }
  throw new Error('TTS response has no audio payload')
}

/**
 * 生成 TTS 音频，返回本地文件路径
 */
export async function generateTTS(params: TTSParams): Promise<string> {
  const config = getAudioConfigById(params.configId, params.userId)
  const adapter = getTTSAdapter(config.provider)
  const model = params.model || config.model
  const hold = beginTask({
    userId: params.userId,
    taskType: 'tts',
    provider: config.provider,
    model,
    dramaId: params.dramaId ?? null,
    episodeId: params.episodeId ?? null,
    storyboardId: params.storyboardId ?? null,
    refType: params.storyboardId ? 'storyboards_tts' : 'tts',
    refId: params.storyboardId ?? null,
    idempotencyKey: `tts:${randomUUID()}`,
  })

  try {
    logTaskStart('AudioTask', 'tts-generate', {
    provider: config.provider,
    voice: params.voice,
    model,
    textPreview: params.text.slice(0, 50),
    textLength: params.text.length,
  })
  logTaskPayload('AudioTask', 'tts params', {
    config: {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    params,
  })

  const { url, method, headers, body } = adapter.buildGenerateRequest(config, {
    ...params,
    model,
  })
  logTaskProgress('AudioTask', 'request', {
    provider: config.provider,
    voice: params.voice,
    method,
    url: redactUrl(url),
    model,
  })
  logTaskPayload('AudioTask', 'request payload', {
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

  if (!resp.ok) {
    const errText = await resp.text()
    logTaskError('AudioTask', 'tts-generate', { provider: config.provider, voice: params.voice, status: resp.status, error: errText })
    if (errText.includes('418')) {
      throw new Error(
        '语音合成失败：音色与模型不匹配。若刚切换到百炼音频，请到设置→音频→同步音色，并在剧本→音色中为每个角色重新选音色（勿保留 MiniMax 的 voice_id）。',
      )
    }
    throw new Error(`TTS API error ${resp.status}: ${errText}`)
  }

  const result = await resp.json()
  const parsed = adapter.parseResponse(result)
  const buffer = await audioBufferFromParsed(parsed)

  const audioUserId = params.storageUserId && params.storageUserId > 0
    ? params.storageUserId
    : params.userId
  const audioDir = userStorageAbsDir(audioUserId, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })
  const filename = `${uuid()}.${parsed.format || 'mp3'}`
  const filePath = path.join(audioDir, filename)
  fs.writeFileSync(filePath, buffer)

  const relativePath = toStaticRelative(audioUserId, 'audio', filename)
  logTaskSuccess('AudioTask', 'tts-saved', {
    provider: config.provider,
    voice: params.voice,
    path: relativePath,
    bytes: buffer.length,
    audioMs: parsed.audioLength,
  })
    settleTask(hold.id)
    return relativePath
  } catch (err) {
    refundTask(hold.id, err instanceof Error ? err.message : 'TTS 失败')
    throw err
  }
}

/**
 * 为角色生成试听音频
 */
export async function generateVoiceSample(
  characterName: string,
  voiceId: string,
  configId: number | null | undefined,
  userId: number,
  storageUserId?: number,
): Promise<string> {
  const sampleText = `你好，我是${characterName}。很高兴认识你，这是我的声音试听。`
  return generateTTS({ text: sampleText, voice: voiceId, configId, userId, storageUserId })
}
