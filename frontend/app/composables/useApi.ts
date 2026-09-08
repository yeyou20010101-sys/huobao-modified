const BASE = '/api/v1'

function toQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

async function req<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body) opts.body = JSON.stringify(body)

  const start = performance.now()
  console.log(`%c[API] %c${method} %c${path}`, 'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#ccc', body || '')

  try {
    const resp = await fetch(`${BASE}${path}`, opts)
    const json = await resp.json()
    const ms = Math.round(performance.now() - start)

    if (resp.status === 401) {
      handleUnauthorized()
      console.log(`%c[API] %c${method} ${path} %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', json.message || '')
      throw new Error(json.message || '未登录')
    }

    if (!resp.ok || (json.code && json.code >= 400)) {
      console.log(`%c[API] %c${method} ${path} %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', json.message || '')
      const err = new Error(json.message || `${resp.status}`) as Error & { errorCode?: string }
      if (json.error_code) err.errorCode = json.error_code
      throw err
    }

    console.log(`%c[API] %c${method} ${path} %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#66bb6a', 'color:#66bb6a;font-weight:bold', 'color:#888')
    return json.data ?? json
  } catch (err: any) {
    if (!err.message?.match(/^\d{3}$/)) {
      const ms = Math.round(performance.now() - start)
      console.log(`%c[API] %c${method} ${path} %cERROR %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', err.message)
    }
    throw err
  }
}

function handleUnauthorized() {
  if (!import.meta.client) return
  const path = window.location.pathname
  if (path === '/login' || path === '/register' || path === '/forgot-password' || path === '/reset-password' || path === '/verify-email') return
  try {
    useState('auth-user', () => null).value = null
  } catch {
    /* ignore */
  }
  const redirect = encodeURIComponent(path + window.location.search)
  navigateTo(`/login?redirect=${redirect}`)
}

export const api = {
  get: <T = any>(p: string) => req<T>('GET', p),
  post: <T = any>(p: string, b?: any) => req<T>('POST', p, b),
  put: <T = any>(p: string, b?: any) => req<T>('PUT', p, b),
  patch: <T = any>(p: string, b?: any) => req<T>('PATCH', p, b),
  del: <T = any>(p: string) => req<T>('DELETE', p),
}

const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_UPLOAD_VIDEO_BYTES = 20 * 1024 * 1024

/** 上传图片到本地 static，返回相对路径 */
export async function uploadImageFile(file: File, dramaId?: number): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('仅支持上传图片文件')
  }
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error('图片大小不能超过 10MB')
  }

  const form = new FormData()
  form.append('file', file)
  if (dramaId) form.append('drama_id', String(dramaId))
  const start = performance.now()
  console.log('%c[API] %cPOST %c/upload/image', 'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#ccc', file.name)

  const resp = await fetch(`${BASE}/upload/image`, { method: 'POST', body: form, credentials: 'include' })
  const json = await resp.json()
  const ms = Math.round(performance.now() - start)

  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error(json.message || '未登录')
  }

  if (!resp.ok || (json.code && json.code >= 400)) {
    console.log(`%c[API] %cPOST /upload/image %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', json.message || '')
    throw new Error(json.message || `${resp.status}`)
  }

  console.log(`%c[API] %cPOST /upload/image %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#66bb6a', 'color:#66bb6a;font-weight:bold', 'color:#888')
  const data = json.data ?? json
  const path = data.path || (data.url ? String(data.url).replace(/^\//, '') : '')
  if (!path) throw new Error('上传成功但未返回文件路径')
  return { url: data.url || `/${path}`, path }
}

/** 上传视频到本地 static，返回相对路径 */
export async function uploadVideoFile(file: File, dramaId?: number): Promise<{ url: string; path: string }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  if (!isVideo) {
    throw new Error('仅支持上传视频文件')
  }
  if (file.size > MAX_UPLOAD_VIDEO_BYTES) {
    throw new Error('视频大小不能超过 20MB')
  }

  const form = new FormData()
  form.append('file', file)
  if (dramaId) form.append('drama_id', String(dramaId))
  const start = performance.now()
  console.log('%c[API] %cPOST %c/upload/video', 'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#ccc', file.name)

  const resp = await fetch(`${BASE}/upload/video`, { method: 'POST', body: form, credentials: 'include' })
  const json = await resp.json()
  const ms = Math.round(performance.now() - start)

  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error(json.message || '未登录')
  }

  if (!resp.ok || (json.code && json.code >= 400)) {
    console.log(`%c[API] %cPOST /upload/video %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', json.message || '')
    throw new Error(json.message || `${resp.status}`)
  }

  console.log(`%c[API] %cPOST /upload/video %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#66bb6a', 'color:#66bb6a;font-weight:bold', 'color:#888')
  const data = json.data ?? json
  const path = data.path || (data.url ? String(data.url).replace(/^\//, '') : '')
  if (!path) throw new Error('上传成功但未返回文件路径')
  return { url: data.url || `/${path}`, path }
}

export const uploadAPI = {
  image: uploadImageFile,
  video: uploadVideoFile,
}

export const createAPI = {
  submit: (d: {
    prompt: string
    output_type: 'image' | 'video'
    config_id?: number
    assets: Array<{ path: string; kind: 'image' | 'video'; role: string }>
    duration?: number
    /** @deprecated 兼容旧单附件 */
    media_type?: 'image' | 'video'
    media_path?: string
  }) => api.post('/create/generate', d),
  get: (id: number) => api.get(`/create/generate/${id}`),
}

export const authAPI = {
  me: () => api.get('/auth/me'),
  register: (d: { username: string; email: string; password: string }) => api.post('/auth/register', d),
  login: (d: { identifier: string; password: string }) => api.post('/auth/login', d),
  logout: () => api.post('/auth/logout'),
  changePassword: (d: { old_password: string; new_password: string }) => api.post('/auth/change-password', d),
  forgotPassword: (d: { email: string }) => api.post('/auth/forgot-password', d),
  resetPassword: (d: { token: string; password: string }) => api.post('/auth/reset-password', d),
  verifyEmail: (d: { token: string }) => api.post('/auth/verify-email', d),
  sendVerification: () => api.post('/auth/send-verification', {}),
}

export const dramaAPI = {
  list: () => api.get<{ items: any[] }>('/dramas'),
  get: (id: number) => api.get(`/dramas/${id}`),
  create: (data: any) => api.post('/dramas', data),
  update: (id: number, data: any) => api.put(`/dramas/${id}`, data),
  del: (id: number) => api.del(`/dramas/${id}`),
  members: (id: number) => api.get(`/dramas/${id}/members`),
  inviteMember: (id: number, data: { identifier: string; role: string }) => api.post(`/dramas/${id}/members`, data),
  updateMember: (id: number, userId: number, data: { role: string }) => api.patch(`/dramas/${id}/members/${userId}`, data),
  removeMember: (id: number, userId: number) => api.del(`/dramas/${id}/members/${userId}`),
}

export interface RechargePackage {
  id: number
  name: string
  price_cents: number
  base_points: number
  bonus_points: number
  total_points: number
  sort_order: number
  is_active?: boolean
}

export interface RechargeOrder {
  id: number
  order_no: string
  package_id: number | null
  package_name: string
  amount_cents: number
  base_points: number
  bonus_points: number
  total_points: number
  status: 'pending' | 'paid' | 'closed' | 'failed'
  qr_code?: string | null
  expires_at: string
  paid_at?: string | null
  closed_at?: string | null
  error_msg?: string | null
  alipay_trade_no?: string | null
  created_at: string
  user_id?: number
  username?: string | null
  email?: string | null
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const adminAPI = {
  users: () => api.get('/admin/users'),
  patchUser: (id: number, data: { role?: string; status?: string }) => api.patch(`/admin/users/${id}`, data),
  dramas: () => api.get('/admin/dramas'),
  delDrama: (id: number) => api.del(`/admin/dramas/${id}`),
  aiConfigs: () => api.get('/admin/ai-configs'),
  claimOrphans: (userId: number) => api.post('/admin/claim-orphans', { user_id: userId }),
  wallets: (q?: string) => api.get(`/admin/wallets${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  wallet: (userId: number) => api.get(`/admin/wallets/${userId}`),
  adjustWallet: (userId: number, data: { delta: number; remark: string }) => api.post(`/admin/wallets/${userId}/adjust`, data),
  prices: () => api.get('/admin/prices'),
  createPrice: (data: Record<string, unknown>) => api.post('/admin/prices', data),
  patchPrice: (id: number, data: Record<string, unknown>) => api.patch(`/admin/prices/${id}`, data),
  usage: (params?: Record<string, string | number | undefined>) => api.get(`/admin/usage${toQuery(params)}`),
  transactions: (params?: Record<string, string | number | undefined>) => api.get(`/admin/transactions${toQuery(params)}`),
  rechargePackages: () => api.get<RechargePackage[]>('/admin/recharge-packages'),
  createRechargePackage: (data: Omit<RechargePackage, 'id' | 'total_points'>) => api.post<RechargePackage>('/admin/recharge-packages', data),
  patchRechargePackage: (id: number, data: Partial<Omit<RechargePackage, 'id' | 'total_points'>>) => api.patch<RechargePackage>(`/admin/recharge-packages/${id}`, data),
  deleteRechargePackage: (id: number) => api.del(`/admin/recharge-packages/${id}`),
  rechargeOrders: (params?: Record<string, string | number | undefined>) => api.get<PageResult<RechargeOrder>>(`/admin/recharge-orders${toQuery(params)}`),
  rechargeOrder: (orderNo: string) => api.get<RechargeOrder>(`/admin/recharge-orders/${encodeURIComponent(orderNo)}`),
}

export const billingAPI = {
  summary: () => api.get('/billing/summary'),
  usage: (params?: Record<string, string | number | undefined>) => api.get(`/billing/usage${toQuery(params)}`),
  transactions: (params?: Record<string, string | number | undefined>) => api.get(`/billing/transactions${toQuery(params)}`),
  rechargePackages: () => api.get<{ payment_ready: boolean; items: RechargePackage[] }>('/billing/recharge-packages'),
  createRechargeOrder: (packageId: number) => api.post<RechargeOrder>('/billing/recharge-orders', { package_id: packageId }),
  rechargeOrder: (orderNo: string) => api.get<RechargeOrder>(`/billing/recharge-orders/${encodeURIComponent(orderNo)}`),
  rechargeOrders: (params?: Record<string, string | number | undefined>) => api.get<PageResult<RechargeOrder>>(`/billing/recharge-orders${toQuery(params)}`),
}

export const episodeAPI = {
  create: (data: any) => api.post('/episodes', data),
  update: (id: number, data: any) => api.put(`/episodes/${id}`, data),
  del: (id: number) => api.del(`/episodes/${id}`),
  characters: (id: number) => api.get(`/episodes/${id}/characters`),
  scenes: (id: number) => api.get(`/episodes/${id}/scenes`),
  storyboards: (id: number) => api.get(`/episodes/${id}/storyboards`),
  pipelineStatus: (id: number) => api.get(`/episodes/${id}/pipeline-status`),
}

export const storyboardAPI = {
  create: (data: any) => api.post('/storyboards', data),
  update: (id: number, data: any) => api.put(`/storyboards/${id}`, data),
  generateTTS: (id: number) => api.post(`/storyboards/${id}/generate-tts`),
  del: (id: number) => api.del(`/storyboards/${id}`),
}

export const characterAPI = {
  create: (data: Record<string, unknown>) => api.post('/characters', data),
  update: (id: number, data: any) => api.put(`/characters/${id}`, data),
  voiceSample: (id: number, episodeId: number) => api.post(`/characters/${id}/generate-voice-sample`, { episode_id: episodeId }),
  generateImage: (id: number, episodeId: number) => api.post(`/characters/${id}/generate-image`, { episode_id: episodeId }),
  refineImage: (id: number, episodeId: number) => api.post(`/characters/${id}/refine-image`, { episode_id: episodeId }),
  batchImages: (ids: number[], episodeId: number) => api.post('/characters/batch-generate-images', { character_ids: ids, episode_id: episodeId }),
}

export const sceneAPI = {
  create: (data: Record<string, unknown>) => api.post('/scenes', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/scenes/${id}`, data),
  generateImage: (id: number, episodeId: number) => api.post(`/scenes/${id}/generate-image`, { episode_id: episodeId }),
  refineImage: (id: number, episodeId: number) => api.post(`/scenes/${id}/refine-image`, { episode_id: episodeId }),
}

export const imageAPI = {
  generate: (d: any) => api.post('/images', d),
  list: (params?: { drama_id?: number; storyboard_id?: number }) => {
    const query = new URLSearchParams()
    if (params?.drama_id) query.set('drama_id', String(params.drama_id))
    if (params?.storyboard_id) query.set('storyboard_id', String(params.storyboard_id))
    return api.get(`/images${query.size ? `?${query.toString()}` : ''}`)
  },
}
export const gridAPI = {
  prompt: (d: any) => api.post('/grid/prompt', d),
  generate: (d: any) => api.post('/grid/generate', d),
  status: (id: number) => api.get(`/grid/status/${id}`),
  split: (d: any) => api.post('/grid/split', d),
}
export const videoAPI = {
  generate: (d: any) => api.post('/videos', d),
  get: (id: number) => api.get(`/videos/${id}`),
}
export const composeAPI = {
  shot: (id: number) => api.post(`/compose/storyboards/${id}/compose`),
  all: (epId: number) => api.post(`/compose/episodes/${epId}/compose-all`),
  status: (epId: number) => api.get(`/compose/episodes/${epId}/compose-status`),
}
export const mergeAPI = {
  merge: (epId: number) => api.post(`/merge/episodes/${epId}/merge`),
  status: (epId: number) => api.get(`/merge/episodes/${epId}/merge`),
}
export const aiConfigAPI = {
  list: (t?: string) => api.get(`/ai-configs${t ? `?service_type=${t}` : ''}`),
  create: (d: any) => api.post('/ai-configs', d),
  update: (id: number, d: any) => api.put(`/ai-configs/${id}`, d),
  del: (id: number) => api.del(`/ai-configs/${id}`),
  test: (d: any) => api.post('/ai-configs/test', d),
  huobaoPreset: (payload: {
    ali_api_key: string
    volcengine_api_key: string
    minimax_api_key?: string
    api_key?: string
  }) => api.post('/ai-configs/huobao-preset', payload),
}

export const agentConfigAPI = {
  list: () => api.get('/agent-configs'),
  get: (id: number) => api.get(`/agent-configs/${id}`),
  create: (d: any) => api.post('/agent-configs', d),
  update: (id: number, d: any) => api.put(`/agent-configs/${id}`, d),
  del: (id: number) => api.del(`/agent-configs/${id}`),
}

export const skillsAPI = {
  list: () => api.get('/skills'),
  get: (id: string) => api.get(`/skills/${id}`),
  create: (data: { id: string; name: string; description?: string }) => api.post('/skills', data),
  update: (id: string, content: string) => api.put(`/skills/${id}`, { content }),
  del: (id: string) => api.del(`/skills/${id}`),
}

export const voicesAPI = {
  list: (provider?: string) => api.get(`/ai-voices${provider ? `?provider=${provider}` : ''}`),
  sync: (provider?: string) => api.post('/ai-voices/sync', provider ? { provider } : {}),
}
