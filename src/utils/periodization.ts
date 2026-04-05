import type { WorkoutLog, ExerciseMaster, DeloadSuggestion, PerformanceDecline } from '../types'
import {
  getMaxEstimated1RM,
  getMaxReps,
  getTotalDuration,
  isBodyweightExercise,
  isCardioExercise,
} from './graphCalculations'
import { formatLocalDate } from './date'

// ディロード検出の閾値
const ACCUMULATED_SESSIONS_THRESHOLD = 16  // 累積16セッション以上でディロード推奨
const REST_PERIOD_DAYS = 7                 // 7日以上の空白で累積リセット
const PERFORMANCE_DECLINE_THRESHOLD = -5   // -5%以下でパフォーマンス低下とみなす
const PERFORMANCE_CHECK_WEEKS = 2          // 直近2週間をチェック

/**
 * 累積トレーニングセッション数を計算
 * 日付降順でログを走査し、7日以上の空白があればカウント停止
 * 最新のトレーニングから今日まで7日以上空いている場合も0を返す
 */
export function calculateAccumulatedSessions(logs: WorkoutLog[]): number {
  if (logs.length === 0) return 0

  // 日付でソート（新しい順）
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  // 最新のトレーニングから今日まで7日以上空いているかチェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const latestDate = new Date(sortedLogs[0].date)
  latestDate.setHours(0, 0, 0, 0)
  const daysSinceLatest = Math.floor((today.getTime() - latestDate.getTime()) / (24 * 60 * 60 * 1000))
  if (daysSinceLatest >= REST_PERIOD_DAYS) return 0

  // 同じ日付のログを1セッションとしてカウント
  let sessionCount = 1
  let prevDate = sortedLogs[0].date

  for (let i = 1; i < sortedLogs.length; i++) {
    const currentDate = sortedLogs[i].date

    // 前のログとの日数差を計算
    const prev = new Date(prevDate)
    const curr = new Date(currentDate)
    prev.setHours(0, 0, 0, 0)
    curr.setHours(0, 0, 0, 0)
    const daysDiff = Math.floor((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000))

    if (daysDiff >= REST_PERIOD_DAYS) {
      // 7日以上の空白 → カウント停止
      break
    }

    // 同じ日付は1セッションとしてカウント
    if (currentDate !== prevDate) {
      sessionCount++
      prevDate = currentDate
    }
  }

  return sessionCount
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
  const twoWeeksAgoStr = formatLocalDate(twoWeeksAgo)
  const fourWeeksAgo = new Date(today)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - (PERFORMANCE_CHECK_WEEKS * 2) * 7)
  const fourWeeksAgoStr = formatLocalDate(fourWeeksAgo)

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
  const sessionCount = calculateAccumulatedSessions(logs)
  const performanceDeclines = detectPerformanceDecline(logs, masters)

  // パフォーマンス低下を優先
  if (performanceDeclines.length >= 2) {
    const declineNames = performanceDeclines.slice(0, 3).map(d => d.exerciseName).join('、')
    return {
      reason: 'performance_decline',
      message: `${declineNames}などでパフォーマンスが低下しています。ディロード週（回復週）を検討してください。`,
      sessionCount,
      performanceDecline: performanceDeclines,
    }
  }

  // 累積セッション数が閾値以上
  if (sessionCount >= ACCUMULATED_SESSIONS_THRESHOLD) {
    return {
      reason: 'accumulated_sessions',
      message: `${sessionCount}セッション連続でトレーニングを継続しています。ディロード週（回復週）を検討してください。`,
      sessionCount,
    }
  }

  return null
}

/**
 * ディロード提案をAIプロンプト用にフォーマット
 */
export function formatDeloadForPrompt(suggestion: DeloadSuggestion): string {
  const lines: string[] = ['## ディロード推奨']

  if (suggestion.reason === 'accumulated_sessions') {
    lines.push(`- 理由: ${suggestion.sessionCount}セッション連続のトレーニング継続`)
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
