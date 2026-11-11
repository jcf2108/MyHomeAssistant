mod credentials;
mod lovelace_view;
mod media_hook;
mod window_ctl;

use lovelace_view::LovelaceWebviewState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use window_ctl::WindowGeometryState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WindowGeometryState::default())
        .manage(LovelaceWebviewState::default())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            if let Some(main_win) = app.get_window("main") {
                window_ctl::apply_initial_window_placement(&handle, &main_win);
            }

            // Menu icône System Tray Windows (à côté de l'horloge)
            let item_toggle =
                MenuItem::with_id(app, "toggle", "Afficher / Replier", true, None::<&str>)?;
            let item_reset = MenuItem::with_id(
                app,
                "reset_pos",
                "Replacer au-dessus de l'horloge",
                true,
                None::<&str>,
            )?;
            let item_settings =
                MenuItem::with_id(app, "settings", "Paramètres", true, None::<&str>)?;
            let item_quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&item_toggle, &item_reset, &item_settings, &item_quit],
            )?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("MyHomeAssistant")
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(w) = app_handle.get_window("main") {
                            let _ = w.show();
                        }
                        let _ = app_handle.emit("tray-action", "toggle_expand");
                    }
                    "reset_pos" => {
                        let _ = window_ctl::reset_pill_above_clock(app_handle.clone());
                        let _ = app_handle.emit("tray-action", "reset_position");
                    }
                    "settings" => {
                        if let Some(w) = app_handle.get_window("main") {
                            let _ = w.show();
                        }
                        let _ = app_handle.emit("tray-action", "open_settings");
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        if let Some(w) = app_handle.get_window("main") {
                            let _ = w.show();
                        }
                        let _ = app_handle.emit("tray-action", "toggle_expand");
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            let _tray = tray_builder.build(app)?;

            // Démarre l'interception intelligente Windows (Média + Ctrl+Volume)
            media_hook::spawn_windows_keyboard_hook(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            credentials::save_ha_token,
            credentials::get_ha_token,
            credentials::delete_ha_token,
            lovelace_view::sync_lovelace_webview,
            lovelace_view::reload_lovelace_webview,
            lovelace_view::clear_lovelace_session,
            media_hook::set_pc_grace_seconds,
            window_ctl::set_widget_expanded,
            window_ctl::set_window_focusable,
            window_ctl::record_pill_position,
            window_ctl::reset_pill_above_clock,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de MyHomeAssistant");
}
