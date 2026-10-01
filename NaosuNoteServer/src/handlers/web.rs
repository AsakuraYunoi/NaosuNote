use axum::response::{Html, IntoResponse};
use std::fs;
use std::path::Path;

const EMBEDDED_REGISTER_HTML: &str = include_str!("../../static/register.html");

pub async fn register_page() -> impl IntoResponse {
    // 优先读取磁盘上的静态文件（方便用户随时自定义），若未找到则降级使用编译内嵌的单文件版本
    let html_content = if Path::new("./static/register.html").exists() {
        fs::read_to_string("./static/register.html").unwrap_or_else(|_| EMBEDDED_REGISTER_HTML.to_string())
    } else {
        EMBEDDED_REGISTER_HTML.to_string()
    };

    Html(html_content)
}
