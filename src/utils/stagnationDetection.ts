import type { WorkoutLog, ExerciseMaster, StagnationInfo } from '../types'
import {
  getMaxEstimated1RM,
  getMaxReps,
  getTotalDuration,
  isBodyweightExercise,
  isCardioExercise,
} from './graphCalculations'

// 停滞判定の閾値
const STAGNATION_THRESHOLD_PERCENT = 5  // ±5%以内を停滞とみなす
const MIN_WEEKS_FOR_STAGNATION = 2      // 最低2週間以上の停滞

interface WeeklyMetric {
  weekStart: string  // YYYY-MM-DD (週の開始日)
  value: number
}

/**
 * 日付から週の開始日（月曜日）を取得
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 月曜日に調整
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split('T')[0]
}

/**
 * 特定の種目の週ごとのベスト値を取得
 */
function getWeeklyBestMetrics(
  logs: WorkoutLog[],
  exerciseName: string,
  isBodyweight: boolean,
  isCardio: boolean
): WeeklyMetric[] {
  const weeklyMap = new Map<string, number>()

  logs.forEach((log) => {
    const exercise = log.exercises.find((ex) => ex.name === exerciseName)
    if (!exercise) return

    const weekStart = getWeekStart(log.date)
    let value: number

    if (isCardio) {
      value = getTotalDuration(exercise.sets)
    } else if (isBodyweight) {
      value = getMaxReps(exercise.sets)
    } else {
      value = getMaxEstimated1RM(exercise.sets)
    }

    const existing = weeklyMap.get(weekStart) || 0
    weeklyMap.set(weekStart, Math.max(existing, value))
  })

  return Array.from(weeklyMap.entries())
    .map(([weekStart, value]) => ({ weekStart, value }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/**
 * 値が基準値から±threshold%以内かどうかを判定
 */
function isWithinThreshold(value: number, baseline: number, thresholdPercent: number): boolean {
  if (baseline === 0) return value === 0
  const diff = Math.abs((value - baseline) / baseline) * 100
  return diff <= thresholdPercent
}

/**
 * 週ごとのメトリクスから停滞週数を計算
 * 直近から遡って、基準値（最新週の値）から±5%以内が何週間続いているかを返す
 */
function calculateStagnationWeeks(weeklyMetrics: WeeklyMetric[]): number {
  if (weeklyMetrics.length < MIN_WEEKS_FOR_STAGNATION) {
    return 0
  }

  // 直近の週の値を基準とする
  const baseline = weeklyMetrics[weeklyMetrics.length - 1].value
  if (baseline === 0) return 0

  let stagnationWeeks = 1  // 最新週はカウント

  // 直近から遡ってチェック
  for (let i = weeklyMetrics.length - 2; i >= 0; i--) {
    const metric = weeklyMetrics[i]
    if (isWithinThreshold(metric.value, baseline, STAGNATION_THRESHOLD_PERCENT)) {
      stagnationWeeks++
    } else {
      break
    }
  }

  return stagnationWeeks >= MIN_WEEKS_FOR_STAGNATION ? stagnationWeeks : 0
}

/**
 * 全ログから停滞している種目を検出
 */
export function detectStagnation(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[]
): StagnationInfo[] {
  const stagnationInfos: StagnationInfo[] = []
  const exerciseNames = new Set<string>()

  // 全ての種目名を収集
  logs.forEach((log) => {
    log.exercises.forEach((ex) => {
      exerciseNames.add(ex.name)
    })
  })

  // 各種目について停滞をチェック
  exerciseNames.forEach((exerciseName) => {
    const isBodyweight = isBodyweightExercise(exerciseName, exerciseMasters)
    const isCardio = isCardioExercise(exerciseName, exerciseMasters)

    const weeklyMetrics = getWeeklyBestMetrics(logs, exerciseName, isBodyweight, isCardio)
    const stagnationWeeks = calculateStagnationWeeks(weeklyMetrics)

    if (stagnationWeeks >= MIN_WEEKS_FOR_STAGNATION) {
      const latestValue = weeklyMetrics[weeklyMetrics.length - 1].value

      let metric: string
      let unit: string

      if (isCardio) {
        metric = '時間'
        unit = '分'
      } else if (isBodyweight) {
        metric = '最大回数'
        unit = '回'
      } else {
        metric = '推定1RM'
        unit = 'kg'
      }

      stagnationInfos.push({
        exerciseName,
        metric,
        value: Math.round(latestValue * 10) / 10,
        unit,
        weeks: stagnationWeeks,
      })
    }
  })

  // 停滞週数が長い順にソート
  return stagnationInfos.sort((a, b) => b.weeks - a.weeks)
}

/**
 * 停滞情報をAIプロンプト用にフォーマット
 */
export function formatStagnationForPrompt(stagnationInfos: StagnationInfo[]): string {
  if (stagnationInfos.length === 0) {
    return ''
  }

  const lines = stagnationInfos.map((info) =>
    `- ${info.exerciseName}: ${info.metric} ${info.value}${info.unit} で ${info.weeks}週間停滞`
  )

  return `## 停滞中の種目（対策を考慮してください）\n${lines.join('\n')}`
}
