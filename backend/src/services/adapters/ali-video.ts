/**
 * 阿里云百炼（万相）视频生成 Adapter
 * API 文档: https://help.aliyun.com/zh/model-studio/image-to-video-api-reference
 * wan2.7 起需使用 input.media，见 wan2.7 i2v 文档
 */
import type { VideoProviderAdapter, VideoGenerationRecord } from './types'
import { joinProviderUrl } from './url'

export class AliVideoAdapter implements VideoProviderAdapter {
  readonly provider = 'ali'

  buildGenerateRequest(config: any, record: VideoGenerationRecord): {
    url: string
    method: string
    headers: Record<string, string>
    body: any
  } {
    const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com'
    const url = joinProviderUrl(baseUrl, '/api/v1', '/services/aigc/video-generation/video-synthesis')
    const model = record.model || 'wan2.6-i2v-flash'

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      // 万相视频 HTTP 接口仅支持异步，缺此头会 403: current user api does not support synchronous calls
      'X-DashScope-Async': 'enable',
    }

    const firstFrameUrl = record.imageUrl ?? record.firstFrameUrl ?? ''
    const input: Record<string, unknown> = {
      prompt: record.prompt,
    }

    // wan2.7+ 统一走 media 数组；旧版 wan2.6 仍用 img_url
    if (this.isWan27Model(model)) {
      const media: Array<{ type: string; url: string }> = []
      if (firstFrameUrl) {
        media.push({ type: 'first_frame', url: firstFrameUrl })
      }
      if (record.lastFrameUrl) {
        media.push({ type: 'last_frame', url: record.lastFrameUrl as string })
      }
      input.media = media
    } else {
      input.img_url = firstFrameUrl
      if (record.lastFrameUrl) {
        input.last_img_url = record.lastFrameUrl
      }
    }

    const body: any = {
      model,
      input,
      parameters: {
        resolution: this.normalizeResolution(record.aspectRatio ?? '16:9'),
        duration: record.duration || 5,
        watermark: false,
        seed: Math.floor(Math.random() * 2147483647),
      },
    }

    return { url, method: 'POST', headers, body }
  }

  parseGenerateResponse(result: any): {
    isAsync: boolean
    taskId?: string
    videoUrl?: string
  } {
    if (result.output?.task_id && (result.output?.task_status === 'PENDING' || result.output?.task_status === 'RUNNING')) {
      return { isAsync: true, taskId: result.output.task_id }
    }

    if (result.output?.video_url) {
      return { isAsync: false, videoUrl: result.output.video_url }
    }

    throw new Error(`Unexpected Ali video response: ${JSON.stringify(result).slice(0, 200)}`)
  }

  buildPollRequest(config: any, taskId: string): {
    url: string
    method: string
    headers: Record<string, string>
    body: any
  } {
    const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com'
    return {
      url: joinProviderUrl(baseUrl, '/api/v1', `/tasks/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): {
    status: 'pending' | 'processing' | 'completed' | 'failed'
    videoUrl?: string
    error?: string
  } {
    const status = result.output?.task_status

    if (status === 'SUCCEEDED') {
      return { status: 'completed', videoUrl: result.output?.video_url }
    }

    if (status === 'FAILED') {
      const code = result.output?.code
      const message = result.output?.message || result.message
      const error = code && message ? `${code}: ${message}` : (message || 'Video generation failed')
      return { status: 'failed', error }
    }

    if (status === 'PENDING' || status === 'RUNNING') {
      return { status: 'processing' }
    }

    return { status: 'pending' }
  }

  extractVideoUrl(result: any): string | null {
    return result.output?.video_url || null
  }

  private isWan27Model(model: string) {
    return model.includes('wan2.7')
  }

  private normalizeResolution(_aspectRatio?: string): string {
    return '1080P'
  }
}
