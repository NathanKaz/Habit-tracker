import { useMemo, useState, type ReactNode } from 'react'
import type { Habit } from '../../main/domain/types'
import { isScheduled } from '../../main/domain/schedule'
import { formatDate } from '../../i18n'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'
import { HabitCard } from '../components/HabitCard'
import { HabitEditor } from '../components/HabitEditor'

export function TodayView(): ReactNode {
  const { state, reorderHabits } = useApp()
  const { t, lang } = useI18n()
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined)

  const habits = useMemo(
    () => (state?.habits ?? []).filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [state?.habits],
  )

  function move(index: number, direction: -1 | 1): void {
    const ids = habits.map((habit) => habit.id)
    const target = index + direction
    const currentId = ids[index]
    const targetId = ids[target]
    if (currentId === undefined || targetId === undefined) return
    ids[index] = targetId
    ids[target] = currentId
    void reorderHabits(ids)
  }

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
            <h1>{t('today.title')}</h1>
            <div className="muted">{formatDate(lang, today, true)}</div>
          </div>
          <div className="today-progress">
            <span className="today-progress-value">
              {done.length}
              <span className="faint"> / {planned.length}</span>
            </span>
            <span className="hint">
              {planned.length === 0
                ? t('today.empty')
                : done.length === planned.length
                  ? t('today.allDone')
                  : t('today.done')}
            </span>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon" aria-hidden="true">
              🎯
            </span>
            <div>
              <h2>{t('today.noHabits.title')}</h2>
              <p className="muted">{t('today.noHabits.body')}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
              {t('today.addHabit')}
            </button>
          </div>
        ) : (
          <>
            <div className="today-grid">
              {habits.map((habit, index) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  stats={state.stats[habit.id]}
                  date={today}
                  value={entries[habit.id]?.[today] ?? 0}
                  interactive={isScheduled(habit, today)}
                  onEdit={setEditing}
                  onMove={(direction) => move(index, direction)}
                  canMove={(direction) => index + direction >= 0 && index + direction < habits.length}
                />
              ))}
            </div>
            <div>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                + {t('today.addHabit')}
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
  const { t } = useI18n()
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
      <div className="section-title">{t('summary.title')}</div>
      <div className="row wrap">
        <div className="grow">
          <div className="row row-between">
            <span className="hint">{t('summary.thisMonth')}</span>
            <span className="hint">
              {t('summary.ratio', { done: totals.monthDone, planned: totals.monthPlanned, percent: monthPercent })}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${monthPercent}%` }} />
          </div>
        </div>
        <div className="grow">
          <div className="row row-between">
            <span className="hint">{t('summary.allTime')}</span>
            <span className="hint">
              {t('summary.ratio', { done: totals.totalDone, planned: totals.totalPlanned, percent: allPercent })}
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
