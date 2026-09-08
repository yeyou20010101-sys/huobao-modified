import nodemailer from 'nodemailer'
import { getAppConfig, isMailConfigured } from '../utils/app-config.js'

export class MailNotConfiguredError extends Error {
  constructor() {
    super('SMTP 未配置')
    this.name = 'MailNotConfiguredError'
  }
}

function createTransport() {
  const { mail } = getAppConfig()
  return nodemailer.createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    secure: mail.smtpSecure,
    auth: {
      user: mail.smtpUser,
      pass: mail.smtpPass,
    },
  })
}

export async function sendMail(options: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<void> {
  if (!isMailConfigured()) throw new MailNotConfiguredError()
  const { mail } = getAppConfig()
  const transporter = createTransport()
  await transporter.sendMail({
    from: mail.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })
}

export function logMailLink(kind: string, email: string, url: string) {
  console.log(`[mail] ${kind} ${email}: ${url}`)
}

export async function sendVerificationMail(to: string, username: string, url: string) {
  const { debug } = getAppConfig()
  if (debug || !isMailConfigured()) logMailLink('verify', to, url)
  if (!isMailConfigured()) return
  await sendMail({
    to,
    subject: '验证你的鲸鱼短剧邮箱',
    text: `${username}，请打开以下链接完成邮箱验证（24 小时内有效）：\n${url}`,
    html: `<p>${username}，请点击以下链接完成邮箱验证（24 小时内有效）：</p><p><a href="${url}">${url}</a></p>`,
  })
}

export async function sendPasswordResetMail(to: string, username: string, url: string) {
  const { debug } = getAppConfig()
  if (debug || !isMailConfigured()) logMailLink('reset', to, url)
  if (!isMailConfigured()) return
  await sendMail({
    to,
    subject: '重置鲸鱼短剧密码',
    text: `${username}，请打开以下链接重置密码（1 小时内有效）：\n${url}`,
    html: `<p>${username}，请点击以下链接重置密码（1 小时内有效）：</p><p><a href="${url}">${url}</a></p>`,
  })
}
