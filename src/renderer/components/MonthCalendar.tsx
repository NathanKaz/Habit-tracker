import { useMemo, type ReactNode } from 'react'
import type { DateStr, Habit } from '../../main/domain/types'
import { monthGrid, weekdayOf } from '../../main/domain/dates'
import { isScheduled } from '../../main/domain/schedule'
import { WEEKDAYS_MON_FIRST } from '../../i18n'
import { useI18n } from '../i18n'

export interface DayCell {
  date: DateStr
  inMonth: boolean
  scheduled: Habit[]
  done: Habit[]
  partial: Habit[]
  /** Доля выполнения: выполнено / запланировано. */
  ratio: number
}

interface MonthCalendarProps {
  year: number
  month: number
  today: DateStr
  selected: DateStr
  habits: Habit[]
  entries: Record<string, Record<DateStr, number>>
  weekStartsOn: 0 | 1
  onSelect: (date: DateStr) => void
}

const MAX_DOTS = 7

export function buildCells(
  year: number,
  month: number,
  habits: Habit[],
  entries: Record<string, Record<DateStr, number>>,
  weekStartsOn: 0 | 1,
): DayCell[] {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  return monthGrid(year, month, weekStartsOn).map((date) => {
    const scheduled: Habit[] = []
    const done: Habit[] = []
    const partial: Habit[] = []
    for (const habit of habits) {
      if (habit.archived) continue
      if (!isScheduled(habit, date)) continue
      scheduled.push(habit)
      const value = entries[habit.id]?.[date] ?? 0
      if (value >= habit.targetPerDay) done.push(habit)
      else if (value > 0) partial.push(habit)
    }
    return {
      date,
      inMonth: date.startsWith(monthPrefix),
      scheduled,
      done,
      partial,
      ratio: scheduled.length === 0 ? 0 : done.length / scheduled.length,
    }
  })
}

export function MonthCalendar({
  year,
  month,
  today,
  selected,
  habits,
  entries,
  weekStartsOn,
  onSelect,
}: MonthCalendarProps): ReactNode {
  const { t, lang } = useI18n()
  const cells = useMemo(
    () => buildCells(year, month, habits, entries, weekStartsOn),
    [year, month, habits, entries, weekStartsOn],
  )

  const weekdayOrder = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7),
    [weekStartsOn],
  )

  return (
    <div>
      <div className="cal-weekdays" aria-hidden="true">
        {weekdayOrder.map((index) => (
          <div key={index} className="cal-weekday">
            {WEEKDAYS_MON_FIRST[lang][(index + 6) % 7]}
          </div>
        ))}
      </div>
      <div className="cal-grid" role="grid">
        {cells.map((cell) => {
          const weekend = weekdayOf(cell.date) === 0 || weekdayOf(cell.date) === 6
          const marks = [
            ...cell.done.map((habit) => ({ habit, partial: false })),
            ...cell.partial.map((habit) => ({ habit, partial: true })),
          ].slice(0, MAX_DOTS)
          const extra = cell.done.length + cell.partial.length - marks.length
          const classes = [
            'cal-day',
            cell.inMonth ? '' : 'other',
            cell.date === today ? 'today' : '',
            cell.date === selected ? 'selected' : '',
            weekend ? 'weekend' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const label =
            cell.scheduled.length === 0
              ? t('calendar.nothingPlanned')
              : t('calendar.completedLabel', {
                  done: cell.done.length,
                  total: cell.scheduled.length,
                  names: cell.done.map((h) => h.name).join(', ') || '—',
                })
          return (
            <button
              key={cell.date}
              type="button"
              role="gridcell"
              className={classes}
              onClick={() => onSelect(cell.date)}
              aria-label={`${cell.date}, ${label}`}
              aria-selected={cell.date === selected}
              title={label}
            >
              <span className="cal-daynum">{Number(cell.date.slice(8))}</span>
              <span className="cal-dots" aria-hidden="true">
                {marks.map(({ habit, partial }) => (
                  <span
                    key={habit.id}
                    className={`cal-dot ${partial ? 'partial' : ''}`}
                    style={partial ? { borderColor: habit.color } : { background: habit.color }}
                  />
                ))}
                {extra > 0 ? <span className="cal-more">+{extra}</span> : null}
              </span>
              {cell.scheduled.length > 0 ? (
                <span className="cal-bar" aria-hidden="true">
                  <span
                    className="cal-bar-fill"
                    style={{
                      width: `${Math.round(cell.ratio * 100)}%`,
                      background: cell.done.length > 0 ? 'var(--accent)' : 'transparent',
                    }}
                  />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Legend({ habits }: { habits: Habit[] }): ReactNode {
  if (habits.length === 0) return null
  return (
    <div className="legend">
      {habits.map((habit) => (
        <span key={habit.id} className="legend-item">
          <span className="legend-swatch" style={{ background: habit.color }} aria-hidden="true" />
          {habit.icon} {habit.name}
        </span>
      ))}
    </div>
  )
}