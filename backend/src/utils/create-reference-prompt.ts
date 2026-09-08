/** 创作台附件角色与 prompt 组装 */

export type CreateAssetRole =
  | 'character'
  | 'scene'
  | 'style'
  | 'extra'
  | 'main_video'
  | 'ref_video'

export type CreateAssetKind = 'image' | 'video'

export interface CreateAssetInput {
  path: string
  kind: CreateAssetKind
  role: CreateAssetRole
}

const ROLE_ORDER: CreateAssetRole[] = [
  'main_video',
  'character',
  'scene',
  'style',
  'ref_video',
  'extra',
]

const ROLE_LABEL: Record<CreateAssetRole, string> = {
  main_video: '主视频',
  character: '人物',
  scene: '场景',
  style: '风格',
  ref_video: '补充视频',
  extra: '补充参考',
}

const MAX_IMAGES = 9
const MAX_VIDEOS = 3

export function normalizeCreateAssets(raw: unknown): CreateAssetInput[] {
  if (!Array.isArray(raw)) return []
  const assets: CreateAssetInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const path = String((item as any).path || '').trim().replace(/^\//, '')
    const kind = String((item as any).kind || '').trim() as CreateAssetKind
    const role = String((item as any).role || '').trim() as CreateAssetRole
    if (!path.startsWith('static/')) continue
    if (kind !== 'image' && kind !== 'video') continue
    if (!ROLE_LABEL[role]) continue
    if (kind === 'image' && (role === 'main_video' || role === 'ref_video')) continue
    if (kind === 'video' && role !== 'main_video' && role !== 'ref_video') continue
    assets.push({ path, kind, role })
  }
  return assets
}

/** 校验附件数量与输出类型约束 */
export function assertCreateAssetsValid(outputType: 'image' | 'video', assets: CreateAssetInput[]) {
  const images = assets.filter((a) => a.kind === 'image')
  const videos = assets.filter((a) => a.kind === 'video')

  if (images.length > MAX_IMAGES) {
    throw new Error(`图片最多 ${MAX_IMAGES} 张`)
  }
  if (videos.length > MAX_VIDEOS) {
    throw new Error(`视频最多 ${MAX_VIDEOS} 段`)
  }

  if (outputType === 'image') {
    if (!images.length) throw new Error('生成图片至少需要一张参考图')
    return
  }

  if (!images.length && !videos.length) {
    throw new Error('生成视频至少需要一段视频或一张参考图')
  }
}

function sortAssets(assets: CreateAssetInput[]) {
  return [...assets].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
}

/** 按角色组装确定性 prompt（非 Agent） */
export function buildCreateReferencePrompt(userPrompt: string, assets: CreateAssetInput[]) {
  const sorted = sortAssets(assets)
  const lines: string[] = ['【参考素材】']
  let imageIndex = 0
  let videoIndex = 0

  for (const asset of sorted) {
    if (asset.kind === 'image') {
      imageIndex += 1
      lines.push(`图${imageIndex}=${ROLE_LABEL[asset.role]}`)
    } else {
      videoIndex += 1
      lines.push(`视频${videoIndex}=${ROLE_LABEL[asset.role]}`)
    }
  }

  const hasMainVideo = sorted.some((a) => a.role === 'main_video')
  if (hasMainVideo) {
    lines.push('请保留主视频的动作与运镜节奏，并按人物/场景参考图调整外观与环境。')
  }

  lines.push('')
  lines.push('【用户需求】')
  lines.push(userPrompt.trim())
  return lines.join('\n')
}

export function splitCreateAssets(assets: CreateAssetInput[]) {
  const imagePaths = assets.filter((a) => a.kind === 'image').map((a) => a.path)
  const videoPaths = sortAssets(assets)
    .filter((a) => a.kind === 'video')
    .map((a) => a.path)
  return { imagePaths, videoPaths }
}
