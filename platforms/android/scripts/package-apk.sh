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

# 模式判断与参数解析
TARGET_MODE="arm64"
USER_ARGS=()
HAS_CUSTOM_TARGET=false

for arg in "$@"; do
    case "$arg" in
        -h|--help)
            echo "NaosuNote Android 一键自动化打包脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "常用选项:"
            echo "  (默认无参数)        优先构建 arm64-v8a 独立真机包 (推荐! 体积小 ~13MB，编译速度快 4 倍)"
            echo "  --universal, --all  构建 Universal 全架构包 (体积大 ~50MB，包含 arm64/armv7/x86/x86_64)"
            echo "  --split-per-abi     按 CPU 架构切分独立 APK"
            echo "  -t, --target <T>    手动指定目标架构 (aarch64, armv7, i686, x86_64)"
            echo "  -d, --debug         构建 Debug 调试版本"
            echo "  -v, --verbose       输出详细编译日志"
            exit 0
            ;;
        --universal|--all)
            TARGET_MODE="universal"
            ;;
        --split|--split-per-abi)
            TARGET_MODE="split"
            USER_ARGS+=("--split-per-abi")
            ;;
        --target|-t)
            HAS_CUSTOM_TARGET=true
            USER_ARGS+=("$arg")
            ;;
        *)
            USER_ARGS+=("$arg")
            ;;
    esac
done

# 0. 解析版本号
VERSION="0.2.2"
if [ -f "package.json" ]; then
    DETECTED_VER=$(grep -m 1 '"version"' package.json | awk -F '"' '{print $4}')
    if [ -n "$DETECTED_VER" ]; then
        VERSION="$DETECTED_VER"
    fi
fi
echo -e "当前打包版本: ${YELLOW}v${VERSION}${NC}"
if [ "$TARGET_MODE" = "arm64" ] && [ "$HAS_CUSTOM_TARGET" = false ]; then
    echo -e "目标芯片架构: ${GREEN}arm64-v8a (真机专属瘦身版，剔除冗余模拟器架构)${NC}"
    echo -e "              └─ 提示: 若需包含全部老旧机型/模拟器的 50MB 通用包，请传参: ${CYAN}--universal${NC}"
elif [ "$TARGET_MODE" = "universal" ]; then
    echo -e "目标芯片架构: ${YELLOW}Universal (包含 arm64/armv7/x86/x86_64 全架构通用包)${NC}"
elif [ "$TARGET_MODE" = "split" ]; then
    echo -e "目标芯片架构: ${CYAN}Split per ABI (多架构独立分包)${NC}"
else
    echo -e "目标芯片架构: ${CYAN}自定义目标架构${NC}"
fi

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
CHECK_TARGETS=("aarch64-linux-android")
if [ "$TARGET_MODE" = "universal" ] || [ "$TARGET_MODE" = "split" ]; then
    CHECK_TARGETS+=("armv7-linux-androideabi" "i686-linux-android" "x86_64-linux-android")
fi

for tgt in "${CHECK_TARGETS[@]}"; do
    if ! echo "$INSTALLED_TARGETS" | grep -q "$tgt"; then
        echo -e "${YELLOW}! 正在自动安装 Rust 编译目标: ${tgt}...${NC}"
        rustup target add "$tgt" || true
    fi
done
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

JAVA_BIN=""
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_BIN="$JAVA_HOME/bin/java"
    export PATH="$JAVA_HOME/bin:$PATH"
elif command -v java >/dev/null 2>&1; then
    JAVA_BIN="$(command -v java)"
fi

if [ -z "$JAVA_BIN" ]; then
    echo -e "${RED}错误: 未检测到 Java (JDK) 运行环境，无法驱动 Gradle 打包${NC}"
    echo -e "${YELLOW}请安装 JDK 17 或 21 (例如: brew install openjdk@17) 并配置 JAVA_HOME${NC}"
    exit 1
fi

# Java 运行健康自检 (验证 JVM 能否正常启动并载入 boot class path)
if ! JAVA_TEST_OUT=$("$JAVA_BIN" -version 2>&1); then
    echo -e "${RED}错误: Java 运行时自检失败，JVM 初始化崩溃！${NC}"
    echo -e "${RED}$JAVA_TEST_OUT${NC}"
    echo -e "${YELLOW}可能原因: 当前 JDK 安装文件损坏 (如 lib/modules 丢失) 或环境变量冲突${NC}"
    echo -e "${YELLOW}解决建议: 重新安装 JDK 17/21，或设置 JAVA_HOME 指向完整可用的 JDK${NC}"
    exit 1
fi

JAVA_VER_INFO=$(echo "$JAVA_TEST_OUT" | head -n 1)
echo -e "${GREEN}✓ Java 环境就绪: ${JAVA_VER_INFO}${NC}"
if [ -n "$JAVA_HOME" ]; then
    echo -e "  └─ JAVA_HOME: ${JAVA_HOME}"
fi


# 4. 构建前端并调用 Tauri Android 打包
echo -e "\n${CYAN}>>> [4/5] 正在构建前端生产包并编译 Android APK...${NC}"
$PKG_MANAGER run build

# 清理历史旧构建 APK，避免多架构归集混淆
ANDROID_BUILD_DIR="src-tauri/gen/android/app/build/outputs/apk"
rm -rf "$ANDROID_BUILD_DIR" 2>/dev/null || true

BUILD_ARGS=("--apk")
if [ "$TARGET_MODE" = "arm64" ] && [ "$HAS_CUSTOM_TARGET" = false ]; then
    BUILD_ARGS+=("--target" "aarch64")
fi
for arg in "${USER_ARGS[@]}"; do
    BUILD_ARGS+=("$arg")
done

echo -e "正在执行: ${YELLOW}${PKG_MANAGER} run tauri android build ${BUILD_ARGS[*]}${NC}"
$PKG_MANAGER run tauri android build "${BUILD_ARGS[@]}"

# 5. 提取、签名并归集生成的 APK 至 release-portable/
echo -e "\n${CYAN}>>> [5/5] 正在提取并自动签署 APK 产物至 release-portable/...${NC}"
OUTPUT_DIR="release-portable"
mkdir -p "$OUTPUT_DIR"

APK_COUNT=0

# 查找 apksigner 签名工具
APKSIGNER_BIN=""
if command -v apksigner >/dev/null 2>&1; then
    APKSIGNER_BIN="$(command -v apksigner)"
elif [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME/build-tools" ]; then
    LATEST_BT=$(ls -1d "$ANDROID_HOME/build-tools/"*/ 2>/dev/null | sort -V | tail -n 1)
    if [ -n "$LATEST_BT" ] && [ -x "${LATEST_BT}apksigner" ]; then
        APKSIGNER_BIN="${LATEST_BT}apksigner"
    fi
fi

# 检查并准备签名密钥库 (支持自定义 Release 证书，默认使用本地 Debug 证书)
KEYSTORE_PATH=""
KEYSTORE_PASS=""
KEY_ALIAS=""

if [ -n "$ANDROID_KEYSTORE_PATH" ] && [ -f "$ANDROID_KEYSTORE_PATH" ]; then
    KEYSTORE_PATH="$ANDROID_KEYSTORE_PATH"
    KEYSTORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-}"
    KEY_ALIAS="${ANDROID_KEY_ALIAS:-}"
elif [ -f "platforms/android/release.keystore" ]; then
    KEYSTORE_PATH="platforms/android/release.keystore"
    KEYSTORE_PASS="android"
    KEY_ALIAS="androiddebugkey"
elif [ -f "$HOME/.android/debug.keystore" ]; then
    KEYSTORE_PATH="$HOME/.android/debug.keystore"
    KEYSTORE_PASS="android"
    KEY_ALIAS="androiddebugkey"
else
    mkdir -p "$HOME/.android"
    echo -e "${YELLOW}! 正在自动初始化本地签名密钥 (~/.android/debug.keystore)...${NC}"
    keytool -genkey -v -keystore "$HOME/.android/debug.keystore" \
        -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1 || true
    if [ -f "$HOME/.android/debug.keystore" ]; then
        KEYSTORE_PATH="$HOME/.android/debug.keystore"
        KEYSTORE_PASS="android"
        KEY_ALIAS="androiddebugkey"
    fi
fi

if [ -d "$ANDROID_BUILD_DIR" ]; then
    while IFS= read -r apk_path; do
        if [ -f "$apk_path" ]; then
            APK_BASENAME=$(basename "$apk_path")
            
            # 判断架构标识与命名
            ARCH_SUFFIX=""
            if [ "$TARGET_MODE" = "arm64" ]; then
                ARCH_SUFFIX="arm64"
            elif [ "$TARGET_MODE" = "universal" ]; then
                ARCH_SUFFIX="universal"
            else
                ARCH_SUFFIX=$(echo "$APK_BASENAME" | sed 's/-unsigned//g; s/_unsigned//g; s/app-//g; s/-release//g; s/_release//g; s/\.apk//g')
            fi
            
            DEST_SIGNED_NAME="NaosuNote_${VERSION}_${ARCH_SUFFIX}.apk"
            STANDARD_NAME="NaosuNote_${VERSION}.apk"

            if [[ "$APK_BASENAME" == *"unsigned"* ]]; then
                if [ -n "$APKSIGNER_BIN" ] && [ -n "$KEYSTORE_PATH" ]; then
                    echo -e "${CYAN}正在签署安装包: ${YELLOW}${APK_BASENAME}${NC} -> ${GREEN}${DEST_SIGNED_NAME}${NC}..."
                    "$APKSIGNER_BIN" sign \
                        --ks "$KEYSTORE_PATH" \
                        --ks-pass "pass:$KEYSTORE_PASS" \
                        --ks-key-alias "$KEY_ALIAS" \
                        --out "$OUTPUT_DIR/$DEST_SIGNED_NAME" \
                        "$apk_path"
                    
                    # 生成一份简明标准名字供直接拷贝
                    cp -f "$OUTPUT_DIR/$DEST_SIGNED_NAME" "$OUTPUT_DIR/$STANDARD_NAME"
                    rm -f "$OUTPUT_DIR"/*.idsig 2>/dev/null || true
                    
                    APK_SIZE=$(ls -lh "$OUTPUT_DIR/$DEST_SIGNED_NAME" | awk '{print $5}')
                    echo -e "${GREEN}✓ 签名完成并归集: $OUTPUT_DIR/$DEST_SIGNED_NAME (${APK_SIZE})${NC}"
                    if [ "$DEST_SIGNED_NAME" != "$STANDARD_NAME" ]; then
                        echo -e "  └─ 同步生成标准主安装包: $OUTPUT_DIR/$STANDARD_NAME"
                    fi
                    APK_COUNT=$((APK_COUNT + 1))
                else
                    echo -e "${YELLOW}! 警告: 未找到 apksigner 或证书，仅提取未签名包${NC}"
                    cp -f "$apk_path" "$OUTPUT_DIR/$DEST_SIGNED_NAME"
                    cp -f "$apk_path" "$OUTPUT_DIR/$STANDARD_NAME"
                    APK_COUNT=$((APK_COUNT + 1))
                fi
            else
                cp -f "$apk_path" "$OUTPUT_DIR/$DEST_SIGNED_NAME"
                cp -f "$apk_path" "$OUTPUT_DIR/$STANDARD_NAME"
                APK_SIZE=$(ls -lh "$apk_path" | awk '{print $5}')
                echo -e "${GREEN}✓ 已提取安装包: $OUTPUT_DIR/$DEST_SIGNED_NAME (${APK_SIZE})${NC}"
                APK_COUNT=$((APK_COUNT + 1))
            fi
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
    echo -e "标准主安装包:   ${YELLOW}$OUTPUT_DIR/NaosuNote_${VERSION}.apk${NC}"
    if [ "$TARGET_MODE" = "arm64" ]; then
        echo -e "真机架构包:     ${GREEN}$OUTPUT_DIR/NaosuNote_${VERSION}_arm64.apk (真机推荐，瘦身版)${NC}"
    elif [ "$TARGET_MODE" = "universal" ]; then
        echo -e "全架构通用包:   ${CYAN}$OUTPUT_DIR/NaosuNote_${VERSION}_universal.apk (全设备兼容版)${NC}"
    fi
    echo -e ""
    echo -e "【Android 安装指引】"
    echo -e " 1. 直接将 ${YELLOW}NaosuNote_${VERSION}.apk${NC} 传到手机/平板 (QQ、微信、网盘或数据线传输)；"
    echo -e " 2. 在手机文件管理中点击安装包即可直接安装运行 (已内建完整签名证书)；"
    echo -e " 3. 或连接电脑通过终端命令直装: ${CYAN}adb install -r $OUTPUT_DIR/NaosuNote_${VERSION}.apk${NC}"
    echo -e "====================================================\n"
fi
