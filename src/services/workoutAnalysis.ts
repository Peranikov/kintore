import { db } from '../db'
import type {
  Exercise,
  ExerciseAnalysis,
  ExerciseBodyPart,
  ExerciseMaster,
  SessionSummary,
  WorkoutAnalysisSnapshot,
  WorkoutLog,
} from '../types'
import { calculateProgress } from '../utils/progressCalculations'
import { calculateExerciseStats, isBodyweightExercise, isCardioExercise } from '../utils/graphCalculations'

function getBodyPart(name: string, masters: ExerciseMaster[]): ExerciseBodyPart {
  return masters.find((master) => master.name === name)?.bodyPart || 'その他'
}

function summarizeComparison(exercise: Exercise, previousExercise: Exercise | undefined, masters: ExerciseMaster[]): string {
  if (!previousExercise) {
    return '初回記録です。今後の比較基準になります。'
  }

  const comparison = calculateProgress(
    exercise.sets,
    previousExercise.sets,
    isBodyweightExercise(exercise.name, masters),
    isCardioExercise(exercise.name, masters)
  )

  const primaryMetric = comparison.estimated1RM
    || comparison.maxReps
    || comparison.totalDuration
    || comparison.totalVolume
    || comparison.totalDistance

  if (!primaryMetric) {
    return '比較に必要なデータが不足しています。'
  }

  if (primaryMetric.status === 'up') {
    return '前回より進歩しています。'
  }
  if (primaryMetric.status === 'down') {
    return '前回より低下しています。回復や負荷設定を見直してください。'
  }
  return '前回比で横ばいです。回数、重量、種目構成のどれを伸ばすか決めると次につながります。'
}

function buildSessionSummary(log: WorkoutLog, masters: ExerciseMaster[]): SessionSummary {
  const bodyPartSetCounts: Partial<Record<ExerciseBodyPart, number>> = {}

  for (const exercise of log.exercises) {
    const bodyPart = getBodyPart(exercise.name, masters)
    bodyPartSetCounts[bodyPart] = (bodyPartSetCounts[bodyPart] || 0) + exercise.sets.length
  }

  return {
    exerciseCount: log.exercises.length,
    totalSets: log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    bodyPartSetCounts,
  }
}

function buildNextActions(
  exerciseAnalyses: ExerciseAnalysis[],
  sessionSummary: SessionSummary,
): string[] {
  const actions: string[] = []

  const regressed = exerciseAnalyses.find((analysis) =>
    Object.values(analysis.comparison || {}).some((metric) => metric?.status === 'down')
  )
  if (regressed) {
    actions.push(`${regressed.exerciseName}は前回比で低下があるため、次回は重量を急がずフォームと回数を優先する`)
  }

  const stagnant = exerciseAnalyses.find((analysis) =>
    Object.values(analysis.comparison || {}).some((metric) => metric?.status === 'same')
  )
  if (stagnant) {
    actions.push(`${stagnant.exerciseName}は横ばいなので、次回は重量か回数のどちらを伸ばすか先に決める`)
  }

  const emptyBodyParts = (['胸', '背中', '肩', '脚'] as ExerciseBodyPart[])
    .filter((bodyPart) => !sessionSummary.bodyPartSetCounts[bodyPart])
  if (emptyBodyParts.length > 0) {
    actions.push(`今回は ${emptyBodyParts[0]} の刺激がないため、次回は部位バランスを補う`)
  }

  return actions.slice(0, 3)
}

export async function buildWorkoutAnalysis(log: WorkoutLog): Promise<WorkoutAnalysisSnapshot> {
  const [allLogs, exerciseMasters] = await Promise.all([
    db.workoutLogs.orderBy('date').reverse().toArray(),
    db.exerciseMasters.toArray(),
  ])

  const exerciseAnalyses: ExerciseAnalysis[] = log.exercises.map((exercise) => {
    const previousLog = allLogs.find((otherLog) =>
      otherLog.id !== log.id
      && otherLog.date < log.date
      && otherLog.exercises.some((otherExercise) => otherExercise.name === exercise.name)
    )
    const previousExercise = previousLog?.exercises.find((otherExercise) => otherExercise.name === exercise.name)

    return {
      exerciseName: exercise.name,
      previousDate: previousLog?.date,
      comparison: previousExercise
        ? calculateProgress(
          exercise.sets,
          previousExercise.sets,
          isBodyweightExercise(exercise.name, exerciseMasters),
          isCardioExercise(exercise.name, exerciseMasters)
        )
        : undefined,
      summary: summarizeComparison(exercise, previousExercise, exerciseMasters),
    }
  })

  const sessionSummary = buildSessionSummary(log, exerciseMasters)

  return {
    generatedAt: Date.now(),
    exerciseAnalyses,
    sessionSummary,
    nextActions: buildNextActions(exerciseAnalyses, sessionSummary),
  }
}

export function formatAnalysisForPrompt(log: WorkoutLog, analysis: WorkoutAnalysisSnapshot): string {
  const lines: string[] = [
    `日付: ${log.date}`,
    `種目数: ${analysis.sessionSummary.exerciseCount}`,
    `総セット数: ${analysis.sessionSummary.totalSets}`,
    '部位別セット数:',
    ...Object.entries(analysis.sessionSummary.bodyPartSetCounts).map(([bodyPart, sets]) => `- ${bodyPart}: ${sets}セット`),
    '種目別分析:',
  ]

  for (const exercise of analysis.exerciseAnalyses) {
    const stats = calculateExerciseStats(log.exercises.find((item) => item.name === exercise.exerciseName)?.sets || [])
    const metricLines = exercise.comparison
      ? Object.entries(exercise.comparison)
        .filter(([, metric]) => metric)
        .map(([key, metric]) => `  - ${key}: 現在 ${metric!.current}, 前回 ${metric!.previous}, 差分 ${metric!.diff} (${metric!.diffPercent}%)`)
      : ['  - 比較対象なし']

    lines.push(`- ${exercise.exerciseName}${exercise.previousDate ? ` (前回 ${exercise.previousDate})` : ''}`)
    lines.push(`  - 当日 stats: ${JSON.stringify(stats)}`)
    lines.push(...metricLines)
    lines.push(`  - 所見: ${exercise.summary}`)
  }

  if (analysis.nextActions.length > 0) {
    lines.push('次回アクション:')
    lines.push(...analysis.nextActions.map((action) => `- ${action}`))
  }

  return lines.join('\n')
}
