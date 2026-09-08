/**
 * 文件存储工具 — 下载远程文件到本地
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { v4 as uuid } from 'uuid'
import { canReadOwnerStorage } from './ownership.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(__dirname, '../../../data/static')

/** 新文件写入 static/users/{userId}/{subDir}；无 userId 时保持旧目录（仅迁移脚本/管理员遗留） */
export function userStorageSubDir(userId: number | null | undefined, subDir: string): string {
  if (typeof userId === 'number' && Number.isFinite(userId) && userId > 0) {
    return `users/${userId}/${subDir}`
  }
  return subDir
}

export function userStorageAbsDir(userId: number | null | undefined, subDir: string): string {
  return path.join(STORAGE_ROOT, userStorageSubDir(userId, subDir))
}

export function toStaticRelative(userId: number | null | undefined, subDir: string, filename: string): string {
  return `static/${userStorageSubDir(userId, subDir)}/${filename}`
}

export function canUserReadStaticPath(user: { id: number; role: string }, urlPath: string): boolean {
  let decoded = urlPath
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    /* keep raw */
  }
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'))
  if (normalized.includes('..')) return false
  const rel = normalized.replace(/^\/+/, '')
  if (!rel.startsWith('static/')) return false
  const rest = rel.slice('static/'.length)
  if (rest.startsWith('users/')) {
    if (user.role === 'admin') return true
    const match = rest.match(/^users\/(\d+)(?:\/|$)/)
    if (!match) return false
    const ownerId = Number(match[1])
    if (ownerId === user.id) return true
    return canReadOwnerStorage(user.id, ownerId)
  }
  return user.role === 'admin'
}

export function assertUserCanUseMediaPath(user: { id: number; role: string }, mediaPath: string): boolean {
  const raw = String(mediaPath || '').trim().replace(/^\/+/, '')
  if (!raw.startsWith('static/')) return false
  return canUserReadStaticPath(user, `/${raw}`)
}

/**
 * 下载远程文件到本地存储
 */
export async function downloadFile(url: string, subDir: string, userId?: number | null): Promise<string> {
  const resolved = userStorageSubDir(userId, subDir)
  const dir = path.join(STORAGE_ROOT, resolved)
  fs.mkdirSync(dir, { recursive: true })

  const ext = getExtFromUrl(url)
  const filename = `${uuid()}${ext}`
  const filePath = path.join(dir, filename)

  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)

  const buffer = Buffer.from(await resp.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  return `static/${resolved}/${filename}`
}

/**
 * 保存上传的文件
 */
export async function saveUploadedFile(
  data: ArrayBuffer,
  subDir: string,
  originalName: string,
  userId?: number | null,
): Promise<string> {
  const resolved = userStorageSubDir(userId, subDir)
  const dir = path.join(STORAGE_ROOT, resolved)
  fs.mkdirSync(dir, { recursive: true })

  const ext = path.extname(originalName) || '.bin'
  const filename = `${uuid()}${ext}`
  const filePath = path.join(dir, filename)

  fs.writeFileSync(filePath, Buffer.from(data))
  return `static/${resolved}/${filename}`
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname)
    if (ext && ext.length <= 5) return ext
  } catch {}
  return '.bin'
}

/**
 * 获取本地文件的绝对路径
 */
export function getAbsolutePath(relativePath: string): string {
  if (relativePath.startsWith('static/')) {
    return path.join(STORAGE_ROOT, '..', relativePath)
  }
  return path.join(STORAGE_ROOT, relativePath)
}

/**
 * 保存 Base64 编码的图片数据到本地存储
 * 用于 Gemini 等只返回 base64 数据的厂商
 */
export async function saveBase64Image(
  base64Data: string,
  mimeType: string,
  subDir: string,
  userId?: number | null,
): Promise<string> {
  const resolved = userStorageSubDir(userId, subDir)
  const dir = path.join(STORAGE_ROOT, resolved)
  fs.mkdirSync(dir, { recursive: true })

  // 从 mimeType 推断文件扩展名
  const ext = mimeTypeToExt(mimeType)
  const filename = `${uuid()}${ext}`
  const filePath = path.join(dir, filename)

  const buffer = Buffer.from(base64Data, 'base64')
  fs.writeFileSync(filePath, buffer)

  return `static/${resolved}/${filename}`
}

export function readImageAsDataUrl(relativePath: string): string {
  const filePath = getAbsolutePath(relativePath)
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = extToMimeType(ext)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

/** 图生视频参考图：1080P 以内原图直传，超出才等比压到 1080P 边界内 */
export const VIDEO_REFERENCE_MAX_WIDTH = 1920
export const VIDEO_REFERENCE_MAX_HEIGHT = 1920
export const VIDEO_REFERENCE_MAX_BYTES = 5 * 1024 * 1024
export const VIDEO_REFERENCE_JPEG_QUALITY = 90

/** 图生图参考图：2K 以内原图直传，超出才等比压到 2K 边界内 */
export const IMAGE_REFERENCE_MAX_WIDTH = 2560
export const IMAGE_REFERENCE_MAX_HEIGHT = 2560
export const IMAGE_REFERENCE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_REFERENCE_JPEG_QUALITY = 90

export async function readImageAsVideoReferenceDataUrl(relativePath: string): Promise<string> {
  const filePath = getAbsolutePath(relativePath)
  const stat = fs.statSync(filePath)
  const meta = await sharp(filePath).rotate().metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const within1080p = width > 0
    && height > 0
    && width <= VIDEO_REFERENCE_MAX_WIDTH
    && height <= VIDEO_REFERENCE_MAX_HEIGHT
    && stat.size <= VIDEO_REFERENCE_MAX_BYTES

  if (within1080p) {
    return readImageAsDataUrl(relativePath)
  }

  return readImageAsCompressedDataUrl(relativePath, {
    maxWidth: VIDEO_REFERENCE_MAX_WIDTH,
    maxHeight: VIDEO_REFERENCE_MAX_HEIGHT,
    quality: VIDEO_REFERENCE_JPEG_QUALITY,
  })
}

/** 图生图参考图：2K 以内原图直传，超出才等比压到 2K 边界内 */
export async function readImageAsImageReferenceDataUrl(relativePath: string): Promise<string> {
  const filePath = getAbsolutePath(relativePath)
  const stat = fs.statSync(filePath)
  const meta = await sharp(filePath).rotate().metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const withinLimit = width > 0
    && height > 0
    && width <= IMAGE_REFERENCE_MAX_WIDTH
    && height <= IMAGE_REFERENCE_MAX_HEIGHT
    && stat.size <= IMAGE_REFERENCE_MAX_BYTES

  if (withinLimit) {
    return readImageAsDataUrl(relativePath)
  }

  return readImageAsCompressedDataUrl(relativePath, {
    maxWidth: IMAGE_REFERENCE_MAX_WIDTH,
    maxHeight: IMAGE_REFERENCE_MAX_HEIGHT,
    quality: IMAGE_REFERENCE_JPEG_QUALITY,
  })
}

export async function readImageAsCompressedDataUrl(
  relativePath: string,
  options: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
  } = {},
): Promise<string> {
  const filePath = getAbsolutePath(relativePath)
  const maxWidth = options.maxWidth ?? 768
  const maxHeight = options.maxHeight ?? 768
  const quality = options.quality ?? 68

  const resized = sharp(filePath).rotate().resize({
    width: maxWidth,
    height: maxHeight,
    fit: 'inside',
    withoutEnlargement: true,
  })
  const metadata = await resized.metadata()
  const output = metadata.hasAlpha
    ? await resized.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer()
    : await resized.jpeg({ quality, mozjpeg: true }).toBuffer()
  const mimeType = 'image/jpeg'
  return `data:${mimeType};base64,${output.toString('base64')}`
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    data: match[2],
  }
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return map[mimeType] || '.png'
}

function extToMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return map[ext] || 'image/png'
}

/** 参考视频 data URL 上限（方舟本地直传） */
export const VIDEO_REFERENCE_FILE_MAX_BYTES = 20 * 1024 * 1024

function videoExtToMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
  }
  return map[ext] || 'video/mp4'
}

/** 将本地参考视频读为 data URL；超过上限则报错 */
export function readVideoAsDataUrl(relativePath: string): string {
  const filePath = getAbsolutePath(relativePath)
  const stat = fs.statSync(filePath)
  if (stat.size > VIDEO_REFERENCE_FILE_MAX_BYTES) {
    throw new Error(`参考视频不能超过 ${Math.round(VIDEO_REFERENCE_FILE_MAX_BYTES / (1024 * 1024))}MB，请压缩后再试`)
  }
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = videoExtToMimeType(ext)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
