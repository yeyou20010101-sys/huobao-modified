<template>
  <div class="page">
    <div class="page-head">
      <div class="head-left">
        <h1 class="page-title">用量与余额</h1>
        <p class="page-desc">查看可用点数、冻结中的任务和历史消耗。</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-primary" type="button" @click="scrollToRecharge">充值</button>
        <button class="btn" type="button" :disabled="loading" @click="reload">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

    <section class="stat-grid">
      <article class="card stat-card">
        <h2 class="stat-label">可用余额</h2>
        <p class="stat-value">{{ availablePoints }} <span>点</span></p>
      </article>
      <article class="card stat-card">
        <h2 class="stat-label">冻结中</h2>
        <p class="stat-value">{{ frozenPoints }} <span>点</span></p>
      </article>
      <article class="card stat-card">
        <h2 class="stat-label">累计消耗</h2>
        <p class="stat-value">{{ totalConsumed }} <span>点</span></p>
      </article>
    </section>

    <section ref="rechargeSection" class="card panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">支付宝充值</h2>
          <p class="panel-desc">选择固定套餐后，使用支付宝扫描二维码完成支付。</p>
        </div>
      </div>
      <p v-if="!paymentReady" class="payment-warning" role="status">
        支付宝支付暂未配置，请联系管理员。
      </p>
      <div v-else-if="!rechargePackages.length" class="empty-card">暂无可用充值套餐</div>
      <div v-else class="package-grid">
        <article v-for="item in rechargePackages" :key="item.id" class="package-card">
          <h3>{{ item.name }}</h3>
          <p class="package-points">{{ item.total_points }} <span>点</span></p>
          <p v-if="item.bonus_points" class="package-bonus">
            含赠送 {{ item.bonus_points }} 点
          </p>
          <p class="package-price">¥ {{ formatMoney(item.price_cents) }}</p>
          <button
            class="btn btn-primary package-button"
            type="button"
            :disabled="creatingPackageId !== null"
            @click="createRechargeOrder(item)"
          >
            {{ creatingPackageId === item.id ? '创建订单中…' : '立即充值' }}
          </button>
        </article>
      </div>
    </section>

    <section class="card panel">
      <div class="panel-head">
        <h2 class="panel-title">充值订单</h2>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>创建时间</th>
              <th>订单号</th>
              <th>套餐</th>
              <th>金额</th>
              <th>到账点数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rechargeOrders.length">
              <td colspan="6" class="empty">暂无充值订单</td>
            </tr>
            <tr v-for="order in rechargeOrders" :key="order.id">
              <td>{{ formatTime(order.created_at) }}</td>
              <td>{{ order.order_no }}</td>
              <td>{{ order.package_name }}</td>
              <td>¥ {{ formatMoney(order.amount_cents) }}</td>
              <td>{{ order.total_points }}</td>
              <td>{{ rechargeStatusLabel(order.status) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card panel">
      <div class="panel-head">
        <h2 class="panel-title">用量明细</h2>
      </div>
      <div class="filter-row">
        <label class="field">
          <span class="field-label">任务类型</span>
          <select v-model="usageFilter.task_type" class="input">
            <option value="">全部</option>
            <option v-for="item in taskTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">状态</span>
          <select v-model="usageFilter.status" class="input">
            <option value="">全部</option>
            <option value="frozen">冻结中</option>
            <option value="settled">已结算</option>
            <option value="refunded">已退款</option>
            <option value="waived">管理员免扣</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">开始时间</span>
          <input v-model="usageFilter.from" class="input" type="datetime-local" />
        </label>
        <label class="field">
          <span class="field-label">结束时间</span>
          <input v-model="usageFilter.to" class="input" type="datetime-local" />
        </label>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>服务商 / 模型</th>
              <th>项目</th>
              <th>点数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!usageItems.length">
              <td colspan="6" class="empty">暂无用量记录</td>
            </tr>
            <tr v-for="row in usageItems" :key="row.id">
              <td>{{ formatTime(row.created_at) }}</td>
              <td>{{ taskLabel(row.task_type) }}</td>
              <td>{{ row.provider }} / {{ row.model }}</td>
              <td>{{ row.drama_id || '—' }}</td>
              <td>{{ row.points }}</td>
              <td>{{ statusLabel(row.status) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="btn btn-ghost" type="button" :disabled="usagePage <= 1" @click="usagePage -= 1">上一页</button>
        <span>第 {{ usagePage }} 页 / 共 {{ usageTotal }} 条</span>
        <button class="btn btn-ghost" type="button" :disabled="usagePage * pageSize >= usageTotal" @click="usagePage += 1">下一页</button>
      </div>
    </section>

    <section class="card panel">
      <div class="panel-head">
        <h2 class="panel-title">余额流水</h2>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>点数</th>
              <th>可用 / 冻结</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!txItems.length">
              <td colspan="5" class="empty">暂无流水</td>
            </tr>
            <tr v-for="row in txItems" :key="row.id">
              <td>{{ formatTime(row.created_at) }}</td>
              <td>{{ txLabel(row.type) }}</td>
              <td>{{ row.points }}</td>
              <td>{{ row.available_after }} / {{ row.frozen_after }}</td>
              <td>{{ row.remark || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="btn btn-ghost" type="button" :disabled="txPage <= 1" @click="txPage -= 1">上一页</button>
        <span>第 {{ txPage }} 页 / 共 {{ txTotal }} 条</span>
        <button class="btn btn-ghost" type="button" :disabled="txPage * pageSize >= txTotal" @click="txPage += 1">下一页</button>
      </div>
    </section>

    <div v-if="activeOrder" class="payment-overlay" @click.self="closePayment">
      <section class="payment-dialog card" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <button class="payment-close" type="button" aria-label="关闭支付窗口" @click="closePayment">×</button>
        <h2 id="payment-title">支付宝扫码支付</h2>
        <p class="payment-summary">
          {{ activeOrder.package_name }} · ¥ {{ formatMoney(activeOrder.amount_cents) }} ·
          到账 {{ activeOrder.total_points }} 点
        </p>
        <div class="qr-frame">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="支付宝付款二维码" />
          <p v-else>二维码生成中…</p>
        </div>
        <p v-if="activeOrder.status === 'pending'" class="payment-countdown">
          二维码将在 {{ countdownText }} 后失效
        </p>
        <p v-else class="payment-result" role="status">
          {{ rechargeStatusLabel(activeOrder.status) }}
        </p>
        <p v-if="paymentError" class="auth-error" role="alert">{{ paymentError }}</p>
        <div class="payment-actions">
          <button class="btn btn-primary" type="button" :disabled="checkingOrder" @click="checkActiveOrder">
            {{ checkingOrder ? '查询中…' : '我已支付，立即查询' }}
          </button>
          <button class="btn" type="button" @click="closePayment">关闭</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { billingAPI, type RechargeOrder, type RechargePackage } from '~/composables/useApi'

interface UsageItem {
  id: number
  created_at: string
  task_type: string
  provider: string
  model: string
  drama_id?: number | null
  points: number
  status: string
}

interface TransactionItem {
  id: number
  created_at: string
  type: string
  points: number
  available_after: number
  frozen_after: number
  remark?: string | null
}

const { availablePoints, frozenPoints, totalConsumed, refresh } = useWallet()
const loading = ref(false)
const error = ref('')
const pageSize = 20

const taskTypes = [
  { value: 'agent', label: '文本 Agent' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'tts', label: '语音' },
  { value: 'compose', label: '镜头合成' },
  { value: 'merge', label: '全集合并' },
]

const usageFilter = reactive({
  task_type: '',
  status: '',
  from: '',
  to: '',
})
const usagePage = ref(1)
const usageTotal = ref(0)
const usageItems = ref<UsageItem[]>([])

const txPage = ref(1)
const txTotal = ref(0)
const txItems = ref<TransactionItem[]>([])

const paymentReady = ref(false)
const rechargePackages = ref<RechargePackage[]>([])
const rechargeOrders = ref<RechargeOrder[]>([])
const creatingPackageId = ref<number | null>(null)
const activeOrder = ref<RechargeOrder | null>(null)
const qrDataUrl = ref('')
const checkingOrder = ref(false)
const paymentError = ref('')
const rechargeSection = ref<HTMLElement | null>(null)
const currentTime = ref(Date.now())
let pollingTimer: ReturnType<typeof setInterval> | null = null
let pollingTick = 0

const countdownText = computed(() => {
  if (!activeOrder.value) return '00:00'
  const seconds = Math.max(0, Math.ceil((Date.parse(activeOrder.value.expires_at) - currentTime.value) / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
})

function taskLabel(type: string) {
  return taskTypes.find(item => item.value === type)?.label || type
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    frozen: '冻结中',
    settled: '已结算',
    refunded: '已退款',
    waived: '管理员免扣',
  }
  return map[status] || status
}

function txLabel(type: string) {
  const map: Record<string, string> = {
    credit: '充值',
    debit: '扣减',
    freeze: '冻结',
    settle: '结算',
    refund: '退款',
  }
  return map[type] || type
}

function rechargeStatusLabel(status: RechargeOrder['status']) {
  const map: Record<RechargeOrder['status'], string> = {
    pending: '待支付',
    paid: '支付成功，点数已到账',
    closed: '已关闭',
    failed: '创建失败',
  }
  return map[status]
}

function formatMoney(cents: number) {
  return (cents / 100).toFixed(2)
}

function toIso(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function scrollToRecharge() {
  rechargeSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function loadUsage() {
  const data = await billingAPI.usage({
    task_type: usageFilter.task_type || undefined,
    status: usageFilter.status || undefined,
    from: toIso(usageFilter.from),
    to: toIso(usageFilter.to),
    page: usagePage.value,
    page_size: pageSize,
  })
  usageItems.value = data.items || []
  usageTotal.value = data.total || 0
}

async function loadTx() {
  const data = await billingAPI.transactions({
    page: txPage.value,
    page_size: pageSize,
  })
  txItems.value = data.items || []
  txTotal.value = data.total || 0
}

async function loadRecharge() {
  const [packageResult, orderResult] = await Promise.all([
    billingAPI.rechargePackages(),
    billingAPI.rechargeOrders({ page: 1, page_size: 20 }),
  ])
  paymentReady.value = packageResult.payment_ready
  rechargePackages.value = packageResult.items
  rechargeOrders.value = orderResult.items
}

function stopPolling() {
  if (pollingTimer) clearInterval(pollingTimer)
  pollingTimer = null
  pollingTick = 0
}

function startPolling() {
  stopPolling()
  pollingTimer = setInterval(() => {
    currentTime.value = Date.now()
    pollingTick += 1
    if (pollingTick % 2 === 0 && activeOrder.value?.status === 'pending') {
      checkActiveOrder()
    }
  }, 1000)
}

async function createRechargeOrder(item: RechargePackage) {
  creatingPackageId.value = item.id
  paymentError.value = ''
  try {
    const order = await billingAPI.createRechargeOrder(item.id)
    activeOrder.value = order
    currentTime.value = Date.now()
    qrDataUrl.value = order.qr_code
      ? await QRCode.toDataURL(order.qr_code, { width: 260, margin: 1, errorCorrectionLevel: 'M' })
      : ''
    if (order.status === 'pending') startPolling()
    if (order.status === 'paid') {
      await Promise.all([refresh(), loadTx(), loadRecharge()])
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '创建充值订单失败'
  } finally {
    creatingPackageId.value = null
  }
}

async function checkActiveOrder() {
  if (!activeOrder.value || checkingOrder.value) return
  checkingOrder.value = true
  paymentError.value = ''
  try {
    const order = await billingAPI.rechargeOrder(activeOrder.value.order_no)
    activeOrder.value = order
    if (order.status !== 'pending') {
      stopPolling()
      await Promise.all([refresh(), loadTx(), loadRecharge()])
    }
  } catch (err) {
    paymentError.value = err instanceof Error ? err.message : '查询订单失败，请稍后重试'
  } finally {
    checkingOrder.value = false
  }
}

function closePayment() {
  stopPolling()
  activeOrder.value = null
  qrDataUrl.value = ''
  paymentError.value = ''
}

async function reload() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([refresh(), loadUsage(), loadTx(), loadRecharge()])
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch(usageFilter, () => {
  usagePage.value = 1
}, { deep: true })

watch([usagePage, usageFilter], loadUsage, { deep: true })
watch(txPage, loadTx)

onMounted(reload)
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.page {
  padding: 28px 48px 40px;
  overflow-y: auto;
  height: 100%;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.page-desc { font-size: 13px; color: var(--text-3); margin-top: 4px; }
.auth-error { color: var(--error); margin-bottom: 12px; }
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card { padding: 18px 20px; }
.stat-label { font-size: 13px; color: var(--text-3); font-weight: 500; }
.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-top: 8px;
  color: var(--text-0);
}
.stat-value span { font-size: 13px; font-weight: 500; color: var(--text-3); }
.panel { padding: 16px; margin-bottom: 16px; overflow-x: auto; }
.panel-title { font-size: 16px; font-weight: 650; margin-bottom: 12px; }
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.field { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.field-label { font-size: 12px; color: var(--text-3); }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.empty { color: var(--text-3); text-align: center; }
.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-2);
}
.head-actions, .payment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.panel-desc { color: var(--text-3); font-size: 13px; }
.payment-warning, .empty-card {
  padding: 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  background: var(--bg-2);
}
.package-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.package-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-2);
}
.package-card h3 { font-size: 14px; color: var(--text-1); }
.package-points {
  margin-top: 10px;
  font-size: 25px;
  font-weight: 700;
  color: var(--accent-text);
}
.package-points span { font-size: 12px; color: var(--text-3); }
.package-bonus { margin-top: 3px; font-size: 12px; color: var(--success); }
.package-price { margin: 12px 0; font-size: 16px; font-weight: 650; }
.package-button { margin-top: auto; width: 100%; }
.payment-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.68);
}
.payment-dialog {
  position: relative;
  width: min(420px, 100%);
  padding: 24px;
  text-align: center;
}
.payment-dialog h2 { font-size: 20px; }
.payment-close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 24px;
  cursor: pointer;
}
.payment-close:hover { color: var(--text-0); }
.payment-summary { margin-top: 8px; color: var(--text-2); font-size: 13px; }
.qr-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 280px;
  height: 280px;
  margin: 18px auto 10px;
  border-radius: 12px;
  background: #fff;
  color: #333;
}
.qr-frame img { width: 260px; height: 260px; }
.payment-countdown { color: var(--text-3); font-size: 13px; }
.payment-result { color: var(--success); font-weight: 650; }
.payment-actions { justify-content: center; margin-top: 18px; }
@media (max-width: 900px) {
  .page { padding: 20px 16px 32px; }
  .stat-grid { grid-template-columns: 1fr; }
  .page-head { align-items: stretch; }
  .head-actions { flex-shrink: 0; }
}
</style>
