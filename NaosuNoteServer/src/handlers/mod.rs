pub mod auth;
pub mod images;
pub mod sync;
pub mod user;
pub mod web;

use axum::Json;
use crate::models::ApiResponse;

pub async fn health_check() -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse::success(serde_json::json!({
        "status": "ok",
        "service": "NaosuNoteServer",
        "version": "0.1.0-beta",
        "time": chrono::Utc::now().to_rfc3339()
    })))
}
