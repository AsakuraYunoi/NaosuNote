use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSettings {
    pub listen_addr: String,
    pub public_url: String,
    pub jwt_secret: String,
    pub token_expire_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationSettings {
    pub require_invite: bool,
    pub max_users: usize,
    pub invite_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSettings {
    pub driver: String,
    pub local_root: String,
    pub per_user_quota_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: ServerSettings,
    pub registration: RegistrationSettings,
    pub storage: StorageSettings,
}

impl Default for AppConfig {
    fn default() -> Self {
        // 无配置文件时生成随机密钥，避免使用固定默认值
        let random_secret = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());

        Self {
            server: ServerSettings {
                listen_addr: "0.0.0.0:8234".to_string(),
                public_url: "https://naosunote.yunoi.online".to_string(),
                jwt_secret: random_secret,
                token_expire_days: 30,
            },
            registration: RegistrationSettings {
                require_invite: true,
                max_users: 50,
                invite_codes: vec![
                    "INVITE_CODE_SAMPLE_1".into(),
                    "INVITE_CODE_SAMPLE_2".into(),
                ],
            },
            storage: StorageSettings {
                driver: "local".to_string(),
                local_root: "./storage".to_string(),
                per_user_quota_bytes: 200 * 1024 * 1024, // 200MB
            },
        }
    }
}

impl AppConfig {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Self {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(cfg) = toml::from_str::<AppConfig>(&content) {
                tracing::info!("Loaded config from {:?}", path.as_ref());
                return cfg;
            }
        }
        tracing::warn!("Config file not found or invalid at {:?}, using defaults", path.as_ref());
        let default_cfg = Self::default();
        if let Ok(toml_str) = toml::to_string_pretty(&default_cfg) {
            let _ = fs::write(path, toml_str);
        }
        default_cfg
    }
}
