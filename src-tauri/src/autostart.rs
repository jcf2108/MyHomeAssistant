use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::CheckMenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};

const APP_RUN_VALUE_NAME: &str = "MyHomeAssistant";
const LEGACY_RUN_VALUE_NAME: &str = "my-home-assistant";

#[derive(Default)]
pub struct AutostartTrayState(pub Mutex<Option<CheckMenuItem<Wry>>>);

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedAutostartMeta {
    pub initialized: bool,
}

fn autostart_meta_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("autostart_state.json"))
}

fn is_autostart_initialized(app: &AppHandle) -> bool {
    let Some(path) = autostart_meta_path(app) else {
        return false;
    };
    let Ok(raw) = std::fs::read_to_string(path) else {
        return false;
    };
    serde_json::from_str::<PersistedAutostartMeta>(&raw)
        .map(|m| m.initialized)
        .unwrap_or(false)
}

fn mark_autostart_initialized(app: &AppHandle) {
    if let Some(path) = autostart_meta_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(&PersistedAutostartMeta { initialized: true }) {
            let _ = std::fs::write(path, json);
        }
    }
}

#[cfg(windows)]
mod win_reg {
    use super::{APP_RUN_VALUE_NAME, LEGACY_RUN_VALUE_NAME};
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW,
        RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_READ, KEY_SET_VALUE,
        REG_BINARY, REG_OPTION_NON_VOLATILE, REG_SZ,
    };

    const RUN_SUBKEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const STARTUP_APPROVED_SUBKEY: &str =
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    const STARTUP_APPROVED_ENABLED: [u8; 12] =
        [0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn quoted_current_exe() -> Result<String, String> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let raw = exe.to_string_lossy();
        let cleaned = raw.trim_start_matches(r"\\?\");
        Ok(format!("\"{cleaned}\""))
    }

    pub fn is_enabled() -> bool {
        unsafe {
            let run_subkey = to_wide(RUN_SUBKEY);
            let value_name = to_wide(APP_RUN_VALUE_NAME);
            let mut hkey = HKEY::default();

            let open_status = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(run_subkey.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );
            if open_status != ERROR_SUCCESS {
                return false;
            }

            let mut byte_len: u32 = 0;
            let query_status = RegQueryValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                None,
                None,
                None,
                Some(&mut byte_len),
            );
            let _ = RegCloseKey(hkey);

            if query_status != ERROR_SUCCESS || byte_len <= 2 {
                return false;
            }

            // Vérifie si l'utilisateur l'a désactivé dans le Gestionnaire des tâches Windows 11
            let approved_subkey = to_wide(STARTUP_APPROVED_SUBKEY);
            let mut approved_key = HKEY::default();
            if RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(approved_subkey.as_ptr()),
                0,
                KEY_READ,
                &mut approved_key,
            ) == ERROR_SUCCESS
            {
                let mut buf = [0u8; 24];
                let mut sz = buf.len() as u32;
                let st = RegQueryValueExW(
                    approved_key,
                    PCWSTR(value_name.as_ptr()),
                    None,
                    None,
                    Some(buf.as_mut_ptr()),
                    Some(&mut sz),
                );
                let _ = RegCloseKey(approved_key);
                if st == ERROR_SUCCESS && sz >= 1 {
                    // Dans StartupApproved\Run, un octet initial impair (0x03, 0x01...) signifie désactivé
                    if (buf[0] & 1) == 1 {
                        return false;
                    }
                }
            }

            true
        }
    }

    pub fn set_enabled(enable: bool) -> Result<(), String> {
        unsafe {
            let run_subkey = to_wide(RUN_SUBKEY);
            let app_value = to_wide(APP_RUN_VALUE_NAME);
            let legacy_value = to_wide(LEGACY_RUN_VALUE_NAME);
            let approved_subkey = to_wide(STARTUP_APPROVED_SUBKEY);

            if enable {
                let cmd = quoted_current_exe()?;
                let cmd_wide = to_wide(&cmd);
                let cmd_bytes = std::slice::from_raw_parts(
                    cmd_wide.as_ptr() as *const u8,
                    cmd_wide.len() * std::mem::size_of::<u16>(),
                );

                let mut run_key = HKEY::default();
                let create_status = RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(run_subkey.as_ptr()),
                    0,
                    PCWSTR::null(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE | KEY_QUERY_VALUE,
                    None,
                    &mut run_key,
                    None,
                );
                if create_status != ERROR_SUCCESS {
                    return Err(format!("Registre Run inaccessible ({:?})", create_status));
                }

                let set_status = RegSetValueExW(
                    run_key,
                    PCWSTR(app_value.as_ptr()),
                    0,
                    REG_SZ,
                    Some(cmd_bytes),
                );
                // Nettoie l'ancienne entrée non quotée éventuelle de tauri-plugin-autostart
                let _ = RegDeleteValueW(run_key, PCWSTR(legacy_value.as_ptr()));
                let _ = RegCloseKey(run_key);

                if set_status != ERROR_SUCCESS {
                    return Err(format!("Écriture Run refusée ({:?})", set_status));
                }

                // Marque explicitement l'application comme approuvée dans Windows 11 Startup Apps
                let mut approved_key = HKEY::default();
                if RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(approved_subkey.as_ptr()),
                    0,
                    PCWSTR::null(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE,
                    None,
                    &mut approved_key,
                    None,
                ) == ERROR_SUCCESS
                {
                    let _ = RegSetValueExW(
                        approved_key,
                        PCWSTR(app_value.as_ptr()),
                        0,
                        REG_BINARY,
                        Some(&STARTUP_APPROVED_ENABLED),
                    );
                    let _ = RegDeleteValueW(approved_key, PCWSTR(legacy_value.as_ptr()));
                    let _ = RegCloseKey(approved_key);
                }
            } else {
                let mut run_key = HKEY::default();
                if RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(run_subkey.as_ptr()),
                    0,
                    KEY_SET_VALUE,
                    &mut run_key,
                ) == ERROR_SUCCESS
                {
                    let st = RegDeleteValueW(run_key, PCWSTR(app_value.as_ptr()));
                    let _ = RegDeleteValueW(run_key, PCWSTR(legacy_value.as_ptr()));
                    let _ = RegCloseKey(run_key);
                    if st != ERROR_SUCCESS && st != ERROR_FILE_NOT_FOUND {
                        return Err(format!("Suppression Run refusée ({:?})", st));
                    }
                }

                let mut approved_key = HKEY::default();
                if RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(approved_subkey.as_ptr()),
                    0,
                    KEY_SET_VALUE,
                    &mut approved_key,
                ) == ERROR_SUCCESS
                {
                    let _ = RegDeleteValueW(approved_key, PCWSTR(app_value.as_ptr()));
                    let _ = RegDeleteValueW(approved_key, PCWSTR(legacy_value.as_ptr()));
                    let _ = RegCloseKey(approved_key);
                }
            }

            Ok(())
        }
    }
}

#[cfg(not(windows))]
mod win_reg {
    pub fn is_enabled() -> bool {
        false
    }

    pub fn set_enabled(_enable: bool) -> Result<(), String> {
        Ok(())
    }
}

/// Initialise le lancement automatique au premier démarrage, ou rafraîchit le chemin de l'exécutable s'il est déjà actif.
pub fn initialize_autostart_on_boot(app: &AppHandle) -> bool {
    if !is_autostart_initialized(app) {
        let _ = win_reg::set_enabled(true);
        mark_autostart_initialized(app);
        return win_reg::is_enabled();
    }

    let currently_enabled = win_reg::is_enabled();
    if currently_enabled {
        // Met à jour le chemin quoté de l'exécutable si une mise à jour l'a déplacé
        let _ = win_reg::set_enabled(true);
    }
    currently_enabled
}

pub fn apply_and_broadcast_autostart(app: &AppHandle, enabled: bool) -> Result<bool, String> {
    win_reg::set_enabled(enabled)?;
    mark_autostart_initialized(app);
    let confirmed = win_reg::is_enabled();

    if let Some(tray_state) = app.try_state::<AutostartTrayState>() {
        if let Ok(guard) = tray_state.0.lock() {
            if let Some(check_item) = guard.as_ref() {
                let _ = check_item.set_checked(confirmed);
            }
        }
    }

    let _ = app.emit("autostart-changed", confirmed);
    Ok(confirmed)
}

#[tauri::command]
pub fn get_autostart_status() -> bool {
    win_reg::is_enabled()
}

#[tauri::command]
pub fn set_autostart_status(app: AppHandle, enabled: bool) -> Result<bool, String> {
    apply_and_broadcast_autostart(&app, enabled)
}
