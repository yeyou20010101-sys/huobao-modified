<template>
  <div class="studio-fullscreen">
    <div v-if="auth.user.value && !auth.emailVerified.value" class="verify-banner" role="status">
      <span>请验证邮箱 {{ auth.user.value.email }}，未验证也可以继续使用，但无法找回密码。</span>
      <button class="verify-resend" type="button" :disabled="resending" @click="onResend">
        {{ resending ? '发送中…' : '重发验证邮件' }}
      </button>
    </div>
    <slot />
  </div>
</template>

<script setup>
const auth = useAuth()
const resending = ref(false)

async function onResend() {
  resending.value = true
  try {
    await auth.sendVerification()
  } finally {
    resending.value = false
  }
}
</script>

<style scoped>
.studio-fullscreen { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); }
.verify-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 24px;
  background: rgba(184, 120, 20, 0.12);
  border-bottom: 1px solid rgba(184, 120, 20, 0.22);
  color: var(--text-1);
  font-size: 13px;
}
.verify-resend {
  border: 1px solid var(--border);
  background: var(--bg-0);
  color: var(--accent-text);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
}
.verify-resend:hover { background: var(--bg-hover); }
.verify-resend:disabled { opacity: 0.65; cursor: not-allowed; }
</style>
