use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: u16,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            code: 200,
            message: "ok".to_string(),
            data: Some(data),
        }
    }

    pub fn ok_msg(message: &str, data: T) -> Self {
        Self {
            code: 200,
            message: message.to_string(),
            data: Some(data),
        }
    }

    pub fn err(code: u16, message: &str) -> ApiResponse<()> {
        ApiResponse {
            code,
            message: message.to_string(),
            data: None,
        }
    }
}

// --- Auth Models ---

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub identifier: String,
    pub nickname: String,
    pub invite_code: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub uuid: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub identifier: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub uuid: String,
    pub identifier: String,
    pub nickname: String,
    pub avatar_url: Option<String>,
    pub quota_bytes: u64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct ProfileSummaryResponse {
    pub uuid: String,
    pub nickname: String,
    pub identifier: String,
    pub avatar_url: Option<String>,
    pub used_storage_bytes: u64,
    pub max_quota_bytes: u64,
    pub cloud_problem_count: usize,
    pub cloud_notebook_count: usize,
    pub last_sync_timestamp: i64,
}

// --- Sync Models ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncNotebook {
    pub id: String,
    pub name: String,
    pub subject: String,
    #[serde(default)]
    pub is_deleted: i32,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProblem {
    pub uuid: String,
    pub notebook_id: Option<String>,
    pub subject: String,
    #[serde(rename = "type")]
    pub problem_type: String,
    pub summary: String,
    pub raw_html: String,
    pub stem_clean_text: String,
    #[serde(default = "default_one")]
    pub difficulty: i32,
    #[serde(default = "default_one")]
    pub importance: i32,
    pub tags: Option<Vec<String>>,
    pub answer_markdown: Option<String>,
    pub answer_images: Option<Vec<String>>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub is_deleted: i32,
    #[serde(default)]
    pub updated_at: i64,
}

fn default_one() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTag {
    pub name: String,
    #[serde(default)]
    pub is_deleted: i32,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct PullRequest {
    #[serde(default)]
    pub last_sync_timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct PullResponse {
    pub server_timestamp: i64,
    pub notebooks: Vec<SyncNotebook>,
    pub problems: Vec<SyncProblem>,
    pub tags: Vec<SyncTag>,
}

#[derive(Debug, Deserialize)]
pub struct PushRequest {
    #[serde(default)]
    #[allow(dead_code)]
    pub client_timestamp: i64,
    pub notebooks: Option<Vec<SyncNotebook>>,
    pub problems: Option<Vec<SyncProblem>>,
    pub tags: Option<Vec<SyncTag>>,
}

#[derive(Debug, Serialize)]
pub struct PushResponse {
    pub applied_count: usize,
    pub applied_problems: usize,
    pub applied_notebooks: usize,
    pub applied_tags: usize,
    pub server_timestamp: i64,
}

#[derive(Debug, Deserialize)]
pub struct CheckMissingImagesRequest {
    #[serde(default)]
    pub client_image_filenames: Option<Vec<String>>,
    #[serde(default)]
    pub local_disk_filenames: Option<Vec<String>>,
    #[serde(default)]
    pub required_filenames: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct CheckMissingImagesResponse {
    pub need_upload: Vec<String>,
    pub need_download: Vec<String>,
}
