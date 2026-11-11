use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size, Window,
};

pub const PILL_WIDTH: f64 = 316.0;
pub const PILL_HEIGHT: f64 = 52.0;
pub const FLYOUT_WIDTH: f64 = 420.0;
pub const FLYOUT_HEIGHT: f64 = 680.0;
pub const MIN_FLYOUT_WIDTH: f64 = 320.0;
pub const MIN_FLYOUT_HEIGHT: f64 = 360.0;
const MAX_FLYOUT_WIDTH: f64 = 1400.0;
const MAX_FLYOUT_HEIGHT: f64 = 1400.0;
const EDGE_MARGIN: i32 = 8;

fn default_flyout_width() -> f64 {
    FLYOUT_WIDTH
}

fn default_flyout_height() -> f64 {
    FLYOUT_HEIGHT
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SavedPillPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct PersistedWindowGeometry {
    pub x: i32,
    pub y: i32,
    #[serde(default = "default_flyout_width")]
    pub flyout_width: f64,
    #[serde(default = "default_flyout_height")]
    pub flyout_height: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct OpenedFlyoutRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub anchor_right: bool,
    pub anchor_bottom: bool,
}

pub struct WindowGeometryState {
    pub pill_pos: Mutex<Option<SavedPillPosition>>,
    pub flyout_size: Mutex<(f64, f64)>,
    pub is_expanded: Mutex<bool>,
    pub opened_flyout: Mutex<Option<OpenedFlyoutRect>>,
    pub transitioning: AtomicBool,
}

impl Default for WindowGeometryState {
    fn default() -> Self {
        Self {
            pill_pos: Mutex::new(None),
            flyout_size: Mutex::new((FLYOUT_WIDTH, FLYOUT_HEIGHT)),
            is_expanded: Mutex::new(false),
            opened_flyout: Mutex::new(None),
            transitioning: AtomicBool::new(false),
        }
    }
}

fn position_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("window_position.json"))
}

fn load_persisted_geometry(app: &AppHandle) -> Option<PersistedWindowGeometry> {
    let path = position_file_path(app)?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<PersistedWindowGeometry>(&raw).ok()
}

fn save_persisted_geometry(app: &AppHandle, pill: SavedPillPosition, flyout_size: (f64, f64)) {
    if let Some(path) = position_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let payload = PersistedWindowGeometry {
            x: pill.x,
            y: pill.y,
            flyout_width: flyout_size.0.clamp(MIN_FLYOUT_WIDTH, MAX_FLYOUT_WIDTH),
            flyout_height: flyout_size.1.clamp(MIN_FLYOUT_HEIGHT, MAX_FLYOUT_HEIGHT),
        };
        if let Ok(json) = serde_json::to_string(&payload) {
            let _ = std::fs::write(path, json);
        }
    }
}

#[derive(Clone, Copy)]
struct WorkAreaRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(windows)]
fn get_work_area_near(point: Option<(i32, i32)>) -> WorkAreaRect {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_GETWORKAREA, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
    };

    if let Some((px, py)) = point {
        unsafe {
            let hmon = MonitorFromPoint(POINT { x: px, y: py }, MONITOR_DEFAULTTOPRIMARY);
            let mut info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(hmon, &mut info).as_bool() {
                return WorkAreaRect {
                    left: info.rcWork.left,
                    top: info.rcWork.top,
                    right: info.rcWork.right,
                    bottom: info.rcWork.bottom,
                };
            }
        }
    }

    let mut rect = RECT::default();
    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut rect as *mut _ as *mut _),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
    };
    if ok.is_ok() {
        WorkAreaRect {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        }
    } else {
        WorkAreaRect {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1032,
        }
    }
}

#[cfg(not(windows))]
fn get_work_area_near(_point: Option<(i32, i32)>) -> WorkAreaRect {
    WorkAreaRect {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1032,
    }
}

pub fn compute_above_clock_position(scale: f64) -> SavedPillPosition {
    let work = get_work_area_near(None);
    let phys_w = (PILL_WIDTH * scale).round() as i32;
    let phys_h = (PILL_HEIGHT * scale).round() as i32;
    SavedPillPosition {
        x: (work.right - phys_w - 12).max(work.left + 12),
        y: (work.bottom - phys_h - 12).max(work.top + 12),
    }
}

fn clamp_pill_to_work_area(pos: SavedPillPosition, scale: f64) -> SavedPillPosition {
    let phys_w = (PILL_WIDTH * scale).round() as i32;
    let phys_h = (PILL_HEIGHT * scale).round() as i32;
    let work = get_work_area_near(Some((pos.x + phys_w / 2, pos.y + phys_h / 2)));
    SavedPillPosition {
        x: pos
            .x
            .clamp(work.left + 4, (work.right - phys_w - 4).max(work.left + 4)),
        y: pos
            .y
            .clamp(work.top + 4, (work.bottom - phys_h - 4).max(work.top + 4)),
    }
}

pub fn apply_initial_window_placement(app: &AppHandle, win: &Window) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let persisted = load_persisted_geometry(app);
    let raw_pill = persisted
        .map(|p| SavedPillPosition { x: p.x, y: p.y })
        .unwrap_or_else(|| compute_above_clock_position(scale));
    let clamped = clamp_pill_to_work_area(raw_pill, scale);
    let flyout_size = persisted
        .map(|p| {
            (
                p.flyout_width.clamp(MIN_FLYOUT_WIDTH, MAX_FLYOUT_WIDTH),
                p.flyout_height.clamp(MIN_FLYOUT_HEIGHT, MAX_FLYOUT_HEIGHT),
            )
        })
        .unwrap_or((FLYOUT_WIDTH, FLYOUT_HEIGHT));

    if let Some(state) = app.try_state::<WindowGeometryState>() {
        state.transitioning.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = state.pill_pos.lock() {
            *guard = Some(clamped);
        }
        if let Ok(mut sz_guard) = state.flyout_size.lock() {
            *sz_guard = flyout_size;
        }
    }

    let _ = win.set_min_size(None::<Size>);
    let _ = win.set_resizable(false);
    let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
    let _ = win.set_position(Position::Physical(PhysicalPosition::new(
        clamped.x, clamped.y,
    )));
    apply_win32_toolwindow_styles(win, false);

    if let Some(state) = app.try_state::<WindowGeometryState>() {
        state.transitioning.store(false, Ordering::SeqCst);
    }
}

/// Suit en direct tout déplacement natif de la pilule pour que l'ouverture suivante soit toujours ancrée dessus.
pub fn handle_native_window_moved(app: &AppHandle, win: &Window, pos: PhysicalPosition<i32>) {
    let Some(state) = app.try_state::<WindowGeometryState>() else {
        return;
    };
    if state.transitioning.load(Ordering::SeqCst) {
        return;
    }
    let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
    if expanded {
        return;
    }

    let scale = win.scale_factor().unwrap_or(1.0);
    if let Ok(outer) = win.outer_size() {
        let max_pill_phys_h = (PILL_HEIGHT * scale * 1.65).round() as u32;
        if outer.height > max_pill_phys_h {
            return;
        }
    }

    let pill = SavedPillPosition { x: pos.x, y: pos.y };
    if let Ok(mut guard) = state.pill_pos.lock() {
        *guard = Some(pill);
    }
    let flyout_sz = state
        .flyout_size
        .lock()
        .map(|g| *g)
        .unwrap_or((FLYOUT_WIDTH, FLYOUT_HEIGHT));
    save_persisted_geometry(app, pill, flyout_sz);
}

/// Mémorise la taille choisie par l'utilisateur lorsqu'il redimensionne le panneau déployé.
pub fn handle_native_window_resized(app: &AppHandle, win: &Window, size: PhysicalSize<u32>) {
    let Some(state) = app.try_state::<WindowGeometryState>() else {
        return;
    };
    if state.transitioning.load(Ordering::SeqCst) {
        return;
    }
    let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
    if !expanded {
        return;
    }

    let scale = win.scale_factor().unwrap_or(1.0);
    let logical_w = (size.width as f64) / scale;
    let logical_h = (size.height as f64) / scale;
    if logical_w < MIN_FLYOUT_WIDTH - 16.0 || logical_h < MIN_FLYOUT_HEIGHT - 16.0 {
        return;
    }

    let next_size = (
        logical_w.clamp(MIN_FLYOUT_WIDTH, MAX_FLYOUT_WIDTH),
        logical_h.clamp(MIN_FLYOUT_HEIGHT, MAX_FLYOUT_HEIGHT),
    );
    if let Ok(mut sz_guard) = state.flyout_size.lock() {
        *sz_guard = next_size;
    }
    let saved_pill = state.pill_pos.lock().ok().and_then(|g| *g);
    if let Some(pill) = saved_pill {
        save_persisted_geometry(app, pill, next_size);
    }
}

#[cfg(windows)]
pub fn suppress_dwm_frame_artifacts(win: &Window) {
    use std::ffi::c_void;
    use std::mem::size_of;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMNCRP_DISABLED, DWMSBT_NONE, DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE,
        DWMWA_NCRENDERING_POLICY, DWMWA_SYSTEMBACKDROP_TYPE, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_DONOTROUND,
    };

    if let Ok(raw_hwnd) = win.hwnd() {
        let hwnd = HWND(raw_hwnd.0);
        unsafe {
            let ncrp = DWMNCRP_DISABLED;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_NCRENDERING_POLICY,
                &ncrp as *const _ as *const c_void,
                size_of::<i32>() as u32,
            );
            let corner_pref = DWMWCP_DONOTROUND;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &corner_pref as *const _ as *const c_void,
                size_of::<i32>() as u32,
            );
            let border_none: u32 = DWMWA_COLOR_NONE;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &border_none as *const _ as *const c_void,
                size_of::<u32>() as u32,
            );
            let backdrop_none = DWMSBT_NONE;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_SYSTEMBACKDROP_TYPE,
                &backdrop_none as *const _ as *const c_void,
                size_of::<i32>() as u32,
            );
        }
    }
}

#[cfg(not(windows))]
pub fn suppress_dwm_frame_artifacts(_win: &Window) {}

#[cfg(windows)]
pub fn apply_win32_toolwindow_styles(win: &Window, focusable: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    suppress_dwm_frame_artifacts(win);

    if let Ok(raw_hwnd) = win.hwnd() {
        let hwnd = HWND(raw_hwnd.0);
        unsafe {
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let mut next = current | (WS_EX_TOOLWINDOW.0 as isize);
            if focusable {
                next &= !(WS_EX_NOACTIVATE.0 as isize);
            } else {
                next |= WS_EX_NOACTIVATE.0 as isize;
            }
            if next != current {
                let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
                let _ = SetWindowPos(
                    hwnd,
                    None,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                );
            }
        }
    }
}

#[cfg(not(windows))]
pub fn apply_win32_toolwindow_styles(_win: &Window, _focusable: bool) {}

#[tauri::command]
pub fn set_window_focusable(app: AppHandle, focusable: bool) -> Result<(), String> {
    if let Some(win) = app.get_window("main") {
        apply_win32_toolwindow_styles(&win, focusable);
        if focusable {
            let _ = win.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn record_pill_position(app: AppHandle) -> Result<(), String> {
    let Some(win) = app.get_window("main") else {
        return Ok(());
    };
    let Some(state) = app.try_state::<WindowGeometryState>() else {
        return Ok(());
    };
    let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
    if !expanded {
        if let Ok(pos) = win.outer_position() {
            handle_native_window_moved(&app, &win, pos);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn reset_pill_above_clock(app: AppHandle) -> Result<(), String> {
    let Some(win) = app.get_window("main") else {
        return Ok(());
    };
    let scale = win.scale_factor().unwrap_or(1.0);
    let above_clock = compute_above_clock_position(scale);
    let default_flyout = (FLYOUT_WIDTH, FLYOUT_HEIGHT);

    if let Some(state) = app.try_state::<WindowGeometryState>() {
        if let Ok(mut guard) = state.pill_pos.lock() {
            *guard = Some(above_clock);
        }
        if let Ok(mut sz_guard) = state.flyout_size.lock() {
            *sz_guard = default_flyout;
        }
        if let Ok(mut open_guard) = state.opened_flyout.lock() {
            *open_guard = None;
        }
        let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
        save_persisted_geometry(&app, above_clock, default_flyout);

        if expanded {
            if let Ok(mut exp_guard) = state.is_expanded.lock() {
                *exp_guard = false;
            }
            state.transitioning.store(true, Ordering::SeqCst);
            let _ = win.set_min_size(None::<Size>);
            let _ = win.set_resizable(false);
            let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
            let _ = win.set_position(Position::Physical(PhysicalPosition::new(
                above_clock.x,
                above_clock.y,
            )));
            state.transitioning.store(false, Ordering::SeqCst);
            return set_widget_expanded(app.clone(), true);
        } else {
            state.transitioning.store(true, Ordering::SeqCst);
            let _ = win.set_min_size(None::<Size>);
            let _ = win.set_resizable(false);
            let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
            let _ = win.set_position(Position::Physical(PhysicalPosition::new(
                above_clock.x,
                above_clock.y,
            )));
            apply_win32_toolwindow_styles(&win, false);
            state.transitioning.store(false, Ordering::SeqCst);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_widget_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    let Some(win) = app.get_window("main") else {
        return Ok(());
    };
    let scale = win.scale_factor().unwrap_or(1.0);
    let state = app.state::<WindowGeometryState>();

    let was_expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
    let pill_w = (PILL_WIDTH * scale).round() as i32;
    let pill_h = (PILL_HEIGHT * scale).round() as i32;

    if !expanded {
        if !was_expanded {
            // Déjà replié (ex: synchronisation au démarrage) : ne pas écraser la position courante
            apply_win32_toolwindow_styles(&win, false);
            return Ok(());
        }

        let mut target_pill = state
            .pill_pos
            .lock()
            .ok()
            .and_then(|g| *g)
            .unwrap_or_else(|| compute_above_clock_position(scale));

        let mut current_flyout_size = state
            .flyout_size
            .lock()
            .map(|g| *g)
            .unwrap_or((FLYOUT_WIDTH, FLYOUT_HEIGHT));

        if let (Ok(cur_pos), Ok(cur_size)) = (win.outer_position(), win.outer_size()) {
            let logical_w = (cur_size.width as f64) / scale;
            let logical_h = (cur_size.height as f64) / scale;
            if logical_w >= MIN_FLYOUT_WIDTH - 16.0 && logical_h >= MIN_FLYOUT_HEIGHT - 16.0 {
                current_flyout_size = (
                    logical_w.clamp(MIN_FLYOUT_WIDTH, MAX_FLYOUT_WIDTH),
                    logical_h.clamp(MIN_FLYOUT_HEIGHT, MAX_FLYOUT_HEIGHT),
                );
                if let Ok(mut sz_guard) = state.flyout_size.lock() {
                    *sz_guard = current_flyout_size;
                }
            }

            let opened = state.opened_flyout.lock().ok().and_then(|g| *g);
            let fw = cur_size.width as i32;
            let fh = cur_size.height as i32;
            let work = get_work_area_near(Some((cur_pos.x + fw / 2, cur_pos.y + fh / 2)));
            let mid_x = (work.left + work.right) / 2;
            let mid_y = (work.top + work.bottom) / 2;

            if let Some(o) = opened {
                let ow = o.width as i32;
                let oh = o.height as i32;

                let anchored_x_unchanged = if o.anchor_right {
                    ((cur_pos.x + fw) - (o.x + ow)).abs() <= 3
                } else {
                    (cur_pos.x - o.x).abs() <= 3
                };

                let anchored_y_unchanged = if o.anchor_bottom {
                    ((cur_pos.y + fh) - (o.y + oh)).abs() <= 3
                } else {
                    (cur_pos.y - o.y).abs() <= 3
                };

                let px = if anchored_x_unchanged {
                    target_pill.x
                } else if (fw - ow).abs() > 3 {
                    if o.anchor_right {
                        cur_pos.x + fw - pill_w
                    } else {
                        cur_pos.x
                    }
                } else if cur_pos.x + fw / 2 >= mid_x {
                    cur_pos.x + fw - pill_w
                } else {
                    cur_pos.x
                };

                let py = if anchored_y_unchanged {
                    target_pill.y
                } else if (fh - oh).abs() > 3 {
                    if o.anchor_bottom {
                        cur_pos.y + fh - pill_h
                    } else {
                        cur_pos.y
                    }
                } else if cur_pos.y + fh / 2 >= mid_y {
                    cur_pos.y + fh - pill_h
                } else {
                    cur_pos.y
                };

                if !anchored_x_unchanged || !anchored_y_unchanged {
                    target_pill =
                        clamp_pill_to_work_area(SavedPillPosition { x: px, y: py }, scale);
                }
            } else {
                let px = if cur_pos.x + fw / 2 >= mid_x {
                    cur_pos.x + fw - pill_w
                } else {
                    cur_pos.x
                };
                let py = if cur_pos.y + fh / 2 >= mid_y {
                    cur_pos.y + fh - pill_h
                } else {
                    cur_pos.y
                };
                target_pill = clamp_pill_to_work_area(SavedPillPosition { x: px, y: py }, scale);
            }
        }

        state.transitioning.store(true, Ordering::SeqCst);

        if let Ok(mut exp_guard) = state.is_expanded.lock() {
            *exp_guard = false;
        }
        if let Ok(mut open_guard) = state.opened_flyout.lock() {
            *open_guard = None;
        }
        if let Ok(mut pos_guard) = state.pill_pos.lock() {
            *pos_guard = Some(target_pill);
        }

        let _ = win.set_min_size(None::<Size>);
        let _ = win.set_resizable(false);
        let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
        let _ = win.set_position(Position::Physical(PhysicalPosition::new(
            target_pill.x,
            target_pill.y,
        )));
        apply_win32_toolwindow_styles(&win, false);
        state.transitioning.store(false, Ordering::SeqCst);

        save_persisted_geometry(&app, target_pill, current_flyout_size);
        return Ok(());
    }

    // Passage Pilule -> Panneau déployé : lit la position RÉELLE actuelle de la pilule à l'écran !
    let anchor = if !was_expanded {
        if let Ok(live_pos) = win.outer_position() {
            let live_pill = clamp_pill_to_work_area(
                SavedPillPosition {
                    x: live_pos.x,
                    y: live_pos.y,
                },
                scale,
            );
            if let Ok(mut guard) = state.pill_pos.lock() {
                *guard = Some(live_pill);
            }
            live_pill
        } else {
            state
                .pill_pos
                .lock()
                .ok()
                .and_then(|g| *g)
                .unwrap_or_else(|| compute_above_clock_position(scale))
        }
    } else {
        state
            .pill_pos
            .lock()
            .ok()
            .and_then(|g| *g)
            .unwrap_or_else(|| compute_above_clock_position(scale))
    };

    let (pref_w, pref_h) = state
        .flyout_size
        .lock()
        .map(|g| *g)
        .unwrap_or((FLYOUT_WIDTH, FLYOUT_HEIGHT));

    let work = get_work_area_near(Some((anchor.x + pill_w / 2, anchor.y + pill_h / 2)));
    let available_w = (work.right - work.left - EDGE_MARGIN * 2).max(320);
    let available_h = (work.bottom - work.top - EDGE_MARGIN * 2).max(360);

    let fly_w = ((pref_w * scale).round() as i32).min(available_w);
    let fly_h = ((pref_h * scale).round() as i32).min(available_h);
    let logical_fly_w = (fly_w as f64) / scale;
    let logical_fly_h = (fly_h as f64) / scale;

    let mid_x = (work.left + work.right) / 2;
    let mid_y = (work.top + work.bottom) / 2;
    let anchor_right = anchor.x + pill_w / 2 >= mid_x;
    let anchor_bottom = anchor.y + pill_h / 2 >= mid_y;

    // S'ancre directement sur les bords de la pilule selon sa position à l'écran
    let raw_x = if anchor_right {
        anchor.x + pill_w - fly_w
    } else {
        anchor.x
    };

    let raw_y = if anchor_bottom {
        anchor.y + pill_h - fly_h
    } else {
        anchor.y
    };

    let clamped_x = raw_x.clamp(
        work.left + EDGE_MARGIN,
        (work.right - fly_w - EDGE_MARGIN).max(work.left + EDGE_MARGIN),
    );
    let clamped_y = raw_y.clamp(
        work.top + EDGE_MARGIN,
        (work.bottom - fly_h - EDGE_MARGIN).max(work.top + EDGE_MARGIN),
    );

    state.transitioning.store(true, Ordering::SeqCst);

    if let Ok(mut exp_guard) = state.is_expanded.lock() {
        *exp_guard = true;
    }

    let _ = win.set_resizable(true);
    let _ = win.set_min_size(Some(Size::Logical(LogicalSize::new(
        MIN_FLYOUT_WIDTH,
        MIN_FLYOUT_HEIGHT,
    ))));
    let _ = win.set_size(Size::Logical(LogicalSize::new(
        logical_fly_w,
        logical_fly_h,
    )));
    let _ = win.set_position(Position::Physical(PhysicalPosition::new(
        clamped_x, clamped_y,
    )));
    apply_win32_toolwindow_styles(&win, true);
    let _ = win.show();
    let _ = win.set_focus();

    let actual_pos = win
        .outer_position()
        .unwrap_or(PhysicalPosition::new(clamped_x, clamped_y));
    let actual_sz = win
        .outer_size()
        .unwrap_or(PhysicalSize::new(fly_w as u32, fly_h as u32));
    if let Ok(mut open_guard) = state.opened_flyout.lock() {
        *open_guard = Some(OpenedFlyoutRect {
            x: actual_pos.x,
            y: actual_pos.y,
            width: actual_sz.width,
            height: actual_sz.height,
            anchor_right,
            anchor_bottom,
        });
    }

    state.transitioning.store(false, Ordering::SeqCst);
    save_persisted_geometry(&app, anchor, (pref_w, pref_h));
    Ok(())
}
