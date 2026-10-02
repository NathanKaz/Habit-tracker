import type { DateStr, Habit, Schedule } from './types'
import { eachDay, weekdayOf } from './dates'

/** Попадает ли дата в период жизни привычки. */
export function withinLifetime(habit: Habit, date: DateStr): boolean {
  if (date < habit.startDate) return false
  if (habit.endDate && date > habit.endDate) return false
  return true
}

/** Запланирован ли день по расписанию привычки. */
export function isScheduled(habit: Habit, date: DateStr): boolean {
  if (!withinLifetime(habit, date)) return false
  const schedule: Schedule = habit.schedule
  if (schedule.mode === 'weekdays') return schedule.days.includes(weekdayOf(date))
  // «каждый день» и «N раз в неделю»: конкретный день заранее не определён,
  // квота считается по неделям целиком.
  return true
}

/** Последний день, который имеет смысл учитывать: min(сегодня, конец привычки). */
export function lastCountableDay(habit: Habit, today: DateStr): DateStr {
  return habit.endDate && habit.endDate < today ? habit.endDate : today
}

export function scheduledDaysBetween(habit: Habit, from: DateStr, to: DateStr): DateStr[] {
  return eachDay(from, to).filter((d) => isScheduled(habit, d))
}

export function describeSchedule(habit: Habit, weekStartsOn: 0 | 1 = 1): string {
  const schedule = habit.schedule
  if (schedule.mode === 'daily') return 'Каждый день'
  if (schedule.mode === 'timesPerWeek') {
    return `${schedule.timesPerWeek} ${schedule.timesPerWeek === 1 ? 'раз' : 'раза'} в неделю`
  }
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const days = [...schedule.days].sort((a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7))
  if (days.length === 0) return 'Дни не выбраны'
  if (days.length === 7) return 'Каждый день'
  return days.map((d) => labels[d]).join(', ')
}

export function defaultSchedule(): Schedule {
  return { mode: 'daily' }
}
