import { Hono } from 'hono'
import { success, badRequest, notFound } from '../utils/response.js'
import { saveUploadedFile } from '../utils/storage.js'
import { requireUser } from '../middleware/auth.js'
import { getWritableDrama, storageUserIdForDrama } from '../utils/ownership.js'

const app = new Hono()

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'])

function getExt(name: string) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function resolveUploadOwner(body: Record<string, unknown>, userId: number) {
  const dramaId = Number(body.drama_id || body.dramaId || 0)
  if (!dramaId) return { storageUserId: userId as number }
  const drama = getWritableDrama(dramaId, userId)
  if (!drama) return null
  return { storageUserId: storageUserIdForDrama(drama, userId) }
}

// POST /upload/image
app.post('/image', async (c) => {
  const user = requireUser(c)
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }

  const owner = resolveUploadOwner(body as Record<string, unknown>, user.id)
  if (!owner) return notFound(c, '剧本不存在')

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, 'uploads', file.name, owner.storageUserId)
  return success(c, { url: `/${path}`, path })
})

// POST /upload/video
app.post('/video', async (c) => {
  const user = requireUser(c)
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }

  const ext = getExt(file.name)
  const mime = String(file.type || '').toLowerCase()
  if (!VIDEO_EXTS.has(ext) && !VIDEO_MIMES.has(mime)) {
    return badRequest(c, '仅支持 mp4 / webm / mov 视频文件')
  }

  const owner = resolveUploadOwner(body as Record<string, unknown>, user.id)
  if (!owner) return notFound(c, '剧本不存在')

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, 'uploads', file.name, owner.storageUserId)
  return success(c, { url: `/${path}`, path })
})

export default app
