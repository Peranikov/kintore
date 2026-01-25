---
name: deploy
description: 変更をコミットしてプッシュしてください。
disable-model-invocation: true
---

# Deploy スキル

変更をコミットしてリモートにプッシュします。

## 手順

1. `git status` で変更内容を確認
2. `git diff` で差分を確認
3. 変更内容に基づいて適切なコミットメッセージを作成
4. `git add` で変更をステージング
5. `git commit` でコミット
6. `git push` でリモートにプッシュ

## ルール

- コミットメッセージは英語で、変更内容を簡潔に説明
- プッシュ前に `npm run check` が成功していることを確認
