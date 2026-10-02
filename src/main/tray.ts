import { Menu, Tray, clipboard, nativeImage, type BrowserWindow } from 'electron'
import type { ServerInfo } from './domain/types'

export interface TrayOptions {
  iconPath: string | null
  appName: string
  getServerInfo: () => ServerInfo
  getWindow: () => BrowserWindow | null
  onQuit: () => void
  onOpenWindow: () => void
}

export class AppTray {
  private tray: Tray | null = null

  constructor(private readonly options: TrayOptions) {}

  get available(): boolean {
    return this.tray !== null
  }

  create(): void {
    if (this.tray) return
    const image = this.options.iconPath ? nativeImage.createFromPath(this.options.iconPath) : nativeImage.createEmpty()
    // На Linux иконка без размера рисуется размытой в трее.
    if (!image.isEmpty()) image.resize({ width: 22, height: 22 })
    try {
      this.tray = new Tray(image)
    } catch (err) {
      // Без иконки трей на некоторых рабочих столах не создаётся вовсе.
      // Приложение должно продолжать работать, просто без значка в трее.
      console.error('[tray] не удалось создать значок:', String(err))
      this.tray = null
      return
    }
    this.tray.setToolTip(this.options.appName)
    this.tray.on('click', () => this.options.onOpenWindow())
    this.refresh()
  }

  refresh(): void {
    if (!this.tray) return
    const info = this.options.getServerInfo()
    const urls = info.remoteAccessEnabled ? info.lanUrls : []
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Открыть', click: () => this.options.onOpenWindow() },
        { type: 'separator' },
        {
          label: urls.length > 0 ? 'Доступ с других устройств' : 'Локальный доступ выключен',
          enabled: false,
        },
        ...urls.map((url) => ({
          label: `${url.replace(/^https?:\/\//, '')} — скопировать`,
          click: () => {
            clipboard.writeText(url)
            this.tray?.displayBalloon?.({
              title: this.options.appName,
              content: `Адрес скопирован: ${url}`,
            })
          },
        })),
        { type: 'separator' },
        { label: 'Выход', click: () => this.options.onQuit() },
      ]),
    )
  }

  setTitle(text: string): void {
    this.tray?.setToolTip(`${this.options.appName}\n${text}`)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}