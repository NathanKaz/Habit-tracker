import type { AppState } from '../domain/types'
import { todayStr } from '../domain/dates'
import { computeAllStreaks } from '../domain/streaks'
import type { Store } from '../store'
import type { LanUrlProvider } from './types'

export interface StateContext {
  store: Store
  lanUrls: LanUrlProvider
}

/** Полное состояние приложения для клиента: привычки, отметки и посчитанные серии. */
export function buildState(ctx: StateContext): AppState {
  const { store } = ctx
  const today = todayStr()
  const settings = store.settings
  return {
    settings,
    habits: store.habits,
    entries: store.raw.entries,
    stats: computeAllStreaks(store.habits, store.raw.entries, {
      today,
      weekStartsOn: settings.weekStartsOn,
    }),
    server: {
      port: settings.serverPort,
      remoteAccessEnabled: settings.remoteAccessEnabled,
      lanUrls: settings.remoteAccessEnabled ? ctx.lanUrls(settings.serverPort) : [],
    },
    today,
    username: store.raw.user?.username ?? '',
  }
}