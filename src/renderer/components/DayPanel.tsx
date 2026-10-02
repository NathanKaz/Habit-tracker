import type { ReactNode } from 'react'
import type { DateStr, Habit } from '../../main/domain/types'
import { formatDateRu } from '../../main/domain/dates'
import { describeSchedule, isScheduled } from '../../main/domain/schedule'
import { useApp } from '../state/app'

interface DayPanelProps {
  date: DateStr
  habits: Habit[]
  entries: Record<string, Record<DateStr, number>>
  today: DateStr
  onEdit: (habit: Habit) => void
}

/** Отметки за конкретный день: прошедшие дни тоже можно исправлять. */
export function DayPanel({ date, habits, entries, today, onEdit }: DayPanelProps): ReactNode {
  const { toggleEntry, changeEntry } = useApp()
  const active = habits.filter((habit) => !habit.archived)
  const relevant = active.filter((habit) => isScheduled(habit, date))
  const others = active.filter((habit) => !isScheduled(habit, date))
  const doneCount = relevant.filter((habit) => (entries[habit.id]?.[date] ?? 0) >= habit.targetPerDay).length

  return (
    <div className="card day-panel">
      <div>
        <div className="row row-between">
          <h3>{formatDateRu(date, date !== today)}</h3>
          {date === today ? <span className="hint">сегодня</span> : null}
        </div>
        <div className="hint">
          {relevant.length === 0
            ? 'Ничего не запланировано'
            : `Выполнено ${doneCount} из ${relevant.length}`}
        </div>
      </div>

      <div>
        {relevant.map((habit) => {
          const value = entries[habit.id]?.[date] ?? 0
          const target = habit.type === 'count' ? habit.targetPerDay : 1
          const done = value >= target
          return (
            <div key={habit.id} className="day-row">
              <span className="habit-icon" aria-hidden="true">
                {habit.icon}
              </span>
              <span className="day-row-name">
                <span title={describeSchedule(habit)}>{habit.name}</span>
              </span>
              {habit.type === 'boolean' ? (
                <button
                  type="button"
                  className={`check ${done ? 'on' : ''}`}
                  style={{ '--habit-color': habit.color, width: 34, height: 34, fontSize: 15 } as React.CSSProperties}
                  onClick={() => void toggleEntry(habit.id, date)}
                  aria-pressed={done}
                  aria-label={`Отметить «${habit.name}» за ${date}`}
                >
                  {done ? '✓' : ''}
                </button>
              ) : (
                <div className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => void changeEntry(habit.id, date, -1)}
                    disabled={value <= 0}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="stepper-value" style={{ minWidth: 54, fontSize: 13 }}>
                    {value}
                    <span className="faint"> / {habit.targetPerDay}</span>
                  </span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => void changeEntry(habit.id, date, 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {relevant.length === 0 ? <div className="hint">Можно отметить любую привычку — отметка сохранится на этот день.</div> : null}

        {others.length > 0 ? (
          <details style={{ marginTop: 10 }}>
            <summary className="hint" style={{ cursor: 'pointer' }}>
              Не запланированы на этот день: {others.length}
            </summary>
            <div style={{ marginTop: 6 }}>
              {others.map((habit) => {
                const value = entries[habit.id]?.[date] ?? 0
                const done = value >= habit.targetPerDay
                return (
                  <div key={habit.id} className="day-row">
                    <span className="habit-icon" aria-hidden="true">
                      {habit.icon}
                    </span>
                    <span className="day-row-name">
                      <span className="faint">{habit.name}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => void toggleEntry(habit.id, date)}
                    >
                      {done ? '✓ отмечено' : 'отметить'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => onEdit(habit)}
                      aria-label="Настроить"
                    >
                      ⋯
                    </button>
                  </div>
                )
              })}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  )
}