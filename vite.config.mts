import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Порт локального сервера приложения. Задаётся в скриптах package.json
// (HABIT_PORT), чтобы Vite проксировал ровно туда же, куда сядет Electron.
// Значение по умолчанию совпадает с DEFAULT_SERVER_PORT в src/main/model.ts.
const apiPort = Number(process.env.HABIT_PORT ?? 47821)
const rendererPort = Number(process.env.HABIT_VITE_PORT ?? 5173)

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'chrome120',
  },
  server: {
    // 0.0.0.0 — чтобы интерфейс был доступен с телефона и планшета в локальной сети
    host: '0.0.0.0',
    port: rendererPort,
    strictPort: true,
    // доступ по IP-адресу локальной сети, а не только по localhost
    allowedHosts: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}` },
      '/ws': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
    },
  },
})
