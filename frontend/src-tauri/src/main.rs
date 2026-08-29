// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    println!("[ClinicFlow Desktop] Initializing Tauri 2.0 Engine...");
    tauri::Builder::default()
        .setup(|app| {
            println!("[ClinicFlow Desktop] Booting application window...");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
