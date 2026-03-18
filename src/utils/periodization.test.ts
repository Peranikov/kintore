import { describe, it, expect } from 'vitest'
import type { WorkoutLog, ExerciseMaster } from '../types'
import {
  calculateAccumulatedSessions,
  detectPerformanceDecline,
  generateDeloadSuggestion,
  formatDeloadForPrompt,
} from './periodization'

// ヘルパー関数: 日付を生成（指定日数前）
function makeDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

// ヘルパー関数: ログを生成
function makeLog(date: string, exercises: { name: string; sets: { weight: number; reps: number; duration?: number }[] }[]): WorkoutLog {
  return {
    id: Math.random(),
    date,
    exercises: exercises.map((ex) => ({
      id: crypto.randomUUID(),
      name: ex.name,
      sets: ex.sets,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('periodization', () => {
  describe('calculateAccumulatedSessions', () => {
    it('returns 0 for empty logs', () => {
      const result = calculateAccumulatedSessions([])
      expect(result).toBe(0)
    })

    it('returns 1 for a single training today', () => {
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(1)
    })

    it('counts sessions across consecutive days', () => {
      // 6日間連続でトレーニング
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(1), [{ name: 'スクワット', sets: [{ weight: 100, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(2), [{ name: 'デッドリフト', sets: [{ weight: 120, reps: 5 }] }]),
        makeLog(makeDateDaysAgo(3), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(4), [{ name: 'スクワット', sets: [{ weight: 100, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(5), [{ name: 'デッドリフト', sets: [{ weight: 120, reps: 5 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(6)
    })

    it('counts same-day logs as one session', () => {
      const today = makeDateDaysAgo(0)
      const logs = [
        makeLog(today, [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(today, [{ name: 'スクワット', sets: [{ weight: 100, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(1)
    })

    it('resets count when there is a 7+ day gap', () => {
      // 今日と8日前にトレーニング（7日以上の空白）
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(8), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(1) // 最新セッションのみ
    })

    it('does not reset with exactly 6 day gap', () => {
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(6), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(2)
    })

    it('returns 0 if latest training is 7+ days ago', () => {
      const logs = [
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(8), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(0)
    })

    it('counts sessions with weekly training pattern', () => {
      // 週2回ペースで8週間（16セッション）
      const logs = []
      for (let i = 0; i < 16; i++) {
        // 3-4日間隔で配置（週2回相当）
        logs.push(
          makeLog(makeDateDaysAgo(i * 3), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }])
        )
      }
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(16)
    })

    it('stops counting at the gap, not after', () => {
      // 今日、2日前、3日前、（10日空白）、14日前、15日前
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(2), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(3), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(15), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateAccumulatedSessions(logs)
      expect(result).toBe(3) // 14日前との間に11日の空白
    })
  })

  describe('detectPerformanceDecline', () => {
    const exerciseMasters: ExerciseMaster[] = [
      { name: 'ベンチプレス', createdAt: Date.now() },
      { name: '懸垂', isBodyweight: true, createdAt: Date.now() },
      { name: 'ランニング', isCardio: true, createdAt: Date.now() },
    ]

    it('returns empty array when no decline', () => {
      const logs = [
        // 直近2週間
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 85, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 85, reps: 10 }] }]),
        // その前の2週間（同等または低い）
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = detectPerformanceDecline(logs, exerciseMasters)
      expect(result).toEqual([])
    })

    it('detects decline when weight drops significantly', () => {
      const logs = [
        // 直近2週間：重量低下
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        // その前の2週間：良好
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = detectPerformanceDecline(logs, exerciseMasters)
      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('ベンチプレス')
      expect(result[0].declinePercent).toBeLessThan(-5)
    })

    it('detects decline for bodyweight exercises based on reps', () => {
      const logs = [
        // 直近2週間：回数低下
        makeLog(makeDateDaysAgo(0), [{ name: '懸垂', sets: [{ weight: 0, reps: 8 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: '懸垂', sets: [{ weight: 0, reps: 8 }] }]),
        // その前の2週間：良好
        makeLog(makeDateDaysAgo(14), [{ name: '懸垂', sets: [{ weight: 0, reps: 12 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: '懸垂', sets: [{ weight: 0, reps: 12 }] }]),
      ]
      const result = detectPerformanceDecline(logs, exerciseMasters)
      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('懸垂')
    })

    it('detects decline for cardio exercises based on duration', () => {
      const logs = [
        // 直近2週間：時間低下
        makeLog(makeDateDaysAgo(0), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 20 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 20 }] }]),
        // その前の2週間：良好
        makeLog(makeDateDaysAgo(14), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 30 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 30 }] }]),
      ]
      const result = detectPerformanceDecline(logs, exerciseMasters)
      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('ランニング')
    })

    it('sorts declines by severity', () => {
      const logs = [
        // 直近2週間
        makeLog(makeDateDaysAgo(0), [
          { name: 'ベンチプレス', sets: [{ weight: 75, reps: 10 }] },  // ~6% decline
          { name: '懸垂', sets: [{ weight: 0, reps: 6 }] },            // ~50% decline
        ]),
        makeLog(makeDateDaysAgo(7), [
          { name: 'ベンチプレス', sets: [{ weight: 75, reps: 10 }] },
          { name: '懸垂', sets: [{ weight: 0, reps: 6 }] },
        ]),
        // その前の2週間
        makeLog(makeDateDaysAgo(14), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: '懸垂', sets: [{ weight: 0, reps: 12 }] },
        ]),
        makeLog(makeDateDaysAgo(21), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: '懸垂', sets: [{ weight: 0, reps: 12 }] },
        ]),
      ]
      const result = detectPerformanceDecline(logs, exerciseMasters)
      // 低下が大きい順にソート
      expect(result[0].exerciseName).toBe('懸垂')
    })
  })

  describe('generateDeloadSuggestion', () => {
    const exerciseMasters: ExerciseMaster[] = [
      { name: 'ベンチプレス', createdAt: Date.now() },
      { name: 'スクワット', createdAt: Date.now() },
      { name: 'デッドリフト', createdAt: Date.now() },
    ]

    it('returns null when no deload needed', () => {
      // 少数セッション、パフォーマンス低下なし
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 85, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(3), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      expect(result).toBeNull()
    })

    it('suggests deload after 16+ accumulated sessions', () => {
      // 16セッション（3日間隔で配置）
      const logs = []
      for (let i = 0; i < 16; i++) {
        logs.push(
          makeLog(makeDateDaysAgo(i * 3), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }])
        )
      }
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      expect(result).not.toBeNull()
      expect(result!.reason).toBe('accumulated_sessions')
      expect(result!.sessionCount).toBe(16)
      expect(result!.message).toContain('16セッション')
    })

    it('prioritizes performance decline over accumulated sessions', () => {
      // 多数セッション + パフォーマンス低下
      const logs = [
        makeLog(makeDateDaysAgo(0), [
          { name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 90, reps: 10 }] },
        ]),
        makeLog(makeDateDaysAgo(7), [
          { name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 90, reps: 10 }] },
        ]),
        makeLog(makeDateDaysAgo(14), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
        makeLog(makeDateDaysAgo(21), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      expect(result).not.toBeNull()
      expect(result!.reason).toBe('performance_decline')
      expect(result!.performanceDecline).toBeDefined()
      expect(result!.performanceDecline!.length).toBeGreaterThanOrEqual(2)
    })

    it('requires at least 2 exercises with decline for performance_decline reason', () => {
      // 1種目のみ低下 + セッション数不足
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      // セッション数4でaccumulated_sessionsにも該当しないのでnull
      expect(result).toBeNull()
    })
  })

  describe('formatDeloadForPrompt', () => {
    it('formats accumulated sessions suggestion', () => {
      const suggestion = {
        reason: 'accumulated_sessions' as const,
        message: '16セッション連続でトレーニングを継続しています。',
        sessionCount: 16,
      }
      const result = formatDeloadForPrompt(suggestion)
      expect(result).toContain('ディロード推奨')
      expect(result).toContain('16セッション連続')
      expect(result).toContain('ボリュームを通常の50-60%に抑える')
    })

    it('formats performance decline suggestion', () => {
      const suggestion = {
        reason: 'performance_decline' as const,
        message: 'パフォーマンスが低下しています。',
        sessionCount: 12,
        performanceDecline: [
          { exerciseName: 'ベンチプレス', declinePercent: -10 },
          { exerciseName: 'スクワット', declinePercent: -8 },
        ],
      }
      const result = formatDeloadForPrompt(suggestion)
      expect(result).toContain('ディロード推奨')
      expect(result).toContain('パフォーマンス低下を検出')
      expect(result).toContain('ベンチプレス: -10%')
      expect(result).toContain('スクワット: -8%')
    })
  })
})
