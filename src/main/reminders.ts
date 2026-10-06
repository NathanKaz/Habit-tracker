import { Notification } from 'electron'
import type { Language } from '../i18n'
import { t } from '../i18n'
import { dueReminders, minutesOfDay } from './domain/reminders'
import { todayStr } from './domain/dates'
import type { Habit } from './domain/types'
import type { Store } from './store'

const TICK_MS = 30_000
const NOTE_LIMIT = 120

export interface ReminderHost {
  store: Store
  getLanguage: () => Language
  onOpenWindow: () => void
  onBalloon: (title: string, content: string) => void
  log: (message: string) => void
}

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private balloonFallbackUsed = false

  constructor(private readonly host: ReminderHost) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.timer.unref?.()
    this.tick()
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private tick(): void {
    const { store } = this.host
    const today = todayStr()
    try {
      const due = dueReminders({
        habits: store.habits,
        entries: store.raw.entries,
        today,
        nowMinutes: minutesOfDay(new Date()),
        fired: store.raw.reminderFired,
        enabled: store.settings.remindersEnabled,
      })
      for (const item of due) {
        store.markReminderFired(item.habit.id, today, item.time)
        this.show(item.habit)
      }
    } catch (err) {
      this.host.log(`ошибка проверки напоминаний: ${String(err)}`)
    }
  }

  private show(habit: Habit): void {
    const lang = this.host.getLanguage()
    const note = habit.note.trim()
    const title = `${habit.icon} ${t(lang, 'app.name')}`
    const content = note
      ? t(lang, 'reminder.bodyWithNote', { name: habit.name, note: shorten(note) })
      : t(lang, 'reminder.body', { name: habit.name })

    if (Notification.isSupported()) {
      const notification = new Notification({ title, body: content })
      notification.on('click', () => this.host.onOpenWindow())
      notification.show()
      return
    }
    this.host.onBalloon(title, content)
    if (this.balloonFallbackUsed) return
    this.balloonFallbackUsed = true
    this.host.log('системные уведомления недоступны, напоминания показываются как всплывающие подсказки трея')
  }
}

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > NOTE_LIMIT ? `${flat.slice(0, NOTE_LIMIT - 1).trimEnd()}…` : flat
}