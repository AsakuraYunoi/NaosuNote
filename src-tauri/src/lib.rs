mod commands;
mod db;
mod mirror;
mod models;
pub mod platform;
pub mod storage;
mod utils;

use commands::*;
use mirror::MirrorManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir_path = storage::resolve_data_directory();
    storage::ensure_storage_ready(&data_dir_path);
    let default_data_dir = data_dir_path.to_string_lossy().to_string();

    let app_state = AppState::new(default_data_dir.clone());

    // 启动时确保基础学科错题本完备、孤儿题目自动挂靠，并将错题本同步到 HTML 镜像
    {
        let db_lock = app_state.db.lock().unwrap();
        let _ = db_lock.ensure_default_notebooks();
        let _ = MirrorManager::sync_all_notebook_mirrors(&db_lock, &default_data_dir);
    }

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            get_data_size,
            get_device_info,
            select_data_dir,
            get_notebooks,
            create_notebook,
            rename_notebook,
            delete_notebook,
            export_notebook_html,
            move_or_copy_problems,
            batch_delete_problems,
            batch_add_tag_to_problems,
            get_problems,
            get_problem_by_uuid,
            check_duplicate,
            save_problem,
            update_ratings,
            increment_importance,
            delete_problem,
            get_tags,
            update_problem_tags,
            update_problem_content,
            backup_database,
            open_paper_in_browser,
            export_pdf_direct,
            open_data_dir,
            open_url,
            sync_all_mirrors,
            save_answer_image,
            delete_answer_image,
            read_answer_image,
            update_problem_answer,
            create_tag,
            rename_tag,
            delete_tag,
            export_answer_image,
            save_binary_file_with_dialog,
            save_text_file_with_dialog,
            show_in_folder,
            export_problem_image,
            start_window_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
