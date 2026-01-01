import type { Set, WorkoutLog, ExerciseMaster } from '../types'

export interface ChartData {
  date: string
  maxWeight: number
  totalVolume: number
  estimated1RM: number
  maxReps: number
  totalReps: number
  // 有酸素運動用
  totalDuration: number    // 合計時間（分）
  totalDistance: number    // 合計距離（km）
}

export interface ExerciseChartData {
  name: string
  lastDate: string
  data: ChartData[]
  isBodyweight: boolean
  isCardio: boolean
}

/**
 * 推定1RMを計算する（Epley式）
 * 1RM = weight × (1 + reps / 30)
 */
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 0) return 0
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * セット配列から最大重量を取得
 */
export function getMaxWeight(sets: Set[]): number {
  if (sets.length === 0) return 0
  return Math.max(...sets.map((s) => s.weight))
}

/**
 * セット配列から総ボリュームを計算
 * 総ボリューム = Σ(weight × reps)
 */
export function getTotalVolume(sets: Set[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
}

/**
 * セット配列から最大推定1RMを取得
 */
export function getMaxEstimated1RM(sets: Set[]): number {
  if (sets.length === 0) return 0
  return Math.max(...sets.map((s) => calculate1RM(s.weight, s.reps)))
}

/**
 * セット配列から最大回数を取得
 */
export function getMaxReps(sets: Set[]): number {
  if (sets.length === 0) return 0
  return Math.max(...sets.map((s) => s.reps))
}

/**
 * セット配列から合計回数を取得
 */
export function getTotalReps(sets: Set[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0)
}

/**
 * セット配列から合計時間を取得（有酸素運動用）
 */
export function getTotalDuration(sets: Set[]): number {
  return sets.reduce((sum, s) => sum + (s.duration || 0), 0)
}

/**
 * セット配列から合計距離を取得（有酸素運動用）
 */
export function getTotalDistance(sets: Set[]): number {
  return Math.round(sets.reduce((sum, s) => sum + (s.distance || 0), 0) * 10) / 10
}

/**
 * 種目が自重トレーニングかどうかを判定
 */
export function isBodyweightExercise(
  exerciseName: string,
  exerciseMasters: ExerciseMaster[]
): boolean {
  const master = exerciseMasters.find((m) => m.name === exerciseName)
  return master?.isBodyweight || false
}

/**
 * 種目が有酸素運動かどうかを判定
 */
export function isCardioExercise(
  exerciseName: string,
  exerciseMasters: ExerciseMaster[]
): boolean {
  const master = exerciseMasters.find((m) => m.name === exerciseName)
  return master?.isCardio || false
}

/**
 * 1つの種目のセットからチャートデータを計算
 */
export function calculateExerciseStats(sets: Set[]): Omit<ChartData, 'date'> {
  return {
    maxWeight: getMaxWeight(sets),
    totalVolume: getTotalVolume(sets),
    estimated1RM: getMaxEstimated1RM(sets),
    maxReps: getMaxReps(sets),
    totalReps: getTotalReps(sets),
    totalDuration: getTotalDuration(sets),
    totalDistance: getTotalDistance(sets),
  }
}

/**
 * 同じ日の同じ種目のデータをマージする
 */
export function mergeExerciseData(
  existing: Omit<ChartData, 'date'>,
  newData: Omit<ChartData, 'date'>
): Omit<ChartData, 'date'> {
  return {
    maxWeight: Math.max(existing.maxWeight, newData.maxWeight),
    totalVolume: existing.totalVolume + newData.totalVolume,
    estimated1RM: Math.max(existing.estimated1RM, newData.estimated1RM),
    maxReps: Math.max(existing.maxReps, newData.maxReps),
    totalReps: existing.totalReps + newData.totalReps,
    totalDuration: existing.totalDuration + newData.totalDuration,
    totalDistance: Math.round((existing.totalDistance + newData.totalDistance) * 10) / 10,
  }
}

/**
 * ワークアウトログから種目別のチャートデータを生成
 */
export function buildExerciseChartData(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  filterFromDate?: string
): ExerciseChartData[] {
  const exerciseDataMap = new Map<
    string,
    Map<string, Omit<ChartData, 'date'>>
  >()

  logs.forEach((log) => {
    log.exercises.forEach((ex) => {
      if (!exerciseDataMap.has(ex.name)) {
        exerciseDataMap.set(ex.name, new Map())
      }
      const dateMap = exerciseDataMap.get(ex.name)!

      const stats = calculateExerciseStats(ex.sets)
      const existing = dateMap.get(log.date)

      if (existing) {
        dateMap.set(log.date, mergeExerciseData(existing, stats))
      } else {
        dateMap.set(log.date, stats)
      }
    })
  })

  const result: ExerciseChartData[] = []

  exerciseDataMap.forEach((dateMap, name) => {
    const allData = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const filteredData = filterFromDate
      ? allData.filter((d) => d.date >= filterFromDate)
      : allData

    if (filteredData.length > 0) {
      const lastDate = filteredData[filteredData.length - 1].date
      result.push({
        name,
        lastDate,
        data: filteredData,
        isBodyweight: isBodyweightExercise(name, exerciseMasters),
        isCardio: isCardioExercise(name, exerciseMasters),
      })
    }
  })

  return result.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
}
