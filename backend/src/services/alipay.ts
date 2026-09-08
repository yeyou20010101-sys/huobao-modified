/**
 * 支付宝当面付服务：预创建二维码、查单、关单和异步通知验签。
 */
import { AlipaySdk, type AlipaySdkCommonResult } from 'alipay-sdk'
import { and, eq, lte } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { creditRechargeOrder, type RechargeOrder } from './billing.js'
import { getAppConfig, isAlipayConfigured } from '../utils/app-config.js'
import { now } from '../utils/response.js'

const PAID_TRADE_STATUSES = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED'])

export interface AlipayNotification {
  app_id?: string
  seller_id?: string
  out_trade_no?: string
  trade_no?: string
  trade_status?: string
  total_amount?: string
  notify_time?: string
  sign?: string
  sign_type?: string
  [key: string]: string | undefined
}

let cachedClient: AlipaySdk | null = null

function requireAlipayConfig() {
  if (!isAlipayConfigured()) {
    throw new Error('支付宝支付未配置，请设置 ALIPAY_APP_ID、私钥、公钥、SELLER_ID 和 NOTIFY_URL')
  }
  const config = getAppConfig().alipay
  let notifyUrl: URL
  try {
    notifyUrl = new URL(config.notifyUrl)
  } catch {
    throw new Error('ALIPAY_NOTIFY_URL 不是有效的网址')
  }
  if (notifyUrl.protocol !== 'https:') {
    throw new Error('正式支付宝通知地址必须使用 HTTPS')
  }
  return config
}

function client(): AlipaySdk {
  if (cachedClient) return cachedClient
  const config = requireAlipayConfig()
  cachedClient = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    gateway: config.gateway,
    signType: 'RSA2',
    keyType: config.keyType,
    timeout: 10_000,
    camelcase: true,
  })
  return cachedClient
}

function assertSuccess(result: AlipaySdkCommonResult, operation: string): void {
  if (result.code !== '10000') {
    const detail = String(result.sub_msg || result.msg || '支付宝接口失败')
    throw new Error(`${operation}失败：${detail}`)
  }
}

function amountText(cents: number): string {
  return (cents / 100).toFixed(2)
}

function amountCents(value: string | number | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [yuan, decimal = ''] = raw.split('.')
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0'))
}

function paidTradeStatus(value: unknown): boolean {
  return PAID_TRADE_STATUSES.has(String(value || ''))
}

function markOrderClosed(orderId: number, message?: string): RechargeOrder {
  const ts = now()
  db.update(schema.rechargeOrders)
    .set({
      status: 'closed',
      closedAt: ts,
      updatedAt: ts,
      errorMsg: message || null,
    })
    .where(and(
      eq(schema.rechargeOrders.id, orderId),
      eq(schema.rechargeOrders.status, 'pending'),
    ))
    .run()
  const [order] = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.id, orderId))
    .all()
  if (!order) throw new Error('充值订单不存在')
  return order
}

export function alipayPaymentReady(): boolean {
  try {
    requireAlipayConfig()
    return true
  } catch {
    return false
  }
}

export async function precreateAlipayTrade(order: RechargeOrder): Promise<string> {
  const config = requireAlipayConfig()
  const result = await client().exec('alipay.trade.precreate', {
    notifyUrl: config.notifyUrl,
    bizContent: {
      outTradeNo: order.orderNo,
      totalAmount: amountText(order.amountCents),
      subject: `鲸鱼短剧-${order.packageName}`,
      body: `${order.totalPoints} 点充值`,
      timeoutExpress: '15m',
    },
  })
  assertSuccess(result, '创建支付宝订单')
  const qrCode = String(result.qrCode || '')
  if (!qrCode) throw new Error('支付宝未返回付款二维码')
  return qrCode
}

export async function queryAlipayTrade(orderNo: string): Promise<AlipaySdkCommonResult> {
  const result = await client().exec('alipay.trade.query', {
    bizContent: { outTradeNo: orderNo },
  })
  const notExist = result.sub_code === 'ACQ.TRADE_NOT_EXIST'
  if (result.code !== '10000' && !notExist) {
    assertSuccess(result, '查询支付宝订单')
  }
  return result
}

export async function closeAlipayTrade(orderNo: string): Promise<void> {
  const result = await client().exec('alipay.trade.close', {
    bizContent: { outTradeNo: orderNo },
  })
  const alreadyClosed = result.sub_code === 'ACQ.TRADE_STATUS_ERROR'
  const notExist = result.sub_code === 'ACQ.TRADE_NOT_EXIST'
  if (result.code !== '10000' && !alreadyClosed && !notExist) {
    assertSuccess(result, '关闭支付宝订单')
  }
}

/**
 * 主动查单并同步本地状态，供用户轮询和超时回收共同使用。
 */
export async function reconcileRechargeOrder(order: RechargeOrder): Promise<RechargeOrder> {
  if (order.status !== 'pending') return order
  const result = await queryAlipayTrade(order.orderNo)

  if (paidTradeStatus(result.tradeStatus)) {
    if (String(result.outTradeNo || '') !== order.orderNo) {
      throw new Error('支付宝订单号不匹配')
    }
    if (amountCents(result.totalAmount) !== order.amountCents) {
      throw new Error('支付宝订单金额不匹配')
    }
    const tradeNo = String(result.tradeNo || '')
    if (!tradeNo) throw new Error('支付宝交易号缺失')
    return creditRechargeOrder(order.id, tradeNo)
  }

  if (result.tradeStatus === 'TRADE_CLOSED') {
    return markOrderClosed(order.id, '支付宝交易已关闭')
  }

  if (Date.parse(order.expiresAt) <= Date.now()) {
    await closeAlipayTrade(order.orderNo)
    return markOrderClosed(order.id, '支付二维码已过期')
  }
  return order
}

/**
 * 验证支付宝异步通知并到账。任何字段不匹配都拒绝。
 */
export function handleAlipayNotification(params: AlipayNotification): RechargeOrder {
  const config = requireAlipayConfig()
  if (!client().checkNotifySignV2(params)) {
    throw new Error('支付宝通知验签失败')
  }
  if (params.app_id !== config.appId) throw new Error('支付宝通知 app_id 不匹配')
  if (params.seller_id !== config.sellerId) throw new Error('支付宝通知 seller_id 不匹配')
  if (!paidTradeStatus(params.trade_status)) {
    throw new Error(`支付宝交易状态未成功：${params.trade_status || 'unknown'}`)
  }

  const orderNo = String(params.out_trade_no || '')
  const tradeNo = String(params.trade_no || '')
  if (!orderNo || !tradeNo) throw new Error('支付宝通知缺少订单号')

  const [order] = db.select().from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.orderNo, orderNo))
    .all()
  if (!order) throw new Error('充值订单不存在')
  if (amountCents(params.total_amount) !== order.amountCents) {
    throw new Error('支付宝通知金额不匹配')
  }
  if (order.alipayTradeNo && order.alipayTradeNo !== tradeNo) {
    throw new Error('支付宝交易号不匹配')
  }

  return creditRechargeOrder(order.id, tradeNo, params.notify_time || now())
}

/**
 * 启动时回收超时待支付订单。逐笔查询，避免漏通知的已付款订单被错误关闭。
 */
export async function closeExpiredRechargeOrders(): Promise<{ paid: number; closed: number; failed: number }> {
  if (!alipayPaymentReady()) return { paid: 0, closed: 0, failed: 0 }
  const expired = db.select().from(schema.rechargeOrders)
    .where(and(
      eq(schema.rechargeOrders.status, 'pending'),
      lte(schema.rechargeOrders.expiresAt, now()),
    ))
    .all()
  const result = { paid: 0, closed: 0, failed: 0 }
  for (const order of expired) {
    try {
      const updated = await reconcileRechargeOrder(order)
      if (updated.status === 'paid') result.paid += 1
      if (updated.status === 'closed') result.closed += 1
    } catch (err) {
      result.failed += 1
      console.warn('[alipay] 关闭超时订单失败', order.orderNo, err instanceof Error ? err.message : err)
    }
  }
  return result
}
