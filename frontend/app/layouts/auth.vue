<template>
  <div class="auth-shell">
    <div class="auth-panel">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-base);
}
.auth-panel {
  width: min(440px, 100%);
}
</style>
