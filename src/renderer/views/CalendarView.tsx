import { useMemo, useState, type ReactNode } from 'react'
import type { DateStr, Habit } from '../../main/domain/types'
import { addMonths, parseDate, startOfMonth, todayStr } from '../../main/domain/dates'
import { formatDate, monthName } from '../../i18n'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'
import { DayPanel } from '../components/DayPanel'
import { Legend, MonthCalendar } from '../components/MonthCalendar'
import { HabitEditor } from '../components/HabitEditor'

export function CalendarView(): ReactNode {
  const { state } = useApp()
  const { t, lang } = useI18n()
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
          <h1>{t('calendar.title')}</h1>
          <div className="cal-nav">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setCursor(addMonths(cursor, -1))}
              aria-label={t('calendar.prev')}
            >
              ←
            </button>
            <span className="cal-month">
              {monthName(lang, month)} {year}
            </span>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label={t('calendar.next')}
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
              {t('calendar.today')}
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
                {t('calendar.legend')}
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

        <div className="hint">{t('calendar.selected', { date: formatDate(lang, selected, true) })}</div>

        {editing !== undefined ? <HabitEditor habit={editing} onClose={() => setEditing(undefined)} /> : null}
      </div>
    </div>
  )
}
