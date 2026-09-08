import { Hono } from 'hono'
import { eq, isNull, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest, notFound, now } from '../utils/response.js'
import { toSnakeCaseArray, toSnakeCase } from '../utils/transform.js'
import { requireUser } from '../middleware/auth.js'
import { getOwnedAgentConfig } from '../utils/ownership.js'

const app = new Hono()

// GET /agent-configs
app.get('/', async (c) => {
  const user = requireUser(c)
  const rows = db.select().from(schema.agentConfigs)
    .where(and(eq(schema.agentConfigs.userId, user.id), isNull(schema.agentConfigs.deletedAt))).all()
  return success(c, toSnakeCaseArray(rows))
})

// GET /agent-configs/:id
app.get('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedAgentConfig(id, user.id)
  if (!row) return notFound(c)
  return success(c, toSnakeCase(row))
})

// POST /agent-configs (upsert by agent_type + user)
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  if (!body.agent_type) return badRequest(c, 'agent_type required')
  const ts = now()

  // Check if exists (including soft-deleted)
  const [existing] = db.select().from(schema.agentConfigs)
    .where(and(eq(schema.agentConfigs.agentType, body.agent_type), eq(schema.agentConfigs.userId, user.id))).all()

  if (existing) {
    // Update existing
    db.update(schema.agentConfigs).set({
      name: body.name || existing.name,
      model: body.model ?? existing.model,
      systemPrompt: body.system_prompt ?? existing.systemPrompt,
      temperature: body.temperature ?? existing.temperature,
      maxTokens: body.max_tokens ?? existing.maxTokens,
      maxIterations: body.max_iterations ?? existing.maxIterations,
      isActive: body.is_active ?? true,
      deletedAt: null,
      updatedAt: ts,
    }).where(eq(schema.agentConfigs.id, existing.id)).run()
    const [row] = db.select().from(schema.agentConfigs).where(eq(schema.agentConfigs.id, existing.id)).all()
    return success(c, toSnakeCase(row))
  }

  const res = db.insert(schema.agentConfigs).values({
    userId: user.id,
    agentType: body.agent_type,
    name: body.name || '',
    description: body.description || '',
    model: body.model || '',
    systemPrompt: body.system_prompt || '',
    temperature: body.temperature ?? 0.7,
    maxTokens: body.max_tokens ?? 4096,
    maxIterations: body.max_iterations ?? 10,
    isActive: body.is_active ?? true,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const [result] = db.select().from(schema.agentConfigs)
    .where(eq(schema.agentConfigs.id, Number(res.lastInsertRowid))).all()
  return success(c, toSnakeCase(result))
})

// PUT /agent-configs/:id
app.put('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnedAgentConfig(id, user.id)) return notFound(c)
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }

  if ('model' in body) updates.model = body.model
  if ('temperature' in body) updates.temperature = body.temperature
  if ('max_tokens' in body) updates.maxTokens = body.max_tokens
  if ('max_iterations' in body) updates.maxIterations = body.max_iterations
  if ('is_active' in body) updates.isActive = body.is_active
  if ('system_prompt' in body) updates.systemPrompt = body.system_prompt
  if ('name' in body) updates.name = body.name
  if ('description' in body) updates.description = body.description

  db.update(schema.agentConfigs).set(updates).where(eq(schema.agentConfigs.id, id)).run()
  const [row] = db.select().from(schema.agentConfigs).where(eq(schema.agentConfigs.id, id)).all()
  return success(c, toSnakeCase(row))
})

// DELETE /agent-configs/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnedAgentConfig(id, user.id)) return notFound(c)
  db.update(schema.agentConfigs).set({ deletedAt: now() }).where(eq(schema.agentConfigs.id, id)).run()
  return success(c)
})

export default app
