import Dexie, { type EntityTable } from 'dexie'
import type { WorkoutLog, ExerciseMaster } from '../types'

const db = new Dexie('TrainingLogDB') as Dexie & {
  workoutLogs: EntityTable<WorkoutLog, 'id'>
  exerciseMasters: EntityTable<ExerciseMaster, 'id'>
}

db.version(1).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
})

export { db }
