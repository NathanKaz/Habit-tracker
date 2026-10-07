import { Router, type Request, type Response } from 'express'
import { ZodError } from 'zod'
import type { Settings } from '../domain/types'
import { isDateStr, todayStr } from '../domain/dates'
import type { Store } from '../store'
import {
  LoginThrottle,
  hashPassword,
  hashToken,
  newSessionToken,
  normalizeUsername,
  passwordProblems,
  safeEqual,
  verifyPassword,
} from '../auth'
import {
  credentialsSchema,
  entryDeltaSchema,
  entryValueSchema,
  habitInputSchema,
  habitPatchSchema,
  importSchema,
  passwordSchema,
  settingsSchema,
  usernameSchema,
} from './schemas'
import { buildState } from './state'
import type { LanUrlProvider } from './types'

export interface RouterContext {
  store: Store
  desktopToken: string
  lanUrls: LanUrlProvider
  throttle: LoginThrottle
  broadcast: () => void
  /** Вызывается, если смена настроек требует перезапуска HTTP-сервера. */
  onSettingsChanged: (previous: Settings) => void
}

interface AuthedRequest extends Request {
  authKind?: 'desktop' | 'session'
  tokenHash?: string
}

function fail(res: Response, status: number, error: string): void {
  res.status(status).json({ error })
}

function firstIssue(error: ZodError): string {
  return error.issues[0]?.message ?? 'Invalid data'
}

function clientIp(req: Request): string {
  // Сервер слушает сетевой интерфейс напрямую, поэтому заголовкам прокси
  // доверять нельзя: иначе ограничение попыток входа обходится подменой X-Forwarded-For.
  return req.socket.remoteAddress ?? 'unknown'
}

function isLoopback(ip: string): boolean {
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')
}

function userAgent(req: Request): string {
  return (req.get('user-agent') ?? '').slice(0, 160)
}

export function createApiRouter(ctx: RouterContext): Router {
  const { store, throttle } = ctx
  const router = Router()

  const requireAuth = (req: Request, res: Response, next: (err?: unknown) => void): void => {
    const header = req.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return fail(res, 401, 'Authentication required')
    const authed = req as AuthedRequest
    if (ctx.desktopToken && safeEqual(token, ctx.desktopToken)) {
      authed.authKind = 'desktop'
      // Рендерер приложения работает под токеном компьютера; сохранённый вход
      // присылаем отдельным заголовком, чтобы показать «Это устройство».
      const sessionToken = (req.get('x-habit-session') ?? '').trim()
      if (sessionToken) {
        const sessionHash = hashToken(sessionToken)
        if (store.raw.sessions.some((s) => s.tokenHash === sessionHash)) authed.tokenHash = sessionHash
      }
      return next()
    }
    const tokenHash = hashToken(token)
    const session = store.raw.sessions.find((s) => s.tokenHash === tokenHash)
    if (!session) return fail(res, 401, 'Session is invalid, please sign in again')
    authed.authKind = 'session'
    authed.tokenHash = tokenHash
    store.touchSession(tokenHash)
    return next()
  }

  // --- вход и учётная запись -------------------------------------------------

  router.get('/auth/status', (_req, res) => {
    res.json({ configured: store.raw.user !== null })
  })

  // Создание учётной записи доступно только с самого компьютера. Пока пароль не
  // задан, войти нельзя ни с кем, но закрывать путь всё равно нужно.
  router.post('/auth/setup', async (req, res) => {
    if (!isLoopback(clientIp(req))) {
      return fail(res, 403, 'The account can only be created on this computer')
    }
    if (store.raw.user) return fail(res, 409, 'Account already exists')

    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const problems = passwordProblems(parsed.data.password)
    if (problems.length > 0) return fail(res, 400, `${problems.join('. ')}.`)

    const username = normalizeUsername(parsed.data.username)
    const { salt, hash } = await hashPassword(parsed.data.password)
    store.setUser({ username, passwordHash: hash, salt, createdAt: new Date().toISOString() })

    const token = newSessionToken()
    store.addSession(hashToken(token), userAgent(req))
    res.status(201).json({ token, username })
  })

  router.post('/auth/login', async (req, res) => {
    const ip = clientIp(req)
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid username or password')

    const username = normalizeUsername(parsed.data.username)
    const waitMs = throttle.retryAfterMs(ip, username)
    if (waitMs > 0) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(waitMs / 60000)} min.` })
    }

    const user = store.raw.user
    // Хеш пароля проверяется всегда, даже если такого пользователя нет, чтобы по
    // времени ответа нельзя было выяснить, какие логины существуют.
    const okPass = await verifyPassword(
      parsed.data.password,
      user?.salt ?? 'no-such-user',
      user?.passwordHash ?? '',
    )
    const okUser = user !== null && safeEqual(user.username, username)
    if (!okUser || !okPass) {
      throttle.registerFailure(ip, username)
      return fail(res, 401, 'Invalid username or password')
    }

    throttle.registerSuccess(ip, username)
    const token = newSessionToken()
    store.addSession(hashToken(token), userAgent(req))
    res.json({ token, username: user.username })
  })

  router.post('/auth/logout', requireAuth, (req, res) => {
    const tokenHash = (req as AuthedRequest).tokenHash
    if (tokenHash) store.removeSession(tokenHash)
    res.json({ ok: true })
  })

  router.post('/auth/password', requireAuth, async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const problems = passwordProblems(parsed.data.password)
    if (problems.length > 0) return fail(res, 400, `${problems.join('. ')}.`)
    const user = store.raw.user
    if (!user) return fail(res, 400, 'Account is not configured')

    const { salt, hash } = await hashPassword(parsed.data.password)
    store.setUser({ ...user, passwordHash: hash, salt })
    // Все прошлые сессии обрываются: пароль изменился, входить нужно заново.
    // Текущему клиенту выдаём новый токен, иначе он сам был бы отключён.
    store.raw.sessions = []
    const token = newSessionToken()
    store.addSession(hashToken(token), userAgent(req))
    ctx.broadcast()
    res.json({ ok: true, token })
  })

  router.post('/auth/username', requireAuth, (req, res) => {
    const parsed = usernameSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const user = store.raw.user
    if (!user) return fail(res, 400, 'Account is not configured')
    store.setUser({ ...user, username: normalizeUsername(parsed.data.username) })
    ctx.broadcast()
    res.json({ ok: true })
  })

  // --- активные входы --------------------------------------------------------

  router.get('/sessions', requireAuth, (req, res) => {
    const currentHash = (req as AuthedRequest).tokenHash
    res.json({
      sessions: store.listSessions().map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        current: currentHash !== undefined && session.tokenHash === currentHash,
      })),
    })
  })

  router.delete('/sessions/:id', requireAuth, (req, res) => {
    const id = req.params.id as string
    const session = store.raw.sessions.find((item) => item.id === id)
    if (!session) return fail(res, 404, 'Sign-in not found')
    const currentHash = (req as AuthedRequest).tokenHash
    if (currentHash && session.tokenHash === currentHash) {
      return fail(res, 400, 'Use sign out to end the current session')
    }
    store.removeSessionById(id)
    res.json({ ok: true })
  })

  // --- состояние -------------------------------------------------------------

  router.get('/state', requireAuth, (_req, res) => {
    res.json(buildState({ store, lanUrls: ctx.lanUrls }))
  })

  // --- привычки --------------------------------------------------------------

  router.post('/habits', requireAuth, (req, res) => {
    const parsed = habitInputSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const input = parsed.data
    const habit = store.createHabit({
      ...input,
      targetPerDay: input.type === 'count' ? input.targetPerDay : 1,
      endDate: input.endDate && input.endDate < input.startDate ? null : input.endDate,
    })
    ctx.broadcast()
    res.status(201).json(habit)
  })

  router.patch('/habits/:id', requireAuth, (req, res) => {
    const parsed = habitPatchSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const patch = parsed.data
    if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) {
      return fail(res, 400, 'End date is before start date')
    }
    const habit = store.updateHabit(req.params.id as string, patch)
    if (!habit) return fail(res, 404, 'Habit not found')
    ctx.broadcast()
    res.json(habit)
  })

  router.delete('/habits/:id', requireAuth, (req, res) => {
    if (!store.deleteHabit(req.params.id as string)) return fail(res, 404, 'Habit not found')
    ctx.broadcast()
    res.json({ ok: true })
  })

  // --- отметки выполнения ----------------------------------------------------

  function badDate(res: Response): void {
    fail(res, 400, 'Date must be in YYYY-MM-DD format')
  }

  function requireHabit(res: Response, habitId: string): boolean {
    if (!store.habit(habitId)) {
      fail(res, 404, 'Habit not found')
      return false
    }
    return true
  }

  function notFuture(res: Response, date: string): boolean {
    if (date > todayStr()) {
      fail(res, 400, 'Marks cannot be set for future dates')
      return false
    }
    return true
  }

  router.put('/entries/:habitId/:date', requireAuth, (req, res) => {
    const habitId = req.params.habitId as string
    const date = req.params.date as string
    if (!isDateStr(date)) return badDate(res)
    if (!notFuture(res, date)) return undefined
    if (!requireHabit(res, habitId)) return undefined
    const parsed = entryValueSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const value = store.setEntry(habitId, date, parsed.data.value)
    ctx.broadcast()
    return res.json({ date, value })
  })

  router.post('/entries/:habitId/:date/delta', requireAuth, (req, res) => {
    const habitId = req.params.habitId as string
    const date = req.params.date as string
    if (!isDateStr(date)) return badDate(res)
    if (!notFuture(res, date)) return undefined
    if (!requireHabit(res, habitId)) return undefined
    const parsed = entryDeltaSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const value = store.adjustEntry(habitId, date, parsed.data.delta)
    ctx.broadcast()
    return res.json({ date, value })
  })

  router.post('/entries/:habitId/:date/toggle', requireAuth, (req, res) => {
    const habitId = req.params.habitId as string
    const date = req.params.date as string
    if (!isDateStr(date)) return badDate(res)
    if (!notFuture(res, date)) return undefined
    if (!requireHabit(res, habitId)) return undefined
    const value = store.toggleEntry(habitId, date)
    ctx.broadcast()
    return res.json({ date, value })
  })

  // --- настройки -------------------------------------------------------------

  router.patch('/settings', requireAuth, (req, res) => {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error))
    const previous = { ...store.settings }
    const next = store.updateSettings(parsed.data)
    ctx.onSettingsChanged(previous)
    ctx.broadcast()
    res.json(next)
  })

  // --- резервная копия -------------------------------------------------------

  router.get('/export', requireAuth, (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="habit-tracker-${todayStr()}.json"`)
    res.type('application/json').send(store.exportJson())
  })

  router.post('/import', requireAuth, (req, res) => {
    const parsed = importSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'File is corrupted or has an invalid format')
    try {
      store.importJson(JSON.stringify(req.body), true)
    } catch {
      return fail(res, 400, 'File is corrupted or has an invalid format')
    }
    ctx.broadcast()
    return res.json({ ok: true })
  })

  return router
}
