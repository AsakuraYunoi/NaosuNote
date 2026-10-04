use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "android")]
pub fn get_android_app_storage_dir() -> PathBuf {
    // 候选路径列表，按可靠性排序：
    // 1. 外部应用私有目录（零权限要求，Android 4.4~15 均原生支持，卸载时清除，用户可在部分文件管理器或通过电脑访问）
    // 2. 内部沙盒数据目录（100% 具备读写权限）
    let candidates = [
        "/storage/emulated/0/Android/data/com.naosunote.app/files/NaosuNoteData",
        "/storage/emulated/0/Android/data/com.naosunote.app.debug/files/NaosuNoteData",
        "/data/user/0/com.naosunote.app/files/NaosuNoteData",
        "/data/data/com.naosunote.app/files/NaosuNoteData",
        "/data/user/0/com.naosunote.app.debug/files/NaosuNoteData",
        "/data/data/com.naosunote.app.debug/files/NaosuNoteData",
    ];

    for path_str in candidates {
        let p = PathBuf::from(path_str);
        if fs::create_dir_all(&p).is_ok() {
            let test_file = p.join(".write_test");
            if fs::write(&test_file, b"ok").is_ok() {
                let _ = fs::remove_file(test_file);
                return p;
            }
        }
    }

    PathBuf::from("/storage/emulated/0/Android/data/com.naosunote.app/files/NaosuNoteData")
}

pub fn get_config_path() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let base = get_android_app_storage_dir();
        return base.join("config.json");
    }

    #[cfg(not(target_os = "android"))]
    {
        let base = dirs::config_dir()
            .or_else(dirs::data_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        base.join("NaosuNote").join("config.json")
    }
}

pub fn load_saved_data_directory() -> Option<PathBuf> {
    let config_path = get_config_path();
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(cfg) = serde_json::from_str::<crate::models::AppConfig>(&content) {
                let trimmed = cfg.data_directory.trim();
                if !trimmed.is_empty() {
                    return Some(PathBuf::from(trimmed));
                }
            }
        }
    }
    None
}

pub fn save_data_directory(path: &str) -> Result<(), String> {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let cfg = crate::models::AppConfig {
        data_directory: path.to_string(),
    };
    let json = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(&config_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// 解析应用默认数据存储目录
/// 规则：优先读取持久化配置，若无则根据设备类型解析默认文档目录
pub fn resolve_data_directory() -> PathBuf {
    if let Some(saved) = load_saved_data_directory() {
        return saved;
    }

    #[cfg(target_os = "android")]
    {
        return get_android_app_storage_dir();
    }

    #[cfg(target_os = "ios")]
    {
        if let Some(doc) = dirs::document_dir() {
            return doc.join("NaosuNoteData");
        }
        return PathBuf::from("Documents").join("NaosuNoteData");
    }

    #[allow(unused_mut)]
    let mut target_dir_opt = dirs::document_dir().map(|d| d.join("NaosuNoteData"));

    #[cfg(target_os = "windows")]
    if target_dir_opt.is_none() {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            target_dir_opt = Some(
                PathBuf::from(user_profile)
                    .join("Documents")
                    .join("NaosuNoteData"),
            );
        }
    }

    target_dir_opt.unwrap_or_else(|| PathBuf::from("data"))
}

/// 确保数据目录完备，并执行初始题库无缝平滑迁移
/// 若目标目录中尚无 naosu.db，且当前分发包/工程中存有已有题目的 data/naosu.db，自动执行一次安全复制
pub fn ensure_storage_ready(data_dir: &Path) {
    if let Err(e) = fs::create_dir_all(data_dir) {
        eprintln!("[NaosuNote] ensure_storage_ready create_dir_all failed for {:?}: {}", data_dir, e);
    }

    let dest_db = data_dir.join("naosu.db");
    if !dest_db.exists() {
        let seed_db = PathBuf::from("data").join("naosu.db");
        if seed_db.exists() {
            let _ = fs::copy(&seed_db, &dest_db);
        }
    }
}
