import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import type { DeloadSuggestion, ExerciseMaster, WorkoutLog } from '../types'
import {
  applyDeloadDismissal,
  dismissDeloadUntilNextLog,
  getActiveDeloadSuggestion,
  getDeloadDismissal,
  isDeloadDismissalActive,
} from './deload'

function makeDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

function makeLog(
  date: string,
  createdAt: number,
  name = 'ベンチプレス'
): WorkoutLog {
  return {
    id: createdAt,
    date,
    exercises: [
      {
        id: crypto.randomUUID(),
        name,
        sets: [{ weight: 80, reps: 10 }],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  }
}

describe('deload service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await db.workoutLogs.clear()
    await db.exerciseMasters.clear()
    await db.appSettings.clear()
  })

  it('saves and reads deload dismissal', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)

    await dismissDeloadUntilNextLog()

    await expect(getDeloadDismissal()).resolves.toEqual({
      dismissedAt: 1234567890,
    })
  })

  it('keeps dismissal active until a new log is created', () => {
    const logs = [
      makeLog(makeDateDaysAgo(0), 100),
      makeLog(makeDateDaysAgo(1), 90),
    ]

    expect(isDeloadDismissalActive({ dismissedAt: 1000 }, logs)).toBe(true)
    expect(isDeloadDismissalActive({ dismissedAt: 95 }, logs)).toBe(false)
  })

  it('suppresses deload suggestion while dismissal is active', () => {
    const suggestion: DeloadSuggestion = {
      reason: 'accumulated_sessions',
      message: 'ディロードを推奨します。',
      sessionCount: 16,
    }
    const logs = [makeLog(makeDateDaysAgo(0), 10)]

    expect(applyDeloadDismissal(suggestion, { dismissedAt: 20 }, logs)).toBeNull()
    expect(applyDeloadDismissal(suggestion, { dismissedAt: 5 }, logs)).toEqual(suggestion)
  })

  it('re-enables deload suggestion after a new log is created', () => {
    const masters: ExerciseMaster[] = [{ name: 'ベンチプレス', createdAt: 1 }]
    const logs: WorkoutLog[] = []

    for (let i = 0; i < 16; i += 1) {
      logs.push(makeLog(makeDateDaysAgo(i), i + 1))
    }

    const activeSuggestion = getActiveDeloadSuggestion(logs, masters, { dismissedAt: 999 })
    expect(activeSuggestion).toBeNull()

    const reenabledSuggestion = getActiveDeloadSuggestion(logs, masters, { dismissedAt: 8 })
    expect(reenabledSuggestion).not.toBeNull()
    expect(reenabledSuggestion?.reason).toBe('accumulated_sessions')
  })
})
