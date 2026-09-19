# NaosuNote Windows 绿色免安装打包脚本 (PowerShell)
# 运行环境：Windows 10/11，需预先安装 Node.js (pnpm) 与 Rust (MSVC)

$ErrorActionPreference = "Stop"

# 切换到仓库根目录
$ProjectRoot = Resolve-Path "$PSScriptRoot/../../.."
Set-Location $ProjectRoot

Write-Host "=== [1/4] 开始构建前端生产资源 ===" -ForegroundColor Cyan
pnpm run build

Write-Host "=== [2/4] 开始编译 Tauri Rust Windows 执行程序 ===" -ForegroundColor Cyan
cargo build --release --manifest-path src-tauri/Cargo.toml

$ReleaseExe = "src-tauri/target/release/naosunote.exe"
if (-not (Test-Path $ReleaseExe)) {
    Write-Error "未找到编译产物: $ReleaseExe"
    exit 1
}

$OutputDir = "release-portable/NaosuNote_Windows_x64"
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

Write-Host "=== [3/4] 正在组装免安装绿色版目录 ===" -ForegroundColor Cyan
Copy-Item $ReleaseExe "$OutputDir/NaosuNote.exe"

# 拷贝初始 data/naosu.db（若存在）供免安装初次分发携带
if (Test-Path "data/naosu.db") {
    $DataDir = "$OutputDir/data"
    New-Item -ItemType Directory -Path $DataDir | Out-Null
    Copy-Item "data/naosu.db" "$DataDir/naosu.db"
}

# 写入使用说明
$ReadmeContent = @"
NaosuNote - AI 错题整理系统 (Windows 绿色免安装版)
==================================================

【快速启动】
直接双击运行「NaosuNote.exe」即可开始使用，无需进行任何安装。

【数据存放与安全】
- 本应用默认使用 Windows 系统个人文档目录存储全部数据：
  %USERPROFILE%\Documents\NaosuNoteData\ (如 C:\Users\<用户名>\Documents\NaosuNoteData)
- 无论后续下载任何升级版本的 NaosuNote.exe，您的历史题库 (naosu.db)、学科 HTML 镜像与备份均完整保留。

【PDF 导出功能】
- 试卷排版页面的「直接导出 PDF 试卷」依赖系统内置的 Microsoft Edge 渲染引擎。
- Windows 10 (20H2及以上) / Windows 11 已出厂原生内置，开箱即用高保真矢量打印。
"@
Set-Content -Path "$OutputDir/使用说明.txt" -Value $ReadmeContent -Encoding UTF8

Write-Host "=== [4/4] 正在压缩为绿色发布包 Zip ===" -ForegroundColor Cyan
$ZipPath = "release-portable/NaosuNote_Windows_x64_Portable.zip"
if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
}
Compress-Archive -Path "$OutputDir/*" -DestinationPath $ZipPath

Write-Host "==================================================" -ForegroundColor Green
Write-Host "打包成功！" -ForegroundColor Green
Write-Host "绿色免安装目录: $OutputDir" -ForegroundColor Green
Write-Host "独立分发压缩包: $ZipPath" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
