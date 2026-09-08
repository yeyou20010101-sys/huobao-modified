import { Hono } from 'hono'
import { asc, desc, eq, isNull, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest, notFound, now } from '../utils/response.js'
import { requireAdmin, type AppEnv } from '../middleware/auth.js'
import { ensureDramaOwnerMember } from '../utils/ownership.js'
import { toSnakeCase } from '../utils/transform.js'
import {
  adjustWallet,
  BILLING_TASK_TYPES,
  getWallet,
  isBillingTaskType,
} from '../services/billing.js'

const app = new Hono<AppEnv>()

function publicUser(row: typeof schema.users.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    email_verified_at: row.emailVerifiedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function countActiveAdmins() {
  return db.select().from(schema.users).all()
    .filter(user => user.role === 'admin' && user.status === 'active')
    .length
}

// GET /admin/users
app.get('/users', async (c) => {
  requireAdmin(c)
  const rows = db.select().from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .all()
  return success(c, rows.map(publicUser))
})

// PATCH /admin/users/:id
app.patch('/users/:id', async (c) => {
  requireAdmin(c)
  const id = Number(c.req.param('id'))
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, id)).all()
  if (!user) return notFound(c, '用户不存在')

  const body = await c.req.json().catch(() => ({}))
  const updates: Record<string, string> = { updatedAt: now() }
  if (body.role !== undefined) {
    const role = String(body.role)
    if (role !== 'admin' && role !== 'user') return badRequest(c, '角色只能是 admin 或 user')
    updates.role = role
  }
  if (body.status !== undefined) {
    const status = String(body.status)
    if (status !== 'active' && status !== 'disabled') return badRequest(c, '状态只能是 active 或 disabled')
    updates.status = status
  }

  const nextRole = updates.role || user.role
  const nextStatus = updates.status || user.status
  const demotingLastAdmin = user.role === 'admin' && user.status === 'active'
    && (nextRole !== 'admin' || nextStatus !== 'active')
    && countActiveAdmins() <= 1
  if (demotingLastAdmin) return badRequest(c, '不能去掉最后一个管理员')

  db.update(schema.users).set(updates).where(eq(schema.users.id, id)).run()
  const [updated] = db.select().from(schema.users).where(eq(schema.users.id, id)).all()
  return success(c, publicUser(updated))
})

// GET /admin/dramas
app.get('/dramas', async (c) => {
  requireAdmin(c)
  const rows = db.select().from(schema.dramas)
    .orderBy(desc(schema.dramas.updatedAt))
    .all()
  const users = db.select().from(schema.users).all()
  const userMap = new Map(users.map(u => [u.id, u]))
  return success(c, rows.map(drama => {
    const owner = drama.userId ? userMap.get(drama.userId) : null
    return {
      ...toSnakeCase(drama),
      owner_id: drama.userId,
      owner_username: owner?.username || null,
      owner_email: owner?.email || null,
    }
  }))
})

// DELETE /admin/dramas/:id
app.delete('/dramas/:id', async (c) => {
  requireAdmin(c)
  const id = Number(c.req.param('id'))
  const [drama] = db.select().from(schema.dramas).where(eq(schema.dramas.id, id)).all()
  if (!drama) return notFound(c, '项目不存在')
  db.update(schema.dramas).set({ deletedAt: now(), updatedAt: now() }).where(eq(schema.dramas.id, id)).run()
  return success(c)
})

// GET /admin/ai-configs — 密钥脱敏
app.get('/ai-configs', async (c) => {
  requireAdmin(c)
  const rows = db.select().from(schema.aiServiceConfigs)
    .orderBy(desc(schema.aiServiceConfigs.updatedAt))
    .all()
  const users = db.select().from(schema.users).all()
  const userMap = new Map(users.map(u => [u.id, u]))
  return success(c, rows.map(row => {
    const owner = row.userId ? userMap.get(row.userId) : null
    return {
      id: row.id,
      user_id: row.userId,
      owner_username: owner?.username || null,
      service_type: row.serviceType,
      provider: row.provider,
      name: row.name,
      base_url: row.baseUrl,
      model: row.model,
      is_active: row.isActive,
      has_api_key: Boolean(row.apiKey && String(row.apiKey).trim()),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }))
})

// POST /admin/claim-orphans
app.post('/claim-orphans', async (c) => {
  requireAdmin(c)
  const body = await c.req.json().catch(() => ({}))
  const userId = Number(body.user_id || body.userId)
  if (!userId) return badRequest(c, 'user_id 必填')
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()
  if (!user) return notFound(c, '用户不存在')

  const tables: Array<{ table: any; label: string }> = [
    { table: schema.dramas, label: 'dramas' },
    { table: schema.aiServiceConfigs, label: 'ai_service_configs' },
    { table: schema.agentConfigs, label: 'agent_configs' },
    { table: schema.createJobs, label: 'create_jobs' },
    { table: schema.imageGenerations, label: 'image_generations' },
    { table: schema.videoGenerations, label: 'video_generations' },
    { table: schema.videoMerges, label: 'video_merges' },
  ]

  const claimed: Record<string, number> = {}
  for (const item of tables) {
    const result = db.update(item.table)
      .set({ userId })
      .where(isNull(item.table.userId))
      .run()
    claimed[item.label] = result.changes
  }

  const dramas = db.select().from(schema.dramas).where(eq(schema.dramas.userId, userId)).all()
  for (const drama of dramas) {
    ensureDramaOwnerMember(drama.id, userId)
  }

  return success(c, { user_id: userId, claimed })
})

function parsePage(c: { req: { query: (k: string) => string | undefined } }) {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') || c.req.query('pageSize') || 20) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function publicPrice(row: typeof schema.billingPrices.$inferSelect) {
  return toSnakeCase(row)
}

function publicWallet(user: typeof schema.users.$inferSelect, wallet: ReturnType<typeof getWallet>) {
  return {
    user_id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    available_points: wallet.availablePoints,
    frozen_points: wallet.frozenPoints,
    total_consumed: wallet.totalConsumed,
    updated_at: wallet.updatedAt,
  }
}

// GET /admin/wallets
app.get('/wallets', async (c) => {
  requireAdmin(c)
  const q = String(c.req.query('q') || '').trim().toLowerCase()
  const users = db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).all()
  const items = users
    .filter(user => {
      if (!q) return true
      return user.username.toLowerCase().includes(q) || user.email.toLowerCase().includes(q) || String(user.id) === q
    })
    .map(user => publicWallet(user, getWallet(user.id)))
  return success(c, items)
})

// GET /admin/wallets/:userId
app.get('/wallets/:userId', async (c) => {
  requireAdmin(c)
  const userId = Number(c.req.param('userId'))
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()
  if (!user) return notFound(c, '用户不存在')
  return success(c, publicWallet(user, getWallet(userId)))
})

// POST /admin/wallets/:userId/adjust
app.post('/wallets/:userId/adjust', async (c) => {
  const admin = requireAdmin(c)
  const userId = Number(c.req.param('userId'))
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()
  if (!user) return notFound(c, '用户不存在')

  const body = await c.req.json().catch(() => ({}))
  const delta = Number(body.delta)
  const remark = String(body.remark || body.reason || '').trim()
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    return badRequest(c, 'delta 必须是非零整数')
  }
  if (!remark) return badRequest(c, '调整原因必填')

  try {
    const wallet = adjustWallet({
      userId,
      delta,
      remark,
      operatorId: admin.id,
    })
    return success(c, publicWallet(user, wallet))
  } catch (err) {
    return badRequest(c, err instanceof Error ? err.message : '调整失败')
  }
})

// GET /admin/prices
app.get('/prices', async (c) => {
  requireAdmin(c)
  const rows = db.select().from(schema.billingPrices)
    .orderBy(desc(schema.billingPrices.updatedAt))
    .all()
  return success(c, rows.map(publicPrice))
})

// POST /admin/prices
app.post('/prices', async (c) => {
  requireAdmin(c)
  const body = await c.req.json().catch(() => ({}))
  const taskType = String(body.task_type || body.taskType || '').trim()
  const provider = String(body.provider || '').trim()
  const model = String(body.model || '').trim()
  const unitPoints = Number(body.unit_points ?? body.unitPoints)
  const isActive = body.is_active === undefined && body.isActive === undefined
    ? true
    : Boolean(body.is_active ?? body.isActive)

  if (!isBillingTaskType(taskType)) {
    return badRequest(c, `任务类型必须是 ${BILLING_TASK_TYPES.join('、')}`)
  }
  if (!provider || !model) return badRequest(c, '服务商和模型必填')
  if (!Number.isInteger(unitPoints) || unitPoints < 0) return badRequest(c, '单价必须是大于等于 0 的整数')

  const [dup] = db.select().from(schema.billingPrices)
    .where(and(
      eq(schema.billingPrices.taskType, taskType),
      eq(schema.billingPrices.provider, provider),
      eq(schema.billingPrices.model, model),
    ))
    .all()
  if (dup) return badRequest(c, '该任务类型、服务商和模型已存在价格规则')

  const ts = now()
  const res = db.insert(schema.billingPrices).values({
    taskType,
    provider,
    model,
    unitPoints,
    isActive,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const [row] = db.select().from(schema.billingPrices)
    .where(eq(schema.billingPrices.id, Number(res.lastInsertRowid)))
    .all()
  return success(c, publicPrice(row))
})

// PATCH /admin/prices/:id
app.patch('/prices/:id', async (c) => {
  requireAdmin(c)
  const id = Number(c.req.param('id'))
  const [row] = db.select().from(schema.billingPrices).where(eq(schema.billingPrices.id, id)).all()
  if (!row) return notFound(c, '价格规则不存在')

  const body = await c.req.json().catch(() => ({}))
  const updates: Partial<typeof schema.billingPrices.$inferInsert> = { updatedAt: now() }

  if (body.task_type !== undefined || body.taskType !== undefined) {
    const taskType = String(body.task_type || body.taskType || '').trim()
    if (!isBillingTaskType(taskType)) {
      return badRequest(c, `任务类型必须是 ${BILLING_TASK_TYPES.join('、')}`)
    }
    updates.taskType = taskType
  }
  if (body.provider !== undefined) {
    const provider = String(body.provider || '').trim()
    if (!provider) return badRequest(c, '服务商不能为空')
    updates.provider = provider
  }
  if (body.model !== undefined) {
    const model = String(body.model || '').trim()
    if (!model) return badRequest(c, '模型不能为空')
    updates.model = model
  }
  if (body.unit_points !== undefined || body.unitPoints !== undefined) {
    const unitPoints = Number(body.unit_points ?? body.unitPoints)
    if (!Number.isInteger(unitPoints) || unitPoints < 0) return badRequest(c, '单价必须是大于等于 0 的整数')
    updates.unitPoints = unitPoints
  }
  if (body.is_active !== undefined || body.isActive !== undefined) {
    updates.isActive = Boolean(body.is_active ?? body.isActive)
  }

  const nextTask = updates.taskType || row.taskType
  const nextProvider = updates.provider || row.provider
  const nextModel = updates.model || row.model
  const [dup] = db.select().from(schema.billingPrices)
    .where(and(
      eq(schema.billingPrices.taskType, nextTask),
      eq(schema.billingPrices.provider, nextProvider),
      eq(schema.billingPrices.model, nextModel),
    ))
    .all()
  if (dup && dup.id !== row.id) return badRequest(c, '该任务类型、服务商和模型已存在价格规则')

  db.update(schema.billingPrices).set(updates).where(eq(schema.billingPrices.id, id)).run()
  const [updated] = db.select().from(schema.billingPrices).where(eq(schema.billingPrices.id, id)).all()
  return success(c, publicPrice(updated))
})

function publicRechargePackage(row: typeof schema.rechargePackages.$inferSelect) {
  return {
    ...toSnakeCase(row),
    total_points: row.basePoints + row.bonusPoints,
  }
}

function rechargePackageInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim()
  const priceCents = Number(body.price_cents ?? body.priceCents)
  const basePoints = Number(body.base_points ?? body.basePoints)
  const bonusPoints = Number(body.bonus_points ?? body.bonusPoints ?? 0)
  const sortOrder = Number(body.sort_order ?? body.sortOrder ?? 0)
  if (!name) throw new Error('套餐名称必填')
  if (!Number.isInteger(priceCents) || priceCents < 1) throw new Error('套餐金额必须是大于 0 的整数分')
  if (!Number.isInteger(basePoints) || basePoints < 1) throw new Error('基础点数必须是正整数')
  if (!Number.isInteger(bonusPoints) || bonusPoints < 0) throw new Error('赠送点数必须是非负整数')
  if (!Number.isInteger(sortOrder)) throw new Error('排序必须是整数')
  return { name, priceCents, basePoints, bonusPoints, sortOrder }
}

// GET /admin/recharge-packages
app.get('/recharge-packages', async (c) => {
  requireAdmin(c)
  const rows = db.select().from(schema.rechargePackages)
    .orderBy(asc(schema.rechargePackages.sortOrder), asc(schema.rechargePackages.priceCents))
    .all()
  return success(c, rows.map(publicRechargePackage))
})

// POST /admin/recharge-packages
app.post('/recharge-packages', async (c) => {
  requireAdmin(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  try {
    const input = rechargePackageInput(body)
    const ts = now()
    const inserted = db.insert(schema.rechargePackages).values({
      ...input,
      isActive: body.is_active === undefined ? true : Boolean(body.is_active),
      createdAt: ts,
      updatedAt: ts,
    }).run()
    const [row] = db.select().from(schema.rechargePackages)
      .where(eq(schema.rechargePackages.id, Number(inserted.lastInsertRowid)))
      .all()
    return success(c, publicRechargePackage(row))
  } catch (err) {
    return badRequest(c, err instanceof Error ? err.message : '创建充值套餐失败')
  }
})

// PATCH /admin/recharge-packages/:id
app.patch('/recharge-packages/:id', async (c) => {
  requireAdmin(c)
  const id = Number(c.req.param('id'))
  const [row] = db.select().from(schema.rechargePackages)
    .where(eq(schema.rechargePackages.id, id))
    .all()
  if (!row) return notFound(c, '充值套餐不存在')
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  try {
    const merged = rechargePackageInput({
      name: body.name ?? row.name,
      price_cents: body.price_cents ?? body.priceCents ?? row.priceCents,
      base_points: body.base_points ?? body.basePoints ?? row.basePoints,
      bonus_points: body.bonus_points ?? body.bonusPoints ?? row.bonusPoints,
      sort_order: body.sort_order ?? body.sortOrder ?? row.sortOrder,
    })
    db.update(schema.rechargePackages)
      .set({
        ...merged,
        isActive: body.is_active === undefined && body.isActive === undefined
          ? row.isActive
          : Boolean(body.is_active ?? body.isActive),
        updatedAt: now(),
      })
      .where(eq(schema.rechargePackages.id, id))
      .run()
    const [updated] = db.select().from(schema.rechargePackages)
      .where(eq(schema.rechargePackages.id, id))
      .all()
    return success(c, publicRechargePackage(updated))
  } catch (err) {
    return badRequest(c, err instanceof Error ? err.message : '更新充值套餐失败')
  }
})

// DELETE /admin/recharge-packages/:id — 已产生订单的套餐只下架，不物理删除
app.delete('/recharge-packages/:id', async (c) => {
  requireAdmin(c)
  const id = Number(c.req.param('id'))
  const [row] = db.select().from(schema.rechargePackages)
    .where(eq(schema.rechargePackages.id, id))
    .all()
  if (!row) return notFound(c, '充值套餐不存在')
  const [used] = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.packageId, id))
    .all()
  if (used) {
    db.update(schema.rechargePackages)
      .set({ isActive: false, updatedAt: now() })
      .where(eq(schema.rechargePackages.id, id))
      .run()
  } else {
    db.delete(schema.rechargePackages).where(eq(schema.rechargePackages.id, id)).run()
  }
  return success(c)
})

// GET /admin/recharge-orders
app.get('/recharge-orders', async (c) => {
  requireAdmin(c)
  const { page, pageSize, offset } = parsePage(c)
  const status = String(c.req.query('status') || '')
  const userId = Number(c.req.query('user_id') || 0)
  const orderNo = String(c.req.query('order_no') || '').trim()
  let rows = db.select().from(schema.rechargeOrders)
    .orderBy(desc(schema.rechargeOrders.createdAt))
    .all()
  if (status) rows = rows.filter(row => row.status === status)
  if (userId) rows = rows.filter(row => row.userId === userId)
  if (orderNo) rows = rows.filter(row => row.orderNo.includes(orderNo))
  const users = db.select().from(schema.users).all()
  const userMap = new Map(users.map(user => [user.id, user]))
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(row => ({
      ...toSnakeCase(row),
      qr_code: undefined,
      username: userMap.get(row.userId)?.username || null,
      email: userMap.get(row.userId)?.email || null,
    })),
    total: rows.length,
    page,
    page_size: pageSize,
  })
})

// GET /admin/recharge-orders/:orderNo
app.get('/recharge-orders/:orderNo', async (c) => {
  requireAdmin(c)
  const [row] = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.orderNo, c.req.param('orderNo')))
    .all()
  if (!row) return notFound(c, '充值订单不存在')
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).all()
  return success(c, {
    ...toSnakeCase(row),
    qr_code: undefined,
    username: user?.username || null,
    email: user?.email || null,
  })
})

// GET /admin/usage
app.get('/usage', async (c) => {
  requireAdmin(c)
  const { page, pageSize, offset } = parsePage(c)
  const taskType = c.req.query('task_type') || ''
  const status = c.req.query('status') || ''
  const userId = Number(c.req.query('user_id') || 0)
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''

  let rows = db.select().from(schema.usageRecords)
    .orderBy(desc(schema.usageRecords.createdAt))
    .all()
  if (taskType) rows = rows.filter(row => row.taskType === taskType)
  if (status) rows = rows.filter(row => row.status === status)
  if (userId) rows = rows.filter(row => row.userId === userId)
  if (from) rows = rows.filter(row => row.createdAt >= from)
  if (to) rows = rows.filter(row => row.createdAt <= to)

  const users = db.select().from(schema.users).all()
  const userMap = new Map(users.map(u => [u.id, u.username]))
  const total = rows.length
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(row => ({
      ...toSnakeCase(row),
      username: userMap.get(row.userId) || null,
    })),
    total,
    page,
    page_size: pageSize,
  })
})

// GET /admin/transactions
app.get('/transactions', async (c) => {
  requireAdmin(c)
  const { page, pageSize, offset } = parsePage(c)
  const type = c.req.query('type') || ''
  const userId = Number(c.req.query('user_id') || 0)
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''

  let rows = db.select().from(schema.walletTransactions)
    .orderBy(desc(schema.walletTransactions.createdAt))
    .all()
  if (type) rows = rows.filter(row => row.type === type)
  if (userId) rows = rows.filter(row => row.userId === userId)
  if (from) rows = rows.filter(row => row.createdAt >= from)
  if (to) rows = rows.filter(row => row.createdAt <= to)

  const users = db.select().from(schema.users).all()
  const userMap = new Map(users.map(u => [u.id, u.username]))
  const total = rows.length
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(row => ({
      ...toSnakeCase(row),
      username: userMap.get(row.userId) || null,
    })),
    total,
    page,
    page_size: pageSize,
  })
})

export default app
