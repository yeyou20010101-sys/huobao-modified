/**
 * 阿里云百炼 / DashScope 语音合成
 * - CosyVoice / Qwen-TTS: POST /api/v1/services/audio/tts/SpeechSynthesizer
 * - MiniMax（百炼托管）: POST /api/v1/services/aigc/multimodal-generation/generation
 */
import type { TTSProviderAdapter, AIConfig, TTSParsedAudio } from './types.js'
import { joinProviderUrl } from './url.js'
import { resolveAliTtsVoice } from './ali-tts-voice.js'
import { logTaskWarn } from '../../utils/task-logger.js'

export interface TTSParams {
  text: string
  voice: string
  speed?: number
  model?: string
  emotion?: string
}

function resolveModel(config: AIConfig, params: TTSParams): string {
  return String(params.model || config.model || 'cosyvoice-v3-flash').trim()
}

function isMiniMaxOnDashscope(model: string): boolean {
  return model.toLowerCase().startsWith('minimax/')
}

function isQwenTts(model: string): boolean {
  return model.toLowerCase().startsWith('qwen')
}

function dashscopeRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (trimmed.includes('dashscope')) return trimmed.replace(/\/compatible-mode\/v1$/, '').replace(/\/api\/v1$/, '') || 'https://dashscope.aliyuncs.com'
  return trimmed || 'https://dashscope.aliyuncs.com'
}

export class AliTTSAdapter implements TTSProviderAdapter {
  readonly provider = 'ali'

  buildGenerateRequest(config: AIConfig, params: TTSParams) {
    const model = resolveModel(config, params)
    const root = dashscopeRoot(config.baseUrl)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (isMiniMaxOnDashscope(model)) {
      const voiceId = String(params.voice || '').trim() || 'male-qn-qingse'
      const url = joinProviderUrl(root, '/api/v1', '/services/aigc/multimodal-generation/generation')
      const body = {
        model,
        input: {
          text: params.text,
          voice_setting: {
            voice_id: voiceId,
            speed: params.speed ?? 1,
            vol: 1,
            pitch: 0,
            emotion: params.emotion || 'happy',
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1,
          },
        },
      }
      return { url, method: 'POST', headers, body }
    }

    const url = joinProviderUrl(root, '/api/v1', '/services/audio/tts/SpeechSynthesizer')
    const format = 'mp3'
    const sampleRate = 24000
    const resolved = resolveAliTtsVoice(model, params.voice)
    if (model.toLowerCase().includes('cosyvoice-v3.5') && resolved.remapped) {
      throw new Error(
        resolved.hint || `${model} 仅支持声音复刻/设计音色，请改用 cosyvoice-v3-flash 或为角色配置复刻音色 ID。`,
      )
    }
    if (resolved.remapped) {
      logTaskWarn('AudioTask', 'ali-voice-remapped', {
        model,
        from: params.voice,
        to: resolved.voice,
        hint: resolved.hint,
      })
    }

    if (isQwenTts(model)) {
      const body = {
        model,
        input: {
          text: params.text,
          voice: resolved.voice,
          language_type: 'Chinese',
          format,
          sample_rate: sampleRate,
        },
      }
      return { url, method: 'POST', headers, body }
    }

    const body = {
      model,
      input: {
        text: params.text,
        voice: resolved.voice,
        format,
        sample_rate: sampleRate,
      },
    }
    return { url, method: 'POST', headers, body }
  }

  parseResponse(result: any): TTSParsedAudio {
    if (result?.code || result?.message) {
      const msg = String(result.message || result.code || 'TTS failed')
      if (msg.includes('418')) {
        throw new Error(
          'CosyVoice 音色与模型不匹配：请到设置→音频→同步音色，并在剧本→音色中为角色重新选择百炼音色（勿使用原 MiniMax 音色 ID）。若使用 cosyvoice-v3.5 模型，需使用声音复刻/设计得到的音色 ID。',
        )
      }
      throw new Error(msg)
    }
    if (result?.output?.code) {
      throw new Error(String(result.output.message || result.output.code))
    }

    const audio = result?.output?.audio
    const url = audio?.url
      || result?.output?.audio_url
      || result?.output?.url
    if (url) {
      return {
        audioUrl: String(url),
        audioLength: 0,
        sampleRate: 24000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      }
    }

    const base64 = audio?.data
      || result?.output?.audio_base64
      || result?.data?.audio
    if (base64) {
      return {
        audioBase64: String(base64),
        audioLength: 0,
        sampleRate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      }
    }

    const hex = result?.data?.audio || result?.output?.audio_hex
    if (hex) {
      return {
        audioHex: String(hex),
        audioLength: 0,
        sampleRate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      }
    }

    throw new Error('No audio in DashScope TTS response')
  }
}
