import type { DateStr, Habit, StreakStats } from './types'
import { addDays, eachDay, minDate, startOfMonth, startOfWeek } from './dates'
import { isScheduled } from './schedule'

export type PeriodId = 'week' | 'month' | 'quarter' | 'all'

export type Entries = Record<string, Record<DateStr, number>>

export interface PeriodRange {
  from: DateStr
  to: DateStr
}

export interface DayStat {
  date: DateStr
  done: number
  planned: number
  ratio: number
  future: boolean
}

export interface ChartPoint {
  date: DateStr
  done: number
  planned: number
  ratio: number
  percent: number
}

export interface StatsSummary {
  done: number
  planned: number
  ratio: number
  percent: number
  marks: number
  activeHabits: number
  bestStreak: number
  bestStreakHabitId: string | null
}

export interface HeatGrid {
  start: DateStr
  weeks: number
  cells: DayStat[]
}

export function liveHabits(habits: Habit[]): Habit[] {
  return habits.filter((habit) => !habit.archived)
}

export function periodRange(
  period: PeriodId,
  today: DateStr,
  habits: Habit[],
  weekStartsOn: 0 | 1 = 1,
): PeriodRange {
  if (period === 'week') return { from: startOfWeek(today, weekStartsOn), to: today }
  if (period === 'month') return { from: startOfMonth(today), to: today }
  if (period === 'quarter') return { from: addDays(today, -89), to: today }
  let from: DateStr = today
  for (const habit of liveHabits(habits)) from = minDate(from, habit.startDate)
  return { from, to: today }
}

export function dayStat(habits: Habit[], entries: Entries, date: DateStr, today?: DateStr): DayStat {
  let done = 0
  let planned = 0
  for (const habit of liveHabits(habits)) {
    if (!isScheduled(habit, date)) continue
    planned += 1
    if ((entries[habit.id]?.[date] ?? 0) >= habit.targetPerDay) done += 1
  }
  return {
    date,
    done,
    planned,
    ratio: planned === 0 ? 0 : done / planned,
    future: today !== undefined && date > today,
  }
}

export function dayStats(habits: Habit[], entries: Entries, range: PeriodRange, today?: DateStr): DayStat[] {
  return eachDay(range.from, range.to).map((date) => dayStat(habits, entries, date, today))
}

export function periodTotals(
  habits: Habit[],
  entries: Entries,
  streaks: Record<string, StreakStats>,
  range: PeriodRange,
): StatsSummary {
  const list = liveHabits(habits)
  const scheduledDays: Record<string, number> = {}
  let done = 0
  let planned = 0
  let marks = 0

  for (const date of eachDay(range.from, range.to)) {
    for (const habit of list) {
      if (!isScheduled(habit, date)) continue
      planned += 1
      scheduledDays[habit.id] = (scheduledDays[habit.id] ?? 0) + 1
      const value = entries[habit.id]?.[date] ?? 0
      marks += value
      if (value >= habit.targetPerDay) done += 1
    }
  }

  let bestStreak = 0
  let bestStreakHabitId: string | null = null
  for (const habit of list) {
    const current = streaks[habit.id]?.current ?? 0
    if (current > bestStreak) {
      bestStreak = current
      bestStreakHabitId = habit.id
    }
  }

  const activeHabits = Object.keys(scheduledDays).length
  const ratio = planned === 0 ? 0 : done / planned
  return {
    done,
    planned,
    ratio,
    percent: Math.round(ratio * 100),
    marks,
    activeHabits,
    bestStreak,
    bestStreakHabitId,
  }
}

export function heatGrid(
  habits: Habit[],
  entries: Entries,
  today: DateStr,
  weeks = 12,
  weekStartsOn: 0 | 1 = 1,
): HeatGrid {
  const lastWeekStart = startOfWeek(today, weekStartsOn)
  const end = addDays(lastWeekStart, 6)
  const start = addDays(end, -(weeks * 7 - 1))
  const cells = eachDay(start, end).map((date) => dayStat(habits, entries, date, today))
  return { start, weeks, cells }
}

export function chartSeries(
  days: DayStat[],
  bucket: 'day' | 'week',
  weekStartsOn: 0 | 1 = 1,
): ChartPoint[] {
  if (bucket === 'day') {
    return days.map((day) => ({
      date: day.date,
      done: day.done,
      planned: day.planned,
      ratio: day.ratio,
      percent: Math.round(day.ratio * 100),
    }))
  }

  const grouped = new Map<DateStr, { done: number; planned: number }>()
  const order: DateStr[] = []
  for (const day of days) {
    const key = startOfWeek(day.date, weekStartsOn)
    const bucketValue = grouped.get(key)
    if (!bucketValue) {
      grouped.set(key, { done: day.done, planned: day.planned })
      order.push(key)
    } else {
      bucketValue.done += day.done
      bucketValue.planned += day.planned
    }
  }
  return order.map((date) => {
    const value = grouped.get(date) ?? { done: 0, planned: 0 }
    const ratio = value.planned === 0 ? 0 : value.done / value.planned
    return {
      date,
      done: value.done,
      planned: value.planned,
      ratio,
      percent: Math.round(ratio * 100),
    }
  })
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function statsToCsv(habits: Habit[], entries: Entries, range: PeriodRange): string {
  const rows: string[] = ['date,habit,value,target,done']
  for (const date of eachDay(range.from, range.to)) {
    for (const habit of liveHabits(habits)) {
      if (!isScheduled(habit, date)) continue
      const value = entries[habit.id]?.[date] ?? 0
      const done = value >= habit.targetPerDay ? 1 : 0
      rows.push(
        [date, csvCell(habit.name), String(value), String(habit.targetPerDay), String(done)].join(','),
      )
    }
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n'
}
