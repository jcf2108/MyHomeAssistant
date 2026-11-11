import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  GripHorizontal,
  Link2,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MiniPill } from './components/MiniPill';
import { MediaFlyoutSection } from './components/MediaFlyoutSection';
import { LightsSection } from './components/LightsSection';
import { ScenesSection } from './components/ScenesSection';
import { SettingsView } from './components/SettingsView';
import { PREVIEW_ENTITIES } from './data/previewEntities';
import { HomeAssistantWsClient, normalizeHaBaseUrl, resolveHaMediaUrl } from './services/haWebsocket';
import {
  checkAndOptionallyInstallUpdate,
  deleteSecureToken,
  getAppVersion,
  getAutostartEnabled,
  getSecureToken,
  isTauriRuntime,
  recordPillDraggedPositionNative,
  resetPillAboveClockNative,
  saveSecureToken,
  setAutostartEnabled,
  setPcGraceSecondsNative,
  setWidgetExpandedNative,
  setWindowFocusableNative,
  startNativeWindowDrag,
  subscribeNativeEvents,
} from './services/tauriBridge';
import type {
  AppSettings,
  HaConnectionStatus,
  HaEntity,
  NativeKeyCommand,
  TrayAction,
  UpdateStatus,
} from './types/ha';

const SETTINGS_STORAGE_KEY = 'mha_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  haUrl: '',
  activeMediaPlayerId: '',
  enabledMediaPlayers: [],
  enabledLights: [],
  enabledScenes: [],
  pillFavorites: [],
  pcMediaGraceSeconds: 45,
  volumeStepPct: 4,
  autoCheckUpdates: true,
  previewMode: true,
};

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const App: React.FC = () => {
  const nativeTauri = isTauriRuntime();
  const initialViewParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('view');
  }, []);

  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [expanded, setExpanded] = useState<boolean>(() =>
    nativeTauri ? false : initialViewParam !== 'pill',
  );
  const [showSettings, setShowSettings] = useState<boolean>(() => initialViewParam === 'settings');

  const [status, setStatus] = useState<HaConnectionStatus>('unconfigured');
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
  const [hasStoredToken, setHasStoredToken] = useState<boolean>(false);

  const [liveEntities, setLiveEntities] = useState<Record<string, HaEntity>>({});
  const [previewEntities, setPreviewEntities] =
    useState<Record<string, HaEntity>>(PREVIEW_ENTITIES);

  const [volumeHighlight, setVolumeHighlight] = useState<number | null>(null);
  const [autostart, setAutostart] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    installing: false,
  });

  // Déplacement libre en mode aperçu navigateur (sur Tauri, c'est la fenêtre OS elle-même qui bouge)
  const [browserOffset, setBrowserOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);

  const wsClientRef = useRef<HomeAssistantWsClient | null>(null);
  const volumeBadgeTimerRef = useRef<number | null>(null);
  const throttleTimersRef = useRef<Map<string, number>>(new Map());

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  const usingPreview = settings.previewMode && status !== 'connected';
  const entitiesMap = usingPreview ? previewEntities : liveEntities;

  // Synchronisation initiale des réglages natifs Tauri
  useEffect(() => {
    void getAppVersion().then(setAppVersion);
    void getAutostartEnabled().then(setAutostart);
  }, []);

  useEffect(() => {
    void setPcGraceSecondsNative(settings.pcMediaGraceSeconds);
  }, [settings.pcMediaGraceSeconds]);

  // Synchronisation de la taille/position fenêtre Tauri et du focus clavier
  useEffect(() => {
    void setWidgetExpandedNative(expanded);
  }, [expanded]);

  useEffect(() => {
    // Active le focus clavier normal quand la vue Paramètres est ouverte pour saisir URL/Token
    void setWindowFocusableNative(expanded && showSettings);
  }, [expanded, showSettings]);

  // Initialisation du client WebSocket Home Assistant
  useEffect(() => {
    const client = new HomeAssistantWsClient({
      onStatusChange: (nextStatus, detail) => {
        setStatus(nextStatus);
        setErrorDetail(detail);
      },
      onStatesSnapshot: (snapshot) => {
        setLiveEntities(snapshot);
      },
      onEntityUpdate: (entity) => {
        setLiveEntities((prev) => ({
          ...prev,
          [entity.entity_id]: entity,
        }));
      },
    });
    wsClientRef.current = client;

    void (async () => {
      const savedToken = await getSecureToken();
      const tokenPresent = Boolean(savedToken && savedToken.trim());
      setHasStoredToken(tokenPresent);
      if (settings.haUrl.trim() && savedToken) {
        client.connect(settings.haUrl, savedToken);
      }
    })();

    return () => {
      client.disconnect();
      wsClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sélection intelligente des premières entités lors de la 1ère connexion réelle
  useEffect(() => {
    if (status !== 'connected') return;
    const all = Object.values(liveEntities);
    if (all.length === 0) return;

    const patch: Partial<AppSettings> = {};
    if (settings.enabledMediaPlayers.length === 0) {
      const mps = all
        .filter((e) => e.entity_id.startsWith('media_player.'))
        .slice(0, 6)
        .map((e) => e.entity_id);
      if (mps.length > 0) {
        patch.enabledMediaPlayers = mps;
        if (!settings.activeMediaPlayerId) {
          patch.activeMediaPlayerId = mps[0];
        }
      }
    }
    if (settings.enabledLights.length === 0) {
      const lights = all
        .filter((e) => e.entity_id.startsWith('light.'))
        .slice(0, 6)
        .map((e) => e.entity_id);
      if (lights.length > 0) patch.enabledLights = lights;
    }
    if (settings.enabledScenes.length === 0) {
      const scenes = all
        .filter((e) => e.entity_id.startsWith('scene.') || e.entity_id.startsWith('script.'))
        .slice(0, 6)
        .map((e) => e.entity_id);
      if (scenes.length > 0) patch.enabledScenes = scenes;
    }
    if (settings.pillFavorites.length === 0) {
      const favs = all
        .filter((e) => e.entity_id.startsWith('light.') || e.entity_id.startsWith('scene.'))
        .slice(0, 3)
        .map((e) => e.entity_id);
      if (favs.length > 0) patch.pillFavorites = favs;
    }

    if (Object.keys(patch).length > 0) {
      updateSettings(patch);
    }
  }, [
    liveEntities,
    settings.activeMediaPlayerId,
    settings.enabledLights.length,
    settings.enabledMediaPlayers.length,
    settings.enabledScenes.length,
    settings.pillFavorites.length,
    status,
    updateSettings,
  ]);

  // Vérification automatique des mises à jour (démarrage + toutes les 2 heures)
  useEffect(() => {
    if (!settings.autoCheckUpdates || !nativeTauri) return;
    const runSilentCheck = () => {
      void checkAndOptionallyInstallUpdate(true, setUpdateStatus);
    };
    const initialTimer = window.setTimeout(runSilentCheck, 4000);
    const interval = window.setInterval(runSilentCheck, 2 * 60 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [nativeTauri, settings.autoCheckUpdates]);

  // Entités filtrées à afficher
  const mediaPlayers = useMemo(() => {
    const allMps = Object.values(entitiesMap).filter((e) =>
      e.entity_id.startsWith('media_player.'),
    );
    if (usingPreview || settings.enabledMediaPlayers.length === 0) return allMps;
    return allMps.filter((e) => settings.enabledMediaPlayers.includes(e.entity_id));
  }, [entitiesMap, settings.enabledMediaPlayers, usingPreview]);

  const activePlayer = useMemo<HaEntity | null>(() => {
    if (mediaPlayers.length === 0) return null;
    const explicit = mediaPlayers.find((p) => p.entity_id === settings.activeMediaPlayerId);
    if (explicit) return explicit;
    const playing = mediaPlayers.find((p) => p.state === 'playing');
    return playing || mediaPlayers[0];
  }, [mediaPlayers, settings.activeMediaPlayerId]);

  const visibleLights = useMemo(() => {
    const allLights = Object.values(entitiesMap).filter((e) => e.entity_id.startsWith('light.'));
    if (usingPreview || settings.enabledLights.length === 0) return allLights.slice(0, 6);
    return allLights.filter((e) => settings.enabledLights.includes(e.entity_id));
  }, [entitiesMap, settings.enabledLights, usingPreview]);

  const visibleScenes = useMemo(() => {
    const allScenes = Object.values(entitiesMap).filter(
      (e) => e.entity_id.startsWith('scene.') || e.entity_id.startsWith('script.'),
    );
    if (usingPreview || settings.enabledScenes.length === 0) return allScenes.slice(0, 6);
    return allScenes.filter((e) => settings.enabledScenes.includes(e.entity_id));
  }, [entitiesMap, settings.enabledScenes, usingPreview]);

  const favoriteEntities = useMemo(() => {
    if (usingPreview && settings.pillFavorites.length === 0) {
      return [
        entitiesMap['light.suspension_salon'],
        entitiesMap['light.lampe_bureau'],
        entitiesMap['scene.ambiance_cinema'],
      ].filter((x): x is HaEntity => Boolean(x));
    }
    return settings.pillFavorites
      .map((id) => entitiesMap[id])
      .filter((x): x is HaEntity => Boolean(x));
  }, [entitiesMap, settings.pillFavorites, usingPreview]);

  const coverUrl = useMemo(() => {
    if (!activePlayer) return null;
    return resolveHaMediaUrl(settings.haUrl, activePlayer.attributes.entity_picture);
  }, [activePlayer, settings.haUrl]);

  const flashVolumeBadge = useCallback((pct: number) => {
    setVolumeHighlight(pct);
    if (volumeBadgeTimerRef.current !== null) {
      window.clearTimeout(volumeBadgeTimerRef.current);
    }
    volumeBadgeTimerRef.current = window.setTimeout(() => {
      setVolumeHighlight(null);
      volumeBadgeTimerRef.current = null;
    }, 1200);
  }, []);

  const runThrottledService = useCallback(
    (key: string, delayMs: number, fn: () => Promise<void>) => {
      const existing = throttleTimersRef.current.get(key);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const timer = window.setTimeout(() => {
        throttleTimersRef.current.delete(key);
        void fn().catch(() => {
          // state will resync from HA WebSocket
        });
      }, delayMs);
      throttleTimersRef.current.set(key, timer);
    },
    [],
  );

  const applyEntityOptimistic = useCallback(
    (entityId: string, mutator: (prev: HaEntity) => HaEntity) => {
      const setter = usingPreview ? setPreviewEntities : setLiveEntities;
      setter((prev) => {
        const current = prev[entityId];
        if (!current) return prev;
        return { ...prev, [entityId]: mutator(current) };
      });
    },
    [usingPreview],
  );

  // Actions Média & Volume
  const handlePlayPause = useCallback(() => {
    if (!activePlayer) return;
    const nextState = activePlayer.state === 'playing' ? 'paused' : 'playing';
    applyEntityOptimistic(activePlayer.entity_id, (cur) => ({ ...cur, state: nextState }));
    if (!usingPreview) {
      void wsClientRef.current
        ?.callService('media_player', 'media_play_pause', {}, { entity_id: activePlayer.entity_id })
        .catch(() => {});
    }
  }, [activePlayer, applyEntityOptimistic, usingPreview]);

  const handleNextTrack = useCallback(() => {
    if (!activePlayer) return;
    if (usingPreview) {
      applyEntityOptimistic(activePlayer.entity_id, (cur) => ({
        ...cur,
        state: 'playing',
        attributes: {
          ...cur.attributes,
          media_title:
            cur.attributes.media_title === 'Midnight City' ? 'Nightcall' : 'Midnight City',
          media_artist: cur.attributes.media_title === 'Midnight City' ? 'Kavinsky' : 'M83',
        },
      }));
      return;
    }
    void wsClientRef.current
      ?.callService('media_player', 'media_next_track', {}, { entity_id: activePlayer.entity_id })
      .catch(() => {});
  }, [activePlayer, applyEntityOptimistic, usingPreview]);

  const handlePrevTrack = useCallback(() => {
    if (!activePlayer) return;
    if (usingPreview) {
      handleNextTrack();
      return;
    }
    void wsClientRef.current
      ?.callService(
        'media_player',
        'media_previous_track',
        {},
        { entity_id: activePlayer.entity_id },
      )
      .catch(() => {});
  }, [activePlayer, handleNextTrack, usingPreview]);

  const handleSetVolumePct = useCallback(
    (pct: number, showBadge = false) => {
      if (!activePlayer) return;
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      if (showBadge) {
        flashVolumeBadge(clamped);
      }
      applyEntityOptimistic(activePlayer.entity_id, (cur) => ({
        ...cur,
        attributes: {
          ...cur.attributes,
          volume_level: clamped / 100,
          is_volume_muted: clamped === 0,
        },
      }));
      if (!usingPreview) {
        const targetId = activePlayer.entity_id;
        runThrottledService(`vol:${targetId}`, 80, async () => {
          await wsClientRef.current?.callService(
            'media_player',
            'volume_set',
            { volume_level: clamped / 100 },
            { entity_id: targetId },
          );
        });
      }
    },
    [activePlayer, applyEntityOptimistic, flashVolumeBadge, runThrottledService, usingPreview],
  );

  const handleStepVolume = useCallback(
    (deltaPct: number) => {
      if (!activePlayer) return;
      const current =
        typeof activePlayer.attributes.volume_level === 'number'
          ? Math.round(activePlayer.attributes.volume_level * 100)
          : 30;
      handleSetVolumePct(current + deltaPct, true);
    },
    [activePlayer, handleSetVolumePct],
  );

  const handleToggleMute = useCallback(() => {
    if (!activePlayer) return;
    const nextMuted = !activePlayer.attributes.is_volume_muted;
    applyEntityOptimistic(activePlayer.entity_id, (cur) => ({
      ...cur,
      attributes: { ...cur.attributes, is_volume_muted: nextMuted },
    }));
    if (!usingPreview) {
      void wsClientRef.current
        ?.callService(
          'media_player',
          'volume_mute',
          { is_volume_muted: nextMuted },
          { entity_id: activePlayer.entity_id },
        )
        .catch(() => {});
    }
  }, [activePlayer, applyEntityOptimistic, usingPreview]);

  const handleSelectSource = useCallback(
    (source: string) => {
      if (!activePlayer) return;
      applyEntityOptimistic(activePlayer.entity_id, (cur) => ({
        ...cur,
        attributes: { ...cur.attributes, source },
      }));
      if (!usingPreview) {
        void wsClientRef.current
          ?.callService(
            'media_player',
            'select_source',
            { source },
            { entity_id: activePlayer.entity_id },
          )
          .catch(() => {});
      }
    },
    [activePlayer, applyEntityOptimistic, usingPreview],
  );

  // Actions Lumières & Scènes
  const handleToggleLight = useCallback(
    (entityId: string) => {
      const entity = entitiesMap[entityId];
      if (!entity) return;
      const nextOn = entity.state !== 'on';
      applyEntityOptimistic(entityId, (cur) => ({
        ...cur,
        state: nextOn ? 'on' : 'off',
        attributes: {
          ...cur.attributes,
          brightness: nextOn ? cur.attributes.brightness || 204 : cur.attributes.brightness,
        },
      }));
      if (!usingPreview) {
        void wsClientRef.current
          ?.callService('light', nextOn ? 'turn_on' : 'turn_off', {}, { entity_id: entityId })
          .catch(() => {});
      }
    },
    [applyEntityOptimistic, entitiesMap, usingPreview],
  );

  const handleLightBrightness = useCallback(
    (entityId: string, pct: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      applyEntityOptimistic(entityId, (cur) => ({
        ...cur,
        state: clamped > 0 ? 'on' : 'off',
        attributes: {
          ...cur.attributes,
          brightness: Math.round((clamped / 100) * 255),
        },
      }));
      if (!usingPreview) {
        runThrottledService(`bri:${entityId}`, 90, async () => {
          if (clamped === 0) {
            await wsClientRef.current?.callService('light', 'turn_off', {}, { entity_id: entityId });
          } else {
            await wsClientRef.current?.callService(
              'light',
              'turn_on',
              { brightness_pct: clamped },
              { entity_id: entityId },
            );
          }
        });
      }
    },
    [applyEntityOptimistic, runThrottledService, usingPreview],
  );

  const handleLightColorTemp = useCallback(
    (entityId: string, kelvin: number) => {
      applyEntityOptimistic(entityId, (cur) => ({
        ...cur,
        state: 'on',
        attributes: {
          ...cur.attributes,
          color_mode: 'color_temp',
          color_temp_kelvin: kelvin,
        },
      }));
      if (!usingPreview) {
        runThrottledService(`kelvin:${entityId}`, 90, async () => {
          await wsClientRef.current?.callService(
            'light',
            'turn_on',
            { color_temp_kelvin: kelvin },
            { entity_id: entityId },
          );
        });
      }
    },
    [applyEntityOptimistic, runThrottledService, usingPreview],
  );

  const handleLightRgb = useCallback(
    (entityId: string, rgb: [number, number, number]) => {
      applyEntityOptimistic(entityId, (cur) => ({
        ...cur,
        state: 'on',
        attributes: {
          ...cur.attributes,
          color_mode: 'rgb',
          rgb_color: rgb,
        },
      }));
      if (!usingPreview) {
        void wsClientRef.current
          ?.callService('light', 'turn_on', { rgb_color: rgb }, { entity_id: entityId })
          .catch(() => {});
      }
    },
    [applyEntityOptimistic, usingPreview],
  );

  const handleActivateScene = useCallback(
    (entity: HaEntity) => {
      if (usingPreview) {
        if (entity.entity_id === 'script.extinction_totale') {
          setPreviewEntities((prev) => {
            const copy = { ...prev };
            for (const key of Object.keys(copy)) {
              if (key.startsWith('light.')) {
                copy[key] = { ...copy[key], state: 'off' };
              }
            }
            return copy;
          });
        } else if (entity.entity_id === 'scene.ambiance_cinema') {
          setPreviewEntities((prev) => ({
            ...prev,
            'light.suspension_salon': {
              ...prev['light.suspension_salon'],
              state: 'on',
              attributes: {
                ...prev['light.suspension_salon'].attributes,
                brightness: 64,
                color_temp_kelvin: 2400,
              },
            },
            'light.bandeau_tv': {
              ...prev['light.bandeau_tv'],
              state: 'on',
              attributes: {
                ...prev['light.bandeau_tv'].attributes,
                brightness: 180,
              },
            },
          }));
        }
        return;
      }

      const domain = entity.entity_id.startsWith('script.') ? 'script' : 'scene';
      void wsClientRef.current
        ?.callService(domain, 'turn_on', {}, { entity_id: entity.entity_id })
        .catch(() => {});
    },
    [usingPreview],
  );

  const handleTriggerFavorite = useCallback(
    (fav: HaEntity) => {
      if (fav.entity_id.startsWith('light.')) {
        handleToggleLight(fav.entity_id);
      } else {
        handleActivateScene(fav);
      }
    },
    [handleActivateScene, handleToggleLight],
  );

  // Abonnement aux événements natifs Windows (touches média, Ctrl+Volume, System Tray)
  const keyActionRef = useRef<(cmd: NativeKeyCommand) => void>(() => {});
  keyActionRef.current = (cmd: NativeKeyCommand) => {
    switch (cmd) {
      case 'play_pause':
        handlePlayPause();
        break;
      case 'next':
        handleNextTrack();
        break;
      case 'previous':
        handlePrevTrack();
        break;
      case 'volume_up':
        handleStepVolume(settings.volumeStepPct);
        break;
      case 'volume_down':
        handleStepVolume(-settings.volumeStepPct);
        break;
      case 'volume_mute':
        handleToggleMute();
        break;
      default:
        break;
    }
  };

  const trayActionRef = useRef<(action: TrayAction) => void>(() => {});
  trayActionRef.current = (action: TrayAction) => {
    if (action === 'toggle_expand') {
      setExpanded((prev) => !prev);
    } else if (action === 'open_settings') {
      setExpanded(true);
      setShowSettings(true);
    } else if (action === 'reset_position') {
      setBrowserOffset(null);
      void resetPillAboveClockNative();
    }
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void subscribeNativeEvents(
      (cmd) => keyActionRef.current(cmd),
      (act) => trayActionRef.current(act),
    ).then((unsub) => {
      cleanup = unsub;
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Connexion & Gestion du jeton sécurisé
  const handleSaveConnection = async (rawUrl: string, newToken: string) => {
    const cleanUrl = normalizeHaBaseUrl(rawUrl);
    let activeToken = newToken.trim();
    if (activeToken) {
      await saveSecureToken(activeToken);
      setHasStoredToken(true);
    } else {
      activeToken = (await getSecureToken()) || '';
    }
    updateSettings({ haUrl: cleanUrl, previewMode: false });
    if (cleanUrl && activeToken) {
      wsClientRef.current?.connect(cleanUrl, activeToken);
    }
  };

  const handleClearToken = async () => {
    await deleteSecureToken();
    setHasStoredToken(false);
    wsClientRef.current?.disconnect();
    setLiveEntities({});
    setStatus('unconfigured');
  };

  const handleToggleAutostart = async (next: boolean) => {
    const confirmed = await setAutostartEnabled(next);
    setAutostart(confirmed);
  };

  const handleResetPosition = () => {
    setBrowserOffset(null);
    void resetPillAboveClockNative();
  };

  // Drag libre (fenêtre native sous Tauri, position libre sur la scène en aperçu navigateur)
  const handleDragPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (nativeTauri) {
      void startNativeWindowDrag().then(() => {
        window.setTimeout(() => {
          void recordPillDraggedPositionNative();
        }, 250);
      });
      return;
    }

    e.preventDefault();
    const startRight = browserOffset?.x ?? 20;
    const startBottom = browserOffset?.y ?? 20;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startRight,
      startBottom,
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.pointerX;
      const dy = ev.clientY - dragStartRef.current.pointerY;
      const maxRight = Math.max(12, window.innerWidth - 332);
      const maxBottom = Math.max(12, window.innerHeight - 80);
      setBrowserOffset({
        x: Math.max(12, Math.min(maxRight, dragStartRef.current.startRight - dx)),
        y: Math.max(12, Math.min(maxBottom, dragStartRef.current.startBottom - dy)),
      });
    };

    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const widgetContent = !expanded ? (
    <MiniPill
      status={status}
      previewMode={usingPreview}
      mediaPlayer={activePlayer}
      coverUrl={coverUrl}
      favoriteEntities={favoriteEntities}
      volumeHighlight={volumeHighlight}
      onExpand={() => setExpanded(true)}
      onPlayPause={handlePlayPause}
      onNextTrack={handleNextTrack}
      onWheelVolume={handleStepVolume}
      onTriggerFavorite={handleTriggerFavorite}
      onDragPointerDown={handleDragPointerDown}
    />
  ) : (
    <div
      className={`flyout-surface animate-flyout flex flex-col overflow-hidden rounded-flyout text-fluent-ink ${
        nativeTauri
          ? 'h-full w-full'
          : 'w-[360px] max-w-[calc(100vw-24px)] max-h-[min(640px,calc(100vh-108px))]'
      }`}
      role="dialog"
      aria-label="Panneau MyHomeAssistant"
    >
      {/* Barre supérieure : Poignée de déplacement + État + Replier */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <div className="flex items-center gap-2">
          {showSettings ? (
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Retour aux contrôles"
              className="flex h-7 w-7 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={handleDragPointerDown}
              aria-label="Déplacer le panneau"
              title="Glisser pour déplacer"
              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-control text-fluent-muted transition-colors hover:bg-fluent-elevated hover:text-fluent-ink active:cursor-grabbing"
            >
              <GripHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}

          <h1 className="text-xs font-semibold text-fluent-ink">
            {showSettings ? 'Paramètres' : 'Maison'}
          </h1>

          {usingPreview ? (
            <span className="rounded-pill bg-fluent-accent/15 px-2 py-0.5 text-[10px] font-semibold text-fluent-accent">
              Aperçu
            </span>
          ) : status === 'connected' ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-fluent-online/15 px-2 py-0.5 text-[10px] font-semibold text-fluent-online">
              <Wifi className="h-2.5 w-2.5" strokeWidth={2} />
              En ligne
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-pill bg-fluent-danger/15 px-2 py-0.5 text-[10px] font-semibold text-fluent-danger">
              <WifiOff className="h-2.5 w-2.5" strokeWidth={2} />
              Hors ligne
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSettings(false);
            setExpanded(false);
          }}
          aria-label="Replier en pilule"
          title="Replier"
          className="flex h-7 w-7 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      {/* Corps principal : Contrôles ou Paramètres */}
      {showSettings ? (
        <SettingsView
          settings={settings}
          status={status}
          errorDetail={errorDetail}
          hasStoredToken={hasStoredToken}
          allEntities={usingPreview ? PREVIEW_ENTITIES : liveEntities}
          autostart={autostart}
          appVersion={appVersion}
          updateStatus={updateStatus}
          onSaveConnection={handleSaveConnection}
          onClearToken={handleClearToken}
          onUpdateSettings={updateSettings}
          onToggleAutostart={(next) => void handleToggleAutostart(next)}
          onResetPosition={handleResetPosition}
          onCheckUpdate={(installNow) =>
            void checkAndOptionallyInstallUpdate(installNow, setUpdateStatus)
          }
        />
      ) : status !== 'connected' && !usingPreview ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <WifiOff className="h-7 w-7 text-fluent-muted" strokeWidth={1.75} />
          <div className="text-sm font-semibold text-fluent-ink">Serveur non lié</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 rounded-control bg-fluent-accent px-3.5 py-2 text-xs font-semibold text-fluent-accentInk transition-colors hover:bg-[#7bb6fc]"
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
              Configurer HA
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ previewMode: true })}
              className="rounded-control bg-fluent-elevated px-3 py-2 text-xs font-medium text-fluent-ink transition-colors hover:bg-fluent-hover"
            >
              Aperçu
            </button>
          </div>
        </div>
      ) : (
        <div className="fluent-scroll flex-1 overflow-y-auto">
          <MediaFlyoutSection
            players={mediaPlayers}
            activePlayer={activePlayer}
            coverUrl={coverUrl}
            onSelectPlayer={(entityId) => updateSettings({ activeMediaPlayerId: entityId })}
            onSelectSource={handleSelectSource}
            onPlayPause={handlePlayPause}
            onPrev={handlePrevTrack}
            onNext={handleNextTrack}
            onVolumeChange={(pct) => handleSetVolumePct(pct, false)}
            onToggleMute={handleToggleMute}
          />

          <LightsSection
            lights={visibleLights}
            onToggleLight={handleToggleLight}
            onBrightnessChange={handleLightBrightness}
            onColorTempChange={handleLightColorTemp}
            onRgbChange={handleLightRgb}
          />

          <ScenesSection scenes={visibleScenes} onActivateScene={handleActivateScene} />
        </div>
      )}

      {/* Pied de Flyout style Windows 11 Quick Settings */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#181a20]/80 px-3">
        <div className="flex items-center gap-2">
          {usingPreview && !showSettings ? (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 rounded-control bg-fluent-elevated px-2.5 py-1 text-[11px] font-medium text-fluent-ink transition-colors hover:bg-fluent-hover"
            >
              <Link2 className="h-3 w-3 text-fluent-accent" strokeWidth={1.75} />
              Lier HA
            </button>
          ) : (
            <span className="text-[11px] text-fluent-secondary tabular-data">
              Ctrl + Vol • v{appVersion}
            </span>
          )}

          {updateStatus.available && (
            <button
              type="button"
              onClick={() => void checkAndOptionallyInstallUpdate(true, setUpdateStatus)}
              className="inline-flex items-center gap-1 rounded-pill bg-fluent-accent px-2 py-0.5 text-[10px] font-semibold text-fluent-accentInk"
            >
              <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} />
              MAJ v{updateStatus.version}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          aria-label="Paramètres"
          title="Paramètres"
          className={`flex h-7 w-7 items-center justify-center rounded-control transition-colors duration-150 ${
            showSettings
              ? 'bg-fluent-accent text-fluent-accentInk'
              : 'text-fluent-secondary hover:bg-fluent-elevated hover:text-fluent-ink'
          }`}
        >
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </footer>
    </div>
  );

  // En exécution native Tauri Windows, le widget remplit directement sa fenêtre transparente sans bordure
  if (nativeTauri) {
    return <main className="h-full w-full bg-transparent">{widgetContent}</main>;
  }

  // En aperçu développement Web (127.0.0.1), scène bureau sombre Windows 11 à reflets Mica/Acrylic
  return (
    <main
      style={{
        backgroundImage:
          'radial-gradient(540px circle at calc(100% - 170px) calc(100% - 280px), rgba(56, 128, 224, 0.24), transparent 72%), radial-gradient(380px circle at calc(100% - 80px) calc(100% - 90px), rgba(139, 92, 246, 0.16), transparent 68%)',
      }}
      className="relative min-h-screen w-full overflow-hidden bg-[#0e1015]"
    >
      {/* Barre d'état de simulation bureau sobre en haut à gauche */}
      <nav
        aria-label="Modes d'affichage"
        className="fixed left-3 top-3 z-10 flex flex-wrap items-center gap-1.5 rounded-pill bg-[#1c1e24]/90 p-1 border border-white/[0.08]"
      >
        <button
          type="button"
          onClick={() => {
            setShowSettings(false);
            setExpanded(false);
          }}
          className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
            !expanded
              ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
              : 'text-fluent-secondary hover:text-fluent-ink'
          }`}
        >
          Pilule
        </button>
        <button
          type="button"
          onClick={() => {
            setShowSettings(false);
            setExpanded(true);
          }}
          className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
            expanded && !showSettings
              ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
              : 'text-fluent-secondary hover:text-fluent-ink'
          }`}
        >
          Flyout
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setShowSettings(true);
          }}
          className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
            expanded && showSettings
              ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
              : 'text-fluent-secondary hover:text-fluent-ink'
          }`}
        >
          Paramètres
        </button>
      </nav>

      {/* Zone d'ancrage au-dessus de l'horloge (déplaçable librement à la souris) */}
      <div
        style={{
          right: `${browserOffset?.x ?? 16}px`,
          bottom: `${browserOffset?.y ?? 52}px`,
        }}
        className="fixed z-20 max-w-[calc(100vw-24px)]"
      >
        {widgetContent}
      </div>

      {/* Repère discret de barre des tâches Windows 11 en bas d'écran */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-10 flex h-10 items-center justify-end border-t border-white/[0.06] bg-[#14161c]/95 px-4 text-xs text-fluent-secondary tabular-data"
      >
        <span>FRA &nbsp; 19:42</span>
      </div>
    </main>
  );
};
