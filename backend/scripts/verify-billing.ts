/**
 * 关键计费行为验证：缺价拦截、余额不足、冻结/结算/退款幂等、管理员免扣、价格快照。
 * 使用独立测试用户与测试价格，结束后清理。
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { now } from '../src/utils/response.js'
import { isBillingError } from '../src/utils/billing-error.js'
import {
  adjustWallet,
  beginTask,
  ensureWallet,
  getWallet,
  refundTask,
  settleTask,
} from '../src/services/billing.js'

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

async function main() {
  const ts = now()
  const username = `billing_verify_${Date.now()}`
  const email = `${username}@example.local`

  const userRes = db.insert(schema.users).values({
    username,
    email,
    passwordHash: 'verify-only',
    role: 'user',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const userId = Number(userRes.lastInsertRowid)
  ensureWallet(userId)

  const adminRes = db.insert(schema.users).values({
    username: `${username}_admin`,
    email: `${username}_admin@example.local`,
    passwordHash: 'verify-only',
    role: 'admin',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const adminId = Number(adminRes.lastInsertRowid)
  ensureWallet(adminId)

  const priceRes = db.insert(schema.billingPrices).values({
    taskType: 'image',
    provider: 'verify-provider',
    model: 'verify-model',
    unitPoints: 10,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  }).run()
  const priceId = Number(priceRes.lastInsertRowid)

  try {
    let missingCaught = false
    try {
      beginTask({
        userId,
        taskType: 'video',
        provider: 'missing-provider',
        model: 'missing-model',
        idempotencyKey: `verify-missing:${userId}`,
      })
    } catch (err) {
      missingCaught = isBillingError(err) && err.code === 'PRICE_MISSING'
    }
    assert(missingCaught, '缺少价格时应拦截')

    let lowBalance = false
    try {
      beginTask({
        userId,
        taskType: 'image',
        provider: 'verify-provider',
        model: 'verify-model',
        idempotencyKey: `verify-low:${userId}`,
      })
    } catch (err) {
      lowBalance = isBillingError(err) && err.code === 'BALANCE_INSUFFICIENT'
    }
    assert(lowBalance, '0 余额应拦截')

    const credited = adjustWallet({ userId, delta: 30, remark: '验证充值', operatorId: adminId })
    assert(credited.availablePoints === 30, '充值后可用应为 30')

    const frozen = beginTask({
      userId,
      taskType: 'image',
      provider: 'verify-provider',
      model: 'verify-model',
      idempotencyKey: `verify-freeze:${userId}`,
      refType: 'image_generations',
      refId: 1,
    })
    assert(frozen.status === 'frozen' && frozen.points === 10, '冻结应为 10 点')
    const afterFreeze = getWallet(userId)
    assert(afterFreeze.availablePoints === 20 && afterFreeze.frozenPoints === 10, '冻结后可用 20 / 冻结 10')

    const again = beginTask({
      userId,
      taskType: 'image',
      provider: 'verify-provider',
      model: 'verify-model',
      idempotencyKey: `verify-freeze:${userId}`,
    })
    assert(again.id === frozen.id, '同一幂等键不应重复冻结')
    assert(getWallet(userId).availablePoints === 20, '重复冻结不得再扣可用余额')

    settleTask(frozen.id)
    const settledWallet = getWallet(userId)
    assert(settledWallet.availablePoints === 20 && settledWallet.frozenPoints === 0 && settledWallet.totalConsumed === 10, '结算后累计消耗 10')
    settleTask(frozen.id)
    assert(getWallet(userId).totalConsumed === 10, '重复结算应幂等')

    const refundHold = beginTask({
      userId,
      taskType: 'image',
      provider: 'verify-provider',
      model: 'verify-model',
      idempotencyKey: `verify-refund:${userId}`,
    })
    refundTask(refundHold.id, '验证失败退款')
    const afterRefund = getWallet(userId)
    assert(afterRefund.availablePoints === 20 && afterRefund.frozenPoints === 0, '失败应全额退回')
    refundTask(refundHold.id, '重复退款')
    assert(getWallet(userId).availablePoints === 20, '重复退款应幂等')

    db.update(schema.billingPrices)
      .set({ unitPoints: 99, updatedAt: now() })
      .where(eq(schema.billingPrices.id, priceId))
      .run()
    const [snapshot] = db.select().from(schema.usageRecords).where(eq(schema.usageRecords.id, frozen.id)).all()
    assert(snapshot.unitPoints === 10 && snapshot.points === 10, '历史单价快照不随调价变化')

    const waived = beginTask({
      userId: adminId,
      taskType: 'image',
      provider: 'verify-provider',
      model: 'verify-model',
      idempotencyKey: `verify-waive:${adminId}`,
    })
    assert(waived.status === 'waived', '管理员应免扣')
    const adminWallet = getWallet(adminId)
    assert(adminWallet.availablePoints === 0 && adminWallet.frozenPoints === 0, '管理员钱包不应被扣')

    let debitBlocked = false
    try {
      adjustWallet({ userId, delta: -999, remark: '超额扣减', operatorId: adminId })
    } catch {
      debitBlocked = true
    }
    assert(debitBlocked, '管理员扣减不能变成负数')

    console.log('billing verify passed')
  } finally {
    db.delete(schema.walletTransactions).where(eq(schema.walletTransactions.userId, userId)).run()
    db.delete(schema.walletTransactions).where(eq(schema.walletTransactions.userId, adminId)).run()
    db.delete(schema.usageRecords).where(eq(schema.usageRecords.userId, userId)).run()
    db.delete(schema.usageRecords).where(eq(schema.usageRecords.userId, adminId)).run()
    db.delete(schema.walletAccounts).where(eq(schema.walletAccounts.userId, userId)).run()
    db.delete(schema.walletAccounts).where(eq(schema.walletAccounts.userId, adminId)).run()
    db.delete(schema.billingPrices).where(eq(schema.billingPrices.id, priceId)).run()
    db.delete(schema.users).where(eq(schema.users.id, userId)).run()
    db.delete(schema.users).where(eq(schema.users.id, adminId)).run()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
