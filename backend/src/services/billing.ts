/**
 * 虚拟点数计费：按任务冻结、成功结算、失败退款；管理员免扣但记用量。
 */
import { and, eq } from 'drizzle-orm'
import { db, schema, sqlite } from '../db/index.js'
import { now } from '../utils/response.js'
import { BillingError, BILLING_ERROR_CODES } from '../utils/billing-error.js'

export const BILLING_TASK_TYPES = ['agent', 'image', 'video', 'tts', 'compose', 'merge'] as const
export type BillingTaskType = (typeof BILLING_TASK_TYPES)[number]

export const USAGE_STATUS = {
  FROZEN: 'frozen',
  SETTLED: 'settled',
  REFUNDED: 'refunded',
  WAIVED: 'waived',
} as const

export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS]

const STALE_SYNC_MS = 10 * 60 * 1000
const STALE_ASYNC_MS = 2 * 60 * 60 * 1000

export interface BeginTaskParams {
  userId: number
  taskType: BillingTaskType
  provider: string
  model: string
  quantity?: number
  dramaId?: number | null
  episodeId?: number | null
  storyboardId?: number | null
  refType?: string | null
  refId?: number | null
  idempotencyKey: string
}

export type UsageRecord = typeof schema.usageRecords.$inferSelect
export type WalletAccount = typeof schema.walletAccounts.$inferSelect
export type BillingPrice = typeof schema.billingPrices.$inferSelect

function asInt(value: number): number {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function isBillingTaskType(value: string): value is BillingTaskType {
  return (BILLING_TASK_TYPES as readonly string[]).includes(value)
}

export function ensureWallet(userId: number): WalletAccount {
  const ts = now()
  sqlite.prepare(`
    INSERT OR IGNORE INTO wallet_accounts
      (user_id, available_points, frozen_points, total_consumed, created_at, updated_at)
    VALUES (?, 0, 0, 0, ?, ?)
  `).run(userId, ts, ts)
  const [wallet] = db.select().from(schema.walletAccounts)
    .where(eq(schema.walletAccounts.userId, userId))
    .all()
  if (!wallet) throw new Error('钱包创建失败')
  return wallet
}

export function getWallet(userId: number): WalletAccount {
  return ensureWallet(userId)
}

export function findActivePrice(taskType: string, provider: string, model: string): BillingPrice | null {
  const [row] = db.select().from(schema.billingPrices)
    .where(and(
      eq(schema.billingPrices.taskType, taskType),
      eq(schema.billingPrices.provider, provider),
      eq(schema.billingPrices.model, model),
    ))
    .all()
  if (!row || !row.isActive) return null
  return row
}

export function quoteTask(taskType: string, provider: string, model: string, quantity = 1): {
  price: BillingPrice
  points: number
} {
  const price = findActivePrice(taskType, provider, model)
  if (!price) {
    throw new BillingError(
      BILLING_ERROR_CODES.PRICE_MISSING,
      `未配置价格：${taskType} / ${provider} / ${model}。请联系管理员定价后再提交任务。`,
    )
  }
  const qty = Math.max(1, asInt(quantity))
  const unit = asInt(price.unitPoints)
  return { price, points: unit * qty }
}

function isAdminUser(userId: number): boolean {
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()
  return user?.role === 'admin'
}

function insertTransaction(params: {
  userId: number
  usageRecordId?: number | null
  type: string
  points: number
  availableAfter: number
  frozenAfter: number
  remark?: string | null
  operatorId?: number | null
  createdAt: string
}) {
  db.insert(schema.walletTransactions).values({
    userId: params.userId,
    usageRecordId: params.usageRecordId ?? null,
    type: params.type,
    points: params.points,
    availableAfter: params.availableAfter,
    frozenAfter: params.frozenAfter,
    remark: params.remark ?? null,
    operatorId: params.operatorId ?? null,
    createdAt: params.createdAt,
  }).run()
}

function readWalletRow(userId: number): WalletAccount {
  const [wallet] = db.select().from(schema.walletAccounts)
    .where(eq(schema.walletAccounts.userId, userId))
    .all()
  if (!wallet) throw new Error('钱包不存在')
  return wallet
}

export function storyboardBillingIds(storyboardId?: number | null, dramaId?: number | null): {
  storyboardId: number | null
  episodeId: number | null
  dramaId: number | null
} {
  if (!storyboardId) {
    return { storyboardId: null, episodeId: null, dramaId: dramaId ?? null }
  }
  const [sb] = db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, storyboardId))
    .all()
  if (!sb) {
    return { storyboardId, episodeId: null, dramaId: dramaId ?? null }
  }
  const [ep] = db.select().from(schema.episodes)
    .where(eq(schema.episodes.id, sb.episodeId))
    .all()
  return {
    storyboardId,
    episodeId: sb.episodeId ?? null,
    dramaId: dramaId ?? ep?.dramaId ?? null,
  }
}

/**
 * 提交任务前冻结点数。同一幂等键重复调用返回原记录，不重复扣费。
 */
export function beginTask(params: BeginTaskParams): UsageRecord {
  const provider = String(params.provider || '').trim()
  const model = String(params.model || '').trim()
  if (!provider || !model) {
    throw new BillingError(
      BILLING_ERROR_CODES.PRICE_MISSING,
      `未配置价格：缺少服务商或模型（${params.taskType}）。`,
    )
  }

  const { price, points } = quoteTask(params.taskType, provider, model, params.quantity)
  const quantity = Math.max(1, asInt(params.quantity ?? 1))
  const waived = isAdminUser(params.userId)

  return sqlite.transaction(() => {
    const [existing] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.idempotencyKey, params.idempotencyKey))
      .all()
    if (existing) return existing

    ensureWallet(params.userId)
    const ts = now()

    if (waived) {
      const inserted = db.insert(schema.usageRecords).values({
        userId: params.userId,
        dramaId: params.dramaId ?? null,
        episodeId: params.episodeId ?? null,
        storyboardId: params.storyboardId ?? null,
        taskType: params.taskType,
        provider,
        model,
        unitPoints: price.unitPoints,
        quantity,
        points,
        status: USAGE_STATUS.WAIVED,
        refType: params.refType ?? null,
        refId: params.refId ?? null,
        idempotencyKey: params.idempotencyKey,
        createdAt: ts,
        updatedAt: ts,
      }).run()
      const [record] = db.select().from(schema.usageRecords)
        .where(eq(schema.usageRecords.id, Number(inserted.lastInsertRowid)))
        .all()
      return record
    }

    const freeze = sqlite.prepare(`
      UPDATE wallet_accounts
      SET available_points = available_points - ?,
          frozen_points = frozen_points + ?,
          updated_at = ?
      WHERE user_id = ? AND available_points >= ?
    `).run(points, points, ts, params.userId, points)

    if (freeze.changes !== 1) {
      const wallet = readWalletRow(params.userId)
      throw new BillingError(
        BILLING_ERROR_CODES.BALANCE_INSUFFICIENT,
        `余额不足：需要 ${points} 点，当前可用 ${wallet.availablePoints} 点。请前往「用量与余额」查看或联系管理员充值。`,
      )
    }

    const inserted = db.insert(schema.usageRecords).values({
      userId: params.userId,
      dramaId: params.dramaId ?? null,
      episodeId: params.episodeId ?? null,
      storyboardId: params.storyboardId ?? null,
      taskType: params.taskType,
      provider,
      model,
      unitPoints: price.unitPoints,
      quantity,
      points,
      status: USAGE_STATUS.FROZEN,
      refType: params.refType ?? null,
      refId: params.refId ?? null,
      idempotencyKey: params.idempotencyKey,
      createdAt: ts,
      updatedAt: ts,
    }).run()
    const usageId = Number(inserted.lastInsertRowid)
    const wallet = readWalletRow(params.userId)
    insertTransaction({
      userId: params.userId,
      usageRecordId: usageId,
      type: 'freeze',
      points,
      availableAfter: wallet.availablePoints,
      frozenAfter: wallet.frozenPoints,
      remark: `${params.taskType} ${provider}/${model}`,
      createdAt: ts,
    })
    const [record] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.id, usageId))
      .all()
    return record
  })()
}

function latestByRef(refType: string, refId: number): UsageRecord | null {
  const rows = db.select().from(schema.usageRecords)
    .where(and(
      eq(schema.usageRecords.refType, refType),
      eq(schema.usageRecords.refId, refId),
    ))
    .all()
  if (!rows.length) return null
  return rows.sort((a, b) => b.id - a.id)[0]
}

/**
 * 成功结算：冻结转为累计消耗。重复调用幂等。
 */
export function settleTask(usageRecordId: number): UsageRecord | null {
  return sqlite.transaction(() => {
    const [record] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.id, usageRecordId))
      .all()
    if (!record) return null
    if (record.status === USAGE_STATUS.SETTLED || record.status === USAGE_STATUS.WAIVED) return record
    if (record.status !== USAGE_STATUS.FROZEN) return record

    const ts = now()
    const settle = sqlite.prepare(`
      UPDATE wallet_accounts
      SET frozen_points = frozen_points - ?,
          total_consumed = total_consumed + ?,
          updated_at = ?
      WHERE user_id = ? AND frozen_points >= ?
    `).run(record.points, record.points, ts, record.userId, record.points)

    if (settle.changes !== 1) {
      throw new Error(`结算失败：用户 ${record.userId} 冻结余额不足`)
    }

    db.update(schema.usageRecords)
      .set({ status: USAGE_STATUS.SETTLED, settledAt: ts, updatedAt: ts, errorMsg: null })
      .where(eq(schema.usageRecords.id, record.id))
      .run()

    const wallet = readWalletRow(record.userId)
    insertTransaction({
      userId: record.userId,
      usageRecordId: record.id,
      type: 'settle',
      points: record.points,
      availableAfter: wallet.availablePoints,
      frozenAfter: wallet.frozenPoints,
      remark: `${record.taskType} 结算`,
      createdAt: ts,
    })

    const [updated] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.id, record.id))
      .all()
    return updated
  })()
}

/**
 * 失败/取消退款：冻结全额退回可用余额。重复调用幂等。
 */
export function refundTask(usageRecordId: number, errorMsg?: string): UsageRecord | null {
  return sqlite.transaction(() => {
    const [record] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.id, usageRecordId))
      .all()
    if (!record) return null
    if (record.status === USAGE_STATUS.REFUNDED || record.status === USAGE_STATUS.WAIVED) {
      if (errorMsg && record.status === USAGE_STATUS.REFUNDED && !record.errorMsg) {
        db.update(schema.usageRecords)
          .set({ errorMsg, updatedAt: now() })
          .where(eq(schema.usageRecords.id, record.id))
          .run()
      }
      return record
    }
    if (record.status !== USAGE_STATUS.FROZEN) return record

    const ts = now()
    const refund = sqlite.prepare(`
      UPDATE wallet_accounts
      SET frozen_points = frozen_points - ?,
          available_points = available_points + ?,
          updated_at = ?
      WHERE user_id = ? AND frozen_points >= ?
    `).run(record.points, record.points, ts, record.userId, record.points)

    if (refund.changes !== 1) {
      throw new Error(`退款失败：用户 ${record.userId} 冻结余额不足`)
    }

    db.update(schema.usageRecords)
      .set({
        status: USAGE_STATUS.REFUNDED,
        refundedAt: ts,
        updatedAt: ts,
        errorMsg: errorMsg || record.errorMsg,
      })
      .where(eq(schema.usageRecords.id, record.id))
      .run()

    const wallet = readWalletRow(record.userId)
    insertTransaction({
      userId: record.userId,
      usageRecordId: record.id,
      type: 'refund',
      points: record.points,
      availableAfter: wallet.availablePoints,
      frozenAfter: wallet.frozenPoints,
      remark: errorMsg ? `${record.taskType} 退款：${errorMsg}` : `${record.taskType} 退款`,
      createdAt: ts,
    })

    const [updated] = db.select().from(schema.usageRecords)
      .where(eq(schema.usageRecords.id, record.id))
      .all()
    return updated
  })()
}

export function settleTaskByRef(refType: string, refId: number): UsageRecord | null {
  const record = latestByRef(refType, refId)
  if (!record) return null
  return settleTask(record.id)
}

export function refundTaskByRef(refType: string, refId: number, errorMsg?: string): UsageRecord | null {
  const record = latestByRef(refType, refId)
  if (!record) return null
  return refundTask(record.id, errorMsg)
}

export function adjustWallet(params: {
  userId: number
  delta: number
  remark: string
  operatorId: number
}): WalletAccount {
  const delta = Math.trunc(Number(params.delta))
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('调整点数必须是非零整数')
  }
  const remark = String(params.remark || '').trim()
  if (!remark) throw new Error('调整原因必填')

  return sqlite.transaction(() => {
    ensureWallet(params.userId)
    const ts = now()
    if (delta > 0) {
      sqlite.prepare(`
        UPDATE wallet_accounts
        SET available_points = available_points + ?,
            updated_at = ?
        WHERE user_id = ?
      `).run(delta, ts, params.userId)
    } else {
      const amount = Math.abs(delta)
      const result = sqlite.prepare(`
        UPDATE wallet_accounts
        SET available_points = available_points - ?,
            updated_at = ?
        WHERE user_id = ? AND available_points >= ?
      `).run(amount, ts, params.userId, amount)
      if (result.changes !== 1) {
        const wallet = readWalletRow(params.userId)
        throw new Error(`扣减失败：可用余额 ${wallet.availablePoints} 点，不能扣成负数`)
      }
    }

    const wallet = readWalletRow(params.userId)
    insertTransaction({
      userId: params.userId,
      type: delta > 0 ? 'credit' : 'debit',
      points: Math.abs(delta),
      availableAfter: wallet.availablePoints,
      frozenAfter: wallet.frozenPoints,
      remark,
      operatorId: params.operatorId,
      createdAt: ts,
    })
    return wallet
  })()
}

function ageMs(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Date.now() - t
}

function recoverOne(record: UsageRecord): void {
  const refType = record.refType
  const refId = record.refId
  if (refType === 'image_generations' && refId) {
    const [row] = db.select().from(schema.imageGenerations).where(eq(schema.imageGenerations.id, refId)).all()
    if (!row || row.status === 'failed') {
      refundTask(record.id, row?.errorMsg || '任务不存在或已失败，回收冻结')
      return
    }
    if (row.status === 'completed') {
      settleTask(record.id)
      return
    }
    if (row.status === 'processing' && ageMs(record.createdAt) > STALE_ASYNC_MS) {
      refundTask(record.id, '图片任务超时未完成，回收冻结')
    }
    return
  }

  if (refType === 'video_generations' && refId) {
    const [row] = db.select().from(schema.videoGenerations).where(eq(schema.videoGenerations.id, refId)).all()
    if (!row || row.status === 'failed') {
      refundTask(record.id, row?.errorMsg || '任务不存在或已失败，回收冻结')
      return
    }
    if (row.status === 'completed') {
      settleTask(record.id)
      return
    }
    if (row.status === 'processing' && ageMs(record.createdAt) > STALE_ASYNC_MS) {
      refundTask(record.id, '视频任务超时未完成，回收冻结')
    }
    return
  }

  if (refType === 'video_merges' && refId) {
    const [row] = db.select().from(schema.videoMerges).where(eq(schema.videoMerges.id, refId)).all()
    if (!row || row.status === 'failed') {
      refundTask(record.id, row?.errorMsg || '拼接任务不存在或已失败，回收冻结')
      return
    }
    if (row.status === 'completed') {
      settleTask(record.id)
      return
    }
    if (row.status === 'processing' && ageMs(record.createdAt) > STALE_ASYNC_MS) {
      refundTask(record.id, '拼接任务超时未完成，回收冻结')
    }
    return
  }

  if (refType === 'storyboards_compose' && refId) {
    const [row] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, refId)).all()
    if (!row || row.status === 'compose_failed') {
      refundTask(record.id, '合成任务不存在或已失败，回收冻结')
      return
    }
    if (row.status === 'compose_completed') {
      settleTask(record.id)
      return
    }
    if (row.status === 'compose_processing' && ageMs(record.createdAt) > STALE_ASYNC_MS) {
      refundTask(record.id, '合成任务超时未完成，回收冻结')
    }
    return
  }

  const staleLimit = record.taskType === 'agent' || record.taskType === 'tts'
    ? STALE_SYNC_MS
    : STALE_ASYNC_MS
  if (ageMs(record.createdAt) > staleLimit) {
    refundTask(record.id, '服务中断，回收未完成冻结')
  }
}

/** 启动时扫描冻结单：业务已完成则结算，已失败/不存在/过期则退款 */
export function recoverStaleHolds(): { settled: number; refunded: number } {
  const frozen = db.select().from(schema.usageRecords)
    .where(eq(schema.usageRecords.status, USAGE_STATUS.FROZEN))
    .all()
  let settled = 0
  let refunded = 0
  for (const record of frozen) {
    const before = record.status
    try {
      recoverOne(record)
      const [after] = db.select().from(schema.usageRecords)
        .where(eq(schema.usageRecords.id, record.id))
        .all()
      if (after?.status === USAGE_STATUS.SETTLED && before !== USAGE_STATUS.SETTLED) settled += 1
      if (after?.status === USAGE_STATUS.REFUNDED && before !== USAGE_STATUS.REFUNDED) refunded += 1
    } catch (err) {
      console.warn('[billing] recover hold failed', record.id, err)
    }
  }
  return { settled, refunded }
}
