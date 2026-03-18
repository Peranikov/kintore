# AGENTS.md

トレーニングログPWAアプリ。実装や修正の前に [docs/SPEC.md](/home/peranikov/ghq/github.com/peranikov/kintore/docs/SPEC.md) を確認し、関連仕様を把握してから着手すること。

## Commands

```bash
npm run dev       # 開発サーバー起動
npm run test:run  # テストを一度だけ実行
npm run check     # lint + test + build の全検証
```

## Workflow

- 機能追加、既存機能の修正、バグ修正、UI変更、データモデル変更の前に `docs/SPEC.md` の該当セクションを読む
- `docs/SPEC.md` に記載されていない仕様が必要なら、実装前にユーザー確認を優先する
- 機能追加や改修を行ったら、必要に応じて `docs/SPEC.md` も更新する
- 作業完了後は必ず `npm run check` を実行する

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
