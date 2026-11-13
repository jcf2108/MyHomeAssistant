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
    pub pointer_op_active: AtomicBool,
}

impl Default for WindowGeometryState {
    fn default() -> Self {
        Self {
            pill_pos: Mutex::new(None),
            flyout_size: Mutex::new((FLYOUT_WIDTH, FLYOUT_HEIGHT)),
            is_expanded: Mutex::new(false),
            opened_flyout: Mutex::new(None),
            transitioning: AtomicBool::new(false),
            pointer_op_active: AtomicBool::new(false),
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
const TRANSPARENT_SUBCLASS_ID: usize = 0x4D48_4101;
#[cfg(windows)]
const MSG_NCUAHDRAWCAPTION: u32 = 0x00AE;
#[cfg(windows)]
const MSG_NCUAHDRAWFRAME: u32 = 0x00AF;

/// Efface l'intégralité du bitmap de redirection GDI du HWND en `0x00000000` (A=0, R=0, G=0, B=0).
/// En composition DWM à alpha prémultiplié (`DwmEnableBlurBehindWindow` avec région vide),
/// `0x00000000` est 100 % transparent, empêchant tout triangle clair dans les 4 coins hors `border-radius`.
#[cfg(windows)]
unsafe fn clear_hwnd_gdi_surface(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::Graphics::Gdi::{
        FillRect, GetDCEx, GetStockObject, ReleaseDC, BLACK_BRUSH, DCX_CACHE, DCX_WINDOW, HBRUSH,
        HRGN,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

    let mut wr = RECT::default();
    if GetWindowRect(hwnd, &mut wr).is_ok() {
        let w = (wr.right - wr.left).max(0);
        let h = (wr.bottom - wr.top).max(0);
        if w > 0 && h > 0 {
            // `GetDCEx` sans `DCX_CLIPCHILDREN` (ni `DCX_USESTYLE`) efface tout le bitmap GDI
            // du HWND parent y compris sous le HWND enfant `WRY_WEBVIEW` (qui compose via DirectComposition).
            let hdc = GetDCEx(hwnd, HRGN::default(), DCX_WINDOW | DCX_CACHE);
            if !hdc.is_invalid() {
                let local = RECT {
                    left: 0,
                    top: 0,
                    right: w,
                    bottom: h,
                };
                let clear_brush = HBRUSH(GetStockObject(BLACK_BRUSH).0);
                let _ = FillRect(hdc, &local, clear_brush);
                let _ = ReleaseDC(hwnd, hdc);
            }
        }
    }
}

#[cfg(windows)]
unsafe fn configure_dwm_transparent_hwnd(hwnd: windows::Win32::Foundation::HWND) {
    use std::ffi::c_void;
    use std::mem::size_of;
    use windows::Win32::Graphics::Dwm::{
        DwmEnableBlurBehindWindow, DwmSetWindowAttribute, DWMNCRP_ENABLED, DWMSBT_NONE,
        DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE, DWMWA_NCRENDERING_POLICY, DWMWA_SYSTEMBACKDROP_TYPE,
        DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND, DWM_BB_BLURREGION, DWM_BB_ENABLE,
        DWM_BLURBEHIND,
    };
    use windows::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject};

    // IMPORTANT : `DWMNCRP_ENABLED` (et jamais `DWMNCRP_DISABLED` !) empêche Windows de basculer
    // sur le thème GDI Aero Basic (`#DCE6F2`) qui peignait des triangles blanc-bleuté dans les 4 coins
    // lors des changements de focus (`WM_NCACTIVATE`), tout en faisant respecter `DWMWCP_DONOTROUND`
    // et `DWMWA_COLOR_NONE` (zéro ombre et zéro bordure rectangulaire DWM sur un `WS_POPUP`).
    let ncrp = DWMNCRP_ENABLED;
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

    // Ré-assure la transparence alpha par pixel DWM avec une région de flou vide (aucun halo)
    let empty_rgn = CreateRectRgn(0, 0, -1, -1);
    let bb = DWM_BLURBEHIND {
        dwFlags: DWM_BB_ENABLE | DWM_BB_BLURREGION,
        fEnable: true.into(),
        hRgnBlur: empty_rgn,
        fTransitionOnMaximized: false.into(),
    };
    let _ = DwmEnableBlurBehindWindow(hwnd, &bb);
    if !empty_rgn.is_invalid() {
        let _ = DeleteObject(empty_rgn);
    }

    clear_hwnd_gdi_surface(hwnd);
}

#[cfg(windows)]
unsafe extern "system" fn frameless_transparent_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    umsg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    uidsubclass: usize,
    _dwrefdata: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::{LPARAM, LRESULT, RECT};
    use windows::Win32::Graphics::Gdi::{FillRect, GetStockObject, BLACK_BRUSH, HBRUSH, HDC};
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClientRect, GWL_EXSTYLE, GWL_STYLE, STYLESTRUCT, WM_ACTIVATE, WM_DWMCOMPOSITIONCHANGED,
        WM_ERASEBKGND, WM_KILLFOCUS, WM_NCACTIVATE, WM_NCCALCSIZE, WM_NCDESTROY, WM_NCPAINT,
        WM_SETFOCUS, WM_SETTINGCHANGE, WM_STYLECHANGED, WM_STYLECHANGING, WM_THEMECHANGED,
        WM_WINDOWPOSCHANGED, WS_BORDER, WS_CAPTION, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_DLGFRAME,
        WS_EX_CLIENTEDGE, WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE, WS_EX_TOOLWINDOW,
        WS_EX_WINDOWEDGE, WS_POPUP, WS_THICKFRAME,
    };

    match umsg {
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(
                hwnd,
                Some(frameless_transparent_subclass_proc),
                uidsubclass,
            );
            DefSubclassProc(hwnd, umsg, wparam, lparam)
        }
        WM_STYLECHANGING => {
            if lparam.0 != 0 {
                let ss = &mut *(lparam.0 as *mut STYLESTRUCT);
                let idx = wparam.0 as i32;
                if idx == GWL_STYLE.0 {
                    let strip = (WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME).0;
                    let enforce = (WS_POPUP | WS_CLIPCHILDREN | WS_CLIPSIBLINGS).0;
                    ss.styleNew = (ss.styleNew & !strip) | enforce;
                } else if idx == GWL_EXSTYLE.0 {
                    let strip_ex = (WS_EX_WINDOWEDGE
                        | WS_EX_CLIENTEDGE
                        | WS_EX_DLGMODALFRAME
                        | WS_EX_STATICEDGE)
                        .0;
                    ss.styleNew = (ss.styleNew & !strip_ex) | WS_EX_TOOLWINDOW.0;
                }
            }
            LRESULT(0)
        }
        WM_NCCALCSIZE => LRESULT(0),
        WM_NCPAINT | MSG_NCUAHDRAWCAPTION | MSG_NCUAHDRAWFRAME => {
            clear_hwnd_gdi_surface(hwnd);
            LRESULT(0)
        }
        WM_NCACTIVATE => {
            // `LPARAM(-1)` instruit `DefWindowProcW` de ne jamais repeindre de bordure non-client
            // tout en laissant `tao` suivre normalement l'état de focus de la fenêtre.
            let res = DefSubclassProc(hwnd, umsg, wparam, LPARAM(-1));
            clear_hwnd_gdi_surface(hwnd);
            res
        }
        WM_ERASEBKGND => {
            let hdc = HDC(wparam.0 as *mut _);
            if !hdc.is_invalid() {
                let mut rc = RECT::default();
                if GetClientRect(hwnd, &mut rc).is_ok() {
                    let clear_brush = HBRUSH(GetStockObject(BLACK_BRUSH).0);
                    let _ = FillRect(hdc, &rc, clear_brush);
                }
            }
            clear_hwnd_gdi_surface(hwnd);
            LRESULT(1)
        }
        WM_DWMCOMPOSITIONCHANGED | WM_THEMECHANGED => {
            let res = DefSubclassProc(hwnd, umsg, wparam, lparam);
            configure_dwm_transparent_hwnd(hwnd);
            res
        }
        WM_ACTIVATE | WM_SETFOCUS | WM_KILLFOCUS | WM_SETTINGCHANGE | WM_STYLECHANGED
        | WM_WINDOWPOSCHANGED => {
            let res = DefSubclassProc(hwnd, umsg, wparam, lparam);
            clear_hwnd_gdi_surface(hwnd);
            res
        }
        _ => DefSubclassProc(hwnd, umsg, wparam, lparam),
    }
}

#[cfg(windows)]
pub fn apply_win32_toolwindow_styles(win: &Window, focusable: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::InvalidateRect;
    use windows::Win32::UI::Shell::SetWindowSubclass;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_BORDER,
        WS_CAPTION, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_DLGFRAME, WS_EX_CLIENTEDGE,
        WS_EX_DLGMODALFRAME, WS_EX_NOACTIVATE, WS_EX_STATICEDGE, WS_EX_TOOLWINDOW,
        WS_EX_WINDOWEDGE, WS_POPUP, WS_THICKFRAME,
    };

    if let Ok(raw_hwnd) = win.hwnd() {
        let hwnd = HWND(raw_hwnd.0);
        unsafe {
            let _ = SetWindowSubclass(
                hwnd,
                Some(frameless_transparent_subclass_proc),
                TRANSPARENT_SUBCLASS_ID,
                0,
            );

            let cur_style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let strip_style =
                (WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME).0 as usize as isize;
            let enforce_style =
                (WS_POPUP | WS_CLIPCHILDREN | WS_CLIPSIBLINGS).0 as usize as isize;
            let next_style = (cur_style & !strip_style) | enforce_style;

            let cur_ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let strip_ex = (WS_EX_WINDOWEDGE
                | WS_EX_CLIENTEDGE
                | WS_EX_DLGMODALFRAME
                | WS_EX_STATICEDGE)
                .0 as usize as isize;
            let mut next_ex = (cur_ex & !strip_ex) | (WS_EX_TOOLWINDOW.0 as usize as isize);
            if focusable {
                next_ex &= !(WS_EX_NOACTIVATE.0 as usize as isize);
            } else {
                next_ex |= WS_EX_NOACTIVATE.0 as usize as isize;
            }

            let mut changed = false;
            if next_style != cur_style {
                let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, next_style);
                changed = true;
            }
            if next_ex != cur_ex {
                let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next_ex);
                changed = true;
            }
            if changed {
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

            configure_dwm_transparent_hwnd(hwnd);
            let _ = InvalidateRect(hwnd, None, true);
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

    // Garde `resizable = false` au sens Win32 (`WS_THICKFRAME` désactivé) pour ne jamais réinjecter
    // de bordure non-client ni `TAURI_DRAG_RESIZE_BORDERS` ; le redimensionnement 8 directions
    // est piloté nativement par `start_flyout_resize`.
    let _ = win.set_min_size(None::<Size>);
    let _ = win.set_resizable(false);
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

    let min_expected_h = (MIN_FLYOUT_HEIGHT * scale * 0.8) as u32;
    let actual_pos = win
        .outer_position()
        .unwrap_or(PhysicalPosition::new(clamped_x, clamped_y));
    let raw_sz = win
        .outer_size()
        .unwrap_or(PhysicalSize::new(fly_w as u32, fly_h as u32));
    let (recorded_x, recorded_y, recorded_w, recorded_h) = if raw_sz.height < min_expected_h {
        (clamped_x, clamped_y, fly_w as u32, fly_h as u32)
    } else {
        (actual_pos.x, actual_pos.y, raw_sz.width, raw_sz.height)
    };
    if let Ok(mut open_guard) = state.opened_flyout.lock() {
        *open_guard = Some(OpenedFlyoutRect {
            x: recorded_x,
            y: recorded_y,
            width: recorded_w,
            height: recorded_h,
            anchor_right,
            anchor_bottom,
        });
    }

    state.transitioning.store(false, Ordering::SeqCst);
    save_persisted_geometry(&app, anchor, (pref_w, pref_h));
    Ok(())
}

/// Déplacement natif fluide (250 Hz) d'une fenêtre `WS_POPUP` sans `WM_NCLBUTTONDOWN(HTCAPTION)` :
/// n'active jamais la pilule (`WS_EX_NOACTIVATE` préservé) et ne déclenche aucun `WM_NCACTIVATE`.
#[tauri::command]
pub fn start_window_drag(app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::time::Duration;
        use windows::Win32::Foundation::{HWND, POINT, RECT};
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_LBUTTON, VK_RBUTTON,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetCursorPos, GetSystemMetrics, GetWindowRect, SetWindowPos, SM_SWAPBUTTON,
            SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER,
        };

        let Some(win) = app.get_window("main") else {
            return Ok(());
        };
        let Ok(raw_hwnd) = win.hwnd() else {
            return Ok(());
        };
        let Some(state) = app.try_state::<WindowGeometryState>() else {
            return Ok(());
        };
        if state
            .pointer_op_active
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Ok(());
        }

        let hwnd_bits = raw_hwnd.0 as isize;
        let app_for_thread = app.clone();

        std::thread::spawn(move || {
            struct OpReset<'a>(&'a AppHandle);
            impl Drop for OpReset<'_> {
                fn drop(&mut self) {
                    if let Some(st) = self.0.try_state::<WindowGeometryState>() {
                        st.pointer_op_active.store(false, Ordering::SeqCst);
                    }
                }
            }
            let _guard = OpReset(&app_for_thread);

            let hwnd = HWND(hwnd_bits as *mut _);
            unsafe {
                let mut start_pt = POINT::default();
                let mut start_rect = RECT::default();
                if GetCursorPos(&mut start_pt).is_err()
                    || GetWindowRect(hwnd, &mut start_rect).is_err()
                {
                    return;
                }

                let primary_vk = if GetSystemMetrics(SM_SWAPBUTTON) != 0 {
                    VK_RBUTTON.0 as i32
                } else {
                    VK_LBUTTON.0 as i32
                };

                let mut last_x = start_rect.left;
                let mut last_y = start_rect.top;
                let mut moved = false;

                while (GetAsyncKeyState(primary_vk) as u16 & 0x8000) != 0 {
                    let mut cur_pt = POINT::default();
                    if GetCursorPos(&mut cur_pt).is_ok() {
                        let next_x = start_rect.left + (cur_pt.x - start_pt.x);
                        let next_y = start_rect.top + (cur_pt.y - start_pt.y);
                        if next_x != last_x || next_y != last_y {
                            let _ = SetWindowPos(
                                hwnd,
                                None,
                                next_x,
                                next_y,
                                0,
                                0,
                                SWP_ASYNCWINDOWPOS
                                    | SWP_NOSIZE
                                    | SWP_NOZORDER
                                    | SWP_NOACTIVATE
                                    | SWP_NOOWNERZORDER,
                            );
                            last_x = next_x;
                            last_y = next_y;
                            moved = true;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(4));
                }

                if moved {
                    if let Some(st) = app_for_thread.try_state::<WindowGeometryState>() {
                        let expanded = st.is_expanded.lock().map(|g| *g).unwrap_or(false);
                        if !expanded {
                            let pill = SavedPillPosition {
                                x: last_x,
                                y: last_y,
                            };
                            if let Ok(mut guard) = st.pill_pos.lock() {
                                *guard = Some(pill);
                            }
                            let flyout_sz = st
                                .flyout_size
                                .lock()
                                .map(|g| *g)
                                .unwrap_or((FLYOUT_WIDTH, FLYOUT_HEIGHT));
                            save_persisted_geometry(&app_for_thread, pill, flyout_sz);
                        }
                    }
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
    Ok(())
}

/// Redimensionnement natif fluide 8 directions pour une fenêtre `WS_POPUP` sans `WS_THICKFRAME`.
#[tauri::command]
pub fn start_flyout_resize(app: AppHandle, direction: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::time::Duration;
        use windows::Win32::Foundation::{HWND, POINT, RECT};
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_LBUTTON, VK_RBUTTON,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetCursorPos, GetSystemMetrics, GetWindowRect, SetWindowPos, SM_SWAPBUTTON,
            SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOCOPYBITS, SWP_NOOWNERZORDER, SWP_NOZORDER,
        };

        let Some(win) = app.get_window("main") else {
            return Ok(());
        };
        let Ok(raw_hwnd) = win.hwnd() else {
            return Ok(());
        };
        let Some(state) = app.try_state::<WindowGeometryState>() else {
            return Ok(());
        };
        let expanded = state.is_expanded.lock().map(|g| *g).unwrap_or(false);
        if !expanded {
            return Ok(());
        }
        if state
            .pointer_op_active
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Ok(());
        }

        let scale = win.scale_factor().unwrap_or(1.0);
        let hwnd_bits = raw_hwnd.0 as isize;
        let app_for_thread = app.clone();

        let resize_west = direction.contains("West");
        let resize_east = direction.contains("East");
        let resize_north = direction.contains("North");
        let resize_south = direction.contains("South");

        std::thread::spawn(move || {
            struct OpReset<'a>(&'a AppHandle);
            impl Drop for OpReset<'_> {
                fn drop(&mut self) {
                    if let Some(st) = self.0.try_state::<WindowGeometryState>() {
                        st.pointer_op_active.store(false, Ordering::SeqCst);
                    }
                }
            }
            let _guard = OpReset(&app_for_thread);

            let hwnd = HWND(hwnd_bits as *mut _);
            unsafe {
                let mut start_pt = POINT::default();
                let mut start_rect = RECT::default();
                if GetCursorPos(&mut start_pt).is_err()
                    || GetWindowRect(hwnd, &mut start_rect).is_err()
                {
                    return;
                }

                let start_w = (start_rect.right - start_rect.left).max(1);
                let start_h = (start_rect.bottom - start_rect.top).max(1);
                let work = get_work_area_near(Some((
                    start_rect.left + start_w / 2,
                    start_rect.top + start_h / 2,
                )));

                let min_w = (MIN_FLYOUT_WIDTH * scale).round() as i32;
                let min_h = (MIN_FLYOUT_HEIGHT * scale).round() as i32;
                let max_w = ((MAX_FLYOUT_WIDTH * scale).round() as i32)
                    .min((work.right - work.left - EDGE_MARGIN).max(min_w));
                let max_h = ((MAX_FLYOUT_HEIGHT * scale).round() as i32)
                    .min((work.bottom - work.top - EDGE_MARGIN).max(min_h));

                let primary_vk = if GetSystemMetrics(SM_SWAPBUTTON) != 0 {
                    VK_RBUTTON.0 as i32
                } else {
                    VK_LBUTTON.0 as i32
                };

                let mut last_x = start_rect.left;
                let mut last_y = start_rect.top;
                let mut last_w = start_w;
                let mut last_h = start_h;
                let mut resized = false;

                while (GetAsyncKeyState(primary_vk) as u16 & 0x8000) != 0 {
                    let mut cur_pt = POINT::default();
                    if GetCursorPos(&mut cur_pt).is_ok() {
                        let dx = cur_pt.x - start_pt.x;
                        let dy = cur_pt.y - start_pt.y;

                        let (next_x, next_w) = if resize_east {
                            (start_rect.left, (start_w + dx).clamp(min_w, max_w))
                        } else if resize_west {
                            let w = (start_w - dx).clamp(min_w, max_w);
                            (start_rect.right - w, w)
                        } else {
                            (start_rect.left, start_w)
                        };

                        let (next_y, next_h) = if resize_south {
                            (start_rect.top, (start_h + dy).clamp(min_h, max_h))
                        } else if resize_north {
                            let h = (start_h - dy).clamp(min_h, max_h);
                            (start_rect.bottom - h, h)
                        } else {
                            (start_rect.top, start_h)
                        };

                        if next_x != last_x
                            || next_y != last_y
                            || next_w != last_w
                            || next_h != last_h
                        {
                            let _ = SetWindowPos(
                                hwnd,
                                None,
                                next_x,
                                next_y,
                                next_w,
                                next_h,
                                SWP_ASYNCWINDOWPOS
                                    | SWP_NOZORDER
                                    | SWP_NOACTIVATE
                                    | SWP_NOOWNERZORDER
                                    | SWP_NOCOPYBITS,
                            );
                            last_x = next_x;
                            last_y = next_y;
                            last_w = next_w;
                            last_h = next_h;
                            resized = true;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(4));
                }

                if resized {
                    clear_hwnd_gdi_surface(hwnd);
                    if let Some(st) = app_for_thread.try_state::<WindowGeometryState>() {
                        let logical_sz = (
                            ((last_w as f64) / scale).clamp(MIN_FLYOUT_WIDTH, MAX_FLYOUT_WIDTH),
                            ((last_h as f64) / scale).clamp(MIN_FLYOUT_HEIGHT, MAX_FLYOUT_HEIGHT),
                        );
                        if let Ok(mut sz_guard) = st.flyout_size.lock() {
                            *sz_guard = logical_sz;
                        }
                        let saved_pill = st.pill_pos.lock().ok().and_then(|g| *g);
                        if let Some(pill) = saved_pill {
                            save_persisted_geometry(&app_for_thread, pill, logical_sz);
                        }
                    }
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (app, direction);
    }
    Ok(())
}
