export interface AuthUser {
  id: number
  username: string
  email: string
  role: string
  status: string
  emailVerifiedAt?: string | null
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loaded = useState('auth-loaded', () => false)
  const loading = ref(false)
  const error = ref('')

  const emailVerified = computed(() => Boolean(user.value?.emailVerifiedAt))

  async function fetchMe() {
    loading.value = true
    try {
      const resp = await fetch('/api/v1/auth/me', { credentials: 'include' })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || (json.code && json.code >= 400)) {
        user.value = null
        return null
      }
      user.value = json.data ?? json
      return user.value
    } catch {
      user.value = null
      return null
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  async function register(payload: { username: string; email: string; password: string }) {
    loading.value = true
    error.value = ''
    try {
      const data = await authRequest('/auth/register', payload)
      user.value = data
      loaded.value = true
      return data
    } catch (err: any) {
      error.value = err.message || '注册失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function login(payload: { identifier: string; password: string }) {
    loading.value = true
    error.value = ''
    try {
      const data = await authRequest('/auth/login', payload)
      user.value = data
      loaded.value = true
      return data
    } catch (err: any) {
      error.value = err.message || '登录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      user.value = null
      await navigateTo('/login')
    }
  }

  async function changePassword(payload: { old_password: string; new_password: string }) {
    loading.value = true
    error.value = ''
    try {
      const data = await authRequest('/auth/change-password', payload)
      user.value = data
      return data
    } catch (err: any) {
      error.value = err.message || '修改密码失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function sendVerification() {
    loading.value = true
    error.value = ''
    try {
      await authRequest('/auth/send-verification', {})
      await fetchMe()
    } catch (err: any) {
      error.value = err.message || '发送失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function clearUser() {
    user.value = null
  }

  return { user, loaded, loading, error, emailVerified, fetchMe, register, login, logout, changePassword, sendVerification, clearUser }
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const resp = await fetch(`/api/v1${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok || (json.code && json.code >= 400)) {
    throw new Error(json.message || `${resp.status}`)
  }
  return json.data ?? json
}
