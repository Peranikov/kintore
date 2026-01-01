# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

トレーニングログPWAアプリ。ローカル（IndexedDB）にトレーニング記録を保存し、オフラインでも動作する。
ウェイトトレーニング、自重トレーニング、有酸素運動（ランニング・バイク）に対応。

## Development Workflow

1. 作業完了後は `npm run check` で全検証（lint + test + build）
2. 機能を追加した場合は `docs/SPEC.md` および `CLAUDE.md` の更新をユーザーに提案する

## Commands

```bash
npm run dev       # 開発サーバー起動
npm run check     # 全検証（lint + test + build）★推奨
npm run lint      # ESLint実行
npm run test:run  # テスト実行（単発）
npm run typecheck # 型チェックのみ
npm run build     # 本番ビルド
```

## Architecture

### Tech Stack
- React 19 + TypeScript
- Tailwind CSS v4 (@tailwindcss/vite)
- Vite 7 + SWC（高速トランスパイル）
- Vitest + React Testing Library（テスト）
- Dexie.js (IndexedDB wrapper)
- vite-plugin-pwa (Service Worker)
- Recharts (グラフ描画)
- Google Gemini API (AI機能)
- react-swipeable (スワイプジェスチャー)

### Data Layer
データは `src/db/index.ts` でDexie.jsを使用してIndexedDBに永続化（現在Version 6）：
- `workoutLogs` - トレーニングログ（日付、種目、セット情報、AI評価）
- `exerciseMasters` - 種目マスタ（自重・有酸素フラグ含む）
- `appSettings` - アプリ設定（APIキー、ユーザープロフィール）

### Type Definitions
`src/types/index.ts` にデータモデルを定義：
- `WorkoutLog` - 1日分のトレーニング記録（evaluation, evaluationGeneratedAt含む）
- `Exercise` - 種目（複数セットを持つ）
- `Set` - 重量(kg)と回数、有酸素用にduration(分)とdistance(km)
- `ExerciseMaster` - 登録済み種目（`isBodyweight`で自重、`isCardio`で有酸素を識別）

## Testing

### テスト構成
- `src/services/gemini.test.ts` - AI機能のピュア関数テスト（26件）
- `src/components/ExerciseForm.test.tsx` - フォームコンポーネントテスト（23件）
- `src/utils/graphCalculations.test.ts` - グラフ計算ロジックテスト（30件）
- `src/db/index.test.ts` - DB層CRUDテスト（30件）

### テスト環境設定
- デフォルト環境: `node`（高速）
- Reactコンポーネントテスト: `@vitest-environment jsdom` ディレクティブで個別指定
- fake-indexeddb使用でIndexedDBをモック

## CI/CD

GitHub Actionsで自動デプロイ（`.github/workflows/deploy.yml`）：
- Lint & Test並列実行（約5秒）
- ビルド + GitHub Pagesデプロイ
- 合計約29秒

## Specification

詳細な仕様は `docs/SPEC.md` を参照。
