import { billingAPI } from '~/composables/useApi'

export interface WalletSummary {
  available_points: number
  frozen_points: number
  total_consumed: number
  updated_at?: string
  recent?: {
    last_7d_tasks: number
    last_7d_consumed: number
  }
}

export function useWallet() {
  const summary = useState<WalletSummary | null>('wallet-summary', () => null)
  const loading = useState('wallet-loading', () => false)

  const availablePoints = computed(() => summary.value?.available_points ?? 0)
  const frozenPoints = computed(() => summary.value?.frozen_points ?? 0)
  const totalConsumed = computed(() => summary.value?.total_consumed ?? 0)

  async function refresh() {
    loading.value = true
    try {
      summary.value = await billingAPI.summary() as WalletSummary
    } catch {
      /* 未登录或接口失败时保持上次数据 */
    } finally {
      loading.value = false
    }
  }

  return {
    summary,
    loading,
    availablePoints,
    frozenPoints,
    totalConsumed,
    refresh,
  }
}
