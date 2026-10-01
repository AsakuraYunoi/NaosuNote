use crate::db::DbManager;
use crate::mirror::MirrorManager;
use crate::models::{DuplicateCheckResult, Notebook, Problem, ProblemInput};
use crate::utils::levenshtein_similarity;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod dialog_helper {
    pub fn pick_folder(title: &str) -> Option<std::path::PathBuf> {
        rfd::FileDialog::new().set_title(title).pick_folder()
    }
    pub fn save_file(
        title: &str,
        default_name: &str,
        filter_name: &str,
        filter_exts: &[&str],
    ) -> Option<std::path::PathBuf> {
        rfd::FileDialog::new()
            .set_title(title)
            .set_file_name(default_name)
            .add_filter(filter_name, filter_exts)
            .save_file()
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
mod dialog_helper {
    pub fn pick_folder(_title: &str) -> Option<std::path::PathBuf> {
        None
    }
    pub fn save_file(
        _title: &str,
        _default_name: &str,
        _filter_name: &str,
        _filter_exts: &[&str],
    ) -> Option<std::path::PathBuf> {
        None
    }
}

pub struct AppState {
    pub data_dir: Mutex<String>,
    pub db: Mutex<DbManager>,
}

impl AppState {
    pub fn new(default_data_dir: String) -> Self {
        let db_path = Path::new(&default_data_dir).join("naosu.db");
        let db = DbManager::new(db_path.to_str().unwrap_or("naosu.db"));
        Self {
            data_dir: Mutex::new(default_data_dir),
            db: Mutex::new(db),
        }
    }
}

#[tauri::command]
pub fn get_data_dir(state: State<AppState>) -> String {
    state.data_dir.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_data_size(state: State<AppState>) -> Result<u64, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    fn calc_size(path: &Path) -> std::io::Result<u64> {
        let mut total = 0;
        if path.is_file() {
            return Ok(path.metadata()?.len());
        }
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        total += calc_size(&p)?;
                    } else if let Ok(meta) = entry.metadata() {
                        total += meta.len();
                    }
                }
            }
        }
        Ok(total)
    }
    calc_size(Path::new(&data_dir)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    crate::platform::open_path(&url)
}

#[tauri::command]
pub fn get_device_info(window: tauri::Window) -> Result<crate::models::DeviceInfo, String> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        let _ = window;
        return Ok(crate::models::DeviceInfo {
            platform: "desktop".into(),
            form_factor: "desktop".into(),
            os: std::env::consts::OS.into(),
            screen_width_dp: 1200.0,
        });
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let size = window.inner_size().unwrap_or(tauri::PhysicalSize::new(0, 0));
        let scale = window.scale_factor().unwrap_or(1.0);
        let width_dp = if scale > 0.0 { (size.width as f64) / scale } else { 0.0 };
        let is_pad = width_dp >= 600.0;
        let os_str = if cfg!(target_os = "ios") { "ios" } else { "android" };
        return Ok(crate::models::DeviceInfo {
            platform: "mobile".into(),
            form_factor: if is_pad { "pad".into() } else { "phone".into() },
            os: os_str.into(),
            screen_width_dp: width_dp,
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux", target_os = "android", target_os = "ios")))]
    {
        let _ = window;
        return Ok(crate::models::DeviceInfo {
            platform: "desktop".into(),
            form_factor: "desktop".into(),
            os: "unknown".into(),
            screen_width_dp: 1200.0,
        });
    }
}

#[tauri::command]
pub fn select_data_dir(state: State<AppState>) -> Result<Option<String>, String> {
    if let Some(folder) = dialog_helper::pick_folder("选择 NaosuNote 数据存放目录") {
        let folder_str = folder.to_string_lossy().to_string();
        let db_path = folder.join("naosu.db");
        let new_db = DbManager::new(db_path.to_str().unwrap());

        *state.data_dir.lock().unwrap() = folder_str.clone();
        *state.db.lock().unwrap() = new_db;

        let db_ref = state.db.lock().unwrap();
        let _ = MirrorManager::sync_all_notebook_mirrors(&db_ref, &folder_str);

        Ok(Some(folder_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn open_data_dir(state: State<AppState>) -> Result<(), String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&data_dir).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(&data_dir).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&data_dir).spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn sync_all_mirrors(state: State<AppState>) -> Result<(), String> {
    let (data_dir, db) = {
        let dir = state.data_dir.lock().unwrap().clone();
        let db = state.db.lock().unwrap();
        (dir, db)
    };
    MirrorManager::sync_all_notebook_mirrors(&db, &data_dir)?;
    Ok(())
}

// --- 错题本 Commands ---

#[tauri::command]
pub fn get_notebooks(state: State<AppState>) -> Result<Vec<Notebook>, String> {
    let db = state.db.lock().unwrap();
    db.get_notebooks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_notebook(
    state: State<AppState>,
    name: String,
    subject: String,
) -> Result<Notebook, String> {
    let (nb, data_dir) = {
        let db = state.db.lock().unwrap();
        let created = db.create_notebook(&name, &subject).map_err(|e| e.to_string())?;
        (created, state.data_dir.lock().unwrap().clone())
    };

    let db = state.db.lock().unwrap();
    let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);

    Ok(nb)
}

#[tauri::command]
pub fn rename_notebook(
    state: State<AppState>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let (old_nb, data_dir) = {
        let db = state.db.lock().unwrap();
        let old = db.get_notebook_by_id(&id).map_err(|e| e.to_string())?;
        db.rename_notebook(&id, &new_name).map_err(|e| e.to_string())?;
        (old, state.data_dir.lock().unwrap().clone())
    };

    if let Some(old) = old_nb {
        MirrorManager::delete_notebook_mirror(&data_dir, &old);
    }

    let db = state.db.lock().unwrap();
    if let Some(nb) = db.get_notebook_by_id(&id).map_err(|e| e.to_string())? {
        let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
    }
    Ok(())
}

#[tauri::command]
pub fn delete_notebook(state: State<AppState>, id: String) -> Result<(), String> {
    let (nb_opt, data_dir) = {
        let db = state.db.lock().unwrap();
        let nb = db.get_notebook_by_id(&id).map_err(|e| e.to_string())?;
        db.delete_notebook(&id).map_err(|e| e.to_string())?;
        (nb, state.data_dir.lock().unwrap().clone())
    };

    if let Some(nb) = nb_opt {
        MirrorManager::delete_notebook_mirror(&data_dir, &nb);
    }
    Ok(())
}

#[tauri::command]
pub fn export_notebook_html(
    state: State<AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let (html_content, default_name) = {
        let db = state.db.lock().unwrap();
        let nb = db
            .get_notebook_by_id(&id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Notebook with id {} not found", id))?;

        let problems = db.get_problems_by_notebook(&id).map_err(|e| e.to_string())?;
        let data_dir = state.data_dir.lock().unwrap().clone();
        let content = MirrorManager::generate_mirror_html(&nb.name, &nb.subject, &problems, Some(&data_dir));
        let safe_name = format!("{}.html", MirrorManager::sanitize_filename(&nb.name));
        (content, safe_name)
    };

    if let Some(dest_path) = dialog_helper::save_file(
        "导出错题本为独立离线 HTML",
        &default_name,
        "HTML Document",
        &["html", "htm"],
    ) {
        fs::write(&dest_path, html_content)
            .map_err(|e| format!("Failed to write HTML file: {}", e))?;
        Ok(Some(dest_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

// --- 错题 Commands ---

#[tauri::command]
pub fn get_problems(
    state: State<AppState>,
    notebook_id: Option<String>,
    subject: Option<String>,
    problem_type: Option<String>,
    tags: Option<Vec<String>>,
    search: Option<String>,
    sort_by: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Problem>, String> {
    let db = state.db.lock().unwrap();
    db.get_all_problems(notebook_id, subject, problem_type, tags, search, sort_by, start_date, end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_tag(
    state: State<AppState>,
    name: String,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.create_tag(&name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_tag(
    state: State<AppState>,
    old_name: String,
    new_name: String,
) -> Result<usize, String> {
    let (count, data_dir) = {
        let db = state.db.lock().unwrap();
        let c = db.rename_tag(&old_name, &new_name).map_err(|e| e.to_string())?;
        (c, state.data_dir.lock().unwrap().clone())
    };
    if count > 0 {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_all_notebook_mirrors(&db, &data_dir);
    }
    Ok(count)
}

#[tauri::command]
pub fn delete_tag(
    state: State<AppState>,
    name: String,
) -> Result<usize, String> {
    let (count, data_dir) = {
        let db = state.db.lock().unwrap();
        let c = db.delete_tag(&name).map_err(|e| e.to_string())?;
        (c, state.data_dir.lock().unwrap().clone())
    };
    if count > 0 {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_all_notebook_mirrors(&db, &data_dir);
    }
    Ok(count)
}

#[tauri::command]
pub fn get_tags(
    state: State<AppState>,
    notebook_id: Option<String>,
    subject: Option<String>,
) -> Result<Vec<crate::models::TagCount>, String> {
    let db = state.db.lock().unwrap();
    db.get_tags_by_scope(subject.as_deref(), notebook_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_problem_tags(
    state: State<AppState>,
    uuid: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let (nb_opt, data_dir) = {
        let db = state.db.lock().unwrap();
        db.update_problem_tags(&uuid, &tags).map_err(|e| e.to_string())?;
        let prob = db.get_problem_by_uuid(&uuid).map_err(|e| e.to_string())?;
        let nb = if let Some(p) = prob {
            if let Some(ref nid) = p.notebook_id {
                db.get_notebook_by_id(nid).ok().flatten()
            } else {
                None
            }
        } else {
            None
        };
        (nb, state.data_dir.lock().unwrap().clone())
    };

    if let Some(nb) = nb_opt {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
    }

    Ok(())
}

#[tauri::command]
pub fn update_problem_content(
    state: State<AppState>,
    uuid: String,
    raw_html: String,
    stem_clean_text: String,
    summary: String,
    problem_type: String,
) -> Result<(), String> {
    let (nb_opt, data_dir) = {
        let db = state.db.lock().unwrap();
        db.update_problem_content(&uuid, &raw_html, &stem_clean_text, &summary, &problem_type)
            .map_err(|e| e.to_string())?;

        // 确保默认错题本完备，并执行孤儿题目自愈
        let _ = db.ensure_default_notebooks();

        let prob = db.get_problem_by_uuid(&uuid).map_err(|e| e.to_string())?;
        let nb = if let Some(p) = prob {
            if let Some(ref nid) = p.notebook_id {
                db.get_notebook_by_id(nid).ok().flatten()
            } else {
                // 如果题目仍未绑定错题本，查出该学科默认错题本并补绑
                let nbs = db.get_notebooks().unwrap_or_default();
                if let Some(matched) = nbs.into_iter().find(|n| n.subject == p.subject) {
                    let _ = db.batch_move_problems(&[uuid.clone()], &matched.id, &matched.subject);
                    Some(matched)
                } else {
                    None
                }
            }
        } else {
            None
        };
        (nb, state.data_dir.lock().unwrap().clone())
    };

    if let Some(nb) = nb_opt {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
    }

    Ok(())
}


#[tauri::command]
pub fn get_problem_by_uuid(state: State<AppState>, uuid: String) -> Result<Option<Problem>, String> {
    let db = state.db.lock().unwrap();
    db.get_problem_by_uuid(&uuid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_duplicate(
    state: State<AppState>,
    subject: String,
    stem_clean_text: String,
    threshold: Option<f64>,
) -> Result<DuplicateCheckResult, String> {
    let db = state.db.lock().unwrap();
    let threshold_val = threshold.unwrap_or(0.85);

    // 在同门学科中搜索
    let candidates = db
        .get_all_problems(None, Some(subject), None, None, None, None, None, None)
        .map_err(|e| e.to_string())?;

    let mut max_sim = 0.0;
    let mut matched_problem = None;

    for candidate in candidates {
        let sim = levenshtein_similarity(&stem_clean_text, &candidate.stem_clean_text);
        if sim > max_sim {
            max_sim = sim;
            matched_problem = Some(candidate);
        }
    }

    if max_sim >= threshold_val {
        Ok(DuplicateCheckResult {
            is_duplicate: true,
            similarity: (max_sim * 100.0).round() / 100.0,
            existing_problem: matched_problem,
        })
    } else {
        Ok(DuplicateCheckResult {
            is_duplicate: false,
            similarity: (max_sim * 100.0).round() / 100.0,
            existing_problem: None,
        })
    }
}

#[tauri::command]
pub fn save_problem(state: State<AppState>, mut input: ProblemInput) -> Result<Problem, String> {
    let (data_dir, nb_opt, problem) = {
        let db = state.db.lock().unwrap();
        let _ = db.ensure_default_notebooks();

        // 若传入的 notebook_id 为空，自动匹配其所属学科的默认错题本
        if input.notebook_id.is_none() || input.notebook_id.as_deref() == Some("") {
            let nbs = db.get_notebooks().unwrap_or_default();
            if let Some(matched) = nbs.into_iter().find(|n| n.subject == input.subject) {
                input.notebook_id = Some(matched.id);
            }
        }

        let uuid = input
            .uuid
            .filter(|id| !id.trim().is_empty())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let mut raw_html = input.raw_html.clone();
        if !raw_html.contains(&format!("uuid=\"{}\"", uuid)) {
            if let Some(pos) = raw_html.find("<div class=\"naosu-problem\"") {
                let after_tag = pos + "<div class=\"naosu-problem\"".len();
                raw_html.insert_str(after_tag, &format!(" uuid=\"{}\"", uuid));
            }
        }

        let problem = Problem {
            uuid: uuid.clone(),
            notebook_id: input.notebook_id.clone(),
            subject: input.subject.clone(),
            problem_type: input.problem_type.clone(),
            date: input.date.clone(),
            summary: input.summary.clone(),
            raw_html,
            stem_clean_text: input.stem_clean_text.clone(),
            difficulty: 1,
            importance: 1,
            tags: input.tags.clone(),
            answer_markdown: input.answer_markdown.clone(),
            answer_images: input.answer_images.clone(),
            created_at: None,
            updated_at: None,
        };

        db.insert_problem(&problem).map_err(|e| e.to_string())?;

        let nb = if let Some(ref nid) = problem.notebook_id {
            db.get_notebook_by_id(nid).ok().flatten()
        } else {
            None
        };

        (state.data_dir.lock().unwrap().clone(), nb, problem)
    };

    // 同步写入错题本 HTML 镜像
    if let Some(nb) = nb_opt {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
    }

    Ok(problem)
}

#[tauri::command]
pub fn update_ratings(
    state: State<AppState>,
    uuid: String,
    difficulty: Option<i32>,
    importance: Option<i32>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.update_ratings(&uuid, difficulty, importance)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn increment_importance(state: State<AppState>, uuid: String) -> Result<i32, String> {
    let db = state.db.lock().unwrap();
    db.increment_importance(&uuid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_problem(state: State<AppState>, uuid: String) -> Result<(), String> {
    let (nb_opt, data_dir) = {
        let db = state.db.lock().unwrap();
        let problem = db
            .get_problem_by_uuid(&uuid)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Problem not found".to_string())?;
        db.delete_problem(&uuid).map_err(|e| e.to_string())?;
        let nb = if let Some(ref nid) = problem.notebook_id {
            db.get_notebook_by_id(nid).ok().flatten()
        } else {
            None
        };
        (nb, state.data_dir.lock().unwrap().clone())
    };

    if let Some(nb) = nb_opt {
        let db = state.db.lock().unwrap();
        let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
    }

    Ok(())
}

#[tauri::command]
pub fn move_or_copy_problems(
    state: State<AppState>,
    uuids: Vec<String>,
    target_notebook_id: String,
    is_copy: bool,
) -> Result<usize, String> {
    if uuids.is_empty() {
        return Ok(0);
    }
    let (target_nb, affected_notebook_ids, data_dir) = {
        let db = state.db.lock().unwrap();
        let target = db
            .get_notebook_by_id(&target_notebook_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Target notebook {} not found", target_notebook_id))?;

        let mut affected: Vec<String> = Vec::new();
        if !is_copy {
            for u in &uuids {
                if let Ok(Some(p)) = db.get_problem_by_uuid(u) {
                    if let Some(nid) = p.notebook_id {
                        if !affected.contains(&nid) {
                            affected.push(nid);
                        }
                    }
                }
            }
        }
        (target, affected, state.data_dir.lock().unwrap().clone())
    };

    let count = {
        let db = state.db.lock().unwrap();
        if is_copy {
            let copied = db
                .batch_copy_problems(&uuids, &target_notebook_id, &target_nb.subject)
                .map_err(|e| e.to_string())?;
            copied.len()
        } else {
            db.batch_move_problems(&uuids, &target_notebook_id, &target_nb.subject)
                .map_err(|e| e.to_string())?
        }
    };

    // 同步镜像
    let db = state.db.lock().unwrap();
    let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &target_nb);

    for nid in affected_notebook_ids {
        if nid != target_notebook_id {
            if let Ok(Some(nb)) = db.get_notebook_by_id(&nid) {
                let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
            }
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn batch_delete_problems(
    state: State<AppState>,
    uuids: Vec<String>,
) -> Result<usize, String> {
    if uuids.is_empty() {
        return Ok(0);
    }
    let (affected_notebook_ids, data_dir) = {
        let db = state.db.lock().unwrap();
        let mut affected: Vec<String> = Vec::new();
        for u in &uuids {
            if let Ok(Some(p)) = db.get_problem_by_uuid(u) {
                if let Some(nid) = p.notebook_id {
                    if !affected.contains(&nid) {
                        affected.push(nid);
                    }
                }
            }
        }
        (affected, state.data_dir.lock().unwrap().clone())
    };

    let count = {
        let db = state.db.lock().unwrap();
        db.batch_delete_problems(&uuids).map_err(|e| e.to_string())?
    };

    let db = state.db.lock().unwrap();
    for nid in affected_notebook_ids {
        if let Ok(Some(nb)) = db.get_notebook_by_id(&nid) {
            let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn batch_add_tag_to_problems(
    state: State<AppState>,
    uuids: Vec<String>,
    tag: String,
) -> Result<usize, String> {
    if uuids.is_empty() || tag.trim().is_empty() {
        return Ok(0);
    }
    let (affected_notebook_ids, data_dir) = {
        let db = state.db.lock().unwrap();
        let mut affected: Vec<String> = Vec::new();
        for u in &uuids {
            if let Ok(Some(p)) = db.get_problem_by_uuid(u) {
                if let Some(nid) = p.notebook_id {
                    if !affected.contains(&nid) {
                        affected.push(nid);
                    }
                }
            }
        }
        (affected, state.data_dir.lock().unwrap().clone())
    };

    let count = {
        let db = state.db.lock().unwrap();
        db.batch_add_tag_to_problems(&uuids, &tag)
            .map_err(|e| e.to_string())?
    };

    let db = state.db.lock().unwrap();
    for nid in affected_notebook_ids {
        if let Ok(Some(nb)) = db.get_notebook_by_id(&nid) {
            let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn backup_database(state: State<AppState>) -> Result<Option<String>, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let src_db = Path::new(&data_dir).join("naosu.db");
    if !src_db.exists() {
        return Err("Database file does not exist yet".to_string());
    }

    if let Some(dest) = dialog_helper::save_file(
        "备份 SQLite 数据库",
        "naosu_backup.db",
        "SQLite Database",
        &["db", "sqlite"],
    ) {
        fs::copy(&src_db, &dest).map_err(|e| format!("Failed to backup db: {}", e))?;
        Ok(Some(dest.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

// --- 打印与系统浏览器高保真导出 PDF ---

#[tauri::command]
pub fn open_paper_in_browser(
    state: State<AppState>,
    paper_html: String,
) -> Result<String, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let print_file = Path::new(&data_dir).join("print_preview.html");

    fs::write(&print_file, paper_html)
        .map_err(|e| format!("Failed to write print html: {}", e))?;

    let path_str = print_file.to_string_lossy().to_string();
    crate::platform::open_path(&path_str)?;

    Ok(path_str)
}

#[tauri::command]
pub fn export_pdf_direct(
    state: State<AppState>,
    paper_html: String,
    title: Option<String>,
) -> Result<Option<String>, String> {
    let file_title = title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| "错题重练专项卷".to_string());
    let default_file_name = format!("{}.pdf", file_title);

    if let Some(dest_path) = dialog_helper::save_file(
        "直接导出 PDF 试卷",
        &default_file_name,
        "PDF Document",
        &["pdf"],
    ) {
        let data_dir = state.data_dir.lock().unwrap().clone();
        crate::platform::export_html_to_pdf(&paper_html, &dest_path, Path::new(&data_dir))?;
        return Ok(Some(dest_path.to_string_lossy().to_string()));
    }

    Ok(None)
}

#[tauri::command]
pub fn save_answer_image(
    state: State<AppState>,
    uuid: String,
    page_index: u32,
    image_bytes: Vec<u8>,
) -> Result<String, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let img_dir = Path::new(&data_dir).join("ImgData");
    if !img_dir.exists() {
        fs::create_dir_all(&img_dir).map_err(|e| format!("创建 ImgData 目录失败: {}", e))?;
    }

    let filename = format!("{}_p{}.webp", uuid, page_index);
    let target_path = img_dir.join(&filename);

    fs::write(&target_path, &image_bytes).map_err(|e| format!("写入图片文件失败: {}", e))?;

    Ok(filename)
}

#[tauri::command]
pub fn delete_answer_image(
    state: State<AppState>,
    filename: String,
) -> Result<(), String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let target_path = Path::new(&data_dir).join("ImgData").join(&filename);
    if target_path.exists() {
        let _ = fs::remove_file(target_path);
    }
    Ok(())
}

#[tauri::command]
pub fn read_answer_image(
    state: State<AppState>,
    filename: String,
) -> Result<Vec<u8>, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let target_path = Path::new(&data_dir).join("ImgData").join(&filename);
    if !target_path.exists() {
        return Err(format!("图片不存在: {}", filename));
    }
    fs::read(&target_path).map_err(|e| format!("读取图片文件失败: {}", e))
}

#[tauri::command]
pub fn update_problem_answer(
    state: State<AppState>,
    uuid: String,
    answer_markdown: String,
    answer_images: Vec<String>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let images_json = serde_json::to_string(&answer_images).unwrap_or_else(|_| "[]".to_string());
    db.update_problem_answer(&uuid, &answer_markdown, &images_json)
        .map_err(|e| format!("更新答案失败: {}", e))?;

    if let Ok(Some(p)) = db.get_problem_by_uuid(&uuid) {
        if let Some(ref nb_id) = p.notebook_id {
            if let Ok(Some(nb)) = db.get_notebook_by_id(nb_id) {
                let data_dir = state.data_dir.lock().unwrap().clone();
                let _ = MirrorManager::sync_notebook_mirror(&db, &data_dir, &nb);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn export_answer_image(
    state: State<AppState>,
    filename: String,
    suggested_name: Option<String>,
) -> Result<Option<String>, String> {
    let data_dir = state.data_dir.lock().unwrap().clone();
    let src_path = Path::new(&data_dir).join("ImgData").join(&filename);
    if !src_path.exists() {
        return Err(format!("图片文件不存在: {}", filename));
    }

    let default_name = suggested_name.unwrap_or_else(|| filename.clone());
    let ext = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("webp");

    if let Some(dest_path) = dialog_helper::save_file(
        "下载并保存答案图片",
        &default_name,
        "图片文件",
        &[ext, "png", "jpg", "jpeg", "webp"],
    ) {
        fs::copy(&src_path, &dest_path).map_err(|e| format!("保存图片失败: {}", e))?;
        Ok(Some(dest_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_binary_file_with_dialog(
    title: String,
    default_name: String,
    filter_name: String,
    filter_exts: Vec<String>,
    data: Vec<u8>,
) -> Result<Option<String>, String> {
    let ext_slices: Vec<&str> = filter_exts.iter().map(|s| s.as_str()).collect();
    if let Some(dest_path) = dialog_helper::save_file(
        &title,
        &default_name,
        &filter_name,
        &ext_slices,
    ) {
        fs::write(&dest_path, &data).map_err(|e| format!("保存文件失败: {}", e))?;
        Ok(Some(dest_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_text_file_with_dialog(
    title: String,
    default_name: String,
    filter_name: String,
    filter_exts: Vec<String>,
    content: String,
) -> Result<Option<String>, String> {
    let ext_slices: Vec<&str> = filter_exts.iter().map(|s| s.as_str()).collect();
    if let Some(dest_path) = dialog_helper::save_file(
        &title,
        &default_name,
        &filter_name,
        &ext_slices,
    ) {
        fs::write(&dest_path, &content).map_err(|e| format!("保存文件失败: {}", e))?;
        Ok(Some(dest_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    crate::platform::show_in_folder(&path)
}

#[tauri::command]
pub fn export_problem_image(
    state: State<AppState>,
    paper_html: String,
    title: Option<String>,
) -> Result<Option<String>, String> {
    let file_title = title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| "题目".to_string());
    let default_file_name = format!("{}.png", file_title);

    if let Some(dest_path) = dialog_helper::save_file(
        "导出题目图片",
        &default_file_name,
        "PNG 图片",
        &["png"],
    ) {
        let data_dir = state.data_dir.lock().unwrap().clone();
        crate::platform::export_html_to_image(&paper_html, &dest_path, Path::new(&data_dir))?;
        return Ok(Some(dest_path.to_string_lossy().to_string()));
    }

    Ok(None)
}

#[tauri::command]
pub fn start_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        window.start_dragging().map_err(|e| e.to_string())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = window;
        Ok(())
    }
}
