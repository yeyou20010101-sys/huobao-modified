import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest, now, notFound, taskError } from '../utils/response.js'
import { generateImage } from '../services/image-generation.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { buildSceneGeneratePrompt, buildSceneRefinePrompt } from '../utils/scene-refine-prompt.js'
import { requireUser } from '../middleware/auth.js'
import { getWritableDrama, getWritableEpisode, getWritableScene } from '../utils/ownership.js'

const HD_REFINE_SIZE = '1920x1080'

const app = new Hono()

// POST /scenes
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const dramaId = Number(body.drama_id)
  const episodeId = Number(body.episode_id)
  const location = String(body.location || '').trim()
  if (!dramaId || !episodeId || !location) {
    return badRequest(c, 'drama_id、episode_id 和场景名称不能为空')
  }
  if (!getWritableDrama(dramaId, user.id) || !getWritableEpisode(episodeId, user.id)) return notFound(c)

  const ts = now()
  const res = db.insert(schema.scenes).values({
    dramaId,
    episodeId,
    location,
    time: String(body.time || '').trim(),
    prompt: String(body.prompt || '').trim() || location,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const sceneId = Number(res.lastInsertRowid)
  const [link] = db.select().from(schema.episodeScenes)
    .where(and(
      eq(schema.episodeScenes.episodeId, episodeId),
      eq(schema.episodeScenes.sceneId, sceneId),
    ))
    .all()
  if (!link) {
    db.insert(schema.episodeScenes).values({ episodeId, sceneId, createdAt: ts }).run()
  }
  const [result] = db.select().from(schema.scenes)
    .where(eq(schema.scenes.id, sceneId)).all()
  return created(c, result)
})

// PUT /scenes/:id
app.put('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getWritableScene(id, user.id)) return notFound(c)
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }
  if (body.location !== undefined) updates.location = body.location
  if (body.time !== undefined) updates.time = body.time
  if (body.prompt !== undefined) updates.prompt = body.prompt
  if (body.image_url !== undefined) updates.imageUrl = body.image_url
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl
  if (body.local_path !== undefined) updates.localPath = body.local_path
  if (body.localPath !== undefined) updates.localPath = body.localPath
  db.update(schema.scenes).set(updates).where(eq(schema.scenes.id, id)).run()
  return success(c)
})

// POST /scenes/:id/generate-image
app.post('/:id/generate-image', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const owned = getWritableScene(id, user.id)
  if (!owned) return notFound(c)
  const scene = owned.scene
  if (!body.episode_id) return badRequest(c, 'episode_id is required')
  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode

  const drama = owned.drama
  const prompt = buildSceneGeneratePrompt(scene, drama?.style)
  try {
    logTaskStart('SceneImage', 'generate', { sceneId: id, episodeId: ep.id, dramaId: scene.dramaId, location: scene.location, style: drama?.style })
    db.update(schema.scenes).set({ status: 'processing', updatedAt: now() }).where(eq(schema.scenes.id, id)).run()
    const genId = await generateImage({ sceneId: id, dramaId: scene.dramaId, prompt, configId: ep.imageConfigId ?? undefined, userId: user.id })
    logTaskSuccess('SceneImage', 'generate', { sceneId: id, generationId: genId })
    return success(c, { image_generation_id: genId })
  } catch (err: any) {
    logTaskError('SceneImage', 'generate', { sceneId: id, error: err.message })
    db.update(schema.scenes).set({ status: 'failed', updatedAt: now() }).where(eq(schema.scenes.id, id)).run()
    return taskError(c, err)
  }
})

// POST /scenes/:id/refine-image — 基于已上传图片按项目画风高清重绘
app.post('/:id/refine-image', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const owned = getWritableScene(id, user.id)
  if (!owned) return notFound(c)
  const scene = owned.scene
  if (!body.episode_id) return badRequest(c, 'episode_id is required')

  const sourceImage = scene.imageUrl || scene.localPath
  if (!sourceImage) return badRequest(c, '请先上传参考图片')

  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode

  const drama = owned.drama
  const prompt = buildSceneRefinePrompt(scene, drama?.style)

  try {
    logTaskStart('SceneImage', 'refine', { sceneId: id, episodeId: ep.id, dramaId: scene.dramaId, style: drama?.style })
    db.update(schema.scenes).set({ status: 'processing', updatedAt: now() }).where(eq(schema.scenes.id, id)).run()
    const genId = await generateImage({
      sceneId: id,
      dramaId: scene.dramaId,
      prompt,
      referenceImages: [sourceImage],
      size: HD_REFINE_SIZE,
      frameType: 'refine',
      configId: ep.imageConfigId ?? undefined,
      userId: user.id,
    })
    logTaskSuccess('SceneImage', 'refine', { sceneId: id, generationId: genId })
    return success(c, { image_generation_id: genId })
  } catch (err: any) {
    logTaskError('SceneImage', 'refine', { sceneId: id, error: err.message })
    db.update(schema.scenes).set({ status: 'failed', updatedAt: now() }).where(eq(schema.scenes.id, id)).run()
    return taskError(c, err)
  }
})

// DELETE /scenes/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getWritableScene(id, user.id)) return notFound(c)
  db.delete(schema.scenes).where(eq(schema.scenes.id, id)).run()
  return success(c)
})

export default app
