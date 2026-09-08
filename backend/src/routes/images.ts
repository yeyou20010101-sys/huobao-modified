import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, now, badRequest, notFound, taskError } from '../utils/response.js'
import { generateImage } from '../services/image-generation.js'
import { logTaskError, logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { resolveShotFrameGeneration } from '../utils/shot-frame-prompt.js'
import { requireUser } from '../middleware/auth.js'
import { getOwnedDrama, getOwnedImageGeneration, getOwnedStoryboard, getWritableDrama, getWritableStoryboard } from '../utils/ownership.js'
import { refundTaskByRef } from '../services/billing.js'

const app = new Hono()

function isShotFrameRequest(body: Record<string, unknown>) {
  return !!body.storyboard_id && (body.frame_type === 'first_frame' || body.frame_type === 'last_frame')
}

// POST /images — Generate image
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const shotFrame = isShotFrameRequest(body)
  if (!body.prompt && !shotFrame) return badRequest(c, 'prompt is required')

  try {
    let configId: number | undefined = body.config_id
    if (body.storyboard_id) {
      const owned = getWritableStoryboard(Number(body.storyboard_id), user.id)
      if (!owned) return notFound(c)
      if (owned.episode?.imageConfigId != null) configId = owned.episode.imageConfigId
    } else if (body.drama_id && !getWritableDrama(Number(body.drama_id), user.id)) {
      return notFound(c)
    }

    let prompt = String(body.prompt || '')
    let referenceImages: string[] | undefined = body.reference_images

    if (shotFrame) {
      const resolved = resolveShotFrameGeneration(
        Number(body.storyboard_id),
        String(body.frame_type),
        body.drama_id != null ? Number(body.drama_id) : undefined,
      )
      prompt = resolved.prompt
      referenceImages = resolved.referenceImages.length ? resolved.referenceImages : undefined
      logTaskPayload('ImageAPI', 'resolved shot frame', {
        storyboardId: body.storyboard_id,
        frameType: body.frame_type,
        visibleCharacterNames: resolved.visibleCharacterNames,
        referenceCount: referenceImages?.length || 0,
      })
    }

    logTaskStart('ImageAPI', 'generate', {
      storyboardId: body.storyboard_id,
      sceneId: body.scene_id,
      characterId: body.character_id,
      dramaId: body.drama_id,
      frameType: body.frame_type,
    })
    logTaskPayload('ImageAPI', 'request body', body)
    const id = await generateImage({
      storyboardId: body.storyboard_id,
      dramaId: body.drama_id,
      sceneId: body.scene_id,
      characterId: body.character_id,
      prompt,
      model: body.model,
      size: body.size,
      referenceImages,
      frameType: body.frame_type,
      configId,
      userId: user.id,
    })

    const [record] = db.select().from(schema.imageGenerations)
      .where(eq(schema.imageGenerations.id, id)).all()
    logTaskSuccess('ImageAPI', 'generate', { generationId: id, provider: record?.provider })
    return created(c, record)
  } catch (err: any) {
    logTaskError('ImageAPI', 'generate', { error: err.message })
    return taskError(c, err)
  }
})

// GET /images/:id
app.get('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedImageGeneration(id, user.id)
  if (!row) return notFound(c)
  return success(c, row)
})

// GET /images — List by storyboard_id or drama_id
app.get('/', async (c) => {
  const user = requireUser(c)
  const storyboardId = c.req.query('storyboard_id')
  const dramaId = c.req.query('drama_id')

  if (storyboardId && !getOwnedStoryboard(Number(storyboardId), user.id)) return notFound(c)
  if (dramaId && !getOwnedDrama(Number(dramaId), user.id)) return notFound(c)

  let rows = db.select().from(schema.imageGenerations).all()
  if (!storyboardId && !dramaId) {
    rows = rows.filter(r => r.userId === user.id)
  }

  if (storyboardId) rows = rows.filter(r => r.storyboardId === Number(storyboardId))
  if (dramaId) rows = rows.filter(r => r.dramaId === Number(dramaId))

  return success(c, rows)
})

// DELETE /images/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedImageGeneration(id, user.id)
  if (!row) return notFound(c)
  if (row.userId !== user.id) {
    if (!row.dramaId || !getWritableDrama(row.dramaId, user.id)) return notFound(c)
  }
  if (row.status === 'processing') {
    refundTaskByRef('image_generations', id, '用户删除进行中的任务')
  }
  db.delete(schema.imageGenerations).where(eq(schema.imageGenerations.id, id)).run()
  return success(c)
})

export default app
