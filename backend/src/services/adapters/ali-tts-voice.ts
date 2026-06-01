/**
 * 百炼 TTS 音色与模型版本对齐，避免 CosyVoice 418（音色与 model 不匹配）
 */
import {
  COSYVOICE_V2_DEFAULT_VOICE,
  COSYVOICE_V2_SYSTEM_VOICES,
  COSYVOICE_V3_DEFAULT_VOICE,
  COSYVOICE_V3_SYSTEM_VOICES,
  QWEN_TTS_DEFAULT_VOICE,
  QWEN_TTS_SYSTEM_VOICES,
} from '../../constants/cosyvoice-voices.js'

export interface ResolvedAliVoice {
  voice: string
  remapped: boolean
  hint?: string
}

/** MiniMax / OpenAI 风格音色 ID，不能用于 CosyVoice */
export function isAliIncompatibleVoiceId(voice: string): boolean {
  const v = String(voice || '').trim()
  if (!v) return true
  if (/^(alloy|echo|fable|onyx|nova|shimmer)$/i.test(v)) return true
  if (/^(male|female)-/i.test(v)) return true
  if (/Chinese|English|Japanese|Korean|Cantonese/i.test(v)) return true
  if (/_(bigtts|streaming)$/i.test(v)) return true
  if (/^[A-Z][a-z]+_[A-Z]/.test(v)) return true
  return false
}

function isCosyVoiceV2Model(model: string): boolean {
  const m = model.toLowerCase()
  return m.includes('cosyvoice-v2') || m === 'cosyvoice-v2'
}

function isCosyVoiceV35Model(model: string): boolean {
  return model.toLowerCase().includes('cosyvoice-v3.5')
}

function isQwenTtsModel(model: string): boolean {
  return model.toLowerCase().startsWith('qwen')
}

export function resolveAliTtsVoice(model: string, voice: string): ResolvedAliVoice {
  const m = String(model || 'cosyvoice-v3-flash').trim()
  const raw = String(voice || '').trim()

  if (isQwenTtsModel(m)) {
    if (QWEN_TTS_SYSTEM_VOICES.has(raw)) return { voice: raw, remapped: false }
    return {
      voice: QWEN_TTS_DEFAULT_VOICE,
      remapped: raw !== QWEN_TTS_DEFAULT_VOICE,
      hint: raw
        ? `音色「${raw}」与 Qwen-TTS 不兼容，已改用 ${QWEN_TTS_DEFAULT_VOICE}。请在剧本→音色中重新分配。`
        : undefined,
    }
  }

  if (isCosyVoiceV2Model(m)) {
    if (COSYVOICE_V2_SYSTEM_VOICES.has(raw)) return { voice: raw, remapped: false }
    if (raw.endsWith('_v2')) return { voice: raw, remapped: false }
    return {
      voice: COSYVOICE_V2_DEFAULT_VOICE,
      remapped: raw !== COSYVOICE_V2_DEFAULT_VOICE,
      hint: raw
        ? `音色「${raw}」与 ${m} 不兼容，已改用 ${COSYVOICE_V2_DEFAULT_VOICE}。`
        : undefined,
    }
  }

  // v3.5 仅支持复刻/设计音色；系统音色或 MiniMax ID 会 418
  if (isCosyVoiceV35Model(m)) {
    if (!raw || COSYVOICE_V3_SYSTEM_VOICES.has(raw) || isAliIncompatibleVoiceId(raw)) {
      return {
        voice: COSYVOICE_V3_DEFAULT_VOICE,
        remapped: true,
        hint: `${m} 仅支持声音复刻/设计得到的音色 ID，不能使用系统音色。请改用 cosyvoice-v3-flash，或在百炼创建专属音色后填入角色。`,
      }
    }
    return { voice: raw, remapped: false }
  }

  // cosyvoice-v3-flash / cosyvoice-v3-plus
  if (COSYVOICE_V3_SYSTEM_VOICES.has(raw)) return { voice: raw, remapped: false }
  if (raw.endsWith('_v3') && !isAliIncompatibleVoiceId(raw)) {
    return { voice: raw, remapped: false }
  }

  const needsRemap = !raw
    || isAliIncompatibleVoiceId(raw)
    || QWEN_TTS_SYSTEM_VOICES.has(raw)
    || raw.endsWith('_v2')
    || COSYVOICE_V2_SYSTEM_VOICES.has(raw)

  if (needsRemap) {
    return {
      voice: COSYVOICE_V3_DEFAULT_VOICE,
      remapped: true,
      hint: raw
        ? `音色「${raw}」与 ${m} 不匹配（常见：仍使用 MiniMax 音色）。已临时改用 ${COSYVOICE_V3_DEFAULT_VOICE}，请到剧本→音色重新分配并同步百炼音色。`
        : `未设置音色，已使用默认 ${COSYVOICE_V3_DEFAULT_VOICE}。`,
    }
  }

  return { voice: raw, remapped: false }
}
