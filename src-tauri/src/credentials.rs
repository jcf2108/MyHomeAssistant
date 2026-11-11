#[cfg(windows)]
mod win_cred {
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
        CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    const TARGET_NAME: &str = "MyHomeAssistant/ha_access_token";

    fn to_wide_null(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn save_token(token: &str) -> Result<(), String> {
        let mut target_wide = to_wide_null(TARGET_NAME);
        let mut user_wide = to_wide_null("HomeAssistant");
        let blob: Vec<u8> = token.as_bytes().to_vec();

        let cred = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_wide.as_mut_ptr()),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(user_wide.as_mut_ptr()),
        };

        unsafe {
            CredWriteW(&cred, 0).map_err(|e| format!("Échec écriture coffre Windows: {e}"))
        }
    }

    pub fn read_token() -> Result<Option<String>, String> {
        let target_wide = to_wide_null(TARGET_NAME);
        let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();

        let read_res =
            unsafe { CredReadW(PCWSTR(target_wide.as_ptr()), CRED_TYPE_GENERIC, 0, &mut pcred) };

        if read_res.is_err() || pcred.is_null() {
            return Ok(None);
        }

        let result = unsafe {
            let cred = &*pcred;
            if cred.CredentialBlob.is_null() || cred.CredentialBlobSize == 0 {
                Ok(None)
            } else {
                let slice = std::slice::from_raw_parts(
                    cred.CredentialBlob,
                    cred.CredentialBlobSize as usize,
                );
                String::from_utf8(slice.to_vec())
                    .map(Some)
                    .map_err(|e| format!("Jeton invalide dans le coffre: {e}"))
            }
        };

        unsafe {
            CredFree(pcred as *const _);
        }

        result
    }

    pub fn delete_token() -> Result<(), String> {
        let target_wide = to_wide_null(TARGET_NAME);
        unsafe {
            let _ = CredDeleteW(PCWSTR(target_wide.as_ptr()), CRED_TYPE_GENERIC, 0);
        }
        Ok(())
    }
}

#[tauri::command]
pub fn save_ha_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = app;
        win_cred::save_token(&token)
    }
    #[cfg(not(windows))]
    {
        use tauri::Manager;
        let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(".ha_token");
        std::fs::write(&path, token.as_bytes()).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
}

#[tauri::command]
pub fn get_ha_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let _ = app;
        win_cred::read_token()
    }
    #[cfg(not(windows))]
    {
        use tauri::Manager;
        let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        let path = dir.join(".ha_token");
        if !path.exists() {
            return Ok(None);
        }
        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        Ok(Some(raw))
    }
}

#[tauri::command]
pub fn delete_ha_token(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = app;
        win_cred::delete_token()
    }
    #[cfg(not(windows))]
    {
        use tauri::Manager;
        let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        let path = dir.join(".ha_token");
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
        Ok(())
    }
}
