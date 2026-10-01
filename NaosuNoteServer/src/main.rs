mod auth;
mod config;
mod db;
mod handlers;
mod models;

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Extension, Router,
};
use config::AppConfig;
use db::DbManager;
use std::fs;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub struct AppState {
    pub db: DbManager,
    pub config: AppConfig,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "naosu_note_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("=====================================================");
    tracing::info!("  NaosuNoteServer (Test Phase v0.1.0-beta) Starting  ");
    tracing::info!("=====================================================");

    // 2. 加载 config.toml
    let config = AppConfig::load_from_file("config.toml");

    // 3. 确保存储目录就绪
    let storage_path = Path::new(&config.storage.local_root);
    if !storage_path.exists() {
        fs::create_dir_all(storage_path)?;
        tracing::info!("Initialized local storage directory at {:?}", storage_path);
    }

    // 4. 初始化双 SQLite 数据库: user.db 与 userData.db
    let db = DbManager::new(".")?;
    tracing::info!("Initialized user.db and userData.db successfully.");
    tracing::info!(
        "Max registration limit: {} users (Require invite: {})",
        config.registration.max_users,
        config.registration.require_invite
    );

    let state = Arc::new(AppState {
        db,
        config: config.clone(),
    });

    // 5. 跨域支持 (CORS)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 6. 路由装配
    let app = Router::new()
        // 网页端注册页面 (GET /register)
        .route("/", get(handlers::web::register_page))
        .route("/register", get(handlers::web::register_page))
        .route("/registration", get(handlers::web::register_page))
        // 核心鉴权 API
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        // 用户概况与个人信息
        .route("/api/user/profile-summary", get(handlers::user::profile_summary))
        // 用户头像上传与静态获取 API
        .route("/api/user/avatar", post(handlers::user::upload_avatar))
        .route("/api/user/avatar/:user_uuid", get(handlers::user::get_avatar))
        // 增量同步 API (Pull & Push)
        .route("/api/sync/pull", post(handlers::sync::sync_pull))
        .route("/api/sync/push", post(handlers::sync::sync_push))
        // 图片附件同步 API
        .route(
            "/api/sync/images/check-missing",
            post(handlers::images::check_missing_images),
        )
        .route("/api/sync/images/upload", post(handlers::images::upload_image))
        .route(
            "/api/sync/images/download/:filename",
            get(handlers::images::download_image),
        )
        // 健康检查
        .route("/api/health", get(handlers::health_check))
        .layer(cors)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(Extension(state.clone()))
        .layer(Extension(state.config.clone()))
        .with_state(state.clone());

    // 7. 绑定端口启动
    let addr: SocketAddr = config
        .server
        .listen_addr
        .parse()
        .unwrap_or_else(|_| "0.0.0.0:8080".parse().unwrap());

    tracing::info!("-> Listening on http://{}", addr);
    tracing::info!("-> Registration web page: http://{}/register", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
