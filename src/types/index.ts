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
