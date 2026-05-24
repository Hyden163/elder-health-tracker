#!/usr/bin/env bash
# 打包云托管上传用的代码包（不含 node_modules 与本地数据）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/elder-health-cloudrun.zip"

cd "$ROOT"
rm -f "$OUT"
zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "data/*" \
  -x ".cursor/*" \
  -x ".vscode/*" \
  -x "artifacts/*" \
  -x "*.log" \
  -x "elder-health-cloudrun.zip" \
  -x "health-app-package.zip"

echo "已生成: $OUT"
echo "下一步: 在微信云托管控制台 → 新建版本 → 手动上传代码包 → 选择此 zip"
