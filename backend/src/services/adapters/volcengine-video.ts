/**
 * 火山引擎 Seedance 视频生成 Adapter
 * 端点: /api/v3/contents/generations/tasks (注意 /api/v3 前缀)
 * 响应: { id: "task-xxx" } -> 轮询获取状态
 */
import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types'
import { joinProviderUrl } from './url'

type SeedanceImageRole = 'first_frame' | 'last_frame' | 'reference_image'

export class VolcEngineVideoAdapter implements VideoProviderAdapter {
  provider = 'volcengine'

  private pushImageContent(content: any[], url: string, role: SeedanceImageRole) {
    content.push({
      type: 'image_url',
      image_url: { url },
      role,
    })
  }

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'doubao-seedance-2-0-260128'

    const content: any[] = [{ type: 'text', text: record.prompt || '' }]

    // Seedance 2.x 要求每张 image_url 必须带 role，否则会 InvalidParameter
    if (record.referenceMode === 'single' && record.imageUrl) {
      this.pushImageContent(content, record.imageUrl, 'first_frame')
    } else if (record.referenceMode === 'first_last') {
      if (record.firstFrameUrl) {
        this.pushImageContent(content, record.firstFrameUrl, 'first_frame')
      }
      if (record.lastFrameUrl) {
        this.pushImageContent(content, record.lastFrameUrl, 'last_frame')
      }
    } else if (record.referenceMode === 'multiple' && record.referenceImageUrls) {
      // Seedance 禁止 first_frame/last_frame 与 reference_image 混用
      try {
        const urls = (JSON.parse(record.referenceImageUrls) as string[]).filter(Boolean)
        for (const url of urls) {
          this.pushImageContent(content, url, 'reference_image')
        }
      } catch {}
    }

    const { model: resolvedModel, resolution } = this.resolveModelAndResolution(model)

    const body: any = {
      model: resolvedModel,
      content,
      generate_audio: true,
      ratio: record.aspectRatio || 'adaptive',
      resolution,
      duration: this.normalizeDuration(record.duration),
      watermark: false,
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', '/contents/generations/tasks'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    if (result.id) {
      return { isAsync: true, taskId: result.id }
    }
    // 同步返回
    const videoUrl = result.video_url || result.content?.video_url || result.data?.video_url
    if (videoUrl) {
      return { isAsync: false, videoUrl }
    }
    throw new Error('No task_id or video_url in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', `/contents/generations/tasks/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const status = result.status
    if (status === 'succeeded') {
      const videoUrl = result.video_url || result.content?.video_url || result.data?.video_url
      return {
        status: 'completed',
        videoUrl,
      }
    }
    if (status === 'failed') {
      return { status: 'failed', error: result.error || 'Video generation failed' }
    }
    return { status: status || 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return result.video_url || result.content?.video_url || result.data?.video_url || null
  }

  private normalizeDuration(duration?: number | null): number {
    const parsed = Math.round(Number(duration || 5))
    if (!Number.isFinite(parsed)) return 5
    return Math.min(12, Math.max(4, parsed))
  }

  /** fast 模型不支持 1080p，自动切到同系列标准模型 */
  private resolveModelAndResolution(model: string): { model: string; resolution: string } {
    if (model.includes('fast')) {
      const standard = model.replace('-fast-', '-').replace('-fast', '')
      return { model: standard, resolution: '1080p' }
    }
    return { model, resolution: '1080p' }
  }
}
