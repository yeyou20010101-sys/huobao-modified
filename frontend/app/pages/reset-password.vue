<template>
  <main class="auth-card card" aria-labelledby="reset-title">
    <div class="auth-brand">
      <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="auth-logo" @error="showBrandImage = false" />
      <span v-else class="auth-fallback">鲸</span>
      <div>
        <p class="auth-kicker">Whale Shorts</p>
        <h1 id="reset-title" class="auth-title">设置新密码</h1>
      </div>
    </div>
    <p v-if="!token" class="auth-error" role="alert">重置链接无效，请重新申请。</p>
    <form v-else-if="!done" class="auth-form" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">新密码</span>
        <input v-model="password" class="input" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <label class="field">
        <span class="field-label">确认新密码</span>
        <input v-model="confirm" class="input" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">
        {{ loading ? '保存中…' : '重置密码' }}
      </button>
    </form>
    <p v-else class="auth-desc">密码已更新，请使用新密码登录。</p>
    <p class="auth-switch">
      <NuxtLink to="/login">返回登录</NuxtLink>
    </p>
  </main>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'
import { authAPI } from '~/composables/useApi'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const token = computed(() => String(route.query.token || '').trim())
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const showBrandImage = ref(true)

async function onSubmit() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await authAPI.resetPassword({ token: token.value, password: password.value })
    done.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '重置失败'
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
