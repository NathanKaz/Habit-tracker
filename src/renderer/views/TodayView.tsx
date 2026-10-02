import { useMemo, useState, type ReactNode } from 'react'
import type { Habit } from '../../main/domain/types'
import { formatDateRu } from '../../main/domain/dates'
import { isScheduled } from '../../main/domain/schedule'
import { useApp } from '../state/app'
import { HabitCard } from '../components/HabitCard'
import { HabitEditor } from '../components/HabitEditor'

export function TodayView(): ReactNode {
  const { state } = useApp()
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined)

  const habits = useMemo(
    () => (state?.habits ?? []).filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [state?.habits],
  )

  if (!state) return null
  const today = state.today
  const entries = state.entries

  const planned = habits.filter((habit) => isScheduled(habit, today))
  const done = planned.filter((habit) => (entries[habit.id]?.[today] ?? 0) >= habit.targetPerDay)

  return (
    <div className="view">
      <div className="view-inner">
        <div className="today-head">
          <div>
            <h1>Сегодня</h1>
            <div className="muted">{formatDateRu(today, true)}</div>
          </div>
          <div className="today-progress">
            <span className="today-progress-value">
              {done.length}
              <span className="faint"> / {planned.length}</span>
            </span>
            <span className="hint">
              {planned.length === 0 ? 'на сегодня пусто' : done.length === planned.length ? 'всё выполнено' : 'выполнено'}
            </span>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon" aria-hidden="true">
              🎯
            </span>
            <div>
              <h2>Привычек пока нет</h2>
              <p className="muted">
                Заведите первую привычку с целью на день — и отмечайте выполнение каждый день.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
              Добавить привычку
            </button>
          </div>
        ) : (
          <>
            <div className="today-grid">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  stats={state.stats[habit.id]}
                  date={today}
                  value={entries[habit.id]?.[today] ?? 0}
                  interactive={isScheduled(habit, today)}
                  onEdit={setEditing}
                />
              ))}
            </div>
            <div>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                + Добавить привычку
              </button>
            </div>
          </>
        )}

        <RoutineSummary />

        {editing !== undefined ? <HabitEditor habit={editing} onClose={() => setEditing(undefined)} /> : null}
      </div>
    </div>
  )
}

/** Небольшая сводка по неделе и месяцу — помогает заметить общую картину. */
function RoutineSummary(): ReactNode {
  const { state } = useApp()
  if (!state) return null
  const habits = state.habits.filter((h) => !h.archived)
  if (habits.length === 0) return null

  const totals = habits.reduce(
    (acc, habit) => {
      const stats = state.stats[habit.id]
      if (!stats) return acc
      acc.monthDone += stats.monthDone
      acc.monthPlanned += stats.monthPlanned
      acc.totalDone += stats.totalDone
      acc.totalPlanned += stats.totalPlanned
      return acc
    },
    { monthDone: 0, monthPlanned: 0, totalDone: 0, totalPlanned: 0 },
  )

  const monthPercent = totals.monthPlanned > 0 ? Math.round((totals.monthDone / totals.monthPlanned) * 100) : 0
  const allPercent = totals.totalPlanned > 0 ? Math.round((totals.totalDone / totals.totalPlanned) * 100) : 0

  return (
    <div className="card section">
      <div className="section-title">Итоги</div>
      <div className="row wrap">
        <div className="grow">
          <div className="row row-between">
            <span className="hint">Этот месяц</span>
            <span className="hint">
              {totals.monthDone} из {totals.monthPlanned} · {monthPercent}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${monthPercent}%` }} />
          </div>
        </div>
        <div className="grow">
          <div className="row row-between">
            <span className="hint">Всё время</span>
            <span className="hint">
              {totals.totalDone} из {totals.totalPlanned} · {allPercent}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${allPercent}%`, background: '#60a5fa' }} />
          </div>
        </div>
      </div>
    </div>
  )
}