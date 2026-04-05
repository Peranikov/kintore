import { db } from '../db'
import type { DeloadDismissal, DeloadSuggestion, ExerciseMaster, WorkoutLog } from '../types'
import { generateDeloadSuggestion } from '../utils/periodization'

const DELOAD_DISMISSAL_KEY = 'deloadDismissal'

function isDeloadDismissal(value: unknown): value is DeloadDismissal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dismissedAt' in value &&
    typeof value.dismissedAt === 'number'
  )
}

export async function getDeloadDismissal(): Promise<DeloadDismissal | null> {
  const setting = await db.appSettings.where('key').equals(DELOAD_DISMISSAL_KEY).first()
  if (!setting?.value) return null

  try {
    const parsed = JSON.parse(setting.value)
    return isDeloadDismissal(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function dismissDeloadUntilNextLog(): Promise<void> {
  const dismissal: DeloadDismissal = {
    dismissedAt: Date.now(),
  }

  const existing = await db.appSettings.where('key').equals(DELOAD_DISMISSAL_KEY).first()
  const value = JSON.stringify(dismissal)

  if (existing) {
    await db.appSettings.update(existing.id!, { value })
  } else {
    await db.appSettings.add({ key: DELOAD_DISMISSAL_KEY, value })
  }
}

export function isDeloadDismissalActive(
  dismissal: DeloadDismissal | null | undefined,
  logs: WorkoutLog[]
): boolean {
  if (!dismissal) return false
  return !logs.some((log) => log.createdAt > dismissal.dismissedAt)
}

export function applyDeloadDismissal(
  suggestion: DeloadSuggestion | null,
  dismissal: DeloadDismissal | null | undefined,
  logs: WorkoutLog[]
): DeloadSuggestion | null {
  if (!suggestion) return null
  return isDeloadDismissalActive(dismissal, logs) ? null : suggestion
}

export function getActiveDeloadSuggestion(
  logs: WorkoutLog[],
  masters: ExerciseMaster[],
  dismissal: DeloadDismissal | null | undefined
): DeloadSuggestion | null {
  const suggestion = generateDeloadSuggestion(logs, masters)
  return applyDeloadDismissal(suggestion, dismissal, logs)
}
