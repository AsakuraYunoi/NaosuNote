use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub platform: String,    // "desktop" | "mobile"
    pub form_factor: String, // "desktop" | "pad" | "phone"
    pub os: String,          // "macos" | "windows" | "linux" | "android" | "ios"
    pub screen_width_dp: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notebook {
    pub id: String,
    pub name: String,
    pub subject: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub is_deleted: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Problem {
    pub uuid: String,
    pub notebook_id: Option<String>,
    pub subject: String,
    #[serde(rename = "type")]
    pub problem_type: String,
    pub date: String,
    pub summary: String,
    pub raw_html: String,
    pub stem_clean_text: String,
    pub difficulty: i32,
    pub importance: i32,
    pub tags: Option<Vec<String>>,
    pub answer_markdown: Option<String>,
    pub answer_images: Option<Vec<String>>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub is_deleted: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProblemInput {
    pub uuid: Option<String>,
    pub notebook_id: Option<String>,
    pub subject: String,
    #[serde(rename = "type")]
    pub problem_type: String,
    pub date: String,
    pub summary: String,
    pub raw_html: String,
    pub stem_clean_text: String,
    pub tags: Option<Vec<String>>,
    pub answer_markdown: Option<String>,
    pub answer_images: Option<Vec<String>>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub is_deleted: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagCount {
    pub name: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateCheckResult {
    pub is_duplicate: bool,
    pub similarity: f64,
    pub existing_problem: Option<Problem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageOption {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: String,
    pub is_recommended: bool,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub data_directory: String,
}
