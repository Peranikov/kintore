# CLAUDE.md

トレーニングログPWAアプリ。詳細仕様は @docs/SPEC.md を参照。

## Commands

```bash
npm run check     # 全検証（lint + test + build）★作業後に必ず実行
npm run dev       # 開発サーバー起動
npm run test:run  # 単一テスト実行時に使用
```

## Workflow

- 作業完了後は `npm run check` で全検証
- 機能を追加した場合は `/update-spec` でSPEC.mdを更新

## Testing

- コンポーネントテストは `@vitest-environment jsdom` ディレクティブを先頭に記述
- IndexedDBのモックには `fake-indexeddb` を使用
