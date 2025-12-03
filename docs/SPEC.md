# トレーニングログアプリ 仕様書

## 概要

筋トレの記録をローカルに保存・管理するPWAアプリケーション。

## 技術スタック

| 項目 | 選定 |
|------|------|
| フレームワーク | React |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| ビルドツール | Vite |
| データ保存 | IndexedDB (Dexie.js) |
| PWA | vite-plugin-pwa |

## 機能要件

### Phase 1（MVP）

#### 対象
- 筋トレのみ（有酸素運動は対象外）

#### データ管理
- ローカル保存（IndexedDB）
- オフラインでも記録可能

#### 画面構成

| 画面 | 機能 |
|------|------|
| ホーム | 今日のログ入力、直近ログ一覧表示 |
| ログ詳細 | 記録の確認・編集・削除 |
| 種目マスタ | よく使う種目の登録・管理 |

### 将来的な拡張候補（Phase 2以降）
- カレンダービューでのログ確認
- グラフでの進捗可視化
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
  weight: number       // 重量（kg）
  reps: number         // 回数
}
```

### ExerciseMaster（種目マスタ）

```typescript
interface ExerciseMaster {
  id?: number          // 自動採番
  name: string         // 種目名
  createdAt: number    // timestamp
}
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
├── pages/         # ページコンポーネント
├── db/            # Dexie.js データベース設定
├── types/         # TypeScript型定義
├── hooks/         # カスタムフック
├── App.tsx
├── main.tsx
└── index.css
```
