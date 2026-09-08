import { Hono } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest, now, notFound, taskError } from '../utils/response.js'
import { generateVoiceSample } from '../services/tts-generation.js'
import { generateImage } from '../services/image-generation.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { buildCharacterRefinePrompt } from '../utils/character-refine-prompt.js'
import { requireUser } from '../middleware/auth.js'
import { getWritableCharacter, getWritableDrama, getWritableEpisode, storageUserIdForDrama } from '../utils/ownership.js'

const HD_REFINE_SIZE = '1920x1080'

const app = new Hono()

// POST /characters — 手动补充角色并关联到当前剧集
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const dramaId = Number(body.drama_id)
  const episodeId = Number(body.episode_id)
  const name = String(body.name || '').trim()

  if (!dramaId || !episodeId || !name) {
    return badRequest(c, 'drama_id、episode_id 和角色名称不能为空')
  }
  if (!getWritableDrama(dramaId, user.id) || !getWritableEpisode(episodeId, user.id)) return notFound(c)

  const ts = now()
  const [existing] = db.select().from(schema.characters)
    .where(and(
      eq(schema.characters.dramaId, dramaId),
      eq(schema.characters.name, name),
      isNull(schema.characters.deletedAt),
    ))
    .all()

  let characterId = existing?.id
  if (!characterId) {
    const result = db.insert(schema.characters).values({
      dramaId,
      name,
      role: String(body.role || '').trim(),
      description: String(body.description || '').trim(),
      appearance: String(body.appearance || '').trim(),
      personality: String(body.personality || '').trim(),
      createdAt: ts,
      updatedAt: ts,
    }).run()
    characterId = Number(result.lastInsertRowid)
  }

  const [link] = db.select().from(schema.episodeCharacters)
    .where(and(
      eq(schema.episodeCharacters.episodeId, episodeId),
      eq(schema.episodeCharacters.characterId, characterId),
    ))
    .all()
  if (!link) {
    db.insert(schema.episodeCharacters).values({ episodeId, characterId, createdAt: ts }).run()
  }

  const [character] = db.select().from(schema.characters)
    .where(eq(schema.characters.id, characterId))
    .all()
  return created(c, { ...character, reused: !!existing })
})

// PUT /characters/:id
app.put('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getWritableCharacter(id, user.id)) return notFound(c)
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }
  for (const key of ['name', 'role', 'description', 'appearance', 'personality', 'voiceStyle', 'voiceProvider', 'imageUrl', 'localPath']) {
    const snakeKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
    if (snakeKey in body) updates[key] = body[snakeKey]
    else if (key in body) updates[key] = body[key]
  }
  if ('voice_style' in body || 'voiceStyle' in body) {
    updates.voiceSampleUrl = null
  }
  db.update(schema.characters).set(updates).where(eq(schema.characters.id, id)).run()
  return success(c)
})

// DELETE /characters/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getWritableCharacter(id, user.id)) return notFound(c)
  db.update(schema.characters).set({ deletedAt: now() }).where(eq(schema.characters.id, id)).run()
  return success(c)
})

// POST /characters/:id/generate-voice-sample — 生成角色音色试听
app.post('/:id/generate-voice-sample', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const owned = getWritableCharacter(id, user.id)
  if (!owned) return notFound(c)
  const char = owned.character
  if (!char.voiceStyle) return badRequest(c, '请先分配音色')
  if (!body.episode_id) return badRequest(c, 'episode_id is required')

  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode

  try {
    logTaskStart('VoiceSample', 'generate', { characterId: id, characterName: char.name, episodeId: ep.id, voice: char.voiceStyle })
    const audioPath = await generateVoiceSample(
      char.name,
      char.voiceStyle,
      ep.audioConfigId ?? undefined,
      user.id,
      storageUserIdForDrama(owned.drama, user.id),
    )
    db.update(schema.characters)
      .set({ voiceSampleUrl: audioPath, updatedAt: now() })
      .where(eq(schema.characters.id, id)).run()
    logTaskSuccess('VoiceSample', 'generate', { characterId: id, path: audioPath })
    return success(c, { voice_sample_url: audioPath })
  } catch (err: any) {
    logTaskError('VoiceSample', 'generate', { characterId: id, error: err.message })
    return taskError(c, err, `TTS 生成失败: ${err.message}`)
  }
})

// POST /characters/:id/generate-image
app.post('/:id/generate-image', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const owned = getWritableCharacter(id, user.id)
  if (!owned) return notFound(c)
  const char = owned.character
  if (!body.episode_id) return badRequest(c, 'episode_id is required')

  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode

  const prompt = `${char.name}, ${char.appearance || char.description || '人物立绘'}, 高质量, 正面, 白色背景`
  try {
    logTaskStart('CharacterImage', 'generate', { characterId: id, episodeId: ep.id, dramaId: char.dramaId })
    const genId = await generateImage({ characterId: id, dramaId: char.dramaId, prompt, configId: ep.imageConfigId ?? undefined, userId: user.id })
    logTaskSuccess('CharacterImage', 'generate', { characterId: id, generationId: genId })
    return success(c, { image_generation_id: genId })
  } catch (err: any) {
    logTaskError('CharacterImage', 'generate', { characterId: id, error: err.message })
    return taskError(c, err)
  }
})

// POST /characters/:id/refine-image — 基于已上传图片按项目画风高清重绘
app.post('/:id/refine-image', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const owned = getWritableCharacter(id, user.id)
  if (!owned) return notFound(c)
  const char = owned.character
  if (!body.episode_id) return badRequest(c, 'episode_id is required')

  const sourceImage = char.imageUrl || char.localPath
  if (!sourceImage) return badRequest(c, '请先上传参考图片')

  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode

  const drama = owned.drama
  const prompt = buildCharacterRefinePrompt(char, drama?.style)

  try {
    logTaskStart('CharacterImage', 'refine', { characterId: id, episodeId: ep.id, dramaId: char.dramaId, style: drama?.style })
    const genId = await generateImage({
      characterId: id,
      dramaId: char.dramaId,
      prompt,
      referenceImages: [sourceImage],
      size: HD_REFINE_SIZE,
      frameType: 'refine',
      configId: ep.imageConfigId ?? undefined,
      userId: user.id,
    })
    logTaskSuccess('CharacterImage', 'refine', { characterId: id, generationId: genId })
    return success(c, { image_generation_id: genId })
  } catch (err: any) {
    logTaskError('CharacterImage', 'refine', { characterId: id, error: err.message })
    return taskError(c, err)
  }
})

// POST /characters/batch-generate-images
app.post('/batch-generate-images', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const ids: number[] = body.character_ids || []
  if (!body.episode_id) return badRequest(c, 'episode_id is required')
  const ownedEp = getWritableEpisode(Number(body.episode_id), user.id)
  if (!ownedEp) return notFound(c)
  const ep = ownedEp.episode
  const results: number[] = []
  for (const cid of ids) {
    const ownedChar = getWritableCharacter(cid, user.id)
    if (!ownedChar) continue
    const char = ownedChar.character
    const prompt = `${char.name}, ${char.appearance || char.description || '人物立绘'}, 高质量, 正面, 白色背景`
    try {
      const genId = await generateImage({ characterId: cid, dramaId: char.dramaId, prompt, configId: ep.imageConfigId ?? undefined, userId: user.id })
      results.push(genId)
    } catch {}
  }
  logTaskSuccess('CharacterImage', 'batch-generate', { episodeId: ep.id, requested: ids.length, started: results.length })
  return success(c, { count: results.length, ids: results })
})

export default app
