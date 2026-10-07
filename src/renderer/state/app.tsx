import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  activeToken,
  api,
  setStoredToken,
  wsUrl,
  type AppState,
  type DateStr,
  type HabitDraft,
  type Settings,
} from '../api/client'
import { resolveLanguage, t, type Language } from '../../i18n'

export type Phase = 'loading' | 'onboarding' | 'login' | 'ready' | 'offline'

export interface Toast {
  id: number
  text: string
  tone: 'error' | 'info'
}

type TokenState = { status: 'pending' } | { status: 'none' } | { status: 'ready'; token: string }

interface AppContextValue {
  phase: Phase
  state: AppState | null
  connected: boolean
  toasts: Toast[]
  isDesktop: boolean
  offlineMessage: string
  retry: () => void
  notify: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  setup: (username: string, password: string) => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  createHabit: (draft: HabitDraft) => Promise<void>
  updateHabit: (id: string, changes: Partial<HabitDraft> & { archived?: boolean; sortOrder?: number }) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (orderedIds: string[]) => Promise<void>
  setEntry: (habitId: string, date: DateStr, value: number) => Promise<void>
  changeEntry: (habitId: string, date: DateStr, delta: number) => Promise<void>
  toggleEntry: (habitId: string, date: DateStr) => Promise<void>
  updateSettings: (changes: Partial<Settings>) => Promise<void>
  importData: (payload: unknown) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const MAX_TOASTS = 4

export function AppProvider({ children }: { children: ReactNode }): ReactNode {
  const [tokenState, setTokenState] = useState<TokenState>({ status: 'pending' })
  const [phase, setPhase] = useState<Phase>('loading')
  const [state, setState] = useState<AppState | null>(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [offlineMessage, setOfflineMessage] = useState('')
  const [bootKey, setBootKey] = useState(0)
  const toastId = useRef(1)
  // Быстрые повторные нажатия должны считаться от актуальных значений,
  // поэтому состояние читается через ref, а не через замыкание рендера.
  const stateRef = useRef<AppState | null>(null)
  stateRef.current = state

  const lang = resolveLanguage(
    state?.settings.language,
    typeof navigator === 'undefined' ? undefined : navigator.language,
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (text: string, tone: Toast['tone'] = 'error') => {
      const id = toastId.current++
      setToasts((current) => [...current, { id, text, tone }].slice(-MAX_TOASTS))
      setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 3000)
    },
    [dismissToast],
  )

  /** Перезагрузка состояния с защитой от «дождя» запросов. */
  const refresh = useCallback(async () => {
    try {
      const next = await api.state()
      setState(next)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null)
        setTokenState({ status: 'none' })
        setPhase('login')
        setState(null)
        return
      }
      notify(describeError(err, lang))
    }
  }, [notify, lang])

  // Первичное определение: настроена ли учётная запись и есть ли действующий токен.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setPhase('loading')
      setOfflineMessage('')
      try {
        const status = await api.authStatus()
        if (cancelled) return
        if (!status.configured) {
          setTokenState({ status: 'none' })
          setPhase('onboarding')
          return
        }
        const token = await activeToken()
        if (cancelled) return
        if (!token) {
          setTokenState({ status: 'none' })
          setPhase('login')
          return
        }
        setTokenState({ status: 'ready', token })
      } catch (err) {
        if (cancelled) return
        // Сервер не отвечает: с телефона это бывает, когда компьютер выключен
        // или в настройках выключен доступ из локальной сети.
        setTokenState({ status: 'none' })
        setOfflineMessage(describeError(err, lang))
        setPhase('offline')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [notify, bootKey])

  // Загрузка состояния и подписка на изменения с остальных устройств.
  useEffect(() => {
    if (tokenState.status !== 'ready') return
    let cancelled = false
    let socket: WebSocket | null = null
    let retry: number | null = null
    let attempt = 0

    void refresh()

    const connect = (): void => {
      if (cancelled) return
      socket = new WebSocket(wsUrl(tokenState.token))
      socket.onopen = () => {
        attempt = 0
        setConnected(true)
        void refresh()
      }
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string }
          if (payload.type === 'state:changed') void refresh()
        } catch {
          /* некорректное сообщение игнорируем */
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (cancelled) return
        attempt += 1
        const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5))
        retry = window.setTimeout(connect, delay)
      }
      socket.onerror = () => socket?.close()
    }

    connect()

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      if (retry !== null) window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', onVisible)
      setConnected(false)
      if (socket) {
        socket.onclose = null
        socket.close()
      }
    }
  }, [refresh, tokenState])

  // Переход в «готов» после первых успешных данных.
  useEffect(() => {
    if (tokenState.status !== 'ready') return
    if (state) setPhase('ready')
  }, [state, tokenState])

  // Тема
  useEffect(() => {
    const theme = state?.settings.theme ?? 'system'
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = (): void => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
    }
    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [state?.settings.theme])

  const setup = useCallback(
    async (username: string, password: string) => {
      const result = await api.setup(username, password)
      setStoredToken(result.token)
      setTokenState({ status: 'ready', token: result.token })
      setPhase('ready')
      notify(t(lang, 'toast.setupDone'), 'info')
    },
    [notify, lang],
  )

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await api.login(username, password)
      setStoredToken(result.token)
      setTokenState({ status: 'ready', token: result.token })
      setPhase('ready')
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* локальный токен всё равно чистим */
    }
    setStoredToken(null)
    setState(null)
    setTokenState({ status: 'none' })
    setPhase('login')
  }, [])

  /** Обёртка мутации: показывает ошибку и перечитывает состояние. */
  const run = useCallback(
    async <T,>(action: () => Promise<T>, optimistic?: () => void): Promise<void> => {
      optimistic?.()
      try {
        await action()
      } catch (err) {
        notify(describeError(err, lang))
      } finally {
        void refresh()
      }
    },
    [notify, refresh, lang],
  )

  const createHabit = useCallback(
    async (draft: HabitDraft) => run(() => api.createHabit(draft)),
    [run],
  )

  const updateHabit = useCallback(
    async (id: string, changes: Partial<HabitDraft> & { archived?: boolean; sortOrder?: number }) =>
      run(() => api.updateHabit(id, changes)),
    [run],
  )

  const deleteHabit = useCallback(async (id: string) => run(() => api.deleteHabit(id)), [run])

  const reorderHabits = useCallback(
    async (orderedIds: string[]) => {
      await run(
        () => Promise.all(orderedIds.map((id, index) => api.updateHabit(id, { sortOrder: index }))),
        () =>
          setState((current) => {
            if (!current) return current
            const order = new Map(orderedIds.map((id, index) => [id, index] as const))
            return {
              ...current,
              habits: current.habits.map((habit) => {
                const index = order.get(habit.id)
                return index === undefined ? habit : { ...habit, sortOrder: index }
              }),
            }
          }),
      )
    },
    [run],
  )

  const setEntry = useCallback(
    async (habitId: string, date: DateStr, value: number) =>
      run(() => api.setEntry(habitId, date, value), () => patchEntry(habitId, date, value)),
    [run],
  )

  const changeEntry = useCallback(
    async (habitId: string, date: DateStr, delta: number) =>
      run(() => api.changeEntry(habitId, date, delta), () => {
        const current = currentValue(habitId, date)
        patchEntry(habitId, date, Math.max(0, current + delta))
      }),
    [run],
  )

  const toggleEntry = useCallback(
    async (habitId: string, date: DateStr) => {
      const habit = stateRef.current?.habits.find((h) => h.id === habitId)
      const current = currentValue(habitId, date)
      const next =
        habit?.type === 'count'
          ? current >= (habit.targetPerDay ?? 1)
            ? 0
            : habit.targetPerDay
          : current >= 1
            ? 0
            : 1
      await run(() => api.toggleEntry(habitId, date), () => patchEntry(habitId, date, next))
    },
    [run],
  )

  const updateSettings = useCallback(
    async (changes: Partial<Settings>) => run(() => api.updateSettings(changes)),
    [run],
  )

  const importData = useCallback(
    async (payload: unknown) => {
      await run(() => api.importData(payload))
      notify(t(lang, 'toast.imported'), 'info')
    },
    [notify, run, lang],
  )

  function currentValue(habitId: string, date: DateStr): number {
    return stateRef.current?.entries[habitId]?.[date] ?? 0
  }

  /** Мгновенная реакция на нажатие; итоговые серии всё равно считает сервер. */
  function patchEntry(habitId: string, date: DateStr, value: number): void {
    setState((current) => {
      if (!current) return current
      const bucket = { ...(current.entries[habitId] ?? {}) }
      if (value <= 0) delete bucket[date]
      else bucket[date] = value
      return { ...current, entries: { ...current.entries, [habitId]: bucket } }
    })
  }

  const retry = useCallback(() => setBootKey((key) => key + 1), [])

  const value = useMemo<AppContextValue>(
    () => ({
      phase,
      state,
      connected,
      toasts,
      isDesktop: Boolean(window.habitDesktop),
      offlineMessage,
      retry,
      notify,
      dismissToast,
      setup,
      login,
      logout,
      refresh,
      createHabit,
      updateHabit,
      deleteHabit,
      reorderHabits,
      setEntry,
      changeEntry,
      toggleEntry,
      updateSettings,
      importData,
    }),
    [
      phase,
      state,
      connected,
      toasts,
      offlineMessage,
      retry,
      notify,
      dismissToast,
      setup,
      login,
      logout,
      refresh,
      createHabit,
      updateHabit,
      deleteHabit,
      reorderHabits,
      setEntry,
      changeEntry,
      toggleEntry,
      updateSettings,
      importData,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp вызван вне AppProvider')
  return context
}

function describeError(err: unknown, lang: Language): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return t(lang, 'error.generic')
}