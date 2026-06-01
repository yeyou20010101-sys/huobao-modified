/**
 * CosyVoice 系统音色（与百炼文档 cosyvoice-v3-flash 列表对齐）
 * @see https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
 */

/** cosyvoice-v3-flash / cosyvoice-v3-plus 可用系统音色 */
export const COSYVOICE_V3_SYSTEM_VOICES = new Set([
  'longanyang',
  'longanhuan',
  'longhuhu_v3',
  'longpaopao_v3',
  'longjielidou_v3',
  'longxian_v3',
  'longling_v3',
  'longshanshan_v3',
  'longniuniu_v3',
  'longjiaxin_v3',
  'longjiayi_v3',
  'longanyue_v3',
  'longlaotie_v3',
  'longshange_v3',
  'longanmin_v3',
  'longfei_v3',
  'longyingxiao_v3',
  'longyingxun_v3',
  'longyingjing_v3',
  'longyingling_v3',
  'longyingtao_v3',
  'longxiaochun_v3',
  'longxiaoxia_v3',
  'longyumi_v3',
  'longanyun_v3',
  'longanwen_v3',
  'longanli_v3',
])

/** cosyvoice-v2 系统音色（勿与 v3 模型混用） */
export const COSYVOICE_V2_SYSTEM_VOICES = new Set([
  'longxiaochun_v2',
  'longwan_v2',
  'longcheng_v2',
  'longhua_v2',
  'longxiaoyu_v2',
])

/** Qwen-TTS 系统音色 */
export const QWEN_TTS_SYSTEM_VOICES = new Set([
  'Cherry',
  'Serena',
  'Ethan',
  'Chelsie',
  'Dylan',
  'Jada',
  'Sunny',
  'Alex',
])

export const COSYVOICE_V3_DEFAULT_VOICE = 'longanyang'
export const COSYVOICE_V2_DEFAULT_VOICE = 'longxiaochun_v2'
export const QWEN_TTS_DEFAULT_VOICE = 'Cherry'
