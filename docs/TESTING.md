# Testing

`kintore` では `Vitest` に加えて、ケース定義と実行ロジックを分離した軽量 eval harness を使います。純粋関数や仕様に紐づく変換ロジックを、シナリオ単位で固定ケース評価したいときに使います。

このファイルは `check`、`verify`、eval harness の方針が変わったら更新してください。

## Commands

```bash
npm run test:run
npm run eval
npm run verify
```

## Policy

- 単体ロジックの詳細検証は既存どおり Vitest を使う
- 仕様シナリオの回帰確認は `src/evals/` にケースを追加する
- `scripts/` 側は共通 harness に `evaluateCase` と失敗表示だけを渡す
- 例外はケース単位の失敗へ集約し、先頭1件で停止しない

## Current Eval Targets

- `importParser`: Markdown エクスポート形式からの復元
- `progressCalculations`: ウェイト、自重、有酸素の進捗比較
