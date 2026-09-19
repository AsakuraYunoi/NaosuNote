use std::fs;
use std::path::{Path, PathBuf};

/// RAII 临时文件守卫
/// 当离开作用域或遇到提前 return / panic 时，自动执行物理删除，杜绝临时文件泄漏。
pub struct TempFileGuard {
    path: PathBuf,
}

impl TempFileGuard {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.path.exists() {
            let _ = fs::remove_file(&self.path);
        }
    }
}
