import { z } from 'zod'
import { isDateStr } from '../domain/dates'

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате ГГГГ-ММ-ДД')
  // Проверка в локальной таймзоне: через toISOString() дата «уезжала» на день
  // на востоке UTC+12 и дальше.
  .refine((value) => isDateStr(value), 'Такой даты не существует')

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Имя не короче 2 символов')
    .max(40, 'Имя не длиннее 40 символов')
    .regex(/^[\p{L}\p{N}_.-]+$/u, 'Только буквы, цифры, точка, дефис и подчёркивание'),
  password: z.string().min(8, 'Пароль не короче 8 символов').max(200, 'Пароль слишком длинный'),
})

/** Смена пароля: имя пользователя здесь не передаётся и не меняется. */
export const passwordSchema = z.object({
  password: z.string().min(8, 'Пароль не короче 8 символов').max(200, 'Пароль слишком длинный'),
})

export const usernameSchema = z.object({
  username: credentialsSchema.shape.username,
})

export const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('daily') }),
  z.object({
    mode: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)).min(1, 'Выберите хотя бы один день'),
  }),
  z.object({
    mode: z.literal('timesPerWeek'),
    timesPerWeek: z.number().int().min(1, 'Минимум 1 раз').max(7, 'Максимум 7 раз'),
  }),
])

export const habitInputSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80, 'Название слишком длинное'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #rrggbb'),
  icon: z.string().max(8).default('✅'),
  type: z.enum(['boolean', 'count']),
  targetPerDay: z.number().int().min(1, 'Минимум 1').max(9999, 'Слишком много'),
  unit: z.string().max(24).default(''),
  schedule: scheduleSchema,
  startDate: dateStr,
  endDate: dateStr.nullable().default(null),
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
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})

export const entryValueSchema = z.object({
  value: z.number().int().min(0, 'Значение не может быть отрицательным').max(99999, 'Слишком большое значение'),
})

export const entryDeltaSchema = z.object({
  delta: z.number().int().min(-9999).max(9999),
})

export const settingsSchema = z.object({
  streakResetEnabled: z.boolean().optional(),
  trayEnabled: z.boolean().optional(),
  remoteAccessEnabled: z.boolean().optional(),
  launchAtLogin: z.boolean().optional(),
  serverPort: z.number().int().min(1024, 'Порт от 1024').max(65535, 'Порт до 65535').optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const importSchema = z.object({
  version: z.number().optional(),
  habits: z.array(z.unknown()).max(500, 'Слишком много привычек'),
  entries: z.record(z.string(), z.unknown()).optional(),
})

export type HabitInput = z.infer<typeof habitInputSchema>
export type HabitPatchInput = z.infer<typeof habitPatchSchema>
export type SettingsInput = z.infer<typeof settingsSchema>
