use axum::{extract::State, Json};
use chrono::Utc;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::models::{ApiResponse, PullRequest, PullResponse, PushRequest, PushResponse};
use crate::AppState;

pub async fn sync_pull(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<PullRequest>,
) -> Json<ApiResponse<PullResponse>> {
    let now_ms = Utc::now().timestamp_millis();

    match state.db.data.pull_data(&auth_user.uuid, req.last_sync_timestamp) {
        Ok((notebooks, problems, tags)) => {
            Json(ApiResponse::success(PullResponse {
                server_timestamp: now_ms,
                notebooks,
                problems,
                tags,
            }))
        }
        Err(e) => {
            Json(ApiResponse {
                code: 500,
                message: format!("拉取增量数据失败: {}", e),
                data: None,
            })
        }
    }
}

pub async fn sync_push(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<PushRequest>,
) -> Json<ApiResponse<PushResponse>> {
    let now_ms = Utc::now().timestamp_millis();
    let notebooks = req.notebooks.unwrap_or_default();
    let problems = req.problems.unwrap_or_default();
    let tags = req.tags.unwrap_or_default();

    match state.db.data.push_data(&auth_user.uuid, notebooks, problems, tags) {
        Ok(applied) => {
            Json(ApiResponse::ok_msg(
                "增量更新已成功合并",
                PushResponse {
                    applied_count: applied,
                    server_timestamp: now_ms,
                },
            ))
        }
        Err(e) => {
            Json(ApiResponse {
                code: 500,
                message: format!("推送合并增量数据失败: {}", e),
                data: None,
            })
        }
    }
}
