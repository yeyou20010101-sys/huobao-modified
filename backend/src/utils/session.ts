import { createHash, randomBytes } from 'crypto'
import { eq, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db, schema } from '../db/index.js'
import { now } from './response.js'

export const SESSION_COOKIE = 'hb_sid'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AuthUser = {
  id: number
  username: string
  email: string
  role: string
  status: string
  emailVerifiedAt: string | null
}

function cookieSecure() {
  return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === '1'
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax' as const,
    secure: cookieSecure(),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions())
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function createSession(userId: number): string {
  const token = generateSessionToken()
  const ts = now()
  db.insert(schema.sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt: ts,
  }).run()
  return token
}

export function deleteSessionByToken(token: string) {
  db.delete(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hashSessionToken(token)))
    .run()
}

export function deleteUserSessions(userId: number) {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run()
}

export function purgeExpiredSessions() {
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now())).run()
}

export function toPublicUser(row: typeof schema.users.$inferSelect): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt || null,
  }
}

/** 从请求 Cookie 解析有效用户，无效或过期则返回 null */
export function resolveSessionUser(c: Context): AuthUser | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const [session] = db.select().from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .all()
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, session.id)).run()
    return null
  }

  const [user] = db.select().from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .all()
  if (!user || user.status !== 'active') return null
  return toPublicUser(user)
}
