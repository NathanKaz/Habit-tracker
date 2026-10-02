import type { AppState, DateStr, Habit, ServerInfo, Settings, StreakStats } from '../../main/domain/types'

export interface HabitDraft {
  name: string
  color: string
  icon: string
  type: Habit['type']
  targetPerDay: number
  unit: string
  schedule: Habit['schedule']
  startDate: DateStr
  endDate: DateStr | null
}

const TOKEN_KEY = 'habit-tracker:token'

let cachedToken: string | null | undefined
let cachedDesktopToken: string | null = null

/** Токен окна на этом компьютере: всегда действителен, пароль не спрашивается. */
async function desktopToken(): Promise<string | null> {
  if (cachedDesktopToken !== null) return cachedDesktopToken
  const bridge = window.habitDesktop
  if (!bridge) return null
  try {
    cachedDesktopToken = (await bridge.getToken()) || null
  } catch {
    cachedDesktopToken = null
  }
  return cachedDesktopToken
}

export function storedToken(): string | null {
  if (cachedToken !== undefined) return cachedToken
  try {
    cachedToken = localStorage.getItem(TOKEN_KEY)
  } catch {
    cachedToken = null
  }
  return cachedToken
}

export function setStoredToken(token: string | null): void {
  cachedToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* приватный режим браузера — токен держим только в памяти */
  }
}

export async function activeToken(): Promise<string> {
  const desktop = await desktopToken()
  return desktop ?? storedToken() ?? ''
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}, asText = false): Promise<T> {
  const token = await activeToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers })
  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  if (text && !asText) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Ошибка запроса (${response.status})`
    throw new ApiError(message, response.status)
  }
  return (asText ? text : payload) as T
}

const get = <T>(path: string): Promise<T> => request<T>(path)
const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const patch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const put = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del = <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' })

export interface AuthStatus {
  configured: boolean
}

export const api = {
  authStatus: () => get<AuthStatus>('/api/auth/status'),
  setup: (username: string, password: string) => post<{ token: string; username: string }>('/api/auth/setup', { username, password }),
  login: (username: string, password: string) => post<{ token: string; username: string }>('/api/auth/login', { username, password }),
  logout: () => post<{ ok: boolean }>('/api/auth/logout'),
  changeUsername: (username: string) => post<{ ok: boolean }>('/api/auth/username', { username }),
  changePassword: (password: string) => post<{ ok: boolean; token?: string }>('/api/auth/password', { password }),

  state: () => get<AppState>('/api/state'),

  createHabit: (draft: HabitDraft) => post<Habit>('/api/habits', draft),
  updateHabit: (id: string, changes: Partial<HabitDraft> & { archived?: boolean }) =>
    patch<Habit>(`/api/habits/${encodeURIComponent(id)}`, changes),
  deleteHabit: (id: string) => del<{ ok: boolean }>(`/api/habits/${encodeURIComponent(id)}`),

  setEntry: (habitId: string, date: DateStr, value: number) =>
    put<{ date: DateStr; value: number }>(`/api/entries/${encodeURIComponent(habitId)}/${date}`, { value }),
  changeEntry: (habitId: string, date: DateStr, delta: number) =>
    post<{ date: DateStr; value: number }>(`/api/entries/${encodeURIComponent(habitId)}/${date}/delta`, { delta }),
  toggleEntry: (habitId: string, date: DateStr) =>
    post<{ date: DateStr; value: number }>(`/api/entries/${encodeURIComponent(habitId)}/${date}/toggle`),

  updateSettings: (changes: Partial<Settings>) => patch<Settings>('/api/settings', changes),
  importData: (payload: unknown) => post<{ ok: boolean }>('/api/import', payload),
}

/**
 * Выгрузка копии. Обычная ссылка не подошла бы: заголовок с токеном браузер
 * при переходе по ссылке не отправляет, и сервер ответил бы 401.
 */
export async function downloadExport(): Promise<void> {
  const text = await request<string>('/api/export', {}, true)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `habit-tracker-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Адрес, по которому этот клиент открывает приложение. */
export function wsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
}

export type { AppState, ServerInfo, StreakStats, Settings, Habit, DateStr }