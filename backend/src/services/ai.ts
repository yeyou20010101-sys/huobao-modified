/**
 * AI 服务抽象层 — 从数据库配置中获取 provider 和 API key
 */
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { logTaskProgress, logTaskWarn } from '../utils/task-logger.js'
import { joinProviderUrl } from './adapters/url.js'

export type ServiceType = 'text' | 'image' | 'video' | 'audio'

export interface AIConfig {
  id: number
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  models: string[]
  settings?: Record<string, unknown>
}

function parseSettingsJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function mapConfigRow(row: typeof schema.aiServiceConfigs.$inferSelect, models: string[]): AIConfig {
  return {
    id: row.id,
    provider: row.provider || '',
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    model: models[0] || '',
    models,
    settings: parseSettingsJson(row.settings),
  }
}

function parseModelsJson(
  raw: string | null | undefined,
  context: { serviceType?: string; configId?: number },
): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean)
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()]
    }
    return []
  } catch (err) {
    const trimmed = String(raw).trim()
    if (trimmed && !trimmed.startsWith('[')) {
      logTaskWarn('AIConfig', 'model-json-fallback', {
        ...context,
        raw: trimmed.slice(0, 120),
      })
      return [trimmed]
    }
    logTaskWarn('AIConfig', 'model-json-invalid', {
      ...context,
      raw: trimmed.slice(0, 120),
      error: (err as Error).message,
    })
    return []
  }
}

export function getTextProviderBaseUrl(config: AIConfig) {
  const provider = config.provider.toLowerCase()
  const rawBase = String(config.baseUrl || '').trim()

  if (!rawBase || rawBase.startsWith('/')) {
    throw new Error(
      `文本 AI「Base URL」无效（当前: ${rawBase || '(空)'}）。请到设置页填写完整地址，例如 https://dashscope.aliyuncs.com/compatible-mode/v1`,
    )
  }

  let resolved: string
  if (provider === 'openai' || provider === 'openrouter' || provider === 'chatfire') {
    resolved = joinProviderUrl(rawBase, '/v1', '')
  } else if (provider === 'volcengine') {
    resolved = joinProviderUrl(rawBase, '/api/v3', '')
  } else if (provider === 'ali') {
    if (rawBase.includes('/compatible-mode/')) {
      resolved = rawBase.replace(/\/$/, '')
    } else {
      resolved = joinProviderUrl(rawBase, '/api/v1', '')
    }
  } else {
    resolved = rawBase
  }

  // 相对路径会被 Node fetch 当成 http://127.0.0.1:80/...，表现为 ECONNREFUSED 127.0.0.1:80
  if (!/^https?:\/\//i.test(resolved)) {
    throw new Error(
      `文本 AI 端点解析后不是合法 HTTP(S) 地址（${resolved}）。请检查设置中的 Base URL 是否包含 https:// 前缀`,
    )
  }

  return resolved
}

/** 将隧道/本机模型未启动时的难懂报错，转成可操作提示 */
export function explainTextApiConnectError(err: unknown, baseUrl: string): Error {
  const message = err instanceof Error ? err.message : String(err)
  const isRefused =
    /ECONNREFUSED/i.test(message) ||
    /Cannot connect to API/i.test(message) ||
    /fetch failed/i.test(message)

  if (!isRefused) {
    return err instanceof Error ? err : new Error(message)
  }

  let hostHint = baseUrl
  try {
    hostHint = new URL(baseUrl).host
  } catch {
    /* keep raw */
  }

  const looksLocal =
    /127\.0\.0\.1|localhost/i.test(message) ||
    /natapp|cpolar|ngrok|localhost\.run|127\.0\.0\.1|localhost/i.test(baseUrl)

  if (looksLocal) {
    return new Error(
      `无法连接文本模型 API（${hostHint}）。当前 Base URL 指向本机/内网穿透（常见于 Natapp），请确认：1) 穿透客户端已启动；2) 本地模型服务在对应端口监听；3) 或在设置中改用可用的公网文本服务（如百炼 compatible-mode）并启用。原始错误: ${message}`,
    )
  }

  return new Error(
    `无法连接文本模型 API（${hostHint}）。请检查 Base URL、网络与 API Key。原始错误: ${message}`,
  )
}

export function getActiveConfig(serviceType: ServiceType, userId: number): AIConfig | null {
  const rows = db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.serviceType, serviceType))
    .all()
    .filter(r => r.isActive && r.userId === userId)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // 高优先级优先

  const active = rows[0]
  if (!active) {
    logTaskWarn('AIConfig', 'active-config-missing', { serviceType, userId })
    return null
  }

  const models = parseModelsJson(active.model, { serviceType, configId: active.id })
  logTaskProgress('AIConfig', 'active-config-selected', {
    serviceType,
    configId: active.id,
    userId,
    provider: active.provider,
    model: models[0] || '',
    priority: active.priority,
  })
  return mapConfigRow(active, models)
}

export function getTextConfig(userId: number): AIConfig {
  const config = getActiveConfig('text', userId)
  if (!config) throw new Error('No active text AI config')
  return config
}

export function getAudioConfig(userId: number): AIConfig {
  const config = getActiveConfig('audio', userId)
  if (!config) throw new Error('No active audio AI config — 请在设置中添加音频服务')
  return config
}

export function getAudioConfigById(id: number | null | undefined, userId: number): AIConfig {
  if (id) {
    const config = getConfigById(id, userId)
    if (config) return config
  }
  return getAudioConfig(userId)
}

/** 优先用当前用户自己的锁定配置，否则回退到该用户默认配置，永不读取他人 Key */
export function resolveUserConfig(
  serviceType: ServiceType,
  preferredId: number | null | undefined,
  userId: number,
): AIConfig | null {
  if (preferredId) {
    const owned = getConfigById(preferredId, userId)
    if (owned) return owned
  }
  return getActiveConfig(serviceType, userId)
}

export function getConfigById(id: number, userId: number): AIConfig | null {
  const [row] = db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.id, id)).all()
  if (!row || !row.isActive || row.userId !== userId) {
    logTaskWarn('AIConfig', 'config-by-id-missing', { configId: id, userId })
    return null
  }
  const models = parseModelsJson(row.model, { serviceType: row.serviceType, configId: id })
  logTaskProgress('AIConfig', 'config-by-id-selected', {
    configId: id,
    userId,
    provider: row.provider,
    model: models[0] || '',
    serviceType: row.serviceType,
  })
  return mapConfigRow(row, models)
}
