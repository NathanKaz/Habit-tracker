import type { HabitDesktopBridge } from './shared/desktop'

declare global {
  interface Window {
    habitDesktop?: HabitDesktopBridge
  }
}

export {}