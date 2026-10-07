import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Store, type NewHabitInput } from '../src/main/store'

const habitInput: NewHabitInput = {
  name: 'Зарядка',
  color: '#4ade80',
  icon: '💪',
  type: 'boolean',
  targetPerDay: 1,
  unit: '',
  note: '',
  reminders: [],
  schedule: { mode: 'daily' },
  startDate: '2026-10-01',
  endDate: null,
  resetStreakOnMiss: true,
}

let dir: string

async function backupNames(): Promise<string[]> {
  try {
    return (await readdir(path.join(dir, 'backups'))).filter((name) => /^data-.*\.json$/.test(name))
  } catch {
    return []
  }
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'habit-backups-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('суточные резервные копии', () => {
  it('первая запись кладёт копию в папку backups', async () => {
    const store = await Store.open(dir)
    store.createHabit(habitInput)
    await store.flush()

    expect(await backupNames()).toHaveLength(1)
  })

  it('выключенный автобэкап не создаёт файлов', async () => {
    const store = await Store.open(dir)
    store.updateSettings({ autoBackupEnabled: false })
    store.createHabit(habitInput)
    await store.flush()

    expect(await backupNames()).toHaveLength(0)
  })

  it('хранит не больше 30 копий', async () => {
    const backupDir = path.join(dir, 'backups')
    await mkdir(backupDir, { recursive: true })
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    for (let i = 0; i < 35; i += 1) {
      const file = path.join(backupDir, `data-2030-01-01-00-${String(i).padStart(2, '0')}-00.json`)
      await writeFile(file, '{}')
      await utimes(file, old, old)
    }

    const store = await Store.open(dir)
    store.createHabit(habitInput)
    await store.flush()

    expect(await backupNames()).toHaveLength(30)
  })
})
