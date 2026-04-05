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
  analysisSnapshot?: WorkoutAnalysisSnapshot
  createdAt: number
  updatedAt: number
}

export interface ExerciseAnalysis {
  exerciseName: string
  previousDate?: string
  comparison?: ProgressComparison
  summary: string
}

export interface SessionSummary {
  exerciseCount: number
  totalSets: number
  bodyPartSetCounts: Partial<Record<ExerciseBodyPart, number>>
}

export interface WorkoutAnalysisSnapshot {
  generatedAt: number
  exerciseAnalyses: ExerciseAnalysis[]
  sessionSummary: SessionSummary
  nextActions: string[]
}

export interface ProgressTrendMetric {
  label: string
  current: number
  previous: number
  diff: number
  diffPercent: number
  status: ProgressStatus
  unit: string
}

export interface ExerciseTrendAnalysis {
  exerciseName: string
  lastDate: string
  recordCount: number
  primaryMetric?: ProgressTrendMetric
  summary: string
}

export interface ProgressPeriodSummary {
  fromDate: string
  toDate: string
  sessionCount: number
  weeklyFrequency: number
  bodyPartSetCounts: Partial<Record<ExerciseBodyPart, number>>
}

export interface ProgressAnalysisSnapshot {
  generatedAt: number
  periodSummary: ProgressPeriodSummary
  exerciseTrends: ExerciseTrendAnalysis[]
  nextGoals: string[]
}

export type ExerciseBodyPart =
  | '胸'
  | '背中'
  | '肩'
  | '脚'
  | '腕'
  | '体幹'
  | '有酸素'
  | 'その他'

export type ExerciseCategory =
  | 'コンパウンド'
  | 'アイソレーション'
  | '自重'
  | '有酸素'

export interface ExerciseMaster {
  id?: number
  name: string
  isBodyweight?: boolean
  isCardio?: boolean  // 有酸素運動フラグ
  bodyPart?: ExerciseBodyPart
  category?: ExerciseCategory
  createdAt: number
}

export interface AppSettings {
  id?: number
  key: string
  value: string
}

export interface StructuredUserProfile {
  primaryGoal: string
  trainingExperience: string
  weeklyFrequency: string
  sessionDurationMinutes: string
  focusAreas: string
  weeklySetTargetChest: string
  weeklySetTargetBack: string
  weeklySetTargetShoulders: string
  weeklySetTargetLegs: string
  weeklySetTargetArms: string
  weeklySetTargetCore: string
  limitations: string
  bodyMetrics: string
  additionalNotes: string
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
  reason: 'accumulated_sessions' | 'performance_decline'
  message: string
  sessionCount: number
  performanceDecline?: PerformanceDecline[]
}

export interface DeloadDismissal {
  dismissedAt: number
}
