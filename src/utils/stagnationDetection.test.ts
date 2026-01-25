import { describe, it, expect } from 'vitest'
import type { WorkoutLog, ExerciseMaster } from '../types'
import { detectStagnation, formatStagnationForPrompt } from './stagnationDetection'

// ヘルパー関数: 日付を生成
function makeDate(weeksAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - weeksAgo * 7)
  return date.toISOString().split('T')[0]
}

// ヘルパー関数: ログを生成
function makeLog(date: string, exercises: { name: string; sets: { weight: number; reps: number }[] }[]): WorkoutLog {
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

describe('stagnationDetection', () => {
  describe('detectStagnation', () => {
    it('detects stagnation when 1RM stays within ±5% for 2+ weeks', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ベンチプレス', createdAt: Date.now() },
      ]

      // 3週間同じ重量・回数（推定1RMが一定）
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDate(1), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
        makeLog(makeDate(2), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('ベンチプレス')
      expect(result[0].metric).toBe('推定1RM')
      expect(result[0].weeks).toBe(3)
    })

    it('does not detect stagnation when progress is made', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ベンチプレス', createdAt: Date.now() },
      ]

      // 週ごとに重量が増加（10%以上の増加）
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [{ name: 'ベンチプレス', sets: [{ weight: 100, reps: 10 }] }]),
        makeLog(makeDate(1), [{ name: 'ベンチプレス', sets: [{ weight: 90, reps: 10 }] }]),
        makeLog(makeDate(2), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(0)
    })

    it('does not detect stagnation with less than 2 weeks of data', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ベンチプレス', createdAt: Date.now() },
      ]

      // 1週間分のデータのみ
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [{ name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] }]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(0)
    })

    it('detects stagnation for bodyweight exercises based on max reps', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: '懸垂', isBodyweight: true, createdAt: Date.now() },
      ]

      // 3週間同じ回数
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [{ name: '懸垂', sets: [{ weight: 0, reps: 10 }] }]),
        makeLog(makeDate(1), [{ name: '懸垂', sets: [{ weight: 0, reps: 10 }] }]),
        makeLog(makeDate(2), [{ name: '懸垂', sets: [{ weight: 0, reps: 10 }] }]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('懸垂')
      expect(result[0].metric).toBe('最大回数')
      expect(result[0].unit).toBe('回')
    })

    it('detects stagnation for cardio exercises based on duration', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ランニング', isCardio: true, createdAt: Date.now() },
      ]

      // 3週間同じ時間
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 30 } as { weight: number; reps: number }] }]),
        makeLog(makeDate(1), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 30 } as { weight: number; reps: number }] }]),
        makeLog(makeDate(2), [{ name: 'ランニング', sets: [{ weight: 0, reps: 0, duration: 30 } as { weight: number; reps: number }] }]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('ランニング')
      expect(result[0].metric).toBe('時間')
      expect(result[0].unit).toBe('分')
    })

    it('handles multiple exercises with different stagnation status', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ベンチプレス', createdAt: Date.now() },
        { name: 'スクワット', createdAt: Date.now() },
      ]

      const logs: WorkoutLog[] = [
        // ベンチプレス: 停滞
        makeLog(makeDate(0), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 120, reps: 10 }] },
        ]),
        makeLog(makeDate(1), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
        makeLog(makeDate(2), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 80, reps: 10 }] },
        ]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      // ベンチプレスのみ停滞（スクワットは進捗している）
      expect(result.length).toBe(1)
      expect(result[0].exerciseName).toBe('ベンチプレス')
    })

    it('sorts results by stagnation weeks descending', () => {
      const exerciseMasters: ExerciseMaster[] = [
        { name: 'ベンチプレス', createdAt: Date.now() },
        { name: 'スクワット', createdAt: Date.now() },
      ]

      // スクワットは4週間停滞、ベンチプレスは2週間停滞
      const logs: WorkoutLog[] = [
        makeLog(makeDate(0), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
        makeLog(makeDate(1), [
          { name: 'ベンチプレス', sets: [{ weight: 80, reps: 10 }] },
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
        makeLog(makeDate(2), [
          { name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] },  // 進捗
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
        makeLog(makeDate(3), [
          { name: 'スクワット', sets: [{ weight: 100, reps: 10 }] },
        ]),
      ]

      const result = detectStagnation(logs, exerciseMasters)

      expect(result.length).toBe(2)
      expect(result[0].exerciseName).toBe('スクワット')
      expect(result[0].weeks).toBe(4)
      expect(result[1].exerciseName).toBe('ベンチプレス')
      expect(result[1].weeks).toBe(2)
    })
  })

  describe('formatStagnationForPrompt', () => {
    it('formats stagnation info for AI prompt', () => {
      const stagnationInfos = [
        { exerciseName: 'ベンチプレス', metric: '推定1RM', value: 100, unit: 'kg', weeks: 3 },
        { exerciseName: '懸垂', metric: '最大回数', value: 10, unit: '回', weeks: 2 },
      ]

      const result = formatStagnationForPrompt(stagnationInfos)

      expect(result).toContain('停滞中の種目')
      expect(result).toContain('ベンチプレス: 推定1RM 100kg で 3週間停滞')
      expect(result).toContain('懸垂: 最大回数 10回 で 2週間停滞')
    })

    it('returns empty string when no stagnation', () => {
      const result = formatStagnationForPrompt([])

      expect(result).toBe('')
    })
  })
})
