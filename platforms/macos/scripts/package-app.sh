#!/usr/bin/env bash
# NaosuNote macOS 一键自动化打包脚本
# 支持生成 .dmg 安装镜像与 .app 独立应用程序包
set -e

# 定位工程根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# 终端输出样式
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}      NaosuNote macOS 应用一键打包流水线            ${NC}"
echo -e "${CYAN}====================================================${NC}"

# 1. 环境依赖检测
echo -e "\n${CYAN}>>> [1/4] 正在检查构建环境...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Node.js，请先安装 Node.js${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 pnpm，请先运行 npm install -g pnpm${NC}"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Rust/Cargo，请先安装 Rust${NC}"; exit 1; }
echo -e "${GREEN}✓ 环境检测通过：Node $(node -v), pnpm $(pnpm -v), Rust $(rustc --version | awk '{print $2}')${NC}"

# 2. 构建前端生产包
echo -e "\n${CYAN}>>> [2/4] 正在构建前端生产包 (Vite)...${NC}"
pnpm run build

# 3. 驱动 Tauri 构建 macOS Bundle (.app 和 .dmg)
echo -e "\n${CYAN}>>> [3/4] 正在编译 Rust 后端并封装 macOS 镜像 (.dmg)...${NC}"
# 传入 "$@" 支持用户附加自定义参数，例如 --target universal-apple-darwin
pnpm run tauri build --no-sign "$@"

# 4. 汇总打包产物至 release-macos/
echo -e "\n${CYAN}>>> [4/4] 正在归集发布产物...${NC}"
OUTPUT_DIR="release-macos"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

BUNDLE_DIR="src-tauri/target/release/bundle"

# 拷贝 DMG 安装文件
DMG_FOUND=false
DMG_NAME=""
if [ -d "$BUNDLE_DIR/dmg" ]; then
    for dmg in "$BUNDLE_DIR/dmg"/*.dmg; do
        if [ -f "$dmg" ]; then
            cp "$dmg" "$OUTPUT_DIR/"
            DMG_NAME=$(basename "$dmg")
            DMG_SIZE=$(ls -lh "$dmg" | awk '{print $5}')
            echo -e "${GREEN}✓ 已提取 DMG 安装包: $OUTPUT_DIR/$DMG_NAME ($DMG_SIZE)${NC}"
            DMG_FOUND=true
        fi
    done
fi

# 拷贝 APP 应用程序文件
APP_FOUND=false
APP_NAME=""
if [ -d "$BUNDLE_DIR/macos" ]; then
    for app in "$BUNDLE_DIR/macos"/*.app; do
        if [ -d "$app" ]; then
            cp -R "$app" "$OUTPUT_DIR/"
            APP_NAME=$(basename "$app")
            echo -e "${GREEN}✓ 已提取独立 APP 程序: $OUTPUT_DIR/$APP_NAME${NC}"
            APP_FOUND=true
        fi
    done
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}             🎉 macOS 应用打包成功！                ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "产物目录: ${CYAN}$PROJECT_ROOT/$OUTPUT_DIR${NC}"
if [ "$DMG_FOUND" = true ]; then
    echo -e "分发镜像: ${YELLOW}$PROJECT_ROOT/$OUTPUT_DIR/$DMG_NAME${NC} (可直接发给用户双击安装)"
fi
if [ "$APP_FOUND" = true ]; then
    echo -e "本地程序: ${YELLOW}$PROJECT_ROOT/$OUTPUT_DIR/$APP_NAME${NC} (可直接拖入 /Applications 运行)"
fi
echo -e "====================================================\n"
