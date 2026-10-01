#!/usr/bin/env bash
# NaosuNote Android 一键自动化打包脚本
# 支持生成 Universal (全架构通用) APK 与按架构切分的独立 APK
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
echo -e "${CYAN}     NaosuNote Android 应用一键打包流水线           ${NC}"
echo -e "${CYAN}====================================================${NC}"

# 0. 解析版本号
VERSION="0.2.1"
if [ -f "package.json" ]; then
    DETECTED_VER=$(grep -m 1 '"version"' package.json | awk -F '"' '{print $4}')
    if [ -n "$DETECTED_VER" ]; then
        VERSION="$DETECTED_VER"
    fi
fi
echo -e "当前打包版本: ${YELLOW}v${VERSION}${NC}"

# 1. 检测 Node 与包管理器 (优先 pnpm，回退 npm)
echo -e "\n${CYAN}>>> [1/5] 正在检查 Node 与包管理工具...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Node.js，请先安装 Node.js${NC}"; exit 1; }

PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
else
    echo -e "${RED}错误: 未检测到 pnpm 或 npm 包管理器${NC}"; exit 1;
fi
echo -e "${GREEN}✓ Node 环境就绪: $(node -v), 使用包管理器: ${PKG_MANAGER}${NC}"

# 2. 检测 Rust 与 Android 构建目标
echo -e "\n${CYAN}>>> [2/5] 正在检查 Rust 与 Android 编译目标...${NC}"
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Rust/Cargo，请先安装 Rust (https://rustup.rs)${NC}"; exit 1; }

INSTALLED_TARGETS=$(rustup target list --installed 2>/dev/null || true)
REQUIRED_TARGET="aarch64-linux-android"
if ! echo "$INSTALLED_TARGETS" | grep -q "$REQUIRED_TARGET"; then
    echo -e "${YELLOW}! 正在自动安装 Rust 编译目标: ${REQUIRED_TARGET}...${NC}"
    rustup target add "$REQUIRED_TARGET" || true
fi
echo -e "${GREEN}✓ Rust 工具链就绪: $(rustc --version | awk '{print $2}')${NC}"

# 3. 检查并补全 Android SDK / NDK 与 Java 环境
echo -e "\n${CYAN}>>> [3/5] 正在校验 Android SDK / NDK 及 Java 运行环境...${NC}"

LOCAL_PROPS="src-tauri/gen/android/local.properties"
if [ -f "$LOCAL_PROPS" ]; then
    SDK_DIR=$(grep '^sdk.dir=' "$LOCAL_PROPS" | cut -d'=' -f2-)
    NDK_DIR=$(grep '^ndk.dir=' "$LOCAL_PROPS" | cut -d'=' -f2-)
    if [ -n "$SDK_DIR" ] && [ -z "$ANDROID_HOME" ]; then
        export ANDROID_HOME="$SDK_DIR"
        export ANDROID_SDK_ROOT="$SDK_DIR"
    fi
    if [ -n "$NDK_DIR" ] && [ -z "$NDK_HOME" ]; then
        export NDK_HOME="$NDK_DIR"
    fi
fi

if [ -n "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓ ANDROID_HOME: ${ANDROID_HOME}${NC}"
else
    echo -e "${YELLOW}! 警告: 未显式设置 ANDROID_HOME，将依赖系统 PATH 或 Gradle 探测${NC}"
fi

# 探测 JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
    if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
        export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    elif [ -d "/Applications/Android Studio.app/Contents/jre/Contents/Home" ]; then
        export JAVA_HOME="/Applications/Android Studio.app/Contents/jre/Contents/Home"
    elif command -v /usr/libexec/java_home >/dev/null 2>&1; then
        DETECTED_JAVA=$(/usr/libexec/java_home 2>/dev/null || true)
        if [ -n "$DETECTED_JAVA" ]; then
            export JAVA_HOME="$DETECTED_JAVA"
        fi
    fi
fi

if [ -n "$JAVA_HOME" ]; then
    echo -e "${GREEN}✓ JAVA_HOME: ${JAVA_HOME}${NC}"
    export PATH="$JAVA_HOME/bin:$PATH"
fi

# 4. 构建前端并调用 Tauri Android 打包
echo -e "\n${CYAN}>>> [4/5] 正在构建前端生产包并编译 Android APK...${NC}"
$PKG_MANAGER run build

# 默认构建全架构通用 APK，透传命令行附带参数 (如 --debug, --target 等)
BUILD_ARGS=("--apk")
for arg in "$@"; do
    BUILD_ARGS+=("$arg")
done

echo -e "正在执行: ${YELLOW}${PKG_MANAGER} run tauri android build ${BUILD_ARGS[*]}${NC}"
$PKG_MANAGER run tauri android build "${BUILD_ARGS[@]}"

# 5. 提取并归集生成的 APK 至 release-portable/
echo -e "\n${CYAN}>>> [5/5] 正在归集 APK 产物至 release-portable/...${NC}"
OUTPUT_DIR="release-portable"
mkdir -p "$OUTPUT_DIR"

ANDROID_BUILD_DIR="src-tauri/gen/android/app/build/outputs/apk"
APK_COUNT=0

if [ -d "$ANDROID_BUILD_DIR" ]; then
    # 查找所有生成的 release 与 debug APK
    while IFS= read -r apk_path; do
        if [ -f "$apk_path" ]; then
            APK_BASENAME=$(basename "$apk_path")
            DEST_NAME="NaosuNote_${VERSION}_${APK_BASENAME}"
            
            cp -f "$apk_path" "$OUTPUT_DIR/$DEST_NAME"
            # 同时也保留一个简易名字方便脚本调用
            cp -f "$apk_path" "$OUTPUT_DIR/$APK_BASENAME"
            
            APK_SIZE=$(ls -lh "$apk_path" | awk '{print $5}')
            echo -e "${GREEN}✓ 已提取安装包: $OUTPUT_DIR/$DEST_NAME (${APK_SIZE})${NC}"
            APK_COUNT=$((APK_COUNT + 1))
        fi
    done < <(find "$ANDROID_BUILD_DIR" -type f -name "*.apk")
fi

if [ $APK_COUNT -eq 0 ]; then
    echo -e "${YELLOW}! 未在 $ANDROID_BUILD_DIR 下发现 .apk 文件，请检查 Gradle 构建日志${NC}"
else
    echo -e "\n${GREEN}====================================================${NC}"
    echo -e "${GREEN}           🎉 Android APK 打包全部完成！            ${NC}"
    echo -e "${GREEN}====================================================${NC}"
    echo -e "分发包存放目录: ${CYAN}$PROJECT_ROOT/$OUTPUT_DIR${NC}"
    echo -e "共生成并归集 ${YELLOW}${APK_COUNT}${NC} 个 APK 文件，可直接传输至 Android 手机/平板安装运行。"
    echo -e "====================================================\n"
fi
