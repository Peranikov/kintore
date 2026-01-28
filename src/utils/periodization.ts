import type { WorkoutLog, ExerciseMaster, DeloadSuggestion, PerformanceDecline } from '../types'
import {
  getMaxEstimated1RM,
  getMaxReps,
  getTotalDuration,
  isBodyweightExercise,
  isCardioExercise,
} from './graphCalculations'

// ディロード検出の閾値
const CONSECUTIVE_WEEKS_THRESHOLD = 4     // 連続4週以上でディロード推奨
const PERFORMANCE_DECLINE_THRESHOLD = -5  // -5%以下でパフォーマンス低下とみなす
const PERFORMANCE_CHECK_WEEKS = 2         // 直近2週間をチェック

/**
 * 日付から週の開始日（月曜日）を取得
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split('T')[0]
}

/**
 * 2つの日付の週数差を計算
 */
function getWeeksDiff(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
}

/**
 * 連続トレーニング週数を計算
 * 各週に少なくとも1回のトレーニングがあれば連続とみなす
 */
export function calculateConsecutiveTrainingWeeks(logs: WorkoutLog[]): number {
  if (logs.length === 0) return 0

  // 週ごとのトレーニング有無を記録
  const weekSet = new Set<string>()
  logs.forEach(log => {
    weekSet.add(getWeekStart(log.date))
  })

  const sortedWeeks = Array.from(weekSet).sort((a, b) => b.localeCompare(a)) // 新しい順

  if (sortedWeeks.length === 0) return 0

  // 今週の週開始日を取得
  const today = new Date().toISOString().split('T')[0]
  const currentWeek = getWeekStart(today)

  // 最新のトレーニング週が今週または先週でなければ連続トレーニング中ではない
  const latestTrainingWeek = sortedWeeks[0]
  const weeksDiff = getWeeksDiff(currentWeek, latestTrainingWeek)
  if (weeksDiff > 1) return 0

  // 連続週数をカウント
  let consecutiveWeeks = 1
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prevWeek = sortedWeeks[i - 1]
    const currentCheckWeek = sortedWeeks[i]
    const diff = getWeeksDiff(prevWeek, currentCheckWeek)

    if (diff === 1) {
      consecutiveWeeks++
    } else {
      break
    }
  }

  return consecutiveWeeks
}

/**
 * 特定の種目のパフォーマンス変化率を計算
 * 直近2週間と、その前の2週間のパフォーマンスを比較
 */
function calculateExercisePerformanceChange(
  logs: WorkoutLog[],
  exerciseName: string,
  isBodyweight: boolean,
  isCardio: boolean
): number | null {
  // 日付でソート（新しい順）
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  // この種目が含まれるログのみをフィルタ
  const logsWithExercise = sortedLogs.filter(log =>
    log.exercises.some(ex => ex.name === exerciseName)
  )

  if (logsWithExercise.length < 2) {
    return null
  }

  // ログの日付範囲から直近と過去を分ける
  // 直近2週間と、その前の2週間に分割
  const today = new Date()
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - PERFORMANCE_CHECK_WEEKS * 7)
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]
  const fourWeeksAgo = new Date(today)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - (PERFORMANCE_CHECK_WEEKS * 2) * 7)
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

  // 直近2週間のパフォーマンス（今日からtwoWeeksAgoStrより新しいもの）
  const recentLogs = logsWithExercise.filter(log => log.date > twoWeeksAgoStr)
  // その前の2週間のパフォーマンス（twoWeeksAgoStr以前、fourWeeksAgoStrより新しいもの）
  const previousLogs = logsWithExercise.filter(log => log.date <= twoWeeksAgoStr && log.date > fourWeeksAgoStr)

  function getMetricValue(logsToCheck: WorkoutLog[]): number | null {
    let maxValue: number | null = null
    logsToCheck.forEach(log => {
      const exercise = log.exercises.find(ex => ex.name === exerciseName)
      if (!exercise) return

      let value: number
      if (isCardio) {
        value = getTotalDuration(exercise.sets)
      } else if (isBodyweight) {
        value = getMaxReps(exercise.sets)
      } else {
        value = getMaxEstimated1RM(exercise.sets)
      }

      if (maxValue === null || value > maxValue) {
        maxValue = value
      }
    })
    return maxValue
  }

  const recentMax = getMetricValue(recentLogs)
  const previousMax = getMetricValue(previousLogs)

  if (recentMax === null || previousMax === null || previousMax === 0) {
    return null
  }

  return ((recentMax - previousMax) / previousMax) * 100
}

/**
 * パフォーマンス低下を検出
 * 直近2週間で-5%超の低下がある種目を検出
 */
export function detectPerformanceDecline(
  logs: WorkoutLog[],
  masters: ExerciseMaster[]
): PerformanceDecline[] {
  const declines: PerformanceDecline[] = []
  const exerciseNames = new Set<string>()

  logs.forEach(log => {
    log.exercises.forEach(ex => {
      exerciseNames.add(ex.name)
    })
  })

  exerciseNames.forEach(exerciseName => {
    const isBodyweight = isBodyweightExercise(exerciseName, masters)
    const isCardio = isCardioExercise(exerciseName, masters)

    const changePercent = calculateExercisePerformanceChange(
      logs,
      exerciseName,
      isBodyweight,
      isCardio
    )

    if (changePercent !== null && changePercent <= PERFORMANCE_DECLINE_THRESHOLD) {
      declines.push({
        exerciseName,
        declinePercent: Math.round(changePercent * 10) / 10,
      })
    }
  })

  // 低下が大きい順にソート
  return declines.sort((a, b) => a.declinePercent - b.declinePercent)
}

/**
 * ディロード提案を生成
 */
export function generateDeloadSuggestion(
  logs: WorkoutLog[],
  masters: ExerciseMaster[]
): DeloadSuggestion | null {
  const consecutiveWeeks = calculateConsecutiveTrainingWeeks(logs)
  const performanceDeclines = detectPerformanceDecline(logs, masters)

  // パフォーマンス低下を優先
  if (performanceDeclines.length >= 2) {
    const declineNames = performanceDeclines.slice(0, 3).map(d => d.exerciseName).join('、')
    return {
      reason: 'performance_decline',
      message: `${declineNames}などでパフォーマンスが低下しています。ディロード週（回復週）を検討してください。`,
      weeksTraining: consecutiveWeeks,
      performanceDecline: performanceDeclines,
    }
  }

  // 連続トレーニング週数が閾値以上
  if (consecutiveWeeks >= CONSECUTIVE_WEEKS_THRESHOLD) {
    return {
      reason: 'consecutive_weeks',
      message: `${consecutiveWeeks}週連続でトレーニングを継続しています。ディロード週（回復週）を検討してください。`,
      weeksTraining: consecutiveWeeks,
    }
  }

  return null
}

/**
 * ディロード提案をAIプロンプト用にフォーマット
 */
export function formatDeloadForPrompt(suggestion: DeloadSuggestion): string {
  const lines: string[] = ['## ディロード推奨']

  if (suggestion.reason === 'consecutive_weeks') {
    lines.push(`- 理由: ${suggestion.weeksTraining}週連続のトレーニング継続`)
  } else {
    lines.push('- 理由: パフォーマンス低下を検出')
    if (suggestion.performanceDecline) {
      suggestion.performanceDecline.forEach(d => {
        lines.push(`  - ${d.exerciseName}: ${d.declinePercent}%`)
      })
    }
  }

  lines.push('')
  lines.push('【ディロード時のプラン指示】')
  lines.push('- ボリュームを通常の50-60%に抑える')
  lines.push('- 重量は維持または少し軽く')
  lines.push('- セット数を減らす（3セット→2セット）')
  lines.push('- 種目数も減らす')

  return lines.join('\n')
}
