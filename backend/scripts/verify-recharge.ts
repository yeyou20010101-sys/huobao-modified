/**
 * 本地充值安全验证：签名、金额、商户、幂等到账和套餐快照。
 */
import { createSign, generateKeyPairSync } from 'crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.ALIPAY_APP_ID = 'verify-app-id'
process.env.ALIPAY_SELLER_ID = 'verify-seller-id'
process.env.ALIPAY_NOTIFY_URL = 'https://example.com/webhooks/alipay'
process.env.ALIPAY_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
process.env.ALIPAY_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString()
process.env.ALIPAY_KEY_TYPE = 'PKCS8'

const { eq } = await import('drizzle-orm')
const { db, schema } = await import('../src/db/index.js')
const { now } = await import('../src/utils/response.js')
const { ensureWallet, getWallet } = await import('../src/services/billing.js')
const { handleAlipayNotification } = await import('../src/services/alipay.js')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function signedNotification(params: Record<string, string>) {
  const signContent = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  const signer = createSign('RSA-SHA256')
  signer.update(signContent, 'utf8')
  return {
    ...params,
    sign: signer.sign(privateKey, 'base64'),
  }
}

const stamp = Date.now()
const ts = now()
const userResult = db.insert(schema.users).values({
  username: `recharge_verify_${stamp}`,
  email: `recharge_verify_${stamp}@example.local`,
  passwordHash: 'verify-only',
  role: 'user',
  status: 'active',
  createdAt: ts,
  updatedAt: ts,
}).run()
const userId = Number(userResult.lastInsertRowid)
ensureWallet(userId)

const packageResult = db.insert(schema.rechargePackages).values({
  name: '验证套餐',
  priceCents: 1,
  basePoints: 10,
  bonusPoints: 2,
  sortOrder: 1,
  isActive: true,
  createdAt: ts,
  updatedAt: ts,
}).run()
const packageId = Number(packageResult.lastInsertRowid)

const orderResult = db.insert(schema.rechargeOrders).values({
  orderNo: `VERIFY${stamp}`,
  userId,
  packageId,
  packageName: '验证套餐',
  amountCents: 1,
  basePoints: 10,
  bonusPoints: 2,
  totalPoints: 12,
  status: 'pending',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  createdAt: ts,
  updatedAt: ts,
}).run()
const orderId = Number(orderResult.lastInsertRowid)

const baseParams = {
  app_id: process.env.ALIPAY_APP_ID,
  seller_id: process.env.ALIPAY_SELLER_ID,
  out_trade_no: `VERIFY${stamp}`,
  trade_no: `ALI${stamp}`,
  trade_status: 'TRADE_SUCCESS',
  total_amount: '0.01',
  notify_time: ts,
  sign_type: 'RSA2',
}

try {
  let rejected = false
  try {
    handleAlipayNotification({ ...baseParams, sign: 'tampered' })
  } catch {
    rejected = true
  }
  assert(rejected, '篡改签名必须被拒绝')

  rejected = false
  try {
    handleAlipayNotification(signedNotification({ ...baseParams, seller_id: 'wrong-seller' }))
  } catch {
    rejected = true
  }
  assert(rejected, '错误商户必须被拒绝')

  rejected = false
  try {
    handleAlipayNotification(signedNotification({ ...baseParams, total_amount: '0.02' }))
  } catch {
    rejected = true
  }
  assert(rejected, '错误金额必须被拒绝')

  db.update(schema.rechargePackages)
    .set({ priceCents: 9900, basePoints: 9999, updatedAt: now() })
    .where(eq(schema.rechargePackages.id, packageId))
    .run()

  const paid = handleAlipayNotification(signedNotification(baseParams))
  assert(paid.status === 'paid', '合法通知应将订单置为已支付')
  assert(paid.amountCents === 1 && paid.totalPoints === 12, '订单套餐快照不能随套餐修改')
  assert(getWallet(userId).availablePoints === 12, '支付后应到账 12 点')

  handleAlipayNotification(signedNotification(baseParams))
  assert(getWallet(userId).availablePoints === 12, '重复通知不能重复到账')

  const transactions = db.select().from(schema.walletTransactions)
    .where(eq(schema.walletTransactions.rechargeOrderId, orderId))
    .all()
  assert(transactions.length === 1, '同一充值订单只能产生一条充值流水')
  console.log('recharge verify passed')
} finally {
  db.delete(schema.walletTransactions).where(eq(schema.walletTransactions.userId, userId)).run()
  db.delete(schema.rechargeOrders).where(eq(schema.rechargeOrders.id, orderId)).run()
  db.delete(schema.rechargePackages).where(eq(schema.rechargePackages.id, packageId)).run()
  db.delete(schema.walletAccounts).where(eq(schema.walletAccounts.userId, userId)).run()
  db.delete(schema.users).where(eq(schema.users.id, userId)).run()
}
