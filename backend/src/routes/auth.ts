import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest, unauthorized, tooManyRequests, now, serverError } from '../utils/response.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import {
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  deleteUserSessions,
  resolveSessionUser,
  setSessionCookie,
  toPublicUser,
} from '../utils/session.js'
import { clientIp, consumeRateLimit } from '../utils/rate-limit.js'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '../utils/session.js'
import { requireUser, type AppEnv } from '../middleware/auth.js'
import { getAppConfig } from '../utils/app-config.js'
import { consumeEmailToken, createEmailToken } from '../utils/email-tokens.js'
import { sendPasswordResetMail, sendVerificationMail } from '../services/mail.js'
import { ensureWallet } from '../services/billing.js'

const app = new Hono<AppEnv>()

const USERNAME_RE = /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,32}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeUsername(value: unknown): string {
  return String(value || '').trim()
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return '密码至少 8 位'
  if (password.length > 128) return '密码过长'
  return null
}

function findUserByLogin(identifier: string) {
  const username = identifier.trim()
  const email = identifier.trim().toLowerCase()
  const [user] = db.select().from(schema.users)
    .where(or(eq(schema.users.username, username), eq(schema.users.email, email)))
    .all()
  return user || null
}

async function dispatchVerification(user: typeof schema.users.$inferSelect) {
  const token = createEmailToken(user.id, 'verify')
  const url = `${getAppConfig().appPublicUrl}/verify-email?token=${encodeURIComponent(token)}`
  await sendVerificationMail(user.email, user.username, url)
}

async function dispatchPasswordReset(user: typeof schema.users.$inferSelect) {
  const token = createEmailToken(user.id, 'reset')
  const url = `${getAppConfig().appPublicUrl}/reset-password?token=${encodeURIComponent(token)}`
  await sendPasswordResetMail(user.email, user.username, url)
}

function readToken(body: Record<string, unknown>, queryToken?: string) {
  return String(body.token || queryToken || '').trim()
}

// POST /auth/register
app.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const username = normalizeUsername(body.username)
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  const ip = clientIp(c.req.raw.headers)
  if (!consumeRateLimit(`register:${ip}:${email || username}`)) {
    return tooManyRequests(c)
  }

  if (!USERNAME_RE.test(username)) {
    return badRequest(c, '用户名需为 2-32 位中文、字母、数字或下划线')
  }
  if (!EMAIL_RE.test(email)) {
    return badRequest(c, '邮箱格式不正确')
  }
  const passwordError = validatePassword(password)
  if (passwordError) return badRequest(c, passwordError)

  const [dupName] = db.select().from(schema.users).where(eq(schema.users.username, username)).all()
  if (dupName) return badRequest(c, '用户名已被占用')
  const [dupEmail] = db.select().from(schema.users).where(eq(schema.users.email, email)).all()
  if (dupEmail) return badRequest(c, '邮箱已被注册')

  const ts = now()
  const res = db.insert(schema.users).values({
    username,
    email,
    passwordHash: await hashPassword(password),
    role: 'user',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  }).run()

  const [user] = db.select().from(schema.users)
    .where(eq(schema.users.id, Number(res.lastInsertRowid)))
    .all()
  ensureWallet(user.id)
  try {
    await dispatchVerification(user)
  } catch (err) {
    console.warn('[mail] register verification failed:', err)
  }
  const token = createSession(user.id)
  setSessionCookie(c, token)
  return success(c, toPublicUser(user))
})

// POST /auth/login
app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const identifier = String(body.identifier || body.username || body.email || '').trim()
  const password = String(body.password || '')
  const ip = clientIp(c.req.raw.headers)

  if (!consumeRateLimit(`login:${ip}:${identifier.toLowerCase()}`)) {
    return tooManyRequests(c)
  }
  if (!identifier || !password) {
    return badRequest(c, '请输入用户名/邮箱和密码')
  }

  const user = findUserByLogin(identifier)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return unauthorized(c, '用户名或密码错误')
  }
  if (user.status !== 'active') {
    return unauthorized(c, '账号已停用')
  }

  const token = createSession(user.id)
  setSessionCookie(c, token)
  return success(c, toPublicUser(user))
})

// GET /auth/me
app.get('/me', async (c) => {
  const user = resolveSessionUser(c)
  if (!user) return unauthorized(c)
  return success(c, user)
})

// POST /auth/logout
app.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) deleteSessionByToken(token)
  clearSessionCookie(c)
  return success(c)
})

// POST /auth/change-password
app.post('/change-password', async (c) => {
  const current = requireUser(c)
  const body = await c.req.json().catch(() => ({}))
  const oldPassword = String(body.old_password || body.oldPassword || '')
  const newPassword = String(body.new_password || body.newPassword || '')

  const passwordError = validatePassword(newPassword)
  if (passwordError) return badRequest(c, passwordError)
  if (!oldPassword) return badRequest(c, '请输入当前密码')

  const [user] = db.select().from(schema.users).where(eq(schema.users.id, current.id)).all()
  if (!user) return unauthorized(c)
  if (!(await verifyPassword(oldPassword, user.passwordHash))) {
    return unauthorized(c, '当前密码不正确')
  }

  db.update(schema.users).set({
    passwordHash: await hashPassword(newPassword),
    updatedAt: now(),
  }).where(eq(schema.users.id, user.id)).run()

  deleteUserSessions(user.id)
  const token = createSession(user.id)
  setSessionCookie(c, token)
  return success(c, toPublicUser(user))
})

// POST /auth/forgot-password — 无论邮箱是否存在都返回成功，防探测
app.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const ip = clientIp(c.req.raw.headers)
  if (!consumeRateLimit(`forgot:${ip}:${email || 'empty'}`)) {
    return tooManyRequests(c)
  }
  if (EMAIL_RE.test(email)) {
    const [user] = db.select().from(schema.users).where(eq(schema.users.email, email)).all()
    if (user?.emailVerifiedAt && user.status === 'active') {
      try {
        await dispatchPasswordReset(user)
      } catch (err) {
        console.warn('[mail] forgot-password failed:', err)
      }
    }
  }
  return success(c, { sent: true })
})

// POST /auth/reset-password
app.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const token = readToken(body)
  const password = String(body.password || body.new_password || '')
  const passwordError = validatePassword(password)
  if (passwordError) return badRequest(c, passwordError)
  const row = consumeEmailToken(token, 'reset')
  if (!row) return badRequest(c, '重置链接无效或已过期')

  const [user] = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).all()
  if (!user || user.status !== 'active') return badRequest(c, '账号不可用')

  db.update(schema.users).set({
    passwordHash: await hashPassword(password),
    updatedAt: now(),
  }).where(eq(schema.users.id, user.id)).run()
  deleteUserSessions(user.id)
  return success(c)
})

async function verifyEmailToken(token: string) {
  const row = consumeEmailToken(token, 'verify')
  if (!row) return null
  const ts = now()
  db.update(schema.users).set({
    emailVerifiedAt: ts,
    updatedAt: ts,
  }).where(eq(schema.users.id, row.userId)).run()
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).all()
  return user || null
}

// GET /auth/verify-email?token=
app.get('/verify-email', async (c) => {
  const token = String(c.req.query('token') || '').trim()
  const user = await verifyEmailToken(token)
  if (!user) return badRequest(c, '验证链接无效或已过期')
  return success(c, toPublicUser(user))
})

// POST /auth/verify-email
app.post('/verify-email', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const token = readToken(body, c.req.query('token'))
  const user = await verifyEmailToken(token)
  if (!user) return badRequest(c, '验证链接无效或已过期')
  return success(c, toPublicUser(user))
})

// POST /auth/send-verification
app.post('/send-verification', async (c) => {
  const current = requireUser(c)
  if (!consumeRateLimit(`verify:${current.id}`, 5, 15 * 60 * 1000)) {
    return tooManyRequests(c)
  }
  const [user] = db.select().from(schema.users).where(eq(schema.users.id, current.id)).all()
  if (!user) return unauthorized(c)
  if (user.emailVerifiedAt) return success(c, { already_verified: true })
  try {
    await dispatchVerification(user)
  } catch (err) {
    console.warn('[mail] send-verification failed:', err)
    return serverError(c, '验证邮件发送失败，请稍后重试')
  }
  return success(c, { sent: true })
})

export default app
