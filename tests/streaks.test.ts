import { describe, expect, it } from 'vitest'
import type { DateStr, Habit } from '../src/main/domain/types'
import { addDays, monthGrid, parseDate, weekdayOf } from '../src/main/domain/dates'
import { isScheduled, describeSchedule, dateForScheduledCount } from '../src/main/domain/schedule'
import { computeStreak, isDayDone } from '../src/main/domain/streaks'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Тест',
    color: '#4ade80',
    icon: '✅',
    type: 'boolean',
    targetPerDay: 1,
    unit: '',
    note: '',
    reminders: [],
    schedule: { mode: 'daily' },
    startDate: '2026-10-01',
    endDate: null,
    archived: false,
    resetStreakOnMiss: true,
    sortOrder: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Отметки «выполнено» за указанные даты. */
function done(...dates: DateStr[]): Record<DateStr, number> {
  const out: Record<DateStr, number> = {}
  for (const d of dates) out[d] = 1
  return out
}

/** Диапазон дат включительно. */
function range(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

describe('даты', () => {
  it('не ломается на переходе часов', () => {
    expect(weekdayOf('2026-10-01')).toBe(4) // четверг
    expect(weekdayOf('2026-10-05')).toBe(1) // понедельник
    expect(weekdayOf('2026-10-03')).toBe(6) // суббота
  })

  it('addDays переходит через месяц и год', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('сетка месяца — 42 дня и начинается с понедельника', () => {
    const grid = monthGrid(2026, 9, 1)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-28')
    expect(grid[41]).toBe('2026-11-08')
  })

  it('parseDate ставит полдень', () => {
    expect(parseDate('2026-10-01').getHours()).toBe(12)
  })
})

describe('расписание', () => {
  it('выбранные дни недели', () => {
    const h = habit({ schedule: { mode: 'weekdays', days: [1, 2, 3, 4, 5] } })
    expect(isScheduled(h, '2026-10-05')).toBe(true) // пн
    expect(isScheduled(h, '2026-10-06')).toBe(true) // вт
    expect(isScheduled(h, '2026-10-09')).toBe(true) // пт
    expect(isScheduled(h, '2026-10-10')).toBe(false) // сб
    expect(isScheduled(h, '2026-10-11')).toBe(false) // вс
  })

  it('учитывает начало и конец привычки', () => {
    const h = habit({ startDate: '2026-10-05', endDate: '2026-10-07' })
    expect(isScheduled(h, '2026-10-04')).toBe(false)
    expect(isScheduled(h, '2026-10-05')).toBe(true)
    expect(isScheduled(h, '2026-10-07')).toBe(true)
    expect(isScheduled(h, '2026-10-08')).toBe(false)
  })

  it('описывает расписание текстом', () => {
    expect(describeSchedule(habit())).toBe('Каждый день')
    expect(describeSchedule(habit({ schedule: { mode: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] } }))).toBe('Каждый день')
    expect(describeSchedule(habit({ schedule: { mode: 'weekdays', days: [1, 3, 5] } }))).toBe('Пн, Ср, Пт')
    expect(describeSchedule(habit({ schedule: { mode: 'timesPerWeek', timesPerWeek: 3 } }))).toBe('3 раза в неделю')
    expect(describeSchedule(habit({ schedule: { mode: 'timesPerWeek', timesPerWeek: 1 } }))).toBe('1 раз в неделю')
  })
})

describe('дата по числу запланированных выполнений', () => {
  it('считает только выбранные дни недели', () => {
    const schedule = { mode: 'weekdays', days: [1, 3, 5] } as const
    expect(dateForScheduledCount(schedule, '2026-10-05', 1)).toBe('2026-10-05') // пн
    expect(dateForScheduledCount(schedule, '2026-10-05', 2)).toBe('2026-10-07') // ср
    expect(dateForScheduledCount(schedule, '2026-10-05', 3)).toBe('2026-10-09') // пт
    expect(dateForScheduledCount(schedule, '2026-10-05', 4)).toBe('2026-10-12') // следующий пн
  })

  it('для ежедневного расписания совпадает с календарными днями', () => {
    expect(dateForScheduledCount({ mode: 'daily' }, '2026-10-01', 1)).toBe('2026-10-01')
    expect(dateForScheduledCount({ mode: 'daily' }, '2026-10-01', 5)).toBe('2026-10-05')
  })
})

describe('серия: сброс включён', () => {
  const options = { today: '2026-10-10' }

  it('считает все дни подряд', () => {
    const h = habit({ startDate: '2026-10-05' })
    const s = computeStreak(h, done(...range('2026-10-05', '2026-10-10')), options)
    expect(s.current).toBe(6)
    expect(s.best).toBe(6)
    expect(s.unit).toBe('days')
  })

  it('незаконченный сегодняшний день не обнуляет серию', () => {
    const h = habit({ startDate: '2026-10-05' })
    const s = computeStreak(h, done(...range('2026-10-05', '2026-10-09')), options)
    expect(s.current).toBe(5)
    expect(s.todayDone).toBe(false)
  })

  it('пропуск вчера обнуляет серию', () => {
    const h = habit({ startDate: '2026-10-05' })
    // 9 октября (вчера) и 10 октября (сегодня) пропущены
    const s = computeStreak(h, done('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'), options)
    expect(s.current).toBe(0)
    expect(s.best).toBe(4)
  })

  it('серия обрывается на пропущенном дне, но не на сегодняшнем', () => {
    const h = habit({ startDate: '2026-10-05' })
    // 7 октября пропущено, 8 и 9 выполнены, 10 — сегодня, без отметки
    const s = computeStreak(h, done('2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'), options)
    expect(s.current).toBe(2)
    expect(s.best).toBe(2)
  })

  // Пн–Пт, старт 5 октября, «сегодня» 13 октября (вт)
  const weekdayHabit = habit({ startDate: '2026-10-05', schedule: { mode: 'weekdays', days: [1, 2, 3, 4, 5] } })
  const weekdayOptions = { today: '2026-10-13' }

  it('пропуск незапланированного дня серию не рвёт', () => {
    // сб 10 и вс 11 пропущены, все будни выполнены
    const s = computeStreak(
      weekdayHabit,
      done('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'),
      weekdayOptions,
    )
    expect(s.current).toBe(7)
    expect(s.todayScheduled).toBe(true)
  })

  it('пропуск запланированного дня среди выбранных рвёт серию', () => {
    // ср 7 октября пропущено — серия идёт только с 8 октября
    const s = computeStreak(
      weekdayHabit,
      done('2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'),
      weekdayOptions,
    )
    expect(s.current).toBe(4) // 8, 9, 12, 13
    expect(s.best).toBe(4)
  })

  it('сегодняшний незапланированный день не трогает серию', () => {
    const s = computeStreak(
      weekdayHabit,
      done('2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'),
      { today: '2026-10-17' }, // суббота
    )
    expect(s.current).toBe(5)
    expect(s.todayScheduled).toBe(false)
  })

  it('дни до старта не учитываются', () => {
    const h = habit({ startDate: '2026-10-08' })
    const s = computeStreak(h, done('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-08', '2026-10-09', '2026-10-10'), options)
    expect(s.current).toBe(3)
  })

  it('отметки в будущем не учитываются', () => {
    const h = habit({ startDate: '2026-10-05' })
    const s = computeStreak(h, done(...range('2026-10-05', '2026-10-20')), options)
    expect(s.current).toBe(6)
  })
})

describe('серия: счётчик', () => {
  const options = { today: '2026-10-10' }

  it('частичное выполнение не засчитывается', () => {
    const h = habit({ startDate: '2026-10-08', type: 'count', targetPerDay: 8, unit: 'стаканов' })
    const entries: Record<DateStr, number> = { '2026-10-08': 8, '2026-10-09': 8, '2026-10-10': 7 }
    expect(isDayDone(h, entries, '2026-10-10')).toBe(false)
    const s = computeStreak(h, entries, options)
    expect(s.current).toBe(2) // пропущенный сегодня день не рвёт
    expect(s.todayValue).toBe(7)
    expect(s.target).toBe(8)
  })

  it('перевыполнение засчитывается', () => {
    const h = habit({ startDate: '2026-10-09', type: 'count', targetPerDay: 3 })
    const s = computeStreak(h, { '2026-10-09': 5, '2026-10-10': 4 }, options)
    expect(s.current).toBe(2)
  })
})

describe('серия: сброс выключен', () => {
  it('серия копится и не уменьшается', () => {
    const h = habit({ startDate: '2026-10-01', resetStreakOnMiss: false })
    const options = { today: '2026-10-10' }
    const sparse = done('2026-10-01', '2026-10-03', '2026-10-05', '2026-10-08', '2026-10-09', '2026-10-10')
    const s = computeStreak(h, sparse, options)
    expect(s.current).toBe(6)
    // рекорд — максимальная непрерывная серия, ей было 3 (8, 9, 10 октября)
    expect(s.best).toBe(3)

    const more = computeStreak(h, { ...sparse, '2026-10-11': 1 }, { ...options, today: '2026-10-11' })
    expect(more.current).toBe(7)
    expect(more.best).toBe(4)
  })
})

describe('серия: N раз в неделю', () => {
  const options = { today: '2026-10-10', weekStartsOn: 1 as const }
  const h = habit({ startDate: '2026-09-28', schedule: { mode: 'timesPerWeek', timesPerWeek: 3 } })

  it('считает недели, в которых набрана квота', () => {
    // неделя 28 сен - 4 окт: 28, 29, 30
    // неделя 5-11 окт: пока только 5, 6
    const entries = done('2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05', '2026-10-06')
    const s = computeStreak(h, entries, options)
    expect(s.unit).toBe('weeks')
    expect(s.current).toBe(1) // прошлая неделя закрыта, текущая ещё в процессе
    expect(s.weekDone).toBe(2)
    expect(s.weekTarget).toBe(3)
  })

  it('незакрытая квота обнуляет серию', () => {
    // первая неделя — 2 из 3, вторая (текущая) — пока 2 из 3
    const entries = done('2026-09-28', '2026-09-30', '2026-10-05', '2026-10-06')
    const s = computeStreak(h, entries, options)
    expect(s.current).toBe(0)
    expect(s.best).toBe(0)
    expect(s.weekDone).toBe(2)
  })

  it('текущая неделя с уже набранной квотой засчитывается', () => {
    const entries = done('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10')
    const s = computeStreak(h, entries, options)
    expect(s.current).toBe(1)
  })
})

describe('прогресс за месяц и неделю', () => {
  it('считает выполненные и запланированные дни месяца', () => {
    const h = habit({ startDate: '2026-10-01', schedule: { mode: 'weekdays', days: [1, 2, 3, 4, 5] } })
    const entries = done('2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06')
    const s = computeStreak(h, entries, { today: '2026-10-07' })
    // 1, 2, 5, 6, 7 октября — будни до 7-го
    expect(s.monthPlanned).toBe(5)
    expect(s.monthDone).toBe(4)
    expect(s.weekDone).toBe(2) // неделя 5-11: 5 и 6 октября
    expect(s.weekTarget).toBe(3) // три прошедших будних дня недели
    expect(s.totalDone).toBe(4)
  })
})
