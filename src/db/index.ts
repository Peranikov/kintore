import Dexie, { type EntityTable } from 'dexie'
import type { WorkoutLog, ExerciseMaster, AppSettings } from '../types'
import { EXERCISE_MUSCLE_MAP } from './exerciseMuscleMap'

const db = new Dexie('TrainingLogDB') as Dexie & {
  workoutLogs: EntityTable<WorkoutLog, 'id'>
  exerciseMasters: EntityTable<ExerciseMaster, 'id'>
  appSettings: EntityTable<AppSettings, 'id'>
}

db.version(1).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
})

db.version(2).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
})

db.version(3).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
  appSettings: '++id, &key',
})

// Version 4: WorkoutLogにevaluation, evaluationGeneratedAtを追加
db.version(4).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
  appSettings: '++id, &key',
})

// Version 5: ExerciseMasterにisCardioを追加、有酸素運動種目を追加
db.version(5).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
  appSettings: '++id, &key',
}).upgrade(async (tx) => {
  const cardioExerciseNames = ['ランニング', 'バイク']
  const table = tx.table('exerciseMasters')
  for (const name of cardioExerciseNames) {
    const existing = await table.where('name').equals(name).first()
    if (existing) {
      await table.update(existing.id, { isCardio: true })
    } else {
      await table.add({ name, isCardio: true, createdAt: Date.now() })
    }
  }
})

// Version 6: 既存のランニング・バイクにisCardioフラグを設定（Version 5で未設定の場合の修正）
db.version(6).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
  appSettings: '++id, &key',
}).upgrade(async (tx) => {
  const cardioExerciseNames = ['ランニング', 'バイク']
  const table = tx.table('exerciseMasters')
  for (const name of cardioExerciseNames) {
    const existing = await table.where('name').equals(name).first()
    if (existing && !existing.isCardio) {
      await table.update(existing.id, { isCardio: true })
    }
  }
})

// Version 7: ExerciseMasterにtargetMuscles（対象部位）を追加
db.version(7).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
  appSettings: '++id, &key',
}).upgrade(async (tx) => {
  const table = tx.table('exerciseMasters')
  const exercises = await table.toArray()
  for (const exercise of exercises) {
    const targetMuscles = EXERCISE_MUSCLE_MAP[exercise.name]
    if (targetMuscles && targetMuscles.length > 0) {
      await table.update(exercise.id, { targetMuscles })
    }
  }
})

const PRESET_EXERCISES = [
  // 筋トレマシン
  'チェストプレス',
  'インクラインプレス',
  'シーテッドディップ',
  'ペクトラル/リバースフライ',
  'ショルダープレス',
  'スタンディングラテラルレイズ/フライ',
  'ラットプルダウン',
  'フィクスドプルダウン',
  'ローロウ',
  'シーテッドロウ',
  'レッグプレス',
  'レッグエクステンション',
  'シーテッドレッグカール',
  'ライイングレッグカール',
  'インナーサイ/アウターサイ',
  'ヒップスラスト',
  'バイセプスカール',
  'アブドミナルクランチ',
  'ロータリートルソー',
  'アシステッドチン/ディップ',
  'バックエクステンションマシン',
  'デュアルアジャスタブルプーリー',
  // フリーウェイト
  'ベンチプレス',
  'スクワット',
  'デッドリフト',
  'ダンベルプレス',
  'ダンベルフライ',
  'ダンベルカール',
  'ダンベルショルダープレス',
  'ダンベルローイング',
  'スミスマシン',
  'チェストプレス（プレートロード）',
  'シーテッドチェストプレス（プレートロード）',
  'インクラインチェストプレス（プレートロード）',
  'ショルダープレス（プレートロード）',
  'シーテッドロウ（プレートロード）',
  'ハイロウ（プレートロード）',
  '4wayロウ（プレートロード）',
  'アイソラテラルローロウ（プレートロード）',
  'プルダウン（プレートロード）',
  'ティーバーロー（プレートロード）',
  'パワーレッグプレス（プレートロード）',
  'ハックスクワット（プレートロード）',
  'バックエクステンション',
  'シットアップ',
  'チンニング（懸垂）',
  'ディップス',
]

const CARDIO_EXERCISES = ['ランニング', 'バイク']

async function seedExercises() {
  const count = await db.exerciseMasters.count()
  if (count === 0) {
    const now = Date.now()
    await db.exerciseMasters.bulkAdd(
      PRESET_EXERCISES.map((name) => {
        const targetMuscles = EXERCISE_MUSCLE_MAP[name]
        return {
          name,
          isCardio: CARDIO_EXERCISES.includes(name) || undefined,
          targetMuscles: targetMuscles && targetMuscles.length > 0 ? targetMuscles : undefined,
          createdAt: now,
        }
      })
    )
  }
}

// targetMusclesが未設定の種目にEXERCISE_MUSCLE_MAPから補完
async function ensureTargetMuscles() {
  const exercises = await db.exerciseMasters.toArray()
  for (const exercise of exercises) {
    if (!exercise.targetMuscles) {
      const targetMuscles = EXERCISE_MUSCLE_MAP[exercise.name]
      if (targetMuscles && targetMuscles.length > 0) {
        await db.exerciseMasters.update(exercise.id!, { targetMuscles })
      }
    }
  }
}

db.on('ready', async () => {
  await seedExercises()
  await ensureTargetMuscles()
})

export { db }
