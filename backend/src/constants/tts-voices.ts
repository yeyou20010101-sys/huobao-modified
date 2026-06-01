/**
 * 内置音色列表（百炼 CosyVoice / Qwen-TTS、豆包语音），供同步到 ai_voices 表
 */
import { COSYVOICE_V3_SYSTEM_VOICES } from './cosyvoice-voices.js'

export interface BuiltinVoice {
  voiceId: string
  voiceName: string
  language: string
  description: string[]
}

const COSYVOICE_V3_LABELS: Record<string, string> = {
  longanyang: '龙安阳',
  longanhuan: '龙安欢',
  longhuhu_v3: '龙虎虎',
  longpaopao_v3: '龙泡泡',
  longxiaochun_v3: '龙小春',
  longxiaoxia_v3: '龙小夏',
  longyumi_v3: '龙玉米',
  longfei_v3: '龙飞',
  longanmin: '龙安敏',
  longlaotie_v3: '龙老铁',
  longshange_v3: '龙陕哥',
  longjiayi_v3: '龙嘉怡',
  longjiaxin_v3: '龙嘉欣',
}

/** 百炼 CosyVoice v3-flash 推荐系统音色（与默认模型 cosyvoice-v3-flash 一致） */
export const ALI_COSYVOICE_V3_VOICES: BuiltinVoice[] = [...COSYVOICE_V3_SYSTEM_VOICES]
  .filter((id) => !id.startsWith('loong'))
  .slice(0, 24)
  .map((voiceId) => ({
    voiceId,
    voiceName: COSYVOICE_V3_LABELS[voiceId] || voiceId,
    language: '中文',
    description: ['CosyVoice v3', '百炼', voiceId.includes('longying') ? '女声' : '男声/童声'],
  }))

export const ALI_QWEN_TTS_VOICES: BuiltinVoice[] = [
  { voiceId: 'Cherry', voiceName: 'Cherry', language: '中文', description: ['Qwen-TTS', '女声', '甜美'] },
  { voiceId: 'Serena', voiceName: 'Serena', language: '中文', description: ['Qwen-TTS', '女声'] },
  { voiceId: 'Ethan', voiceName: 'Ethan', language: '中文', description: ['Qwen-TTS', '男声'] },
  { voiceId: 'Chelsie', voiceName: 'Chelsie', language: '中文', description: ['Qwen-TTS', '女声'] },
]

export const ALI_TTS_VOICES: BuiltinVoice[] = [
  ...ALI_COSYVOICE_V3_VOICES,
  ...ALI_QWEN_TTS_VOICES,
]

export const VOLCENGINE_TTS_VOICES: BuiltinVoice[] = [
  { voiceId: 'zh_female_shuangkuaisisi_moon_bigtts', voiceName: '爽快思思', language: '中文', description: ['豆包语音', '女声'] },
  { voiceId: 'zh_male_M392_conversation_wvae_bigtts', voiceName: '对话男声 M392', language: '中文', description: ['豆包语音', '男声'] },
  { voiceId: 'zh_female_tianmeixiaoyuan_moon_bigtts', voiceName: '甜美小源', language: '中文', description: ['豆包语音', '女声'] },
  { voiceId: 'zh_male_yangguangqingnian_moon_bigtts', voiceName: '阳光青年', language: '中文', description: ['豆包语音', '男声'] },
  { voiceId: 'zh_female_wanwanxiaohe_moon_bigtts', voiceName: '湾湾小何', language: '中文', description: ['豆包语音', '女声'] },
]
