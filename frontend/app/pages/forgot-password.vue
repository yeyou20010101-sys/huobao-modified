<template>
  <main class="auth-card card" aria-labelledby="forgot-title">
    <div class="auth-brand">
      <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="auth-logo" @error="showBrandImage = false" />
      <span v-else class="auth-fallback">鲸</span>
      <div>
        <p class="auth-kicker">Whale Shorts</p>
        <h1 id="forgot-title" class="auth-title">找回密码</h1>
      </div>
    </div>
    <p class="auth-desc">输入已验证的邮箱。如果账号存在，我们将发送重置链接。</p>
    <form v-if="!sent" class="auth-form" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">邮箱</span>
        <input v-model="email" class="input" type="email" name="email" autocomplete="email" required />
      </label>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">
        {{ loading ? '发送中…' : '发送重置邮件' }}
      </button>
    </form>
    <p v-else class="auth-desc">如果该邮箱已注册并完成验证，重置链接已发出。请检查收件箱。</p>
    <p class="auth-switch">
      <NuxtLink to="/login">返回登录</NuxtLink>
    </p>
  </main>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'
import { authAPI } from '~/composables/useApi'

definePageMeta({ layout: 'auth' })

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)
const showBrandImage = ref(true)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authAPI.forgotPassword({ email: email.value.trim() })
    sent.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card { padding: 28px; display: flex; flex-direction: column; gap: 16px; }
.auth-brand { display: flex; align-items: center; gap: 12px; }
.auth-logo { width: 44px; height: 44px; object-fit: contain; }
.auth-fallback {
  width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  background: var(--accent-bg); color: var(--accent-text); font-family: var(--font-display); font-weight: 700;
}
.auth-kicker { font-size: 11px; color: var(--text-3); letter-spacing: 0.04em; }
.auth-title { font-family: var(--font-display); font-size: 22px; }
.auth-desc { font-size: 13px; color: var(--text-2); }
.auth-form { display: flex; flex-direction: column; gap: 12px; }
.auth-error { font-size: 13px; color: var(--error); }
.auth-switch { font-size: 13px; color: var(--text-2); }
.auth-switch a { color: var(--accent-text); }
.btn:disabled { opacity: 0.65; cursor: not-allowed; }
</style>
