import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest } from '../utils/response.js'
import { generateVideo } from '../services/video-generation.js'
import { logTaskError, logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { resolveVideoReferenceGeneration } from '../utils/video-reference-prompt.js'

const app = new Hono()

// POST /videos — Generate video
app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.prompt) return badRequest(c, 'prompt is required')

  try {
    let configId: number | undefined = body.config_id
    if (body.storyboard_id) {
      const [sb] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, Number(body.storyboard_id))).all()
      if (sb) {
        const [ep] = db.select().from(schema.episodes).where(eq(schema.episodes.id, sb.episodeId)).all()
        if (ep?.videoConfigId != null) configId = ep.videoConfigId
      }
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
    })

    const [record] = db.select().from(schema.videoGenerations)
      .where(eq(schema.videoGenerations.id, id)).all()
    logTaskSuccess('VideoAPI', 'generate', { generationId: id, provider: record?.provider })
    return created(c, record)
  } catch (err: any) {
    logTaskError('VideoAPI', 'generate', { error: err.message })
    return badRequest(c, err.message)
  }
})

// GET /videos/:id
app.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = db.select().from(schema.videoGenerations)
    .where(eq(schema.videoGenerations.id, id)).all()
  return success(c, row || null)
})

// GET /videos — List by storyboard_id or drama_id
app.get('/', async (c) => {
  const storyboardId = c.req.query('storyboard_id')
  const dramaId = c.req.query('drama_id')

  let rows = db.select().from(schema.videoGenerations).all()

  if (storyboardId) rows = rows.filter(r => r.storyboardId === Number(storyboardId))
  if (dramaId) rows = rows.filter(r => r.dramaId === Number(dramaId))

  return success(c, rows)
})

// DELETE /videos/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  db.delete(schema.videoGenerations).where(eq(schema.videoGenerations.id, id)).run()
  return success(c)
})

export default app
