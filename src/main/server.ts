import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { existsSync } from 'node:fs'
import express, { type Express } from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { LoginThrottle, hashToken, safeEqual } from './auth'
import { lanUrls as collectLanUrls } from './net'
import { createApiRouter } from './api/routes'
import type { Settings } from './domain/types'
import type { Store } from './store'

export interface AppServerOptions {
  store: Store
  desktopToken: string
  /** Корень собранного интерфейса. В dev-режиме его раздаёт Vite. */
  rendererDir: string | null
  /** Вызывается, когда окну нужно перезагрузить из-за смены адреса. */
  onRebind: () => void
  /** Вызывается при любом изменении настроек: главный процесс решает, что переприменить. */
  onSettingsChange?: (previous: Settings, next: Settings) => void
  log: (message: string) => void
}

/**
 * HTTP-сервер — единственный источник истины для всех клиентов: и для окна на
 * этом компьютере, и для телефона в локальной сети. Поэтому и данные, и API
 * живут здесь, а не в main-процессе Electron.
 */
export class AppServer {
  private readonly app: Express
  private readonly http: Server
  private readonly wss: WebSocketServer
  private readonly clients = new Set<WebSocket>()
  private readonly throttle = new LoginThrottle()
  private readonly options: AppServerOptions
  private readonly rendererDir: string | null
  private boundPort = 0
  private started = false
  private midnightTimer: NodeJS.Timeout | null = null
  private readonly sweepTimer: NodeJS.Timeout

  constructor(options: AppServerOptions) {
    this.options = options
    this.rendererDir = options.rendererDir
    this.app = express()
    this.http = createServer(this.app)
    this.wss = new WebSocketServer({ noServer: true })

    this.http.on('upgrade', (req, socket, head) => {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost')
      if (requestUrl.pathname !== '/ws') {
        socket.destroy()
        return
      }
      const token = requestUrl.searchParams.get('token') ?? ''
      if (!this.isTokenValid(token)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws))
    })

    this.app.disable('x-powered-by')
    this.app.use((req, res, next) => this.securityHeaders(req, res, next))
    this.app.use((req, res, next) => this.originGuard(req, res, next))
    this.app.use(express.json({ limit: '10mb' }))

    const api = createApiRouter({
      store: options.store,
      desktopToken: options.desktopToken,
      lanUrls: (port) => collectLanUrls(port),
      throttle: this.throttle,
      broadcast: () => this.broadcast(),
      onSettingsChanged: (previous) => this.handleSettingsChange(previous),
    })
    this.app.use('/api', api)
    this.app.get('/api/health', (_req, res) => res.json({ ok: true, port: this.boundPort }))

    if (this.rendererDir) this.mountRenderer()
    this.app.use(
      (err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) =>
        this.errorHandler(err, req, res, next),
    )

    this.sweepTimer = setInterval(() => this.throttle.sweep(), 60_000)
    this.sweepTimer.unref()
  }

  private securityHeaders(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        // Vite в dev-режиме подгружает модули и шлёт инлайновые стили
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self' ws: wss:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    )
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
    next()
  }

  /**
   * Изменяющие запросы должны приходить со страницы самого приложения.
   * Браузер всегда присылает Origin для POST/PUT/PATCH/DELETE, поэтому подделка
   * из чужой страницы отсеивается сравнением с Host.
   */
  private originGuard(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const origin = req.get('origin')
    const host = req.get('host')
    if (origin && host) {
      let originHost: string
      try {
        originHost = new URL(origin).host
      } catch {
        res.status(403).json({ error: 'Invalid request origin' })
        return
      }
      if (originHost !== host) {
        res.status(403).json({ error: 'Invalid request origin' })
        return
      }
    }
    next()
  }

  private mountRenderer(): void {
    const dir = this.rendererDir as string
    const indexFile = path.join(dir, 'index.html')
    this.app.use(
      express.static(dir, {
        index: false,
        setHeaders: (res, filePath) => {
          // Файлы со сборкой имеют хеш в имени и не меняются
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          } else {
            res.setHeader('Cache-Control', 'no-cache')
          }
        },
      }),
    )
    this.app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/api')) return next()
      if (!existsSync(indexFile)) return next()
      res.setHeader('Cache-Control', 'no-cache')
      return res.sendFile('index.html', { root: dir })
    })
  }

  private errorHandler(err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (res.headersSent) {
      next(err)
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    this.options.log(`[server] ошибка запроса: ${message}`)
    res.status(500).json({ error: 'Internal server error' })
  }

  private isTokenValid(token: string): boolean {
    if (!token) return false
    if (this.options.desktopToken && safeEqual(token, this.options.desktopToken)) return true
    const tokenHash = hashToken(token)
    return this.options.store.raw.sessions.some((s) => s.tokenHash === tokenHash)
  }

  private onConnection(ws: WebSocket): void {
    this.clients.add(ws)
    ws.on('close', () => this.clients.delete(ws))
    ws.on('error', () => this.clients.delete(ws))
    ws.on('message', () => {
      // Клиент только слушает изменения, отвечать на сообщения не нужно.
    })
    this.send(ws, { type: 'state:changed', reason: 'connected' })
  }

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(payload))
    } catch {
      this.clients.delete(ws)
    }
  }

  broadcast(reason = 'changed'): void {
    this.broadcastMessage({ type: 'state:changed', reason })
    this.scheduleMidnightBroadcast()
  }

  broadcastMessage(payload: unknown): void {
    const text = JSON.stringify(payload)
    for (const ws of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(ws)
        continue
      }
      try {
        ws.send(text)
      } catch {
        this.clients.delete(ws)
      }
    }
  }

  /** В полночь «сегодня» меняется — сообщаем клиентам, чтобы пересчитали серии. */
  private scheduleMidnightBroadcast(): void {
    if (this.midnightTimer) return
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0)
    this.midnightTimer = setTimeout(() => {
      this.midnightTimer = null
      this.broadcast('midnight')
    }, Math.max(1000, next.getTime() - now.getTime()))
    this.midnightTimer.unref()
  }

  private handleSettingsChange(previous: Settings): void {
    const next = this.options.store.settings
    this.options.onSettingsChange?.(previous, next)
    const portChanged = previous.serverPort !== next.serverPort
    const hostChanged = previous.remoteAccessEnabled !== next.remoteAccessEnabled
    if (!portChanged && !hostChanged) return
    // Перезапуск откладываем, чтобы ответ на сам запрос успел уйти клиенту.
    setTimeout(() => {
      void this.rebind()
        .then(() => this.options.onRebind())
        .catch((err) => this.options.log(`[server] не удалось сменить адрес: ${String(err)}`))
    }, 300)
  }

  async start(): Promise<number> {
    const { store } = this.options
    const port = await this.listen(
      store.settings.serverPort,
      store.settings.remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1',
    )
    this.started = true
    this.options.log(
      `[server] слушаю ${store.settings.remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1'}:${port}` +
        (store.settings.remoteAccessEnabled ? `, в сети: ${collectLanUrls(port).join(', ') || 'нет'}` : ''),
    )
    this.scheduleMidnightBroadcast()
    return port
  }

  private listen(port: number, host: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException): void => {
        this.http.removeListener('error', onError)
        reject(err)
      }
      this.http.once('error', onError)
      this.http.listen(port, host, () => {
        this.http.removeListener('error', onError)
        const address = this.http.address()
        this.boundPort = typeof address === 'object' && address !== null ? address.port : port
        resolve(this.boundPort)
      })
    })
  }

  /**
   * Закрытие без зависания: keep-alive и WebSocket-соединения сами по себе не
   * завершают сервер, поэтому обрываем их и страхуемся таймаутом.
   */
  private async shutdownHttp(): Promise<void> {
    if (!this.started) return
    this.started = false
    await new Promise<void>((resolve) => {
      let settled = false
      const done = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(() => {
        this.http.closeAllConnections?.()
        done()
      }, 2000)
      timer.unref()
      this.http.close(done)
      this.http.closeIdleConnections?.()
    })
  }

  async rebind(): Promise<number> {
    for (const ws of this.clients) {
      try {
        ws.terminate()
      } catch {
        /* клиент уже отвалился */
      }
    }
    this.clients.clear()
    await this.shutdownHttp()
    const { store } = this.options
    const port = await this.listen(
      store.settings.serverPort,
      store.settings.remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1',
    )
    this.started = true
    this.options.log(`[server] слушаю ${store.settings.remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1'}:${port}`)
    this.scheduleMidnightBroadcast()
    return port
  }

  async close(): Promise<void> {
    if (this.midnightTimer) clearTimeout(this.midnightTimer)
    clearInterval(this.sweepTimer)
    for (const ws of this.clients) {
      try {
        ws.close(1001, 'Application is closing')
      } catch {
        /* клиент уже отвалился */
      }
    }
    this.clients.clear()
    this.wss.close()
    await this.shutdownHttp()
  }
}