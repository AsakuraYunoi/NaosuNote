use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::models::ApiResponse;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user_uuid
    pub identifier: String,
    pub nickname: String,
    pub exp: usize,
}

pub fn create_jwt_token(
    user_uuid: &str,
    identifier: &str,
    nickname: &str,
    secret: &str,
    expire_days: i64,
) -> Result<String, String> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::days(expire_days))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_uuid.to_string(),
        identifier: identifier.to_string(),
        nickname: nickname.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("Failed to create token: {}", e))
}

pub fn verify_jwt_token(token: &str, secret: &str) -> Result<Claims, String> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| format!("Invalid token: {}", e))?;

    Ok(token_data.claims)
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub uuid: String,
    pub identifier: String,
    pub nickname: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|val| val.to_str().ok());

        let token = match auth_header {
            Some(header) if header.starts_with("Bearer ") => &header[7..],
            _ => {
                let body = Json(ApiResponse::<()>::err(401, "缺少有效身份凭证 (Authorization header)"));
                return Err((StatusCode::UNAUTHORIZED, body).into_response());
            }
        };

        let secret = parts
            .extensions
            .get::<crate::config::AppConfig>()
            .map(|c| c.server.jwt_secret.clone())
            .or_else(|| {
                parts
                    .extensions
                    .get::<std::sync::Arc<crate::AppState>>()
                    .map(|s| s.config.server.jwt_secret.clone())
            })
            .unwrap_or_else(|| "naosu_super_secret_jwt_key_2026_xyz".to_string());

        match verify_jwt_token(token, &secret) {
            Ok(claims) => Ok(AuthUser {
                uuid: claims.sub,
                identifier: claims.identifier,
                nickname: claims.nickname,
            }),
            Err(err_msg) => {
                let body = Json(ApiResponse::<()>::err(401, &format!("身份凭据已过期或无效: {}", err_msg)));
                Err((StatusCode::UNAUTHORIZED, body).into_response())
            }
        }
    }
}
