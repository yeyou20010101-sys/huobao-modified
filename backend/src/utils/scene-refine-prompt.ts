import { resolveDramaStyleLabel } from './character-refine-prompt.js'

type ScenePromptInput = {
  location: string
  time?: string | null
  prompt?: string | null
}

/** 构建场景文生图提示词（注入项目画风） */
export function buildSceneGeneratePrompt(scene: ScenePromptInput, dramaStyle?: string | null) {
  const styleLabel = resolveDramaStyleLabel(dramaStyle)
  const desc = scene.prompt?.trim()
    || `${scene.location}${scene.time ? `，${scene.time}` : ''}，高质量场景，电影感`

  return [
    `画风：${styleLabel}`,
    `地点：${scene.location}`,
    scene.time?.trim() ? `时间：${scene.time.trim()}` : '',
    `画面描述：${desc}`,
    '纯背景环境图，无人物，无文字，无水印，电影级构图，高清细节',
  ].filter(Boolean).join('；')
}

/** 构建场景高清风格重绘提示词 */
export function buildSceneRefinePrompt(scene: ScenePromptInput, dramaStyle?: string | null) {
  const styleLabel = resolveDramaStyleLabel(dramaStyle)
  const desc = scene.prompt || `${scene.location}，${scene.time || ''}`

  return [
    '【高清风格重绘】以参考图为场景空间基准，在保持空间可识别性的前提下，将画面统一为项目画风',
    '必须保持：场景类型、空间结构、建筑与核心道具位置、透视角度、时间段氛围、色调基调',
    '允许调整：笔触、线条、上色方式、光影渲染、细节清晰度，以匹配目标画风',
    '禁止：添加人物、改变场景类型、增删关键建筑或道具、改变天气时间、添加文字水印',
    `画风目标：${styleLabel}`,
    `场景：${scene.location}，${scene.time || ''}，${desc}`,
    '输出：高清纯背景场景图，无人物，无文字，无水印',
  ].join('；')
}
