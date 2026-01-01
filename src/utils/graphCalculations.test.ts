import { describe, it, expect } from 'vitest'
import {
  calculate1RM,
  getMaxWeight,
  getTotalVolume,
  getMaxEstimated1RM,
  getMaxReps,
  getTotalReps,
  isBodyweightExercise,
  calculateExerciseStats,
  mergeExerciseData,
  buildExerciseChartData,
} from './graphCalculations'
import type { Set, WorkoutLog, ExerciseMaster } from '../types'

describe('calculate1RM', () => {
  it('正しく推定1RMを計算する', () => {
    // 60kg × 10reps → 60 × (1 + 10/30) = 60 × 1.333... = 80
    expect(calculate1RM(60, 10)).toBe(80)
  })

  it('1repの場合、重量とほぼ同じ値になる', () => {
    // 100kg × 1rep → 100 × (1 + 1/30) = 100 × 1.033... ≈ 103.3
    expect(calculate1RM(100, 1)).toBe(103.3)
  })

  it('0repの場合は0を返す', () => {
    expect(calculate1RM(60, 0)).toBe(0)
  })

  it('0kgの場合は0を返す', () => {
    expect(calculate1RM(0, 10)).toBe(0)
  })

  it('小数点以下1桁に丸められる', () => {
    // 75kg × 8reps → 75 × (1 + 8/30) = 75 × 1.266... = 95
    expect(calculate1RM(75, 8)).toBe(95)
  })
})

describe('getMaxWeight', () => {
  it('セットの中から最大重量を取得する', () => {
    const sets: Set[] = [
      { weight: 60, reps: 10 },
      { weight: 70, reps: 8 },
      { weight: 65, reps: 8 },
    ]
    expect(getMaxWeight(sets)).toBe(70)
  })

  it('空配列の場合は0を返す', () => {
    expect(getMaxWeight([])).toBe(0)
  })

  it('1セットのみの場合はその重量を返す', () => {
    const sets: Set[] = [{ weight: 80, reps: 5 }]
    expect(getMaxWeight(sets)).toBe(80)
  })
})

describe('getTotalVolume', () => {
  it('総ボリュームを正しく計算する', () => {
    const sets: Set[] = [
      { weight: 60, reps: 10 }, // 600
      { weight: 70, reps: 8 },  // 560
      { weight: 65, reps: 8 },  // 520
    ]
    expect(getTotalVolume(sets)).toBe(1680)
  })

  it('空配列の場合は0を返す', () => {
    expect(getTotalVolume([])).toBe(0)
  })

  it('自重トレーニング（weight=0）の場合は0を返す', () => {
    const sets: Set[] = [
      { weight: 0, reps: 10 },
      { weight: 0, reps: 8 },
    ]
    expect(getTotalVolume(sets)).toBe(0)
  })
})

describe('getMaxEstimated1RM', () => {
  it('セットの中から最大推定1RMを取得する', () => {
    const sets: Set[] = [
      { weight: 60, reps: 10 }, // 80
      { weight: 80, reps: 5 },  // 93.3
      { weight: 70, reps: 8 },  // 88.7
    ]
    expect(getMaxEstimated1RM(sets)).toBe(93.3)
  })

  it('空配列の場合は0を返す', () => {
    expect(getMaxEstimated1RM([])).toBe(0)
  })
})

describe('getMaxReps', () => {
  it('セットの中から最大回数を取得する', () => {
    const sets: Set[] = [
      { weight: 60, reps: 10 },
      { weight: 70, reps: 8 },
      { weight: 65, reps: 12 },
    ]
    expect(getMaxReps(sets)).toBe(12)
  })

  it('空配列の場合は0を返す', () => {
    expect(getMaxReps([])).toBe(0)
  })
})

describe('getTotalReps', () => {
  it('合計回数を正しく計算する', () => {
    const sets: Set[] = [
      { weight: 0, reps: 10 },
      { weight: 0, reps: 8 },
      { weight: 0, reps: 6 },
    ]
    expect(getTotalReps(sets)).toBe(24)
  })

  it('空配列の場合は0を返す', () => {
    expect(getTotalReps([])).toBe(0)
  })
})

describe('isBodyweightExercise', () => {
  const exerciseMasters: ExerciseMaster[] = [
    { id: 1, name: 'ベンチプレス', createdAt: Date.now() },
    { id: 2, name: 'チンニング', isBodyweight: true, createdAt: Date.now() },
    { id: 3, name: 'ディップス', isBodyweight: true, createdAt: Date.now() },
  ]

  it('自重トレーニングの場合はtrueを返す', () => {
    expect(isBodyweightExercise('チンニング', exerciseMasters)).toBe(true)
    expect(isBodyweightExercise('ディップス', exerciseMasters)).toBe(true)
  })

  it('ウェイトトレーニングの場合はfalseを返す', () => {
    expect(isBodyweightExercise('ベンチプレス', exerciseMasters)).toBe(false)
  })

  it('マスタに存在しない種目の場合はfalseを返す', () => {
    expect(isBodyweightExercise('未登録の種目', exerciseMasters)).toBe(false)
  })
})

describe('calculateExerciseStats', () => {
  it('セット配列から全ての統計を計算する', () => {
    const sets: Set[] = [
      { weight: 60, reps: 10 },
      { weight: 70, reps: 8 },
    ]

    const stats = calculateExerciseStats(sets)

    expect(stats.maxWeight).toBe(70)
    expect(stats.totalVolume).toBe(60 * 10 + 70 * 8) // 1160
    expect(stats.estimated1RM).toBe(calculate1RM(70, 8)) // 88.7
    expect(stats.maxReps).toBe(10)
    expect(stats.totalReps).toBe(18)
  })

  it('空配列の場合は全て0を返す', () => {
    const stats = calculateExerciseStats([])

    expect(stats.maxWeight).toBe(0)
    expect(stats.totalVolume).toBe(0)
    expect(stats.estimated1RM).toBe(0)
    expect(stats.maxReps).toBe(0)
    expect(stats.totalReps).toBe(0)
  })
})

describe('mergeExerciseData', () => {
  it('同じ日の同じ種目のデータをマージする', () => {
    const existing = {
      maxWeight: 60,
      totalVolume: 600,
      estimated1RM: 80,
      maxReps: 10,
      totalReps: 10,
      totalDuration: 0,
      totalDistance: 0,
    }
    const newData = {
      maxWeight: 70,
      totalVolume: 560,
      estimated1RM: 88.7,
      maxReps: 8,
      totalReps: 8,
      totalDuration: 0,
      totalDistance: 0,
    }

    const merged = mergeExerciseData(existing, newData)

    expect(merged.maxWeight).toBe(70) // max
    expect(merged.totalVolume).toBe(1160) // sum
    expect(merged.estimated1RM).toBe(88.7) // max
    expect(merged.maxReps).toBe(10) // max
    expect(merged.totalReps).toBe(18) // sum
  })

  it('有酸素運動のデータをマージする', () => {
    const existing = {
      maxWeight: 0,
      totalVolume: 0,
      estimated1RM: 0,
      maxReps: 0,
      totalReps: 0,
      totalDuration: 30,
      totalDistance: 5.0,
    }
    const newData = {
      maxWeight: 0,
      totalVolume: 0,
      estimated1RM: 0,
      maxReps: 0,
      totalReps: 0,
      totalDuration: 20,
      totalDistance: 3.5,
    }

    const merged = mergeExerciseData(existing, newData)

    expect(merged.totalDuration).toBe(50) // sum
    expect(merged.totalDistance).toBe(8.5) // sum
  })
})

describe('buildExerciseChartData', () => {
  const exerciseMasters: ExerciseMaster[] = [
    { id: 1, name: 'ベンチプレス', createdAt: Date.now() },
    { id: 2, name: 'チンニング', isBodyweight: true, createdAt: Date.now() },
  ]

  it('ワークアウトログから種目別チャートデータを生成する', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          {
            id: 'ex1',
            name: 'ベンチプレス',
            sets: [{ weight: 60, reps: 10 }],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 2,
        date: '2024-01-17',
        exercises: [
          {
            id: 'ex2',
            name: 'ベンチプレス',
            sets: [{ weight: 65, reps: 10 }],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildExerciseChartData(logs, exerciseMasters)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('ベンチプレス')
    expect(result[0].isBodyweight).toBe(false)
    expect(result[0].data).toHaveLength(2)
    expect(result[0].data[0].date).toBe('2024-01-15')
    expect(result[0].data[1].date).toBe('2024-01-17')
    expect(result[0].lastDate).toBe('2024-01-17')
  })

  it('日付でフィルタリングできる', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-01',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 2,
        date: '2024-03-01',
        exercises: [
          { id: 'ex2', name: 'ベンチプレス', sets: [{ weight: 70, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildExerciseChartData(logs, exerciseMasters, '2024-02-01')

    expect(result).toHaveLength(1)
    expect(result[0].data).toHaveLength(1)
    expect(result[0].data[0].date).toBe('2024-03-01')
  })

  it('同じ日の同じ種目のデータがマージされる', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
          { id: 'ex2', name: 'ベンチプレス', sets: [{ weight: 70, reps: 8 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildExerciseChartData(logs, exerciseMasters)

    expect(result).toHaveLength(1)
    expect(result[0].data).toHaveLength(1)
    expect(result[0].data[0].maxWeight).toBe(70)
    expect(result[0].data[0].totalVolume).toBe(60 * 10 + 70 * 8)
  })

  it('自重トレーニングが正しく識別される', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'チンニング', sets: [{ weight: 0, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildExerciseChartData(logs, exerciseMasters)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('チンニング')
    expect(result[0].isBodyweight).toBe(true)
  })

  it('最新日付順にソートされる', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 2,
        date: '2024-01-20',
        exercises: [
          { id: 'ex2', name: 'チンニング', sets: [{ weight: 0, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildExerciseChartData(logs, exerciseMasters)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('チンニング') // 最新
    expect(result[1].name).toBe('ベンチプレス')
  })

  it('空のログの場合は空配列を返す', () => {
    const result = buildExerciseChartData([], exerciseMasters)
    expect(result).toHaveLength(0)
  })
})
