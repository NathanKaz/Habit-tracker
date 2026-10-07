import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppServer, type AppServerOptions } from '../src/main/server'
import { Store } from '../src/main/store'
import type { AppState, Habit } from '../src/main/domain/types'
import { addDays, todayStr } from '../src/main/domain/dates'

interface Harness {
  server: AppServer
  store: Store
  base: string
  dir: string
}

let harness: Harness

async function startServer(overrides: Partial<AppServerOptions> = {}): Promise<Harness> {
  const dir = await mkdtemp(path.join(tmpdir(), 'habit-tracker-test-'))
  const store = await Store.open(dir)
  store.updateSettings({ remoteAccessEnabled: false, serverPort: 0 })
  const server = new AppServer({
    store,
    desktopToken: 'desktop-token-for-tests',
    rendererDir: null,
    onRebind: () => undefined,
    log: () => undefined,
    ...overrides,
  })
  const port = await server.start()
  return { server, store, base: `http://127.0.0.1:${port}`, dir }
}

async function call(
  method: string,
  url: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown; text: string }> {
  const response = await fetch(`${harness.base}${url}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  return { status: response.status, data, text }
}

const json = (value: unknown): string => JSON.stringify(value)

beforeEach(async () => {
  harness = await startServer()
})

afterEach(async () => {
  await harness.server.close()
  // Сначала дописываем отложенные изменения, иначе таймер записи сработает
  // уже после удаления временной папки.
  await harness.store.flush()
  await rm(harness.dir, { recursive: true, force: true })
})

describe('учётная запись и сессии', () => {
  it('до настройки вход невозможен, после setup выдаётся токен', async () => {
    expect((await call('GET', '/api/auth/status')).data).toEqual({ configured: false })
    expect((await call('POST', '/api/auth/login', { username: 'anna', password: 'secret12' })).status).toBe(401)

    const setup = await call('POST', '/api/auth/setup', { username: 'Anna', password: 'secret12' })
    expect(setup.status).toBe(201)
    const token = (setup.data as { token: string }).token
    expect(token).toBeTruthy()
    expect((await call('GET', '/api/state', undefined, token)).status).toBe(200)
  })

  it('неверный пароль не пускает, верный — пускает и различает регистр логина', async () => {
    await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    expect((await call('POST', '/api/auth/login', { username: 'anna', password: 'wrong123' })).status).toBe(401)
    const login = await call('POST', '/api/auth/login', { username: 'ANNA', password: 'secret12' })
    expect(login.status).toBe(200)
    expect((login.data as { username: string }).username).toBe('anna')
  })

  it('смена пароля обрывает старые сессии и выдаёт новый токен', async () => {
    const setup = await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    const oldToken = (setup.data as { token: string }).token

    const changed = await call('POST', '/api/auth/password', { password: 'newsecret1' }, oldToken)
    expect(changed.status).toBe(200)
    const newToken = (changed.data as { token: string }).token
    expect(newToken).toBeTruthy()

    expect((await call('GET', '/api/state', undefined, oldToken)).status).toBe(401)
    expect((await call('GET', '/api/state', undefined, newToken)).status).toBe(200)
  })

  it('смена логина принимает объект и отсекает недопустимое имя', async () => {
    const setup = await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    const token = (setup.data as { token: string }).token

    expect((await call('POST', '/api/auth/username', { username: 'bad name!' }, token)).status).toBe(400)
    expect((await call('POST', '/api/auth/username', { username: 'boris' }, token)).status).toBe(200)

    const login = await call('POST', '/api/auth/login', { username: 'boris', password: 'secret12' })
    expect(login.status).toBe(200)
  })

  it('токен компьютера не требует входа, но не отдаётся без заголовка', async () => {
    await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    expect((await call('GET', '/api/state')).status).toBe(401)
    expect((await call('GET', '/api/state', undefined, 'desktop-token-for-tests')).status).toBe(200)
  })

  it('перечисляет активные входы и отзывает чужой по id', async () => {
    const setup = await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    const first = (setup.data as { token: string }).token
    const login = await call('POST', '/api/auth/login', { username: 'anna', password: 'secret12' })
    const second = (login.data as { token: string }).token

    const list = await call('GET', '/api/sessions', undefined, first)
    expect(list.status).toBe(200)
    const sessions = (
      list.data as { sessions: { id: string; userAgent: string; current: boolean; tokenHash?: string }[] }
    ).sessions
    expect(sessions).toHaveLength(2)
    expect(sessions.every((item) => item.id.length > 0)).toBe(true)
    expect(sessions.some((item) => item.tokenHash !== undefined)).toBe(false)
    expect(sessions.filter((item) => item.current)).toHaveLength(1)

    const other = sessions.find((item) => !item.current)
    expect(other).toBeDefined()
    const removed = await call('DELETE', `/api/sessions/${other?.id ?? ''}`, undefined, first)
    expect(removed.status).toBe(200)
    expect((await call('GET', '/api/state', undefined, second)).status).toBe(401)
    expect((await call('GET', '/api/state', undefined, first)).status).toBe(200)

    const remaining = (await call('GET', '/api/sessions', undefined, first)).data as {
      sessions: { id: string; current: boolean }[]
    }
    expect(remaining.sessions).toHaveLength(1)
    expect((await call('DELETE', `/api/sessions/${remaining.sessions[0]?.id ?? ''}`, undefined, first)).status).toBe(400)
    expect((await call('DELETE', '/api/sessions/no-such-id', undefined, first)).status).toBe(404)
  })
})

describe('привычки и отметки', () => {
  async function authed(): Promise<string> {
    const setup = await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    return (setup.data as { token: string }).token
  }

  const input = {
    name: 'Зарядка',
    color: '#4ade80',
    icon: '💪',
    type: 'boolean',
    targetPerDay: 1,
    unit: '',
    schedule: { mode: 'daily' },
    startDate: '2026-10-01',
    endDate: null,
  }

  it('создаёт привычку, отмечает и считает серию', async () => {
    const token = await authed()
    const yesterday = addDays(todayStr(), -1)
    const created = await call('POST', '/api/habits', { ...input, startDate: yesterday }, token)
    expect(created.status).toBe(201)
    const id = (created.data as { id: string }).id

    for (const date of [yesterday, todayStr()]) {
      expect((await call('POST', `/api/entries/${id}/${date}/toggle`, undefined, token)).status).toBe(200)
    }

    const state = await call('GET', '/api/state', undefined, token)
    const stats = (state.data as AppState).stats[id]
    expect(stats.current).toBe(2)
    expect(stats.best).toBe(2)
  })

  it('счётчик увеличивается на дельту и не уходит ниже нуля', async () => {
    const token = await authed()
    const created = await call(
      'POST',
      '/api/habits',
      { ...input, type: 'count', targetPerDay: 3, unit: 'раз' },
      token,
    )
    const id = (created.data as { id: string }).id

    const up = await call('POST', `/api/entries/${id}/2026-10-01/delta`, { delta: 2 }, token)
    expect((up.data as { value: number }).value).toBe(2)
    const down = await call('POST', `/api/entries/${id}/2026-10-01/delta`, { delta: -5 }, token)
    expect((down.data as { value: number }).value).toBe(0)
  })

  it('отклоняет несуществующую дату и неизвестную привычку', async () => {
    const token = await authed()
    const created = await call('POST', '/api/habits', input, token)
    const id = (created.data as { id: string }).id

    expect((await call('POST', `/api/entries/${id}/2026-02-30/toggle`, undefined, token)).status).toBe(400)
    expect((await call('POST', '/api/entries/nope/2026-10-01/toggle', undefined, token)).status).toBe(404)
  })

  it('не принимает отметки на будущие даты', async () => {
    const token = await authed()
    const created = await call('POST', '/api/habits', input, token)
    const id = (created.data as { id: string }).id
    const tomorrow = addDays(todayStr(), 1)

    expect((await call('PUT', `/api/entries/${id}/${tomorrow}`, { value: 1 }, token)).status).toBe(400)
    expect((await call('POST', `/api/entries/${id}/${tomorrow}/delta`, { delta: 1 }, token)).status).toBe(400)
    expect((await call('POST', `/api/entries/${id}/${tomorrow}/toggle`, undefined, token)).status).toBe(400)
    expect((await call('POST', `/api/entries/${id}/${todayStr()}/toggle`, undefined, token)).status).toBe(200)
  })

  it('не даёт создать привычку с датой окончания раньше начала', async () => {
    const token = await authed()
    const created = await call(
      'POST',
      '/api/habits',
      { ...input, startDate: '2026-10-10', endDate: '2026-10-01' },
      token,
    )
    expect((created.data as { endDate: string | null }).endDate).toBeNull()
  })

  it('сохраняет комментарий и напоминания, нормализуя их', async () => {
    const token = await authed()
    const created = await call(
      'POST',
      '/api/habits',
      { ...input, note: '  два стакана утром  ', reminders: ['18:00', '09:00', '09:00'] },
      token,
    )
    expect(created.status).toBe(201)
    const id = (created.data as { id: string }).id

    const state = (await call('GET', '/api/state', undefined, token)).data as AppState
    const habit = state.habits.find((h) => h.id === id)
    expect(habit?.note).toBe('два стакана утром')
    expect(habit?.reminders).toEqual(['09:00', '18:00'])

    const patched = await call('PATCH', `/api/habits/${id}`, { note: 'заменили', reminders: ['07:15'] }, token)
    expect(patched.status).toBe(200)
    expect((patched.data as Habit).note).toBe('заменили')
    expect((patched.data as Habit).reminders).toEqual(['07:15'])
  })

  it('удаление сохраняет снимок, restore возвращает привычку с отметками', async () => {
    const token = await authed()
    const created = await call('POST', '/api/habits', input, token)
    const id = (created.data as { id: string }).id
    const yesterday = addDays(todayStr(), -1)
    await call('POST', `/api/entries/${id}/${yesterday}/toggle`, undefined, token)

    expect((await call('DELETE', `/api/habits/${id}`, undefined, token)).status).toBe(200)
    const afterDelete = (await call('GET', '/api/state', undefined, token)).data as AppState
    expect(afterDelete.habits).toHaveLength(0)

    const restored = await call('POST', `/api/habits/${id}/restore`, undefined, token)
    expect(restored.status).toBe(200)
    expect((restored.data as Habit).id).toBe(id)

    const afterRestore = (await call('GET', '/api/state', undefined, token)).data as AppState
    expect(afterRestore.habits.map((habit) => habit.id)).toEqual([id])
    expect(afterRestore.entries[id]?.[yesterday]).toBe(1)

    // Снимок один: повторное восстановление и чужой id не срабатывают.
    expect((await call('POST', `/api/habits/${id}/restore`, undefined, token)).status).toBe(404)
    expect((await call('POST', '/api/habits/no-such-id/restore', undefined, token)).status).toBe(404)
  })

  it('отклоняет неверное время напоминания и лишние', async () => {
    const token = await authed()
    expect((await call('POST', '/api/habits', { ...input, reminders: ['25:00'] }, token)).status).toBe(400)
    expect((await call('POST', '/api/habits', { ...input, reminders: ['7:5'] }, token)).status).toBe(400)
    const many = Array.from({ length: 9 }, (_, i) => `0${9}:${String(i).padStart(2, '0')}`)
    expect((await call('POST', '/api/habits', { ...input, reminders: many }, token)).status).toBe(400)
  })
})

describe('настройки, экспорт и импорт', () => {
  async function authed(): Promise<string> {
    const setup = await call('POST', '/api/auth/setup', { username: 'anna', password: 'secret12' })
    return (setup.data as { token: string }).token
  }

  it('обновляет настройки и уведомляет главный процесс', async () => {
    const seen: string[] = []
    await harness.server.close()
    await harness.store.flush()
    await rm(harness.dir, { recursive: true, force: true })
    harness = await startServer({
      onSettingsChange: (_previous, next) => seen.push(next.language),
    })
    expect((await call('PATCH', '/api/settings', {}, 'desktop-token-for-tests')).status).toBe(200)
    seen.length = 0

    const response = await call(
      'PATCH',
      '/api/settings',
      { language: 'ru', autoBackupEnabled: false },
      'desktop-token-for-tests',
    )
    expect(response.status).toBe(200)
    expect((response.data as { language: string }).language).toBe('ru')
    expect((response.data as { autoBackupEnabled: boolean }).autoBackupEnabled).toBe(false)
    expect(seen).toEqual(['ru'])
  })

  it('выгружает копию с привычками и загружает её обратно', async () => {
    const token = await authed()
    await call(
      'POST',
      '/api/habits',
      {
        name: 'Чтение',
        color: '#60a5fa',
        icon: '📚',
        type: 'count',
        targetPerDay: 10,
        unit: 'стр',
        schedule: { mode: 'timesPerWeek', timesPerWeek: 3 },
        startDate: '2026-10-01',
        endDate: null,
      },
      token,
    )

    const exported = await call('GET', '/api/export', undefined, token)
    expect(exported.status).toBe(200)
    const dump = JSON.parse(exported.text) as { habits: unknown[]; entries: Record<string, unknown> }
    expect(dump.habits).toHaveLength(1)

    // Копию можно загрузить обратно: данные распознаются.
    expect((await call('POST', '/api/import', dump, token)).status).toBe(200)

    // Импорт мусора отклоняется.
    expect((await call('POST', '/api/import', { habits: 'nope' }, token)).status).toBe(400)
  })

  it('импорт применяет настройки из файла только по флагу', async () => {
    const token = await authed()
    await call('PATCH', '/api/settings', { language: 'ru' }, 'desktop-token-for-tests')
    const payload = {
      habits: [
        {
          id: 'h-imported',
          name: 'Импорт',
          color: '#4ade80',
          icon: '✅',
          type: 'boolean',
          targetPerDay: 1,
          unit: '',
          note: '',
          reminders: [],
          schedule: { mode: 'daily' },
          startDate: '2026-10-01',
          endDate: null,
          resetStreakOnMiss: true,
          archived: false,
          sortOrder: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      entries: { 'h-imported': { '2026-10-01': 1 } },
      settings: { language: 'en', theme: 'dark', autoBackupEnabled: false, serverPort: 47999 },
    }

    expect((await call('POST', '/api/import', { ...payload, restoreSettings: false }, token)).status).toBe(200)
    const first = (await call('GET', '/api/state', undefined, token)).data as AppState
    expect(first.habits.map((habit) => habit.id)).toEqual(['h-imported'])
    expect(first.entries['h-imported']?.['2026-10-01']).toBe(1)
    expect(first.settings.language).toBe('ru')

    expect((await call('POST', '/api/import', { ...payload, restoreSettings: true }, token)).status).toBe(200)
    const second = (await call('GET', '/api/state', undefined, token)).data as AppState
    expect(second.settings.language).toBe('en')
    expect(second.settings.theme).toBe('dark')
    expect(second.settings.autoBackupEnabled).toBe(false)
  })

  it('не пускает к данным без токена', async () => {
    expect((await call('GET', '/api/state')).status).toBe(401)
    expect((await call('GET', '/api/export')).status).toBe(401)
    expect((await call('POST', '/api/habits', {})).status).toBe(401)
  })

  it('проверяет формат данных привычки', async () => {
    const token = await authed()
    const response = await call(
      'POST',
      '/api/habits',
      {
        name: '',
        color: 'green',
        type: 'boolean',
        targetPerDay: 0,
        schedule: { mode: 'weekdays', days: [] },
        startDate: '01.10.2026',
      },
      token,
    )
    expect(response.status).toBe(400)
    expect(json(response.data)).toContain('error')
  })
})