<template>
  <div class="page">
    <div class="page-head">
      <div class="head-left">
        <h1 class="page-title">管理后台</h1>
        <p class="page-desc">查看全站用户、项目、计费和脱敏后的 AI 配置。</p>
      </div>
    </div>

    <div class="filter-chips">
      <button type="button" :class="['chip', { active: tab === 'users' }]" @click="tab = 'users'">用户</button>
      <button type="button" :class="['chip', { active: tab === 'dramas' }]" @click="tab = 'dramas'">项目</button>
      <button type="button" :class="['chip', { active: tab === 'ai' }]" @click="tab = 'ai'">AI 配置</button>
      <button type="button" :class="['chip', { active: tab === 'billing' }]" @click="tab = 'billing'">余额与计费</button>
      <button type="button" :class="['chip', { active: tab === 'prices' }]" @click="tab = 'prices'">价格管理</button>
      <button type="button" :class="['chip', { active: tab === 'recharge-packages' }]" @click="tab = 'recharge-packages'">充值套餐</button>
      <button type="button" :class="['chip', { active: tab === 'recharge-orders' }]" @click="tab = 'recharge-orders'">充值订单</button>
    </div>

    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="page-desc">加载中…</p>

    <section v-else-if="tab === 'users'" class="admin-panel card">
      <div class="claim-row">
        <label class="field">
          <span class="field-label">认领无主数据到用户 ID</span>
          <input v-model="claimUserId" class="input" type="number" min="1" />
        </label>
        <button class="btn btn-primary" type="button" :disabled="claiming" @click="claimOrphans">
          {{ claiming ? '处理中…' : '认领无主数据' }}
        </button>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>邮箱验证</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <select class="input" :value="user.role" @change="patchUser(user, { role: $event.target.value })">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </td>
            <td>
              <select class="input" :value="user.status" @change="patchUser(user, { status: $event.target.value })">
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </td>
            <td>{{ user.email_verified_at ? '已验证' : '未验证' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-else-if="tab === 'dramas'" class="admin-panel card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>所有者</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="drama in dramas" :key="drama.id">
            <td>{{ drama.id }}</td>
            <td>{{ drama.title }}</td>
            <td>{{ drama.owner_username || '无主' }}</td>
            <td>{{ drama.deleted_at ? '已删除' : drama.status }}</td>
            <td>
              <button v-if="!drama.deleted_at" class="btn btn-ghost" type="button" @click="delDrama(drama)">软删</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-else-if="tab === 'ai'" class="admin-panel card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户</th>
            <th>类型</th>
            <th>厂商</th>
            <th>模型</th>
            <th>Base URL</th>
            <th>密钥</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="config in aiConfigs" :key="config.id">
            <td>{{ config.id }}</td>
            <td>{{ config.owner_username || config.user_id || '无主' }}</td>
            <td>{{ config.service_type }}</td>
            <td>{{ config.provider }}</td>
            <td>{{ config.model }}</td>
            <td class="url-cell">{{ config.base_url }}</td>
            <td>{{ config.has_api_key ? '已填写' : '未填' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-else-if="tab === 'billing'" class="admin-panel card">
      <form class="claim-row" @submit.prevent="adjustWallet">
        <label class="field">
          <span class="field-label">用户 ID</span>
          <input v-model="adjustForm.userId" class="input" type="number" min="1" required />
        </label>
        <label class="field">
          <span class="field-label">调整点数（正数充值，负数扣减）</span>
          <input v-model="adjustForm.delta" class="input" type="number" required />
        </label>
        <label class="field grow">
          <span class="field-label">原因</span>
          <input v-model="adjustForm.remark" class="input" required />
        </label>
        <button class="btn btn-primary" type="submit" :disabled="adjusting">
          {{ adjusting ? '提交中…' : '调整余额' }}
        </button>
      </form>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>可用</th>
              <th>冻结</th>
              <th>累计消耗</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in wallets" :key="row.user_id">
              <td>{{ row.username }} (#{{ row.user_id }})</td>
              <td>{{ row.available_points }}</td>
              <td>{{ row.frozen_points }}</td>
              <td>{{ row.total_consumed }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 class="sub-title">全站用量</h3>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>类型</th>
              <th>模型</th>
              <th>点数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in adminUsage" :key="row.id">
              <td>{{ formatTime(row.created_at) }}</td>
              <td>{{ row.username || row.user_id }}</td>
              <td>{{ row.task_type }}</td>
              <td>{{ row.provider }} / {{ row.model }}</td>
              <td>{{ row.points }}</td>
              <td>{{ row.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="tab === 'prices'" class="admin-panel card">
      <form class="claim-row" @submit.prevent="createPrice">
        <label class="field">
          <span class="field-label">任务类型</span>
          <select v-model="priceForm.task_type" class="input" required>
            <option value="agent">agent</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="tts">tts</option>
            <option value="compose">compose</option>
            <option value="merge">merge</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">服务商</span>
          <input v-model="priceForm.provider" class="input" required />
        </label>
        <label class="field grow">
          <span class="field-label">模型</span>
          <input v-model="priceForm.model" class="input" required />
        </label>
        <label class="field">
          <span class="field-label">单价（点）</span>
          <input v-model="priceForm.unit_points" class="input" type="number" min="0" required />
        </label>
        <button class="btn btn-primary" type="submit" :disabled="savingPrice">
          {{ savingPrice ? '保存中…' : '新增价格' }}
        </button>
      </form>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>服务商</th>
              <th>模型</th>
              <th>单价</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in prices" :key="row.id">
              <td>{{ row.task_type }}</td>
              <td>{{ row.provider }}</td>
              <td>{{ row.model }}</td>
              <td>
                <input
                  class="input"
                  type="number"
                  min="0"
                  :value="row.unit_points"
                  @change="patchPrice(row, { unit_points: Number($event.target.value) })"
                />
              </td>
              <td>
                <button class="btn btn-ghost" type="button" @click="patchPrice(row, { is_active: !row.is_active })">
                  {{ row.is_active ? '已启用' : '已停用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="tab === 'recharge-packages'" class="admin-panel card">
      <form class="claim-row" @submit.prevent="saveRechargePackage">
        <label class="field">
          <span class="field-label">套餐名称</span>
          <input v-model="packageForm.name" class="input" maxlength="40" required />
        </label>
        <label class="field">
          <span class="field-label">金额（元）</span>
          <input v-model="packageForm.priceYuan" class="input" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="field">
          <span class="field-label">基础点数</span>
          <input v-model="packageForm.basePoints" class="input" type="number" min="1" required />
        </label>
        <label class="field">
          <span class="field-label">赠送点数</span>
          <input v-model="packageForm.bonusPoints" class="input" type="number" min="0" required />
        </label>
        <label class="field">
          <span class="field-label">排序</span>
          <input v-model="packageForm.sortOrder" class="input" type="number" required />
        </label>
        <button class="btn btn-primary" type="submit" :disabled="savingPackage">
          {{ savingPackage ? '保存中…' : packageForm.id ? '保存修改' : '新增套餐' }}
        </button>
        <button v-if="packageForm.id" class="btn" type="button" @click="resetPackageForm">取消编辑</button>
      </form>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>排序</th>
              <th>名称</th>
              <th>金额</th>
              <th>基础点数</th>
              <th>赠送</th>
              <th>合计</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rechargePackages.length">
              <td colspan="8">暂无充值套餐</td>
            </tr>
            <tr v-for="item in rechargePackages" :key="item.id">
              <td>{{ item.sort_order }}</td>
              <td>{{ item.name }}</td>
              <td>¥ {{ formatMoney(item.price_cents) }}</td>
              <td>{{ item.base_points }}</td>
              <td>{{ item.bonus_points }}</td>
              <td>{{ item.total_points }}</td>
              <td>{{ item.is_active ? '已上架' : '已下架' }}</td>
              <td class="action-cell">
                <button class="btn btn-ghost" type="button" @click="editRechargePackage(item)">编辑</button>
                <button class="btn btn-ghost" type="button" @click="toggleRechargePackage(item)">
                  {{ item.is_active ? '下架' : '上架' }}
                </button>
                <button class="btn btn-ghost danger" type="button" @click="deleteRechargePackage(item)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="tab === 'recharge-orders'" class="admin-panel card">
      <div class="claim-row">
        <label class="field">
          <span class="field-label">订单状态</span>
          <select v-model="orderFilter.status" class="input">
            <option value="">全部</option>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="closed">已关闭</option>
            <option value="failed">创建失败</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">用户 ID</span>
          <input v-model="orderFilter.userId" class="input" type="number" min="1" />
        </label>
        <label class="field grow">
          <span class="field-label">订单号</span>
          <input v-model="orderFilter.orderNo" class="input" />
        </label>
        <button class="btn" type="button" @click="loadRechargeOrders">查询</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>创建时间</th>
              <th>订单号</th>
              <th>用户</th>
              <th>套餐</th>
              <th>金额</th>
              <th>点数</th>
              <th>状态</th>
              <th>支付宝交易号</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rechargeOrders.length">
              <td colspan="8">暂无充值订单</td>
            </tr>
            <tr v-for="order in rechargeOrders" :key="order.id">
              <td>{{ formatTime(order.created_at) }}</td>
              <td>{{ order.order_no }}</td>
              <td>{{ order.username || order.user_id }}</td>
              <td>{{ order.package_name }}</td>
              <td>¥ {{ formatMoney(order.amount_cents) }}</td>
              <td>{{ order.total_points }}</td>
              <td>{{ rechargeStatusLabel(order.status) }}</td>
              <td>{{ order.alipay_trade_no || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="btn btn-ghost" type="button" :disabled="orderPage <= 1" @click="orderPage -= 1">上一页</button>
        <span>第 {{ orderPage }} 页 / 共 {{ orderTotal }} 条</span>
        <button class="btn btn-ghost" type="button" :disabled="orderPage * 30 >= orderTotal" @click="orderPage += 1">下一页</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { adminAPI } from '~/composables/useApi'

const tab = ref('users')
const loading = ref(false)
const error = ref('')
const users = ref([])
const dramas = ref([])
const aiConfigs = ref([])
const claimUserId = ref('')
const claiming = ref(false)
const wallets = ref([])
const adminUsage = ref([])
const prices = ref([])
const adjusting = ref(false)
const savingPrice = ref(false)
const adjustForm = reactive({ userId: '', delta: '', remark: '' })
const priceForm = reactive({
  task_type: 'image',
  provider: '',
  model: '',
  unit_points: 1,
})
const rechargePackages = ref([])
const rechargeOrders = ref([])
const savingPackage = ref(false)
const orderPage = ref(1)
const orderTotal = ref(0)
const packageForm = reactive({
  id: null,
  name: '',
  priceYuan: '',
  basePoints: '',
  bonusPoints: 0,
  sortOrder: 0,
})
const orderFilter = reactive({
  status: '',
  userId: '',
  orderNo: '',
})

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatMoney(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function rechargeStatusLabel(status) {
  return {
    pending: '待支付',
    paid: '已支付',
    closed: '已关闭',
    failed: '创建失败',
  }[status] || status
}

function resetPackageForm() {
  packageForm.id = null
  packageForm.name = ''
  packageForm.priceYuan = ''
  packageForm.basePoints = ''
  packageForm.bonusPoints = 0
  packageForm.sortOrder = 0
}

function editRechargePackage(item) {
  packageForm.id = item.id
  packageForm.name = item.name
  packageForm.priceYuan = formatMoney(item.price_cents)
  packageForm.basePoints = item.base_points
  packageForm.bonusPoints = item.bonus_points
  packageForm.sortOrder = item.sort_order
}

async function loadRechargeOrders() {
  try {
    const result = await adminAPI.rechargeOrders({
      page: orderPage.value,
      page_size: 30,
      status: orderFilter.status || undefined,
      user_id: orderFilter.userId || undefined,
      order_no: orderFilter.orderNo || undefined,
    })
    rechargeOrders.value = result.items
    orderTotal.value = result.total
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载充值订单失败')
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (tab.value === 'users') users.value = await adminAPI.users()
    if (tab.value === 'dramas') dramas.value = await adminAPI.dramas()
    if (tab.value === 'ai') aiConfigs.value = await adminAPI.aiConfigs()
    if (tab.value === 'billing') {
      wallets.value = await adminAPI.wallets()
      const usage = await adminAPI.usage({ page: 1, page_size: 50 })
      adminUsage.value = usage.items || []
    }
    if (tab.value === 'prices') prices.value = await adminAPI.prices()
    if (tab.value === 'recharge-packages') rechargePackages.value = await adminAPI.rechargePackages()
    if (tab.value === 'recharge-orders') await loadRechargeOrders()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function patchUser(user, payload) {
  try {
    const updated = await adminAPI.patchUser(user.id, payload)
    users.value = users.value.map(item => item.id === user.id ? updated : item)
    toast.success('已更新')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '更新失败')
    load()
  }
}

async function delDrama(drama) {
  if (!confirm(`软删项目「${drama.title}」？`)) return
  try {
    await adminAPI.delDrama(drama.id)
    toast.success('已删除')
    load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '删除失败')
  }
}

async function claimOrphans() {
  const userId = Number(claimUserId.value)
  if (!userId) {
    toast.error('请填写用户 ID')
    return
  }
  claiming.value = true
  try {
    const result = await adminAPI.claimOrphans(userId)
    toast.success(`已认领 ${JSON.stringify(result.claimed)}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '认领失败')
  } finally {
    claiming.value = false
  }
}

async function adjustWallet() {
  const userId = Number(adjustForm.userId)
  const delta = Number(adjustForm.delta)
  if (!userId || !Number.isInteger(delta) || delta === 0) {
    toast.error('请填写用户 ID 和非零整数点数')
    return
  }
  if (!adjustForm.remark.trim()) {
    toast.error('调整原因必填')
    return
  }
  adjusting.value = true
  try {
    await adminAPI.adjustWallet(userId, { delta, remark: adjustForm.remark.trim() })
    toast.success('余额已调整')
    adjustForm.delta = ''
    adjustForm.remark = ''
    load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '调整失败')
  } finally {
    adjusting.value = false
  }
}

async function createPrice() {
  savingPrice.value = true
  try {
    await adminAPI.createPrice({
      task_type: priceForm.task_type,
      provider: priceForm.provider.trim(),
      model: priceForm.model.trim(),
      unit_points: Number(priceForm.unit_points),
    })
    toast.success('价格已创建')
    priceForm.provider = ''
    priceForm.model = ''
    priceForm.unit_points = 1
    load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '创建失败')
  } finally {
    savingPrice.value = false
  }
}

async function patchPrice(row, payload) {
  try {
    await adminAPI.patchPrice(row.id, payload)
    toast.success('价格已更新')
    load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '更新失败')
  }
}

async function saveRechargePackage() {
  const priceCents = Math.round(Number(packageForm.priceYuan) * 100)
  const basePoints = Number(packageForm.basePoints)
  const bonusPoints = Number(packageForm.bonusPoints)
  const sortOrder = Number(packageForm.sortOrder)
  if (!packageForm.name.trim() || !Number.isInteger(priceCents) || priceCents < 1) {
    toast.error('请填写正确的套餐名称和金额')
    return
  }
  if (!Number.isInteger(basePoints) || basePoints < 1 || !Number.isInteger(bonusPoints) || bonusPoints < 0) {
    toast.error('基础点数必须为正整数，赠送点数必须为非负整数')
    return
  }

  savingPackage.value = true
  const payload = {
    name: packageForm.name.trim(),
    price_cents: priceCents,
    base_points: basePoints,
    bonus_points: bonusPoints,
    sort_order: sortOrder,
  }
  try {
    if (packageForm.id) {
      await adminAPI.patchRechargePackage(packageForm.id, payload)
    } else {
      await adminAPI.createRechargePackage(payload)
    }
    toast.success(packageForm.id ? '套餐已更新' : '套餐已创建')
    resetPackageForm()
    rechargePackages.value = await adminAPI.rechargePackages()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存套餐失败')
  } finally {
    savingPackage.value = false
  }
}

async function toggleRechargePackage(item) {
  try {
    await adminAPI.patchRechargePackage(item.id, { is_active: !item.is_active })
    rechargePackages.value = await adminAPI.rechargePackages()
    toast.success(item.is_active ? '套餐已下架' : '套餐已上架')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '更新套餐失败')
  }
}

async function deleteRechargePackage(item) {
  if (!confirm(`删除充值套餐「${item.name}」？已有订单时将改为下架。`)) return
  try {
    await adminAPI.deleteRechargePackage(item.id)
    rechargePackages.value = await adminAPI.rechargePackages()
    if (packageForm.id === item.id) resetPackageForm()
    toast.success('套餐已删除或下架')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '删除套餐失败')
  }
}

watch(tab, load)
watch(orderPage, () => {
  if (tab.value === 'recharge-orders') loadRechargeOrders()
})
onMounted(load)
</script>

<style scoped>
.page {
  padding: 28px 48px 40px;
  overflow-y: auto;
  height: 100%;
}
.page-head { margin-bottom: 20px; }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.page-desc { font-size: 13px; color: var(--text-3); }
.filter-chips { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--border);
  background: var(--bg-0);
  color: var(--text-2);
  border-radius: 99px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.chip.active { background: var(--accent-bg); color: var(--accent-text); }
.admin-panel { padding: 16px; overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th, .admin-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.url-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.claim-row { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; }
.auth-error { color: var(--error); }
.input { min-width: 120px; }
.grow { flex: 1; min-width: 180px; }
.sub-title { font-size: 14px; font-weight: 650; margin: 20px 0 10px; }
.table-wrap { overflow-x: auto; }
.action-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.danger { color: var(--error); }
.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  color: var(--text-2);
  font-size: 13px;
}
</style>
