/**
 * 创建初始管理员，并把现有无主数据归给该账号
 *
 * 用法：
 *   npm run create-admin -- --username admin --email admin@local --password 'your-password'
 * 或环境变量 ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD
 */
import { eq, isNull } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { hashPassword } from '../src/utils/password.js'
import { now } from '../src/utils/response.js'
import { ensureDramaOwnerMember } from '../src/utils/ownership.js'

function readArg(name: string, envName: string): string {
  const flag = `--${name}`
  const idx = process.argv.indexOf(flag)
  if (idx >= 0 && process.argv[idx + 1]) return String(process.argv[idx + 1]).trim()
  return String(process.env[envName] || '').trim()
}

async function main() {
  const username = readArg('username', 'ADMIN_USERNAME')
  const email = readArg('email', 'ADMIN_EMAIL').toLowerCase()
  const password = readArg('password', 'ADMIN_PASSWORD')

  if (!username || !email || !password) {
    console.error('缺少参数。示例：npm run create-admin -- --username admin --email admin@local --password "secret123"')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('密码至少 8 位')
    process.exit(1)
  }

  const ts = now()
  let [admin] = db.select().from(schema.users).where(eq(schema.users.username, username)).all()
  if (!admin) {
    const [byEmail] = db.select().from(schema.users).where(eq(schema.users.email, email)).all()
    admin = byEmail
  }

  if (!admin) {
    const res = db.insert(schema.users).values({
      username,
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
      status: 'active',
      emailVerifiedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    }).run()
    ;[admin] = db.select().from(schema.users)
      .where(eq(schema.users.id, Number(res.lastInsertRowid)))
      .all()
    console.log(`已创建管理员 #${admin.id} ${admin.username} <${admin.email}>`)
  } else {
    db.update(schema.users).set({
      role: 'admin',
      status: 'active',
      emailVerifiedAt: admin.emailVerifiedAt || ts,
      updatedAt: ts,
    }).where(eq(schema.users.id, admin.id)).run()
    console.log(`管理员已存在，沿用 #${admin.id} ${admin.username}`)
  }

  const tables: Array<{ table: any; label: string }> = [
    { table: schema.dramas, label: 'dramas' },
    { table: schema.aiServiceConfigs, label: 'ai_service_configs' },
    { table: schema.agentConfigs, label: 'agent_configs' },
    { table: schema.createJobs, label: 'create_jobs' },
    { table: schema.imageGenerations, label: 'image_generations' },
    { table: schema.videoGenerations, label: 'video_generations' },
    { table: schema.videoMerges, label: 'video_merges' },
  ]

  for (const item of tables) {
    const result = db.update(item.table)
      .set({ userId: admin.id })
      .where(isNull(item.table.userId))
      .run()
    console.log(`已接管 ${item.label}: ${result.changes} 条`)
  }

  const ownedDramas = db.select().from(schema.dramas).where(eq(schema.dramas.userId, admin.id)).all()
  for (const drama of ownedDramas) {
    ensureDramaOwnerMember(drama.id, admin.id)
  }

  console.log('完成。旧 /static/* 文件仅该管理员可访问；新文件将写入 static/users/{userId}/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
