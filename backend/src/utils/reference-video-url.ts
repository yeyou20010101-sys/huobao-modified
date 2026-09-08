/**
 * Seedance 要求 reference_video 必须是公网可访问的 HTTP(S) URL（不接受 data:video）。
 * 优先用 PUBLIC_MEDIA_BASE_URL 拼本地路径；否则将本地文件临时上传到公网拿到 URL。
 */
import fs from 'fs'
import path from 'path'
import { getAbsolutePath, VIDEO_REFERENCE_FILE_MAX_BYTES } from './storage.js'
import { logTaskProgress, logTaskWarn } from './task-logger.js'

/** 本地路径 → 已上传公网 URL 的短时缓存 */
const uploadedUrlCache = new Map<string, { url: string; expiresAt: number }>()

const TEMP_UPLOAD_TTL_MS = 20 * 60 * 60 * 1000

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isAssetUri(value: string): boolean {
  return value.startsWith('asset://')
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true
  if (host.endsWith('.local')) return true
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  return false
}

/** 判断 base URL 是否可被火山服务端拉取 */
export function isPubliclyReachableBase(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return !isPrivateHost(u.hostname)
  } catch {
    return false
  }
}

function getConfiguredPublicBaseUrl(): string | null {
  const raw = String(process.env.PUBLIC_MEDIA_BASE_URL || '').trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

/** 将 static/... 路径拼到公网 base（兼容 base 已含 /static） */
export function joinPublicMediaUrl(baseUrl: string, relativePath: string): string {
  const baseNorm = baseUrl.replace(/\/$/, '')
  let rel = relativePath.replace(/^\//, '')
  if (baseNorm.endsWith('/static') && rel.startsWith('static/')) {
    rel = rel.slice('static/'.length)
  }
  return `${baseNorm}/${rel}`
}

function cacheKeyForLocalFile(absPath: string): string {
  const stat = fs.statSync(absPath)
  return `${absPath}|${stat.size}|${stat.mtimeMs}`
}

function getCachedUploadUrl(key: string): string | null {
  const hit = uploadedUrlCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    uploadedUrlCache.delete(key)
    return null
  }
  return hit.url
}

/**
 * 将本地视频临时上传到 litterbox，拿到 24h 公网 HTTPS URL。
 * 生产环境建议配置 PUBLIC_MEDIA_BASE_URL，避免依赖第三方临时盘。
 */
async function uploadLocalVideoToTempHost(absPath: string): Promise<string> {
  const filename = path.basename(absPath)
  const buffer = fs.readFileSync(absPath)
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('time', '24h')
  form.append(
    'fileToUpload',
    new Blob([new Uint8Array(buffer)], { type: 'video/mp4' }),
    filename,
  )

  const resp = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
  })
  const text = (await resp.text()).trim()
  if (!resp.ok || !isHttpUrl(text)) {
    throw new Error(`临时上传参考视频失败: ${text || `HTTP ${resp.status}`}`)
  }
  return text
}

/**
 * 将参考视频规范为 Seedance 可接受的 web URL / asset:// URI。
 * 本地 static 路径会转为公网地址；不再返回 data:video。
 */
export async function resolveReferenceVideoWebUrl(value: string | null | undefined): Promise<string | null> {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (isHttpUrl(raw) || isAssetUri(raw)) return raw

  if (raw.startsWith('data:video/')) {
    throw new Error('参考视频不能使用 data URL，请上传本地文件或提供公网 HTTPS 地址')
  }

  if (!(raw.startsWith('static/') || raw.startsWith('/static/'))) {
    // 已是其它形式的远程标识时原样返回
    return raw
  }

  const localPath = raw.startsWith('/static/') ? raw.slice(1) : raw
  const absPath = getAbsolutePath(localPath)
  if (!fs.existsSync(absPath)) {
    throw new Error(`参考视频文件不存在: ${localPath}`)
  }

  const stat = fs.statSync(absPath)
  if (stat.size > VIDEO_REFERENCE_FILE_MAX_BYTES) {
    throw new Error(`参考视频不能超过 ${Math.round(VIDEO_REFERENCE_FILE_MAX_BYTES / (1024 * 1024))}MB，请压缩后再试`)
  }

  const publicBase = getConfiguredPublicBaseUrl()
  if (publicBase && isPubliclyReachableBase(publicBase)) {
    const url = joinPublicMediaUrl(publicBase, localPath)
    logTaskProgress('VideoTask', 'reference-video-public-base', { path: localPath, url })
    return url
  }

  const allowTempUpload = String(process.env.REFERENCE_VIDEO_TEMP_UPLOAD || '1').trim() !== '0'
  if (!allowTempUpload) {
    throw new Error(
      '参考视频需要公网 HTTPS 地址。请设置环境变量 PUBLIC_MEDIA_BASE_URL（例如 https://your-domain.com），'
      + '或开启 REFERENCE_VIDEO_TEMP_UPLOAD=1 使用临时上传',
    )
  }

  const key = cacheKeyForLocalFile(absPath)
  const cached = getCachedUploadUrl(key)
  if (cached) {
    logTaskProgress('VideoTask', 'reference-video-cache-hit', { path: localPath, url: cached })
    return cached
  }

  logTaskProgress('VideoTask', 'reference-video-temp-upload', { path: localPath, bytes: stat.size })
  try {
    const url = await uploadLocalVideoToTempHost(absPath)
    uploadedUrlCache.set(key, { url, expiresAt: Date.now() + TEMP_UPLOAD_TTL_MS })
    logTaskProgress('VideoTask', 'reference-video-temp-uploaded', { path: localPath, url })
    return url
  } catch (err) {
    logTaskWarn('VideoTask', 'reference-video-temp-upload-failed', {
      path: localPath,
      error: (err as Error).message,
    })
    throw new Error(
      `参考视频无法转为公网 URL：${(err as Error).message}。`
      + '请配置 PUBLIC_MEDIA_BASE_URL 指向可被外网访问的静态资源域名后重试',
    )
  }
}
