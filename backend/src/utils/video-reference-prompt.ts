import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { resolveDramaStyleLabel } from './character-refine-prompt.js'

const MAX_TOTAL_REFS = 6

type StoryboardRow = typeof schema.storyboards.$inferSelect
type CharacterRow = typeof schema.characters.$inferSelect
type SceneRow = typeof schema.scenes.$inferSelect

export type VideoReferenceAsset = {
  path: string
  label: string
  kind: 'scene' | 'character' | 'extra'
  imageLabel: string
}

function getStoryboardCharacterIds(storyboardId: number) {
  return db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId)).all()
    .map((link) => link.characterId)
}

function getBoundCharacters(storyboardId: number): CharacterRow[] {
  const charIds = getStoryboardCharacterIds(storyboardId)
  if (!charIds.length) return []
  const all = db.select().from(schema.characters).all().filter((char) => !char.deletedAt)
  return charIds
    .map((id) => all.find((char) => char.id === id))
    .filter((char): char is CharacterRow => !!char)
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

/** 多参考视频：绑定角色图1… → 手动附加参考 → 场景置后（降低空镜开场权重） */
export function buildVideoReferenceAssets(
  sb: StoryboardRow,
  scene: SceneRow | null | undefined,
  characters: CharacterRow[],
): VideoReferenceAsset[] {
  const assets: VideoReferenceAsset[] = []
  const seen = new Set<string>()

  const pushAsset = (path: string | null | undefined, label: string, kind: VideoReferenceAsset['kind']) => {
    if (!path || seen.has(path) || assets.length >= MAX_TOTAL_REFS) return
    seen.add(path)
    assets.push({ path, label, kind, imageLabel: `图${assets.length + 1}` })
  }

  for (const char of characters) {
    pushAsset(char.imageUrl || char.localPath, `${char.name}角色`, 'character')
  }

  for (const ref of parseStoryboardExtraRefs(sb.referenceImages)) {
    pushAsset(ref, '镜头参考', 'extra')
  }

  pushAsset(
    scene?.imageUrl || scene?.localPath,
    `${scene?.location || sb.location || '场景'}氛围`,
    'scene',
  )

  return assets
}

/** 去掉 video_prompt 中与【参数】段重复的技术行 */
function sanitizeVideoPrompt(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      if (/^16:9/i.test(line)) return false
      if (/^高清细节/.test(line)) return false
      if (/无文字/.test(line) && line.length < 40) return false
      if (/^无水印/.test(line)) return false
      return true
    })
    .join('\n')
}

function resolveMotionScript(sb: StoryboardRow): string {
  const fromVideo = sb.videoPrompt?.trim()
  if (fromVideo) return sanitizeVideoPrompt(fromVideo)
  return [sb.action, sb.description].filter(Boolean).join('；')
}

/** 视频生成仅用中文地点/时间，不注入 scene.prompt（避免英文与 --no characters 冲突） */
function buildVideoSceneHint(sb: StoryboardRow, scene: SceneRow | null | undefined): string {
  const location = sb.location || scene?.location || ''
  const time = sb.time || scene?.time || ''
  return [location, time].filter(Boolean).join('，')
}

function buildShortReferenceLegend(assets: VideoReferenceAsset[]) {
  if (!assets.length) return ''
  return assets.map((asset) => {
    if (asset.kind === 'scene') {
      return `${asset.imageLabel}=${asset.label}（仅色调与空间，不作开场构图）`
    }
    if (asset.kind === 'character') {
      return `${asset.imageLabel}=${asset.label}`
    }
    return `${asset.imageLabel}=${asset.label}`
  }).join('；')
}

function motionAlreadyMentions(motion: string, keyword: string | null | undefined): boolean {
  if (!keyword?.trim() || !motion) return false
  return motion.includes(keyword.trim())
}

/** 构建多参考图模式完整视频提示词（动作脚本优先） */
export function buildVideoReferencePrompt(
  sb: StoryboardRow,
  assets: VideoReferenceAsset[],
  characters: CharacterRow[],
  dramaStyle?: string | null,
  scene?: SceneRow | null,
) {
  const styleLabel = resolveDramaStyleLabel(dramaStyle)
  const characterNames = characters.map((char) => char.name)
  const motionScript = resolveMotionScript(sb)
  const sceneHint = buildVideoSceneHint(sb, scene)
  const duration = Math.min(12, Math.max(4, Number(sb.duration) || 5))

  const sections: string[] = []

  if (motionScript) {
    sections.push(`【动作脚本】须严格按以下时间线与动作生成视频：\n${motionScript}`)
  }

  if (assets.length) {
    sections.push(`【参考图】${buildShortReferenceLegend(assets)}`)
  }

  const constraintParts = [
    characterNames.length ? `本镜角色：${characterNames.join('、')}` : '',
    '人物全程清晰同框互动',
    '禁止空镜或纯场景开场',
    '禁止抠图拼贴',
    '角色参考仅约束外貌，姿态与动作按动作脚本执行',
  ].filter(Boolean)
  sections.push(`【约束】${constraintParts.join('；')}`)

  const paramParts = [
    `画风：${styleLabel}`,
    sceneHint ? `地点：${sceneHint}` : '',
    sb.shotType && !motionAlreadyMentions(motionScript, sb.shotType) ? `景别：${sb.shotType}` : '',
    sb.movement && !motionAlreadyMentions(motionScript, sb.movement) ? `运镜：${sb.movement}` : '',
    sb.atmosphere && !motionAlreadyMentions(motionScript, sb.atmosphere) ? `氛围：${sb.atmosphere}` : '',
    `时长：${duration}秒`,
    '16:9，无文字，无水印',
  ].filter(Boolean)
  sections.push(`【参数】${paramParts.join('；')}`)

  return sections.join('\n\n')
}

/** 根据分镜 ID 解析多参考图视频 prompt 与参考图 */
export function resolveVideoReferenceGeneration(storyboardId: number, dramaId?: number) {
  const [sb] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId)).all()
  if (!sb) throw new Error('Storyboard not found')

  const characters = getBoundCharacters(storyboardId)
  const scene = sb.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, sb.sceneId)).all()[0]
    : null

  const resolvedDramaId = dramaId || scene?.dramaId
  const [drama] = resolvedDramaId
    ? db.select().from(schema.dramas).where(eq(schema.dramas.id, resolvedDramaId)).all()
    : []

  const assets = buildVideoReferenceAssets(sb, scene, characters)
  if (!assets.length) {
    throw new Error('多参考图模式需要至少一张参考图：请为绑定场景/角色上传立绘，或添加镜头参考图')
  }

  const prompt = buildVideoReferencePrompt(sb, assets, characters, drama?.style, scene)

  return {
    prompt,
    referenceImages: assets.map((asset) => asset.path),
    characterNames: characters.map((char) => char.name),
  }
}
