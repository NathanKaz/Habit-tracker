import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { AppData, DateStr, Habit, Session, Settings } from './domain/types'
import { normalizeTimes } from './domain/reminders'
import { emptyData, migrate, newHabitId } from './model'

export interface NewHabitInput {
  name: string
  color: string
  icon: string
  type: Habit['type']
  targetPerDay: number
  unit: string
  note: string
  reminders: string[]
  schedule: Habit['schedule']
  startDate: DateStr
  endDate: DateStr | null
  resetStreakOnMiss: boolean
}

export type HabitPatch = Partial<Omit<Habit, 'id' | 'createdAt'>>

const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const SESSION_MAX_COUNT = 30
const BACKUP_DIR_NAME = 'backups'
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const BACKUP_MAX_COUNT = 30
const BACKUP_NAME_RE = /^data-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/

/**
 * Хранилище в одном JSON-файле. Все изменения проходят через мутаторы,
 * которые сериализуют запись в очередь, а файл заменяется через rename —
 * так незавершённая запись не может испортить данные.
 */
export class Store {
  private readonly file: string
  private readonly backupFile: string
  private readonly backupDir: string
  private data: AppData
  private queue: Promise<void> = Promise.resolve()
  private saveTimer: NodeJS.Timeout | null = null
  private lastBackupAt = 0

  private constructor(file: string, data: AppData) {
    this.file = file
    this.backupFile = `${file}.bak`
    this.backupDir = path.join(path.dirname(file), BACKUP_DIR_NAME)
    this.data = data
  }

  static async open(dir: string): Promise<Store> {
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, 'data.json')
    const store = new Store(file, emptyData())
    store.data = await store.readFromDisk()
    store.lastBackupAt = await store.latestBackupTime()
    store.scheduleSave()
    return store
  }

  private async readFromDisk(): Promise<AppData> {
    for (const candidate of [this.file, this.backupFile]) {
      let text: string
      try {
        text = await fs.readFile(candidate, 'utf8')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue
        console.error(`[store] не удалось прочитать ${candidate}:`, err)
        continue
      }
      try {
        return migrate(JSON.parse(text))
      } catch (err) {
        // Файл повреждён — пробуем резервную копию, иначе начинаем с чистых данных.
        const broken = `${candidate}.broken-${Date.now()}`
        console.error(`[store] ${candidate} повреждён (${String(err)}), сохраняю как ${path.basename(broken)}`)
        try {
          await fs.rename(candidate, broken)
        } catch {
          /* не критично */
        }
      }
    }
    return emptyData()
  }

  /** Отложенное сохранение: несколько правок подряд схлопываются в одну запись. */
  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, 120)
  }

  private enqueueWrite(): Promise<void> {
    const payload = JSON.stringify(this.data, null, 2)
    this.queue = this.queue
      .then(async () => {
        const tmp = `${this.file}.tmp`
        await fs.writeFile(tmp, payload, { encoding: 'utf8', mode: 0o600 })
        try {
          await fs.copyFile(this.file, this.backupFile)
        } catch {
          /* файла ещё нет — это нормально при первом запуске */
        }
        await fs.rename(tmp, this.file)
        await this.maybeBackup()
      })
      .catch((err) => {
        console.error('[store] ошибка записи:', err)
      })
    return this.queue
  }

  /** Время самой свежей суточной копии; 0 — копий ещё нет. */
  private async latestBackupTime(): Promise<number> {
    try {
      let newest = 0
      for (const name of await fs.readdir(this.backupDir)) {
        if (!BACKUP_NAME_RE.test(name)) continue
        const stat = await fs.stat(path.join(this.backupDir, name))
        if (stat.mtimeMs > newest) newest = stat.mtimeMs
      }
      return newest
    } catch {
      return 0
    }
  }

  /** Раз в сутки кладём копию данных в backups/, оставляя последние 30 файлов. */
  private async maybeBackup(): Promise<void> {
    if (!this.data.settings.autoBackupEnabled) return
    const now = Date.now()
    if (now - this.lastBackupAt < BACKUP_INTERVAL_MS) return
    try {
      await fs.mkdir(this.backupDir, { recursive: true })
      const stamp = new Date(now).toISOString().replace(/[:T]/g, '-').slice(0, 19)
      await fs.copyFile(this.file, path.join(this.backupDir, `data-${stamp}.json`))
      this.lastBackupAt = now
      await this.pruneBackups()
    } catch (err) {
      console.error('[store] не удалось создать резервную копию:', err)
    }
  }

  private async pruneBackups(): Promise<void> {
    try {
      const files = (await fs.readdir(this.backupDir))
        .filter((name) => BACKUP_NAME_RE.test(name))
        .map((name) => path.join(this.backupDir, name))
      const withTime = await Promise.all(
        files.map(async (file) => ({ file, mtime: (await fs.stat(file)).mtimeMs })),
      )
      withTime.sort((a, b) => b.mtime - a.mtime)
      for (const { file } of withTime.slice(BACKUP_MAX_COUNT)) {
        await fs.unlink(file)
      }
    } catch {
      /* не критично */
    }
  }

  /** Дождаться, пока все изменения лягут на диск. */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await this.enqueueWrite()
  }

  get raw(): AppData {
    return this.data
  }

  get settings(): Settings {
    return this.data.settings
  }

  get habits(): Habit[] {
    return this.data.habits
  }

  habit(id: string): Habit | undefined {
    return this.data.habits.find((h) => h.id === id)
  }

  entriesFor(habitId: string): Record<DateStr, number> {
    return this.data.entries[habitId] ?? {}
  }

  createHabit(input: NewHabitInput): Habit {
    const habit: Habit = {
      id: newHabitId(),
      name: input.name.trim(),
      color: input.color,
      icon: input.icon,
      type: input.type,
      targetPerDay: input.type === 'count' ? input.targetPerDay : 1,
      unit: input.unit,
      note: input.note,
      reminders: normalizeTimes(input.reminders),
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      resetStreakOnMiss: input.resetStreakOnMiss,
      archived: false,
      sortOrder: this.data.habits.length,
      createdAt: new Date().toISOString(),
    }
    this.data.habits.push(habit)
    this.data.entries[habit.id] = {}
    this.scheduleSave()
    return habit
  }

  updateHabit(id: string, patch: HabitPatch): Habit | null {
    const habit = this.habit(id)
    if (!habit) return null
    if (patch.name !== undefined) habit.name = patch.name.trim()
    if (patch.color !== undefined) habit.color = patch.color
    if (patch.icon !== undefined) habit.icon = patch.icon
    if (patch.unit !== undefined) habit.unit = patch.unit
    if (patch.note !== undefined) habit.note = patch.note
    if (patch.reminders !== undefined) habit.reminders = normalizeTimes(patch.reminders)
    if (patch.archived !== undefined) habit.archived = patch.archived
    if (patch.sortOrder !== undefined) habit.sortOrder = patch.sortOrder
    if (patch.startDate !== undefined) habit.startDate = patch.startDate
    if (patch.endDate !== undefined) habit.endDate = patch.endDate
    if (patch.resetStreakOnMiss !== undefined) habit.resetStreakOnMiss = patch.resetStreakOnMiss
    if (patch.schedule !== undefined) habit.schedule = patch.schedule
    if (patch.type !== undefined && patch.type !== habit.type) {
      // Смена типа обнуляет дневные значения: у «да/нет» и счётчика разный смысл.
      habit.type = patch.type
      habit.targetPerDay = patch.type === 'count' ? Math.max(1, habit.targetPerDay) : 1
      this.data.entries[id] = {}
    }
    if (patch.targetPerDay !== undefined && habit.type === 'count') {
      habit.targetPerDay = Math.max(1, patch.targetPerDay)
    }
    this.scheduleSave()
    return habit
  }

  deleteHabit(id: string): boolean {
    const habit = this.data.habits.find((h) => h.id === id)
    if (!habit) return false
    this.data.deleted = {
      habit,
      entries: { ...(this.data.entries[id] ?? {}) },
      deletedAt: new Date().toISOString(),
    }
    this.data.habits = this.data.habits.filter((h) => h.id !== id)
    delete this.data.entries[id]
    delete this.data.reminderFired[id]
    this.scheduleSave()
    return true
  }

  /** Вернуть последнюю удалённую привычку вместе с её отметками. */
  restoreHabit(id: string): Habit | null {
    const snapshot = this.data.deleted
    if (!snapshot || snapshot.habit.id !== id) return null
    if (this.data.habits.some((h) => h.id === id)) return null
    const habit = { ...snapshot.habit }
    this.data.deleted = null
    this.data.habits.push(habit)
    this.data.entries[id] = { ...snapshot.entries }
    this.scheduleSave()
    return habit
  }

  /** Пометить напоминание показанным, чтобы сегодня оно не повторилось. */
  markReminderFired(habitId: string, date: DateStr, time: string): void {
    const current = this.data.reminderFired[habitId]
    const times = current && current.date === date ? [...current.times, time] : [time]
    this.data.reminderFired[habitId] = { date, times: normalizeTimes(times) }
    this.scheduleSave()
  }

  /** Установить значение дня. Значение 0 удаляет отметку. */
  setEntry(habitId: string, date: DateStr, value: number): number {
    const habit = this.habit(habitId)
    if (!habit) return 0
    const bucket = (this.data.entries[habitId] ??= {})
    const max = habit.type === 'count' ? Math.max(habit.targetPerDay * 100, 9999) : 1
    const next = Math.min(max, Math.max(0, Math.round(value)))
    if (next <= 0) delete bucket[date]
    else bucket[date] = next
    this.scheduleSave()
    return this.entriesFor(habitId)[date] ?? 0
  }

  adjustEntry(habitId: string, date: DateStr, delta: number): number {
    return this.setEntry(habitId, date, (this.entriesFor(habitId)[date] ?? 0) + delta)
  }

  toggleEntry(habitId: string, date: DateStr): number {
    const habit = this.habit(habitId)
    if (!habit) return 0
    const current = this.entriesFor(habitId)[date] ?? 0
    if (habit.type === 'boolean') return this.setEntry(habitId, date, current >= 1 ? 0 : 1)
    return this.setEntry(habitId, date, current >= habit.targetPerDay ? 0 : habit.targetPerDay)
  }

  updateSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.scheduleSave()
    return this.data.settings
  }

  setUser(user: AppData['user']): void {
    this.data.user = user
    this.scheduleSave()
  }

  addSession(tokenHash: string, userAgent = ''): void {
    const now = new Date().toISOString()
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash)
    this.data.sessions.push({
      id: randomUUID(),
      tokenHash,
      userAgent: userAgent.slice(0, 160),
      createdAt: now,
      lastUsedAt: now,
    })
    this.pruneSessions()
    this.scheduleSave()
  }

  removeSession(tokenHash: string): void {
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash)
    if (this.data.sessions.length !== before) this.scheduleSave()
  }

  listSessions(): Session[] {
    return this.data.sessions.map((session) => ({ ...session }))
  }

  removeSessionById(id: string): boolean {
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter((s) => s.id !== id)
    if (this.data.sessions.length === before) return false
    this.scheduleSave()
    return true
  }

  touchSession(tokenHash: string): void {
    const session = this.data.sessions.find((s) => s.tokenHash === tokenHash)
    if (!session) return
    session.lastUsedAt = new Date().toISOString()
    this.scheduleSave()
  }

  pruneSessions(): void {
    const cutoff = Date.now() - SESSION_MAX_AGE_MS
    this.data.sessions = this.data.sessions
      .filter((s) => {
        const at = Date.parse(s.lastUsedAt || s.createdAt)
        return Number.isFinite(at) ? at >= cutoff : true
      })
      .slice(-SESSION_MAX_COUNT)
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2)
  }

  /** Заменить содержимое; учётная запись сохраняется, настройки — по флагу. */
  importJson(text: string, keepUser: boolean, restoreSettings = false): void {
    const incoming = migrate(JSON.parse(text))
    const habits = incoming.habits
    const entries: Record<string, Record<DateStr, number>> = {}
    for (const habit of habits) entries[habit.id] = incoming.entries[habit.id] ?? {}
    this.data.habits = habits
    this.data.entries = entries
    this.pruneReminderFired()
    if (restoreSettings) this.data.settings = { ...incoming.settings }
    if (!keepUser) this.data.user = incoming.user
    this.scheduleSave()
  }

  private pruneReminderFired(): void {
    const known = new Set(this.data.habits.map((h) => h.id))
    for (const habitId of Object.keys(this.data.reminderFired)) {
      if (!known.has(habitId)) delete this.data.reminderFired[habitId]
    }
  }
}
