/**
 * Порты и адреса разработки. Файл читают и Vite-конфиг, и main-процесс,
 * поэтому значение нельзя дублировать: Vite проксирует запросы на порт,
 * который затем занимает сам Electron.
 */

/** Порт локального сервера приложения: и в сборке, и в разработке. */
export const DEFAULT_SERVER_PORT = 47821

/** Порт дев-сервера Vite с интерфейсом. */
export const VITE_DEV_PORT = 5173

export const VITE_DEV_URL = `http://127.0.0.1:${VITE_DEV_PORT}`

/**
 * Порт API для dev-режима. Vite получает то же значение через HABIT_PORT,
 * поэтому в разработке сервер всегда слушает там, куда проксирует Vite.
 */
export function devApiPort(): number {
  return Number(process.env.HABIT_PORT ?? DEFAULT_SERVER_PORT)
}