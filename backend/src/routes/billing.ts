import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, schema } from '../db/index.js'
import { success, badRequest } from '../utils/response.js'
import { requireUser, type AppEnv } from '../middleware/auth.js'
import { getWallet } from '../services/billing.js'
import { toSnakeCase } from '../utils/transform.js'
import {
  alipayPaymentReady,
  precreateAlipayTrade,
  reconcileRechargeOrder,
} from '../services/alipay.js'
import { now } from '../utils/response.js'

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

function publicRechargePackage(row: typeof schema.rechargePackages.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    price_cents: row.priceCents,
    base_points: row.basePoints,
    bonus_points: row.bonusPoints,
    total_points: row.basePoints + row.bonusPoints,
    sort_order: row.sortOrder,
  }
}

function publicRechargeOrder(row: typeof schema.rechargeOrders.$inferSelect, withQrCode = false) {
  return {
    id: row.id,
    order_no: row.orderNo,
    package_id: row.packageId,
    package_name: row.packageName,
    amount_cents: row.amountCents,
    base_points: row.basePoints,
    bonus_points: row.bonusPoints,
    total_points: row.totalPoints,
    status: row.status,
    qr_code: withQrCode ? row.qrCode : undefined,
    expires_at: row.expiresAt,
    paid_at: row.paidAt,
    closed_at: row.closedAt,
    error_msg: row.errorMsg,
    created_at: row.createdAt,
  }
}

// GET /billing/recharge-packages
app.get('/recharge-packages', async (c) => {
  requireUser(c)
  const rows = db.select().from(schema.rechargePackages)
    .where(eq(schema.rechargePackages.isActive, true))
    .orderBy(asc(schema.rechargePackages.sortOrder), asc(schema.rechargePackages.priceCents))
    .all()
  return success(c, {
    payment_ready: alipayPaymentReady(),
    items: rows.map(publicRechargePackage),
  })
})

// POST /billing/recharge-orders
app.post('/recharge-orders', async (c) => {
  const user = requireUser(c)
  if (!alipayPaymentReady()) return badRequest(c, '支付宝支付暂未配置，请联系管理员')
  const body = await c.req.json().catch(() => ({}))
  const packageId = Number(body.package_id || body.packageId)
  if (!Number.isInteger(packageId) || packageId <= 0) return badRequest(c, '请选择充值套餐')

  const [rechargePackage] = db.select().from(schema.rechargePackages)
    .where(and(
      eq(schema.rechargePackages.id, packageId),
      eq(schema.rechargePackages.isActive, true),
    ))
    .all()
  if (!rechargePackage) return badRequest(c, '充值套餐不存在或已下架')

  const [openOrder] = db.select().from(schema.rechargeOrders)
    .where(and(
      eq(schema.rechargeOrders.userId, user.id),
      eq(schema.rechargeOrders.packageId, packageId),
      eq(schema.rechargeOrders.status, 'pending'),
    ))
    .all()

  if (openOrder) {
    try {
      const reconciled = await reconcileRechargeOrder(openOrder)
      if (reconciled.status === 'paid') return success(c, publicRechargeOrder(reconciled, true))
      if (
        reconciled.status === 'pending'
        && Date.parse(reconciled.expiresAt) > Date.now()
        && reconciled.qrCode
      ) {
        return success(c, publicRechargeOrder(reconciled, true))
      }
    } catch (err) {
      return badRequest(c, err instanceof Error ? err.message : '查询待支付订单失败')
    }
  }

  const ts = now()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const orderNo = `HB${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
  const inserted = db.insert(schema.rechargeOrders).values({
    orderNo,
    userId: user.id,
    packageId: rechargePackage.id,
    packageName: rechargePackage.name,
    amountCents: rechargePackage.priceCents,
    basePoints: rechargePackage.basePoints,
    bonusPoints: rechargePackage.bonusPoints,
    totalPoints: rechargePackage.basePoints + rechargePackage.bonusPoints,
    status: 'pending',
    expiresAt,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const orderId = Number(inserted.lastInsertRowid)
  const [order] = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.id, orderId))
    .all()

  try {
    const qrCode = await precreateAlipayTrade(order)
    db.update(schema.rechargeOrders)
      .set({ qrCode, updatedAt: now() })
      .where(eq(schema.rechargeOrders.id, orderId))
      .run()
    const [updated] = db.select().from(schema.rechargeOrders)
      .where(eq(schema.rechargeOrders.id, orderId))
      .all()
    return success(c, publicRechargeOrder(updated, true))
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建支付宝订单失败'
    db.update(schema.rechargeOrders)
      .set({ status: 'failed', errorMsg: message, updatedAt: now() })
      .where(eq(schema.rechargeOrders.id, orderId))
      .run()
    return badRequest(c, message)
  }
})

// GET /billing/recharge-orders
app.get('/recharge-orders', async (c) => {
  const user = requireUser(c)
  const { page, pageSize, offset } = parsePage(c)
  const status = String(c.req.query('status') || '')
  let rows = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.userId, user.id))
    .orderBy(desc(schema.rechargeOrders.createdAt))
    .all()
  if (status) rows = rows.filter(row => row.status === status)
  return success(c, {
    items: rows.slice(offset, offset + pageSize).map(row => publicRechargeOrder(row)),
    total: rows.length,
    page,
    page_size: pageSize,
  })
})

// GET /billing/recharge-orders/:orderNo
app.get('/recharge-orders/:orderNo', async (c) => {
  const user = requireUser(c)
  const orderNo = String(c.req.param('orderNo') || '')
  const [order] = db.select().from(schema.rechargeOrders)
    .where(and(
      eq(schema.rechargeOrders.orderNo, orderNo),
      eq(schema.rechargeOrders.userId, user.id),
    ))
    .all()
  if (!order) return badRequest(c, '充值订单不存在')

  try {
    const updated = order.status === 'pending'
      ? await reconcileRechargeOrder(order)
      : order
    return success(c, publicRechargeOrder(updated, updated.status === 'pending'))
  } catch (err) {
    return badRequest(c, err instanceof Error ? err.message : '查询充值订单失败')
  }
})

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
