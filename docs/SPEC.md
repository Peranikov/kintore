# トレーニングログアプリ 仕様書

## 概要

トレーニングの記録をローカルに保存・管理するPWAアプリケーション。

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
| AI API | Google Gemini API (gemini-2.5-flash) |
| スワイプ | react-swipeable |

## 機能要件

### 対象
- ウェイトトレーニング
- 自重トレーニング
- 有酸素運動（ランニング、バイク等）

### データ管理
- ローカル保存（IndexedDB）
- オフラインでも記録可能

### 画面構成

| 画面 | パス | 機能 |
|------|------|------|
| ホーム | `/` | 今日のログ入力、直近ログ一覧表示、AIプラン生成 |
| ログ詳細 | `/log/:id` | 記録の確認・編集・削除・テキストエクスポート・AI評価 |
| カレンダー | `/calendar` | 月間カレンダーでのログ確認（スワイプで月移動） |
| グラフ | `/graph` | 種目別の進捗グラフ表示、AI総合評価 |
| 設定 | `/settings` | 種目マスタ・エクスポート・AI設定へのリンク |
| 種目マスタ | `/exercises` | 種目の登録・管理（自重/有酸素フラグ設定） |
| エクスポート | `/export` | 期間指定でのトレーニング記録エクスポート |
| AI設定 | `/ai-settings` | Gemini APIキー・ユーザープロフィール設定 |
| AIプラン作成 | `/plan-create` | AIによるトレーニングプラン生成 |

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

#### 有酸素運動対応
種目マスタで「有酸素運動」として登録された種目:
- 時間（分）と距離（km）を入力
- 距離は任意入力
- セット概念なし（1回の記録として保存）
- 表示形式: `XX分` または `XX分 / X.Xkm`

#### キーボード操作
- 種目名入力後のEnter: 最初のセットの入力欄にフォーカス（自重は回数、ウェイトは重量）
- 重量入力後のEnter: 同セットの回数入力欄にフォーカス
- 回数入力後のEnter: 次のセットがあればその重量欄（自重は回数欄）にフォーカス、なければ新規セットを追加

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

## 種目名（有酸素）
- XX分 / X.Xkm

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

#### 有酸素運動
| 項目 | 内容 |
|------|------|
| グラフ種類 | 折れ線グラフ（2軸） |
| X軸 | 日付 |
| 左Y軸 | 時間（分） |
| 右Y軸 | 距離（km） |
| 表示データ | 時間、距離 |

#### 共通
- 種目ごとにカード形式で表示
- 最終記録日が新しい順にソート
- グラフ下に最新データのサマリー表示

### 種目プリセット

初回起動時に以下のカテゴリから種目を自動登録:
- 筋トレマシン（22種目）
- フリーウェイト・プレートロード（28種目）
- 有酸素運動（2種目）: ランニング、バイク

### 種目マスタ機能（/exercises）

#### 種目の登録
- 種目名を入力して「追加」ボタンで登録
- 同じ名前の種目は登録不可

#### 種目タイプの設定
- 自重トレーニング: チェックすると重量入力が不要になる
- 有酸素運動: チェックすると時間・距離入力に切り替わる
- 自重トレーニングと有酸素運動は排他的（同時に選択不可）

#### 種目一覧
- 登録済み種目を名前順で表示
- 種目タイプに応じてバッジ表示（「自重」「有酸素」）
- 編集・削除が可能

### AI機能（Gemini API）

ユーザーが取得したGemini APIキーを使用してAI機能を提供。APIキーはIndexedDBにローカル保存。

#### AI設定（/ai-settings）
- Gemini APIキーの入力・保存
- ユーザープロフィール設定（トレーニング目標、体組成、経験など）
- APIキーはGoogle AI Studioで無料取得可能

#### AIトレーニングプラン生成（/plan-create）
- チャット形式のUIでAIとやり取り
- ページを開くと自動でプラン生成を開始
- 過去7回分の履歴と登録済み種目を考慮してプラン生成
- 直近の保存済みAI評価がある場合、その改善点を考慮してプラン生成
- 各種目について前回の記録を表示（日付・セット内容）
- チャットで修正指示を送信して再生成可能（会話コンテキストを保持）
- 「採用する」ボタンで今日のログに追加

#### AIトレーニング評価（/log/:id）
- 個別のトレーニングログに対する評価
- 過去の履歴と比較した進捗フィードバック
- 次回へのアドバイス
- 評価結果をログに保存（永続化）
- 保存済み評価は再表示可能（生成日時を表示）

#### AI総合進捗評価（/graph）
- 過去30回分の履歴を分析
- 種目ごとの伸び具合
- トレーニング頻度の評価
- 改善点と次の目標設定アドバイス

### カレンダー機能

#### スワイプ操作
- 左スワイプ: 次月へ
- 右スワイプ: 先月へ
- ボタン操作も併用可能

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
  evaluation?: string           // AI評価テキスト
  evaluationGeneratedAt?: number // AI評価生成日時
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
  duration?: number    // 有酸素運動用：時間（分）
  distance?: number    // 有酸素運動用：距離（km）
}
```

### ExerciseMaster（種目マスタ）

```typescript
interface ExerciseMaster {
  id?: number          // 自動採番
  name: string         // 種目名
  isBodyweight?: boolean  // 自重トレーニングフラグ
  isCardio?: boolean      // 有酸素運動フラグ
  createdAt: number    // timestamp
}
```

### AppSettings（アプリ設定）

```typescript
interface AppSettings {
  id?: number          // 自動採番
  key: string          // 設定キー（geminiApiKey, userProfile）
  value: string        // 設定値
}
```

## DBスキーマ

```typescript
// Version 6
db.version(6).stores({
  workoutLogs: '++id, date, createdAt',
  exerciseMasters: '++id, name, createdAt',  // isCardio追加、有酸素運動種目を自動追加
  appSettings: '++id, &key',
})
```

## UIガイドライン

### タップ領域
iOSヒューマンインターフェースガイドラインに準拠:
- タップ可能なアイコンボタン: 最小44×44pt
- Tailwind CSS: `min-w-11 min-h-11`（44px）

### アイコンボタン
- 編集・削除などのアクションボタンはアイコンのみで表示
- ツールチップ（title属性）でアクション名を提供
- アイコンサイズ: `h-5 w-5`（20px）、ヘッダー内は`h-6 w-6`（24px）

### 入力フォーム
- iOS Safariでの自動ズーム防止のため、input/textarea/selectは`font-size: 16px`以上を使用
- 16px未満の場合、iOSでフォーカス時に自動ズームが発生する

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
│   ├── ExportPage.tsx
│   ├── AISettingsPage.tsx     # AI設定
│   └── PlanCreatePage.tsx     # AIプラン作成
├── services/      # 外部API連携
│   └── gemini.ts  # Gemini API関連関数
├── db/            # Dexie.js データベース設定
├── types/         # TypeScript型定義
├── utils/         # ユーティリティ関数
├── App.tsx
├── main.tsx
└── index.css
```
