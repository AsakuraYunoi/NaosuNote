use axum::{extract::State, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::create_jwt_token;
use crate::models::{ApiResponse, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, UserInfo};
use crate::AppState;

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Json<ApiResponse<RegisterResponse>> {
    let identifier = req.identifier.trim();
    let nickname = req.nickname.trim();
    let invite_code = req.invite_code.trim().to_uppercase();
    let password = req.password;

    if identifier.is_empty() || nickname.is_empty() {
        return Json(ApiResponse {
            code: 400,
            message: "邮箱/手机号及昵称不能为空".to_string(),
            data: None,
        });
    }

    if password.len() < 6 {
        return Json(ApiResponse {
            code: 400,
            message: "密码长度至少需要 6 个字符".to_string(),
            data: None,
        });
    }

    // 1. 检查注册人数硬限制 (测试阶段)
    match state.db.users.get_user_count() {
        Ok(count) => {
            if count >= state.config.registration.max_users {
                return Json(ApiResponse {
                    code: 403,
                    message: format!(
                        "测试阶段注册人数已达上限 (已满 {} 人)，暂不开放新注册",
                        state.config.registration.max_users
                    ),
                    data: None,
                });
            }
        }
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("检查用户数据库失败: {}", e),
                data: None,
            });
        }
    }

    // 2. 检查邀请码校验
    if state.config.registration.require_invite {
        if !state.config.registration.invite_codes.iter().any(|c| c.eq_ignore_ascii_case(&invite_code)) {
            return Json(ApiResponse {
                code: 400,
                message: "邀请码无效，请确认输入是否正确".to_string(),
                data: None,
            });
        }

        match state.db.users.is_invite_code_used(&invite_code) {
            Ok(used) if used => {
                return Json(ApiResponse {
                    code: 400,
                    message: "该邀请码已被使用，每枚邀请码仅限注册一次".to_string(),
                    data: None,
                });
            }
            Err(e) => {
                return Json(ApiResponse {
                    code: 500,
                    message: format!("校验邀请码失败: {}", e),
                    data: None,
                });
            }
            _ => {}
        }
    }

    // 3. 检查账号是否已存在
    match state.db.users.get_user_by_identifier(identifier) {
        Ok(Some(_)) => {
            return Json(ApiResponse {
                code: 409,
                message: "该邮箱或手机号已被注册，请直接在软件内登录".to_string(),
                data: None,
            });
        }
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("查询用户失败: {}", e),
                data: None,
            });
        }
        _ => {}
    }

    // 4. 生成用户 UUID 与密码 Hash
    let user_uuid = Uuid::new_v4().to_string();
    let password_hash = match hash(&password, DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("密码哈希加密失败: {}", e),
                data: None,
            });
        }
    };

    // 5. 初始化用户本地专属存储目录 ./storage/{UUID}/images/ (若受权限临时限制则记录告警，首次上传配图时会再次按需创建)
    let user_storage_dir = Path::new(&state.config.storage.local_root)
        .join(&user_uuid)
        .join("images");
    if let Err(e) = fs::create_dir_all(&user_storage_dir) {
        tracing::warn!("Warning: Failed to create user storage dir upfront (will be created on first image upload): {}", e);
    }

    // 6. 写入 user.db
    if let Err(e) = state.db.users.create_user(
        &user_uuid,
        identifier,
        nickname,
        &password_hash,
        &invite_code,
    ) {
        return Json(ApiResponse {
            code: 500,
            message: format!("保存用户记录失败: {}", e),
            data: None,
        });
    }

    tracing::info!("New user registered successfully: identifier={}, uuid={}", identifier, user_uuid);

    Json(ApiResponse::ok_msg(
        "注册成功！您的数据沙盒已就绪，请在软件中登录。",
        RegisterResponse { uuid: user_uuid },
    ))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Json<ApiResponse<LoginResponse>> {
    let identifier = req.identifier.trim();
    let password = req.password;

    let user_record = match state.db.users.get_user_by_identifier(identifier) {
        Ok(Some(u)) => u,
        Ok(None) => {
            return Json(ApiResponse {
                code: 401,
                message: "账号不存在或密码错误".to_string(),
                data: None,
            });
        }
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("数据库查询失败: {}", e),
                data: None,
            });
        }
    };

    match verify(&password, &user_record.password_hash) {
        Ok(true) => {}
        _ => {
            return Json(ApiResponse {
                code: 401,
                message: "账号不存在或密码错误".to_string(),
                data: None,
            });
        }
    }

    // 生成 JWT Token
    let token = match create_jwt_token(
        &user_record.uuid,
        &user_record.identifier,
        &user_record.nickname,
        &state.config.server.jwt_secret,
        state.config.server.token_expire_days,
    ) {
        Ok(t) => t,
        Err(e) => {
            return Json(ApiResponse {
                code: 500,
                message: format!("生成授权凭证失败: {}", e),
                data: None,
            });
        }
    };

    tracing::info!("User logged in successfully: identifier={}, uuid={}", identifier, user_record.uuid);

    Json(ApiResponse::ok_msg(
        "登录成功",
        LoginResponse {
            token,
            user: UserInfo {
                uuid: user_record.uuid,
                identifier: user_record.identifier,
                nickname: user_record.nickname,
                avatar_url: user_record.avatar_url,
                quota_bytes: state.config.storage.per_user_quota_bytes,
                created_at: user_record.created_at,
            },
        },
    ))
}
