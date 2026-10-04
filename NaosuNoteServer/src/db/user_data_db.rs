use crate::models::{SyncNotebook, SyncProblem, SyncTag};
use rusqlite::{params, Connection, Result};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct UserDataDb {
    conn: Arc<Mutex<Connection>>,
}

impl UserDataDb {
    pub fn new(db_path: &str) -> Result<Self> {
        if let Some(parent) = std::path::Path::new(db_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(db_path)?;
        let manager = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        manager.init_tables()?;
        Ok(manager)
    }

    pub fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 1. 同步错题表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_problems (
                uuid TEXT NOT NULL,
                user_uuid TEXT NOT NULL,
                notebook_id TEXT,
                subject TEXT NOT NULL,
                type TEXT NOT NULL,
                summary TEXT,
                raw_html TEXT NOT NULL,
                stem_clean_text TEXT NOT NULL,
                difficulty INTEGER DEFAULT 1,
                importance INTEGER DEFAULT 1,
                tags TEXT DEFAULT '[]',
                answer_markdown TEXT DEFAULT '',
                answer_images TEXT DEFAULT '[]',
                date TEXT,
                created_at TEXT,
                is_deleted INTEGER DEFAULT 0,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (uuid, user_uuid)
            );",
            [],
        )?;
        let _ = conn.execute("ALTER TABLE sync_problems ADD COLUMN date TEXT;", []);
        let _ = conn.execute("ALTER TABLE sync_problems ADD COLUMN created_at TEXT;", []);

        // 2. 同步错题本表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_notebooks (
                id TEXT NOT NULL,
                user_uuid TEXT NOT NULL,
                name TEXT NOT NULL,
                subject TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (id, user_uuid)
            );",
            [],
        )?;

        // 3. 同步标签表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_tags (
                name TEXT NOT NULL,
                user_uuid TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (name, user_uuid)
            );",
            [],
        )?;

        // 4. 图片物理文件索引与配额表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_images (
                filename TEXT NOT NULL,
                user_uuid TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (filename, user_uuid)
            );",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_problems_sync ON sync_problems(user_uuid, updated_at);",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_notebooks_sync ON sync_notebooks(user_uuid, updated_at);",
            [],
        )?;

        Ok(())
    }

    pub fn pull_data(
        &self,
        user_uuid: &str,
        last_sync_timestamp: i64,
    ) -> Result<(Vec<SyncNotebook>, Vec<SyncProblem>, Vec<SyncTag>)> {
        let conn = self.conn.lock().unwrap();

        // 1. Pull Notebooks
        let mut nb_stmt = conn.prepare(
            "SELECT id, name, subject, is_deleted, updated_at 
             FROM sync_notebooks 
             WHERE user_uuid = ?1 AND updated_at > ?2",
        )?;
        let nb_rows = nb_stmt.query_map(params![user_uuid, last_sync_timestamp], |row| {
            Ok(SyncNotebook {
                id: row.get(0)?,
                name: row.get(1)?,
                subject: row.get(2)?,
                is_deleted: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        let notebooks: Vec<SyncNotebook> = nb_rows.filter_map(|r| r.ok()).collect();

        // 2. Pull Problems
        let mut p_stmt = conn.prepare(
            "SELECT uuid, notebook_id, subject, type, summary, raw_html, stem_clean_text, 
                    difficulty, importance, tags, answer_markdown, answer_images, is_deleted, updated_at,
                    date, created_at 
             FROM sync_problems 
             WHERE user_uuid = ?1 AND updated_at > ?2",
        )?;
        let p_rows = p_stmt.query_map(params![user_uuid, last_sync_timestamp], |row| {
            let tags_str: String = row.get(9).unwrap_or_else(|_| "[]".to_string());
            let tags: Option<Vec<String>> = serde_json::from_str(&tags_str).ok();

            let imgs_str: String = row.get(11).unwrap_or_else(|_| "[]".to_string());
            let imgs: Option<Vec<String>> = serde_json::from_str(&imgs_str).ok();

            Ok(SyncProblem {
                uuid: row.get(0)?,
                notebook_id: row.get(1)?,
                subject: row.get(2)?,
                problem_type: row.get(3)?,
                summary: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                raw_html: row.get(5)?,
                stem_clean_text: row.get(6)?,
                difficulty: row.get(7)?,
                importance: row.get(8)?,
                tags,
                answer_markdown: row.get(10)?,
                answer_images: imgs,
                date: row.get(14)?,
                created_at: row.get(15)?,
                is_deleted: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?;
        let problems: Vec<SyncProblem> = p_rows.filter_map(|r| r.ok()).collect();

        // 3. Pull Tags
        let mut t_stmt = conn.prepare(
            "SELECT name, is_deleted, updated_at 
             FROM sync_tags 
             WHERE user_uuid = ?1 AND updated_at > ?2",
        )?;
        let t_rows = t_stmt.query_map(params![user_uuid, last_sync_timestamp], |row| {
            Ok(SyncTag {
                name: row.get(0)?,
                is_deleted: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;
        let tags: Vec<SyncTag> = t_rows.filter_map(|r| r.ok()).collect();

        Ok((notebooks, problems, tags))
    }

    pub fn push_data(
        &self,
        user_uuid: &str,
        notebooks: Vec<SyncNotebook>,
        problems: Vec<SyncProblem>,
        tags: Vec<SyncTag>,
    ) -> Result<(usize, usize, usize)> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let mut applied_notebooks = 0;
        let mut applied_problems = 0;
        let mut applied_tags = 0;

        let now_ms = chrono::Utc::now().timestamp_millis();

        // Upsert Notebooks with LWW
        for nb in notebooks {
            let nb_ts = std::cmp::max(nb.updated_at, now_ms);
            let affected = tx.execute(
                "INSERT INTO sync_notebooks (id, user_uuid, name, subject, is_deleted, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id, user_uuid) DO UPDATE SET
                    name = excluded.name,
                    subject = excluded.subject,
                    is_deleted = excluded.is_deleted,
                    updated_at = excluded.updated_at
                 WHERE excluded.updated_at >= sync_notebooks.updated_at;",
                params![nb.id, user_uuid, nb.name, nb.subject, nb.is_deleted, nb_ts],
            )?;
            applied_notebooks += affected;
        }

        // Upsert Problems with LWW
        for prob in problems {
            let tags_str = serde_json::to_string(&prob.tags.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());
            let imgs_str = serde_json::to_string(&prob.answer_images.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());
            let prob_ts = std::cmp::max(prob.updated_at, now_ms);

            let affected = tx.execute(
                "INSERT INTO sync_problems (
                    uuid, user_uuid, notebook_id, subject, type, summary, raw_html, stem_clean_text,
                    difficulty, importance, tags, answer_markdown, answer_images, date, created_at, is_deleted, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
                 ON CONFLICT(uuid, user_uuid) DO UPDATE SET
                    notebook_id = excluded.notebook_id,
                    subject = excluded.subject,
                    type = excluded.type,
                    summary = excluded.summary,
                    raw_html = excluded.raw_html,
                    stem_clean_text = excluded.stem_clean_text,
                    difficulty = excluded.difficulty,
                    importance = excluded.importance,
                    tags = excluded.tags,
                    answer_markdown = excluded.answer_markdown,
                    answer_images = excluded.answer_images,
                    date = COALESCE(excluded.date, sync_problems.date),
                    created_at = COALESCE(sync_problems.created_at, excluded.created_at),
                    is_deleted = excluded.is_deleted,
                    updated_at = excluded.updated_at
                 WHERE excluded.updated_at >= sync_problems.updated_at;",
                params![
                    prob.uuid,
                    user_uuid,
                    prob.notebook_id,
                    prob.subject,
                    prob.problem_type,
                    prob.summary,
                    prob.raw_html,
                    prob.stem_clean_text,
                    prob.difficulty,
                    prob.importance,
                    tags_str,
                    prob.answer_markdown.unwrap_or_default(),
                    imgs_str,
                    prob.date,
                    prob.created_at,
                    prob.is_deleted,
                    prob_ts
                ],
            )?;
            applied_problems += affected;
        }

        // Upsert Tags
        for tag in tags {
            let tag_ts = std::cmp::max(tag.updated_at, now_ms);
            let affected = tx.execute(
                "INSERT INTO sync_tags (name, user_uuid, is_deleted, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(name, user_uuid) DO UPDATE SET
                    is_deleted = excluded.is_deleted,
                    updated_at = excluded.updated_at
                 WHERE excluded.updated_at >= sync_tags.updated_at;",
                params![tag.name, user_uuid, tag.is_deleted, tag_ts],
            )?;
            applied_tags += affected;
        }

        tx.commit()?;
        Ok((applied_notebooks, applied_problems, applied_tags))
    }

    pub fn get_storage_stats(&self, user_uuid: &str) -> Result<(u64, usize, usize, i64)> {
        let conn = self.conn.lock().unwrap();

        // 1. Used image bytes
        let used_bytes: i64 = conn.query_row(
            "SELECT COALESCE(SUM(size_bytes), 0) FROM sync_images WHERE user_uuid = ?1",
            params![user_uuid],
            |r| r.get(0),
        ).unwrap_or(0);

        // 2. Problem count (non-deleted)
        let prob_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sync_problems WHERE user_uuid = ?1 AND is_deleted = 0",
            params![user_uuid],
            |r| r.get(0),
        ).unwrap_or(0);

        // 3. Notebook count (non-deleted)
        let nb_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sync_notebooks WHERE user_uuid = ?1 AND is_deleted = 0",
            params![user_uuid],
            |r| r.get(0),
        ).unwrap_or(0);

        // 4. Latest updated_at timestamp
        let latest_ts: i64 = conn.query_row(
            "SELECT COALESCE(MAX(updated_at), 0) FROM sync_problems WHERE user_uuid = ?1",
            params![user_uuid],
            |r| r.get(0),
        ).unwrap_or(0);

        // Estimate total text DB size overhead ~400 bytes per problem
        let total_bytes = (used_bytes as u64) + (prob_count as u64 * 400);

        Ok((total_bytes, prob_count as usize, nb_count as usize, latest_ts))
    }

    pub fn record_uploaded_image(&self, user_uuid: &str, filename: &str, size_bytes: u64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sync_images (filename, user_uuid, size_bytes, uploaded_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(filename, user_uuid) DO UPDATE SET
                size_bytes = excluded.size_bytes,
                uploaded_at = CURRENT_TIMESTAMP;",
            params![filename, user_uuid, size_bytes as i64],
        )?;
        Ok(())
    }

    pub fn get_user_image_names(&self, user_uuid: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT filename FROM sync_images WHERE user_uuid = ?1")?;
        let rows = stmt.query_map(params![user_uuid], |r| r.get(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn prune_unreferenced_images(
        &self,
        user_uuid: &str,
        storage_root: &std::path::Path,
    ) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();

        // 1. 获取所有未删除错题中引用的有效图片集合
        let mut stmt = conn.prepare(
            "SELECT answer_images FROM sync_problems WHERE user_uuid = ?1 AND is_deleted = 0",
        )?;
        let mut active_images = std::collections::HashSet::new();
        let rows = stmt.query_map(params![user_uuid], |row| {
            let s: String = row.get(0).unwrap_or_else(|_| "[]".to_string());
            Ok(s)
        })?;
        for r in rows.flatten() {
            if let Ok(list) = serde_json::from_str::<Vec<String>>(&r) {
                for img in list {
                    let trimmed = img.trim();
                    if !trimmed.is_empty() {
                        active_images.insert(trimmed.to_string());
                    }
                }
            }
        }

        // 2. 查询 sync_images 表中该用户的所有登记图片
        let mut stmt_imgs = conn.prepare(
            "SELECT filename FROM sync_images WHERE user_uuid = ?1",
        )?;
        let all_recorded: Vec<String> = stmt_imgs
            .query_map(params![user_uuid], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        let user_dir = storage_root.join(user_uuid);
        let user_img_dir = user_dir.join("images");
        let mut deleted_filenames = Vec::new();

        // 3. 删除 sync_images 中不再被引用的记录及物理文件
        for fname in all_recorded {
            if !active_images.contains(&fname) {
                let p1 = user_img_dir.join(&fname);
                if p1.exists() {
                    let _ = std::fs::remove_file(p1);
                }
                let p2 = user_dir.join(&fname);
                if p2.exists() && fname != "avatar.webp" {
                    let _ = std::fs::remove_file(p2);
                }
                let _ = conn.execute(
                    "DELETE FROM sync_images WHERE filename = ?1 AND user_uuid = ?2",
                    params![fname, user_uuid],
                );
                deleted_filenames.push(fname);
            }
        }

        // 4. 磁盘扫描：清理磁盘中存在但不在 active_images 的孤儿物理文件
        for dir in [&user_img_dir, &user_dir] {
            if dir.exists() {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        if let Ok(ft) = entry.file_type() {
                            if ft.is_file() {
                                if let Some(name) = entry.file_name().to_str() {
                                    if name != "avatar.webp" && !name.starts_with('.') && !active_images.contains(name) {
                                        let _ = std::fs::remove_file(entry.path());
                                        let _ = conn.execute(
                                            "DELETE FROM sync_images WHERE filename = ?1 AND user_uuid = ?2",
                                            params![name, user_uuid],
                                        );
                                        if !deleted_filenames.contains(&name.to_string()) {
                                            deleted_filenames.push(name.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(deleted_filenames)
    }
}

