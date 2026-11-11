use std::sync::Mutex;
use tauri::webview::{Color, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl};

pub const LOVELACE_WEBVIEW_LABEL: &str = "ha-lovelace";

pub struct LovelaceWebviewState {
    pub configured_url: Mutex<Option<String>>,
    pub hide_ha_header: Mutex<bool>,
}

impl Default for LovelaceWebviewState {
    fn default() -> Self {
        Self {
            configured_url: Mutex::new(None),
            hide_ha_header: Mutex::new(false),
        }
    }
}

fn build_lovelace_init_script(initial_hide_header: bool) -> String {
    let flag = if initial_hide_header { "true" } else { "false" };
    format!(
        r#"
(function () {{
  if (window.__MHA_LOVELACE_BRIDGE__) return;
  window.__MHA_LOVELACE_BRIDGE__ = true;
  window.__MHA_HIDE_HEADER__ = {flag};

  // Barre de défilement sombre discrète type Windows 11 Fluent
  function injectScrollbarStyle() {{
    const root = document.head || document.documentElement;
    if (!root || document.getElementById('mha-fluent-scroll')) return;
    const st = document.createElement('style');
    st.id = 'mha-fluent-scroll';
    st.textContent = `
      ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
      ::-webkit-scrollbar-track {{ background: transparent; }}
      ::-webkit-scrollbar-thumb {{ background: rgba(255, 255, 255, 0.22); border-radius: 9999px; }}
      ::-webkit-scrollbar-thumb:hover {{ background: rgba(255, 255, 255, 0.36); }}
    `;
    root.appendChild(st);
  }}

  // Masquage optionnel de la barre supérieure Home Assistant (mode épuré 1-clic)
  function applyHaHeaderVisibility() {{
    try {{
      const ha = document.querySelector('home-assistant');
      if (!ha || !ha.shadowRoot) return;
      const main = ha.shadowRoot.querySelector('home-assistant-main');
      if (!main || !main.shadowRoot) return;
      const panel = main.shadowRoot.querySelector('ha-panel-lovelace');
      if (!panel || !panel.shadowRoot) return;
      const huiRoot = panel.shadowRoot.querySelector('hui-root');
      if (!huiRoot || !huiRoot.shadowRoot) return;

      const sr = huiRoot.shadowRoot;
      let styleEl = sr.getElementById('mha-kiosk-header-style');
      if (window.__MHA_HIDE_HEADER__) {{
        if (!styleEl) {{
          styleEl = document.createElement('style');
          styleEl.id = 'mha-kiosk-header-style';
          styleEl.textContent = `
            .header {{ display: none !important; }}
            #view {{
              min-height: 100vh !important;
              padding-top: 8px !important;
            }}
          `;
          sr.appendChild(styleEl);
          window.dispatchEvent(new Event('resize'));
        }}
      }} else if (styleEl) {{
        styleEl.remove();
        window.dispatchEvent(new Event('resize'));
      }}
    }} catch (_err) {{}}
  }}

  window.__MHA_SET_HIDE_HEADER__ = function (hide) {{
    window.__MHA_HIDE_HEADER__ = Boolean(hide);
    applyHaHeaderVisibility();
  }};

  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', function () {{
      injectScrollbarStyle();
      applyHaHeaderVisibility();
    }});
  }} else {{
    injectScrollbarStyle();
    applyHaHeaderVisibility();
  }}

  setInterval(function () {{
    injectScrollbarStyle();
    applyHaHeaderVisibility();
  }}, 700);

  // Ctrl + Molette au-dessus de la page Lovelace -> pilote directement le volume Ampli/Télé
  let lastWheelAt = 0;
  let wheelSeq = 0;
  window.addEventListener(
    'wheel',
    function (e) {{
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastWheelAt < 55) return;
      lastWheelAt = now;
      wheelSeq = (wheelSeq + 1) % 10000;
      const prevTitle =
        document.title && !document.title.startsWith('__MHA_VOL_')
          ? document.title
          : 'Home Assistant';
      document.title = (e.deltaY < 0 ? '__MHA_VOL_UP__' : '__MHA_VOL_DOWN__') + wheelSeq;
      requestAnimationFrame(function () {{
        if (document.title.startsWith('__MHA_VOL_')) {{
          document.title = prevTitle;
        }}
      }});
    }},
    {{ capture: true, passive: false }}
  );
}})();
"#
    )
}

pub fn hide_lovelace_webview_sync(app: &AppHandle) {
    if let Some(wv) = app.get_webview(LOVELACE_WEBVIEW_LABEL) {
        let _ = wv.hide();
    }
}

#[tauri::command]
pub async fn sync_lovelace_webview(
    app: AppHandle,
    url: String,
    visible: bool,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    hide_ha_header: bool,
) -> Result<(), String> {
    let trimmed_url = url.trim().to_string();

    if let Some(state) = app.try_state::<LovelaceWebviewState>() {
        if let Ok(mut guard) = state.hide_ha_header.lock() {
            *guard = hide_ha_header;
        }
    }

    if !visible || trimmed_url.is_empty() || width < 40.0 || height < 40.0 {
        hide_lovelace_webview_sync(&app);
        return Ok(());
    }

    let parsed_url = Url::parse(&trimmed_url).map_err(|e| format!("URL invalide: {e}"))?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err("Protocole URL non autorisé".to_string());
    }

    if let Some(wv) = app.get_webview(LOVELACE_WEBVIEW_LABEL) {
        let should_navigate = if let Some(state) = app.try_state::<LovelaceWebviewState>() {
            if let Ok(mut cfg_guard) = state.configured_url.lock() {
                if cfg_guard.as_deref() != Some(trimmed_url.as_str()) {
                    *cfg_guard = Some(trimmed_url.clone());
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        if should_navigate {
            let _ = wv.navigate(parsed_url);
        }

        let _ = wv.set_position(LogicalPosition::new(x, y));
        let _ = wv.set_size(LogicalSize::new(width, height));

        let hide_js = format!(
            "if (window.__MHA_SET_HIDE_HEADER__) window.__MHA_SET_HIDE_HEADER__({});",
            if hide_ha_header { "true" } else { "false" }
        );
        let _ = wv.eval(hide_js);
        let _ = wv.show();
        return Ok(());
    }

    let Some(main_win) = app.get_window("main") else {
        return Ok(());
    };

    let app_for_title = app.clone();
    let builder = WebviewBuilder::new(LOVELACE_WEBVIEW_LABEL, WebviewUrl::External(parsed_url))
        .zoom_hotkeys_enabled(false)
        .enable_clipboard_access()
        .background_color(Color(28, 30, 36, 255))
        .initialization_script(build_lovelace_init_script(hide_ha_header))
        .on_document_title_changed(move |_wv, title| {
            if title.starts_with("__MHA_VOL_UP__") {
                let _ = app_for_title.emit("ha-key-command", "volume_up");
            } else if title.starts_with("__MHA_VOL_DOWN__") {
                let _ = app_for_title.emit("ha-key-command", "volume_down");
            }
        });

    let webview = main_win
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    if let Some(state) = app.try_state::<LovelaceWebviewState>() {
        if let Ok(mut cfg_guard) = state.configured_url.lock() {
            *cfg_guard = Some(trimmed_url);
        }
    }

    let _ = webview.show();
    Ok(())
}

#[tauri::command]
pub async fn reload_lovelace_webview(app: AppHandle) -> Result<(), String> {
    if let Some(wv) = app.get_webview(LOVELACE_WEBVIEW_LABEL) {
        let _ = wv.reload();
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_lovelace_session(app: AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<LovelaceWebviewState>() {
        if let Ok(mut cfg_guard) = state.configured_url.lock() {
            *cfg_guard = None;
        }
    }
    hide_lovelace_webview_sync(&app);
    Ok(())
}
