use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::fs;
use std::path::Path as StdPath;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::models::{ApiResponse, ProfileSummaryResponse};
use crate::AppState;

pub async fn profile_summary(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Json<ApiResponse<ProfileSummaryResponse>> {
    let user_record = state.db.users.get_user_by_uuid(&auth_user.uuid).ok().flatten();
    let avatar_url = user_record.and_then(|u| u.avatar_url);

    match state.db.data.get_storage_stats(&auth_user.uuid) {
        Ok((used_bytes, prob_count, nb_count, last_ts)) => {
            Json(ApiResponse::success(ProfileSummaryResponse {
                uuid: auth_user.uuid,
                nickname: auth_user.nickname,
                identifier: auth_user.identifier,
                avatar_url,
                used_storage_bytes: used_bytes,
                max_quota_bytes: state.config.storage.per_user_quota_bytes,
                cloud_problem_count: prob_count,
                cloud_notebook_count: nb_count,
                last_sync_timestamp: last_ts,
            }))
        }
        Err(e) => {
            Json(ApiResponse {
                code: 500,
                message: format!("获取个人概况统计失败: {}", e),
                data: None,
            })
        }
    }
}

pub async fn upload_avatar(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let user_dir = StdPath::new(&state.config.storage.local_root).join(&auth_user.uuid);
    if !user_dir.exists() {
        let _ = fs::create_dir_all(&user_dir);
    }

    let mut saved_bytes = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "avatar" || name == "file" || name == "image" {
            match field.bytes().await {
                Ok(bytes) => {
                    saved_bytes = Some(bytes);
                    break;
                }
                Err(e) => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(ApiResponse::<()>::err(400, &format!("读取头像流失败: {}", e))),
                    ));
                }
            }
        }
    }

    if let Some(bytes) = saved_bytes {
        let avatar_path = user_dir.join("avatar.webp");
        if let Err(e) = fs::write(&avatar_path, &bytes) {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::err(500, &format!("保存头像文件失败: {}", e))),
            ));
        }

        let avatar_url = format!("/api/user/avatar/{}", auth_user.uuid);
        if let Err(e) = state.db.users.update_avatar(&auth_user.uuid, &avatar_url) {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::err(500, &format!("更新数据库头像字段失败: {}", e))),
            ));
        }

        tracing::info!("User {} updated avatar successfully", auth_user.uuid);
        Ok(Json(ApiResponse::ok_msg("头像上传成功", avatar_url)))
    } else {
        Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::<()>::err(400, "未找到有效的头像文件 (avatar 或 file)")),
        ))
    }
}

pub async fn get_avatar(
    State(state): State<Arc<AppState>>,
    Path(user_uuid): Path<String>,
) -> Response {
    // 严格安全过滤：防止目录穿越
    let clean_uuid = match StdPath::new(&user_uuid).file_name().and_then(|f| f.to_str()) {
        Some(name) => name,
        None => return (StatusCode::BAD_REQUEST, "Invalid user_uuid").into_response(),
    };

    let avatar_path = StdPath::new(&state.config.storage.local_root)
        .join(clean_uuid)
        .join("avatar.webp");

    if !avatar_path.exists() {
        return (StatusCode::NOT_FOUND, "Avatar not found").into_response();
    }

    match fs::read(&avatar_path) {
        Ok(bytes) => (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "image/webp"),
                (header::CACHE_CONTROL, "public, max-age=86400"),
            ],
            bytes,
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read avatar: {}", e),
        )
            .into_response(),
    }
}
