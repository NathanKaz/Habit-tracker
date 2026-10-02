import { z } from 'zod'
import { isDateStr } from '../domain/dates'

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  // Проверка в локальной таймзоне: через toISOString() дата «уезжала» на день
  // на востоке UTC+12 и дальше.
  .refine((value) => isDateStr(value), 'That date does not exist')

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(40, 'Username must be at most 40 characters')
    .regex(/^[\p{L}\p{N}_.-]+$/u, 'Only letters, digits, dot, hyphen and underscore are allowed'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200, 'Password is too long'),
})

/** Смена пароля: имя пользователя здесь не передаётся и не меняется. */
export const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(200, 'Password is too long'),
})

export const usernameSchema = z.object({
  username: credentialsSchema.shape.username,
})

export const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('daily') }),
  z.object({
    mode: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one day'),
  }),
  z.object({
    mode: z.literal('timesPerWeek'),
    timesPerWeek: z.number().int().min(1, 'At least 1 time').max(7, 'At most 7 times'),
  }),
])

export const habitInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Name is too long'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be in #rrggbb format'),
  icon: z.string().max(8).default('✅'),
  type: z.enum(['boolean', 'count']),
  targetPerDay: z.number().int().min(1, 'At least 1').max(9999, 'Too many'),
  unit: z.string().max(24).default(''),
  schedule: scheduleSchema,
  startDate: dateStr,
  endDate: dateStr.nullable().default(null),
  resetStreakOnMiss: z.boolean().default(true),
})

export const habitPatchSchema = z.object({
  name: habitInputSchema.shape.name.optional(),
  color: habitInputSchema.shape.color.optional(),
  icon: habitInputSchema.shape.icon.optional(),
  type: habitInputSchema.shape.type.optional(),
  targetPerDay: habitInputSchema.shape.targetPerDay.optional(),
  unit: habitInputSchema.shape.unit.optional(),
  schedule: scheduleSchema.optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.nullable().optional(),
  resetStreakOnMiss: z.boolean().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})

export const entryValueSchema = z.object({
  value: z.number().int().min(0, 'Value cannot be negative').max(99999, 'Value is too large'),
})

export const entryDeltaSchema = z.object({
  delta: z.number().int().min(-9999).max(9999),
})

export const settingsSchema = z.object({
  language: z.enum(['en', 'ru', 'system']).optional(),
  trayEnabled: z.boolean().optional(),
  remoteAccessEnabled: z.boolean().optional(),
  launchAtLogin: z.boolean().optional(),
  serverPort: z.number().int().min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535').optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const importSchema = z.object({
  version: z.number().optional(),
  habits: z.array(z.unknown()).max(500, 'Too many habits'),
  entries: z.record(z.string(), z.unknown()).optional(),
})

export type HabitInput = z.infer<typeof habitInputSchema>
export type HabitPatchInput = z.infer<typeof habitPatchSchema>
export type SettingsInput = z.infer<typeof settingsSchema>
