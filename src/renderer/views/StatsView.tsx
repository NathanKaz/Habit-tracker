import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip as ChartTooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { dayWord, formatDate, weekWord, type TranslationKey } from '../../i18n'
import {
  chartSeries,
  dayStats,
  heatGrid,
  periodRange,
  periodTotals,
  statsToCsv,
  type PeriodId,
} from '../../main/domain/stats'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'

const PERIODS: { id: PeriodId; key: TranslationKey }[] = [
  { id: 'week', key: 'stats.periodWeek' },
  { id: 'month', key: 'stats.periodMonth' },
  { id: 'quarter', key: 'stats.periodQuarter' },
  { id: 'all', key: 'stats.periodAll' },
]

const HEAT_WEEKS = 12

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip)

function shortDate(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

interface ChartTheme {
  accent: string
  border: string
  muted: string
}

function readChartTheme(): ChartTheme {
  return { accent: cssVar('--accent'), border: cssVar('--border'), muted: cssVar('--text-faint') }
}

export function StatsView(): ReactNode {
  const { state } = useApp()
  const { t, lang } = useI18n()
  const [period, setPeriod] = useState<PeriodId>('month')
  const [filterId, setFilterId] = useState<string>('all')
  const [chartTheme, setChartTheme] = useState<ChartTheme>(readChartTheme)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartTheme(readChartTheme()))
    return () => cancelAnimationFrame(frame)
  }, [state?.settings.theme])

  const data = useMemo(() => {
    if (!state) return null
    const active = state.habits
      .filter((habit) => !habit.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const filteredHabit = filterId === 'all' ? null : (active.find((habit) => habit.id === filterId) ?? null)
    const habits = filteredHabit ? [filteredHabit] : active
    const range = periodRange(period, state.today, habits, state.settings.weekStartsOn)
    const days = dayStats(habits, state.entries, range, state.today)
    const summary = periodTotals(habits, state.entries, state.stats, range)
    const heat = heatGrid(habits, state.entries, state.today, HEAT_WEEKS, state.settings.weekStartsOn)
    const bucket = period === 'week' || period === 'month' ? 'day' : 'week'
    return {
      active,
      filteredHabit,
      range,
      days,
      summary,
      heat,
      points: chartSeries(days, bucket, state.settings.weekStartsOn),
      bucket,
    }
  }, [state, period, filterId])

  if (!state) return null
  if (!data) return null

  const { active, filteredHabit, range, summary, heat, points, bucket } = data
  const effectiveFilter = filteredHabit?.id ?? 'all'

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => {
            const point = points[items[0]?.dataIndex ?? -1]
            return point ? formatDate(lang, point.date, true) : ''
          },
          label: (item) => `${item.parsed.y}% · ${t('stats.completion')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: chartTheme.border },
        ticks: {
          color: chartTheme.muted,
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        min: 0,
        max: 100,
        border: { display: false },
        grid: { color: chartTheme.border },
        ticks: { stepSize: 25, color: chartTheme.muted, font: { size: 11 }, callback: (value) => `${value}%` },
      },
    },
  }

  const chartData: ChartData<'bar'> = {
    labels: points.map((point) => shortDate(point.date)),
    datasets: [
      {
        data: points.map((point) => point.percent),
        backgroundColor: filteredHabit ? filteredHabit.color : chartTheme.accent,
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  }

  const exportCsv = (): void => {
    const csv = statsToCsv(filteredHabit ? [filteredHabit] : active, state.entries, range)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `habit-tracker-stats-${state.today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const bestStats = summary.bestStreakHabitId ? state.stats[summary.bestStreakHabitId] : undefined
  const bestHabit = bestStats ? state.habits.find((habit) => habit.id === summary.bestStreakHabitId) : null
  const bestUnit =
    bestStats?.unit === 'weeks' ? weekWord(lang, summary.bestStreak) : dayWord(lang, summary.bestStreak)

  const cellStyle = (ratio: number): CSSProperties =>
    ({ '--cell': `${Math.round(ratio * 100)}%` }) as CSSProperties

  if (active.length === 0) {
    return (
      <div className="view">
        <div className="view-inner stats">
          <div className="stats-head">
            <h1 className="stats-title">{t('nav.stats')}</h1>
          </div>
          <section className="card section">
            <p className="hint">{t('stats.empty')}</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="view">
      <div
        className="view-inner stats"
        style={filteredHabit ? ({ '--accent': filteredHabit.color } as CSSProperties) : undefined}
      >
        <div className="stats-head">
          <h1 className="stats-title">{t('nav.stats')}</h1>
          <div className="segmented">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={period === item.id}
                onClick={() => setPeriod(item.id)}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            {t('stats.exportCsv')}
          </button>
        </div>

        <div className="stats-filter">
          <label className="hint" htmlFor="stats-habit-filter">
            {t('stats.habitFilter')}
          </label>
          <select
            id="stats-habit-filter"
            className="select stats-filter-select"
            value={effectiveFilter}
            onChange={(event) => setFilterId(event.target.value)}
          >
            <option value="all">{t('stats.allHabits')}</option>
            {active.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {`${habit.icon} ${habit.name}`}
              </option>
            ))}
          </select>
        </div>

        <section className="card section">
          <div className="section-title">{t('summary.title')}</div>
          <div className="stats-summary">
            <div className="stats-stat">
              <span className="stats-stat-value">{summary.percent}%</span>
              <span className="hint">{t('stats.completion')}</span>
            </div>
            <div className="stats-stat">
              <span className="stats-stat-value">{summary.bestStreak}</span>
              <span className="hint" title={bestHabit?.name}>
                {t('stats.record')} · {bestUnit}
              </span>
            </div>
            <div className="stats-stat">
              <span className="stats-stat-value">{summary.activeHabits}</span>
              <span className="hint">{t('stats.activeHabits')}</span>
            </div>
            <div className="stats-stat">
              <span className="stats-stat-value">{summary.marks}</span>
              <span className="hint">{t('stats.totalMarks')}</span>
            </div>
          </div>
          <p className="hint">{t('summary.ratio', { done: summary.done, planned: summary.planned, percent: summary.percent })}</p>
        </section>

        <section className="card section">
          <div className="section-title">{bucket === 'day' ? t('stats.chartDay') : t('stats.chartWeek')}</div>
          {summary.planned === 0 || points.length === 0 ? (
            <p className="hint">{t('stats.noData')}</p>
          ) : (
            <div className="stats-chart">
              <Bar options={chartOptions} data={chartData} />
            </div>
          )}
        </section>

        <section className="card section">
          <div className="section-title">{t('stats.heat')}</div>
          <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${heat.weeks}, 1fr)` }}>
            {heat.cells.map((cell) => (
              <div
                key={cell.date}
                className={`heat-cell${cell.planned === 0 ? ' is-empty' : ''}${cell.future ? ' is-future' : ''}`}
                style={cellStyle(cell.ratio)}
                title={
                  cell.planned === 0
                    ? undefined
                    : t('stats.cellTitle', {
                        date: formatDate(lang, cell.date),
                        done: cell.done,
                        planned: cell.planned,
                      })
                }
              />
            ))}
          </div>
          <div className="heat-legend">
            <span className="hint">{t('stats.heatLess')}</span>
            <span className="heat-cell is-empty" />
            <span className="heat-cell" style={cellStyle(0.25)} />
            <span className="heat-cell" style={cellStyle(0.5)} />
            <span className="heat-cell" style={cellStyle(0.75)} />
            <span className="heat-cell" style={cellStyle(1)} />
            <span className="hint">{t('stats.heatMore')}</span>
          </div>
        </section>
      </div>
    </div>
  )
}
