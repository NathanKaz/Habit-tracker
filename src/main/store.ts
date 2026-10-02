import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppData, DateStr, Habit, Settings } from './domain/types'
import { emptyData, migrate, newHabitId } from './model'

export interface NewHabitInput {
  name: string
  color: string
  icon: string
  type: Habit['type']
  targetPerDay: number
  unit: string
  schedule: Habit['schedule']
  startDate: DateStr
  endDate: DateStr | null
}

export type HabitPatch = Partial<Omit<Habit, 'id' | 'createdAt'>>

const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const SESSION_MAX_COUNT = 30

/**
 * Хранилище в одном JSON-файле. Все изменения проходят через мутаторы,
 * которые сериализуют запись в очередь, а файл заменяется через rename —
 * так незавершённая запись не может испортить данные.
 */
export class Store {
  private readonly file: string
  private readonly backupFile: string
  private data: AppData
  private queue: Promise<void> = Promise.resolve()
  private saveTimer: NodeJS.Timeout | null = null

  private constructor(file: string, data: AppData) {
    this.file = file
    this.backupFile = `${file}.bak`
    this.data = data
  }

  static async open(dir: string): Promise<Store> {
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, 'data.json')
    const store = new Store(file, emptyData())
    store.data = await store.readFromDisk()
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
      })
      .catch((err) => {
        console.error('[store] ошибка записи:', err)
      })
    return this.queue
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
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
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
    if (patch.archived !== undefined) habit.archived = patch.archived
    if (patch.sortOrder !== undefined) habit.sortOrder = patch.sortOrder
    if (patch.startDate !== undefined) habit.startDate = patch.startDate
    if (patch.endDate !== undefined) habit.endDate = patch.endDate
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
    const index = this.data.habits.findIndex((h) => h.id === id)
    if (index < 0) return false
    this.data.habits.splice(index, 1)
    delete this.data.entries[id]
    this.scheduleSave()
    return true
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

  addSession(tokenHash: string): void {
    const now = new Date().toISOString()
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash)
    this.data.sessions.push({ tokenHash, createdAt: now, lastUsedAt: now })
    this.pruneSessions()
    this.scheduleSave()
  }

  removeSession(tokenHash: string): void {
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash)
    if (this.data.sessions.length !== before) this.scheduleSave()
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

  /** Заменить содержимое, сохранив учётную запись и настройки текущего пользователя. */
  importJson(text: string, keepUser: boolean): void {
    const incoming = migrate(JSON.parse(text))
    const habits = incoming.habits
    const entries: Record<string, Record<DateStr, number>> = {}
    for (const habit of habits) entries[habit.id] = incoming.entries[habit.id] ?? {}
    this.data.habits = habits
    this.data.entries = entries
    if (!keepUser) this.data.user = incoming.user
    this.scheduleSave()
  }
}
