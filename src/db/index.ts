import Dexie, { type EntityTable } from 'dexie'
import type { WorkoutLog, ExerciseMaster, AppSettings } from '../types'

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

async function seedExercises() {
  const count = await db.exerciseMasters.count()
  if (count === 0) {
    const now = Date.now()
    await db.exerciseMasters.bulkAdd(
      PRESET_EXERCISES.map((name) => ({
        name,
        createdAt: now,
      }))
    )
  }
}

db.on('ready', seedExercises)

export { db }
