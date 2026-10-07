import { describe, expect, it } from 'vitest'
import type { DateStr, Habit, StreakStats } from '../src/main/domain/types'
import {
  chartSeries,
  dayStat,
  dayStats,
  heatGrid,
  periodRange,
  periodTotals,
  statsToCsv,
} from '../src/main/domain/stats'

const TODAY: DateStr = '2026-10-06'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Вода',
    color: '#22d3ee',
    icon: '💧',
    type: 'boolean',
    targetPerDay: 1,
    unit: '',
    note: '',
    reminders: [],
    schedule: { mode: 'daily' },
    startDate: '2026-09-01',
    endDate: null,
    archived: false,
    resetStreakOnMiss: true,
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function streaks(overrides: Record<string, Partial<StreakStats>> = {}): Record<string, StreakStats> {
  const base: StreakStats = {
    current: 0,
    best: 0,
    unit: 'days',
    todayDone: false,
    todayScheduled: true,
    todayValue: 0,
    target: 1,
    weekDone: 0,
    weekTarget: 7,
    monthDone: 0,
    monthPlanned: 0,
    totalDone: 0,
    totalPlanned: 0,
  }
  const out: Record<string, StreakStats> = {}
  for (const [id, value] of Object.entries(overrides)) out[id] = { ...base, ...value }
  return out
}

function value(entries: Record<string, Record<DateStr, number>>, habitId: string, date: DateStr, v: number): void {
  if (!entries[habitId]) entries[habitId] = {}
  entries[habitId]![date] = v
}

describe('диапазон периода', () => {
  it('неделя начинается с первого дня недели, месяц — с первого числа', () => {
    expect(periodRange('week', TODAY, [habit()], 1)).toEqual({ from: '2026-10-05', to: TODAY })
    expect(periodRange('week', TODAY, [habit()], 0)).toEqual({ from: '2026-10-04', to: TODAY })
    expect(periodRange('month', TODAY, [habit()])).toEqual({ from: '2026-10-01', to: TODAY })
  })

  it('квартал — последние 90 дней, «всё время» — от самой ранней привычки', () => {
    expect(periodRange('quarter', TODAY, [habit()])).toEqual({ from: '2026-07-09', to: TODAY })
    expect(periodRange('all', TODAY, [habit(), habit({ id: 'h2', startDate: '2026-01-15' })])).toEqual({
      from: '2026-01-15',
      to: TODAY,
    })
    expect(periodRange('all', TODAY, [])).toEqual({ from: TODAY, to: TODAY })
  })
})

describe('статистика дня', () => {
  it('считает только запланированные и неархивные привычки', () => {
    const habits = [
      habit(),
      habit({ id: 'h2', archived: true }),
      habit({ id: 'h3', schedule: { mode: 'weekdays', days: [1] } }),
    ]
    const entries: Record<string, Record<DateStr, number>> = {}
    value(entries, 'h1', TODAY, 1)

    const stat = dayStat(habits, entries, TODAY)
    expect(stat).toMatchObject({ date: TODAY, done: 1, planned: 1, ratio: 1, future: false })
    expect(dayStat(habits, entries, TODAY, '2026-10-05').future).toBe(true)
    expect(dayStat(habits, entries, '2026-10-05').planned).toBe(2)
    expect(
      dayStat([habit({ id: 'h3', schedule: { mode: 'weekdays', days: [1] } })], entries, '2026-10-04').planned,
    ).toBe(0)
  })

  it('счётчик засчитан только при достижении цели', () => {
    const counter = habit({ id: 'c1', type: 'count', targetPerDay: 3 })
    const entries: Record<string, Record<DateStr, number>> = {}
    value(entries, 'c1', TODAY, 2)
    expect(dayStat([counter], entries, TODAY).done).toBe(0)
    value(entries, 'c1', TODAY, 3)
    expect(dayStat([counter], entries, TODAY).done).toBe(1)
  })

  it('возвращает все дни диапазона включительно', () => {
    const days = dayStats([habit()], {}, { from: '2026-10-04', to: TODAY })
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06'])
  })
})

describe('итоги периода', () => {
  it('складывает done/planned, отметки и процент', () => {
    const habits = [habit(), habit({ id: 'h2', type: 'count', targetPerDay: 3, startDate: '2026-10-01' })]
    const entries: Record<string, Record<DateStr, number>> = {}
    value(entries, 'h1', '2026-10-01', 1)
    value(entries, 'h2', '2026-10-01', 3)
    value(entries, 'h1', '2026-10-02', 0)

    const totals = periodTotals(habits, entries, streaks(), { from: '2026-10-01', to: '2026-10-02' })
    expect(totals).toMatchObject({ done: 2, planned: 4, marks: 4, percent: 50, activeHabits: 2 })
    expect(totals.ratio).toBeCloseTo(0.5)
  })

  it('берёт лучшую текущую серию из переданной карты статистики', () => {
    const habits = [habit(), habit({ id: 'h2' })]
    const totals = periodTotals(
      habits,
      {},
      streaks({ h1: { current: 3 }, h2: { current: 9, unit: 'days' } }),
      { from: '2026-10-01', to: TODAY },
    )
    expect(totals.bestStreak).toBe(9)
    expect(totals.bestStreakHabitId).toBe('h2')
  })

  it('пустой период не делит на ноль', () => {
    const totals = periodTotals([], {}, streaks(), { from: TODAY, to: TODAY })
    expect(totals).toMatchObject({ done: 0, planned: 0, ratio: 0, percent: 0, activeHabits: 0, bestStreak: 0 })
  })
})

describe('тепловая карта', () => {
  it('покрывает целые недели и помечает будущее', () => {
    const grid = heatGrid([habit()], {}, TODAY, 2, 1)
    expect(grid.cells).toHaveLength(14)
    expect(grid.start).toBe('2026-09-28')
    expect(grid.cells.at(-1)?.date).toBe('2026-10-11')
    expect(grid.cells.filter((cell) => cell.future).map((cell) => cell.date)).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
  })
})

describe('ряд для графика', () => {
  it('день в день сохраняет исходные значения', () => {
    const days = dayStats([habit()], {}, { from: '2026-10-05', to: TODAY })
    const series = chartSeries(days, 'day')
    expect(series.map((p) => p.date)).toEqual(['2026-10-05', '2026-10-06'])
    expect(series[0]).toMatchObject({ done: 0, planned: 1, percent: 0 })
  })

  it('агрегирует по неделям от понедельника', () => {
    const days = dayStats([habit()], {}, { from: '2026-09-28', to: TODAY })
    const series = chartSeries(days, 'week', 1)
    expect(series.map((p) => p.date)).toEqual(['2026-09-28', '2026-10-05'])
    expect(series[0]).toMatchObject({ done: 0, planned: 7, percent: 0 })
    expect(series[1]).toMatchObject({ done: 0, planned: 2, percent: 0 })
  })
})

describe('CSV-экспорт', () => {
  it('начинается с BOM, содержит заголовок и строки по запланированным дням', () => {
    const habits = [habit({ name: 'Вода' }), habit({ id: 'h2', name: 'Зарядка, утро' })]
    const entries: Record<string, Record<DateStr, number>> = {}
    value(entries, 'h1', TODAY, 1)

    const csv = statsToCsv(habits, entries, { from: TODAY, to: TODAY })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('date,habit,value,target,done')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(`${TODAY},Вода,1,1,1`)
    expect(lines[2]).toBe(`${TODAY},"Зарядка, утро",0,1,0`)
  })

  it('экранирует кавычки в названии', () => {
    const csv = statsToCsv([habit({ name: 'Скажи "да"' })], {}, { from: TODAY, to: TODAY })
    expect(csv).toContain('Скажи ""да""')
  })

  it('пропускает архивные привычки и незапланированные дни', () => {
    const habits = [
      habit({ archived: true }),
      habit({ id: 'h2', schedule: { mode: 'weekdays', days: [1] }, startDate: '2026-10-05' }),
    ]
    const csv = statsToCsv(habits, {}, { from: TODAY, to: TODAY })
    expect(csv.slice(1).trim()).toBe('date,habit,value,target,done')
  })
})
