# kintore

トレーニングログをローカル保存できる React + TypeScript 製の PWA です。ウェイト、自重、有酸素の記録に対応し、グラフ表示、Markdown エクスポート/インポート、Gemini を使った AI 補助機能を備えています。

詳細仕様は [docs/SPEC.md](/home/peranikov/ghq/github.com/peranikov/kintore/docs/SPEC.md) を参照してください。

## Setup

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev       # 開発サーバー
npm run test      # Vitest watch
npm run test:run  # Vitest を一回実行
npm run lint      # ESLint
npm run build     # TypeScript + Vite build
npm run check     # lint + test + build
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

どちらのエージェントでも、実装前に仕様書を確認し、変更後は `npm run check` を実行する前提です。
