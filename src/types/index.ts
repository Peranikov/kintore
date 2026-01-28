// 部位カテゴリ
export type MuscleGroup =
  | 'chest'       // 胸
  | 'back'        // 背中
  | 'shoulder'    // 肩
  | 'biceps'      // 上腕二頭
  | 'triceps'     // 上腕三頭
  | 'quadriceps'  // 大腿四頭
  | 'hamstrings'  // ハムストリング
  | 'glutes'      // 臀部
  | 'abs'         // 腹筋

// 部位の日本語ラベル
export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背中',
  shoulder: '肩',
  biceps: '二頭',
  triceps: '三頭',
  quadriceps: '四頭',
  hamstrings: 'ハム',
  glutes: '臀部',
  abs: '腹筋',
}

// 全部位のリスト（UI用）
export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulder', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'abs',
]

// 対象部位
export interface TargetMuscle {
  muscle: MuscleGroup
  isMain: boolean  // true: メイン, false: サブ
}

export interface Set {
  weight: number
  reps: number
  duration?: number  // 有酸素運動用：時間（分）
  distance?: number  // 有酸素運動用：距離（km）
}

export interface Exercise {
  id: string
  name: string
  sets: Set[]
}

export interface WorkoutLog {
  id?: number
  date: string
  exercises: Exercise[]
  memo?: string
  evaluation?: string              // AI評価テキスト
  evaluationGeneratedAt?: number   // 評価生成日時
  createdAt: number
  updatedAt: number
}

export interface ExerciseMaster {
  id?: number
  name: string
  isBodyweight?: boolean
  isCardio?: boolean  // 有酸素運動フラグ
  targetMuscles?: TargetMuscle[]  // 対象部位
  createdAt: number
}

export interface AppSettings {
  id?: number
  key: string
  value: string
}

// 進捗状態
export type ProgressStatus = 'up' | 'same' | 'down'

// 個別指標の進捗
export interface ProgressMetric {
  current: number
  previous: number
  diff: number
  diffPercent: number
  status: ProgressStatus
}

// 進捗比較結果
export interface ProgressComparison {
  // ウェイトトレーニング用
  maxWeight?: ProgressMetric
  totalVolume?: ProgressMetric
  estimated1RM?: ProgressMetric
  // 自重トレーニング用
  maxReps?: ProgressMetric
  totalReps?: ProgressMetric
  // 有酸素運動用
  totalDuration?: ProgressMetric
  totalDistance?: ProgressMetric
}

// 停滞情報
export interface StagnationInfo {
  exerciseName: string
  metric: string           // "推定1RM", "最大回数", "時間" など
  value: number
  unit: string
  weeks: number            // 停滞週数
}

// パフォーマンス低下情報
export interface PerformanceDecline {
  exerciseName: string
  declinePercent: number
}

// ディロード提案
export interface DeloadSuggestion {
  reason: 'consecutive_weeks' | 'performance_decline'
  message: string
  weeksTraining: number
  performanceDecline?: PerformanceDecline[]
}
