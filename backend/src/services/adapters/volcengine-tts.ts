/**
 * 火山引擎豆包语音合成（openspeech HTTP v1）
 * 需在配置 settings 中填写 app_id；api_key 填控制台 Access Token
 * 文档: https://www.volcengine.com/docs/6561/1257584
 */
import { randomUUID } from 'crypto'
import type { TTSProviderAdapter, AIConfig, TTSParsedAudio } from './types.js'

export interface TTSParams {
  text: string
  voice: string
  speed?: number
  model?: string
}

function parseSettings(config: AIConfig): { appId: string; cluster: string } {
  const raw = config.settings || {}
  return {
    appId: String(raw.app_id || raw.appId || '').trim(),
    cluster: String(raw.cluster || 'volcano_tts').trim() || 'volcano_tts',
  }
}

function openspeechBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (trimmed.includes('openspeech')) return trimmed
  return 'https://openspeech.bytedance.com'
}

export class VolcEngineTTSAdapter implements TTSProviderAdapter {
  readonly provider = 'volcengine'

  buildGenerateRequest(config: AIConfig, params: TTSParams) {
    const { appId, cluster } = parseSettings(config)
    if (!appId) {
      throw new Error('火山豆包语音需在服务配置的 settings 中填写 app_id（JSON），或在设置页填写 App ID')
    }

    const base = openspeechBase(config.baseUrl)
    const url = `${base}/api/v1/tts`
    const speed = params.speed ?? 1

    const body = {
      app: {
        appid: appId,
        token: config.apiKey,
        cluster,
      },
      user: {
        uid: 'huobao-drama',
      },
      audio: {
        voice_type: params.voice,
        encoding: 'mp3',
        speed_ratio: speed,
      },
      request: {
        reqid: randomUUID(),
        text: params.text,
        operation: 'query',
      },
    }

    return {
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer;${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    }
  }

  parseResponse(result: any): TTSParsedAudio {
    const code = result?.code ?? result?.status_code
    if (code !== 3000 && code !== 0 && code !== '0') {
      throw new Error(result?.message || result?.status_msg || `Volcengine TTS error: ${code}`)
    }

    const data = result?.data
    if (!data) throw new Error('No audio data in Volcengine TTS response')

    if (typeof data === 'string') {
      return {
        audioBase64: data,
        audioLength: 0,
        sampleRate: 24000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      }
    }

    if (data?.audio) {
      return {
        audioBase64: String(data.audio),
        audioLength: 0,
        sampleRate: 24000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      }
    }

    throw new Error('Unrecognized Volcengine TTS response format')
  }
}
