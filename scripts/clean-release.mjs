import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const releaseDir = join(root, 'release')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const all = process.argv.includes('--all')

try {
  if (all) {
    rmSync(releaseDir, { recursive: true, force: true })
    console.log('release/ removed')
    process.exit(0)
  }
  const removed = []
  for (const name of readdirSync(releaseDir)) {
    if (name.startsWith('habit-tracker-') && !name.includes(version)) {
      rmSync(join(releaseDir, name), { recursive: true, force: true })
      removed.push(name)
    }
  }
  console.log(
    removed.length ? `removed ${removed.length} stale artifact(s):\n  ${removed.join('\n  ')}` : 'no stale artifacts',
  )
} catch (err) {
  if (err.code !== 'ENOENT') throw err
  console.log('release/ does not exist')
}
