/** 项目画风 → 提示词描述 */
const STYLE_LABELS: Record<string, string> = {
  anime: '日系动漫风格，赛璐璐平涂，线条清晰，色块分明，大眼睛，柔和渐变阴影',
  realistic: '写实摄影风格，自然光影，皮肤质感细腻，真实比例',
  ghibli: '吉卜力动画风格，柔和水彩质感，温暖色调，手绘笔触',
  cinematic: '电影级画面，戏剧性光影，浅景深，胶片质感',
  comic: '美式漫画风格，粗线条勾边，平涂色块，高对比',
  watercolor: '水彩插画风格，笔触轻柔，色彩晕染，纸质感',
}

const DEFAULT_STYLE_LABEL = '与项目整体一致的高质量插画风格，画面干净统一'

/** 判断是否为群像/龙套角色 */
function isGroupCharacter(char: { name: string; role?: string | null }) {
  return char.role === '龙套'
    || /们$|众人|群众|高管团队|团队成员/.test(char.name)
}

/** 解析项目画风描述 */
export function resolveDramaStyleLabel(style?: string | null): string {
  if (!style?.trim()) return DEFAULT_STYLE_LABEL
  return STYLE_LABELS[style.trim().toLowerCase()] || `${style}，高质量插画风格`
}

/** 构建角色高清风格重绘提示词 */
export function buildCharacterRefinePrompt(char: {
  name: string
  role?: string | null
  appearance?: string | null
  description?: string | null
}, dramaStyle?: string | null) {
  const styleLabel = resolveDramaStyleLabel(dramaStyle)
  const traits = char.appearance || char.description || char.name

  if (isGroupCharacter(char)) {
    return [
      '【高清风格重绘】以参考图为群像身份基准，在保持人物可识别性的前提下，将画面统一为项目画风',
      '必须保持：每位人物的身份特征、人数、站位关系、群像构图、服装与核心配饰',
      '允许调整：笔触、线条、上色方式、光影渲染、背景简化与清晰度，以匹配目标画风',
      '禁止：增减人物、改变站位、替换身份、添加文字水印',
      `画风目标：${styleLabel}`,
      `角色群像：${char.name}，${traits}`,
      '输出：高清群像立绘，无文字，无水印',
    ].join('；')
  }

  return [
    '【高清风格重绘】以参考图为人物身份基准，在保持角色可识别性的前提下，将画面统一为项目画风',
    '必须保持：脸型与五官结构、发型发色、服装款式与配色、体型比例、姿态朝向、表情神态、核心配饰',
    '允许调整：笔触、线条、上色方式、光影渲染、背景简化与清晰度，以匹配目标画风',
    '禁止：替换为其他人物、改变性别年龄、增删服装元素、改变动作姿态、添加文字水印',
    `画风目标：${styleLabel}`,
    `角色：${char.name}，${traits}`,
    '输出：高清角色立绘，与参考图相同或相近构图角度，简洁纯色或渐变背景，无文字，无水印',
  ].join('；')
}
