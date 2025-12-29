# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

筋トレログPWAアプリ。ローカル（IndexedDB）にトレーニング記録を保存し、オフラインでも動作する。

## Development Workflow

1. 作業完了後は必ず `npm run lint && npm run build` で検証する
2. テストは `npm run test:run` で実行する
3. 機能を追加した場合は `docs/SPEC.md` および `CLAUDE.md` の更新をユーザーに提案する

## Commands

```bash
npm run dev      # 開発サーバー起動
npm run build    # TypeScriptコンパイル + 本番ビルド
npm run lint     # ESLint実行
npm run test     # テスト実行（watchモード）
npm run test:run # テスト実行（単発）
npm run preview  # 本番ビルドのプレビュー
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
データは `src/db/index.ts` でDexie.jsを使用してIndexedDBに永続化（現在Version 4）：
- `workoutLogs` - トレーニングログ（日付、種目、セット情報、AI評価）
- `exerciseMasters` - 種目マスタ（自重トレーニングフラグ含む）
- `appSettings` - アプリ設定（APIキー、ユーザープロフィール）

### Type Definitions
`src/types/index.ts` にデータモデルを定義：
- `WorkoutLog` - 1日分のトレーニング記録（evaluation, evaluationGeneratedAt含む）
- `Exercise` - 種目（複数セットを持つ）
- `Set` - 重量(kg)と回数
- `ExerciseMaster` - 登録済み種目（`isBodyweight`フラグで自重トレーニングを識別）

## Testing

### テスト構成
- `src/services/gemini.test.ts` - AI機能のピュア関数テスト（26件）
- `src/components/ExerciseForm.test.tsx` - フォームコンポーネントテスト（23件）
- `src/utils/graphCalculations.test.ts` - グラフ計算ロジックテスト（29件）
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
