# AGENTS.md

トレーニングログPWAアプリ。実装や修正の前に [docs/SPEC.md](/home/peranikov/ghq/github.com/peranikov/kintore/docs/SPEC.md) を確認し、関連仕様を把握してから着手すること。

## Commands

```bash
npm run dev       # 開発サーバー起動
npm run test:run  # テストを一度だけ実行
npm run check     # lint + test + build の全検証
```

## Workflow

### Standard Flow

1. 仕様確認: `docs/SPEC.md` の該当セクションを読み、変更対象の振る舞い・制約を確認する
2. 仕様差分の確認: `docs/SPEC.md` に記載されていない仕様が必要なら、実装前にユーザー確認を優先する
3. 実装計画: 変更範囲、影響箇所、追加・更新するテストを整理してから着手する
4. Test First: 先に失敗するテストを追加・更新し、期待する振る舞いを固定する
5. 実装: テストを満たす最小限の変更を入れ、必要に応じて `docs/SPEC.md` も更新する
6. 検証: 作業完了後は必ず `npm run check` を実行し、必要なら関連テストを追加で確認する
7. Commit: 検証が通った状態で変更内容を見直し、意味のある単位で commit する
8. Push: commit 後に対象ブランチへ push する

### Rules

- 機能追加、既存機能の修正、バグ修正、UI変更、データモデル変更の前に必ず上記フローを開始する
- 途中で仕様の不明点が出たら、実装を進める前に確認を取る
- テストを書ける変更は、原則として test first を崩さない
- commit と push は、ローカル検証が完了してから行う

## SPEC Focus

- 画面追加・修正: 画面構成を確認
- 入力挙動の変更: 種目入力機能、キーボード操作を確認
- データ処理や保存形式の変更: データモデル、DBスキーマを確認
- グラフ関連: グラフ機能を確認
- AI関連: AI機能を確認
- エクスポート/インポート関連: 該当セクションを確認

## Testing

- コンポーネントテストは `@vitest-environment jsdom` ディレクティブを先頭に記述する
- IndexedDB のモックには `fake-indexeddb` を使用する
