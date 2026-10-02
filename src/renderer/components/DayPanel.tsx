import type { ReactNode } from 'react'
import type { DateStr, Habit } from '../../main/domain/types'
import { isScheduled } from '../../main/domain/schedule'
import { describeSchedule, formatDate } from '../../i18n'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'

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
  const { t, lang } = useI18n()
  const active = habits.filter((habit) => !habit.archived)
  const relevant = active.filter((habit) => isScheduled(habit, date))
  const others = active.filter((habit) => !isScheduled(habit, date))
  const doneCount = relevant.filter((habit) => (entries[habit.id]?.[date] ?? 0) >= habit.targetPerDay).length

  return (
    <div className="card day-panel">
      <div>
        <div className="row row-between">
          <h3>{formatDate(lang, date, date !== today)}</h3>
          {date === today ? <span className="hint">{t('day.today')}</span> : null}
        </div>
        <div className="hint">
          {relevant.length === 0
            ? t('day.nothingPlanned')
            : t('day.completed', { done: doneCount, total: relevant.length })}
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
                <span title={describeSchedule(lang, habit)}>{habit.name}</span>
              </span>
              {habit.type === 'boolean' ? (
                <button
                  type="button"
                  className={`check ${done ? 'on' : ''}`}
                  style={{ '--habit-color': habit.color, width: 34, height: 34, fontSize: 15 } as React.CSSProperties}
                  onClick={() => void toggleEntry(habit.id, date)}
                  aria-pressed={done}
                  aria-label={t('day.markAria', { name: habit.name, date })}
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
                    aria-label={t('common.decrease')}
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
                    aria-label={t('common.increase')}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {relevant.length === 0 ? <div className="hint">{t('day.canMark')}</div> : null}

        {others.length > 0 ? (
          <details style={{ marginTop: 10 }}>
            <summary className="hint" style={{ cursor: 'pointer' }}>
              {t('day.notScheduled', { count: others.length })}
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
                      {done ? `✓ ${t('day.checked')}` : t('day.check')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => onEdit(habit)}
                      aria-label={t('common.edit')}
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
