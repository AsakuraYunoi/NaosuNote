use std::fs;
use std::path::{Path, PathBuf};

/// 解析应用默认数据存储目录
/// 规则：优先使用系统个人文档目录/NaosuNoteData，Windows 环境下辅以 %USERPROFILE% 兜底
pub fn resolve_data_directory() -> PathBuf {
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
    let _ = fs::create_dir_all(data_dir);

    let dest_db = data_dir.join("naosu.db");
    if !dest_db.exists() {
        let seed_db = PathBuf::from("data").join("naosu.db");
        if seed_db.exists() {
            let _ = fs::copy(&seed_db, &dest_db);
        }
    }
}
