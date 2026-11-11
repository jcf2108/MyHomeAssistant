use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Size, Position, WebviewWindow};

pub const PILL_WIDTH: f64 = 316.0;
pub const PILL_HEIGHT: f64 = 52.0;
pub const FLYOUT_WIDTH: f64 = 360.0;
pub const FLYOUT_HEIGHT: f64 = 610.0;
const EDGE_MARGIN: i32 = 12;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SavedPillPosition {
    pub x: i32,
    pub y: i32,
}

pub struct WindowGeometryState {
    pub pill_pos: Mutex<Option<SavedPillPosition>>,
    pub is_expanded: Mutex<bool>,
}

impl Default for WindowGeometryState {
    fn default() -> Self {
        Self {
            pill_pos: Mutex::new(None),
            is_expanded: Mutex::new(false),
        }
    }
}

fn position_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("window_position.json"))
}

pub fn load_persisted_position(app: &AppHandle) -> Option<SavedPillPosition> {
    let path = position_file_path(app)?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<SavedPillPosition>(&raw).ok()
}

fn save_persisted_position(app: &AppHandle, pos: SavedPillPosition) {
    if let Some(path) = position_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(&pos) {
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
        x: (work.right - phys_w - EDGE_MARGIN).max(work.left + EDGE_MARGIN),
        y: (work.bottom - phys_h - EDGE_MARGIN).max(work.top + EDGE_MARGIN),
    }
}

pub fn apply_initial_window_placement(app: &AppHandle, win: &WebviewWindow) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let initial = load_persisted_position(app).unwrap_or_else(|| compute_above_clock_position(scale));

    // Vérifie que la position sauvegardée est bien dans une zone d'écran valide
    let work = get_work_area_near(Some((initial.x, initial.y)));
    let phys_w = (PILL_WIDTH * scale).round() as i32;
    let phys_h = (PILL_HEIGHT * scale).round() as i32;
    let clamped = SavedPillPosition {
        x: initial.x.clamp(work.left + 4, (work.right - phys_w - 4).max(work.left + 4)),
        y: initial.y.clamp(work.top + 4, (work.bottom - phys_h - 4).max(work.top + 4)),
    };

    if let Some(state) = app.try_state::<WindowGeometryState>() {
        if let Ok(mut guard) = state.pill_pos.lock() {
            *guard = Some(clamped);
        }
    }

    let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
    let _ = win.set_position(Position::Physical(PhysicalPosition::new(
        clamped.x, clamped.y,
    )));

    apply_win32_toolwindow_styles(win, false);
}

#[cfg(windows)]
pub fn apply_win32_toolwindow_styles(win: &WebviewWindow, focusable: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

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
            let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
    }
}

#[cfg(not(windows))]
pub fn apply_win32_toolwindow_styles(_win: &WebviewWindow, _focusable: bool) {}

#[tauri::command]
pub fn set_window_focusable(app: AppHandle, focusable: bool) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        apply_win32_toolwindow_styles(&win, focusable);
        if focusable {
            let _ = win.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn record_pill_position(app: AppHandle) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        return Ok(());
    };
    let Some(state) = app.try_state::<WindowGeometryState>() else {
        return Ok(());
    };

    let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
    if let Ok(pos) = win.outer_position() {
        let scale = win.scale_factor().unwrap_or(1.0);
        let pill_pos = if expanded {
            let work = get_work_area_near(Some((pos.x, pos.y)));
            let pill_w = (PILL_WIDTH * scale).round() as i32;
            let pill_h = (PILL_HEIGHT * scale).round() as i32;
            let flyout_w = (FLYOUT_WIDTH * scale).round() as i32;
            let flyout_h = (FLYOUT_HEIGHT * scale).round() as i32;
            let mid_y = (work.top + work.bottom) / 2;
            let py = if pos.y + flyout_h / 2 >= mid_y {
                pos.y + flyout_h - pill_h
            } else {
                pos.y
            };
            let px = pos.x + flyout_w - pill_w;
            SavedPillPosition { x: px, y: py }
        } else {
            SavedPillPosition { x: pos.x, y: pos.y }
        };

        if let Ok(mut guard) = state.pill_pos.lock() {
            *guard = Some(pill_pos);
        }
        save_persisted_position(&app, pill_pos);
    }
    Ok(())
}

#[tauri::command]
pub fn reset_pill_above_clock(app: AppHandle) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        return Ok(());
    };
    let scale = win.scale_factor().unwrap_or(1.0);
    let above_clock = compute_above_clock_position(scale);

    if let Some(state) = app.try_state::<WindowGeometryState>() {
        if let Ok(mut guard) = state.pill_pos.lock() {
            *guard = Some(above_clock);
        }
        let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
        save_persisted_position(&app, above_clock);
        return set_widget_expanded(app.clone(), expanded);
    }
    Ok(())
}

#[tauri::command]
pub fn set_widget_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        return Ok(());
    };
    let scale = win.scale_factor().unwrap_or(1.0);
    let state = app.state::<WindowGeometryState>();

    let anchor = {
        let mut guard = state.pill_pos.lock().map_err(|e| e.to_string())?;
        if guard.is_none() {
            *guard = Some(compute_above_clock_position(scale));
        }
        guard.unwrap()
    };

    {
        if let Ok(mut exp_guard) = state.is_expanded.lock() {
            *exp_guard = expanded;
        }
    }

    if !expanded {
        let _ = win.set_size(Size::Logical(LogicalSize::new(PILL_WIDTH, PILL_HEIGHT)));
        let _ = win.set_position(Position::Physical(PhysicalPosition::new(
            anchor.x, anchor.y,
        )));
        apply_win32_toolwindow_styles(&win, false);
        return Ok(());
    }

    let work = get_work_area_near(Some((anchor.x, anchor.y)));
    let pill_w = (PILL_WIDTH * scale).round() as i32;
    let pill_h = (PILL_HEIGHT * scale).round() as i32;
    let fly_w = (FLYOUT_WIDTH * scale).round() as i32;
    let available_h = (work.bottom - work.top - EDGE_MARGIN * 2).max(360);
    let fly_h = ((FLYOUT_HEIGHT * scale).round() as i32).min(available_h);
    let logical_fly_h = (fly_h as f64) / scale;

    let mid_x = (work.left + work.right) / 2;
    let mid_y = (work.top + work.bottom) / 2;

    // Aligne à droite de la pilule si située à droite de l'écran, sinon à gauche
    let raw_x = if anchor.x + pill_w / 2 >= mid_x {
        anchor.x + pill_w - fly_w
    } else {
        anchor.x
    };

    // Déploie vers le haut si la pilule est dans la moitié basse (ex: au-dessus de l'horloge)
    let raw_y = if anchor.y + pill_h / 2 >= mid_y {
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

    let _ = win.set_size(Size::Logical(LogicalSize::new(
        FLYOUT_WIDTH,
        logical_fly_h,
    )));
    let _ = win.set_position(Position::Physical(PhysicalPosition::new(
        clamped_x, clamped_y,
    )));
    let _ = win.show();
    Ok(())
}
