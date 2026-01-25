import type { TargetMuscle } from '../types'

// 種目名から対象部位へのマッピング
// メイン部位とサブ部位を区別して定義
export const EXERCISE_MUSCLE_MAP: Record<string, TargetMuscle[]> = {
  // 筋トレマシン - 胸系
  'チェストプレス': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'インクラインプレス': [
    { muscle: 'chest', isMain: true },
    { muscle: 'shoulder', isMain: false },
    { muscle: 'triceps', isMain: false },
  ],
  'シーテッドディップ': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'ペクトラル/リバースフライ': [
    { muscle: 'chest', isMain: true },
    { muscle: 'back', isMain: false },
  ],

  // 筋トレマシン - 肩系
  'ショルダープレス': [
    { muscle: 'shoulder', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'スタンディングラテラルレイズ/フライ': [
    { muscle: 'shoulder', isMain: true },
  ],

  // 筋トレマシン - 背中系
  'ラットプルダウン': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'フィクスドプルダウン': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'ローロウ': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'シーテッドロウ': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],

  // 筋トレマシン - 脚系
  'レッグプレス': [
    { muscle: 'quadriceps', isMain: true },
    { muscle: 'glutes', isMain: false },
  ],
  'レッグエクステンション': [
    { muscle: 'quadriceps', isMain: true },
  ],
  'シーテッドレッグカール': [
    { muscle: 'hamstrings', isMain: true },
  ],
  'ライイングレッグカール': [
    { muscle: 'hamstrings', isMain: true },
  ],
  'インナーサイ/アウターサイ': [
    { muscle: 'glutes', isMain: true },
  ],
  'ヒップスラスト': [
    { muscle: 'glutes', isMain: true },
    { muscle: 'hamstrings', isMain: false },
  ],

  // 筋トレマシン - 腕・体幹系
  'バイセプスカール': [
    { muscle: 'biceps', isMain: true },
  ],
  'アブドミナルクランチ': [
    { muscle: 'abs', isMain: true },
  ],
  'ロータリートルソー': [
    { muscle: 'abs', isMain: true },
  ],
  'アシステッドチン/ディップ': [
    { muscle: 'back', isMain: true },
    { muscle: 'chest', isMain: false },
    { muscle: 'biceps', isMain: false },
    { muscle: 'triceps', isMain: false },
  ],
  'バックエクステンションマシン': [
    { muscle: 'back', isMain: true },
    { muscle: 'glutes', isMain: false },
  ],
  'デュアルアジャスタブルプーリー': [
    // 汎用マシンなので部位なし
  ],

  // フリーウェイト - BIG3
  'ベンチプレス': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
    { muscle: 'shoulder', isMain: false },
  ],
  'スクワット': [
    { muscle: 'quadriceps', isMain: true },
    { muscle: 'glutes', isMain: true },
    { muscle: 'hamstrings', isMain: false },
  ],
  'デッドリフト': [
    { muscle: 'back', isMain: true },
    { muscle: 'hamstrings', isMain: true },
    { muscle: 'glutes', isMain: true },
  ],

  // フリーウェイト - ダンベル系
  'ダンベルプレス': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'ダンベルフライ': [
    { muscle: 'chest', isMain: true },
  ],
  'ダンベルカール': [
    { muscle: 'biceps', isMain: true },
  ],
  'ダンベルショルダープレス': [
    { muscle: 'shoulder', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'ダンベルローイング': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],

  // フリーウェイト - その他
  'スミスマシン': [
    // 汎用マシンなので部位なし
  ],

  // プレートロード - 胸系
  'チェストプレス（プレートロード）': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'シーテッドチェストプレス（プレートロード）': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],
  'インクラインチェストプレス（プレートロード）': [
    { muscle: 'chest', isMain: true },
    { muscle: 'shoulder', isMain: false },
    { muscle: 'triceps', isMain: false },
  ],

  // プレートロード - 肩系
  'ショルダープレス（プレートロード）': [
    { muscle: 'shoulder', isMain: true },
    { muscle: 'triceps', isMain: false },
  ],

  // プレートロード - 背中系
  'シーテッドロウ（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'ハイロウ（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  '4wayロウ（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'アイソラテラルローロウ（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'プルダウン（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'ティーバーロー（プレートロード）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],

  // プレートロード - 脚系
  'パワーレッグプレス（プレートロード）': [
    { muscle: 'quadriceps', isMain: true },
    { muscle: 'glutes', isMain: false },
  ],
  'ハックスクワット（プレートロード）': [
    { muscle: 'quadriceps', isMain: true },
    { muscle: 'glutes', isMain: false },
  ],

  // 自重系
  'バックエクステンション': [
    { muscle: 'back', isMain: true },
    { muscle: 'glutes', isMain: false },
  ],
  'シットアップ': [
    { muscle: 'abs', isMain: true },
  ],
  'チンニング（懸垂）': [
    { muscle: 'back', isMain: true },
    { muscle: 'biceps', isMain: false },
  ],
  'ディップス': [
    { muscle: 'chest', isMain: true },
    { muscle: 'triceps', isMain: true },
    { muscle: 'shoulder', isMain: false },
  ],

  // 有酸素運動（部位なし）
  'ランニング': [],
  'バイク': [],
}

// 種目名から対象部位を取得（未登録の場合は空配列）
export function getTargetMuscles(exerciseName: string): TargetMuscle[] {
  return EXERCISE_MUSCLE_MAP[exerciseName] ?? []
}
