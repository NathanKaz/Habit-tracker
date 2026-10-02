import type { DateStr } from './types'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== 'string') return false
  const m = DATE_RE.exec(value)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const d = new Date(year, month - 1, day, 12, 0, 0, 0)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Дата -> строка YYYY-MM-DD в локальной таймзоне. */
export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Строка -> дата в локальной таймзоне, полдень — чтобы не сбоить на переходе часов. */
export function parseDate(s: DateStr): Date {
  const parts = s.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1]) - 1
  const day = Number(parts[2])
  return new Date(year, month, day, 12, 0, 0, 0)
}

export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now)
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function diffDays(a: DateStr, b: DateStr): number {
  const ms = parseDate(a).getTime() - parseDate(b).getTime()
  return Math.round(ms / 86400000)
}

/** 0 = воскресенье ... 6 = суббота */
export function weekdayOf(s: DateStr): number {
  return parseDate(s).getDay()
}

export function startOfWeek(s: DateStr, weekStartsOn: 0 | 1 = 1): DateStr {
  const wd = weekdayOf(s)
  const back = (wd - weekStartsOn + 7) % 7
  return addDays(s, -back)
}

export function endOfWeek(s: DateStr, weekStartsOn: 0 | 1 = 1): DateStr {
  return addDays(startOfWeek(s, weekStartsOn), 6)
}

export function startOfMonth(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`
}

export function endOfMonth(s: DateStr): DateStr {
  const d = parseDate(s)
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0))
}

export function addMonths(s: DateStr, n: number): DateStr {
  const d = parseDate(s)
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1, 12, 0, 0, 0))
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a <= b ? a : b
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a >= b ? a : b
}

/** Все дни от from до to включительно. */
export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  if (from > to) return []
  const count = diffDays(to, from) + 1
  if (count > 20000) return []
  const out: DateStr[] = new Array(count)
  let cur = from
  for (let i = 0; i < count; i += 1) {
    out[i] = cur
    cur = addDays(cur, 1)
  }
  return out
}

/** Сетка календаря: 6 недель × 7 дней, начиная с нужного дня недели. */
export function monthGrid(year: number, month0: number, weekStartsOn: 0 | 1 = 1): DateStr[] {
  const first = new Date(year, month0, 1, 12, 0, 0, 0)
  const start = startOfWeek(toDateStr(first), weekStartsOn)
  const out: DateStr[] = new Array(42)
  for (let i = 0; i < 42; i += 1) out[i] = addDays(start, i)
  return out
}

const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const MONTHS_NOM = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export function monthNameGenitive(s: DateStr): string {
  return MONTHS_GEN[parseDate(s).getMonth()] ?? ''
}

export function monthNameNominative(month0: number): string {
  return MONTHS_NOM[month0] ?? ''
}

export function monthShort(month0: number): string {
  return MONTHS_SHORT[month0] ?? ''
}

/** «5 октября», «5 октября 2026» */
export function formatDateRu(s: DateStr, withYear = false): string {
  const d = parseDate(s)
  const base = `${d.getDate()} ${monthNameGenitive(s)}`
  return withYear ? `${base} ${d.getFullYear()}` : base
}

/** Склонение: 1 день, 2 дня, 5 дней */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

export function dayWord(n: number): string {
  return pluralRu(n, 'день', 'дня', 'дней')
}

export function weekWord(n: number): string {
  return pluralRu(n, 'неделя', 'недели', 'недель')
}
