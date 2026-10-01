# NaosuNote

> **理科学科错题管理与智能排版重练系统**  
> STEM Mistake Notebook & Smart Exam Typesetting Application  
> 当前版本：`beta0.2.2` · 架构：Tauri v2 + Vue 3 + TypeScript + Rust + SQLite + KaTeX + Material Design 3

---

## 核心特性

1. **多端全形态自适应 (Desktop / Tablet / Mobile Phone)**：
   - 桌面宽屏与平板大屏：采用侧边导航导轨（Navigation Rail）、分栏视图联动与大画板演算布局；
   - 移动手机竖屏：自动流式切换为底部触控导轨、抽屉筛选浮层与轻量移动卡片流，单手触控更流畅。
2. **零预设本地优先与数据主权 (Zero-Preset Local-First)**：
   - 全新安装默认进入纯本地离线模式，无需强制登录云端；
   - 无任何内置个人隐私预设数据，默认采用中立矢量 Material 头像，用户可随时在本地自由修改个性化昵称与头像；
   - 数据 100% 留存在本地，绝无厂商锁定。
3. **多平台自适应持久化存储 (Device-Tailored Storage)**：
   - 移动端首次启动支持自主选择持久化路径（Android 专属沙盒目录、公共文档目录或自定义存储卡目录；iOS 文档与支持目录）；
   - 在系统设置面板中支持随时安全切换数据主目录并无损迁移数据。
4. **智能一页吸附排版引擎 (Auto-Fit Typesetting)**：
   - 图文左右并排（Side-by-Side）：三线表格与矢量图例自动并列，横向利用率最大化；
   - 选项自适应整列：根据选项文本长度自适应 1 列 / 2 列 / 4 列整齐横排；
   - 试卷密度压缩与分页避让：避免理科综合大题跨页断裂，促成单页完整呈现。
5. **矢量手写演算板与公式气泡编辑器**：
   - 内置无限平移与缩放的矢量手写板（`CanvasBoard`），提供铅笔、荧光笔、橡皮擦与撤销重做流；
   - 悬浮公式编辑器（`FormulaBubbleEditor`）内置数理化常用符号矩阵，支持 KaTeX 实时双向预览与一键插入光标。
6. **答题卡照片管理与订正流**：
   - 答题卡面板（`AnswerCameraPane`）支持拍照录入、本地相册上传与 Markdown 订正记录双模并存。
7. **双轨持久化与离线 HTML 单文件镜像**：
   - 结构化数据落盘至 SQLite (`naosu.db`)；
   - 自动生成单文件离线 HTML 镜像（所有样式、公式脚本与配图自动转码内联），脱离客户端使用任意现代浏览器皆可完整阅读与打印。
8. **原生高保真矢量打印与 PDF 导出**：
   - macOS 接入原生 WebKit / PDFKit 矢量渲染引擎；Windows 深度集成 Microsoft Edge Chromium 无头静默打印管道；
   - 试卷文字与公式均为真实矢量，可无限放大不失真、支持光标选中复制。

---

## 终端兼容性支持矩阵

| 平台 | 架构支持 | 交付形式 | 排版打印通道 |
| :--- | :--- | :--- | :--- |
| **Android** | ARM64 (aarch64), ARMv7, x86_64 | Universal APK / Per-ABI APK | 离线 HTML 镜像 / 系统打印服务 |
| **macOS** | Apple Silicon (arm64), Intel (x64) | DMG 安装镜像 / 独立 `.app` 包 | 原生 WebKit / PDFKit 桥接驱动 |
| **Windows** | x64 (Intel / AMD), ARM64 (骁龙 X Elite) | 绿色单文件 EXE / 便携 Zip 压缩包 | Microsoft Edge 无头静默打印管道 |
| **iOS / iPadOS** | ARM64 | 移动版 / 平板版应用工程 | WebKit 视图打印 |

---

## 快速上手与本地开发

### 环境依赖

- **Node.js** >= 18.0.0
- **包管理器**：`pnpm` >= 9.0.0（或 `npm`）
- **Rust 工具链**：`cargo` / `rustc` >= 1.77.0
- **Android 构建依赖（打包 Android 时需具备）**：Android SDK (API 35), NDK (27+), Java Runtime (JDK 17+)

### 本地启动

```bash
# 1. 安装项目依赖
pnpm install

# 2. 启动桌面端开发调试 (Vite + Tauri)
pnpm run dev
# 或直接唤起客户端
pnpm run tauri dev
```

### 质量检验与测试

```bash
# 验证前端构建与类型打包
pnpm run build

# 验证 Rust 后端语法与静态分析
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 运行 Rust 单元测试
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 跨平台打包构建指南

所有平台的编译产物均会自动归集至统一的根目录文件夹：`release-portable/`。

### 1. Android APK 打包

```bash
# 方式一：通过 npm/pnpm 统一命令调用
pnpm run package:android

# 方式二：直接执行脚本并传入自定义参数
bash platforms/android/scripts/package-apk.sh

# 可选附加参数示例：
# bash platforms/android/scripts/package-apk.sh --debug               # 生成调试包
# bash platforms/android/scripts/package-apk.sh --target aarch64      # 指定 64 位 ARM
# bash platforms/android/scripts/package-apk.sh --split-per-abi       # 按架构分包
```

### 2. macOS 镜像打包 (.dmg 与 .app)

```bash
pnpm run package:macos
# 产物输出至 release-portable/NaosuNote_0.2.2.dmg
```

### 3. Windows 单文件与免安装绿色包

```powershell
# 在 Windows PowerShell 中执行
pnpm run package:windows
# 产物输出至 release-portable/NaosuNote_0.2.2_x64.exe 与对应 Zip
```

---

## 目录结构概览

```text
├── src/                                  # 前端源码 (Vue 3 + TypeScript)
│   ├── main.ts                           # 设备形态探测与主视图自适应分流
│   ├── App.vue                           # 桌面与平板端主容器
│   ├── App_phoneOnly.vue                 # 移动手机端主容器
│   ├── components/                       # 导航导轨、画板、公式气泡、存储选择模态窗
│   ├── views/                            # 错题库、录入、打印排版、个人中心与设置
│   └── utils/                            # 试卷智能排版、KaTeX 渲染、IPC API 封装
├── src-tauri/                            # Rust 后端内核 (Tauri v2)
│   ├── src/                              # IPC 指令、SQLite 引擎、镜像生成、平台打印管道
│   └── gen/android/                      # Android Gradle 原生工程
├── platforms/                            # 平台特定构建脚本 (macOS, Windows, Android)
├── NaosuNoteServer/                      # 云端增量同步服务 (Go Gin - 可选)
├── docs/                                 # 深度设计手册与技术架构说明
└── release-portable/                     # 跨端最终分发包归集目录
```

---

## 开发者架构手册

关于各模块详细的通信时序图、SQLite 表结构定义、图文并排吸附算法与安全规约，请参阅：

👉 **[NaosuNote 架构设计与系统技术手册 (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源发布。
