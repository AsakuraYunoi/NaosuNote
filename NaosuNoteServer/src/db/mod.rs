pub mod user_db;
pub mod user_data_db;

use std::path::Path;
use user_db::UserDb;
use user_data_db::UserDataDb;

#[derive(Clone)]
pub struct DbManager {
    pub users: UserDb,
    pub data: UserDataDb,
}

impl DbManager {
    pub fn new<P: AsRef<Path>>(base_dir: P) -> rusqlite::Result<Self> {
        let base = base_dir.as_ref();
        let user_db_path = base.join("user.db");
        let user_data_db_path = base.join("userData.db");

        let users = UserDb::new(user_db_path.to_str().unwrap_or("user.db"))?;
        let data = UserDataDb::new(user_data_db_path.to_str().unwrap_or("userData.db"))?;

        Ok(Self { users, data })
    }
}
