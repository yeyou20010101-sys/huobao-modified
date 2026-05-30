/**
 * 火山引擎 veImageX 图片生成 Adapter
 * 端点: /api/v3/images/generations (注意 /api/v3 前缀)
 * 响应格式: { data: [{ url: "..." }] }
 */
import type {
  ImageProviderAdapter,
  ProviderRequest,
  AIConfig,
  ImageGenerationRecord,
  ImageGenResponse,
  ImagePollResponse,
} from './types'
import { joinProviderUrl } from './url'
import { parseDataUrl } from '../../utils/storage.js'

/** Seedream 5.0 lite 最多 14 张参考图 */
const MAX_REFERENCE_IMAGES = 14

export class VolcEngineImageAdapter implements ImageProviderAdapter {
  provider = 'volcengine'

  buildGenerateRequest(config: AIConfig, record: ImageGenerationRecord): ProviderRequest {
    // 火山引擎使用 seedream 模型
    const model = record.model || config.model || 'doubao-seedream-5-0-lite-260128'

    const body: any = {
      model,
      prompt: record.prompt,
      size: this.normalizeSize(record.size),
      response_format: 'url',
      watermark: false,
      sequential_image_generation: 'disabled',
    }

    const referenceImages = this.parseReferenceImages(record.referenceImages)
    if (referenceImages.length === 1) {
      body.image = referenceImages[0]
    } else if (referenceImages.length > 1) {
      body.image = referenceImages
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', '/images/generations'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): ImageGenResponse {
    // 火山引擎可能返回 task_id 进行轮询
    if (result.task_id || result.id) {
      return { isAsync: true, taskId: result.task_id || result.id }
    }
    // 同步返回
    const imageUrl = result.data?.[0]?.url || result.url
    if (imageUrl) {
      return { isAsync: false, imageUrl }
    }
    throw new Error('No image URL in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', `/images/generations/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): ImagePollResponse {
    const status = result.status
    if (status === 'succeeded') {
      return {
        status: 'completed',
        imageUrl: result.data?.[0]?.url || result.image_url,
      }
    }
    if (status === 'failed') {
      return { status: 'failed', error: result.error || 'Generation failed' }
    }
    return { status: status || 'processing' }
  }

  extractImageUrl(result: any): string | null {
    return result.data?.[0]?.url || result.image_url || null
  }

  extractImageBase64(result: any): { data: string; mimeType: string } | null {
    return null
  }

  /** Seedream 5.0 lite 最小总像素 2560x1440 = 3686400 */
  private static readonly MIN_PIXELS = 2560 * 1440

  /**
   * 解析参考图列表，供 Seedream 图生图 / 多图融合使用。
   * 支持 HTTPS URL 与 data:image/...;base64,... 格式。
   */
  private parseReferenceImages(raw: string | null | undefined): string[] {
    if (!raw) return []
    let refs: unknown[] = []
    try {
      refs = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(refs)) return []

    const normalized: string[] = []
    for (const item of refs) {
      const apiValue = this.toApiImageValue(String(item || '').trim())
      if (apiValue) normalized.push(apiValue)
      if (normalized.length >= MAX_REFERENCE_IMAGES) break
    }
    return normalized
  }

  /** 转为 Seedream API 接受的 image 值（URL 或 data URL） */
  private toApiImageValue(value: string): string | null {
    if (!value) return null
    if (value.startsWith('https://') || value.startsWith('http://')) return value

    const parsed = parseDataUrl(value)
    if (!parsed) return null

    const [type, subtype] = parsed.mimeType.split('/')
    if (type !== 'image' || !subtype) return null

    return `data:image/${subtype.toLowerCase()};base64,${parsed.data}`
  }

  /** Seedream 5.x 使用 size 字段：2K / 3K / 宽x高 */
  private normalizeSize(size?: string | null): string {
    const raw = String(size || '').trim()
    if (!raw) return '2K'
    if (/^\d+k$/i.test(raw)) return raw.toUpperCase()

    const [w, h] = raw.split('x').map(Number)
    if (!w || !h) return '2K'

    const pixels = w * h
    if (pixels >= VolcEngineImageAdapter.MIN_PIXELS) {
      return `${w}x${h}`
    }

    const aspect = w / h
    if (Math.abs(aspect - 16 / 9) < 0.05) return '2560x1440'
    if (Math.abs(aspect - 9 / 16) < 0.05) return '1440x2560'
    if (Math.abs(aspect - 1) < 0.05) return '1920x1920'

    const scale = Math.sqrt(VolcEngineImageAdapter.MIN_PIXELS / pixels)
    let nextW = Math.ceil(w * scale)
    let nextH = Math.ceil(h * scale)
    if (nextW * nextH < VolcEngineImageAdapter.MIN_PIXELS) {
      if (nextW >= nextH) nextW += 1
      else nextH += 1
    }
    return `${nextW}x${nextH}`
  }
}
