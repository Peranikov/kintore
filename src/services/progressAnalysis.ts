import type {
  ExerciseBodyPart,
  ExerciseTrendAnalysis,
  ProgressAnalysisSnapshot,
  ProgressMetric,
  ProgressPeriodSummary,
  ProgressTrendMetric,
  WorkoutLog,
  ExerciseMaster,
} from '../types'
import { buildExerciseChartData } from '../utils/graphCalculations'
import { createProgressMetric } from '../utils/progressCalculations'

function toTrendMetric(label: string, unit: string, metric: ProgressMetric): ProgressTrendMetric {
  return {
    label,
    current: metric.current,
    previous: metric.previous,
    diff: metric.diff,
    diffPercent: metric.diffPercent,
    status: metric.status,
    unit,
  }
}

function summarizeTrend(trend: ProgressTrendMetric | undefined): string {
  if (!trend) {
    return '比較に必要なデータが不足しています。'
  }
  if (trend.status === 'up') {
    return `${trend.label}が前回比で伸びています。`
  }
  if (trend.status === 'down') {
    return `${trend.label}が前回比で低下しています。回復と負荷設定の見直しが必要です。`
  }
  return `${trend.label}は横ばいです。次の上積み方針を決める段階です。`
}

function buildPeriodSummary(logs: WorkoutLog[], masters: ExerciseMaster[]): ProgressPeriodSummary {
  const sortedDates = logs.map((log) => log.date).sort()
  const fromDate = sortedDates[0]
  const toDate = sortedDates[sortedDates.length - 1]
  const daysDiff = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
  const bodyPartSetCounts: Partial<Record<ExerciseBodyPart, number>> = {}

  for (const log of logs) {
    for (const exercise of log.exercises) {
      const bodyPart = masters.find((master) => master.name === exercise.name)?.bodyPart || 'その他'
      bodyPartSetCounts[bodyPart] = (bodyPartSetCounts[bodyPart] || 0) + exercise.sets.length
    }
  }

  return {
    fromDate,
    toDate,
    sessionCount: logs.length,
    weeklyFrequency: Math.round((logs.length / (daysDiff / 7)) * 10) / 10,
    bodyPartSetCounts,
  }
}

function buildExerciseTrends(logs: WorkoutLog[], masters: ExerciseMaster[], fromDate: string): ExerciseTrendAnalysis[] {
  const charts = buildExerciseChartData(logs, masters, fromDate)

  return charts.map((exercise) => {
    const first = exercise.data[0]
    const last = exercise.data[exercise.data.length - 1]

    const primaryMetric = exercise.isCardio
      ? toTrendMetric('時間', '分', createProgressMetric(last.totalDuration, first.totalDuration))
      : exercise.isBodyweight
        ? toTrendMetric('最大回数', '回', createProgressMetric(last.maxReps, first.maxReps))
        : toTrendMetric('推定1RM', 'kg', createProgressMetric(last.estimated1RM, first.estimated1RM))

    return {
      exerciseName: exercise.name,
      lastDate: last.date,
      recordCount: exercise.data.length,
      primaryMetric,
      summary: summarizeTrend(primaryMetric),
    }
  })
}

function buildNextGoals(exerciseTrends: ExerciseTrendAnalysis[], periodSummary: ProgressPeriodSummary): string[] {
  const goals: string[] = []

  const stalled = exerciseTrends.find((trend) => trend.primaryMetric?.status === 'same')
  if (stalled) {
    goals.push(`${stalled.exerciseName}は横ばいなので、次は重量か回数のどちらを伸ばすかを固定する`)
  }

  const regressed = exerciseTrends.find((trend) => trend.primaryMetric?.status === 'down')
  if (regressed) {
    goals.push(`${regressed.exerciseName}は低下があるため、ボリュームを抑えてフォームと回復を優先する`)
  }

  const emptyBodyPart = (['胸', '背中', '肩', '脚'] as ExerciseBodyPart[])
    .find((bodyPart) => !periodSummary.bodyPartSetCounts[bodyPart])
  if (emptyBodyPart) {
    goals.push(`${emptyBodyPart}のセットが不足しているため、次の期間は優先して追加する`)
  }

  if (periodSummary.weeklyFrequency < 2) {
    goals.push('週あたり頻度が低めなので、まずは週2回以上の継続を優先する')
  }

  return goals.slice(0, 3)
}

export function buildProgressAnalysis(logs: WorkoutLog[], masters: ExerciseMaster[], fromDate: string): ProgressAnalysisSnapshot {
  const filteredLogs = logs
    .filter((log) => log.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (filteredLogs.length < 2) {
    throw new Error('評価には最低2回以上のトレーニング記録が必要です。')
  }

  const periodSummary = buildPeriodSummary(filteredLogs, masters)
  const exerciseTrends = buildExerciseTrends(filteredLogs, masters, fromDate)

  return {
    generatedAt: Date.now(),
    periodSummary,
    exerciseTrends,
    nextGoals: buildNextGoals(exerciseTrends, periodSummary),
  }
}

export function formatProgressAnalysisForPrompt(analysis: ProgressAnalysisSnapshot): string {
  const lines: string[] = [
    `期間: ${analysis.periodSummary.fromDate} 〜 ${analysis.periodSummary.toDate}`,
    `総セッション数: ${analysis.periodSummary.sessionCount}`,
    `週あたり頻度: ${analysis.periodSummary.weeklyFrequency}回`,
    '部位別セット数:',
    ...Object.entries(analysis.periodSummary.bodyPartSetCounts).map(([bodyPart, sets]) => `- ${bodyPart}: ${sets}セット`),
    '種目トレンド:',
  ]

  for (const trend of analysis.exerciseTrends) {
    lines.push(`- ${trend.exerciseName} (${trend.recordCount}回, 最新 ${trend.lastDate})`)
    if (trend.primaryMetric) {
      lines.push(`  - ${trend.primaryMetric.label}: ${trend.primaryMetric.previous}${trend.primaryMetric.unit} → ${trend.primaryMetric.current}${trend.primaryMetric.unit} (${trend.primaryMetric.diff >= 0 ? '+' : ''}${trend.primaryMetric.diff}${trend.primaryMetric.unit}, ${trend.primaryMetric.diffPercent}%)`)
    }
    lines.push(`  - 所見: ${trend.summary}`)
  }

  if (analysis.nextGoals.length > 0) {
    lines.push('次の目標:')
    lines.push(...analysis.nextGoals.map((goal) => `- ${goal}`))
  }

  return lines.join('\n')
}
