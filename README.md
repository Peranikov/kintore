# kintore

トレーニングログをローカル保存できる React + TypeScript 製の PWA です。ウェイト、自重、有酸素の記録に対応し、グラフ表示、Markdown エクスポート/インポート、Gemini を使った AI 補助機能を備えています。

詳細仕様は [docs/SPEC.md](/home/peranikov/ghq/github.com/peranikov/kintore/docs/SPEC.md) を参照してください。

## Setup

```bash
npm install
npm run hooks:install
npm run dev
```

`pre-commit` では、実装変更を含む staged 差分に対して `docs/SPEC.md` の staged 更新を要求します。

## Scripts

```bash
npm run dev       # 開発サーバー
npm run test      # Vitest watch
npm run test:run  # Vitest を一回実行
npm run eval      # eval harness を実行
npm run lint      # ESLint
npm run build     # TypeScript + Vite build
npm run check     # lint + test + build
npm run verify    # check + eval
```

## Main Features

- トレーニングログの作成、編集、削除
- IndexedDB へのローカル保存とオフライン利用
- 種目マスタ管理
- 月間カレンダー表示
- 種目別の進捗グラフ
- Markdown 形式でのエクスポートとインポート
- Gemini API を使ったトレーニングプラン生成と評価

## Agent Guidance

- 共通の正本は [AGENTS.md](/home/peranikov/ghq/github.com/peranikov/kintore/AGENTS.md)
- Claude Code は [CLAUDE.md](/home/peranikov/ghq/github.com/peranikov/kintore/CLAUDE.md) から `@AGENTS.md` を参照

どちらのエージェントでも、以下の開発フローを前提とします。

1. `docs/SPEC.md` で関連仕様を確認する
2. 実装前に変更範囲とテスト方針を整理する
3. 失敗するテストを先に追加してから実装する
4. 変更後に `npm run check` を実行する
5. 検証が通ったら commit し、その後 push する

## Harness Engineering

`codexapp` と同じ方針で、ケース定義と実行ロジックを分離した軽量 eval harness を追加しています。`kintore` ではまず Markdown インポートの復元ロジックと、進捗比較ロジックを評価対象にしました。

方針:

- `src/evals/` にケース群を追加する
- `scripts/` 側では共通 harness に `evaluateCase` と失敗表示だけを渡す
- 例外はケース単位の失敗へ集約し、1件目で止めない

個別実行:

```bash
npm run eval:import-parser
npm run eval:progress-calculations
```
