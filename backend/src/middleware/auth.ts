import type { Context, MiddlewareHandler } from 'hono'
import { unauthorized } from '../utils/response.js'
import { resolveSessionUser, type AuthUser } from '../utils/session.js'

export type { AuthUser }

export type AppEnv = {
  Variables: {
    user: AuthUser
  }
}

const PUBLIC_API_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
])

export function requireUser(c: Context): AuthUser {
  const user = c.get('user') as AuthUser | undefined
  if (!user) {
    const err = new Error('未登录') as Error & { status: number }
    err.status = 401
    throw err
  }
  return user
}

export function requireAdmin(c: Context): AuthUser {
  const user = requireUser(c)
  if (user.role !== 'admin') {
    const err = new Error('无权限') as Error & { status: number }
    err.status = 403
    throw err
  }
  return user
}

/** 保护 /api/v1/*，注册、登录和健康检查保持公开 */
export const apiAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()
  if (PUBLIC_API_PATHS.has(c.req.path)) return next()
  const user = resolveSessionUser(c)
  if (!user) return unauthorized(c)
  c.set('user', user)
  await next()
}
