#!/usr/bin/env bash
# NaosuNote iPadOS / iOS 一键自动化打包脚本
# 支持生成适配 iPad 平板（及 iPhone）的独立 .ipa 安装包与 .app 应用程序包
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
echo -e "${CYAN}     NaosuNote iPadOS / iOS 一键打包流水线          ${NC}"
echo -e "${CYAN}====================================================${NC}"

# 0. 版本号检测与提取
VERSION="0.2.2"
if [ -f "package.json" ]; then
    DETECTED_VER=$(grep -m 1 '"version"' package.json | awk -F '"' '{print $4}')
    if [ -n "$DETECTED_VER" ]; then
        VERSION="$DETECTED_VER"
    fi
fi
echo -e "当前打包版本: ${YELLOW}v${VERSION}${NC}"

# 1. 构建环境与依赖检查
echo -e "\n${CYAN}>>> [1/6] 正在检查打包工具链与环境依赖...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Node.js，请先安装 Node.js${NC}"; exit 1; }

PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
else
    echo -e "${RED}错误: 未检测到 pnpm 或 npm 包管理器${NC}"; exit 1;
fi

command -v cargo >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Rust/Cargo，请先安装 Rust (https://rustup.rs)${NC}"; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo -e "${RED}错误: 未检测到 Xcode 命令行工具 (xcodebuild)，请确认已安装 Xcode${NC}"; exit 1; }

# 检查 xcodegen
if ! command -v xcodegen >/dev/null 2>&1; then
    echo -e "${YELLOW}! 未检测到 xcodegen，正在尝试通过 brew 自动安装...${NC}"
    if command -v brew >/dev/null 2>&1; then
        brew install xcodegen
    else
        echo -e "${RED}错误: 未找到 xcodegen 且未安装 Homebrew，请手动安装: brew install xcodegen${NC}"
        exit 1
    fi
fi

# 检查 Rust target: aarch64-apple-ios
INSTALLED_TARGETS=$(rustup target list --installed 2>/dev/null || true)
REQUIRED_TARGET="aarch64-apple-ios"
if ! echo "$INSTALLED_TARGETS" | grep -q "$REQUIRED_TARGET"; then
    echo -e "${YELLOW}! 正在自动补全 Rust 编译目标: ${REQUIRED_TARGET}...${NC}"
    rustup target add "$REQUIRED_TARGET"
fi

# 检查 llvm-tools (用于 Xcode 27+ 符号全局化)
if ! rustup component list | grep "llvm-tools" | grep -q "installed"; then
    echo -e "${YELLOW}! 正在安装 rustup llvm-tools-preview 组件...${NC}"
    rustup component add llvm-tools-preview
fi

# 清理可能残留的 Tauri 本地调试临时文件 (防止 Xcode 误连无效 WebSocket)
rm -f /var/folders/*/*/*/*/com.naosunote.app-server-addr 2>/dev/null || true
rm -f "${TMPDIR:-/tmp}/com.naosunote.app-server-addr" 2>/dev/null || true

echo -e "${GREEN}✓ 工具链就绪: Node $(node -v), ${PKG_MANAGER}, Rust $(rustc --version | awk '{print $2}'), Xcode $(xcodebuild -version | head -n 1)${NC}"

# 2. 编译前端生产静态资源并同步 iPad 图标
echo -e "\n${CYAN}>>> [2/6] 正在构建前端生产包 (Vite) 与同步应用图标...${NC}"
$PKG_MANAGER run build

APPLE_DIR="src-tauri/gen/apple"
APPLE_ASSETS="$APPLE_DIR/assets"
mkdir -p "$APPLE_ASSETS"
rm -rf "$APPLE_ASSETS"/*
cp -R dist/* "$APPLE_ASSETS/"
echo -e "${GREEN}✓ 前端产物已同步至 $APPLE_ASSETS${NC}"

# 同步应用图标至 Assets.xcassets (覆盖默认 Tauri 图标)
ICON_APPICONSET="$APPLE_DIR/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICON_APPICONSET"
if [ ! -d "src-tauri/icons/ios" ] || [ "src-tauri/app-icon.svg" -nt "src-tauri/icons/ios/AppIcon-76x76@2x.png" ]; then
    echo -e "正在基于 app-icon.svg 刷新生成各平台高清图标..."
    $PKG_MANAGER run icon >/dev/null 2>&1 || true
fi
if [ -d "src-tauri/icons/ios" ]; then
    cp -f src-tauri/icons/ios/*.png "$ICON_APPICONSET/"
    touch "$APPLE_DIR/Assets.xcassets" "$ICON_APPICONSET/Contents.json"
    echo -e "${GREEN}✓ NaosuNote 专属 iPad 图标已注入 Assets.xcassets${NC}"
fi

# 3. 准备 Swift-rs 桥接文件与工程配置
echo -e "\n${CYAN}>>> [3/6] 准备 Swift-rs 运行时桥接与 Xcode 配置...${NC}"
SOURCES_DIR="$APPLE_DIR/Sources/naosunote"
mkdir -p "$SOURCES_DIR"

SWIFT_BRIDGE_FILE="$SOURCES_DIR/SwiftRs.swift"
rm -f "$SWIFT_BRIDGE_FILE"
cat << 'EOF' > "$SWIFT_BRIDGE_FILE"
import Foundation

public class SRArray<T>: NSObject {
    let pointer: UnsafePointer<T>
    let length: Int
    let array: [T]

    public override init() {
        self.array = []
        self.pointer = UnsafePointer(self.array)
        self.length = 0
    }

    public init(_ data: [T]) {
        self.array = data
        self.pointer = UnsafePointer(self.array)
        self.length = data.count
    }

    public func toArray() -> [T] {
        return Array(self.array)
    }
}

public class SRObjectArray: NSObject {
    let data: SRArray<NSObject>
    public init(_ data: [NSObject]) {
        self.data = SRArray(data)
    }
}

public class SRData: NSObject {
    let data: SRArray<UInt8>

    public override init() {
        self.data = SRArray()
    }

    public init(_ data: [UInt8]) {
        self.data = SRArray(data)
    }

    public init (_ srArray: SRArray<UInt8>) {
        self.data = srArray
    }

    public func toArray() -> [UInt8] {
        return self.data.toArray()
    }
}

public class SRString: SRData {
    public override init() {
        super.init([])
    }

    public init(_ string: String) {
        super.init(Array(string.utf8))
    }

    init(_ data: SRData) {
        super.init(data.data)
    }

    public func toString() -> String {
        return String(bytes: self.data.array, encoding: .utf8)!
    }
}

@_cdecl("retain_object")
public func retainObject(ptr: UnsafeMutableRawPointer) {
    let _ = Unmanaged<AnyObject>.fromOpaque(ptr).retain()
}

@_cdecl("release_object")
public func releaseObject(ptr: UnsafeMutableRawPointer) {
    let _ = Unmanaged<AnyObject>.fromOpaque(ptr).release()
}

@_cdecl("data_from_bytes")
public func dataFromBytes(data: UnsafePointer<UInt8>, size: Int) -> SRData {
    let buffer = UnsafeBufferPointer(start: data, count: size)
    return SRData(Array(buffer))
}

@_cdecl("string_from_bytes")
public func stringFromBytes(data: UnsafePointer<UInt8>, size: Int) -> SRString {
    let data = dataFromBytes(data: data, size: size)
    return SRString(data)
}
EOF

# 同步版本号到 Info.plist
INFO_PLIST="$APPLE_DIR/naosunote_iOS/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$INFO_PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$INFO_PLIST" 2>/dev/null || true
fi

# 确保 project.yml 刷新为最新结构
(cd "$APPLE_DIR" && xcodegen generate --spec project.yml >/dev/null 2>&1)
echo -e "${GREEN}✓ Xcode 工程架构与桥接定义就绪${NC}"

# 4. 编译 Rust 静态库并封装集成静态库 (启用 custom-protocol 确保内嵌离线运行)
echo -e "\n${CYAN}>>> [4/6] 正在编译 Rust 后端针对 iPad/iOS (arm64, 生产离线模式)...${NC}"
cargo rustc --manifest-path src-tauri/Cargo.toml --target aarch64-apple-ios --release --lib --crate-type staticlib --features custom-protocol

EXTERNALS_ARM64="$APPLE_DIR/Externals/arm64/release"
mkdir -p "$EXTERNALS_ARM64"

RUST_LIB="src-tauri/target/aarch64-apple-ios/release/libapp_lib.a"
# 按修改时间优先选取最新生成的依赖静态库
TAURI_LIB=$(ls -t $(find src-tauri/target/aarch64-apple-ios/release/build/ -name "libTauri.a" 2>/dev/null) 2>/dev/null | head -n 1)
LOG_LIB=$(ls -t $(find src-tauri/target/aarch64-apple-ios/release/build/ -name "libtauri-plugin-log.a" 2>/dev/null) 2>/dev/null | head -n 1)

# 如果找到 llvm-objcopy，对 libTauri 内部 symbols 进行一次全局化导出以防 Xcode 27+ 报错
LLVM_OBJCOPY=$(find "$(rustc --print sysroot)" -name "llvm-objcopy" 2>/dev/null | head -n 1 || true)
if [ -n "$LLVM_OBJCOPY" ] && [ -f "$TAURI_LIB" ]; then
    "$LLVM_OBJCOPY" \
        --globalize-symbol=_release_object \
        --globalize-symbol=_retain_object \
        --globalize-symbol=_string_from_bytes \
        "$TAURI_LIB" 2>/dev/null || true
fi

# 使用 libtool 合并 Rust 与 Tauri 依赖静态库
MERGE_LIBS=("$RUST_LIB")
[ -n "$TAURI_LIB" ] && [ -f "$TAURI_LIB" ] && MERGE_LIBS+=("$TAURI_LIB")
[ -n "$LOG_LIB" ] && [ -f "$LOG_LIB" ] && MERGE_LIBS+=("$LOG_LIB")

rm -f "$EXTERNALS_ARM64/libapp.a"
libtool -static -o "$EXTERNALS_ARM64/libapp.a" "${MERGE_LIBS[@]}" 2>/dev/null
echo -e "${GREEN}✓ Rust 核心静态库打包完成: $EXTERNALS_ARM64/libapp.a${NC}"

# 5. 驱动 Xcode 编译生成 iOS / iPad 应用 Bundle (.app)
echo -e "\n${CYAN}>>> [5/6] 正在驱动 xcodebuild 编译 iOS/iPad 原生应用...${NC}"

# 解析可选的签名参数
SIGN_ARGS=(
    "CODE_SIGNING_ALLOWED=NO"
    "CODE_SIGNING_REQUIRED=NO"
    "CODE_SIGN_IDENTITY="
)

USER_TEAM="${DEVELOPMENT_TEAM:-}"
USER_IDENTITY=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --team)
            USER_TEAM="$2"
            shift 2
            ;;
        --sign)
            USER_IDENTITY="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

if [ -n "$USER_IDENTITY" ]; then
    echo -e "使用指定证书签名: ${YELLOW}${USER_IDENTITY}${NC}"
    SIGN_ARGS=(
        "CODE_SIGNING_ALLOWED=YES"
        "CODE_SIGNING_REQUIRED=YES"
        "CODE_SIGN_IDENTITY=${USER_IDENTITY}"
    )
elif [ -n "$USER_TEAM" ]; then
    echo -e "使用开发者团队签名: ${YELLOW}${USER_TEAM}${NC}"
    SIGN_ARGS=(
        "CODE_SIGNING_ALLOWED=YES"
        "DEVELOPMENT_TEAM=${USER_TEAM}"
    )
else
    echo -e "当前模式: ${YELLOW}免证书打包 (Ad-hoc / 通用侧载安装模式)${NC}"
fi

xcodebuild \
    -project "$APPLE_DIR/naosunote.xcodeproj" \
    -scheme naosunote_iOS \
    -configuration release \
    -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    "${SIGN_ARGS[@]}" \
    clean build > /dev/null

DERIVED_DATA_APP=$(ls -td ~/Library/Developer/Xcode/DerivedData/naosunote-*/Build/Products/release-iphoneos/NaosuNote.app 2>/dev/null | head -n 1)

if [ -z "$DERIVED_DATA_APP" ] || [ ! -d "$DERIVED_DATA_APP" ]; then
    echo -e "${RED}错误: 未能定位构建出的 NaosuNote.app，请检查 xcodebuild 日志${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 原生应用编译成功: $DERIVED_DATA_APP${NC}"

# 6. 打包生成 IPA 安装文件
echo -e "\n${CYAN}>>> [6/6] 正在封装 .ipa 安装包与归集产物...${NC}"
OUTPUT_DIR="release-portable"
mkdir -p "$OUTPUT_DIR"

WORK_TMP=$(mktemp -d)
trap 'rm -rf "$WORK_TMP"' EXIT

PAYLOAD_DIR="$WORK_TMP/Payload"
mkdir -p "$PAYLOAD_DIR"

# 拷贝 APP，并移除多余的调试符号或误拷贝的静态库资源
cp -R "$DERIVED_DATA_APP" "$PAYLOAD_DIR/"
TARGET_APP="$PAYLOAD_DIR/NaosuNote.app"
rm -f "$TARGET_APP/libapp.a" 2>/dev/null || true

# 执行一次通用的 ad-hoc 签名，确保二进制文件签名表头完整有效
codesign -s - --force --deep "$TARGET_APP" 2>/dev/null || true

# 压缩为 IPA
IPA_NAME="NaosuNote_${VERSION}_iPad.ipa"
IPA_NAME_STD="NaosuNote_${VERSION}.ipa"
(cd "$WORK_TMP" && zip -q -r "$IPA_NAME" Payload)

cp -f "$WORK_TMP/$IPA_NAME" "$OUTPUT_DIR/$IPA_NAME"
cp -f "$WORK_TMP/$IPA_NAME" "$OUTPUT_DIR/$IPA_NAME_STD"

IPA_SIZE=$(ls -lh "$OUTPUT_DIR/$IPA_NAME" | awk '{print $5}')
APP_SIZE=$(du -sh "$TARGET_APP" | awk '{print $1}')

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}        🎉 iPad / iOS IPA 安装包打包成功！          ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "统一产物目录: ${CYAN}$PROJECT_ROOT/$OUTPUT_DIR${NC}"
echo -e "IPA 安装包:  ${YELLOW}$PROJECT_ROOT/$OUTPUT_DIR/$IPA_NAME${NC} (${IPA_SIZE})"
echo -e "标准安装包:  ${YELLOW}$PROJECT_ROOT/$OUTPUT_DIR/$IPA_NAME_STD${NC}"
echo -e "\n${CYAN}【iPad 安装方法指引】${NC}"
echo -e " 1. ${GREEN}TrollStore (巨魔商店)${NC}: 隔空投送(AirDrop)或QQ/网盘传到 iPad，点击直接永久免签安装；"
echo -e " 2. ${GREEN}AltStore / Sideloadly${NC}: 电脑连接 iPad，选择此 IPA 输入个人 Apple ID 免费自签安装；"
echo -e " 3. ${GREEN}爱思助手 / 快捷侧载${NC}: 连接电脑，在应用游戏页面选择“本地安装”直接导入；"
echo -e " 4. ${GREEN}Xcode 直装${NC}: 打开 Xcode -> Window -> Devices and Simulators，将 IPA 拖入 Installed Apps。"
echo -e "====================================================\n"
