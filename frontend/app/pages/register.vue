<template>
  <main class="auth-card card" aria-labelledby="register-title">
    <div class="auth-brand">
      <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="auth-logo" @error="showBrandImage = false" />
      <span v-else class="auth-fallback">鲸</span>
      <div>
        <p class="auth-kicker">Whale Shorts</p>
        <h1 id="register-title" class="auth-title">注册账号</h1>
      </div>
    </div>
    <p class="auth-desc">填写用户名和邮箱，之后两者都可以用来登录。</p>
    <form class="auth-form" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">用户名</span>
        <input
          v-model="username"
          class="input"
          type="text"
          name="username"
          autocomplete="username"
          required
          minlength="2"
          maxlength="32"
          aria-required="true"
        />
      </label>
      <label class="field">
        <span class="field-label">邮箱</span>
        <input
          v-model="email"
          class="input"
          type="email"
          name="email"
          autocomplete="email"
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
          autocomplete="new-password"
          required
          minlength="8"
          aria-required="true"
        />
      </label>
      <label class="field">
        <span class="field-label">确认密码</span>
        <input
          v-model="confirmPassword"
          class="input"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
          required
          minlength="8"
          aria-required="true"
        />
      </label>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">
        {{ loading ? '注册中…' : '注册' }}
      </button>
    </form>
    <p class="auth-switch">
      已有账号？
      <NuxtLink to="/login">返回登录</NuxtLink>
    </p>
  </main>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'

definePageMeta({ layout: 'auth' })

const auth = useAuth()
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const showBrandImage = ref(true)

async function onSubmit() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await auth.register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    await navigateTo('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败'
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
