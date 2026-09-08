export default defineNuxtConfig({
  srcDir: 'app/',
  ssr: false,
  devtools: { enabled: false },
  experimental: {
    appManifest: false,
  },
  app: {
    head: {
      title: '鲸鱼短剧',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/favicon.png' },
      ],
    },
  },
  vite: {
    server: {
      // 与 npm run dev --host 配合，允许同事通过局域网 IP 访问
      host: true,
      port: 3013,
      strictPort: true,
      // 开发代理走本机后端；浏览器侧仍是相对路径 /api，不依赖对方机器的 localhost
      proxy: {
        '/api': { target: 'http://127.0.0.1:5679', changeOrigin: true },
        '/static': { target: 'http://127.0.0.1:5679', changeOrigin: true },
      },
    },
  },
  compatibilityDate: '2025-05-15',
})
