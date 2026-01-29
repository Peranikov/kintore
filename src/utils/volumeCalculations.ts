import type { WorkoutLog, ExerciseMaster, MuscleGroup, TargetMuscle } from '../types'
import { ALL_MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '../types'

export interface WeeklyVolumeData {
  muscle: MuscleGroup
  label: string
  mainSets: number    // メイン種目のセット数
  subSets: number     // サブ種目のセット数
  totalSets: number   // 合計（メイン + サブ×0.5）
  recommended: { min: number; max: number }
}

// 週の開始日（月曜日）を取得
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 日曜日の場合は前週の月曜日
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 週の終了日（日曜日）を取得
export function getWeekEndDate(date: Date): Date {
  const start = getWeekStartDate(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

// 日付が指定した週に含まれるか判定
function isDateInWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  const date = new Date(dateStr)
  return date >= weekStart && date <= weekEnd
}

// 種目名から対象部位を取得（ExerciseMasterから）
function getTargetMusclesFromMaster(
  exerciseName: string,
  exerciseMasters: ExerciseMaster[]
): TargetMuscle[] {
  const master = exerciseMasters.find(m => m.name === exerciseName)
  return master?.targetMuscles ?? []
}

// 週間セット数を部位別に集計
export function calculateWeeklyVolume(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  targetDate: Date = new Date()
): WeeklyVolumeData[] {
  const weekStart = getWeekStartDate(targetDate)
  const weekEnd = getWeekEndDate(targetDate)

  // 該当週のログをフィルタリング
  const weekLogs = logs.filter(log => isDateInWeek(log.date, weekStart, weekEnd))

  // 部位ごとのセット数を集計
  const volumeMap: Record<MuscleGroup, { main: number; sub: number }> = {
    chest: { main: 0, sub: 0 },
    back: { main: 0, sub: 0 },
    shoulder: { main: 0, sub: 0 },
    biceps: { main: 0, sub: 0 },
    triceps: { main: 0, sub: 0 },
    quadriceps: { main: 0, sub: 0 },
    hamstrings: { main: 0, sub: 0 },
    glutes: { main: 0, sub: 0 },
    abs: { main: 0, sub: 0 },
  }

  for (const log of weekLogs) {
    for (const exercise of log.exercises) {
      const targetMuscles = getTargetMusclesFromMaster(exercise.name, exerciseMasters)
      const setCount = exercise.sets.length

      for (const target of targetMuscles) {
        if (target.isMain) {
          volumeMap[target.muscle].main += setCount
        } else {
          volumeMap[target.muscle].sub += setCount
        }
      }
    }
  }

  // 結果を配列に変換
  return ALL_MUSCLE_GROUPS.map(muscle => ({
    muscle,
    label: MUSCLE_GROUP_LABELS[muscle],
    mainSets: volumeMap[muscle].main,
    subSets: volumeMap[muscle].sub,
    // サブセットは0.5倍で換算
    totalSets: volumeMap[muscle].main + volumeMap[muscle].sub * 0.5,
    recommended: { min: 10, max: 20 },
  }))
}

// ボリュームの状態を判定
export type VolumeStatus = 'insufficient' | 'optimal' | 'excessive' | 'none'

export function getVolumeStatus(totalSets: number): VolumeStatus {
  if (totalSets === 0) return 'none'
  if (totalSets < 10) return 'insufficient'
  if (totalSets <= 20) return 'optimal'
  return 'excessive'
}

// ステータスに応じた色を取得
export function getVolumeStatusColor(status: VolumeStatus): string {
  switch (status) {
    case 'none': return 'bg-gray-200'
    case 'insufficient': return 'bg-yellow-400'
    case 'optimal': return 'bg-green-500'
    case 'excessive': return 'bg-red-500'
  }
}

// ボリュームに基づくアドバイスを生成
export function generateVolumeAdvice(data: WeeklyVolumeData[]): string[] {
  const advice: string[] = []

  for (const d of data) {
    const status = getVolumeStatus(d.totalSets)
    if (status === 'excessive') {
      advice.push(`${d.label}が${d.totalSets.toFixed(1)}セットで過多です。回復のためセット数を減らすことを検討してください`)
    } else if (status === 'insufficient') {
      advice.push(`${d.label}が${d.totalSets.toFixed(1)}セットで不足です。種目の追加を検討してください`)
    }
  }

  return advice
}

// AIプロンプト用にボリューム状況をフォーマット
export function formatVolumeForPrompt(data: WeeklyVolumeData[]): string | null {
  const insufficient = data.filter(d => getVolumeStatus(d.totalSets) === 'insufficient')
  const excessive = data.filter(d => getVolumeStatus(d.totalSets) === 'excessive')

  if (insufficient.length === 0 && excessive.length === 0) return null

  const parts: string[] = []
  if (insufficient.length > 0) {
    parts.push(`不足: ${insufficient.map(d => `${d.label}(${d.totalSets.toFixed(1)}セット)`).join(', ')}`)
  }
  if (excessive.length > 0) {
    parts.push(`過多: ${excessive.map(d => `${d.label}(${d.totalSets.toFixed(1)}セット)`).join(', ')}`)
  }

  return `週間ボリューム状況（推奨: 各部位10-20セット/週）\n${parts.join('\n')}`
}

// 週の範囲を表示用文字列で取得
export function formatWeekRange(targetDate: Date = new Date()): string {
  const start = getWeekStartDate(targetDate)
  const end = getWeekEndDate(targetDate)

  const formatDate = (d: Date) => {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return `${formatDate(start)} - ${formatDate(end)}`
}
