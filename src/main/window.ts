import { existsSync } from 'node:fs'
import path from 'node:path'
import { BrowserWindow, shell } from 'electron'

export interface WindowOptions {
  devServerUrl: string | null
  localUrl: string
  iconPath: string | null
  title: string
  onClosed: () => void
}

const MIN_WIDTH = 360
const MIN_HEIGHT = 480

export function createMainWindow(options: WindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#0f1115',
    title: options.title,
    icon: options.iconPath ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  const target = options.devServerUrl ?? options.localUrl
  void window.loadURL(target)

  window.once('ready-to-show', () => window.show())

  // Внешние ссылки открываем в системном браузере, внутри приложения их быть не должно.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(safeProtocol(url))) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault()
      if (/^https?:$/.test(safeProtocol(url))) void shell.openExternal(url)
    }
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[window] процесс отрисовки завершился:', details.reason)
  })

  window.on('closed', options.onClosed)

  return window
}

function safeProtocol(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    return ''
  }
}

export function resolveIconPath(): string | null {
  const candidates = [
    // сборка: иконки лежат рядом с приложением
    path.join(process.resourcesPath ?? '', 'icons', 'tray.png'),
    path.join(__dirname, '..', '..', 'build', 'icons', 'icon.png'),
    path.join(process.cwd(), 'build', 'icons', 'icon.png'),
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

export function resolveTrayIconPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'icons', 'tray.png'),
    path.join(__dirname, '..', '..', 'build', 'icons', 'tray.png'),
    path.join(process.cwd(), 'build', 'icons', 'tray.png'),
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}