import { Hono } from 'hono'
import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, notFound, created, now, badRequest } from '../utils/response.js'
import { getActiveConfig } from '../services/ai.js'
import { toSnakeCase, toSnakeCaseArray } from '../utils/transform.js'
import { requireUser } from '../middleware/auth.js'
import {
  ensureDramaOwnerMember,
  getDramaAccess,
  getMemberRole,
  getOwnedDrama,
  getOwnerDrama,
  getWritableDrama,
  listAccessibleDramas,
} from '../utils/ownership.js'

const app = new Hono()

const MEMBER_ROLES = new Set(['editor', 'viewer'])

function findUserByIdentifier(identifier: string) {
  const username = identifier.trim()
  const email = identifier.trim().toLowerCase()
  const [user] = db.select().from(schema.users)
    .where(or(eq(schema.users.username, username), eq(schema.users.email, email)))
    .all()
  return user || null
}

function serializeMember(row: typeof schema.dramaMembers.$inferSelect) {
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).all()
  return {
    user_id: row.userId,
    role: row.role,
    invited_by: row.invitedBy,
    created_at: row.createdAt,
    username: user?.username || '',
    email: user?.email || '',
  }
}

function enrichDrama(drama: typeof schema.dramas.$inferSelect, userId: number) {
  const eps = db.select().from(schema.episodes).where(eq(schema.episodes.dramaId, drama.id)).all()
  const chars = db.select().from(schema.characters).where(eq(schema.characters.dramaId, drama.id)).all()
  const scns = db.select().from(schema.scenes).where(eq(schema.scenes.dramaId, drama.id)).all()
  return {
    ...toSnakeCase(drama),
    tags: drama.tags ? JSON.parse(drama.tags) : [],
    total_episodes: eps.length,
    episodes: toSnakeCaseArray(eps),
    characters: toSnakeCaseArray(chars),
    scenes: toSnakeCaseArray(scns),
    my_role: getMemberRole(drama.id, userId),
  }
}

// GET /dramas - List dramas
app.get('/', async (c) => {
  const user = requireUser(c)
  const page = Number(c.req.query('page') || 1)
  const pageSize = Number(c.req.query('page_size') || 20)
  const status = c.req.query('status')
  const keyword = c.req.query('keyword')

  const allRows = listAccessibleDramas(user.id)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  let filtered = allRows

  if (status) filtered = filtered.filter(d => d.status === status)
  if (keyword) filtered = filtered.filter(d => d.title.includes(keyword))

  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)
  const enriched = items.map(drama => enrichDrama(drama, user.id))

  return success(c, {
    items: enriched,
    pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
  })
})

// POST /dramas - Create drama
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const ts = now()
  const res = db.insert(schema.dramas).values({
    userId: user.id,
    title: body.title,
    description: body.description,
    genre: body.genre,
    style: body.style,
    tags: body.tags ? JSON.stringify(body.tags) : null,
    metadata: body.metadata,
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
  }).run()

  const [result] = db.select().from(schema.dramas)
    .where(eq(schema.dramas.id, Number(res.lastInsertRowid))).all()
  ensureDramaOwnerMember(result.id, user.id)

  const imageConfig = getActiveConfig('image', user.id)
  const videoConfig = getActiveConfig('video', user.id)
  const audioConfig = getActiveConfig('audio', user.id)
  const totalEpisodes = body.total_episodes || 1
  for (let i = 1; i <= totalEpisodes; i++) {
    db.insert(schema.episodes).values({
      dramaId: result.id,
      episodeNumber: i,
      title: `第${i}集`,
      status: 'draft',
      imageConfigId: imageConfig?.id,
      videoConfigId: videoConfig?.id,
      audioConfigId: audioConfig?.id,
      createdAt: ts,
      updatedAt: ts,
    }).run()
  }

  return created(c, { ...toSnakeCase(result), my_role: 'owner' })
})


// GET /dramas/stats — must be before /:id
app.get('/stats', async (c) => {
  const user = requireUser(c)
  const all = listAccessibleDramas(user.id)
  const byStatus = Object.entries(
    all.reduce((acc, d) => {
      acc[d.status || 'draft'] = (acc[d.status || 'draft'] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([status, count]) => ({ status, count }))
  return success(c, { total: all.length, by_status: byStatus })
})

// GET /dramas/:id/members
app.get('/:id/members', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const access = getDramaAccess(id, user.id)
  if (!access) return notFound(c, '剧本不存在')
  ensureDramaOwnerMember(id, access.drama.userId || user.id)
  const rows = db.select().from(schema.dramaMembers)
    .where(eq(schema.dramaMembers.dramaId, id))
    .all()
  return success(c, rows.map(serializeMember))
})

// POST /dramas/:id/members
app.post('/:id/members', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnerDrama(id, user.id)) return notFound(c, '剧本不存在')
  const body = await c.req.json().catch(() => ({}))
  const identifier = String(body.identifier || body.username || body.email || '').trim()
  const role = String(body.role || 'viewer')
  if (!identifier) return badRequest(c, '请输入已注册用户的用户名或邮箱')
  if (!MEMBER_ROLES.has(role)) return badRequest(c, '角色只能是 editor 或 viewer')

  const target = findUserByIdentifier(identifier)
  if (!target) return badRequest(c, '该用户尚未注册，请先让对方完成注册')
  if (target.id === user.id) return badRequest(c, '不能邀请自己')
  const [drama] = db.select().from(schema.dramas).where(eq(schema.dramas.id, id)).all()
  if (drama?.userId === target.id) return badRequest(c, '项目所有者无需邀请')

  const [existing] = db.select().from(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, id), eq(schema.dramaMembers.userId, target.id)))
    .all()
  if (existing) return badRequest(c, '该用户已在协作列表中')

  const ts = now()
  db.insert(schema.dramaMembers).values({
    dramaId: id,
    userId: target.id,
    role,
    invitedBy: user.id,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const [row] = db.select().from(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, id), eq(schema.dramaMembers.userId, target.id)))
    .all()
  return created(c, serializeMember(row))
})

// PATCH /dramas/:id/members/:userId
app.patch('/:id/members/:userId', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const memberUserId = Number(c.req.param('userId'))
  const drama = getOwnerDrama(id, user.id)
  if (!drama) return notFound(c, '剧本不存在')
  if (drama.userId === memberUserId) return badRequest(c, '不能修改所有者角色')

  const body = await c.req.json().catch(() => ({}))
  const role = String(body.role || '')
  if (!MEMBER_ROLES.has(role)) return badRequest(c, '角色只能是 editor 或 viewer')

  const [existing] = db.select().from(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, id), eq(schema.dramaMembers.userId, memberUserId)))
    .all()
  if (!existing) return notFound(c, '成员不存在')

  db.update(schema.dramaMembers)
    .set({ role, updatedAt: now() })
    .where(eq(schema.dramaMembers.id, existing.id))
    .run()
  const [row] = db.select().from(schema.dramaMembers).where(eq(schema.dramaMembers.id, existing.id)).all()
  return success(c, serializeMember(row))
})

// DELETE /dramas/:id/members/:userId
app.delete('/:id/members/:userId', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const memberUserId = Number(c.req.param('userId'))
  const drama = getOwnerDrama(id, user.id)
  if (!drama) return notFound(c, '剧本不存在')
  if (drama.userId === memberUserId) return badRequest(c, '不能移除项目所有者')

  const result = db.delete(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, id), eq(schema.dramaMembers.userId, memberUserId)))
    .run()
  if (!result.changes) return notFound(c, '成员不存在')
  return success(c)
})

// GET /dramas/:id - Get drama detail
app.get('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const drama = getOwnedDrama(id, user.id)
  if (!drama) return notFound(c, '剧本不存在')

  const eps = db.select().from(schema.episodes).where(eq(schema.episodes.dramaId, id)).all()
  const chars = db.select().from(schema.characters).where(eq(schema.characters.dramaId, id)).all()
  const scns = db.select().from(schema.scenes).where(eq(schema.scenes.dramaId, id)).all()
  const prps = db.select().from(schema.props).where(eq(schema.props.dramaId, id)).all()

  return success(c, {
    ...toSnakeCase(drama),
    tags: drama.tags ? JSON.parse(drama.tags) : [],
    episodes: toSnakeCaseArray(eps),
    characters: toSnakeCaseArray(chars),
    scenes: toSnakeCaseArray(scns),
    props: toSnakeCaseArray(prps),
    my_role: getMemberRole(id, user.id),
  })
})

// PUT /dramas/:id - Update drama
app.put('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getWritableDrama(id, user.id)) return notFound(c, '剧本不存在')
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.genre !== undefined) updates.genre = body.genre
  if (body.style !== undefined) updates.style = body.style
  if (body.status !== undefined) updates.status = body.status
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags)
  if (body.metadata !== undefined) updates.metadata = body.metadata
  db.update(schema.dramas).set(updates).where(eq(schema.dramas.id, id)).run()
  return success(c)
})

// DELETE /dramas/:id - Soft delete
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnerDrama(id, user.id)) return notFound(c, '剧本不存在')
  await db.update(schema.dramas).set({ deletedAt: now() }).where(eq(schema.dramas.id, id))
  return success(c)
})

// PUT /dramas/:id/characters - Save characters
app.put('/:id/characters', async (c) => {
  const user = requireUser(c)
  const dramaId = Number(c.req.param('id'))
  if (!getWritableDrama(dramaId, user.id)) return notFound(c, '剧本不存在')
  const body = await c.req.json()
  const chars = body.characters || []
  const ts = now()

  for (const char of chars) {
    if (char.id) {
      await db.update(schema.characters).set({ ...char, updatedAt: ts }).where(eq(schema.characters.id, char.id))
    } else {
      await db.insert(schema.characters).values({ ...char, dramaId, createdAt: ts, updatedAt: ts })
    }
  }
  return success(c)
})

// PUT /dramas/:id/episodes - Save episodes
app.put('/:id/episodes', async (c) => {
  const user = requireUser(c)
  const dramaId = Number(c.req.param('id'))
  if (!getWritableDrama(dramaId, user.id)) return notFound(c, '剧本不存在')
  const body = await c.req.json()
  const episodes = body.episodes || []
  const ts = now()

  for (const ep of episodes) {
    if (ep.id) {
      await db.update(schema.episodes).set({ ...ep, updatedAt: ts }).where(eq(schema.episodes.id, ep.id))
    } else {
      await db.insert(schema.episodes).values({
        ...ep,
        dramaId,
        episodeNumber: ep.episode_number || ep.episodeNumber || 1,
        title: ep.title || '未命名',
        createdAt: ts,
        updatedAt: ts,
      })
    }
  }
  return success(c)
})

export default app
