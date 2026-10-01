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
        Self {
            server: ServerSettings {
                listen_addr: "0.0.0.0:8080".to_string(),
                public_url: "https://naosunote.yunoi.online".to_string(),
                jwt_secret: "naosu_super_secret_jwt_key_2026_xyz".to_string(),
                token_expire_days: 30,
            },
            registration: RegistrationSettings {
                require_invite: true,
                max_users: 50,
                invite_codes: vec![
                    "76EEAF913EBD689D".into(), "A741C4236CFFF85A".into(), "8655E543A52449BA".into(), "F2351587268CCA5D".into(),
                    "3243A79E28F718A7".into(), "044A75874DC9491D".into(), "BE40B57CC4720E25".into(), "C871E91161992248".into(),
                    "4BB051B367C30BFA".into(), "E8431E39FE6EE959".into(), "6651668A8544B8FD".into(), "A6B803F2E235AC63".into(),
                    "ED04AFB418BF26A2".into(), "FBE08FDB463F47A6".into(), "1364B2F6EF507EF9".into(), "9E2915E3CD3E4BAA".into(),
                    "9E39E4FC7FC2C0D5".into(), "0B06F22DEE1802E5".into(), "C07A5014A060B55F".into(), "EFF30CFC5AE5214F".into(),
                    "62327BB481427262".into(), "EE48D6F655C3EC7C".into(), "8265D2D08E3FC24A".into(), "F717DABCF78EDB61".into(),
                    "D7EB03E9B205353E".into(), "F43EAB72A8236AC6".into(), "8941292F52DEE991".into(), "CA06E11915608F29".into(),
                    "2BEC26B00EE163EA".into(), "C3554A5BA55257EB".into(), "AB4E2D5299639AFC".into(), "DF6300D72BFF680E".into(),
                    "1134CFEECCE4CE18".into(), "93B76C703F466C3A".into(), "172215665D8287CB".into(), "1365E8DC361C3D09".into(),
                    "91BAFA31F0F88CA1".into(), "8A7A26472F5A7C24".into(), "13DB039D09F8EB38".into(), "0FF9324DCCB7042E".into(),
                    "89C1EEE99092471A".into(), "91209F7329447E2A".into(), "21F68D0680136956".into(), "0BB30373A0E2F751".into(),
                    "3D8758183BDCA64D".into(), "8BAE1CF414EB5275".into(), "5D38E331E95B1FDE".into(), "DAD44A56ED59AF3B".into(),
                    "860A8780CB85664C".into(), "483A5D496FA27859".into(),
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
