use std::path::{Path, PathBuf};
use std::process::Command;

/// 探测 macOS 专属原生 WebKit 导出工具 (html2pdf)
pub fn find_html2pdf_bin() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| Path::new(".").to_path_buf());

    let candidates = [
        // 开发环境：相对于 src-tauri 或根目录
        PathBuf::from("../platforms/macos/bin/html2pdf"),
        PathBuf::from("platforms/macos/bin/html2pdf"),
        // 打包环境：macOS .app 资源目录 Contents/Resources/
        exe_dir.join("../Resources/html2pdf"),
        exe_dir.join("html2pdf"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.clone());
        }
    }

    None
}

/// 在 macOS 下利用 WebKit/PDFKit 原生导出高保真矢量 PDF
pub fn export_pdf(html_path: &Path, output_path: &Path) -> Result<(), String> {
    let bin_path = find_html2pdf_bin().ok_or_else(|| {
        "未找到 macOS 原生 PDF 导出工具 (html2pdf)。请确认项目已构建该工具。".to_string()
    })?;

    let html_str = html_path
        .to_str()
        .ok_or_else(|| "HTML 路径格式不合法".to_string())?;
    let out_str = output_path
        .to_str()
        .ok_or_else(|| "PDF 输出路径格式不合法".to_string())?;

    let output = Command::new(&bin_path)
        .args([html_str, out_str])
        .output()
        .map_err(|e| format!("执行 macOS 原生 PDF 导出工具失败: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("macOS WebKit PDF 渲染失败: {}", err.trim()));
    }

    if !output_path.exists() {
        return Err("PDF 文件生成异常：输出路径未检测到生成文件".to_string());
    }

    Ok(())
}

/// 在 macOS 下唤起系统默认浏览器或查看器打开文件
pub fn open_path(path: &str) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("无法打开文件 {}: {}", path, e))?;
    Ok(())
}
