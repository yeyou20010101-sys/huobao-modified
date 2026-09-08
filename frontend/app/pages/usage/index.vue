<template>
  <div class="page">
    <div class="page-head">
      <div class="head-left">
        <h1 class="page-title">用量与余额</h1>
        <p class="page-desc">查看可用点数、冻结中的任务和历史消耗。</p>
      </div>
      <button class="btn" type="button" :disabled="loading" @click="reload">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
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
  </div>
</template>

<script setup>
import { billingAPI } from '~/composables/useApi'

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
const usageItems = ref([])

const txPage = ref(1)
const txTotal = ref(0)
const txItems = ref([])

function taskLabel(type) {
  return taskTypes.find(item => item.value === type)?.label || type
}

function statusLabel(status) {
  const map = {
    frozen: '冻结中',
    settled: '已结算',
    refunded: '已退款',
    waived: '管理员免扣',
  }
  return map[status] || status
}

function txLabel(type) {
  const map = {
    credit: '充值',
    debit: '扣减',
    freeze: '冻结',
    settle: '结算',
    refund: '退款',
  }
  return map[type] || type
}

function toIso(value) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
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

async function reload() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([refresh(), loadUsage(), loadTx()])
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
@media (max-width: 900px) {
  .page { padding: 20px 16px 32px; }
  .stat-grid { grid-template-columns: 1fr; }
}
</style>
