import type { Context } from 'hono'
import { isBillingError } from './billing-error.js'

export function success(c: Context, data: any = null) {
  return c.json({ code: 200, data, message: 'success' })
}

export function created(c: Context, data: any = null) {
  return c.json({ code: 201, data, message: 'created' }, 201)
}

export function badRequest(c: Context, message = 'bad request', errorCode?: string) {
  if (errorCode) {
    return c.json({ code: 400, message, error_code: errorCode }, 400)
  }
  return c.json({ code: 400, message }, 400)
}

export function notFound(c: Context, message = 'not found') {
  return c.json({ code: 404, message }, 404)
}

export function unauthorized(c: Context, message = '未登录') {
  return c.json({ code: 401, message }, 401)
}

export function forbidden(c: Context, message = '无权限') {
  return c.json({ code: 403, message }, 403)
}

export function tooManyRequests(c: Context, message = '请求过于频繁，请稍后再试') {
  return c.json({ code: 429, message }, 429)
}

export function serverError(c: Context, message = 'internal error') {
  return c.json({ code: 500, message }, 500)
}

export function now() {
  return new Date().toISOString()
}

/** 任务接口统一错误：计费错误带 error_code，便于前端跳转用量页 */
export function taskError(c: Context, err: unknown, fallback = '请求失败') {
  if (isBillingError(err)) {
    return badRequest(c, err.message, err.code)
  }
  const message = err instanceof Error ? err.message : fallback
  return badRequest(c, message)
}
