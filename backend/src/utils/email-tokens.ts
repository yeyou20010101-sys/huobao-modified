import { createHash, randomBytes } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from './response.js'

export type EmailTokenType = 'verify' | 'reset'

const TTL_MS: Record<EmailTokenType, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 生成一次性 token，返回明文（仅此时可见） */
export function createEmailToken(userId: number, type: EmailTokenType): string {
  const token = randomBytes(32).toString('hex')
  const ts = now()
  db.insert(schema.emailTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MS[type]).toISOString(),
    createdAt: ts,
  }).run()
  return token
}

export function consumeEmailToken(rawToken: string, type: EmailTokenType) {
  const token = String(rawToken || '').trim()
  if (!token) return null
  const [row] = db.select().from(schema.emailTokens)
    .where(and(
      eq(schema.emailTokens.tokenHash, hashToken(token)),
      eq(schema.emailTokens.type, type),
      isNull(schema.emailTokens.usedAt),
    ))
    .all()
  if (!row) return null
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null
  db.update(schema.emailTokens)
    .set({ usedAt: now() })
    .where(eq(schema.emailTokens.id, row.id))
    .run()
  return row
}
