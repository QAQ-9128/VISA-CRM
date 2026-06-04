import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 双栈监听：本机 localhost 解析到 ::1，但默认只绑一个栈会导致 127.0.0.1 连不上。
  // host '::' 让 IPv4(127.0.0.1) 与 IPv6(::1/localhost) 都可达，开哪个地址都行。
  server: { host: '::', port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
