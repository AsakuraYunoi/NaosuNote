use crate::db::DbManager;
use crate::models::{Notebook, Problem};
use std::fs;
use std::path::Path;

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARSET[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARSET[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn escape_html_text(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub struct MirrorManager;

impl MirrorManager {
    pub fn sanitize_filename(name: &str) -> String {
        name.chars()
            .map(|c| match c {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                _ => c,
            })
            .collect()
    }

    pub fn delete_notebook_mirror(data_dir: &str, notebook: &Notebook) {
        let clean_name = Self::sanitize_filename(&notebook.name);
        let file_name = format!("{}.html", clean_name);
        let file_path = Path::new(data_dir).join(&file_name);
        if file_path.exists() {
            let _ = fs::remove_file(file_path);
        }
    }

    pub fn sync_notebook_mirror(
        db: &DbManager,
        data_dir: &str,
        notebook: &Notebook,
    ) -> Result<String, String> {
        let problems = db
            .get_problems_by_notebook(&notebook.id)
            .map_err(|e| format!("Failed to query problems for notebook {}: {}", notebook.name, e))?;

        let clean_name = Self::sanitize_filename(&notebook.name);
        let file_name = format!("{}.html", clean_name);
        let file_path = Path::new(data_dir).join(&file_name);

        let html_content = Self::generate_mirror_html(&notebook.name, &notebook.subject, &problems, Some(data_dir));
        fs::write(&file_path, html_content)
            .map_err(|e| format!("Failed to write mirror file {:?}: {}", file_path, e))?;

        Ok(file_path.to_string_lossy().to_string())
    }

    pub fn sync_all_notebook_mirrors(db: &DbManager, data_dir: &str) -> Result<(), String> {
        let _ = db.ensure_default_notebooks();
        let notebooks = db
            .get_notebooks()
            .map_err(|e| format!("Failed to query notebooks: {}", e))?;

        for nb in notebooks {
            let _ = Self::sync_notebook_mirror(db, data_dir, &nb);
        }
        Ok(())
    }

    pub fn generate_mirror_html(
        notebook_name: &str,
        subject: &str,
        problems: &[Problem],
        data_dir: Option<&str>,
    ) -> String {
        let mut problems_html = String::new();
        for p in problems {
            let mut html = p.raw_html.trim().to_string();
            while html.starts_with("<!--") {
                if let Some(pos) = html.find("-->") {
                    html = html[pos + 3..].trim().to_string();
                } else {
                    break;
                }
            }

            problems_html.push_str(&format!(
                "\n<!--{}_{}_{}-->\n",
                p.subject, p.date, p.summary
            ));
            if let Some(ref tags) = p.tags {
                if !tags.is_empty() && !html.contains(" tags=") {
                    if let Some(pos) = html.find("<div class=\"naosu-problem\"") {
                        let after_tag = pos + "<div class=\"naosu-problem\"".len();
                        html.insert_str(after_tag, &format!(" tags=\"{}\"", tags.join(",")));
                    }
                }
            }

            // 构建解析与解答区域
            let has_markdown = p
                .answer_markdown
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);
            let has_images = p
                .answer_images
                .as_ref()
                .map(|imgs| !imgs.is_empty())
                .unwrap_or(false);
            let has_answer = has_markdown || has_images;

            let answer_section = if has_answer {
                let mut body = String::new();

                if let Some(ref md) = p.answer_markdown {
                    if !md.trim().is_empty() {
                        let escaped = escape_html_text(md);
                        body.push_str(&format!(
                            r#"<pre class="answer-markdown-raw" style="display: none;">{}</pre><div class="answer-markdown-rendered"></div>"#,
                            escaped
                        ));
                    }
                }

                if let Some(ref imgs) = p.answer_images {
                    if !imgs.is_empty() {
                        body.push_str(r#"<div class="answer-images-section"><div class="answer-images-title">答案手写 / 照片：</div><div class="answer-images-grid">"#);
                        for img_name in imgs {
                            let img_src = if let Some(dir) = data_dir {
                                let img_path = Path::new(dir).join("ImgData").join(img_name);
                                if let Ok(bytes) = fs::read(&img_path) {
                                    format!("data:image/webp;base64,{}", base64_encode(&bytes))
                                } else {
                                    format!("./ImgData/{}", img_name)
                                }
                            } else {
                                format!("./ImgData/{}", img_name)
                            };
                            body.push_str(&format!(
                                r#"<div class="answer-img-item" onclick="openLightbox(this)" title="点击放大图片"><img src="{}" alt="解答图片" loading="lazy"></div>"#,
                                img_src
                            ));
                        }
                        body.push_str("</div></div>");
                    }
                }

                format!(
                    r#"<div class="problem-answer-wrapper" data-has-answer="true">
  <div class="answer-toggle-row">
    <button type="button" class="answer-toggle-btn" onclick="toggleProblemAnswer(this)">
      <span class="toggle-icon">▸</span>
      <span class="toggle-text">查看解析与解答</span>
    </button>
  </div>
  <div class="problem-answer-content" style="display: none;">
    {}
  </div>
</div>"#,
                    body
                )
            } else {
                r#"<div class="problem-answer-wrapper" data-has-answer="false"><div class="no-answer-hint" style="display: none;">暂无解析与解答</div></div>"#.to_string()
            };

            // 将解析挂载至 naosu-problem 内部末尾
            if let Some(pos) = html.rfind("</div>") {
                let mut combined = html[..pos].to_string();
                combined.push('\n');
                combined.push_str(&answer_section);
                combined.push('\n');
                combined.push_str(&html[pos..]);
                html = combined;
            } else {
                html.push_str(&answer_section);
            }

            problems_html.push_str(&html);
            problems_html.push('\n');
        }

        format!(
            r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NaosuNote - {notebook_name} (共 {count} 题)</title>
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    :root {{
      --primary: #00639b;
      --primary-tint: #f3f6fa;
      --bg: #f8f9fa;
      --surface: #ffffff;
      --text: #1a1c1e;
      --text-sec: #43474e;
      --border: #c3c7cf;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      line-height: 1.6;
    }}
    .container {{
      max-width: 880px;
      margin: 0 auto;
    }}
    .header {{
      background: var(--surface);
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.06);
    }}
    .header-titles h1 {{
      margin: 0 0 6px 0;
      color: var(--primary);
      font-size: 24px;
      letter-spacing: 0.5px;
    }}
    .header-titles .meta {{
      font-size: 13.5px;
      color: var(--text-sec);
    }}
    .global-switch-control {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      background: rgba(0, 0, 0, 0.04);
      padding: 8px 16px;
      border-radius: 9999px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      transition: background 0.2s ease;
    }}
    .global-switch-control:hover {{
      background: rgba(0, 0, 0, 0.07);
    }}
    .switch-track {{
      position: relative;
      width: 44px;
      height: 24px;
      background: #c3c7cf;
      border-radius: 9999px;
      transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-block;
      flex-shrink: 0;
    }}
    .switch-thumb {{
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }}
    input[type="checkbox"]#global-answer-switch {{
      display: none;
    }}
    input[type="checkbox"]#global-answer-switch:checked + .switch-track {{
      background: var(--primary);
    }}
    input[type="checkbox"]#global-answer-switch:checked + .switch-track .switch-thumb {{
      transform: translateX(20px);
    }}
    .switch-label-text {{
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text);
    }}
    .naosu-problem {{
      background: var(--surface);
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      border: 1px solid rgba(0,0,0,0.06);
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    .problem-body {{
      font-size: 15px;
      line-height: 1.8;
    }}
    p, .stem-paragraph {{
      margin: 0 0 10px 0;
      line-height: 1.8;
    }}
    .sub-prompt {{
      font-weight: 600;
      margin: 12px 0 6px 0;
    }}
    .sub-item {{
      margin-bottom: 10px;
    }}
    .blank {{
      border-bottom: 1.2px solid currentColor;
      display: inline-block;
      vertical-align: baseline;
      margin: 0 4px;
      height: 0.9em;
    }}
    .blank-sm {{ width: 45px; }}
    .blank-md {{ width: 90px; }}
    .blank-lg {{ width: 150px; }}
    .blank-xl {{ width: 220px; }}

    /* 选项排版系统 */
    .options {{
      margin: 10px 0;
      padding-left: 6px;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 6px 16px !important;
      align-items: baseline;
    }}
    .options-grid.options-2-col,
    .options.options-2-col,
    .options-grid.options-4-col,
    .options.options-4-col {{
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 6px 20px !important;
    }}
    .options-grid.options-1-col,
    .options.options-1-col {{
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 6px !important;
    }}
    .options > span {{
      display: block;
      box-sizing: border-box;
      min-width: 0 !important;
      word-break: break-word;
    }}

    /* KaTeX 保护 */
    .katex,
    .katex * {{
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: content-box !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }}
    .katex {{
      font-size: 1.05em;
      text-rendering: auto;
    }}
    .katex-display {{
      margin: 0.6em 0 !important;
    }}

    /* 表格三线表 */
    .problem-body table {{
      width: 96%;
      max-width: 680px;
      margin: 12px auto;
      border-collapse: collapse;
      font-size: 13px;
      border-top: 1.8px solid #000;
      border-bottom: 1.8px solid #000;
      text-align: center;
      break-inside: avoid;
    }}
    .problem-body thead tr {{
      border-bottom: 1.2px solid #000;
      background-color: rgba(0, 0, 0, 0.03);
    }}
    .problem-body th {{
      padding: 6px 10px;
      font-weight: 700;
    }}
    .problem-body td {{
      padding: 5px 10px;
      border-bottom: 0.5px solid #e0e0e0;
    }}
    .problem-body tbody tr:last-child td {{
      border-bottom: none;
    }}

    /* 图文左右混排容器 */
    .exam-side-by-side {{
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 16px !important;
      margin: 10px 0 !important;
      break-inside: avoid !important;
    }}
    .exam-side-table-img table,
    .exam-side-by-side > table {{
      flex: 1 1 58% !important;
      width: 58% !important;
      max-width: 58% !important;
      min-width: 0 !important;
      margin: 0 !important;
      table-layout: fixed !important;
    }}
    .exam-side-table-img .img,
    .exam-side-by-side > .img {{
      flex: 0 0 38% !important;
      width: 38% !important;
      max-width: 38% !important;
      min-width: 0 !important;
      margin: 0 !important;
      text-align: center !important;
    }}
    .exam-side-table-img .img svg,
    .exam-side-by-side > .img svg {{
      max-height: 135px !important;
      max-width: 100% !important;
      width: 100% !important;
      height: auto !important;
    }}

    /* 一题多图 / 表格与图片同行并排容器 */
    .exam-images-row {{
      display: flex !important;
      flex-direction: row !important;
      justify-content: center !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 16px !important;
      margin: 10px auto !important;
      width: 100% !important;
      box-sizing: border-box !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }}
    .exam-images-row > .img,
    .exam-images-row > table,
    .exam-images-row > .table-wrap {{
      margin: 0 !important;
      min-width: 120px !important;
      max-width: calc(100% - 136px) !important;
      box-sizing: border-box !important;
      flex: 1 1 0;
    }}
    .exam-images-row > table,
    .exam-images-row > .table-wrap table {{
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      font-size: 11px !important;
    }}
    .exam-images-row .img svg,
    .exam-images-row .img img {{
      max-width: 100% !important;
      max-height: 180px !important;
      width: auto !important;
      height: auto !important;
      display: inline-block !important;
      object-fit: contain !important;
    }}

    /* SVG 矢量图居中与自适应 */
    .img {{
      text-align: center;
      margin: 10px 0;
      overflow-x: auto;
      break-inside: avoid;
    }}
    .img svg {{
      max-width: min(100%, 480px);
      max-height: 180px;
      width: auto;
      height: auto;
      display: inline-block;
      vertical-align: middle;
    }}

    /* 解析与解答折叠面板 */
    .problem-answer-wrapper {{
      margin-top: 16px;
      border-top: 1px dashed rgba(0, 0, 0, 0.12);
      padding-top: 12px;
    }}
    .answer-toggle-row {{
      display: flex;
      align-items: center;
    }}
    .answer-toggle-btn {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 99, 155, 0.08);
      color: var(--primary);
      border: 1px solid rgba(0, 99, 155, 0.2);
      border-radius: 9999px;
      padding: 5px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
    }}
    .answer-toggle-btn:hover {{
      background: rgba(0, 99, 155, 0.15);
      border-color: var(--primary);
    }}
    .answer-toggle-btn .toggle-icon {{
      font-size: 11px;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-block;
    }}
    .answer-toggle-btn.is-open .toggle-icon {{
      transform: rotate(90deg);
    }}
    .answer-toggle-btn.is-open {{
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }}
    .problem-answer-content {{
      margin-top: 12px;
      background: var(--primary-tint);
      border: 1px solid #e1e7f0;
      border-left: 4px solid var(--primary);
      border-radius: 12px;
      padding: 18px 22px;
      font-size: 14.5px;
      line-height: 1.75;
      color: var(--text);
    }}
    .katex-display-wrapper {{
      margin: 12px 0;
      overflow-x: auto;
      overflow-y: hidden;
      text-align: center;
    }}
    .katex-inline-wrapper {{
      display: inline-block;
      padding: 0 2px;
      vertical-align: baseline;
    }}
    .katex {{
      font-size: 1.05em;
      text-rendering: auto;
      line-height: normal;
    }}
    .katex-display {{
      margin: 0.5em 0;
    }}
    .answer-markdown-rendered h1,
    .answer-markdown-rendered h2,
    .answer-markdown-rendered h3,
    .answer-markdown-rendered h4 {{
      color: var(--primary);
      margin: 14px 0 6px 0;
      font-weight: 700;
    }}
    .answer-markdown-rendered p {{
      margin: 0 0 8px 0;
      line-height: 1.75;
    }}
    .answer-markdown-rendered ul,
    .answer-markdown-rendered ol {{
      margin: 4px 0 10px 20px;
      padding: 0;
    }}
    .answer-markdown-rendered li {{
      margin-bottom: 4px;
    }}
    .answer-markdown-rendered blockquote {{
      margin: 8px 0;
      padding: 6px 14px;
      border-left: 3px solid var(--primary);
      background: rgba(0, 99, 155, 0.04);
      color: var(--text-sec);
    }}
    .answer-markdown-rendered hr.md-divider {{
      border: none;
      border-top: 1px solid #e1e7f0;
      margin: 12px 0;
    }}
    .answer-markdown-rendered code.inline-code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 5px;
      border-radius: 4px;
    }}
    .answer-markdown-rendered pre.code-block {{
      background: #24292e;
      color: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.9em;
      margin: 8px 0;
    }}
    .answer-images-section {{
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e1e7f0;
    }}
    .answer-images-title {{
      font-size: 13px;
      font-weight: 600;
      color: var(--text-sec);
      margin-bottom: 8px;
    }}
    .answer-images-grid {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }}
    .answer-img-item {{
      max-width: 280px;
      max-height: 220px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #d0d7e2;
      background: #ffffff;
      cursor: zoom-in;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }}
    .answer-img-item:hover {{
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }}
    .answer-img-item img {{
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }}
    .no-answer-hint {{
      margin-top: 8px;
      font-size: 12.5px;
      color: #8c9199;
      font-style: italic;
    }}

    /* Lightbox 图片放大遮罩 */
    .lightbox-overlay {{
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
      padding: 24px;
      box-sizing: border-box;
    }}
    .lightbox-overlay img {{
      max-width: 95vw;
      max-height: 95vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }}

    @media print {{
      body {{
        background: #fff;
        padding: 0;
      }}
      .header {{
        box-shadow: none;
        border: none;
        border-bottom: 2px solid #000;
        border-radius: 0;
        padding: 12px 0;
      }}
      .global-switch-control,
      .answer-toggle-btn {{
        display: none !important;
      }}
      .problem-answer-content {{
        background: #fafafa !important;
        border: 1px solid #ccc !important;
        border-left: 3px solid #333 !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }}
      .no-answer-hint {{
        display: none !important;
      }}
      .naosu-problem {{
        box-shadow: none;
        border: none;
        border-bottom: 1px dashed #ccc;
        border-radius: 0;
        padding: 16px 0;
        margin-bottom: 16px;
        break-inside: avoid !important;
      }}
    }}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-titles">
        <h1>NaosuNote · {notebook_name}</h1>
        <div class="meta">学科：{subject} ｜ 收录错题：{count} 题</div>
      </div>
      <div class="header-controls">
        <label class="global-switch-control" title="切换显示或隐藏所有题目的解析">
          <input type="checkbox" id="global-answer-switch" onchange="toggleAllAnswers(this.checked)">
          <span class="switch-track">
            <span class="switch-thumb"></span>
          </span>
          <span class="switch-label-text" id="global-switch-label">显示解析</span>
        </label>
      </div>
    </div>
    <div class="problems-container">
      {problems_html}
    </div>
  </div>

  <div id="image-lightbox" class="lightbox-overlay" style="display: none;" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="放大图片">
  </div>

  <script>
    var CJK_CHARS =
      '\\u4e00-\\u9fff' +
      '\\u3400-\\u4dbf' +
      '\\u3040-\\u309f' +
      '\\u30a0-\\u30ff' +
      '\\uff66-\\uff9f' +
      '\\uac00-\\ud7af' +
      '\\u3000-\\u303f' +
      '\\uff01-\\uff0f\\uff1a-\\uff20\\uff3b-\\uff40\\uff5b-\\uff65' +
      '\\u2014\\u2018\\u2019\\u201c\\u201d\\u2026';

    var NON_CJK_REGEX = new RegExp('([^' + CJK_CHARS + '\\n\\r]+)', 'g');

    var STANDARD_MATH_WORDS = new Set([
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min',
      'det', 'gcd', 'lcm', 'deg', 'dim', 'ker', 'hom',
      'arg', 'mod', 'sup', 'inf',
      'dx', 'dy', 'dz', 'dt', 'dr', 'ds'
    ]);

    function isBareEnglishText(str) {{
      var s = str.replace(/\\[a-zA-Z]+/g, ' ');
      s = s.replace(/[a-zA-Z]\w*\x27?\s*\(/g, ' (');
      var words = s.match(/\b[a-zA-Z]{{2,}}\b/g) || [];
      for (var i = 0; i < words.length; i++) {{
        if (!STANDARD_MATH_WORDS.has(words[i].toLowerCase())) {{
          return true;
        }}
      }}
      return false;
    }}

    function isMathCandidate(candidate) {{
      var c = candidate.trim();
      if (!c || /^\d+(\.\d+)?$/.test(c)) return false;
      if (isBareEnglishText(c)) return false;

      var hasLatexCmd = /\\[a-zA-Z]+/.test(c);
      var hasSubOrSup = /[_^]/.test(c);
      var hasMathOp = /[=<>≤≥≠≈+\-*/]/.test(c) && /[a-zA-Z0-9]/.test(c);
      var hasFunction = /^[a-zA-Z]\x27?\(/.test(c);
      var hasInterval = /^\([a-zA-Z0-9+\-∞\\ ]+,\s*[a-zA-Z0-9+\-∞\\ ]+\)$/.test(c);
      var isSingleVar = /^[a-zA-Z]\x27?$/.test(c);

      if (hasLatexCmd || hasSubOrSup || hasMathOp || hasFunction || hasInterval || isSingleVar) {{
        if (typeof katex !== 'undefined' && typeof katex.renderToString === 'function') {{
          try {{
            katex.renderToString(c, {{ displayMode: false, throwOnError: true, strict: false }});
            return true;
          }} catch (e) {{
            return false;
          }}
        }}
        return hasLatexCmd || hasSubOrSup;
      }}
      return false;
    }}

    function escapeHtml(str) {{
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }}

    function renderKatexSafe(tex, displayMode) {{
      var trimmed = tex.trim();
      if (!trimmed) return '';
      if (typeof katex !== 'undefined' && typeof katex.renderToString === 'function') {{
        try {{
          var rendered = katex.renderToString(trimmed, {{
            displayMode: displayMode,
            throwOnError: false,
            strict: false,
            trust: true
          }});
          if (displayMode) {{
            return '<div class=\"katex-display-wrapper\">' + rendered + '</div>';
          }}
          return '<span class=\"katex-inline-wrapper\">' + rendered + '</span>';
        }} catch (e) {{
          return escapeHtml(trimmed);
        }}
      }}
      return escapeHtml(trimmed);
    }}

    function parseInline(text) {{
      var res = text;
      res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      res = res.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      return res;
    }}

    function renderMarkdownWithKatex(raw) {{
      if (!raw || !raw.trim()) return '';

      var tokenMap = new Map();
      var tokenCounter = 0;

      function createToken(html) {{
        var id = '%%NAOSU_TOKEN_' + (tokenCounter++) + '_' + Math.random().toString(36).substring(2, 8) + '%%';
        tokenMap.set(id, html);
        return id;
      }}

      var text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_, lang, code) {{
        return createToken('<pre class=\"code-block' + (lang ? ' language-' + lang : '') + '\"><code>' + escapeHtml(code) + '</code></pre>');
      }});

      text = text.replace(/`([^`\n]+)`/g, function(_, code) {{
        return createToken('<code class=\"inline-code\">' + escapeHtml(code) + '</code>');
      }});

      text = text.replace(/\$\$([\s\S]+?)\$\$/g, function(_, tex) {{
        return createToken(renderKatexSafe(tex, true));
      }});

      text = text.replace(/(?:\\\[|\\\\\[)([\s\S]+?)(?:\\\]|\\\\\])/g, function(_, tex) {{
        return createToken(renderKatexSafe(tex, true));
      }});

      text = text.replace(
        /(\\begin\{{(?:aligned|matrix|pmatrix|bmatrix|cases|equation|align\*?)\}}[\s\S]+?\\end\{{(?:aligned|matrix|pmatrix|bmatrix|cases|equation|align\*?)\}})/g,
        function(_, tex) {{
          return createToken(renderKatexSafe(tex, true));
        }}
      );

      text = text.replace(/(?:\\\(|\\\\\()([\s\S]+?)(?:\\\)|\\\\\))/g, function(_, tex) {{
        return createToken(renderKatexSafe(tex, false));
      }});

      text = text.replace(/\$([^\$\n\r]+?)\$/g, function(match, tex) {{
        var trimmed = tex.trim();
        if (/^\d+(?:\.\d+)?$/.test(trimmed)) return match;
        return createToken(renderKatexSafe(trimmed, false));
      }});

      text = text.replace(NON_CJK_REGEX, function(segment) {{
        if (segment.indexOf('%%NAOSU_TOKEN_') !== -1) return segment;

        var s = segment;
        var leadMatch = s.match(/^(\s*(?:(?:\\d+|[a-zA-Z])[\.\)]\s+|[◦•○●▪▫\-\+\*]\s+)?)/);
        var leading = leadMatch ? leadMatch[1] : '';
        var rest = s.slice(leading.length);

        var trailMatch = rest.match(/(\s+)$/);
        var trailing = trailMatch ? trailMatch[1] : '';
        var candidate = rest.slice(0, rest.length - trailing.length);

        if (!candidate.endsWith('...') && !candidate.endsWith('\\dots') && !candidate.endsWith('\\cdots')) {{
          var punctMatch = candidate.match(/([,;:!?.]+)$/);
          if (punctMatch) {{
            trailing = punctMatch[1] + trailing;
            candidate = candidate.slice(0, candidate.length - punctMatch[1].length);
          }}
        }}

        var balance = 0;
        for (var i = 0; i < candidate.length; i++) {{
          if (candidate[i] === '(') balance++;
          else if (candidate[i] === ')') balance--;
        }}
        while (balance > 0 && candidate.startsWith('(')) {{
          leading += '(';
          candidate = candidate.slice(1).trim();
          balance--;
        }}
        while (balance < 0 && candidate.endsWith(')')) {{
          trailing = ')' + trailing;
          candidate = candidate.slice(0, -1).trim();
          balance++;
        }}

        if (isMathCandidate(candidate)) {{
          return leading + createToken(renderKatexSafe(candidate, false)) + trailing;
        }}
        return segment;
      }});

      var lines = text.split('\n');
      var outputLines = [];
      var inList = null;
      var inBlockquote = false;

      function closeList() {{
        if (inList) {{
          outputLines.push(inList === 'ul' ? '</ul>' : '</ol>');
          inList = null;
        }}
      }}

      function closeBlockquote() {{
        if (inBlockquote) {{
          outputLines.push('</blockquote>');
          inBlockquote = false;
        }}
      }}

      var i = 0;
      while (i < lines.length) {{
        var line = lines[i];

        if (/^\s*%%NAOSU_TOKEN_[^%]+%%\s*$/.test(line)) {{
          closeList();
          closeBlockquote();
          outputLines.push(line.trim());
          i++;
          continue;
        }}

        if (/^(?:---|\\*\\*\\*|___)\s*$/.test(line)) {{
          closeList();
          closeBlockquote();
          outputLines.push('<hr class=\"md-divider\" />');
          i++;
          continue;
        }}

        var headingMatch = line.match(/^(#{{1,6}})\s+(.+)$/);
        if (headingMatch) {{
          closeList();
          closeBlockquote();
          var level = headingMatch[1].length;
          outputLines.push('<h' + level + ' class=\"md-heading md-h' + level + '\">' + parseInline(headingMatch[2]) + '</h' + level + '>');
          i++;
          continue;
        }}

        if (line.startsWith('>')) {{
          closeList();
          if (!inBlockquote) {{
            outputLines.push('<blockquote class=\"md-blockquote\">');
            inBlockquote = true;
          }}
          outputLines.push('<p>' + parseInline(line.replace(/^>\s?/, '')) + '</p>');
          i++;
          continue;
        }} else {{
          closeBlockquote();
        }}

        var ulMatch = line.match(/^[-*+◦•○●▪▫]\s+(.+)$/);
        if (ulMatch) {{
          if (inList !== 'ul') {{
            closeList();
            outputLines.push('<ul class=\"md-ul\">');
            inList = 'ul';
          }}
          outputLines.push('<li>' + parseInline(ulMatch[1]) + '</li>');
          i++;
          continue;
        }}

        var olMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
        if (olMatch) {{
          if (inList !== 'ol') {{
            closeList();
            outputLines.push('<ol class=\"md-ol\">');
            inList = 'ol';
          }}
          outputLines.push('<li>' + parseInline(olMatch[2]) + '</li>');
          i++;
          continue;
        }}

        if (!line.trim()) {{
          closeList();
          closeBlockquote();
          i++;
          continue;
        }}

        closeList();
        outputLines.push('<p class=\"md-p\">' + parseInline(line) + '</p>');
        i++;
      }}

      closeList();
      closeBlockquote();

      var htmlResult = outputLines.join('\n');
      tokenMap.forEach(function(tokenHtml, tokenKey) {{
        htmlResult = htmlResult.split(tokenKey).join(tokenHtml);
      }});

      return htmlResult;
    }}

    function toggleProblemAnswer(btn) {{
      var wrapper = btn.closest('.problem-answer-wrapper');
      if (!wrapper) return;
      var content = wrapper.querySelector('.problem-answer-content');
      if (!content) return;
      var isOpen = content.style.display !== 'none';
      if (isOpen) {{
        content.style.display = 'none';
        btn.classList.remove('is-open');
        var txt = btn.querySelector('.toggle-text');
        if (txt) txt.textContent = '查看解析与解答';
      }} else {{
        content.style.display = 'block';
        btn.classList.add('is-open');
        var txt = btn.querySelector('.toggle-text');
        if (txt) txt.textContent = '收起解析与解答';
      }}
    }}

    function toggleAllAnswers(show) {{
      var wrappers = document.querySelectorAll('.problem-answer-wrapper');
      wrappers.forEach(function(wrapper) {{
        var hasAnswer = wrapper.getAttribute('data-has-answer') === 'true';
        var btn = wrapper.querySelector('.answer-toggle-btn');
        var content = wrapper.querySelector('.problem-answer-content');
        var hint = wrapper.querySelector('.no-answer-hint');
        if (hasAnswer && content) {{
          content.style.display = show ? 'block' : 'none';
        }}
        if (btn) {{
          if (show) {{
            btn.classList.add('is-open');
            var txt = btn.querySelector('.toggle-text');
            if (txt) txt.textContent = '收起解析与解答';
          }} else {{
            btn.classList.remove('is-open');
            var txt = btn.querySelector('.toggle-text');
            if (txt) txt.textContent = '查看解析与解答';
          }}
        }}
        if (!hasAnswer && hint) {{
          hint.style.display = show ? 'block' : 'none';
        }}
      }});
      var label = document.getElementById('global-switch-label');
      if (label) {{
        label.textContent = show ? '隐藏解析' : '显示解析';
      }}
    }}

    function openLightbox(el) {{
      var img = el.querySelector('img');
      if (!img) return;
      var lb = document.getElementById('image-lightbox');
      var lbImg = document.getElementById('lightbox-img');
      if (lb && lbImg) {{
        lbImg.src = img.src;
        lb.style.display = 'flex';
      }}
    }}

    function closeLightbox() {{
      var lb = document.getElementById('image-lightbox');
      if (lb) lb.style.display = 'none';
    }}

    document.addEventListener("DOMContentLoaded", function() {{
      // 1. 渲染所有解析中的 Markdown 与行内/块级 KaTeX 公式
      document.querySelectorAll('.problem-answer-wrapper[data-has-answer="true"]').forEach(function(wrapper) {{
        var rawEl = wrapper.querySelector('.answer-markdown-raw');
        var renderEl = wrapper.querySelector('.answer-markdown-rendered');
        if (rawEl && renderEl) {{
          renderEl.innerHTML = renderMarkdownWithKatex(rawEl.textContent || '');
        }}
      }});

      // 2. 统一渲染页面其它区域（如题干）的 KaTeX 公式
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: '$$', right: '$$', display: true}},
            {{left: '$', right: '$', display: false}},
            {{left: '\\(', right: '\\)', display: false}},
            {{left: '\\[', right: '\\]', display: true}}
          ],
          ignoredClasses: ["answer-markdown-rendered", "answer-markdown-raw", "katex"],
          throwOnError: false
        }});
      }}
    }});
  </script>
</body>
</html>"#,
            notebook_name = notebook_name,
            subject = subject,
            count = problems.len(),
            problems_html = problems_html
        )
    }
}
