import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
const SALT_LENGTH = 16

export interface Credentials {
  username: string
  password: string
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export async function hashPassword(password: string, salt?: string): Promise<{ salt: string; hash: string }> {
  const useSalt = salt ?? randomBytes(SALT_LENGTH).toString('hex')
  const derived = await scryptAsync(password.normalize('NFKC'), useSalt, KEY_LENGTH)
  return { salt: useSalt, hash: derived.toString('hex') }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt)
  return safeEqualHex(hash, expectedHash)
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/** В базу кладём только хеш токена — сам токен знает только клиент. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Сравниваем с заглушкой той же длины, чтобы не выдавать длину по времени ответа.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = []
  if (password.length < 8) problems.push('Минимум 8 символов')
  if (password.length > 200) problems.push('Слишком длинный пароль')
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password)) problems.push('Нужна хотя бы одна буква')
  if (!/[0-9]/.test(password)) problems.push('Нужна хотя бы одна цифра')
  return problems
}

interface Attempt {
  count: number
  firstAt: number
  blockedUntil: number
}

/** Ограничение попыток входа, чтобы перебор по локальной сети был невозможен. */
export class LoginThrottle {
  private attempts = new Map<string, Attempt>()

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 5 * 60 * 1000,
    private readonly blockMs = 15 * 60 * 1000,
  ) {}

  private key(ip: string, username: string): string {
    return `${ip}|${username}`
  }

  retryAfterMs(ip: string, username: string): number {
    const attempt = this.attempts.get(this.key(ip, username))
    if (!attempt) return 0
    const now = Date.now()
    if (attempt.blockedUntil > now) return attempt.blockedUntil - now
    if (now - attempt.firstAt > this.windowMs) {
      this.attempts.delete(this.key(ip, username))
    }
    return 0
  }

  registerFailure(ip: string, username: string): void {
    const key = this.key(ip, username)
    const now = Date.now()
    const attempt = this.attempts.get(key)
    if (!attempt || now - attempt.firstAt > this.windowMs) {
      this.attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 })
      return
    }
    attempt.count += 1
    if (attempt.count >= this.maxAttempts) {
      attempt.blockedUntil = now + this.blockMs
      attempt.count = 0
      attempt.firstAt = now
    }
  }

  registerSuccess(ip: string, username: string): void {
    this.attempts.delete(this.key(ip, username))
  }

  /** Периодическая чистка, чтобы карта не росла бесконечно. */
  sweep(): void {
    const now = Date.now()
    for (const [key, attempt] of this.attempts) {
      if (now - attempt.firstAt > this.windowMs && attempt.blockedUntil <= now) this.attempts.delete(key)
    }
  }
}
