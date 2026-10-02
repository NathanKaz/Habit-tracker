import { contextBridge, ipcRenderer } from 'electron'
import type { HabitDesktopBridge } from '../shared/desktop'

const bridge: HabitDesktopBridge = {
  getToken: (): Promise<string> => ipcRenderer.invoke('desktop:token'),
  platform: process.platform,
}

/**
 * Окно на этом компьютере получает токен, который действует всегда и не требует
 * пароля: пароль спрашивается только при входе с другого устройства. Токен
 * передаётся по IPC и живёт только в памяти — на диск и в URL он не попадает.
 */
contextBridge.exposeInMainWorld('habitDesktop', bridge)