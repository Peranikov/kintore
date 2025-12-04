# トレーニングログアプリ 仕様書

## 概要

筋トレの記録をローカルに保存・管理するPWAアプリケーション。

## 技術スタック

| 項目 | 選定 |
|------|------|
| フレームワーク | React 19 |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS v4 |
| ビルドツール | Vite 7 |
| データ保存 | IndexedDB (Dexie.js) |
| PWA | vite-plugin-pwa |
| グラフ | Recharts |

## 機能要件

### 対象
- 筋トレのみ（有酸素運動は対象外）
- ウェイトトレーニングと自重トレーニングの両方に対応

### データ管理
- ローカル保存（IndexedDB）
- オフラインでも記録可能

### 画面構成

| 画面 | パス | 機能 |
|------|------|------|
| ホーム | `/` | 今日のログ入力、直近ログ一覧表示 |
| ログ詳細 | `/log/:id` | 記録の確認・編集・削除・テキストエクスポート |
| カレンダー | `/calendar` | 月間カレンダーでのログ確認 |
| グラフ | `/graph` | 種目別の進捗グラフ表示 |
| 設定 | `/settings` | 種目マスタ・エクスポートへのリンク |
| 種目マスタ | `/exercises` | よく使う種目の登録・管理 |
| エクスポート | `/export` | 期間指定でのトレーニング記録エクスポート |

### 種目入力機能

#### 前回記録の表示
種目名を入力すると、その種目の前回記録を自動表示:
- 前回の日付とセット内容を表示
- 「コピー」ボタンで前回の値をそのまま入力フィールドにコピー可能

#### 自重トレーニング対応
種目マスタで「自重トレーニング」として登録された種目:
- 重量入力フィールドを非表示
- 回数のみを入力
- 表示形式: `XX回` （ウェイトは `XXkg×XX回`）

#### キーボード操作
- 種目名入力後のEnter: 最初のセットの入力欄にフォーカス
- 重量入力後のEnter: 同セットの回数入力欄にフォーカス
- 回数入力後のEnter: 次のセットを自動追加してフォーカス

### テキストエクスポート機能

#### 単日エクスポート（ログ詳細画面）
ログ詳細画面からトレーニング記録をMarkdown形式のテキストとしてコピー可能。

出力形式:
```
# トレーニング記録 YYYY-MM-DD

## 種目名
- 1セット目: XXkg × XX回
- 2セット目: XXkg × XX回

## 種目名（自重）
- 1セット目: XX回
- 2セット目: XX回

## メモ
メモ内容
```

#### 期間エクスポート（エクスポート画面）
期間を指定して複数日分のトレーニング記録をまとめてエクスポート:
- 開始日・終了日を自由に選択
- クイック選択: 今月 / 3ヶ月 / 6ヶ月
- プレビュー表示で内容確認
- Web Share API対応（非対応ブラウザではクリップボードにコピー）

### グラフ機能

種目別の進捗をグラフで可視化。直近3ヶ月のデータを表示。

#### ウェイトトレーニング
| 項目 | 内容 |
|------|------|
| グラフ種類 | 折れ線グラフ（2軸） |
| X軸 | 日付 |
| 左Y軸 | 重量(kg) |
| 右Y軸 | 総ボリューム |
| 表示データ | 最大重量、推定1RM、総ボリューム |

推定1RM計算式: `weight × (1 + reps / 30)`

#### 自重トレーニング
| 項目 | 内容 |
|------|------|
| グラフ種類 | 折れ線グラフ（2軸） |
| X軸 | 日付 |
| 左Y軸 | 回数 |
| 右Y軸 | 合計回数 |
| 表示データ | 最大回数、合計回数 |

#### 共通
- 種目ごとにカード形式で表示
- 最終記録日が新しい順にソート
- グラフ下に最新データのサマリー表示

### 種目プリセット

初回起動時に以下のカテゴリから50種目を自動登録:
- 筋トレマシン（22種目）
- フリーウェイト・プレートロード（28種目）

### 将来的な拡張候補
- トレーニングメニューのテンプレート機能
- 目標設定・達成率表示

## データモデル

### WorkoutLog（トレーニングログ）

```typescript
interface WorkoutLog {
  id?: number          // 自動採番
  date: string         // YYYY-MM-DD
  exercises: Exercise[]
  memo?: string
  createdAt: number    // timestamp
  updatedAt: number    // timestamp
}
```

### Exercise（種目）

```typescript
interface Exercise {
  id: string           // UUID
  name: string         // 種目名（例: ベンチプレス）
  sets: Set[]
}
```

### Set（セット）

```typescript
interface Set {
  weight: number       // 重量（kg）、自重の場合は0
  reps: number         // 回数
}
```

### ExerciseMaster（種目マスタ）

```typescript
interface ExerciseMaster {
  id?: number          // 自動採番
  name: string         // 種目名
  isBodyweight?: boolean  // 自重トレーニングフラグ
  createdAt: number    // timestamp
}
```

## DBスキーマ

```typescript
// Version 2
db.version(2).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',
})
```

## PWA要件

- オフライン動作可能
- ホーム画面に追加可能
- Service Workerによるキャッシュ
- アプリアイコン設定

## ディレクトリ構造

```
src/
├── components/    # 再利用可能なUIコンポーネント
│   ├── BottomNav.tsx    # 下部ナビゲーション
│   └── ExerciseForm.tsx # 種目入力フォーム
├── pages/         # ページコンポーネント
│   ├── HomePage.tsx
│   ├── LogDetailPage.tsx
│   ├── CalendarPage.tsx
│   ├── GraphPage.tsx
│   ├── SettingsPage.tsx
│   ├── ExerciseMasterPage.tsx
│   └── ExportPage.tsx
├── db/            # Dexie.js データベース設定
├── types/         # TypeScript型定義
├── utils/         # ユーティリティ関数
├── App.tsx
├── main.tsx
└── index.css
```
