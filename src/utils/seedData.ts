import { db } from '../db'
import type { WorkoutLog } from '../types'

const sampleExercises = [
  'ベンチプレス',
  'スクワット',
  'デッドリフト',
  'ラットプルダウン',
  'ショルダープレス',
  'レッグプレス',
  'ダンベルカール',
  'トライセプスプッシュダウン',
]

function randomWeight(base: number, variance: number): number {
  return Math.round((base + (Math.random() - 0.5) * variance) * 2) / 2
}

function randomReps(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getDateString(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

export async function seedSampleData(): Promise<void> {
  const existingLogs = await db.workoutLogs.count()
  if (existingLogs > 0) {
    if (!confirm('既存のデータがあります。サンプルデータを追加しますか？')) {
      return
    }
  }

  const logs: Omit<WorkoutLog, 'id'>[] = []

  for (let daysAgo = 90; daysAgo >= 0; daysAgo -= Math.floor(Math.random() * 3) + 2) {
    const date = getDateString(daysAgo)
    const numExercises = Math.floor(Math.random() * 3) + 2

    const selectedExercises = [...sampleExercises]
      .sort(() => Math.random() - 0.5)
      .slice(0, numExercises)

    const exercises = selectedExercises.map((name) => {
      const numSets = Math.floor(Math.random() * 2) + 3
      const baseWeight = getBaseWeight(name)
      const progressFactor = 1 + (90 - daysAgo) * 0.002

      return {
        id: crypto.randomUUID(),
        name,
        sets: Array.from({ length: numSets }, (_, i) => ({
          weight: randomWeight(baseWeight * progressFactor * (1 - i * 0.05), 5),
          reps: randomReps(6, 12),
        })),
      }
    })

    const now = Date.now()
    logs.push({
      date,
      exercises,
      createdAt: now,
      updatedAt: now,
    })
  }

  await db.workoutLogs.bulkAdd(logs as WorkoutLog[])
  alert(`${logs.length}件のサンプルデータを追加しました`)
}

function getBaseWeight(exerciseName: string): number {
  const weights: Record<string, number> = {
    'ベンチプレス': 60,
    'スクワット': 80,
    'デッドリフト': 100,
    'ラットプルダウン': 50,
    'ショルダープレス': 30,
    'レッグプレス': 120,
    'ダンベルカール': 12,
    'トライセプスプッシュダウン': 25,
  }
  return weights[exerciseName] || 40
}

export async function clearAllData(): Promise<void> {
  if (!confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
    return
  }
  await db.workoutLogs.clear()
  alert('すべてのデータを削除しました')
}
