#!/usr/bin/env bash

set -euo pipefail

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"

if [ -z "$staged_files" ]; then
  exit 0
fi

if printf '%s\n' "$staged_files" | grep -qx 'docs/SPEC.md'; then
  exit 0
fi

requires_spec_update=0

while IFS= read -r file; do
  case "$file" in
    src/*.test.ts|src/*.test.tsx|src/**/*.test.ts|src/**/*.test.tsx)
      ;;
    src/test/*|src/evals/*|scripts/eval-*)
      ;;
    src/*|public/*|index.html|package.json)
      requires_spec_update=1
      break
      ;;
  esac
done <<EOF
$staged_files
EOF

if [ "$requires_spec_update" -eq 0 ]; then
  exit 0
fi

cat <<'EOF'
pre-commit: docs/SPEC.md が staged されていません。

このコミットには実装変更が含まれています。仕様変更や挙動変更がある場合は
docs/SPEC.md も更新して staged してください。

意図的に SPEC 更新が不要な変更のみの場合は:
  1. 変更理由を確認する
  2. git commit --no-verify を明示的に使う
EOF

exit 1
