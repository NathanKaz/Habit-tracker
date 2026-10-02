import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { BrowserWindow, app, ipcMain } from 'electron'
import type { Settings } from './domain/types'
import { resolveLanguage, t, type Language } from '../i18n'
import { lanUrls } from './net'
import { DEFAULT_SERVER_PORT, devApiPort, VITE_DEV_URL } from '../shared/dev'
import { AppServer } from './server'
import { Store } from './store'
import { AppTray } from './tray'
import { createMainWindow, resolveIconPath, resolveTrayIconPath } from './window'

const isDev = process.env.HABIT_DEV === '1'
const VITE_URL = process.env.HABIT_VITE_URL ?? VITE_DEV_URL
const APP_NAME = 'Habit Tracker'

const log = (message: string): void => console.log(`[app] ${message}`)

/** Токен для окна на этом компьютере: действует всегда, в вводе пароля не участвует. */
const desktopToken = randomBytes(32).toString('hex')

let store: Store | null = null
let server: AppServer | null = null
let tray: AppTray | null = null
let mainWindow: BrowserWindow | null = null
let quitting = false

function currentLanguage(): Language {
  return resolveLanguage(store?.settings.language, app.getLocale())
}

function localUrl(): string {
  return `http://127.0.0.1:${store?.settings.serverPort ?? DEFAULT_SERVER_PORT}`
}

function serverInfo() {
  const settings = store?.settings
  if (!settings) return { port: 0, remoteAccessEnabled: false, lanUrls: [] }
  return {
    port: settings.serverPort,
    remoteAccessEnabled: settings.remoteAccessEnabled,
    lanUrls: settings.remoteAccessEnabled ? lanUrls(settings.serverPort) : [],
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    openMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function openMainWindow(): void {
  mainWindow = createMainWindow({
    devServerUrl: isDev ? VITE_URL : null,
    localUrl: localUrl(),
    iconPath: resolveIconPath(),
    title: t(currentLanguage(), 'app.name'),
    onClosed: () => {
      mainWindow = null
    },
  })

  // Закрытие окна прячет приложение в трей, а не завершает его: в этом режиме
  // локальный сервер должен продолжать отдавать интерфейс телефону.
  mainWindow.on('close', (event) => {
    if (quitting || !store?.settings.trayEnabled) return
    event.preventDefault()
    mainWindow?.hide()
  })
}

function applyAutoLaunch(settings: Settings): void {
  try {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, args: ['--hidden'] })
  } catch (err) {
    log(`не удалось настроить автозапуск: ${String(err)}`)
  }
}

function syncTray(): void {
  if (!store) return
  const info = serverInfo()
  const urls = info.lanUrls
  const lang = currentLanguage()
  tray?.setTitle(urls.length > 0 ? t(lang, 'tray.inNetwork', { url: urls[0] ?? '' }) : t(lang, 'tray.localOnly'))
  tray?.refresh()
}

async function bootstrap(): Promise<void> {
  store = await Store.open(app.getPath('userData'))

  // В разработке порт задаётся извне: Vite уже проксирует на него запросы.
  // Записываем значение в настройки, чтобы окно, трей и QR-код показывали
  // настоящий адрес, а не расходились с тем, где реально слушает сервер.
  if (isDev) {
    const devPort = devApiPort()
    if (Number.isInteger(devPort) && devPort !== store.settings.serverPort) {
      store.updateSettings({ serverPort: devPort })
    }
  }

  const trayIcon = resolveTrayIconPath()
  tray = new AppTray({
    iconPath: trayIcon,
    getLanguage: currentLanguage,
    getServerInfo: serverInfo,
    getWindow: () => mainWindow,
    onOpenWindow: showMainWindow,
    onQuit: quit,
  })
  tray.create()

  server = new AppServer({
    store,
    desktopToken,
    rendererDir: isDev ? null : path.join(__dirname, '..', 'renderer'),
    onSettingsChange: (previous, next) => {
      // Автозапуск и трей читаются вне окна, поэтому применяем их сразу,
      // иначе переключатель в настройках сработал бы только после перезапуска.
      if (previous.launchAtLogin !== next.launchAtLogin) applyAutoLaunch(next)
      syncTray()
    },
    onRebind: () => {
      // Сменился адрес или порт: reload() перезагрузил бы прежний адрес и
      // оставил окно без сервера, поэтому грузим новый явно.
      if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(isDev ? VITE_URL : localUrl())
    },
    log,
  })

  try {
    await server.start()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`не удалось занять порт ${store.settings.serverPort}: ${message}`)
    tray.setTitle(t(currentLanguage(), 'tray.portBusy', { port: store.settings.serverPort }))
  }

  syncTray()
  applyAutoLaunch(store.settings)

  const startedHidden = process.argv.includes('--hidden') && app.getLoginItemSettings().wasOpenedAtLogin
  if (!startedHidden) showMainWindow()
}

function quit(): void {
  quitting = true
  void (async () => {
    try {
      await server?.close()
      await store?.flush()
    } catch (err) {
      log(`ошибка при завершении: ${String(err)}`)
    }
    app.quit()
  })()
}

// Токен выдаётся только нашему собственному окну: у страницы с телефона
// preload отсутствует, а origin проверяется по адресу главного окна.
ipcMain.handle('desktop:token', (event) => {
  const sender = event.sender
  if (!mainWindow || sender.id !== mainWindow.webContents.id) return ''
  return desktopToken
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(async () => {
    app.setName(APP_NAME)
    void bootstrap()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
      else showMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    // На других платформах закрытие всех окон завершает приложение; здесь
    // приложение живёт в трее, пока пользователь не выберет «Выход».
    if (process.platform !== 'darwin') {
      if (!store?.settings.trayEnabled) quit()
    }
  })

  app.on('before-quit', () => {
    quitting = true
  })
}

// При выходе через завершение сеанса или systemctl приходит сигнал, а не
// событие окна: без него отложенная запись на диск могла бы не состояться.
process.on('SIGTERM', () => quit())
process.on('SIGINT', () => quit())

process.on('uncaughtException', (err) => {
  log(`необработанная ошибка: ${err instanceof Error ? err.stack : String(err)}`)
})

process.on('unhandledRejection', (reason) => {
  log(`необработанный отказ промиса: ${String(reason)}`)
})