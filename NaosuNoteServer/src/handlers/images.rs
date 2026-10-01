use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::fs;
use std::path::{Path as StdPath, PathBuf};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::models::{ApiResponse, CheckMissingImagesRequest, CheckMissingImagesResponse};
use crate::AppState;

pub async fn check_missing_images(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CheckMissingImagesRequest>,
) -> Json<ApiResponse<CheckMissingImagesResponse>> {
    let server_images = match state.db.data.get_user_image_names(&auth_user.uuid) {
        Ok(imgs) => imgs,
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("查询服务器图片列表失败: {}", e),
                data: None,
            });
        }
    };

    let user_img_dir = StdPath::new(&state.config.storage.local_root)
        .join(&auth_user.uuid)
        .join("images");

    // 过滤服务端磁盘实际存在的文件
    let server_set: std::collections::HashSet<String> = server_images
        .into_iter()
        .filter(|img| user_img_dir.join(img).exists())
        .collect();

    let (need_upload, need_download) = if req.local_disk_filenames.is_some() || req.required_filenames.is_some() {
        let local_disk = req.local_disk_filenames.unwrap_or_default();
        let required = req.required_filenames.unwrap_or_default();
        let local_set: std::collections::HashSet<String> = local_disk.into_iter().collect();
        let required_set: std::collections::HashSet<String> = required.into_iter().collect();

        // 客户端存在但服务端缺失：需上传
        let mut upload = Vec::new();
        for l_img in &local_set {
            if !server_set.contains(l_img) {
                upload.push(l_img.clone());
            }
        }

        // 服务端存在但客户端缺失：需下载
        let mut download = Vec::new();
        for r_img in &required_set {
            if server_set.contains(r_img) && !local_set.contains(r_img) {
                download.push(r_img.clone());
            }
        }
        (upload, download)
    } else {
        // 兼容旧字段
        let client_images = req.client_image_filenames.unwrap_or_default();
        let client_set: std::collections::HashSet<String> = client_images.into_iter().collect();

        let mut need_upload = Vec::new();
        for c_img in &client_set {
            if !server_set.contains(c_img) {
                need_upload.push(c_img.clone());
            }
        }

        let mut need_download = Vec::new();
        for s_img in &server_set {
            if !client_set.contains(s_img) {
                need_download.push(s_img.clone());
            }
        }
        (need_upload, need_download)
    };

    Json(ApiResponse::success(CheckMissingImagesResponse {
        need_upload,
        need_download,
    }))
}

pub async fn upload_image(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut uploaded_filename = None;

    let user_img_dir = StdPath::new(&state.config.storage.local_root)
        .join(&auth_user.uuid)
        .join("images");

    if !user_img_dir.exists() {
        let _ = fs::create_dir_all(&user_img_dir);
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        let file_name = field
            .file_name()
            .map(|f| f.to_string())
            .unwrap_or_else(|| format!("{}.webp", uuid::Uuid::new_v4()));

        // 防御路径穿越漏洞 (Directory Traversal Attack)
        let clean_filename = StdPath::new(&file_name)
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or(&file_name)
            .to_string();

        if name == "file" || name == "image" {
            let data = match field.bytes().await {
                Ok(bytes) => bytes,
                Err(e) => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(ApiResponse::<()>::err(400, &format!("读取上传图片流失败: {}", e))),
                    ));
                }
            };

            let file_size = data.len() as u64;

            // 配额校验 (Quota Check)
            if let Ok((used_bytes, _, _, _)) = state.db.data.get_storage_stats(&auth_user.uuid) {
                if used_bytes + file_size > state.config.storage.per_user_quota_bytes {
                    return Err((
                        StatusCode::PAYLOAD_TOO_LARGE,
                        Json(ApiResponse::<()>::err(
                            413,
                            &format!(
                                "云端存储空间不足 (配额限制: {} MB)，请清理旧错题或升级配额",
                                state.config.storage.per_user_quota_bytes / (1024 * 1024)
                            ),
                        )),
                    ));
                }
            }

            let target_path: PathBuf = user_img_dir.join(&clean_filename);
            if let Err(e) = fs::write(&target_path, &data) {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::<()>::err(500, &format!("写入磁盘失败: {}", e))),
                ));
            }

            let _ = state.db.data.record_uploaded_image(&auth_user.uuid, &clean_filename, file_size);
            uploaded_filename = Some(clean_filename);
            break;
        }
    }

    if let Some(filename) = uploaded_filename {
        Ok(Json(ApiResponse::ok_msg("图片上传成功", filename)))
    } else {
        Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::<()>::err(400, "未找到有效的图片文件字段 (file)")),
        ))
    }
}

pub async fn download_image(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(filename): Path<String>,
) -> Response {
    // 严格安全过滤：防止目录穿越
    let clean_filename = match StdPath::new(&filename).file_name().and_then(|f| f.to_str()) {
        Some(name) => name,
        None => return (StatusCode::BAD_REQUEST, "Invalid filename").into_response(),
    };

    let target_path = StdPath::new(&state.config.storage.local_root)
        .join(&auth_user.uuid)
        .join("images")
        .join(clean_filename);

    if !target_path.exists() {
        return (StatusCode::NOT_FOUND, "Image not found").into_response();
    }

    match fs::read(&target_path) {
        Ok(bytes) => {
            let content_type = if clean_filename.ends_with(".webp") {
                "image/webp"
            } else if clean_filename.ends_with(".png") {
                "image/png"
            } else {
                "application/octet-stream"
            };

            ([(header::CONTENT_TYPE, content_type)], bytes).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read image: {}", e)).into_response()
        }
    }
}
