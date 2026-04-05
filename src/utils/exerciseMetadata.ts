import type { ExerciseBodyPart, ExerciseCategory, ExerciseMaster } from '../types'

export const EXERCISE_BODY_PARTS = [
  '胸',
  '背中',
  '肩',
  '脚',
  '腕',
  '体幹',
  '有酸素',
  'その他',
] as const

export const EXERCISE_CATEGORIES = [
  'コンパウンド',
  'アイソレーション',
  '自重',
  '有酸素',
] as const

interface ExerciseMetadata {
  bodyPart?: ExerciseBodyPart
  category?: ExerciseCategory
}

const PRESET_EXERCISE_METADATA: Record<string, ExerciseMetadata> = {
  'チェストプレス': { bodyPart: '胸', category: 'コンパウンド' },
  'インクラインプレス': { bodyPart: '胸', category: 'コンパウンド' },
  'シーテッドディップ': { bodyPart: '胸', category: 'コンパウンド' },
  'ペクトラル/リバースフライ': { bodyPart: '胸', category: 'アイソレーション' },
  'ショルダープレス': { bodyPart: '肩', category: 'コンパウンド' },
  'スタンディングラテラルレイズ/フライ': { bodyPart: '肩', category: 'アイソレーション' },
  'ラットプルダウン': { bodyPart: '背中', category: 'コンパウンド' },
  'フィクスドプルダウン': { bodyPart: '背中', category: 'コンパウンド' },
  'ローロウ': { bodyPart: '背中', category: 'コンパウンド' },
  'シーテッドロウ': { bodyPart: '背中', category: 'コンパウンド' },
  'レッグプレス': { bodyPart: '脚', category: 'コンパウンド' },
  'レッグエクステンション': { bodyPart: '脚', category: 'アイソレーション' },
  'シーテッドレッグカール': { bodyPart: '脚', category: 'アイソレーション' },
  'ライイングレッグカール': { bodyPart: '脚', category: 'アイソレーション' },
  'インナーサイ/アウターサイ': { bodyPart: '脚', category: 'アイソレーション' },
  'ヒップスラスト': { bodyPart: '脚', category: 'コンパウンド' },
  'バイセプスカール': { bodyPart: '腕', category: 'アイソレーション' },
  'アブドミナルクランチ': { bodyPart: '体幹', category: 'アイソレーション' },
  'ロータリートルソー': { bodyPart: '体幹', category: 'アイソレーション' },
  'アシステッドチン/ディップ': { bodyPart: '背中', category: '自重' },
  'バックエクステンションマシン': { bodyPart: '体幹', category: 'アイソレーション' },
  'デュアルアジャスタブルプーリー': { bodyPart: 'その他', category: 'アイソレーション' },
  'ベンチプレス': { bodyPart: '胸', category: 'コンパウンド' },
  'スクワット': { bodyPart: '脚', category: 'コンパウンド' },
  'デッドリフト': { bodyPart: '背中', category: 'コンパウンド' },
  'ダンベルプレス': { bodyPart: '胸', category: 'コンパウンド' },
  'ダンベルフライ': { bodyPart: '胸', category: 'アイソレーション' },
  'ダンベルカール': { bodyPart: '腕', category: 'アイソレーション' },
  'ダンベルショルダープレス': { bodyPart: '肩', category: 'コンパウンド' },
  'ダンベルローイング': { bodyPart: '背中', category: 'コンパウンド' },
  'スミスマシン': { bodyPart: 'その他', category: 'コンパウンド' },
  'チェストプレス（プレートロード）': { bodyPart: '胸', category: 'コンパウンド' },
  'シーテッドチェストプレス（プレートロード）': { bodyPart: '胸', category: 'コンパウンド' },
  'インクラインチェストプレス（プレートロード）': { bodyPart: '胸', category: 'コンパウンド' },
  'ショルダープレス（プレートロード）': { bodyPart: '肩', category: 'コンパウンド' },
  'シーテッドロウ（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  'ハイロウ（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  '4wayロウ（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  'アイソラテラルローロウ（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  'プルダウン（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  'ティーバーロー（プレートロード）': { bodyPart: '背中', category: 'コンパウンド' },
  'パワーレッグプレス（プレートロード）': { bodyPart: '脚', category: 'コンパウンド' },
  'ハックスクワット（プレートロード）': { bodyPart: '脚', category: 'コンパウンド' },
  'バックエクステンション': { bodyPart: '体幹', category: 'アイソレーション' },
  'シットアップ': { bodyPart: '体幹', category: '自重' },
  'チンニング（懸垂）': { bodyPart: '背中', category: '自重' },
  'ディップス': { bodyPart: '胸', category: '自重' },
  'ランニング': { bodyPart: '有酸素', category: '有酸素' },
  'バイク': { bodyPart: '有酸素', category: '有酸素' },
}

export function inferExerciseMetadata(master: Pick<ExerciseMaster, 'name' | 'isBodyweight' | 'isCardio'>): ExerciseMetadata {
  if (master.isCardio) {
    return { bodyPart: '有酸素', category: '有酸素' }
  }

  const preset = PRESET_EXERCISE_METADATA[master.name]
  if (preset) {
    return preset
  }

  if (master.isBodyweight) {
    return { category: '自重' }
  }

  return {}
}
