import type { NativeKeyCommand, TrayAction, UpdateStatus } from '../types/ha';

const SESSION_FALLBACK_TOKEN_KEY = 'mha_session_token_dev_only';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getSecureToken(): Promise<string | null> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('get_ha_token');
  }
  return sessionStorage.getItem(SESSION_FALLBACK_TOKEN_KEY);
}

export async function saveSecureToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_ha_token', { token: trimmed });
    return;
  }
  sessionStorage.setItem(SESSION_FALLBACK_TOKEN_KEY, trimmed);
}

export async function deleteSecureToken(): Promise<void> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_ha_token');
    return;
  }
  sessionStorage.removeItem(SESSION_FALLBACK_TOKEN_KEY);
}

export async function setWidgetExpandedNative(expanded: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_widget_expanded', { expanded });
}

export async function setWindowFocusableNative(focusable: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_window_focusable', { focusable });
}

export async function resetPillAboveClockNative(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('reset_pill_above_clock');
}

export async function setPcGraceSecondsNative(seconds: number): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_pc_grace_seconds', { seconds });
}

export type FlyoutResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West';

export async function startNativeWindowDrag(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startDragging();
}

export async function startNativeResizeDrag(direction: FlyoutResizeDirection): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startResizeDragging(direction);
}

export async function recordPillDraggedPositionNative(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('record_pill_position');
}

export async function getAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return '0.1.0';
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return '0.1.0';
  }
}

export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart');
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  if (!isTauriRuntime()) return enabled;
  try {
    const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function checkAndOptionallyInstallUpdate(
  installImmediately: boolean,
  onProgress?: (status: UpdateStatus) => void,
): Promise<UpdateStatus> {
  if (!isTauriRuntime()) {
    const idle: UpdateStatus = { checking: false, available: false, installing: false };
    onProgress?.(idle);
    return idle;
  }

  onProgress?.({ checking: true, available: false, installing: false });
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      const upToDate: UpdateStatus = { checking: false, available: false, installing: false };
      onProgress?.(upToDate);
      return upToDate;
    }

    if (!installImmediately) {
      const found: UpdateStatus = {
        checking: false,
        available: true,
        version: update.version,
        installing: false,
      };
      onProgress?.(found);
      return found;
    }

    const installing: UpdateStatus = {
      checking: false,
      available: true,
      version: update.version,
      installing: true,
    };
    onProgress?.(installing);

    await update.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
    return installing;
  } catch (err) {
    const failed: UpdateStatus = {
      checking: false,
      available: false,
      installing: false,
      error: err instanceof Error ? err.message : 'Échec MAJ',
    };
    onProgress?.(failed);
    return failed;
  }
}

export async function subscribeNativeEvents(
  onKeyCommand: (cmd: NativeKeyCommand) => void,
  onTrayAction: (action: TrayAction) => void,
): Promise<() => void> {
  if (isTauriRuntime()) {
    const { listen } = await import('@tauri-apps/api/event');
    const unlistenKey = await listen<NativeKeyCommand>('ha-key-command', (event) => {
      onKeyCommand(event.payload);
    });
    const unlistenTray = await listen<TrayAction>('tray-action', (event) => {
      onTrayAction(event.payload);
    });
    return () => {
      unlistenKey();
      unlistenTray();
    };
  }

  // Fallback clavier en aperçu navigateur (Ctrl + Flèche Haut/Bas pour le volume, touches média navigateur)
  const keyHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      onKeyCommand('volume_up');
    } else if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      onKeyCommand('volume_down');
    } else if (e.ctrlKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      onKeyCommand('volume_mute');
    } else if (e.key === 'MediaPlayPause') {
      e.preventDefault();
      onKeyCommand('play_pause');
    } else if (e.key === 'MediaTrackNext') {
      e.preventDefault();
      onKeyCommand('next');
    } else if (e.key === 'MediaTrackPrevious') {
      e.preventDefault();
      onKeyCommand('previous');
    }
  };
  window.addEventListener('keydown', keyHandler);
  return () => window.removeEventListener('keydown', keyHandler);
}
