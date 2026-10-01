use rusqlite::{params, Connection, Result};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct UserRecord {
    pub uuid: String,
    pub identifier: String,
    pub nickname: String,
    pub password_hash: String,
    pub used_invite_code: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
}

#[derive(Clone)]
pub struct UserDb {
    conn: Arc<Mutex<Connection>>,
}

impl UserDb {
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

        // 1. 用户基本信息表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                identifier TEXT UNIQUE NOT NULL,
                nickname TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                used_invite_code TEXT,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;
        // 增量升级迁移支持已存在的表
        let _ = conn.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT;", []);

        // 2. 邀请码消费记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS used_invites (
                code TEXT PRIMARY KEY,
                user_uuid TEXT NOT NULL,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_identifier ON users(identifier);",
            [],
        )?;

        Ok(())
    }

    pub fn get_user_count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
        Ok(count as usize)
    }

    pub fn is_invite_code_used(&self, code: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM used_invites WHERE code = ?1",
            params![code],
            |r| r.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn create_user(
        &self,
        uuid: &str,
        identifier: &str,
        nickname: &str,
        password_hash: &str,
        invite_code: &str,
    ) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute(
            "INSERT INTO users (id, identifier, nickname, password_hash, used_invite_code, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP);",
            params![uuid, identifier, nickname, password_hash, invite_code],
        )?;

        tx.execute(
            "INSERT INTO used_invites (code, user_uuid, used_at) VALUES (?1, ?2, CURRENT_TIMESTAMP);",
            params![invite_code, uuid],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn get_user_by_identifier(&self, identifier: &str) -> Result<Option<UserRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, identifier, nickname, password_hash, used_invite_code, avatar_url, created_at 
             FROM users WHERE identifier = ?1",
        )?;

        let mut rows = stmt.query(params![identifier])?;
        if let Some(row) = rows.next()? {
            Ok(Some(UserRecord {
                uuid: row.get(0)?,
                identifier: row.get(1)?,
                nickname: row.get(2)?,
                password_hash: row.get(3)?,
                used_invite_code: row.get(4)?,
                avatar_url: row.get(5)?,
                created_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_user_by_uuid(&self, uuid: &str) -> Result<Option<UserRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, identifier, nickname, password_hash, used_invite_code, avatar_url, created_at 
             FROM users WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![uuid])?;
        if let Some(row) = rows.next()? {
            Ok(Some(UserRecord {
                uuid: row.get(0)?,
                identifier: row.get(1)?,
                nickname: row.get(2)?,
                password_hash: row.get(3)?,
                used_invite_code: row.get(4)?,
                avatar_url: row.get(5)?,
                created_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_nickname(&self, uuid: &str, nickname: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE users SET nickname = ?1 WHERE id = ?2",
            params![nickname, uuid],
        )?;
        Ok(())
    }

    pub fn update_avatar(&self, uuid: &str, avatar_url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE users SET avatar_url = ?1 WHERE id = ?2",
            params![avatar_url, uuid],
        )?;
        Ok(())
    }
}
