import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import path from 'path'
import { fileURLToPath } from 'url'

import dramas from './routes/dramas.js'
import episodes from './routes/episodes.js'
import storyboards from './routes/storyboards.js'
import scenes from './routes/scenes.js'
import characters from './routes/characters.js'
import images from './routes/images.js'
import videos from './routes/videos.js'
import upload from './routes/upload.js'
import aiConfigs, { aiProviders } from './routes/aiConfigs.js'
import agentConfigs from './routes/agentConfigs.js'
import agent from './routes/agent.js'
import compose from './routes/compose.js'
import merge from './routes/merge.js'
import grid from './routes/grid.js'
import skills from './routes/skills.js'
import webhooks from './routes/webhooks.js'
import aiVoices from './routes/aiVoices.js'
import create from './routes/create.js'
import billing from './routes/billing.js'
import auth from './routes/auth.js'
import admin from './routes/admin.js'
import { requestLogger, errorHandler } from './middleware/logger.js'
import { apiAuth } from './middleware/auth.js'
import { resolveSessionUser } from './utils/session.js'
import { canUserReadStaticPath } from './utils/storage.js'
import { unauthorized, notFound } from './utils/response.js'
import { recoverStaleHolds } from './services/billing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

/** 本机 / 内网私有地址，便于局域网分享前端时跨域访问 API */
function isLocalOrPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/** 额外白名单：CORS_ORIGINS=https://a.com,https://b.com；设 * 则回显任意 Origin（仅建议内网调试） */
function resolveCorsOrigin(origin: string): string | undefined {
  if (!origin) return undefined

  const extras = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (extras.includes('*')) return origin
  if (extras.includes(origin)) return origin

  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (isLocalOrPrivateHostname(url.hostname)) return origin
  } catch {
    return undefined
  }
  return undefined
}

const app = new Hono()

// Middleware
app.use('*', cors({
  origin: (origin) => resolveCorsOrigin(origin),
  credentials: true,
}))
app.use('*', requestLogger)
app.use('*', errorHandler)

// 其余 API 需要登录；health / 注册 / 登录保持公开
app.use('/api/v1/*', apiAuth)

// Health check
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/api/v1/auth', auth)
app.route('/api/v1/admin', admin)

// API routes
const api = new Hono()
api.route('/dramas', dramas)
api.route('/episodes', episodes)
api.route('/storyboards', storyboards)
api.route('/scenes', scenes)
api.route('/characters', characters)
api.route('/images', images)
api.route('/videos', videos)
api.route('/upload', upload)
api.route('/ai-configs', aiConfigs)
api.route('/ai-providers', aiProviders)
api.route('/agent-configs', agentConfigs)
api.route('/agent', agent)
api.route('/compose', compose)
api.route('/merge', merge)
api.route('/grid', grid)
api.route('/skills', skills)
api.route('/ai-voices', aiVoices)
api.route('/create', create)
api.route('/billing', billing)

app.route('/api/v1', api)

// Webhook callbacks (Vidu, etc.) - outside /api/v1
app.route('/webhooks', webhooks)

// 静态资源：登录后仅可读自己的目录；旧版非用户目录仅管理员可读
app.use('/static/*', async (c, next) => {
  const user = resolveSessionUser(c)
  if (!user) return unauthorized(c)
  if (!canUserReadStaticPath(user, c.req.path)) return notFound(c)
  await next()
})
app.use('/static/*', serveStatic({ root: path.join(projectRoot, 'data') }))

// Serve frontend (production build)
const distPath = path.join(projectRoot, 'frontend', 'dist')
app.use('*', serveStatic({ root: distPath }))
app.get('*', serveStatic({ root: distPath, path: 'index.html' }))

const port = Number(process.env.PORT || 5679)
const hostname = process.env.HOST || '0.0.0.0'
try {
  const recovered = recoverStaleHolds()
  if (recovered.settled || recovered.refunded) {
    console.log(`[billing] recovered holds: settled=${recovered.settled} refunded=${recovered.refunded}`)
  }
} catch (err) {
  console.warn('[billing] recover stale holds failed:', err)
}
console.log(`🚀 鲸鱼短剧 TS server on http://${hostname}:${port}`)
console.log(`   本机: http://localhost:${port}  |  局域网请用本机 IP:${port}（CORS 已允许私有网段 Origin）`)
serve({ fetch: app.fetch, port, hostname })
