<template>
  <main class="auth-card card" aria-labelledby="verify-title">
    <div class="auth-brand">
      <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="auth-logo" @error="showBrandImage = false" />
      <span v-else class="auth-fallback">鲸</span>
      <div>
        <p class="auth-kicker">Whale Shorts</p>
        <h1 id="verify-title" class="auth-title">验证邮箱</h1>
      </div>
    </div>
    <p v-if="loading" class="auth-desc">正在验证…</p>
    <p v-else-if="error" class="auth-error" role="alert">{{ error }}</p>
    <p v-else class="auth-desc">邮箱已验证，可以继续使用鲸鱼短剧。</p>
    <p class="auth-switch">
      <NuxtLink to="/">进入工作台</NuxtLink>
      <span> · </span>
      <NuxtLink to="/login">去登录</NuxtLink>
    </p>
  </main>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'
import { authAPI } from '~/composables/useApi'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const auth = useAuth()
const loading = ref(true)
const error = ref('')
const showBrandImage = ref(true)

onMounted(async () => {
  const token = String(route.query.token || '').trim()
  if (!token) {
    error.value = '验证链接无效'
    loading.value = false
    return
  }
  try {
    await authAPI.verifyEmail({ token })
    await auth.fetchMe()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败'
  } finally {
    loading.value = false
  }
})
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
.auth-error { font-size: 13px; color: var(--error); }
.auth-switch { font-size: 13px; color: var(--text-2); }
.auth-switch a { color: var(--accent-text); }
</style>
