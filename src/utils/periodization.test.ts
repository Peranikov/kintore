import { describe, it, expect } from 'vitest'
import type { WorkoutLog, ExerciseMaster } from '../types'
import {
  calculateConsecutiveTrainingWeeks,
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
  describe('calculateConsecutiveTrainingWeeks', () => {
    it('returns 0 for empty logs', () => {
      const result = calculateConsecutiveTrainingWeeks([])
      expect(result).toBe(0)
    })

    it('returns 1 for training only this week', () => {
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateConsecutiveTrainingWeeks(logs)
      expect(result).toBe(1)
    })

    it('returns consecutive weeks count when training every week', () => {
      // 今週、先週、2週間前、3週間前にトレーニング（4週連続）
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateConsecutiveTrainingWeeks(logs)
      expect(result).toBe(4)
    })

    it('counts multiple trainings in same week as one week', () => {
      // 今週に複数回トレーニング
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(1), [{ name: 'スクワット', sets: [{ weight: 100, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(2), [{ name: 'デッドリフト', sets: [{ weight: 120, reps: 5 }] }]),
      ]
      const result = calculateConsecutiveTrainingWeeks(logs)
      expect(result).toBe(1)
    })

    it('resets count when a week is skipped', () => {
      // 今週と3週間前にトレーニング（間に1週間空き）
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateConsecutiveTrainingWeeks(logs)
      expect(result).toBe(1) // 直近の連続のみ
    })

    it('returns 0 if latest training is more than 1 week ago', () => {
      // 2週間以上前のトレーニングのみ
      const logs = [
        makeLog(makeDateDaysAgo(15), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(22), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = calculateConsecutiveTrainingWeeks(logs)
      expect(result).toBe(0)
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
      // 2週間のトレーニングのみ、パフォーマンス低下なし
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 85, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      expect(result).toBeNull()
    })

    it('suggests deload after 4+ consecutive weeks', () => {
      // 4週連続トレーニング
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      expect(result).not.toBeNull()
      expect(result!.reason).toBe('consecutive_weeks')
      expect(result!.weeksTraining).toBe(4)
      expect(result!.message).toContain('4週連続')
    })

    it('prioritizes performance decline over consecutive weeks', () => {
      // 4週連続 + パフォーマンス低下
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
      // 1種目のみ低下（閾値未満）
      const logs = [
        makeLog(makeDateDaysAgo(0), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(7), [{ name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(14), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDateDaysAgo(21), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]
      const result = generateDeloadSuggestion(logs, exerciseMasters)
      // 1種目の低下では consecutive_weeks にフォールバック
      expect(result).not.toBeNull()
      expect(result!.reason).toBe('consecutive_weeks')
    })
  })

  describe('formatDeloadForPrompt', () => {
    it('formats consecutive weeks suggestion', () => {
      const suggestion = {
        reason: 'consecutive_weeks' as const,
        message: '4週連続でトレーニングを継続しています。',
        weeksTraining: 4,
      }
      const result = formatDeloadForPrompt(suggestion)
      expect(result).toContain('ディロード推奨')
      expect(result).toContain('4週連続')
      expect(result).toContain('ボリュームを通常の50-60%に抑える')
    })

    it('formats performance decline suggestion', () => {
      const suggestion = {
        reason: 'performance_decline' as const,
        message: 'パフォーマンスが低下しています。',
        weeksTraining: 3,
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
