<template>
  <main class="auth-card card" aria-labelledby="login-title">
    <div class="auth-brand">
      <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="auth-logo" @error="showBrandImage = false" />
      <span v-else class="auth-fallback">鲸</span>
      <div>
        <p class="auth-kicker">Whale Shorts</p>
        <h1 id="login-title" class="auth-title">登录鲸鱼短剧</h1>
      </div>
    </div>
    <p class="auth-desc">使用用户名或邮箱登录，会话将在本机保持 7 天。</p>
    <form class="auth-form" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">用户名或邮箱</span>
        <input
          v-model="identifier"
          class="input"
          type="text"
          name="identifier"
          autocomplete="username"
          required
          aria-required="true"
        />
      </label>
      <label class="field">
        <span class="field-label">密码</span>
        <input
          v-model="password"
          class="input"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          aria-required="true"
        />
      </label>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </form>
    <p class="auth-switch">
      <NuxtLink to="/forgot-password">忘记密码</NuxtLink>
    </p>
    <p class="auth-switch">
      还没有账号？
      <NuxtLink to="/register">立即注册</NuxtLink>
    </p>
  </main>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'

definePageMeta({ layout: 'auth' })

const auth = useAuth()
const route = useRoute()
const identifier = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showBrandImage = ref(true)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login({ identifier: identifier.value.trim(), password: password.value })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect || '/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败'
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
