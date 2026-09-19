use crate::db::DbManager;
use crate::models::{Notebook, Problem};
use std::fs;
use std::path::Path;

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

        let html_content = Self::generate_mirror_html(&notebook.name, &notebook.subject, &problems);
        fs::write(&file_path, html_content)
            .map_err(|e| format!("Failed to write mirror file {:?}: {}", file_path, e))?;

        Ok(file_path.to_string_lossy().to_string())
    }

    pub fn sync_all_notebook_mirrors(db: &DbManager, data_dir: &str) -> Result<(), String> {
        let notebooks = db
            .get_notebooks()
            .map_err(|e| format!("Failed to query notebooks: {}", e))?;

        for nb in notebooks {
            let _ = Self::sync_notebook_mirror(db, data_dir, &nb);
        }
        Ok(())
    }

    pub fn generate_mirror_html(notebook_name: &str, subject: &str, problems: &[Problem]) -> String {
        let mut problems_html = String::new();
        for p in problems {
            problems_html.push_str(&format!(
                "\n<!--{}_{}_{}-->\n",
                p.subject, p.date, p.summary
            ));
            let mut html = p.raw_html.clone();
            if let Some(ref tags) = p.tags {
                if !tags.is_empty() && !html.contains(" tags=") {
                    if let Some(pos) = html.find("<div class=\"naosu-problem\"") {
                        let after_tag = pos + "<div class=\"naosu-problem\"".len();
                        html.insert_str(after_tag, &format!(" tags=\"{}\"", tags.join(",")));
                    }
                }
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
      max-width: 860px;
      margin: 0 auto;
    }}
    .header {{
      border-bottom: 2px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }}
    .header h1 {{
      margin: 0;
      color: var(--primary);
      font-size: 26px;
      letter-spacing: 1px;
    }}
    .header .meta {{
      font-size: 14px;
      color: var(--text-sec);
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
    .sub-prompt {{
      font-weight: 600;
      margin: 10px 0 6px 0;
    }}
    .sub-item {{
      margin-bottom: 10px;
    }}
    .blank {{
      border-bottom: 1.2px solid #000;
      display: inline-block;
      vertical-align: baseline;
      margin: 0 4px;
    }}
    .blank-sm {{ width: 45px; }}
    .blank-md {{ width: 90px; }}
    .blank-lg {{ width: 150px; }}
    .blank-xl {{ width: 220px; }}
    .options {{
      display: flex;
      flex-wrap: wrap;
      gap: 16px 24px;
      margin: 12px 0;
      padding-left: 12px;
    }}
    .options span {{
      min-width: 140px;
    }}
    /* 选项分列网格 */
    .options-grid.options-4-col {{
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 6px 16px !important;
    }}
    .options-grid.options-2-col {{
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 6px 20px !important;
    }}
    .options-grid.options-1-col {{
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 6px !important;
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
    /* 试卷图文左右并排 */
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
    @media print {{
      body {{
        background: #fff;
        padding: 0;
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
      <h1>NaosuNote · {notebook_name}</h1>
      <div class="meta">学科：{subject} ｜ 收录错题：{count} 题</div>
    </div>
    <div class="problems-container">
      {problems_html}
    </div>
  </div>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: '$$', right: '$$', display: true}},
            {{left: '$', right: '$', display: false}}
          ],
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
