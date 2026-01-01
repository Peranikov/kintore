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
  createdAt: number
}

export interface AppSettings {
  id?: number
  key: string
  value: string
}
