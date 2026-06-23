import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('@apps-in-toss')) {
            return 'toss-vendor'
          }
          if (id.includes('/features/goldcat/')) {
            return 'goldcat'
          }
        },
      },
    },
  },
  server: {
    watch: {
      // Windows에서 대용량 mp4 복사·재생 시 EBUSY로 dev 서버가 죽는 것 방지 (정적 제공에는 영향 없음)
      ignored: ['**/public/videos/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
