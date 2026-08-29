// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    println!("[ClinicFlow Desktop] Initializing Tauri 2.0 Engine...");
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
