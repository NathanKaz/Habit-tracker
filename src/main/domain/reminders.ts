import type { DateStr, Habit, ReminderFired } from './types'
import { isScheduled } from './schedule'

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export const MAX_REMINDERS = 8
export const MAX_NOTE_LENGTH = 500

export function normalizeTimes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const unique = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const value = item.trim()
    if (TIME_RE.test(value)) unique.add(value)
  }
  return [...unique].sort().slice(0, MAX_REMINDERS)
}

export function timeToMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

export function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes()
}

export function targetFor(habit: Habit): number {
  return habit.type === 'count' ? habit.targetPerDay : 1
}

export function valueOn(entries: Record<string, Record<DateStr, number>>, habitId: string, date: DateStr): number {
  return entries[habitId]?.[date] ?? 0
}

export interface DueReminder {
  habit: Habit
  time: string
}

export interface DueInput {
  habits: Habit[]
  entries: Record<string, Record<DateStr, number>>
  today: DateStr
  nowMinutes: number
  fired: Record<string, ReminderFired>
  enabled: boolean
}

export function dueReminders(input: DueInput): DueReminder[] {
  if (!input.enabled) return []
  const due: DueReminder[] = []
  for (const habit of input.habits) {
    if (habit.archived || habit.reminders.length === 0) continue
    if (!isScheduled(habit, input.today)) continue
    if (valueOn(input.entries, habit.id, input.today) >= targetFor(habit)) continue

    const state = input.fired[habit.id]
    const already = state && state.date === input.today ? state.times : []
    for (const time of habit.reminders) {
      const minutes = timeToMinutes(time)
      if (minutes === null || minutes > input.nowMinutes) continue
      if (already.includes(time)) continue
      due.push({ habit, time })
    }
  }
  return due
}

export function nextFired(
  fired: Record<string, ReminderFired>,
  habitId: string,
  date: DateStr,
  time: string,
): Record<string, ReminderFired> {
  const current = fired[habitId]
  const times = current && current.date === date ? [...current.times, time] : [time]
  return { ...fired, [habitId]: { date, times } }
}