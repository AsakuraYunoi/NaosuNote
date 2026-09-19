use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows 原生无窗口创建标志（彻底杜绝黑色控制台窗口闪烁）
#[allow(dead_code)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 级联探测 Windows 平台下可用的 Chromium/Edge 渲染引擎
pub fn find_windows_browser() -> Option<PathBuf> {
    // 1. 静态标准路径 (Microsoft Edge & Google Chrome)
    let fixed_candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];
    for p in &fixed_candidates {
        let path = Path::new(p);
        if path.exists() {
            return Some(path.to_path_buf());
        }
    }

    // 2. 动态环境变量检索 (%LOCALAPPDATA%, %ProgramFiles(x86)%, %ProgramFiles%)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let edge = Path::new(&local_app_data).join(r"Microsoft\Edge\Application\msedge.exe");
        if edge.exists() {
            return Some(edge);
        }
        let chrome = Path::new(&local_app_data).join(r"Google\Chrome\Application\chrome.exe");
        if chrome.exists() {
            return Some(chrome);
        }
    }

    if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
        let edge = Path::new(&pf86).join(r"Microsoft\Edge\Application\msedge.exe");
        if edge.exists() {
            return Some(edge);
        }
        let chrome = Path::new(&pf86).join(r"Google\Chrome\Application\chrome.exe");
        if chrome.exists() {
            return Some(chrome);
        }
    }

    if let Ok(pf) = std::env::var("ProgramFiles") {
        let edge = Path::new(&pf).join(r"Microsoft\Edge\Application\msedge.exe");
        if edge.exists() {
            return Some(edge);
        }
        let chrome = Path::new(&pf).join(r"Google\Chrome\Application\chrome.exe");
        if chrome.exists() {
            return Some(chrome);
        }
    }

    None
}

/// 在 Windows 下利用系统自带 Edge/Chromium 引擎无头打印高保真矢量 PDF
pub fn export_pdf(html_path: &Path, output_path: &Path) -> Result<(), String> {
    let browser_path = find_windows_browser().ok_or_else(|| {
        "未在系统中找到 Microsoft Edge 或 Chrome 浏览器渲染引擎，无法完成矢量 PDF 导出。".to_string()
    })?;

    let html_str = html_path
        .to_str()
        .ok_or_else(|| "HTML 路径格式不合法".to_string())?;
    let out_str = output_path
        .to_str()
        .ok_or_else(|| "PDF 输出路径格式不合法".to_string())?;

    let mut cmd = Command::new(&browser_path);
    cmd.args([
        "--headless=new",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        &format!("--print-to-pdf={}", out_str),
        html_str,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("调用 Windows 系统打印渲染引擎失败: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Windows PDF 渲染失败: {}", err.trim()));
    }

    if !output_path.exists() {
        return Err("PDF 文件生成异常：目标路径未检测到生成文件".to_string());
    }

    Ok(())
}

/// 在 Windows 下静默唤起默认浏览器打开指定文件（无 CMD 黑色控制台闪烁）
pub fn open_path(path: &str) -> Result<(), String> {
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", "start", "", path]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn()
        .map_err(|e| format!("无法在 Windows 下打开路径 {}: {}", path, e))?;
    Ok(())
}
