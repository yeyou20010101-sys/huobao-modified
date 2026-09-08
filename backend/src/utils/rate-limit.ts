type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** 简单内存限流：窗口内超过 limit 次返回 false */
export function consumeRateLimit(key: string, limit = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const hit = buckets.get(key)
  if (!hit || now > hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (hit.count >= limit) return false
  hit.count += 1
  return true
}

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') || 'unknown'
}
