import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = process.env.CONFIG_PATH
  || path.resolve(__dirname, '../../../configs/config.yaml')

type MailYaml = {
  smtp_host?: string
  smtp_port?: number
  smtp_secure?: boolean
  smtp_user?: string
  smtp_pass?: string
  from?: string
}

type LoadedYaml = {
  app?: { debug?: boolean }
  app_public_url?: string
  mail?: MailYaml
}

export type MailConfig = {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  from: string
}

export type AlipayConfig = {
  appId: string
  privateKey: string
  alipayPublicKey: string
  sellerId: string
  notifyUrl: string
  gateway: string
  keyType: 'PKCS1' | 'PKCS8'
}

export type AppRuntimeConfig = {
  debug: boolean
  appPublicUrl: string
  mail: MailConfig
  alipay: AlipayConfig
}

let cached: AppRuntimeConfig | null = null

function readYaml(): LoadedYaml {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    return (parseYaml(raw) || {}) as LoadedYaml
  } catch {
    return {}
  }
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

/** 环境变量中的 PEM 常以 \n 转义保存，读取时还原换行 */
function pemFromEnv(name: string): string {
  return String(process.env[name] || '').replace(/\\n/g, '\n').trim()
}

/** 读取 YAML + 环境变量覆盖；进程内缓存 */
export function getAppConfig(): AppRuntimeConfig {
  if (cached) return cached
  const yaml = readYaml()
  const mail = yaml.mail || {}
  cached = {
    debug: yaml.app?.debug === true,
    appPublicUrl: (process.env.APP_PUBLIC_URL || yaml.app_public_url || 'http://localhost:3013').replace(/\/+$/, ''),
    mail: {
      smtpHost: process.env.SMTP_HOST || mail.smtp_host || '',
      smtpPort: Number(process.env.SMTP_PORT || mail.smtp_port || 465),
      smtpSecure: process.env.SMTP_SECURE != null
        ? envFlag('SMTP_SECURE', true)
        : mail.smtp_secure !== false,
      smtpUser: process.env.SMTP_USER || mail.smtp_user || '',
      smtpPass: process.env.SMTP_PASS || mail.smtp_pass || '',
      from: process.env.SMTP_FROM || mail.from || '鲸鱼短剧 <noreply@example.com>',
    },
    alipay: {
      appId: String(process.env.ALIPAY_APP_ID || '').trim(),
      privateKey: pemFromEnv('ALIPAY_PRIVATE_KEY'),
      alipayPublicKey: pemFromEnv('ALIPAY_PUBLIC_KEY'),
      sellerId: String(process.env.ALIPAY_SELLER_ID || '').trim(),
      notifyUrl: String(process.env.ALIPAY_NOTIFY_URL || '').trim(),
      gateway: String(process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do').trim(),
      keyType: process.env.ALIPAY_KEY_TYPE === 'PKCS8' ? 'PKCS8' : 'PKCS1',
    },
  }
  return cached
}

export function isMailConfigured(): boolean {
  const mail = getAppConfig().mail
  return Boolean(mail.smtpHost && mail.smtpUser && mail.smtpPass)
}

export function isAlipayConfigured(): boolean {
  const alipay = getAppConfig().alipay
  return Boolean(
    alipay.appId
    && alipay.privateKey
    && alipay.alipayPublicKey
    && alipay.sellerId
    && alipay.notifyUrl,
  )
}
