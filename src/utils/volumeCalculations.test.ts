import { describe, it, expect } from 'vitest'
import {
  calculateWeeklyVolume,
  getWeekStartDate,
  getWeekEndDate,
  getVolumeStatus,
  formatWeekRange,
} from './volumeCalculations'
import type { WorkoutLog, ExerciseMaster, MuscleGroup } from '../types'

describe('volumeCalculations', () => {
  // ローカル日付をYYYY-MM-DD形式で取得するヘルパー
  const toLocalDateString = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  describe('getWeekStartDate', () => {
    it('月曜日の場合はそのまま返す', () => {
      const monday = new Date(2024, 0, 15) // 月曜日 (月は0始まり)
      const result = getWeekStartDate(monday)
      expect(toLocalDateString(result)).toBe('2024-01-15')
    })

    it('水曜日の場合は月曜日を返す', () => {
      const wednesday = new Date(2024, 0, 17) // 水曜日
      const result = getWeekStartDate(wednesday)
      expect(toLocalDateString(result)).toBe('2024-01-15')
    })

    it('日曜日の場合は前週の月曜日を返す', () => {
      const sunday = new Date(2024, 0, 21) // 日曜日
      const result = getWeekStartDate(sunday)
      expect(toLocalDateString(result)).toBe('2024-01-15')
    })
  })

  describe('getWeekEndDate', () => {
    it('週の終了日（日曜日）を返す', () => {
      const monday = new Date(2024, 0, 15)
      const result = getWeekEndDate(monday)
      expect(toLocalDateString(result)).toBe('2024-01-21')
    })
  })

  describe('getVolumeStatus', () => {
    it('0セットの場合はnoneを返す', () => {
      expect(getVolumeStatus(0)).toBe('none')
    })

    it('10未満はinsufficientを返す', () => {
      expect(getVolumeStatus(5)).toBe('insufficient')
      expect(getVolumeStatus(9.9)).toBe('insufficient')
    })

    it('10-20はoptimalを返す', () => {
      expect(getVolumeStatus(10)).toBe('optimal')
      expect(getVolumeStatus(15)).toBe('optimal')
      expect(getVolumeStatus(20)).toBe('optimal')
    })

    it('20超はexcessiveを返す', () => {
      expect(getVolumeStatus(21)).toBe('excessive')
      expect(getVolumeStatus(30)).toBe('excessive')
    })
  })

  describe('formatWeekRange', () => {
    it('週の範囲を正しくフォーマットする', () => {
      const date = new Date('2024-01-17')
      const result = formatWeekRange(date)
      expect(result).toBe('1/15 - 1/21')
    })
  })

  describe('calculateWeeklyVolume', () => {
    const createLog = (date: string, exercises: Array<{ name: string; sets: number }>): WorkoutLog => ({
      id: Math.random(),
      date,
      exercises: exercises.map((ex, i) => ({
        id: `ex-${i}`,
        name: ex.name,
        sets: Array(ex.sets).fill({ weight: 60, reps: 10 }),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const createMaster = (name: string, targetMuscles: Array<{ muscle: MuscleGroup; isMain: boolean }>): ExerciseMaster => ({
      id: Math.random(),
      name,
      targetMuscles: targetMuscles.map(t => ({
        muscle: t.muscle,
        isMain: t.isMain,
      })),
      createdAt: Date.now(),
    })

    it('空のログでは全部位0セットを返す', () => {
      const result = calculateWeeklyVolume([], [], new Date('2024-01-17'))

      expect(result).toHaveLength(9) // 9部位
      result.forEach(v => {
        expect(v.mainSets).toBe(0)
        expect(v.subSets).toBe(0)
        expect(v.totalSets).toBe(0)
      })
    })

    it('メインセットを正しくカウントする', () => {
      const logs = [
        createLog('2024-01-15', [{ name: 'ベンチプレス', sets: 3 }]),
        createLog('2024-01-17', [{ name: 'ベンチプレス', sets: 4 }]),
      ]
      const masters = [
        createMaster('ベンチプレス', [{ muscle: 'chest', isMain: true }]),
      ]

      const result = calculateWeeklyVolume(logs, masters, new Date('2024-01-17'))
      const chestVolume = result.find(v => v.muscle === 'chest')

      expect(chestVolume?.mainSets).toBe(7)
      expect(chestVolume?.totalSets).toBe(7)
    })

    it('サブセットを0.5倍で換算する', () => {
      const logs = [
        createLog('2024-01-15', [{ name: 'ベンチプレス', sets: 4 }]),
      ]
      const masters = [
        createMaster('ベンチプレス', [
          { muscle: 'chest', isMain: true },
          { muscle: 'triceps', isMain: false },
        ]),
      ]

      const result = calculateWeeklyVolume(logs, masters, new Date('2024-01-17'))
      const tricepsVolume = result.find(v => v.muscle === 'triceps')

      expect(tricepsVolume?.subSets).toBe(4)
      expect(tricepsVolume?.totalSets).toBe(2) // 4 * 0.5 = 2
    })

    it('週外のログは除外する', () => {
      const logs = [
        createLog('2024-01-08', [{ name: 'ベンチプレス', sets: 10 }]), // 前週
        createLog('2024-01-15', [{ name: 'ベンチプレス', sets: 3 }]),  // 今週
        createLog('2024-01-22', [{ name: 'ベンチプレス', sets: 10 }]), // 翌週
      ]
      const masters = [
        createMaster('ベンチプレス', [{ muscle: 'chest', isMain: true }]),
      ]

      const result = calculateWeeklyVolume(logs, masters, new Date('2024-01-17'))
      const chestVolume = result.find(v => v.muscle === 'chest')

      expect(chestVolume?.mainSets).toBe(3)
    })

    it('複数種目を正しく集計する', () => {
      const logs = [
        createLog('2024-01-15', [
          { name: 'ベンチプレス', sets: 3 },
          { name: 'ダンベルフライ', sets: 3 },
        ]),
      ]
      const masters = [
        createMaster('ベンチプレス', [
          { muscle: 'chest', isMain: true },
          { muscle: 'triceps', isMain: false },
        ]),
        createMaster('ダンベルフライ', [
          { muscle: 'chest', isMain: true },
        ]),
      ]

      const result = calculateWeeklyVolume(logs, masters, new Date('2024-01-17'))
      const chestVolume = result.find(v => v.muscle === 'chest')
      const tricepsVolume = result.find(v => v.muscle === 'triceps')

      expect(chestVolume?.mainSets).toBe(6) // 3 + 3
      expect(tricepsVolume?.subSets).toBe(3)
    })

    it('部位情報がない種目は無視する', () => {
      const logs = [
        createLog('2024-01-15', [{ name: '未登録種目', sets: 10 }]),
      ]
      const masters: ExerciseMaster[] = []

      const result = calculateWeeklyVolume(logs, masters, new Date('2024-01-17'))

      result.forEach(v => {
        expect(v.totalSets).toBe(0)
      })
    })

    it('推奨範囲が正しく設定される', () => {
      const result = calculateWeeklyVolume([], [], new Date('2024-01-17'))

      result.forEach(v => {
        expect(v.recommended.min).toBe(10)
        expect(v.recommended.max).toBe(20)
      })
    })

    it('日本語ラベルが正しく設定される', () => {
      const result = calculateWeeklyVolume([], [], new Date('2024-01-17'))

      const chestVolume = result.find(v => v.muscle === 'chest')
      expect(chestVolume?.label).toBe('胸')

      const backVolume = result.find(v => v.muscle === 'back')
      expect(backVolume?.label).toBe('背中')
    })
  })
})
