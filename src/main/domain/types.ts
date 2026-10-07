export type DateStr = string

export type HabitType = 'boolean' | 'count'

export type ScheduleMode = 'daily' | 'weekdays' | 'timesPerWeek'

export type Schedule =
  | { mode: 'daily' }
  | { mode: 'weekdays'; days: number[] }
  | { mode: 'timesPerWeek'; timesPerWeek: number }

export interface Habit {
  id: string
  name: string
  color: string
  icon: string
  type: HabitType
  /** Сколько отметок нужно за день. Для boolean всегда 1. */
  targetPerDay: number
  /** Единица измерения для счётчиков: «стаканов», «мин» и т.п. */
  unit: string
  /** Свободный комментарий: зачем привычка и как её выполнять. */
  note: string
  /** Время напоминаний в формате 'HH:MM', без дублей и по возрастанию. */
  reminders: string[]
  schedule: Schedule
  startDate: DateStr
  endDate: DateStr | null
  resetStreakOnMiss: boolean
  archived: boolean
  sortOrder: number
  createdAt: string
}

/** Какие напоминания привычки уже показаны сегодня. */
export interface ReminderFired {
  date: DateStr
  times: string[]
}

export interface UserAccount {
  username: string
  passwordHash: string
  salt: string
  createdAt: string
}

export interface Session {
  id: string
  tokenHash: string
  userAgent: string
  createdAt: string
  lastUsedAt: string
}

export interface Settings {
  /** Сбрасывать ли серию при пропуске запланированного дня. */
  streakResetEnabled: boolean
  language: 'en' | 'ru' | 'system'
  /** Сворачивать в трей вместо выхода при закрытии окна. */
  trayEnabled: boolean
  /** Показывать напоминания о невыполненных привычках. */
  remindersEnabled: boolean
  /** Слушать ли запросы из локальной сети (0.0.0.0) вместо только 127.0.0.1. */
  remoteAccessEnabled: boolean
  serverPort: number
  launchAtLogin: boolean
  theme: 'system' | 'light' | 'dark'
  weekStartsOn: 0 | 1
}

export interface AppData {
  version: number
  user: UserAccount | null
  sessions: Session[]
  settings: Settings
  habits: Habit[]
  /** habitId -> (YYYY-MM-DD -> значение: 0 = не выполнено, 1 = выполнено, N = счётчик) */
  entries: Record<string, Record<DateStr, number>>
  /** habitId -> какие напоминания уже показаны: без этого они повторялись бы после перезапуска. */
  reminderFired: Record<string, ReminderFired>
}

export type StreakUnit = 'days' | 'weeks'

export interface StreakStats {
  current: number
  best: number
  unit: StreakUnit
  /** Выполнена ли цель сегодня. */
  todayDone: boolean
  /** Запланирован ли сегодняшний день. */
  todayScheduled: boolean
  todayValue: number
  target: number
  weekDone: number
  weekTarget: number
  monthDone: number
  monthPlanned: number
  totalDone: number
  totalPlanned: number
}

export interface ServerInfo {
  port: number
  remoteAccessEnabled: boolean
  lanUrls: string[]
}

export interface AppState {
  settings: Settings
  habits: Habit[]
  entries: Record<string, Record<DateStr, number>>
  stats: Record<string, StreakStats>
  server: ServerInfo
  today: DateStr
  username: string
}

export const SCHEDULE_MODES: readonly { value: ScheduleMode; label: string }[] = [
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekdays', label: 'Выбранные дни' },
  { value: 'timesPerWeek', label: 'N раз в неделю' },
]

export const WEEKDAY_LABELS: readonly string[] = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const HABIT_COLORS: readonly string[] = [
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#4ade80',
  '#34d399',
  '#22d3ee',
  '#60a5fa',
  '#818cf8',
  '#c084fc',
  '#f472b6',
]
