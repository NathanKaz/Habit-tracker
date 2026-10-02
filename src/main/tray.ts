import { Menu, Tray, clipboard, nativeImage, type BrowserWindow } from 'electron'
import type { Language } from '../i18n'
import { t } from '../i18n'
import type { ServerInfo } from './domain/types'

export interface TrayOptions {
  iconPath: string | null
  getLanguage: () => Language
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
    this.tray.setToolTip(t(this.options.getLanguage(), 'app.name'))
    this.tray.on('click', () => this.options.onOpenWindow())
    this.refresh()
  }

  refresh(): void {
    if (!this.tray) return
    const lang = this.options.getLanguage()
    const info = this.options.getServerInfo()
    const urls = info.remoteAccessEnabled ? info.lanUrls : []
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t(lang, 'tray.open'), click: () => this.options.onOpenWindow() },
        { type: 'separator' },
        {
          label: urls.length > 0 ? t(lang, 'tray.remoteOn') : t(lang, 'tray.remoteOff'),
          enabled: false,
        },
        ...urls.map((url) => ({
          label: t(lang, 'tray.copyUrl', { url: url.replace(/^https?:\/\//, '') }),
          click: () => {
            clipboard.writeText(url)
            this.tray?.displayBalloon?.({
              title: t(lang, 'app.name'),
              content: t(lang, 'tray.urlCopied', { url }),
            })
          },
        })),
        { type: 'separator' },
        { label: t(lang, 'tray.quit'), click: () => this.options.onQuit() },
      ]),
    )
  }

  setTitle(text: string): void {
    this.tray?.setToolTip(`${t(this.options.getLanguage(), 'app.name')}\n${text}`)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
