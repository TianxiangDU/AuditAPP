import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // 数据中台 API
      '/api/v1': {
        target: 'http://115.190.44.247',
        changeOrigin: true,
      },
      // App 端 API（本地后端）
      '/api/app': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
