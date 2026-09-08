import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, notFound, created, badRequest, now } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'
import { joinProviderUrl } from '../services/adapters/url.js'
import { redactUrl, logTaskError, logTaskProgress, logTaskSuccess } from '../utils/task-logger.js'
import { requireUser } from '../middleware/auth.js'
import { getOwnedAiConfig } from '../utils/ownership.js'

const app = new Hono()

const HUOBAO_PRESET_SERVICES = [
  {
    serviceType: 'text',
    label: '文本',
    provider: 'ali',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-plus-2026-04-02',
    priority: 100,
    apiKeySource: 'ali' as const,
  },
  {
    serviceType: 'image',
    label: '图片',
    provider: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    model: 'doubao-seedream-5-0-lite-260128',
    priority: 99,
    apiKeySource: 'volcengine' as const,
  },
  {
    serviceType: 'video',
    label: '视频',
    provider: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    model: 'doubao-seedance-2-0-fast-260128',
    priority: 98,
    apiKeySource: 'volcengine' as const,
  },
  {
    serviceType: 'audio',
    label: '音频(百炼)',
    provider: 'ali',
    baseUrl: 'https://dashscope.aliyuncs.com',
    model: 'cosyvoice-v3-flash',
    priority: 97,
    apiKeySource: 'ali' as const,
  },
  {
    serviceType: 'audio',
    label: '音频(MiniMax)',
    provider: 'minimax',
    baseUrl: 'https://api.chatfire.site/minimax',
    model: 'speech-2.8-hd',
    priority: 96,
    apiKeySource: 'optional' as const,
  },
] as const

const HUOBAO_AGENT_DEFAULTS = [
  { agentType: 'script_rewriter', name: '剧本改写' },
  { agentType: 'extractor', name: '角色场景提取' },
  { agentType: 'storyboard_breaker', name: '分镜拆解' },
  { agentType: 'voice_assigner', name: '音色分配' },
  { agentType: 'grid_prompt_generator', name: '图片提示词生成' },
] as const

const HUOBAO_AGENT_MODEL = 'qwen3.6-plus-2026-04-02'

function resolvePresetApiKey(
  body: Record<string, unknown>,
  source: 'ali' | 'volcengine' | 'optional',
): string {
  const legacyKey = String(body.api_key || '').trim()
  if (source === 'ali') {
    return String(body.ali_api_key || legacyKey || '').trim()
  }
  if (source === 'volcengine') {
    return String(body.volcengine_api_key || legacyKey || '').trim()
  }
  return String(body.minimax_api_key || body.audio_api_key || legacyKey || '').trim()
}

function bearerHeaders(apiKey?: string, withJson = false) {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (withJson) headers['Content-Type'] = 'application/json'
  return headers
}

function geminiHeaders(apiKey?: string, withJson = false) {
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
    headers['x-goog-api-key'] = apiKey
  }
  if (withJson) headers['Content-Type'] = 'application/json'
  return headers
}

function viduHeaders(apiKey?: string, withJson = false) {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Token ${apiKey}`
  if (withJson) headers['Content-Type'] = 'application/json'
  return headers
}

function buildProbe(serviceType: string, provider: string, baseUrl: string, model?: string, apiKey?: string) {
  const p = provider.toLowerCase()
  const m = model || ''

  if (p === 'gemini') {
    const url = new URL(joinProviderUrl(baseUrl, '/v1beta', `/models/${m || 'gemini-2.5-flash'}:generateContent`))
    if (apiKey) url.searchParams.set('key', apiKey)
    return { method: 'POST', url: url.toString(), headers: geminiHeaders(apiKey, true), body: {} }
  }

  if (p === 'openai' || p === 'openrouter' || p === 'chatfire') {
    return {
      method: 'GET',
      url: joinProviderUrl(baseUrl, '/v1', '/models'),
      headers: bearerHeaders(apiKey),
      body: undefined,
    }
  }

  if (p === 'ali') {
    if (serviceType === 'text' && baseUrl.includes('compatible-mode')) {
      return {
        method: 'GET',
        url: joinProviderUrl(baseUrl, '', '/models'),
        headers: bearerHeaders(apiKey),
        body: undefined,
      }
    }
    if (serviceType === 'audio') {
      const root = baseUrl.replace(/\/compatible-mode\/v1$/, '').replace(/\/$/, '') || 'https://dashscope.aliyuncs.com'
      return {
        method: 'POST',
        url: joinProviderUrl(root, '/api/v1', '/services/audio/tts/SpeechSynthesizer'),
        headers: bearerHeaders(apiKey, true),
        body: {
          model: m || 'cosyvoice-v3-flash',
          input: { text: '连接测试', voice: 'longanyang', format: 'mp3', sample_rate: 24000 },
        },
      }
    }
    return {
      method: 'POST',
      url: joinProviderUrl(baseUrl, '/api/v1', serviceType === 'video'
        ? '/services/aigc/video-generation/video-synthesis'
        : '/services/aigc/image-generation/generation'),
      headers: bearerHeaders(apiKey, true),
      body: {},
    }
  }

  if (p === 'volcengine') {
    if (serviceType === 'audio') {
      return {
        method: 'POST',
        url: 'https://openspeech.bytedance.com/api/v1/tts',
        headers: bearerHeaders(apiKey, true),
        body: {
          app: { appid: 'probe', token: apiKey || '', cluster: 'volcano_tts' },
          user: { uid: 'probe' },
          audio: { voice_type: 'zh_female_shuangkuaisisi_moon_bigtts', encoding: 'mp3', speed_ratio: 1 },
          request: { reqid: 'probe', text: '连接测试', operation: 'query' },
        },
      }
    }
    const path = serviceType === 'video'
      ? '/contents/generations/tasks'
      : '/images/generations'
    return {
      method: 'POST',
      url: joinProviderUrl(baseUrl, '/api/v3', path),
      headers: bearerHeaders(apiKey, true),
      body: {},
    }
  }

  if (p === 'minimax') {
    const path = serviceType === 'audio'
      ? '/t2a_v2'
      : serviceType === 'video'
        ? '/video_generation'
        : '/image_generation'
    return {
      method: 'POST',
      url: joinProviderUrl(baseUrl, '/v1', path),
      headers: bearerHeaders(apiKey, true),
      body: {},
    }
  }

  if (p === 'vidu') {
    return {
      method: 'POST',
      url: joinProviderUrl(baseUrl, '', '/ent/v2/img2video'),
      headers: viduHeaders(apiKey, true),
      body: {},
    }
  }

  return {
    method: 'GET',
    url: joinProviderUrl(baseUrl, '', m ? `/${m}` : '/'),
    headers: bearerHeaders(apiKey),
    body: undefined,
  }
}

// GET /ai-configs?service_type=text
app.get('/', async (c) => {
  const user = requireUser(c)
  const serviceType = c.req.query('service_type')
  let rows = db.select().from(schema.aiServiceConfigs).all().filter(r => r.userId === user.id)
  if (serviceType) rows = rows.filter(r => r.serviceType === serviceType)

  const parsed = rows.map(r => ({
    ...toSnakeCase(r),
    model: r.model ? JSON.parse(r.model) : [],
  }))
  return success(c, parsed)
})

// POST /ai-configs
app.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const ts = now()

  // 验证必填字段
  if (!body.service_type || !body.provider) {
    return badRequest(c, 'service_type and provider are required')
  }

  const res = db.insert(schema.aiServiceConfigs).values({
    userId: user.id,
    serviceType: body.service_type,
    provider: body.provider,
    name: body.name || `${body.provider}-${body.service_type}`,
    baseUrl: body.base_url || '',
    apiKey: body.api_key || '',
    model: JSON.stringify(body.model || []),
    settings: body.settings ? JSON.stringify(body.settings) : null,
    priority: body.priority || 0,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  }).run()

  const [row] = db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.id, Number(res.lastInsertRowid))).all()

  return created(c, {
    ...toSnakeCase(row),
    model: row.model ? JSON.parse(row.model) : [],
  })
})

// POST /ai-configs/huobao-preset
app.post('/huobao-preset', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json()
  const aliApiKey = resolvePresetApiKey(body, 'ali')
  const volcengineApiKey = resolvePresetApiKey(body, 'volcengine')
  if (!aliApiKey) return badRequest(c, 'ali_api_key is required for text service')
  if (!volcengineApiKey) return badRequest(c, 'volcengine_api_key is required for image/video services')

  const ts = now()

  for (const preset of HUOBAO_PRESET_SERVICES) {
    const apiKey = resolvePresetApiKey(body, preset.apiKeySource)
    if (!apiKey && preset.apiKeySource === 'optional') continue
    if (!apiKey) {
      return badRequest(c, `${preset.serviceType} service requires a valid API key`)
    }

    const [existing] = db.select().from(schema.aiServiceConfigs).all()
      .filter(row => row.userId === user.id && row.serviceType === preset.serviceType && row.provider === preset.provider)

    const values = {
      userId: user.id,
      serviceType: preset.serviceType,
      provider: preset.provider,
      name: `鲸鱼默认${preset.label}服务`,
      baseUrl: preset.baseUrl,
      apiKey,
      model: JSON.stringify([preset.model]),
      priority: preset.priority,
      isActive: true,
      updatedAt: ts,
    }

    if (existing) {
      db.update(schema.aiServiceConfigs).set(values).where(eq(schema.aiServiceConfigs.id, existing.id)).run()
    } else {
      db.insert(schema.aiServiceConfigs).values({
        ...values,
        createdAt: ts,
      }).run()
    }
  }

  for (const agent of HUOBAO_AGENT_DEFAULTS) {
    const [existing] = db.select().from(schema.agentConfigs).all()
      .filter(row => row.userId === user.id && row.agentType === agent.agentType)
    const values = {
      name: agent.name,
      model: HUOBAO_AGENT_MODEL,
      isActive: true,
      updatedAt: ts,
    }

    if (existing) {
      db.update(schema.agentConfigs).set(values).where(eq(schema.agentConfigs.id, existing.id)).run()
    } else {
      db.insert(schema.agentConfigs).values({
        userId: user.id,
        agentType: agent.agentType,
        description: '',
        model: HUOBAO_AGENT_MODEL,
        name: agent.name,
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
        maxIterations: 10,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      }).run()
    }
  }

  const configs = db.select().from(schema.aiServiceConfigs).all()
    .filter(row => row.userId === user.id)
    .map(row => ({
    ...toSnakeCase(row),
    model: row.model ? JSON.parse(row.model) : [],
  }))
  const agents = db.select().from(schema.agentConfigs).all()
    .filter(row => row.userId === user.id)
    .map(row => toSnakeCase(row))

  logTaskSuccess('AIConfig', 'huobao-preset-applied', {
    serviceCount: HUOBAO_PRESET_SERVICES.length,
    agentCount: HUOBAO_AGENT_DEFAULTS.length,
  })

  return success(c, {
    configs,
    agents,
    agent_model: HUOBAO_AGENT_MODEL,
  })
})

// POST /ai-configs/test
app.post('/test', async (c) => {
  const body = await c.req.json()
  if (!body.service_type || !body.provider || !body.base_url) {
    return badRequest(c, 'service_type, provider and base_url are required')
  }

  const model = Array.isArray(body.model) ? body.model[0] : body.model
  const probe = buildProbe(body.service_type, body.provider, body.base_url, model, body.api_key)
  const probeUrl = redactUrl(probe.url)

  logTaskProgress('AIConfig', 'probe-start', {
    serviceType: body.service_type,
    provider: body.provider,
    method: probe.method,
    url: probeUrl,
  })

  try {
    const resp = await fetch(probe.url, {
      method: probe.method,
      headers: probe.headers,
      body: probe.body ? JSON.stringify(probe.body) : undefined,
    })
    const text = await resp.text()
    const reachable = [200, 204, 400, 401, 403].includes(resp.status)
    const payload = {
      ok: resp.ok,
      reachable,
      status: resp.status,
      status_text: resp.statusText,
      method: probe.method,
      url: probeUrl,
      message: reachable
        ? (resp.ok ? '端点可访问，认证与路径基本正常' : '端点已响应，请根据状态码判断认证或路径是否正确')
        : '端点未按预期响应，请检查 Base URL 和代理前缀',
      response_preview: text.slice(0, 240),
    }
    if (reachable) {
      logTaskSuccess('AIConfig', 'probe-done', {
        provider: body.provider,
        status: resp.status,
        url: probeUrl,
      })
    } else {
      logTaskError('AIConfig', 'probe-unexpected', {
        provider: body.provider,
        status: resp.status,
        url: probeUrl,
      })
    }
    return success(c, payload)
  } catch (error: any) {
    logTaskError('AIConfig', 'probe-failed', {
      provider: body.provider,
      url: probeUrl,
      error: error.message,
    })
    return success(c, {
      ok: false,
      reachable: false,
      method: probe.method,
      url: probeUrl,
      message: error.message || '请求失败',
      response_preview: '',
    })
  }
})

// GET /ai-configs/:id
app.get('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  const row = getOwnedAiConfig(id, user.id)
  if (!row) return notFound(c)
  return success(c, {
    ...toSnakeCase(row),
    model: row.model ? JSON.parse(row.model) : [],
  })
})

// PUT /ai-configs/:id
app.put('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnedAiConfig(id, user.id)) return notFound(c)
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }

  if ('provider' in body) updates.provider = body.provider
  if ('name' in body) updates.name = body.name
  if ('base_url' in body) updates.baseUrl = body.base_url
  if ('api_key' in body) updates.apiKey = body.api_key
  if ('model' in body) updates.model = JSON.stringify(body.model)
  if ('priority' in body) updates.priority = body.priority
  if ('is_active' in body) updates.isActive = body.is_active
  if ('settings' in body) updates.settings = body.settings ? JSON.stringify(body.settings) : null

  db.update(schema.aiServiceConfigs).set(updates).where(eq(schema.aiServiceConfigs.id, id)).run()
  return success(c)
})

// DELETE /ai-configs/:id
app.delete('/:id', async (c) => {
  const user = requireUser(c)
  const id = Number(c.req.param('id'))
  if (!getOwnedAiConfig(id, user.id)) return notFound(c)
  db.delete(schema.aiServiceConfigs).where(eq(schema.aiServiceConfigs.id, id)).run()
  return success(c)
})

// GET /ai-providers
export const aiProviders = new Hono()
aiProviders.get('/', async (c) => {
  const rows = db.select().from(schema.aiServiceProviders).all()
  const parsed = rows.map(r => ({
    ...toSnakeCase(r),
    preset_models: r.presetModels ? JSON.parse(r.presetModels) : [],
  }))
  return success(c, parsed)
})

export default app
