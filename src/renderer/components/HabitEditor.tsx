import { useState, type ReactNode } from 'react'
import type { Habit, Schedule } from '../../main/domain/types'
import { HABIT_COLORS, WEEKDAY_LABELS } from '../../main/domain/types'
import { isDateStr, todayStr } from '../../main/domain/dates'
import type { HabitDraft } from '../api/client'
import { useApp } from '../state/app'
import { Modal } from './Modal'

interface HabitEditorProps {
  habit: Habit | null
  onClose: () => void
}

/** Кнопки дней недели в порядке Пн–Вс. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function emptyDraft(): HabitDraft {
  return {
    name: '',
    color: HABIT_COLORS[4] as string,
    icon: '✅',
    type: 'boolean',
    targetPerDay: 1,
    unit: '',
    schedule: { mode: 'daily' },
    startDate: todayStr(),
    endDate: null,
  }
}

function fromHabit(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    color: habit.color,
    icon: habit.icon,
    type: habit.type,
    targetPerDay: habit.targetPerDay,
    unit: habit.unit,
    schedule: { ...habit.schedule } as Schedule,
    startDate: habit.startDate,
    endDate: habit.endDate,
  }
}

export function HabitEditor({ habit, onClose }: HabitEditorProps): ReactNode {
  const { createHabit, updateHabit, deleteHabit } = useApp()
  const [draft, setDraft] = useState<HabitDraft>(() => (habit ? fromHabit(habit) : emptyDraft()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = (changes: Partial<HabitDraft>): void => setDraft((current) => ({ ...current, ...changes }))

  const setSchedule = (schedule: Schedule): void => patch({ schedule })

  function toggleDay(day: number): void {
    const current = draft.schedule.mode === 'weekdays' ? draft.schedule.days : []
    const days = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    setSchedule({ mode: 'weekdays', days: days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)) })
  }

  function validate(): string {
    if (draft.name.trim().length === 0) return 'Введите название привычки'
    if (!isDateStr(draft.startDate)) return 'Проверьте дату начала'
    if (draft.endDate && draft.endDate < draft.startDate) return 'Дата окончания раньше даты начала'
    if (draft.type === 'count' && draft.targetPerDay < 1) return 'Цель должна быть не меньше 1'
    if (draft.schedule.mode === 'weekdays' && draft.schedule.days.length === 0) return 'Выберите хотя бы один день'
    if (draft.schedule.mode === 'timesPerWeek' && draft.schedule.timesPerWeek < 1) return 'Выберите количество дней в неделю'
    return ''
  }

  async function save(): Promise<void> {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      const payload: HabitDraft = {
        ...draft,
        name: draft.name.trim(),
        endDate: draft.endDate || null,
      }
      if (habit) await updateHabit(habit.id, payload)
      else await createHabit(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
      setSaving(false)
    }
  }

  async function remove(): Promise<void> {
    if (!habit) return
    setSaving(true)
    try {
      await deleteHabit(habit.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={habit ? 'Привычка' : 'Новая привычка'}
      onClose={onClose}
      footer={
        <>
          {habit ? (
            confirmDelete ? (
              <>
                <span className="error-text grow">Удалить вместе с историей?</span>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={saving}>
                  Удалить
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Удалить
              </button>
            )
          ) : null}
          <div className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="habit-name">Название</label>
          <input
            id="habit-name"
            className="input"
            value={draft.name}
            autoFocus
            maxLength={80}
            placeholder="Например, стаканов воды"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>

        <div className="field">
          <label>Значок</label>
          <div className="icon-input-row">
            <input
              className="input"
              value={draft.icon}
              maxLength={4}
              aria-label="Значок"
              onChange={(event) => patch({ icon: event.target.value })}
            />
            <span className="hint">Эмодзи</span>
          </div>
        </div>

        <div className="field">
          <label>Цвет</label>
          <div className="color-picker">
            {HABIT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch"
                style={{ background: color }}
                aria-label={`Цвет ${color}`}
                aria-pressed={draft.color === color}
                onClick={() => patch({ color })}
              />
            ))}
          </div>
        </div>

        <div className="field span-2">
          <label>Как отмечать</label>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={draft.type === 'boolean'}
              onClick={() => patch({ type: 'boolean' })}
            >
              Да / нет
            </button>
            <button
              type="button"
              aria-pressed={draft.type === 'count'}
              onClick={() => patch({ type: 'count' })}
            >
              Счётчик
            </button>
          </div>
        </div>

        {draft.type === 'count' ? (
          <>
            <div className="field">
              <label htmlFor="habit-target">Цель за день</label>
              <input
                id="habit-target"
                className="input"
                type="number"
                min={1}
                max={9999}
                value={draft.targetPerDay}
                onChange={(event) => patch({ targetPerDay: Number(event.target.value) || 1 })}
              />
            </div>
            <div className="field">
              <label htmlFor="habit-unit">Единица</label>
              <input
                id="habit-unit"
                className="input"
                value={draft.unit}
                maxLength={24}
                placeholder="стаканов, мин"
                onChange={(event) => patch({ unit: event.target.value })}
              />
            </div>
          </>
        ) : null}

        <div className="field span-2">
          <label>Повторение</label>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'daily'}
              onClick={() => setSchedule({ mode: 'daily' })}
            >
              Каждый день
            </button>
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'weekdays'}
              onClick={() =>
                setSchedule(
                  draft.schedule.mode === 'weekdays'
                    ? draft.schedule
                    : { mode: 'weekdays', days: [1, 2, 3, 4, 5] },
                )
              }
            >
              Выбранные дни
            </button>
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'timesPerWeek'}
              onClick={() =>
                setSchedule(
                  draft.schedule.mode === 'timesPerWeek'
                    ? draft.schedule
                    : { mode: 'timesPerWeek', timesPerWeek: 3 },
                )
              }
            >
              N раз в неделю
            </button>
          </div>
        </div>

        {draft.schedule.mode === 'weekdays' ? (
          <div className="field span-2">
            <label>Дни недели</label>
            <div className="day-picker">
              {DAY_ORDER.map((day) => {
                const days = draft.schedule.mode === 'weekdays' ? draft.schedule.days : []
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={days.includes(day)}
                    onClick={() => toggleDay(day)}
                  >
                    {WEEKDAY_LABELS[(day + 6) % 7]}
                  </button>
                )
              })}
            </div>
            <span className="hint">Невыбранные дни серию не обнуляют.</span>
          </div>
        ) : null}

        {draft.schedule.mode === 'timesPerWeek' ? (
          <div className="field span-2">
            <label htmlFor="habit-times">Сколько раз в неделю</label>
            <input
              id="habit-times"
              className="input"
              type="number"
              min={1}
              max={7}
              value={draft.schedule.mode === 'timesPerWeek' ? draft.schedule.timesPerWeek : 3}
              onChange={(event) =>
                setSchedule({
                  mode: 'timesPerWeek',
                  timesPerWeek: Math.min(7, Math.max(1, Number(event.target.value) || 1)),
                })
              }
            />
            <span className="hint">
              Серия считается неделями: сколько недель подряд выполнена квота. Текущая неделя ещё не закончилась.
            </span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="habit-start">Начало</label>
          <input
            id="habit-start"
            className="input"
            type="date"
            value={draft.startDate}
            max={todayStr()}
            onChange={(event) => patch({ startDate: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="habit-end">Окончание (необязательно)</label>
          <input
            id="habit-end"
            className="input"
            type="date"
            value={draft.endDate ?? ''}
            min={draft.startDate}
            onChange={(event) => patch({ endDate: event.target.value || null })}
          />
        </div>
      </div>

      {error ? <div className="error-text">{error}</div> : null}
    </Modal>
  )
}