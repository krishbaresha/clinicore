// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

/// Get the CliniCore data directory: %APPDATA%/CliniCore/data/
fn get_data_dir() -> PathBuf {
    let base = dirs_next().unwrap_or_else(|| std::env::current_dir().unwrap());
    let data_dir = base.join("data");
    if !data_dir.exists() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir
}

/// Platform-aware AppData directory resolver
fn dirs_next() -> Option<PathBuf> {
    // Windows: C:\Users\<User>\AppData\Roaming\CliniCore
    // Linux:   ~/.local/share/CliniCore
    // macOS:   ~/Library/Application Support/CliniCore
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return Some(PathBuf::from(appdata).join("CliniCore"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join(".local").join("share").join("CliniCore"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join("Library").join("Application Support").join("CliniCore"));
        }
    }
    None
}

/// Read a collection JSON file from disk. Returns the raw JSON string or empty "[]".
#[tauri::command]
fn read_collection(key: String) -> String {
    let path = get_data_dir().join(format!("{}.json", key));
    match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(_) => String::from(""),
    }
}

/// Write a collection JSON string to disk atomically.
/// Uses write-to-temp + rename pattern for crash safety.
#[tauri::command]
fn write_collection(key: String, value: String) -> Result<(), String> {
    let data_dir = get_data_dir();
    let path = data_dir.join(format!("{}.json", key));
    let tmp_path = data_dir.join(format!("{}.json.tmp", key));

    // Write to temp file first
    fs::write(&tmp_path, &value).map_err(|e| format!("Write failed: {}", e))?;
    // Atomic rename
    fs::rename(&tmp_path, &path).map_err(|e| format!("Rename failed: {}", e))?;

    Ok(())
}

/// Remove a collection JSON file from disk.
#[tauri::command]
fn remove_collection(key: String) -> Result<(), String> {
    let path = get_data_dir().join(format!("{}.json", key));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Remove failed: {}", e))?;
    }
    Ok(())
}

/// List all collection keys (filenames without .json extension) in the data directory.
#[tauri::command]
fn list_collection_keys() -> Vec<String> {
    let data_dir = get_data_dir();
    let mut keys = Vec::new();
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".json") && !name.ends_with(".tmp") {
                    keys.push(name.trim_end_matches(".json").to_string());
                }
            }
        }
    }
    keys
}

/// Get the absolute path to the data directory (for UI display).
#[tauri::command]
fn get_data_path() -> String {
    get_data_dir().to_string_lossy().to_string()
}

/// Save an update installer binary to the Windows %TEMP% directory.
#[tauri::command]
fn save_update_binary(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to write update binary: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

/// Launch the downloaded installer in silent mode (/S) and exit current process
/// so Windows file locks are released cleanly.
#[tauri::command]
fn launch_silent_update(installer_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let path = std::path::PathBuf::from(&installer_path);
        if !path.exists() {
            return Err(format!("Installer not found at: {}", installer_path));
        }

        std::process::Command::new(&installer_path)
            .arg("/S")
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        std::thread::sleep(std::time::Duration::from_millis(300));
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Silent installer is currently supported on Windows".to_string())
    }
}

/// Background fallback: downloads installer via native PowerShell and runs silently.
#[tauri::command]
fn download_and_run_installer(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let temp_dir = std::env::temp_dir();
        let target_exe = temp_dir.join("clinicore_update_setup.exe");
        let target_str = target_exe.to_string_lossy().to_string();

        let ps_cmd = format!(
            "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
             (New-Object System.Net.WebClient).DownloadFile('{url}', '{target}'); \
             Start-Process '{target}' -ArgumentList '/S'",
            url = url,
            target = target_str
        );

        std::process::Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_cmd])
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to launch background updater: {}", e))?;

        std::thread::sleep(std::time::Duration::from_millis(400));
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-update is currently supported on Windows".to_string())
    }
}

fn main() {
    println!("[ClinicFlow Desktop] Initializing Tauri 2.0 Engine...");
    println!("[ClinicFlow Desktop] Data directory: {:?}", get_data_dir());
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_collection,
            write_collection,
            remove_collection,
            list_collection_keys,
            get_data_path,
            save_update_binary,
            launch_silent_update,
            download_and_run_installer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
