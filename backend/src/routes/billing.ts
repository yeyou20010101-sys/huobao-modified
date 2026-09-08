import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest } from '../utils/response.js'
import { requireUser, type AppEnv } from '../middleware/auth.js'
import { getWallet } from '../services/billing.js'
import { toSnakeCase } from '../utils/transform.js'

const app = new Hono<AppEnv>()

const USAGE_STATUSES = new Set(['frozen', 'settled', 'refunded', 'waived'])

function parsePage(c: { req: { query: (k: string) => string | undefined } }) {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') || c.req.query('pageSize') || 20) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function inTimeRange(iso: string, from?: string, to?: string) {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

function publicUsage(row: typeof schema.usageRecords.$inferSelect) {
  return toSnakeCase(row)
}

function publicTx(row: typeof schema.walletTransactions.$inferSelect) {
  return toSnakeCase(row)
}

// GET /billing/summary
app.get('/summary', async (c) => {
  const user = requireUser(c)
  const wallet = getWallet(user.id)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recent = db.select().from(schema.usageRecords)
    .where(eq(schema.usageRecords.userId, user.id))
    .all()
    .filter(row => row.createdAt >= since)
  const consumed = recent
    .filter(row => row.status === 'settled' || row.status === 'waived')
    .reduce((sum, row) => sum + (row.status === 'settled' ? row.points : 0), 0)

  return success(c, {
    available_points: wallet.availablePoints,
    frozen_points: wallet.frozenPoints,
    total_consumed: wallet.totalConsumed,
    updated_at: wallet.updatedAt,
    recent: {
      last_7d_tasks: recent.length,
      last_7d_consumed: consumed,
    },
  })
})

// GET /billing/usage
app.get('/usage', async (c) => {
  const user = requireUser(c)
  const { page, pageSize, offset } = parsePage(c)
  const taskType = c.req.query('task_type') || c.req.query('taskType') || ''
  const status = c.req.query('status') || ''
  const dramaId = Number(c.req.query('drama_id') || c.req.query('dramaId') || 0)
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''

  if (status && !USAGE_STATUSES.has(status)) {
    return badRequest(c, '无效的用量状态')
  }

  let rows = db.select().from(schema.usageRecords)
    .where(eq(schema.usageRecords.userId, user.id))
    .orderBy(desc(schema.usageRecords.createdAt))
    .all()

  if (taskType) rows = rows.filter(row => row.taskType === taskType)
  if (status) rows = rows.filter(row => row.status === status)
  if (dramaId) rows = rows.filter(row => row.dramaId === dramaId)
  if (from || to) rows = rows.filter(row => inTimeRange(row.createdAt, from || undefined, to || undefined))

  const total = rows.length
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(publicUsage),
    total,
    page,
    page_size: pageSize,
  })
})

// GET /billing/transactions
app.get('/transactions', async (c) => {
  const user = requireUser(c)
  const { page, pageSize, offset } = parsePage(c)
  const type = c.req.query('type') || ''
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''

  let rows = db.select().from(schema.walletTransactions)
    .where(eq(schema.walletTransactions.userId, user.id))
    .orderBy(desc(schema.walletTransactions.createdAt))
    .all()

  if (type) rows = rows.filter(row => row.type === type)
  if (from || to) rows = rows.filter(row => inTimeRange(row.createdAt, from || undefined, to || undefined))

  const total = rows.length
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(publicTx),
    total,
    page,
    page_size: pageSize,
  })
})

export default app
