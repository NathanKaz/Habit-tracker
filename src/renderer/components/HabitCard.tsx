import type { ReactNode } from 'react'
import type { DateStr, Habit, StreakStats } from '../../main/domain/types'
import { dayWord, weekWord } from '../../main/domain/dates'
import { describeSchedule } from '../../main/domain/schedule'
import { useApp } from '../state/app'

interface HabitCardProps {
  habit: Habit
  stats: StreakStats | undefined
  date: DateStr
  value: number
  /** На паузе: показывается месяц и недельный прогресс, отметка недоступна. */
  interactive?: boolean
  onEdit: (habit: Habit) => void
}

export function HabitCard({ habit, stats, date, value, interactive = true, onEdit }: HabitCardProps): ReactNode {
  const { toggleEntry, changeEntry } = useApp()
  const target = habit.type === 'count' ? habit.targetPerDay : 1
  const done = value >= target
  const scheduled = stats?.todayScheduled ?? true
  const cardClass = [
    'habit-card',
    done ? 'done' : '',
    scheduled ? '' : 'unscheduled',
  ]
    .filter(Boolean)
    .join(' ')

  const weekRatio =
    stats && stats.weekTarget > 0 ? Math.min(1, stats.weekDone / stats.weekTarget) : 0
  const monthRatio =
    stats && stats.monthPlanned > 0 ? Math.min(1, stats.monthDone / stats.monthPlanned) : 0

  const unitLabel = habit.unit.trim()

  return (
    <div className={cardClass} style={{ '--habit-color': habit.color } as React.CSSProperties}>
      <div className="habit-card-top">
        <span className="habit-icon" aria-hidden="true">
          {habit.icon}
        </span>
        <div className="grow">
          <div className="habit-name">{habit.name}</div>
          <div className="habit-meta">
            {habit.type === 'count' ? `${habit.targetPerDay} ${unitLabel || 'раз'}` : describeSchedule(habit)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => onEdit(habit)}
          aria-label={`Настроить «${habit.name}»`}
          title="Настроить"
        >
          ⋯
        </button>
      </div>

      <div className="habit-card-actions">
        {habit.type === 'boolean' ? (
          <button
            type="button"
            className={`check ${done ? 'on' : ''}`}
            onClick={() => void toggleEntry(habit.id, date)}
            disabled={!interactive}
            aria-pressed={done}
            aria-label={done ? `Отменить «${habit.name}»` : `Отметить «${habit.name}»`}
          >
            {done ? '✓' : ''}
          </button>
        ) : (
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => void changeEntry(habit.id, date, -1)}
              disabled={!interactive || value <= 0}
              aria-label="Уменьшить"
            >
              −
            </button>
            <span className={`stepper-value ${done ? 'reached' : ''}`}>
              {value}
              <span className="faint"> / {habit.targetPerDay}</span>
            </span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => void changeEntry(habit.id, date, 1)}
              disabled={!interactive}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>
        )}

        <div className="grow" />

        <StreakBadge stats={stats} />
      </div>

      {!done && !scheduled ? <div className="hint">Сегодня не запланировано</div> : null}

      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="progress-track" title={`Неделя: ${stats?.weekDone ?? 0} из ${stats?.weekTarget ?? 0}`}>
          <div className="progress-fill" style={{ width: `${Math.round(weekRatio * 100)}%` }} />
        </div>
        <div className="hint">
          Неделя {stats?.weekDone ?? 0}/{stats?.weekTarget ?? 0} · месяц{' '}
          {stats ? `${stats.monthDone}/${stats.monthPlanned}` : '0/0'} ({Math.round(monthRatio * 100)}%)
        </div>
      </div>
    </div>
  )
}

export function StreakBadge({ stats }: { stats: StreakStats | undefined }): ReactNode {
  if (!stats) return null
  const weeks = stats.unit === 'weeks'
  const label = weeks ? (stats.current === 1 ? 'неделя' : 'нед.') : dayWord(stats.current)
  const title =
    stats.current === 0
      ? weeks
        ? 'Подряд ещё ни одной закрытой недели'
        : 'Серия прервана'
      : `${stats.current} ${weeks ? weekWord(stats.current) : dayWord(stats.current)} подряд`
  return (
    <span className="streak" title={title}>
      <span className="streak-current">{stats.current}</span>
      <span>{label}</span>
      {stats.best > stats.current ? (
        <span className="streak-record" title={`Рекорд: ${stats.best} ${dayWord(stats.best)}`}>
          🏆 {stats.best}
        </span>
      ) : null}
    </span>
  )
}