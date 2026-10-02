import type { DateStr, Habit, StreakStats, StreakUnit } from './types'
import { addDays, eachDay, endOfMonth, endOfWeek, maxDate, minDate, startOfMonth, startOfWeek } from './dates'
import { isScheduled, lastCountableDay } from './schedule'

export interface StreakOptions {
  today: DateStr
  /** true — пропуск обнуляет серию; false — серия только копится. */
  resetEnabled: boolean
  weekStartsOn?: 0 | 1
}

interface Unit {
  /** Якорь юнита: дата для дня, понедельник недели для недели. */
  date: DateStr
  scheduled: boolean
  done: boolean
}

export function entryValue(entries: Record<DateStr, number> | undefined, date: DateStr): number {
  if (!entries) return 0
  const value = entries[date]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Выполнена ли цель за день. Для счётчика нужно набрать targetPerDay. */
export function isDayDone(habit: Habit, entries: Record<DateStr, number> | undefined, date: DateStr): boolean {
  return entryValue(entries, date) >= habit.targetPerDay
}

function computeRun(units: Unit[], resetEnabled: boolean, lastUnitOpen: boolean): { current: number; best: number } {
  let current = 0
  let best = 0
  let run = 0
  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i] as Unit
    if (!unit.scheduled) continue
    if (unit.done) {
      run += 1
      if (run > best) best = run
    } else if (!(lastUnitOpen && i === units.length - 1)) {
      // Незавершённый последний юнит (сегодняшний день или текущая неделя)
      // серию не обнуляет: времени ещё есть. Все пропуски до него — обнуляют.
      run = 0
    }
    current = run
  }
  if (!resetEnabled) {
    let total = 0
    for (const unit of units) if (unit.scheduled && unit.done) total += 1
    current = total
  }
  return { current, best }
}

function dayUnits(habit: Habit, entries: Record<DateStr, number>, today: DateStr): Unit[] {
  const last = lastCountableDay(habit, today)
  const days = eachDay(habit.startDate, last)
  const units: Unit[] = new Array(days.length)
  for (let i = 0; i < days.length; i += 1) {
    const date = days[i] as DateStr
    units[i] = { date, scheduled: isScheduled(habit, date), done: isDayDone(habit, entries, date) }
  }
  return units
}

function weekQuota(habit: Habit): number {
  return habit.schedule.mode === 'timesPerWeek' ? habit.schedule.timesPerWeek : 1
}

function weekUnits(habit: Habit, entries: Record<DateStr, number>, today: DateStr, weekStartsOn: 0 | 1): Unit[] {
  const quota = weekQuota(habit)
  const firstWeek = startOfWeek(habit.startDate, weekStartsOn)
  const lastWeek = startOfWeek(lastCountableDay(habit, today), weekStartsOn)
  const units: Unit[] = []
  for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) {
    const start = maxDate(w, habit.startDate)
    const end = minDate(minDate(addDays(w, 6), today), habit.endDate ?? today)
    if (end < start) continue
    let done = 0
    for (const date of eachDay(start, end)) {
      if (isDayDone(habit, entries, date)) done += 1
    }
    units.push({ date: w, scheduled: true, done: done >= quota })
  }
  return units
}

function countInRange(
  habit: Habit,
  entries: Record<DateStr, number>,
  from: DateStr,
  to: DateStr,
): { done: number; planned: number } {
  const days = eachDay(maxDate(from, habit.startDate), minDate(to, habit.endDate ?? to))
  let done = 0
  let planned = 0
  for (const date of days) {
    if (!isScheduled(habit, date)) continue
    planned += 1
    if (isDayDone(habit, entries, date)) done += 1
  }
  return { done, planned }
}

/**
 * Текущая и рекордная серия привычки.
 *
 * Серия считается только по запланированным дням: пропуск дня, который не входит
 * в расписание, серию не рвёт. Незавершённый сегодняшний день (или текущая неделя
 * при недельной квоте) тоже не обнуляет серию — день ещё не закончился.
 */
export function computeStreak(
  habit: Habit,
  entries: Record<DateStr, number> | undefined,
  options: StreakOptions,
): StreakStats {
  const { today, resetEnabled } = options
  const weekStartsOn = options.weekStartsOn ?? 1
  const map = entries ?? {}
  const isWeekly = habit.schedule.mode === 'timesPerWeek'
  const unit: StreakUnit = isWeekly ? 'weeks' : 'days'

  const units = isWeekly ? weekUnits(habit, map, today, weekStartsOn) : dayUnits(habit, map, today)
  const lastUnitOpen = isWeekly
    ? today < addDays(startOfWeek(lastCountableDay(habit, today), weekStartsOn), 6)
    : lastCountableDay(habit, today) === today
  const { current, best } = computeRun(units, resetEnabled, lastUnitOpen)

  const weekStart = startOfWeek(today, weekStartsOn)
  const week = countInRange(habit, map, weekStart, minDate(endOfWeek(today, weekStartsOn), today))
  const month = countInRange(habit, map, startOfMonth(today), minDate(endOfMonth(today), today))
  const total = countInRange(habit, map, habit.startDate, today)

  return {
    current,
    best,
    unit,
    todayDone: isDayDone(habit, map, today),
    todayScheduled: isScheduled(habit, today),
    todayValue: entryValue(map, today),
    target: habit.targetPerDay,
    weekDone: week.done,
    weekTarget: isWeekly ? weekQuota(habit) : week.planned,
    monthDone: month.done,
    monthPlanned: month.planned,
    totalDone: total.done,
    totalPlanned: total.planned,
  }
}

export function computeAllStreaks(
  habits: Habit[],
  entries: Record<string, Record<DateStr, number>>,
  options: StreakOptions,
): Record<string, StreakStats> {
  const out: Record<string, StreakStats> = {}
  for (const habit of habits) {
    out[habit.id] = computeStreak(habit, entries[habit.id], options)
  }
  return out
}
