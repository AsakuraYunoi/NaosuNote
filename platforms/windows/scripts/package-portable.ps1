# NaosuNote Windows 绿色免安装与单文件 EXE 打包脚本 (PowerShell)
# 支持在任意架构的 Windows 电脑（Intel/AMD x64、ARM64 骁龙等）上一键编译生成 x64 兼容的单文件应用
param (
    [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"

# 切换到仓库根目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir/../../.."
Set-Location $ProjectRoot

# 终端输出样式函数
function Write-Step { param([string]$Msg) Write-Host "`n>>> $Msg" -ForegroundColor Cyan }
function Write-Success { param([string]$Msg) Write-Host "✓ $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "! $Msg" -ForegroundColor Yellow }

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "    NaosuNote Windows x64 单文件/免安装打包流水线   " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. 检测宿主机环境与架构
Write-Step "[1/5] 检查构建环境与目标兼容架构..."

# 检查 Node / pnpm / cargo
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 Node.js，请先安装 Node.js (https://nodejs.org)"
    exit 1
}
if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 pnpm，请运行 npm install -g pnpm"
    exit 1
}
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 Rust/Cargo，请先安装 Rust (https://rustup.rs)"
    exit 1
}

# 识别宿主机硬件架构
$HostArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Write-Host "宿主机 Windows 架构: $HostArch" -ForegroundColor Gray
Write-Host "目标构建架构: $Target (具备通用 x64 / ARM64 模拟兼容性)" -ForegroundColor Gray

# 无论当前宿主机是 ARM64（骁龙 X Elite / Surface 等）还是 x64，自动确保安装 x86_64 编译目标
if (Get-Command "rustup" -ErrorAction SilentlyContinue) {
    $InstalledTargets = rustup target list --installed
    if ($InstalledTargets -notcontains $Target) {
        Write-Warn "当前 Rust 工具链尚未安装 $Target，正在自动安装..."
        rustup target add $Target
        Write-Success "成功添加编译目标: $Target"
    } else {
        Write-Success "Rust 编译目标 $Target 已就绪"
    }
}

# 读取 package.json 获取版本号
$Version = "0.1.0-beta"
if (Test-Path "package.json") {
    try {
        $PkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($PkgJson.version) {
            $Version = $PkgJson.version
        }
    } catch {
        # 忽略读取失败，使用默认版本号
    }
}

# 2. 构建前端生产资源
Write-Step "[2/5] 正在构建前端生产包 (Vite)..."
pnpm run build
Write-Success "前端生产包构建完成 (dist/)"

# 3. 编译后端 Rust 程序 (生成 x64 二进制)
Write-Step "[3/5] 正在编译 Windows x64 原生程序 ($Target)..."
cargo build --release --manifest-path src-tauri/Cargo.toml --target $Target

# 定位编译出的 EXE
$CandidatePaths = @(
    "src-tauri/target/$Target/release/naosunote.exe",
    "src-tauri/target/release/naosunote.exe"
)

$ReleaseExe = $null
foreach ($Path in $CandidatePaths) {
    if (Test-Path $Path) {
        $ReleaseExe = $Path
        break
    }
}

if (-not $ReleaseExe) {
    Write-Error "编译失败：未在预定路径找到 naosunote.exe"
    exit 1
}
$ExeSize = (Get-Item $ReleaseExe).Length / 1MB
Write-Success ("Rust 程序编译成功: {0} ({1:N2} MB)" -f $ReleaseExe, $ExeSize)

# 4. 生成发布包与单文件 EXE 应用
Write-Step "[4/5] 正在打包单文件 EXE 应用与绿色免安装包..."
$OutputDir = "release-portable"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# 产物 A：直接可用的单文件 EXE 应用 (Single-File Executable)
# 所有前端 UI、图标、SQLite 核心均已内嵌，双击即可直接运行
$SingleExeName = "NaosuNote_${Version}_x64.exe"
$SingleExePath = "$OutputDir/$SingleExeName"
Copy-Item -Path $ReleaseExe -Destination $SingleExePath -Force
Copy-Item -Path $ReleaseExe -Destination "$OutputDir/NaosuNote.exe" -Force
Write-Success "已生成 x64 单文件 EXE 应用: $SingleExePath"

# 产物 B：带说明与数据种子的免安装文件夹 & Zip 压缩包
$BundleDir = "$OutputDir/NaosuNote_Windows_x64"
if (Test-Path $BundleDir) {
    Remove-Item -Recurse -Force $BundleDir
}
New-Item -ItemType Directory -Path $BundleDir | Out-Null

Copy-Item $ReleaseExe "$BundleDir/NaosuNote.exe"

# 拷贝初始 data/naosu.db（若当前开发环境存在初始题目）
if (Test-Path "data/naosu.db") {
    $DataDir = "$BundleDir/data"
    New-Item -ItemType Directory -Path $DataDir | Out-Null
    Copy-Item "data/naosu.db" "$DataDir/naosu.db"
}

# 写入针对普通用户的使用指南
$ReadmeContent = @"
NaosuNote - AI 错题整理系统 (Windows x64 绿色免安装版)
版本：v$Version
==================================================

【快速启动】
直接双击运行「NaosuNote.exe」（或单文件版本的「$SingleExeName」）即可使用，无需任何安装过程。

【系统兼容性】
- 原生兼容所有 64 位 Windows 10 (20H2及以上) 与 Windows 11 电脑（包括 Intel、AMD 处理器）。
- 兼容 Windows 11 ARM64 架构设备（如高通骁龙 X Elite、Surface Pro），系统自动启用高性能模拟运行。

【数据持久化与升级保障】
- 本应用默认使用 Windows 系统的个人文档目录存储全部数据：
  %USERPROFILE%\Documents\NaosuNoteData\ (例如 C:\Users\<您的用户名>\Documents\NaosuNoteData)
- 数据库 (naosu.db)、学科 HTML 离线镜像与备份均独立存放于该目录。
- 升级体验：后续直接下载新版本的 exe 替换运行即可，您的题库与数据 100% 永久保留，绝不会因应用升级丢失。

【PDF 导出说明】
- 试卷排版页面的「直接导出 PDF 试卷」依赖系统内置的 Microsoft Edge 引擎。
- Windows 10/11 系统出厂已内置 Edge，无需额外安装任何第三方虚拟打印机或转换工具。
"@
Set-Content -Path "$BundleDir/使用说明.txt" -Value $ReadmeContent -Encoding UTF8

# 5. 压缩为发布 Zip 文件
Write-Step "[5/5] 正在打包压缩为发布 Zip 文件..."
$ZipName = "NaosuNote_${Version}_Windows_x64_Portable.zip"
$ZipPath = "$OutputDir/$ZipName"
if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
}
Compress-Archive -Path "$BundleDir/*" -DestinationPath $ZipPath
Write-Success "已生成免安装压缩包: $ZipPath"

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "             🎉 Windows 打包全部完成！              " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "产物目录: $ProjectRoot/$OutputDir" -ForegroundColor Cyan
Write-Host "【单文件 EXE】: $ProjectRoot/$OutputDir/$SingleExeName (推荐：单文件双击即用)" -ForegroundColor Yellow
Write-Host "【绿色压缩包】: $ProjectRoot/$OutputDir/$ZipName (完整免安装分发包)" -ForegroundColor Yellow
Write-Host "====================================================`n"
