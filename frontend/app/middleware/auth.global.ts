export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login', '/register', '/forgot-password']
  const tokenPaths = ['/reset-password', '/verify-email']
  const auth = useAuth()
  if (!auth.loaded.value) {
    await auth.fetchMe()
  }

  if (tokenPaths.includes(to.path)) {
    return
  }

  if (publicPaths.includes(to.path)) {
    if (auth.user.value) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
      return navigateTo(redirect || '/')
    }
    return
  }

  if (!auth.user.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  if (to.path.startsWith('/admin') && auth.user.value.role !== 'admin') {
    return navigateTo('/')
  }
})
