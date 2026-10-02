import { useMemo, useState, type ReactNode } from 'react'
import type { DateStr, Habit } from '../../main/domain/types'
import { addMonths, formatDateRu, monthNameNominative, parseDate, startOfMonth, todayStr } from '../../main/domain/dates'
import { useApp } from '../state/app'
import { DayPanel } from '../components/DayPanel'
import { Legend, MonthCalendar } from '../components/MonthCalendar'
import { HabitEditor } from '../components/HabitEditor'

export function CalendarView(): ReactNode {
  const { state } = useApp()
  const today = state?.today ?? todayStr()
  const [cursor, setCursor] = useState<DateStr>(() => startOfMonth(today))
  const [selected, setSelected] = useState<DateStr>(today)
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined)

  const habits = useMemo(
    () => (state?.habits ?? []).filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [state?.habits],
  )

  if (!state) return null

  const monthDate = parseDate(cursor)
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  return (
    <div className="view">
      <div className="view-inner">
        <div className="row row-between wrap">
          <h1>Календарь</h1>
          <div className="cal-nav">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setCursor(addMonths(cursor, -1))}
              aria-label="Предыдущий месяц"
            >
              ←
            </button>
            <span className="cal-month">
              {monthNameNominative(month)} {year}
            </span>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label="Следующий месяц"
            >
              →
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCursor(startOfMonth(today))
                setSelected(today)
              }}
            >
              Сегодня
            </button>
          </div>
        </div>

        <div className="cal-layout">
          <div className="card">
            <MonthCalendar
              year={year}
              month={month}
              today={today}
              selected={selected}
              habits={habits}
              entries={state.entries}
              weekStartsOn={state.settings.weekStartsOn}
              onSelect={setSelected}
            />
            <div style={{ marginTop: 14 }}>
              <Legend habits={habits} />
              <div className="hint" style={{ marginTop: 8 }}>
                Точка — выполнено, кольцо — частично. Полоса снизу показывает выполнение дня.
                Нажмите на день, чтобы изменить отметки за него, включая прошлые.
              </div>
            </div>
          </div>

          <DayPanel
            date={selected}
            habits={habits}
            entries={state.entries}
            today={today}
            onEdit={setEditing}
          />
        </div>

        <div className="hint">
          Выбрано: {formatDateRu(selected, true)}
        </div>

        {editing !== undefined ? <HabitEditor habit={editing} onClose={() => setEditing(undefined)} /> : null}
      </div>
    </div>
  )
}