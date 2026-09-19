# NaosuNote

> 理科学科错题管理与智能重练排版系统 · 当前版本：v0.1.0 beta (STEM Mistake Notebook & Smart Exam Typesetting Desktop Application)

---

## 快速概览

NaosuNote 是一款基于 **Tauri v2 + Vue 3 + Rust + SQLite** 架构的高性能理科错题管理软件。其核心特色包括：

1. **结构化语义录入**：支持解析由 Gemini / 大模型生成的标准 HTML 错题格式，自动清洗文本与提取元数据。
2. **文本相似度动态查重**：内置基于 Levenshtein 编辑距离算法，在同门学科内实时检索相似题干（默认阈值 85%），支持一键升级既有错题重要程度。
3. **智能一页吸附与试卷排版引擎 (Auto-Fit)**：
   - 自动图文左右并排（三线表格 + SVG 配图，选项 + SVG 配图自动重组为左右紧凑并排）；
   - 选项按长度智能自适应 1 列 / 2 列 / 4 列整齐横排；
   - 考卷高密度压缩与单页吸附模式，有效规避理科综合大题跨页断裂。
4. **原生高保真矢量打印**：在系统默认浏览器中无缝调起原生打印流，可直接无损另存为矢量级 PDF 试卷。
5. **本地优先与双轨存储**：数据存储于本地 SQLite 数据库，同时自动同步生成单文件静态 HTML 镜像（去中心化，零厂商锁定，断网可在任意设备浏览渲染）。
6. **Material Design 3 全局深色模式**：遵循 Google M3 设计语言，无缝支持浅色模式、深色模式与跟随系统。
7. **学术规范**：界面与数据严禁包含任何 Emoji 与非必要假名符号，保证学术试卷的严谨度。

---

## 开发者技术文档

关于完整的软件架构拓扑、模块职责、核心算法与避坑指南，请查阅：

👉 **[NaosuNote 架构设计与开发者技术手册](docs/ARCHITECTURE.md)**

---

## 快速上手

### 环境依赖
- Node.js >= 18
- pnpm >= 9
- Rust >= 1.77
- Cargo

### 本地启动
```bash
# 1. 安装依赖
pnpm install

# 2. 启动桌面客户端开发环境
pnpm run tauri dev
```

### 验证与构建
```bash
# 验证前端构建
pnpm run build

# 验证后端编译
cargo check --manifest-path src-tauri/Cargo.toml

# 运行单元测试
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 许可证

MIT License
