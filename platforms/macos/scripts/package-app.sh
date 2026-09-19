#!/usr/bin/env bash
# NaosuNote macOS 应用打包脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== [1/3] 构建前端生产包 ==="
pnpm run build

echo "=== [2/3] 编译 macOS 原生工具及应用 Bundle ==="
pnpm run tauri build

echo "=== [3/3] 打包完成 ==="
echo "产物位于: src-tauri/target/release/bundle/macos/ 或 dmg/"
