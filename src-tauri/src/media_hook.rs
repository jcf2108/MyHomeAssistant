use std::sync::atomic::{AtomicU64, Ordering};

static PC_GRACE_SECONDS: AtomicU64 = AtomicU64::new(45);

#[tauri::command]
pub fn set_pc_grace_seconds(seconds: u64) {
    PC_GRACE_SECONDS.store(seconds, Ordering::Relaxed);
}

pub fn get_pc_grace_seconds() -> u64 {
    PC_GRACE_SECONDS.load(Ordering::Relaxed)
}

#[cfg(windows)]
pub fn spawn_windows_keyboard_hook(app: tauri::AppHandle) {
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};
    use tauri::Emitter;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE,
        VK_MEDIA_PREV_TRACK, VK_MEDIA_STOP, VK_VOLUME_DOWN, VK_VOLUME_MUTE, VK_VOLUME_UP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        HC_ACTION, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
    };

    struct HookContext {
        app: tauri::AppHandle,
        last_pc_pause: Mutex<Option<Instant>>,
    }

    static HOOK_CTX: OnceLock<HookContext> = OnceLock::new();

    #[derive(Clone, Copy)]
    struct PcMediaSnapshot {
        is_playing: bool,
        has_paused_session: bool,
    }

    fn query_pc_media_state() -> PcMediaSnapshot {
        let mut is_playing = false;
        let mut has_paused_session = false;

        // 1. Vérification des sessions SMTC Windows (navigateurs, Spotify, VLC, etc.)
        if let Ok(op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            if let Ok(manager) = op.get() {
                if let Ok(sessions) = manager.GetSessions() {
                    let count = sessions.Size().unwrap_or(0);
                    for idx in 0..count {
                        if let Ok(session) = sessions.GetAt(idx) {
                            if let Ok(info) = session.GetPlaybackInfo() {
                                if let Ok(status) = info.PlaybackStatus() {
                                    if status
                                        == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
                                    {
                                        is_playing = true;
                                    } else if status
                                        == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused
                                    {
                                        has_paused_session = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback Core Audio Peak Meter (détecte un son actif même sans session SMTC)
        if !is_playing {
            unsafe {
                if let Ok(enumerator) =
                    CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
                {
                    if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                        if let Ok(meter) = device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None)
                        {
                            if let Ok(peak) = meter.GetPeakValue() {
                                if peak > 0.0025 {
                                    is_playing = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        PcMediaSnapshot {
            is_playing,
            has_paused_session,
        }
    }

    unsafe extern "system" fn low_level_keyboard_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code == HC_ACTION as i32 {
            let msg_type = wparam.0 as u32;
            if msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN {
                let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
                let vk = kb.vkCode as u16;

                // Gestion du volume Home Assistant uniquement lorsque Ctrl est maintenu
                if vk == VK_VOLUME_UP.0 || vk == VK_VOLUME_DOWN.0 || vk == VK_VOLUME_MUTE.0 {
                    let ctrl_pressed = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0;
                    if ctrl_pressed {
                        if let Some(ctx) = HOOK_CTX.get() {
                            let cmd = if vk == VK_VOLUME_UP.0 {
                                "volume_up"
                            } else if vk == VK_VOLUME_DOWN.0 {
                                "volume_down"
                            } else {
                                "volume_mute"
                            };
                            let _ = ctx.app.emit("ha-key-command", cmd);
                        }
                        // Bloque l'action sur le volume Windows local
                        return LRESULT(1);
                    }
                    return CallNextHookEx(None, code, wparam, lparam);
                }

                // Gestion intelligente des touches multimédias (Play/Pause, Suivant, Précédent, Stop)
                if vk == VK_MEDIA_PLAY_PAUSE.0
                    || vk == VK_MEDIA_NEXT_TRACK.0
                    || vk == VK_MEDIA_PREV_TRACK.0
                    || vk == VK_MEDIA_STOP.0
                {
                    let snapshot = query_pc_media_state();
                    let grace_secs = get_pc_grace_seconds();

                    if let Some(ctx) = HOOK_CTX.get() {
                        // Si un média tourne actuellement sur le PC : laisser Windows gérer la touche
                        if snapshot.is_playing {
                            if vk == VK_MEDIA_PLAY_PAUSE.0 {
                                if let Ok(mut guard) = ctx.last_pc_pause.lock() {
                                    *guard = Some(Instant::now());
                                }
                            }
                            return CallNextHookEx(None, code, wparam, lparam);
                        }

                        // Priorité intelligente : si le média PC vient tout juste d'être mis en pause,
                        // laisser Play/Pause le relancer plutôt que de basculer sur Home Assistant.
                        if vk == VK_MEDIA_PLAY_PAUSE.0
                            && grace_secs > 0
                            && snapshot.has_paused_session
                        {
                            if let Ok(mut guard) = ctx.last_pc_pause.lock() {
                                if let Some(paused_at) = *guard {
                                    if paused_at.elapsed() <= Duration::from_secs(grace_secs) {
                                        *guard = None;
                                        return CallNextHookEx(None, code, wparam, lparam);
                                    }
                                }
                            }
                        }

                        // Aucun média actif sur le PC -> routage exclusif vers Home Assistant
                        let cmd = if vk == VK_MEDIA_PLAY_PAUSE.0 {
                            "play_pause"
                        } else if vk == VK_MEDIA_NEXT_TRACK.0 {
                            "next"
                        } else if vk == VK_MEDIA_PREV_TRACK.0 {
                            "previous"
                        } else {
                            "stop"
                        };
                        let _ = ctx.app.emit("ha-key-command", cmd);
                        return LRESULT(1);
                    }
                }
            }
        }

        CallNextHookEx(None, code, wparam, lparam)
    }

    let _ = HOOK_CTX.set(HookContext {
        app,
        last_pc_pause: Mutex::new(None),
    });

    std::thread::spawn(move || unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        if let Ok(_hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc), None, 0)
        {
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    });
}

#[cfg(not(windows))]
pub fn spawn_windows_keyboard_hook(_app: tauri::AppHandle) {}
