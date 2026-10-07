import { useState, type ReactNode } from 'react'
import type { Habit, Schedule } from '../../main/domain/types'
import { HABIT_COLORS } from '../../main/domain/types'
import { MAX_NOTE_LENGTH, MAX_REMINDERS, TIME_RE } from '../../main/domain/reminders'
import { eachDay, isDateStr, todayStr } from '../../main/domain/dates'
import { dateForScheduledCount, isScheduleDay } from '../../main/domain/schedule'
import { WEEKDAYS_MON_FIRST } from '../../i18n'
import type { HabitDraft } from '../api/client'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'
import { Modal } from './Modal'

interface HabitEditorProps {
  habit: Habit | null
  onClose: () => void
}

type EndMode = 'never' | 'date' | 'count'

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
    note: '',
    reminders: [],
    schedule: { mode: 'daily' },
    startDate: todayStr(),
    endDate: null,
    resetStreakOnMiss: true,
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
    note: habit.note ?? '',
    reminders: [...habit.reminders],
    schedule: { ...habit.schedule } as Schedule,
    startDate: habit.startDate,
    endDate: habit.endDate,
    resetStreakOnMiss: habit.resetStreakOnMiss,
  }
}

function scheduledCount(schedule: Schedule, start: string, end: string | null): number {
  if (!end || end < start) return 0
  return eachDay(start, end).filter((date) => isScheduleDay(schedule, date)).length
}

/** Ближайшие полчаса: значение, которое не придётся править вручную. */
function suggestTime(): string {
  const now = new Date()
  const rounded = (now.getHours() * 60 + Math.ceil(now.getMinutes() / 30) * 30) % (24 * 60)
  const hours = String(Math.floor(rounded / 60)).padStart(2, '0')
  const minutes = String(rounded % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function HabitEditor({ habit, onClose }: HabitEditorProps): ReactNode {
  const { createHabit, updateHabit, deleteHabit, notify } = useApp()
  const { t, lang } = useI18n()
  const [draft, setDraft] = useState<HabitDraft>(() => (habit ? fromHabit(habit) : emptyDraft()))
  const [endMode, setEndMode] = useState<EndMode>(() => (habit?.endDate ? 'date' : 'never'))
  const [endCount, setEndCount] = useState(() =>
    habit?.endDate ? Math.max(1, scheduledCount(habit.schedule, habit.startDate, habit.endDate)) : 30,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = (changes: Partial<HabitDraft>): void => setDraft((current) => ({ ...current, ...changes }))

  function setSchedule(schedule: Schedule): void {
    patch({ schedule })
    if (endMode === 'count') patch({ endDate: dateForScheduledCount(schedule, draft.startDate, endCount) })
  }

  function setStartDate(value: string): void {
    patch({ startDate: value })
    if (endMode === 'count') patch({ endDate: dateForScheduledCount(draft.schedule, value, endCount) })
    else if (endMode === 'date' && draft.endDate && draft.endDate < value) patch({ endDate: value })
  }

  function setCount(value: number): void {
    const count = Math.max(1, Math.round(value) || 1)
    setEndCount(count)
    patch({ endDate: dateForScheduledCount(draft.schedule, draft.startDate, count) })
  }

  function chooseEndMode(mode: EndMode): void {
    setEndMode(mode)
    if (mode === 'never') {
      patch({ endDate: null })
    } else if (mode === 'date') {
      patch({ endDate: draft.endDate ?? draft.startDate })
    } else {
      const count = draft.endDate
        ? Math.max(1, scheduledCount(draft.schedule, draft.startDate, draft.endDate))
        : endCount
      setEndCount(count)
      patch({ endDate: dateForScheduledCount(draft.schedule, draft.startDate, count) })
    }
  }

  function toggleDay(day: number): void {
    const current = draft.schedule.mode === 'weekdays' ? draft.schedule.days : []
    const days = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    setSchedule({ mode: 'weekdays', days: days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)) })
  }

  function setReminder(index: number, value: string): void {
    patch({ reminders: draft.reminders.map((time, i) => (i === index ? value : time)) })
  }

  function addReminder(): void {
    if (draft.reminders.length >= MAX_REMINDERS) return
    patch({ reminders: [...draft.reminders, suggestTime()] })
  }

  function removeReminder(index: number): void {
    patch({ reminders: draft.reminders.filter((_, i) => i !== index) })
  }

  function validate(): string {
    if (draft.name.trim().length === 0) return t('editor.err.name')
    if (!isDateStr(draft.startDate)) return t('editor.err.start')
    if (draft.endDate && draft.endDate < draft.startDate) return t('editor.err.endBeforeStart')
    if (draft.type === 'count' && draft.targetPerDay < 1) return t('editor.err.goalMin')
    if (draft.schedule.mode === 'weekdays' && draft.schedule.days.length === 0) return t('editor.err.pickDay')
    if (draft.schedule.mode === 'timesPerWeek' && draft.schedule.timesPerWeek < 1) return t('editor.err.timesPerWeek')
    if (draft.reminders.some((time) => !TIME_RE.test(time))) return t('editor.err.reminderTime')
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
        note: draft.note.trim(),
        reminders: draft.reminders.filter((time) => time !== ''),
        endDate: endMode === 'never' ? null : draft.endDate || null,
      }
      if (habit) await updateHabit(habit.id, payload)
      else await createHabit(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.err.save'))
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
      setError(err instanceof Error ? err.message : t('editor.err.delete'))
      setSaving(false)
    }
  }

  async function archive(): Promise<void> {
    if (!habit) return
    setSaving(true)
    try {
      await updateHabit(habit.id, { archived: true })
      notify(t('toast.archived'), 'info')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.err.save'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={habit ? t('editor.titleEdit') : t('editor.titleNew')}
      onClose={onClose}
      footer={
        <>
          {habit ? (
            confirmDelete ? (
              <>
                <span className="error-text grow">{t('editor.confirmDelete')}</span>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={saving}>
                  {t('common.delete')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => void archive()} disabled={saving}>
                  {t('editor.archive')}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                  {t('common.delete')}
                </button>
              </>
            )
          ) : null}
          <div className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="habit-name">{t('editor.name')}</label>
          <input
            id="habit-name"
            className="input"
            value={draft.name}
            autoFocus
            maxLength={80}
            placeholder={t('editor.namePlaceholder')}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>

        <div className="field span-2">
          <label htmlFor="habit-note">{t('editor.note')}</label>
          <textarea
            id="habit-note"
            className="input"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={t('editor.notePlaceholder')}
            value={draft.note}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </div>

        <div className="field">
          <label>{t('editor.icon')}</label>
          <div className="icon-input-row">
            <input
              className="input"
              value={draft.icon}
              maxLength={4}
              aria-label={t('editor.iconAria')}
              onChange={(event) => patch({ icon: event.target.value })}
            />
            <span className="hint">{t('editor.emoji')}</span>
          </div>
        </div>

        <div className="field">
          <label>{t('editor.color')}</label>
          <div className="color-picker">
            {HABIT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch"
                style={{ background: color }}
                aria-label={t('editor.colorAria', { color })}
                aria-pressed={draft.color === color}
                onClick={() => patch({ color })}
              />
            ))}
          </div>
        </div>

        <div className="field span-2">
          <label>{t('editor.track')}</label>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={draft.type === 'boolean'}
              onClick={() => patch({ type: 'boolean' })}
            >
              {t('editor.boolean')}
            </button>
            <button type="button" aria-pressed={draft.type === 'count'} onClick={() => patch({ type: 'count' })}>
              {t('editor.count')}
            </button>
          </div>
        </div>

        {draft.type === 'count' ? (
          <>
            <div className="field">
              <label htmlFor="habit-target">{t('editor.dailyGoal')}</label>
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
              <label htmlFor="habit-unit">{t('editor.unit')}</label>
              <input
                id="habit-unit"
                className="input"
                value={draft.unit}
                maxLength={24}
                placeholder={t('editor.unitPlaceholder')}
                onChange={(event) => patch({ unit: event.target.value })}
              />
            </div>
          </>
        ) : null}

        <div className="field span-2">
          <label>{t('editor.repeat')}</label>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'daily'}
              onClick={() => setSchedule({ mode: 'daily' })}
            >
              {t('editor.everyDay')}
            </button>
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'weekdays'}
              onClick={() =>
                setSchedule(draft.schedule.mode === 'weekdays' ? draft.schedule : { mode: 'weekdays', days: [1, 2, 3, 4, 5] })
              }
            >
              {t('editor.selectedDays')}
            </button>
            <button
              type="button"
              aria-pressed={draft.schedule.mode === 'timesPerWeek'}
              onClick={() =>
                setSchedule(
                  draft.schedule.mode === 'timesPerWeek' ? draft.schedule : { mode: 'timesPerWeek', timesPerWeek: 3 },
                )
              }
            >
              {t('editor.timesPerWeek')}
            </button>
          </div>
        </div>

        {draft.schedule.mode === 'weekdays' ? (
          <div className="field span-2">
            <label>{t('editor.weekdays')}</label>
            <div className="day-picker">
              {DAY_ORDER.map((day) => {
                const days = draft.schedule.mode === 'weekdays' ? draft.schedule.days : []
                return (
                  <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}>
                    {WEEKDAYS_MON_FIRST[lang][(day + 6) % 7]}
                  </button>
                )
              })}
            </div>
            <span className="hint">{t('editor.weekdaysHint')}</span>
          </div>
        ) : null}

        {draft.schedule.mode === 'timesPerWeek' ? (
          <div className="field span-2">
            <label htmlFor="habit-times">{t('editor.timesLabel')}</label>
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
            <span className="hint">{t('editor.timesHint')}</span>
          </div>
        ) : null}

        <div className="field span-2">
          <label>{t('editor.reminders')}</label>
          <div className="reminder-list">
            {draft.reminders.map((time, index) => (
              <div className="reminder-row" key={index}>
                <input
                  className="input"
                  type="time"
                  value={time}
                  aria-label={t('editor.reminderTimeAria')}
                  onChange={(event) => setReminder(index, event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label={t('editor.reminderRemove')}
                  onClick={() => removeReminder(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {draft.reminders.length < MAX_REMINDERS ? (
            <button type="button" className="btn btn-ghost" onClick={addReminder}>
              {`+ ${t('editor.reminderAdd')}`}
            </button>
          ) : null}
          <span className="hint">
            {draft.reminders.length >= MAX_REMINDERS
              ? t('editor.reminderMax', { max: MAX_REMINDERS })
              : t('editor.remindersHint')}
          </span>
        </div>

        <div className="field span-2">
          <label>{t('editor.resetStreak')}</label>
          <div className="switch-row">
            <div className="switch-text">
              <span className="hint">
                {draft.resetStreakOnMiss ? t('editor.resetStreakHintOn') : t('editor.resetStreakHintOff')}
              </span>
            </div>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={draft.resetStreakOnMiss}
              aria-label={t('editor.resetStreak')}
              onClick={() => patch({ resetStreakOnMiss: !draft.resetStreakOnMiss })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="habit-start">{t('editor.start')}</label>
          <input
            id="habit-start"
            className="input"
            type="date"
            value={draft.startDate}
            max={todayStr()}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="field">
          <label>{t('editor.endMode')}</label>
          <div className="segmented">
            <button type="button" aria-pressed={endMode === 'never'} onClick={() => chooseEndMode('never')}>
              {t('editor.endNever')}
            </button>
            <button type="button" aria-pressed={endMode === 'date'} onClick={() => chooseEndMode('date')}>
              {t('editor.endDate')}
            </button>
            <button type="button" aria-pressed={endMode === 'count'} onClick={() => chooseEndMode('count')}>
              {t('editor.endCount')}
            </button>
          </div>
        </div>

        {endMode === 'date' ? (
          <div className="field span-2">
            <label htmlFor="habit-end">{t('editor.endDate')}</label>
            <input
              id="habit-end"
              className="input"
              type="date"
              value={draft.endDate ?? ''}
              min={draft.startDate}
              onChange={(event) => patch({ endDate: event.target.value || null })}
            />
          </div>
        ) : null}

        {endMode === 'count' ? (
          <div className="field span-2">
            <label htmlFor="habit-end-count">{t('editor.endCountLabel')}</label>
            <input
              id="habit-end-count"
              className="input"
              type="number"
              min={1}
              max={9999}
              value={endCount}
              onChange={(event) => setCount(Number(event.target.value))}
            />
            <span className="hint">{t('editor.endCountHint')}</span>
          </div>
        ) : null}
      </div>

      {error ? <div className="error-text">{error}</div> : null}
    </Modal>
  )
}
