# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

筋トレログPWAアプリ。ローカル（IndexedDB）にトレーニング記録を保存し、オフラインでも動作する。

## Development Workflow

1. 開発を始める前に `TODO.md` を確認し、現在のタスク状況を把握する
2. 新しいタスクに着手する際は `TODO.md` を更新してからコードを書く
3. タスク完了時は `TODO.md` のチェックボックスを更新する
4. バグや改善点を発見したら `TODO.md` に追記する
5. 作業完了後は必ず `npm run lint && npm run build` で検証する

## Commands

```bash
npm run dev      # 開発サーバー起動
npm run build    # TypeScriptコンパイル + 本番ビルド
npm run lint     # ESLint実行
npm run preview  # 本番ビルドのプレビュー
```

## Architecture

### Tech Stack
- React 19 + TypeScript
- Tailwind CSS v4 (@tailwindcss/vite)
- Vite 7
- Dexie.js (IndexedDB wrapper)
- vite-plugin-pwa (Service Worker)

### Data Layer
データは `src/db/index.ts` でDexie.jsを使用してIndexedDBに永続化：
- `workoutLogs` - トレーニングログ（日付、種目、セット情報）
- `exerciseMasters` - 種目マスタ

### Type Definitions
`src/types/index.ts` にデータモデルを定義：
- `WorkoutLog` - 1日分のトレーニング記録
- `Exercise` - 種目（複数セットを持つ）
- `Set` - 重量(kg)と回数
- `ExerciseMaster` - 登録済み種目

## Specification

詳細な仕様は `docs/SPEC.md` を参照。
