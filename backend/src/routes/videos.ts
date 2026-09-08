import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest, notFound, taskError } from '../utils/response.js'
import { generateVideo } from '../services/video-generation.js'
import { logTaskError, logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { resolveVideoReferenceGeneration } from '../utils/video-reference-prompt.js'
import { requireUser } from '../middleware/auth.js'
import { getOwnedDrama, getOwnedStoryboard, getOwnedVideoGeneration, getWritableDrama, getWritableStoryboard } from '../utils/ownership.js'
import { refundTaskByRef } from '../services/billing.js'

const app = new Hono()

// POST /videos — Generate video
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  if (!body.prompt) return badRequest(c, 'prompt is required')

  try {
    let configId: number | undefined = body.config_id
    if (body.storyboard_id) {
      const owned = getWritableStoryboard(Number(body.storyboard_id), user.id)
      if (!owned) return notFound(c)
      if (owned.episode?.videoConfigId != null) configId = owned.episode.videoConfigId
    } else if (body.drama_id && !getWritableDrama(Number(body.drama_id), user.id)) {
      return notFound(c)
    }

    let prompt = String(body.prompt || '')
    let referenceMode = body.reference_mode
    let referenceImageUrls: string[] | undefined = body.reference_image_urls
    let imageUrl = body.image_url
    let firstFrameUrl = body.first_frame_url
    let lastFrameUrl = body.last_frame_url

    if (body.storyboard_id && referenceMode === 'multiple') {
      const resolved = resolveVideoReferenceGeneration(
        Number(body.storyboard_id),
        body.drama_id != null ? Number(body.drama_id) : undefined,
      )
      prompt = resolved.prompt
      referenceImageUrls = resolved.referenceImages
      imageUrl = undefined
      firstFrameUrl = undefined
      lastFrameUrl = undefined
      logTaskPayload('VideoAPI', 'resolved video reference', {
        storyboardId: body.storyboard_id,
        characterNames: resolved.characterNames,
        referenceCount: referenceImageUrls.length,
      })
    }

    logTaskStart('VideoAPI', 'generate', {
      storyboardId: body.storyboard_id,
      dramaId: body.drama_id,
      referenceMode,
      duration: body.duration,
    })
    logTaskPayload('VideoAPI', 'request body', body)
    const id = await generateVideo({
      storyboardId: body.storyboard_id,
      dramaId: body.drama_id,
      prompt,
      model: body.model,
      referenceMode,
      imageUrl,
      firstFrameUrl,
      lastFrameUrl,
      referenceImageUrls,
      duration: body.duration,
      aspectRatio: body.aspect_ratio,
      configId,
      userId: user.id,
    })

    const [record] = db.select().from(schema.videoGenerations)
      .where(eq(schema.videoGenerations.id, id)).all()
    logTaskSuccess('VideoAPI', 'generate', { generationId: id, provider: record?.provider })
    return created(c, record)
  } catch (err: any) {
    logTaskError('VideoAPI', 'generate', { error: err.message })
    return taskError(c, err)
  }
})

// GET /videos/:id
app.get('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedVideoGeneration(id, user.id)
  if (!row) return notFound(c)
  return success(c, row)
})

// GET /videos — List by storyboard_id or drama_id
app.get('/', async (c) => {
  const user = requireUser(c)
  const storyboardId = c.req.query('storyboard_id')
  const dramaId = c.req.query('drama_id')

  if (storyboardId && !getOwnedStoryboard(Number(storyboardId), user.id)) return notFound(c)
  if (dramaId && !getOwnedDrama(Number(dramaId), user.id)) return notFound(c)

  let rows = db.select().from(schema.videoGenerations).all()
  if (!storyboardId && !dramaId) {
    rows = rows.filter(r => r.userId === user.id)
  }

  if (storyboardId) rows = rows.filter(r => r.storyboardId === Number(storyboardId))
  if (dramaId) rows = rows.filter(r => r.dramaId === Number(dramaId))

  return success(c, rows)
})

// DELETE /videos/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedVideoGeneration(id, user.id)
  if (!row) return notFound(c)
  if (row.userId !== user.id) {
    if (!row.dramaId || !getWritableDrama(row.dramaId, user.id)) return notFound(c)
  }
  if (row.status === 'processing') {
    refundTaskByRef('video_generations', id, '用户删除进行中的任务')
  }
  db.delete(schema.videoGenerations).where(eq(schema.videoGenerations.id, id)).run()
  return success(c)
})

export default app
