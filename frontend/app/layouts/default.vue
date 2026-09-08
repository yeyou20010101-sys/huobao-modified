<template>
  <div class="shell">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <button class="brand" @click="navigateTo('/')">
          <div class="brand-mark">
            <img v-if="showBrandImage" :src="brandLogo" alt="鲸鱼短剧" class="brand-logo" @error="showBrandImage = false" />
            <span v-else class="brand-fallback">鲸</span>
          </div>
          <div class="brand-text">
            <span class="brand-name">鲸鱼短剧</span>
            <span class="brand-sub">Whale Shorts</span>
          </div>
        </button>
      </div>

      <nav class="header-nav">
        <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>项目</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="nav-link" :class="{ active: route.path === '/settings' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>设置</span>
        </NuxtLink>
        <NuxtLink to="/create" class="nav-link" :class="{ active: route.path.startsWith('/create') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
          <span>创作</span>
        </NuxtLink>
        <NuxtLink to="/usage" class="nav-link" :class="{ active: route.path.startsWith('/usage') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="M7 14l4-4 3 3 5-6"/>
          </svg>
          <span>用量与余额</span>
        </NuxtLink>
        <NuxtLink v-if="auth.user.value?.role === 'admin'" to="/admin" class="nav-link" :class="{ active: route.path.startsWith('/admin') }">
          <span>管理</span>
        </NuxtLink>
      </nav>

      <div class="header-right">
        <NuxtLink to="/usage" class="balance-chip" :title="'可用余额'">
          余额 {{ availablePoints }} 点
        </NuxtLink>
        <div class="user-menu">
          <button class="user-btn" type="button" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <span class="user-avatar">{{ userInitial }}</span>
            <span class="user-name">{{ auth.user.value?.username || '账号' }}</span>
          </button>
          <div v-if="menuOpen" class="user-dropdown">
            <NuxtLink to="/settings" class="user-item" @click="menuOpen = false">账号设置</NuxtLink>
            <button class="user-item" type="button" @click="onLogout">退出登录</button>
          </div>
        </div>
      </div>
    </header>

    <div v-if="auth.user.value && !auth.emailVerified.value" class="verify-banner" role="status">
      <span>请验证邮箱 {{ auth.user.value.email }}，未验证也可以继续使用，但无法找回密码。</span>
      <button class="verify-resend" type="button" :disabled="resending" @click="onResend">
        {{ resending ? '发送中…' : '重发验证邮件' }}
      </button>
    </div>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import brandLogo from '~/assets/jingyu-mark.png'

const route = useRoute()
const showBrandImage = ref(true)
const auth = useAuth()
const { availablePoints, refresh: refreshWallet } = useWallet()
const menuOpen = ref(false)
const resending = ref(false)

const userInitial = computed(() => {
  const name = auth.user.value?.username || ''
  return name.slice(0, 1).toUpperCase() || '鲸'
})

async function onResend() {
  resending.value = true
  try {
    await auth.sendVerification()
  } finally {
    resending.value = false
  }
}

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
}

watch(() => route.fullPath, () => {
  if (auth.user.value) refreshWallet()
})

onMounted(() => {
  if (auth.user.value) refreshWallet()
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
})

function onVisible() {
  if (document.visibilityState === 'visible' && auth.user.value) refreshWallet()
}
</script>

<style scoped>
.shell {
  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
  background: var(--bg-base);
}

/* === Header === */
.header {
  display: flex; align-items: center;
  height: 56px; flex-shrink: 0;
  padding: 0 24px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  gap: 32px;
}

.header-left { display: flex; align-items: center; }

.brand {
  display: flex; align-items: center; gap: 10px;
  background: none; border: none; cursor: pointer; padding: 0;
  text-decoration: none; border-radius: var(--radius);
  transition: opacity 0.15s;
}
.brand:hover { opacity: 0.75; }
.brand-mark {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 10px;
  border: none;
  overflow: hidden;
  flex-shrink: 0;
}
.brand-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  object-position: center;
  display: block;
}
.brand-fallback {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-text);
  line-height: 1;
}
.brand-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; }
.brand-name {
  font-family: var(--font-display);
  font-size: 15px; font-weight: 700;
  color: var(--text-0);
  letter-spacing: -0.01em;
}
.brand-sub {
  font-size: 10px; font-weight: 400;
  color: var(--text-3); margin-top: 1px;
  letter-spacing: 0.04em;
}

/* Nav */
.header-nav { display: flex; gap: 4px; flex: 1; }
.nav-link {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: var(--radius);
  font-size: 13px; font-weight: 500;
  color: var(--text-2); text-decoration: none;
  transition: all 0.18s var(--ease-out);
  border: 1px solid transparent;
}
.nav-link:hover {
  background: var(--bg-hover); color: var(--text-0);
  border-color: var(--border);
}
.nav-link.active {
  background: var(--accent-bg);
  color: var(--accent-text);
  border-color: rgba(76,125,255,0.18);
  font-weight: 600;
}

.header-right { display: flex; align-items: center; margin-left: auto; position: relative; gap: 10px; }

.balance-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 99px;
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 650;
  text-decoration: none;
}
.balance-chip:hover { background: var(--bg-hover); }

.user-menu { position: relative; }
.user-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 10px 4px 4px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 99px;
  cursor: pointer;
  color: var(--text-1);
}
.user-btn:hover { background: var(--bg-hover); }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-bg); color: var(--accent-text);
  font-size: 12px; font-weight: 700;
}
.user-name { font-size: 13px; font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-dropdown {
  position: absolute; right: 0; top: calc(100% + 8px);
  min-width: 140px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 20;
  display: flex; flex-direction: column;
}
.user-item {
  display: block; width: 100%;
  padding: 8px 10px;
  border: none; background: none;
  text-align: left; font-size: 13px;
  color: var(--text-1); text-decoration: none;
  border-radius: 6px; cursor: pointer;
}
.user-item:hover { background: var(--bg-hover); }

/* Content */
.content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

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
