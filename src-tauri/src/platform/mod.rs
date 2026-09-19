pub mod common;
pub mod macos;
pub mod windows;

use common::TempFileGuard;
use std::fs;
use std::path::Path;

/// 跨平台统一打开文件或 URL 接口
pub fn open_path(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::open_path(path)
    }

    #[cfg(target_os = "windows")]
    {
        windows::open_path(path)
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Linux 下打开路径失败: {}", e))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("当前操作系统不支持自动打开文件".to_string())
    }
}

/// 跨平台统一高保真矢量 PDF 导出接口
/// 内置 RAII 临时文件守卫，确保无论成功、返回错误还是异常 panic，均 100% 回收临时 HTML
pub fn export_html_to_pdf(
    html_content: &str,
    output_path: &Path,
    temp_dir: &Path,
) -> Result<(), String> {
    // 为避免多任务并发覆盖，使用带唯一标识的临时文件名
    let temp_file_name = format!("_temp_export_{}.html", uuid::Uuid::new_v4().simple());
    let temp_html_path = temp_dir.join(temp_file_name);

    // 写入临时 HTML
    fs::write(&temp_html_path, html_content)
        .map_err(|e| format!("写入临时排版文件失败: {}", e))?;

    // 挂载 RAII 守卫：退出当前函数作用域时自动物理删除该临时文件
    let _guard = TempFileGuard::new(temp_html_path.clone());

    #[cfg(target_os = "macos")]
    {
        macos::export_pdf(&temp_html_path, output_path)
    }

    #[cfg(target_os = "windows")]
    {
        windows::export_pdf(&temp_html_path, output_path)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("矢量 PDF 直接导出功能目前仅支持 macOS 与 Windows 系统".to_string())
    }
}
