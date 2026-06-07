import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { resolveDramaStyleLabel } from './character-refine-prompt.js'

const MAX_CHARACTER_REFS = 2
const MAX_TOTAL_REFS = 6

type StoryboardRow = typeof schema.storyboards.$inferSelect
type CharacterRow = typeof schema.characters.$inferSelect
type SceneRow = typeof schema.scenes.$inferSelect

export type ShotReferenceAsset = {
  path: string
  label: string
  kind: 'scene' | 'character' | 'extra'
  imageLabel: string
}

/** 从分镜文本推断本镜实际出场角色 */
export function pickVisibleCharacters(sb: StoryboardRow, characters: CharacterRow[]) {
  if (!characters.length) return []

  const text = [
    sb.action,
    sb.dialogue,
    sb.imagePrompt,
    sb.description,
    sb.title,
    sb.videoPrompt,
  ].filter(Boolean).join(' ')

  if (text.trim()) {
    const mentioned = characters.filter((char) => char.name && text.includes(char.name))
    if (mentioned.length) return mentioned.slice(0, MAX_CHARACTER_REFS)
  }

  if (characters.length === 1) return characters
  return characters.slice(0, 1)
}

function parseStoryboardExtraRefs(raw: string | null | undefined) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

/** 场景软参考 + 本镜出场角色（最多 2 张） */
export function buildShotReferenceAssets(
  sb: StoryboardRow,
  scene: SceneRow | null | undefined,
  characters: CharacterRow[],
): ShotReferenceAsset[] {
  const assets: ShotReferenceAsset[] = []
  const seen = new Set<string>()

  const pushAsset = (path: string | null | undefined, label: string, kind: ShotReferenceAsset['kind']) => {
    if (!path || seen.has(path) || assets.length >= MAX_TOTAL_REFS) return
    seen.add(path)
    assets.push({ path, label, kind, imageLabel: `图片${assets.length + 1}` })
  }

  pushAsset(
    scene?.imageUrl || scene?.localPath,
    `${scene?.location || sb.location || '场景'}氛围参考`,
    'scene',
  )

  for (const char of pickVisibleCharacters(sb, characters)) {
    pushAsset(char.imageUrl || char.localPath, `${char.name}角色外貌`, 'character')
  }

  for (const ref of parseStoryboardExtraRefs(sb.referenceImages)) {
    pushAsset(ref, '镜头参考图', 'extra')
  }

  return assets
}

function buildSceneContext(sb: StoryboardRow, scene: SceneRow | null | undefined) {
  const location = sb.location || scene?.location || ''
  const time = sb.time || scene?.time || ''
  const desc = scene?.prompt?.trim() || [location, time].filter(Boolean).join('，')
  if (!desc) return ''
  return `场景文字描述：${desc}`
}

function buildReferenceLegend(assets: ShotReferenceAsset[]) {
  if (!assets.length) return ''
  return assets.map((asset) => {
    if (asset.kind === 'scene') {
      return `${asset.imageLabel}=${asset.label}（软参考：空间类型、材质、色调、光照；不锁定原图构图）`
    }
    if (asset.kind === 'character') {
      return `${asset.imageLabel}=${asset.label}（仅约束五官、发型、服装配色，不约束姿态与背景）`
    }
    return `${asset.imageLabel}=${asset.label}`
  }).join('；')
}

const SHOT_FRAME_SCENE_RULES = [
  '场景参考图仅作氛围与空间风格参考，禁止作为不可改动的背景底图直接复用',
  '须结合本镜景别、机位、动作对空间重新取景构图',
  '当场景参考图构图与本镜机位冲突时，以本镜景别机位为准重新绘制整个空间',
]

const SHOT_FRAME_FUSION_RULES = [
  '场景与人物须在同一三维空间内同时渲染，禁止抠图粘贴、禁止白底叠加、禁止拼贴合成',
  '人物光影、透视须与重绘后的场景一致',
  '人物须位于物理合理位置（坐在椅子上、站在地面），禁止站在桌面或坐在桌面上',
]

/** 单人近景：image_prompt 中标记无需其他人物 */
function isSoloFocusImagePrompt(imagePrompt?: string | null) {
  if (!imagePrompt) return false
  return /【无满座要求】|无需其他参会者|其他人影不必|无满座要求/.test(imagePrompt)
}

/** 构建首尾帧完整提示词 */
export function buildShotFramePrompt(
  sb: StoryboardRow,
  frameType: string,
  assets: ShotReferenceAsset[],
  characters: CharacterRow[],
  dramaStyle?: string | null,
  scene?: SceneRow | null,
) {
  const styleLabel = resolveDramaStyleLabel(dramaStyle)
  const visibleNames = pickVisibleCharacters(sb, characters).map((char) => char.name)
  const imagePrompt = sb.imagePrompt || sb.description || ''
  const soloFocus = isSoloFocusImagePrompt(imagePrompt)
  const frameHint = frameType === 'first_frame'
    ? '生成镜头起始关键帧，突出建立关系与动作开始瞬间'
    : '生成镜头结束关键帧，突出动作结束、情绪落点或结果状态'

  const hasSceneRef = assets.some((asset) => asset.kind === 'scene')

  const occupancyRule = soloFocus && visibleNames.length
    ? `本镜清晰绘制：${visibleNames.join('、')}；着重人物动作细节与背景环境，无需其他人物`
    : visibleNames.length
      ? `本镜清晰绘制：${visibleNames.join('、')}`
      : '本镜无人物，纯环境画面'

  return [
    '【整帧重绘】生成完整单帧画面，不是在原图上贴人物或换背景',
    `画风：${styleLabel}`,
    buildSceneContext(sb, scene),
    assets.length ? `参考图映射：${buildReferenceLegend(assets)}` : '无参考图，按画面描述绘制',
    ...SHOT_FRAME_SCENE_RULES,
    hasSceneRef ? '角色参考图仅约束身份外貌，须按本镜机位重绘姿态与位置' : '',
    ...SHOT_FRAME_FUSION_RULES,
    occupancyRule,
    sb.title ? `镜头标题：${sb.title}` : '',
    imagePrompt ? `画面描述：${imagePrompt}` : '',
    sb.shotType ? `景别：${sb.shotType}` : '',
    sb.angle ? `机位：${sb.angle}` : '',
    sb.movement ? `运镜：${sb.movement}` : '',
    sb.location ? `地点：${sb.location}` : '',
    sb.time ? `时间：${sb.time}` : '',
    sb.action ? `动作：${sb.action}` : '',
    sb.atmosphere ? `氛围：${sb.atmosphere}` : '',
    frameHint,
    '输出：单帧电影画面，无文字，无水印',
  ].filter(Boolean).join('；')
}

/** 根据分镜 ID 解析首尾帧 prompt 与参考图 */
export function resolveShotFrameGeneration(storyboardId: number, frameType: string, dramaId?: number) {
  const [sb] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId)).all()
  if (!sb) throw new Error('Storyboard not found')

  const charLinks = db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId)).all()
  const charIds = charLinks.map((link) => link.characterId)
  const characters = charIds.length
    ? db.select().from(schema.characters).all().filter((char) => charIds.includes(char.id) && !char.deletedAt)
    : []

  const scene = sb.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, sb.sceneId)).all()[0]
    : null

  const resolvedDramaId = dramaId || scene?.dramaId
  const [drama] = resolvedDramaId
    ? db.select().from(schema.dramas).where(eq(schema.dramas.id, resolvedDramaId)).all()
    : []

  const assets = buildShotReferenceAssets(sb, scene, characters)
  const prompt = buildShotFramePrompt(sb, frameType, assets, characters, drama?.style, scene)

  return {
    prompt,
    referenceImages: assets.map((asset) => asset.path),
    visibleCharacterNames: pickVisibleCharacters(sb, characters).map((char) => char.name),
  }
}
