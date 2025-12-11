export interface Set {
  weight: number
  reps: number
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
  createdAt: number
  updatedAt: number
}

export interface ExerciseMaster {
  id?: number
  name: string
  isBodyweight?: boolean
  createdAt: number
}

export interface AppSettings {
  id?: number
  key: string
  value: string
}
