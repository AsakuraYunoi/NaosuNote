use crate::models::{Notebook, Problem};
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub struct DbManager {
    db_path: String,
}

impl DbManager {
    pub fn new(db_path: &str) -> Self {
        let manager = Self {
            db_path: db_path.to_string(),
        };
        let _ = manager.init_tables();
        manager
    }

    fn get_connection(&self) -> Result<Connection> {
        if let Some(parent) = std::path::Path::new(&self.db_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        Connection::open(&self.db_path)
    }

    pub fn init_tables(&self) -> Result<()> {
        let conn = self.get_connection()?;
        
        // 1. 错题本表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS notebooks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                subject TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        // 2. 错题表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS problems (
                uuid TEXT PRIMARY KEY,
                notebook_id TEXT,
                subject TEXT NOT NULL,
                type TEXT NOT NULL,
                date TEXT NOT NULL,
                summary TEXT,
                raw_html TEXT NOT NULL,
                stem_clean_text TEXT NOT NULL,
                difficulty INTEGER DEFAULT 1,
                importance INTEGER DEFAULT 1,
                tags TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        // 容错：旧表可能没有 notebook_id 列或 tags 列，尝试添加
        let _ = conn.execute("ALTER TABLE problems ADD COLUMN notebook_id TEXT;", []);
        let _ = conn.execute("ALTER TABLE problems ADD COLUMN tags TEXT DEFAULT '[]';", []);

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_subject ON problems(subject);",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notebook ON problems(notebook_id);",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_date ON problems(date);",
            [],
        )?;

        // 确保数理化生各学科均有默认错题本，并自动自愈孤儿题目
        self.ensure_default_notebooks_with_conn(&conn)?;

        Ok(())
    }

    pub fn ensure_default_notebooks(&self) -> Result<()> {
        let conn = self.get_connection()?;
        self.ensure_default_notebooks_with_conn(&conn)
    }

    fn ensure_default_notebooks_with_conn(&self, conn: &Connection) -> Result<()> {
        let default_subjects = ["数学", "物理", "化学", "生物"];
        for sub in &default_subjects {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM notebooks WHERE subject = ?1",
                    params![sub],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            if count == 0 {
                let nb_id = Uuid::new_v4().to_string();
                let nb_name = format!("{}错题本", sub);
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO notebooks (id, name, subject) VALUES (?1, ?2, ?3)",
                    params![nb_id, nb_name, sub],
                );
            }
        }

        // 自动自愈孤儿错题：将 notebook_id 为空或无效的错题，自动绑定到该学科最早创建的错题本中
        let _ = conn.execute(
            "UPDATE problems 
             SET notebook_id = (
                 SELECT id FROM notebooks 
                 WHERE notebooks.subject = problems.subject 
                 ORDER BY created_at ASC LIMIT 1
             )
             WHERE (notebook_id IS NULL OR notebook_id = '' OR notebook_id NOT IN (SELECT id FROM notebooks))
               AND EXISTS (SELECT 1 FROM notebooks WHERE notebooks.subject = problems.subject);",
            [],
        );

        Ok(())
    }

    // --- 错题本管理 ---

    pub fn get_notebooks(&self) -> Result<Vec<Notebook>> {
        let _ = self.ensure_default_notebooks();
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, subject, created_at FROM notebooks ORDER BY created_at ASC",
        )?;
        let iter = stmt.query_map([], |row| {
            Ok(Notebook {
                id: row.get(0)?,
                name: row.get(1)?,
                subject: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn create_notebook(&self, name: &str, subject: &str) -> Result<Notebook> {
        let conn = self.get_connection()?;
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO notebooks (id, name, subject) VALUES (?1, ?2, ?3)",
            params![id, name, subject],
        )?;

        Ok(Notebook {
            id,
            name: name.to_string(),
            subject: subject.to_string(),
            created_at: None,
        })
    }

    pub fn rename_notebook(&self, id: &str, new_name: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "UPDATE notebooks SET name = ?1 WHERE id = ?2",
            params![new_name, id],
        )?;
        Ok(())
    }

    pub fn delete_notebook(&self, id: &str) -> Result<()> {
        let conn = self.get_connection()?;
        // 删除错题本，并将关联错题置空或者删除
        conn.execute("DELETE FROM problems WHERE notebook_id = ?1", params![id])?;
        conn.execute("DELETE FROM notebooks WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_notebook_by_id(&self, id: &str) -> Result<Option<Notebook>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("SELECT id, name, subject, created_at FROM notebooks WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Notebook {
                id: row.get(0)?,
                name: row.get(1)?,
                subject: row.get(2)?,
                created_at: row.get(3)?,
            }))
        } else {
            Ok(None)
        }
    }

    // --- 错题管理 ---

    pub fn get_all_problems(
        &self,
        notebook_id: Option<String>,
        subject: Option<String>,
        problem_type: Option<String>,
        tags: Option<Vec<String>>,
        search: Option<String>,
        sort_by: Option<String>,
    ) -> Result<Vec<Problem>> {
        let conn = self.get_connection()?;
        let mut query = "SELECT uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags, created_at, updated_at FROM problems WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(nid) = notebook_id {
            if !nid.is_empty() && nid != "all" {
                query.push_str(" AND notebook_id = ?");
                params_vec.push(Box::new(nid));
            }
        }

        if let Some(sub) = subject {
            if !sub.is_empty() && sub != "全部" {
                query.push_str(" AND subject = ?");
                params_vec.push(Box::new(sub));
            }
        }

        if let Some(ptype) = problem_type {
            if !ptype.is_empty() && ptype != "全部" {
                query.push_str(" AND type = ?");
                params_vec.push(Box::new(ptype));
            }
        }

        // Tag 多选交集 (AND)
        if let Some(tag_list) = tags {
            for tag in tag_list {
                let trimmed = tag.trim().to_string();
                if !trimmed.is_empty() {
                    query.push_str(" AND tags LIKE ?");
                    params_vec.push(Box::new(format!("%\"{}\"%", trimmed)));
                }
            }
        }

        // 多字段模糊联合搜索 (题干 / 摘要 / 标签 / 科目)
        if let Some(kw) = search {
            let kw = kw.trim();
            if !kw.is_empty() {
                for token in kw.split_whitespace() {
                    if !token.is_empty() {
                        query.push_str(" AND (summary LIKE ? OR stem_clean_text LIKE ? OR subject LIKE ? OR tags LIKE ?)");
                        let pattern = format!("%{}%", token);
                        params_vec.push(Box::new(pattern.clone()));
                        params_vec.push(Box::new(pattern.clone()));
                        params_vec.push(Box::new(pattern.clone()));
                        params_vec.push(Box::new(pattern));
                    }
                }
            }
        }

        let order_clause = match sort_by.as_deref() {
            Some("difficulty_desc") => " ORDER BY difficulty DESC, importance DESC, date DESC, created_at DESC",
            Some("difficulty_asc") => " ORDER BY difficulty ASC, importance DESC, date DESC, created_at DESC",
            Some("importance_desc") => " ORDER BY importance DESC, difficulty DESC, date DESC, created_at DESC",
            Some("date_asc") => " ORDER BY date ASC, created_at ASC",
            _ => " ORDER BY date DESC, created_at DESC",
        };
        query.push_str(order_clause);

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let problem_iter = stmt.query_map(param_refs.as_slice(), |row| {
            let tags_json: Option<String> = row.get(10)?;
            let tags_vec = tags_json.and_then(|s| serde_json::from_str(&s).ok());
            Ok(Problem {
                uuid: row.get(0)?,
                notebook_id: row.get(1)?,
                subject: row.get(2)?,
                problem_type: row.get(3)?,
                date: row.get(4)?,
                summary: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                raw_html: row.get(6)?,
                stem_clean_text: row.get(7)?,
                difficulty: row.get(8)?,
                importance: row.get(9)?,
                tags: tags_vec,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        let mut problems = Vec::new();
        for p in problem_iter {
            problems.push(p?);
        }
        Ok(problems)
    }

    pub fn get_problem_by_uuid(&self, uuid: &str) -> Result<Option<Problem>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags, created_at, updated_at FROM problems WHERE uuid = ?1",
        )?;
        let mut rows = stmt.query(params![uuid])?;
        if let Some(row) = rows.next()? {
            let tags_json: Option<String> = row.get(10)?;
            let tags_vec = tags_json.and_then(|s| serde_json::from_str(&s).ok());
            Ok(Some(Problem {
                uuid: row.get(0)?,
                notebook_id: row.get(1)?,
                subject: row.get(2)?,
                problem_type: row.get(3)?,
                date: row.get(4)?,
                summary: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                raw_html: row.get(6)?,
                stem_clean_text: row.get(7)?,
                difficulty: row.get(8)?,
                importance: row.get(9)?,
                tags: tags_vec,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn insert_problem(&self, problem: &Problem) -> Result<()> {
        let conn = self.get_connection()?;
        let tags_json = serde_json::to_string(&problem.tags.clone().unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO problems (uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(uuid) DO UPDATE SET
                notebook_id = excluded.notebook_id,
                subject = excluded.subject,
                type = excluded.type,
                date = excluded.date,
                summary = excluded.summary,
                raw_html = excluded.raw_html,
                stem_clean_text = excluded.stem_clean_text,
                tags = excluded.tags,
                updated_at = CURRENT_TIMESTAMP;",
            params![
                problem.uuid,
                problem.notebook_id,
                problem.subject,
                problem.problem_type,
                problem.date,
                problem.summary,
                problem.raw_html,
                problem.stem_clean_text,
                problem.difficulty,
                problem.importance,
                tags_json
            ],
        )?;
        Ok(())
    }

    pub fn update_ratings(
        &self,
        uuid: &str,
        difficulty: Option<i32>,
        importance: Option<i32>,
    ) -> Result<()> {
        let conn = self.get_connection()?;
        if let Some(d) = difficulty {
            conn.execute(
                "UPDATE problems SET difficulty = ?1, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?2",
                params![d.clamp(1, 5), uuid],
            )?;
        }
        if let Some(i) = importance {
            conn.execute(
                "UPDATE problems SET importance = ?1, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?2",
                params![i.clamp(1, 5), uuid],
            )?;
        }
        Ok(())
    }

    pub fn increment_importance(&self, uuid: &str) -> Result<i32> {
        let conn = self.get_connection()?;
        let current_importance: i32 = conn.query_row(
            "SELECT importance FROM problems WHERE uuid = ?1",
            params![uuid],
            |row| row.get(0),
        ).unwrap_or(1);

        let new_importance = (current_importance + 1).min(5);
        conn.execute(
            "UPDATE problems SET importance = ?1, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?2",
            params![new_importance, uuid],
        )?;
        Ok(new_importance)
    }

    pub fn update_problem_tags(&self, uuid: &str, tags: &[String]) -> Result<()> {
        let conn = self.get_connection()?;
        let tags_json = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE problems SET tags = ?1, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?2",
            params![tags_json, uuid],
        )?;
        Ok(())
    }

    pub fn get_tags_by_scope(
        &self,
        subject: Option<&str>,
        notebook_id: Option<&str>,
    ) -> Result<Vec<crate::models::TagCount>> {
        let conn = self.get_connection()?;
        let mut query = "SELECT tags FROM problems WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(sub) = subject {
            if !sub.is_empty() && sub != "全部" {
                query.push_str(" AND subject = ?");
                params_vec.push(Box::new(sub.to_string()));
            }
        }

        if let Some(nid) = notebook_id {
            if !nid.is_empty() && nid != "all" {
                query.push_str(" AND notebook_id = ?");
                params_vec.push(Box::new(nid.to_string()));
            }
        }

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let json_str: Option<String> = row.get(0)?;
            Ok(json_str)
        })?;

        use std::collections::HashMap;
        let mut counts: HashMap<String, usize> = HashMap::new();
        for r in rows {
            if let Ok(Some(json_str)) = r {
                if let Ok(tags) = serde_json::from_str::<Vec<String>>(&json_str) {
                    for tag in tags {
                        let trimmed = tag.trim().to_string();
                        if !trimmed.is_empty() {
                            *counts.entry(trimmed).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        let mut result: Vec<crate::models::TagCount> = counts
            .into_iter()
            .map(|(name, count)| crate::models::TagCount { name, count })
            .collect();
        result.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));

        Ok(result)
    }

    pub fn delete_problem(&self, uuid: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute("DELETE FROM problems WHERE uuid = ?1", params![uuid])?;
        Ok(())
    }

    pub fn get_problems_by_notebook(&self, notebook_id: &str) -> Result<Vec<Problem>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags, created_at, updated_at 
             FROM problems WHERE notebook_id = ?1 ORDER BY date DESC, created_at DESC",
        )?;
        let iter = stmt.query_map(params![notebook_id], |row| {
            let tags_json: Option<String> = row.get(10)?;
            let tags_vec = tags_json.and_then(|s| serde_json::from_str(&s).ok());
            Ok(Problem {
                uuid: row.get(0)?,
                notebook_id: row.get(1)?,
                subject: row.get(2)?,
                problem_type: row.get(3)?,
                date: row.get(4)?,
                summary: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                raw_html: row.get(6)?,
                stem_clean_text: row.get(7)?,
                difficulty: row.get(8)?,
                importance: row.get(9)?,
                tags: tags_vec,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        let mut list = Vec::new();
        for p in iter {
            list.push(p?);
        }
        Ok(list)
    }

    // --- 批量操作支持 ---

    pub fn batch_move_problems(
        &self,
        uuids: &[String],
        target_notebook_id: &str,
        new_subject: &str,
    ) -> Result<usize> {
        if uuids.is_empty() {
            return Ok(0);
        }
        let mut conn = self.get_connection()?;
        let tx = conn.transaction()?;
        let mut updated = 0;
        for uuid in uuids {
            let n = tx.execute(
                "UPDATE problems SET notebook_id = ?1, subject = ?2, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?3",
                params![target_notebook_id, new_subject, uuid],
            )?;
            updated += n;
        }
        tx.commit()?;
        Ok(updated)
    }

    pub fn batch_copy_problems(
        &self,
        uuids: &[String],
        target_notebook_id: &str,
        target_subject: &str,
    ) -> Result<Vec<Problem>> {
        if uuids.is_empty() {
            return Ok(Vec::new());
        }
        let mut conn = self.get_connection()?;
        let tx = conn.transaction()?;
        let mut copied = Vec::new();
        for old_uuid in uuids {
            let p_opt: Option<Problem> = {
                let mut stmt = tx.prepare(
                    "SELECT uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags, created_at, updated_at 
                     FROM problems WHERE uuid = ?1",
                )?;
                let mut rows = stmt.query_map(params![old_uuid], |row| {
                    let tags_json: Option<String> = row.get(10)?;
                    let tags_vec = tags_json.and_then(|s| serde_json::from_str(&s).ok());
                    Ok(Problem {
                        uuid: row.get(0)?,
                        notebook_id: row.get(1)?,
                        subject: row.get(2)?,
                        problem_type: row.get(3)?,
                        date: row.get(4)?,
                        summary: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                        raw_html: row.get(6)?,
                        stem_clean_text: row.get(7)?,
                        difficulty: row.get(8)?,
                        importance: row.get(9)?,
                        tags: tags_vec,
                        created_at: row.get(11)?,
                        updated_at: row.get(12)?,
                    })
                })?;
                if let Some(r) = rows.next() {
                    Some(r?)
                } else {
                    None
                }
            };

            if let Some(mut p) = p_opt {
                let new_uuid = Uuid::new_v4().to_string();
                p.uuid = new_uuid.clone();
                p.notebook_id = Some(target_notebook_id.to_string());
                p.subject = target_subject.to_string();
                let tags_json = serde_json::to_string(&p.tags.clone().unwrap_or_default())
                    .unwrap_or_else(|_| "[]".to_string());
                tx.execute(
                    "INSERT INTO problems (uuid, notebook_id, subject, type, date, summary, raw_html, stem_clean_text, difficulty, importance, tags)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        p.uuid,
                        p.notebook_id,
                        p.subject,
                        p.problem_type,
                        p.date,
                        p.summary,
                        p.raw_html,
                        p.stem_clean_text,
                        p.difficulty,
                        p.importance,
                        tags_json,
                    ],
                )?;
                copied.push(p);
            }
        }
        tx.commit()?;
        Ok(copied)
    }

    pub fn batch_delete_problems(&self, uuids: &[String]) -> Result<usize> {
        if uuids.is_empty() {
            return Ok(0);
        }
        let mut conn = self.get_connection()?;
        let tx = conn.transaction()?;
        let mut count = 0;
        for uuid in uuids {
            count += tx.execute("DELETE FROM problems WHERE uuid = ?1", params![uuid])?;
        }
        tx.commit()?;
        Ok(count)
    }

    pub fn batch_add_tag_to_problems(&self, uuids: &[String], tag: &str) -> Result<usize> {
        let trimmed = tag.trim();
        if uuids.is_empty() || trimmed.is_empty() {
            return Ok(0);
        }
        let mut conn = self.get_connection()?;
        let tx = conn.transaction()?;
        let mut updated = 0;
        for uuid in uuids {
            let tags_json: Option<String> = tx
                .query_row(
                    "SELECT tags FROM problems WHERE uuid = ?1",
                    params![uuid],
                    |r| r.get(0),
                )
                .ok();
            let mut tags: Vec<String> = tags_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            if !tags.iter().any(|t| t == trimmed) {
                tags.push(trimmed.to_string());
                let new_tags_json =
                    serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
                let n = tx.execute(
                    "UPDATE problems SET tags = ?1, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?2",
                    params![new_tags_json, uuid],
                )?;
                updated += n;
            }
        }
        tx.commit()?;
        Ok(updated)
    }
}
