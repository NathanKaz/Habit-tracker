import { randomUUID } from 'node:crypto'
import type { AppData, DateStr, DeletedSnapshot, Habit, ReminderFired, Settings } from './domain/types'
import { isDateStr, todayStr } from './domain/dates'
import { MAX_NOTE_LENGTH, normalizeTimes } from './domain/reminders'
import { DEFAULT_SERVER_PORT } from '../shared/dev'

export const DATA_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  streakResetEnabled: true,
  language: 'en',
  trayEnabled: true,
  remindersEnabled: true,
  remoteAccessEnabled: true,
  serverPort: DEFAULT_SERVER_PORT,
  launchAtLogin: false,
  theme: 'system',
  weekStartsOn: 1,
  autoBackupEnabled: true,
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    user: null,
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    habits: [],
    entries: {},
    reminderFired: {},
    deleted: null,
  }
}

export function newHabitId(): string {
  return randomUUID()
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function parseHabit(raw: unknown, defaultResetStreakOnMiss = true): Habit | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id, '')
  const name = asString(r.name, '').trim()
  if (!id || !name) return null

  const startDate = isDateStr(r.startDate) ? r.startDate : todayStr()
  const endDate = typeof r.endDate === 'string' && isDateStr(r.endDate) ? r.endDate : null
  const type = r.type === 'count' ? 'count' : 'boolean'

  let schedule: Habit['schedule'] = { mode: 'daily' }
  const rawSchedule = typeof r.schedule === 'object' && r.schedule !== null ? (r.schedule as Record<string, unknown>) : {}
  if (rawSchedule.mode === 'weekdays') {
    const days = Array.isArray(rawSchedule.days)
      ? [...new Set(rawSchedule.days.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6))]
      : []
    if (days.length > 0) schedule = { mode: 'weekdays', days }
  } else if (rawSchedule.mode === 'timesPerWeek') {
    const timesPerWeek = Math.min(7, Math.max(1, Math.round(asNumber(rawSchedule.timesPerWeek, 3))))
    schedule = { mode: 'timesPerWeek', timesPerWeek }
  }

  return {
    id,
    name: name.slice(0, 80),
    color: asString(r.color, '#4ade80'),
    icon: asString(r.icon, '✅').slice(0, 4),
    type,
    targetPerDay: type === 'count' ? Math.min(9999, Math.max(1, Math.round(asNumber(r.targetPerDay, 1)))) : 1,
    unit: asString(r.unit, '').slice(0, 24),
    note: asString(r.note, '').slice(0, MAX_NOTE_LENGTH),
    reminders: normalizeTimes(r.reminders),
    schedule,
    startDate,
    endDate: endDate && endDate > startDate ? endDate : null,
    resetStreakOnMiss: asBool(r.resetStreakOnMiss, defaultResetStreakOnMiss),
    archived: asBool(r.archived, false),
    sortOrder: asNumber(r.sortOrder, 0),
    createdAt: asString(r.createdAt, new Date().toISOString()),
  }
}

function parseEntries(raw: unknown): Record<string, Record<DateStr, number>> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, Record<DateStr, number>> = {}
  for (const [habitId, days] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof days !== 'object' || days === null) continue
    const bucket: Record<DateStr, number> = {}
    for (const [date, value] of Object.entries(days as Record<string, unknown>)) {
      if (!isDateStr(date)) continue
      const n = asNumber(value, 0)
      if (n !== 0) bucket[date] = n
    }
    if (Object.keys(bucket).length > 0) out[habitId] = bucket
  }
  return out
}

/** Приводит любой прочитанный объект к валидной структуре текущей версии. */
export function migrate(raw: unknown): AppData {
  const base = emptyData()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>

  const settings = { ...base.settings }
  const rawSettings = typeof r.settings === 'object' && r.settings !== null ? (r.settings as Record<string, unknown>) : {}
  settings.streakResetEnabled = asBool(rawSettings.streakResetEnabled, base.settings.streakResetEnabled)
  const language = rawSettings.language
  settings.language = language === 'ru' || language === 'system' ? language : 'en'
  settings.trayEnabled = asBool(rawSettings.trayEnabled, base.settings.trayEnabled)
  settings.remindersEnabled = asBool(rawSettings.remindersEnabled, base.settings.remindersEnabled)
  settings.remoteAccessEnabled = asBool(rawSettings.remoteAccessEnabled, base.settings.remoteAccessEnabled)
  settings.launchAtLogin = asBool(rawSettings.launchAtLogin, base.settings.launchAtLogin)
  settings.serverPort = Math.min(65535, Math.max(1024, Math.round(asNumber(rawSettings.serverPort, base.settings.serverPort))))
  const theme = rawSettings.theme
  settings.theme = theme === 'light' || theme === 'dark' ? theme : 'system'
  settings.weekStartsOn = asNumber(rawSettings.weekStartsOn, 1) === 0 ? 0 : 1
  settings.autoBackupEnabled = asBool(rawSettings.autoBackupEnabled, base.settings.autoBackupEnabled)

  const habits = Array.isArray(r.habits)
    ? r.habits.map((h) => parseHabit(h, settings.streakResetEnabled)).filter((h): h is Habit => h !== null)
    : []

  const user =
    typeof r.user === 'object' && r.user !== null
      ? (() => {
          const u = r.user as Record<string, unknown>
          const username = asString(u.username, '')
          if (!username || !asString(u.passwordHash, '') || !asString(u.salt, '')) return null
          return {
            username,
            passwordHash: asString(u.passwordHash, ''),
            salt: asString(u.salt, ''),
            createdAt: asString(u.createdAt, new Date().toISOString()),
          }
        })()
      : null

  const sessions = Array.isArray(r.sessions)
    ? r.sessions.flatMap((s) => {
        if (typeof s !== 'object' || s === null) return []
        const item = s as Record<string, unknown>
        const tokenHash = asString(item.tokenHash, '')
        if (!/^[0-9a-f]{64}$/.test(tokenHash)) return []
        return [
          {
            id: asString(item.id, '') || randomUUID(),
            tokenHash,
            userAgent: asString(item.userAgent, '').slice(0, 160),
            createdAt: asString(item.createdAt, ''),
            lastUsedAt: asString(item.lastUsedAt, ''),
          },
        ]
      })
    : []

  const known = new Set(habits.map((h) => h.id))
  const entries: Record<string, Record<DateStr, number>> = {}
  for (const [habitId, days] of Object.entries(parseEntries(r.entries))) {
    if (known.has(habitId)) entries[habitId] = days
  }

  const reminderFired: Record<string, ReminderFired> = {}
  const rawFired = typeof r.reminderFired === 'object' && r.reminderFired !== null ? (r.reminderFired as Record<string, unknown>) : {}
  for (const habitId of known) {
    const item = rawFired[habitId]
    if (typeof item !== 'object' || item === null) continue
    const state = item as Record<string, unknown>
    if (!isDateStr(state.date)) continue
    reminderFired[habitId] = { date: state.date, times: normalizeTimes(state.times) }
  }

  let deleted: DeletedSnapshot | null = null
  if (typeof r.deleted === 'object' && r.deleted !== null) {
    const snapshot = r.deleted as Record<string, unknown>
    const habit = parseHabit(snapshot.habit, settings.streakResetEnabled)
    if (habit) {
      deleted = {
        habit,
        entries: parseEntries({ [habit.id]: snapshot.entries ?? {} })[habit.id] ?? {},
        deletedAt: asString(snapshot.deletedAt, ''),
      }
    }
  }

  return { version: DATA_VERSION, user, sessions, settings, habits, entries, reminderFired, deleted }
}
