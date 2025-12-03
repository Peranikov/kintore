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
