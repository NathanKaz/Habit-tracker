import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateStr, Habit, ReminderFired } from '../src/main/domain/types'
import { dueReminders, nextFired, normalizeTimes, timeToMinutes } from '../src/main/domain/reminders'
import { todayStr } from '../src/main/domain/dates'
import { ReminderScheduler, type ReminderDueMessage } from '../src/main/reminders'
import { Store } from '../src/main/store'

vi.mock('electron', () => ({ Notification: { isSupported: () => false } }))

const TODAY: DateStr = '2026-10-02'

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
    reminders: ['09:00'],
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

function at(time: string): number {
  const minutes = timeToMinutes(time)
  if (minutes === null) throw new Error(`плохое время ${time}`)
  return minutes
}

describe('разбор времён напоминаний', () => {
  it('отбрасывает мусор, убирает дубли и сортирует', () => {
    expect(normalizeTimes(['18:00', '09:00', '09:00', '25:00', '7:5', '', 42, null])).toEqual(['09:00', '18:00'])
  })

  it('переживает отсутствие поля и ограничивает количество', () => {
    expect(normalizeTimes(undefined)).toEqual([])
    expect(normalizeTimes(Array.from({ length: 20 }, (_, i) => `0${9}:${String(i).padStart(2, '0')}`))).toHaveLength(8)
  })

  it('переводит время в минуты с начала суток', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:59')).toBe(1439)
    expect(timeToMinutes('24:00')).toBeNull()
  })
})

describe('подбор напоминаний к показу', () => {
  const base = { entries: {}, today: TODAY, fired: {}, enabled: true }

  it('показывает напоминание, время которого уже наступило', () => {
    const due = dueReminders({ ...base, habits: [habit()], nowMinutes: at('09:00') })
    expect(due.map((d) => `${d.habit.id}@${d.time}`)).toEqual(['h1@09:00'])
  })

  it('не показывает будущие, выполненные, архивные и незапланированные', () => {
    expect(dueReminders({ ...base, habits: [habit()], nowMinutes: at('08:59') })).toEqual([])
    expect(
      dueReminders({ ...base, habits: [habit()], entries: { h1: { [TODAY]: 1 } }, nowMinutes: at('23:00') }),
    ).toEqual([])
    expect(dueReminders({ ...base, habits: [habit({ archived: true })], nowMinutes: at('23:00') })).toEqual([])
    expect(
      dueReminders({
        ...base,
        habits: [habit({ schedule: { mode: 'weekdays', days: [1] } })],
        nowMinutes: at('23:00'),
      }),
    ).toEqual([])
  })

  it('счётчик считается выполненным только по цели', () => {
    const counter = habit({ type: 'count', targetPerDay: 3 })
    expect(dueReminders({ ...base, habits: [counter], entries: { h1: { [TODAY]: 2 } }, nowMinutes: at('10:00') })).toHaveLength(1)
    expect(dueReminders({ ...base, habits: [counter], entries: { h1: { [TODAY]: 3 } }, nowMinutes: at('10:00') })).toEqual([])
  })

  it('не повторяет то, что уже показано сегодня', () => {
    const fired: Record<string, ReminderFired> = { h1: { date: TODAY, times: ['09:00'] } }
    expect(dueReminders({ ...base, habits: [habit()], fired, nowMinutes: at('12:00') })).toEqual([])

    const other = habit({ reminders: ['09:00', '18:00'] })
    expect(
      dueReminders({ ...base, habits: [other], fired, nowMinutes: at('19:00') }).map((d) => d.time),
    ).toEqual(['18:00'])
  })

  it('учитывает выключатель напоминаний и устаревшую дату в fired', () => {
    const fired: Record<string, ReminderFired> = { h1: { date: '2026-10-01', times: ['09:00'] } }
    expect(dueReminders({ ...base, habits: [habit()], fired, nowMinutes: at('12:00') })).toHaveLength(1)
    expect(dueReminders({ ...base, habits: [habit()], fired, nowMinutes: at('12:00'), enabled: false })).toEqual([])
  })
})

describe('состояние показанных напоминаний', () => {
  it('накапливает времена в пределах дня', () => {
    let fired = nextFired({}, 'h1', TODAY, '09:00')
    fired = nextFired(fired, 'h1', TODAY, '18:00')
    expect(fired.h1).toEqual({ date: TODAY, times: ['09:00', '18:00'] })
  })

  it('новый день начинает список заново', () => {
    const fired = nextFired({ h1: { date: '2026-10-01', times: ['09:00'] } }, 'h1', TODAY, '18:00')
    expect(fired.h1).toEqual({ date: TODAY, times: ['18:00'] })
  })
})

describe('ReminderScheduler', () => {
  let store: Store
  let dir: string
  let messages: ReminderDueMessage[]

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'habit-reminders-'))
    store = await Store.open(dir)
    messages = []
  })

  afterEach(async () => {
    await store.flush()
    await rm(dir, { recursive: true, force: true })
  })

  function makeScheduler(): ReminderScheduler {
    return new ReminderScheduler({
      store,
      getLanguage: () => 'ru',
      onOpenWindow: () => undefined,
      onBalloon: () => undefined,
      onDue: (message) => messages.push(message),
      log: () => undefined,
    })
  }

  it('помечает время сработавшим и рассылает reminder:due один раз', async () => {
    const today = todayStr()
    const habit = store.createHabit({
      name: 'Вода',
      color: '#22d3ee',
      icon: '💧',
      type: 'boolean',
      targetPerDay: 1,
      unit: '',
      note: '',
      reminders: ['00:00'],
      schedule: { mode: 'daily' },
      startDate: today,
      endDate: null,
      resetStreakOnMiss: true,
    })
    const scheduler = makeScheduler()

    scheduler.start()
    scheduler.stop()
    expect(messages).toEqual([{ type: 'reminder:due', habitId: habit.id, date: today, time: '00:00' }])
    expect(store.raw.reminderFired[habit.id]).toEqual({ date: today, times: ['00:00'] })

    scheduler.start()
    scheduler.stop()
    expect(messages).toHaveLength(1)
  })
})
