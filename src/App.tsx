import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  ArrowLeft,
  ChevronDown,
  LayoutGrid,
  Link2,
  PanelTop,
  PanelTopClose,
  RefreshCw,
  Settings,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { EmbeddedLovelaceHost } from './components/EmbeddedLovelaceHost';
import { FlyoutResizeHandles } from './components/FlyoutResizeHandles';
import type { HaTileActions } from './components/HaTileCard';
import { LovelaceDashboardView } from './components/LovelaceDashboardView';
import { MiniPill } from './components/MiniPill';
import { SettingsView } from './components/SettingsView';
import { VolumeOutputBar } from './components/VolumeOutputBar';
import { PREVIEW_ENTITIES, PREVIEW_LOVELACE_CONFIG } from './data/previewEntities';
import {
  HomeAssistantWsClient,
  normalizeHaBaseUrl,
  resolveHaMediaUrl,
} from './services/haWebsocket';
import {
  type FlyoutResizeDirection,
  checkAndOptionallyInstallUpdate,
  clearLovelaceSessionNative,
  deleteSecureToken,
  getAppVersion,
  getAutostartEnabled,
  getSecureToken,
  isTauriRuntime,
  reloadLovelaceWebviewNative,
  resetPillAboveClockNative,
  saveSecureToken,
  setAutostartEnabled,
  setPcGraceSecondsNative,
  setWidgetExpandedNative,
  setWindowFocusableNative,
  startNativeResizeDrag,
  startNativeWindowDrag,
  subscribeNativeEvents,
} from './services/tauriBridge';
import type {
  AppSettings,
  HaConnectionStatus,
  HaEntity,
  HaOverviewMetadata,
  NativeKeyCommand,
  TrayAction,
  UpdateStatus,
  VolumeFeedbackBadge,
} from './types/ha';
import { shortEntityLabel } from './utils/color';
import { type DragStartCoords, handleSmartSurfacePointerDown } from './utils/dragGesture';
import { isDomainToggleable } from './utils/haIcons';
import {
  buildAutoAreasOverview,
  extractOverviewEntityIds,
  normalizeLovelaceView,
} from './utils/lovelaceLayout';
import {
  canControlEntityVolume,
  resolvePlaybackTarget,
  resolveVolumeTarget,
  supportsVolumeSet,
  supportsVolumeStep,
} from './utils/mediaRouting';

const SETTINGS_STORAGE_KEY = 'mha_settings_v2';

const DEFAULT_SETTINGS: AppSettings = {
  haUrl: '',
  volumeTargetMode: 'auto',
  activeMediaPlayerId: '',
  selectedDashboardPath: null,
  selectedViewIndex: 0,
  dashboardDisplayMode: 'embedded',
  hideHaHeader: false,
  enabledMediaPlayers: [],
  enabledLights: [],
  enabledScenes: [],
  pillFavorites: [],
  pcMediaGraceSeconds: 45,
  volumeStepPct: 2,
  autoCheckUpdates: true,
  previewMode: true,
};

interface ActiveVolumeToast {
  entityId: string;
  targetLabel: string;
  mode: 'step' | 'set' | 'mute';
  direction?: 'up' | 'down';
  baselineLevel: number | null;
  observedChange: boolean;
  explicitPct?: number;
  muted?: boolean;
  triggeredAt: number;
}

function loadSavedSettings(): AppSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_STORAGE_KEY) || localStorage.getItem('mha_settings_v1');
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const validSteps = [1, 2, 5];
    const stepPct =
      typeof parsed.volumeStepPct === 'number' && validSteps.includes(parsed.volumeStepPct)
        ? parsed.volumeStepPct
        : 2;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      volumeTargetMode: parsed.volumeTargetMode || 'auto',
      selectedDashboardPath: parsed.selectedDashboardPath ?? null,
      selectedViewIndex: parsed.selectedViewIndex ?? 0,
      dashboardDisplayMode: parsed.dashboardDisplayMode || 'embedded',
      hideHaHeader: Boolean(parsed.hideHaHeader),
      volumeStepPct: stepPct,
    };
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
  const [showSettings, setShowSettings] = useState<boolean>(
    () => initialViewParam === 'settings',
  );

  const [status, setStatus] = useState<HaConnectionStatus>('unconfigured');
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
  const [hasStoredToken, setHasStoredToken] = useState<boolean>(false);

  const [liveEntities, setLiveEntities] = useState<Record<string, HaEntity>>({});
  const [previewEntities, setPreviewEntities] =
    useState<Record<string, HaEntity>>(PREVIEW_ENTITIES);

  const [overviewMeta, setOverviewMeta] = useState<HaOverviewMetadata>({
    lovelaceConfig: null,
    dashboards: [{ id: 'default', url_path: null, title: 'Aperçu (par défaut)' }],
    areas: [],
    entityRegistry: {},
    deviceRegistry: {},
  });

  const [activeVolumeToast, setActiveVolumeToast] = useState<ActiveVolumeToast | null>(null);
  const [unreliableVolumeIds, setUnreliableVolumeIds] = useState<Set<string>>(() => new Set());

  const [autostart, setAutostart] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>('0.3.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    installing: false,
  });

  const [browserOffset, setBrowserOffset] = useState<{ x: number; y: number } | null>(null);
  const [browserSize, setBrowserSize] = useState<{ width: number; height: number }>({
    width: 420,
    height: 680,
  });
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);

  const wsClientRef = useRef<HomeAssistantWsClient | null>(null);
  const volumeBadgeTimerRef = useRef<number | null>(null);
  const zeroProbeTimerRef = useRef<number | null>(null);
  const throttleTimersRef = useRef<Map<string, number>>(new Map());
  const lastGlobalWheelAtRef = useRef<number>(0);
  const liveEntitiesRef = useRef<Record<string, HaEntity>>({});
  liveEntitiesRef.current = liveEntities;

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

  const cleanHaBaseUrl = useMemo(
    () => (settings.haUrl.trim() ? normalizeHaBaseUrl(settings.haUrl) : ''),
    [settings.haUrl],
  );

  const usingPreview = settings.previewMode && status !== 'connected' && !cleanHaBaseUrl;
  const entitiesMap = usingPreview ? previewEntities : liveEntities;
  const activeLovelaceConfig = usingPreview
    ? PREVIEW_LOVELACE_CONFIG
    : overviewMeta.lovelaceConfig;

  const embeddedLovelaceUrl = useMemo(() => {
    if (!cleanHaBaseUrl) return '';
    return settings.selectedDashboardPath
      ? `${cleanHaBaseUrl}/${settings.selectedDashboardPath}`
      : `${cleanHaBaseUrl}/`;
  }, [cleanHaBaseUrl, settings.selectedDashboardPath]);

  const showEmbeddedLovelace =
    nativeTauri &&
    Boolean(cleanHaBaseUrl) &&
    !usingPreview &&
    !showSettings &&
    settings.dashboardDisplayMode === 'embedded';

  // Synchronisation initiale des réglages natifs Tauri
  useEffect(() => {
    void getAppVersion().then(setAppVersion);
    void getAutostartEnabled().then(setAutostart);
  }, []);

  useEffect(() => {
    void setPcGraceSecondsNative(settings.pcMediaGraceSeconds);
  }, [settings.pcMediaGraceSeconds]);

  useEffect(() => {
    void setWidgetExpandedNative(expanded);
  }, [expanded]);

  useEffect(() => {
    // Focusable uniquement en mode déployé (saisie HA / Paramètres), sans prise de focus en pilule
    void setWindowFocusableNative(expanded);
  }, [expanded]);

  // Initialisation du client WebSocket Home Assistant + écoute temps réel des niveaux de volume
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
        const prevEntity = liveEntitiesRef.current[entity.entity_id];
        const prevVol =
          typeof prevEntity?.attributes.volume_level === 'number'
            ? prevEntity.attributes.volume_level
            : null;
        const nextVol =
          typeof entity.attributes.volume_level === 'number'
            ? entity.attributes.volume_level
            : null;

        setLiveEntities((prev) => ({
          ...prev,
          [entity.entity_id]: entity,
        }));

        if (nextVol !== null && nextVol > 0) {
          setUnreliableVolumeIds((prev) => {
            if (!prev.has(entity.entity_id)) return prev;
            const copy = new Set(prev);
            copy.delete(entity.entity_id);
            return copy;
          });
        }

        // Si un media_player vient de remonter un changement réel de volume_level suite à un pas +/-
        // (y compris via chaîne HDMI-CEC Télé -> Ampli), on verrouille immédiatement le badge sur cette vraie valeur !
        if (
          entity.entity_id.startsWith('media_player.') &&
          nextVol !== null &&
          (prevVol === null || Math.abs(nextVol - prevVol) > 0.0001)
        ) {
          setActiveVolumeToast((prevToast) => {
            if (!prevToast || prevToast.mode !== 'step') return prevToast;
            if (Date.now() - prevToast.triggeredAt > 1500) return prevToast;
            return {
              ...prevToast,
              entityId: entity.entity_id,
              targetLabel:
                entity.attributes.friendly_name || shortEntityLabel(entity, 2),
              observedChange: true,
            };
          });
        }
      },
      onOverviewMetadata: (meta) => {
        setOverviewMeta(meta);
      },
    });
    wsClientRef.current = client;

    void (async () => {
      const savedToken = await getSecureToken();
      const tokenPresent = Boolean(savedToken && savedToken.trim());
      setHasStoredToken(tokenPresent);
      if (settings.haUrl.trim() && savedToken) {
        client.connect(settings.haUrl, savedToken, settings.selectedDashboardPath);
      }
    })();

    return () => {
      client.disconnect();
      wsClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Extraction des vues, sections et tuiles (pour favoris pilule, routage audio et mode grille)
  const overviewEntityIds = useMemo(
    () => extractOverviewEntityIds(activeLovelaceConfig, entitiesMap),
    [activeLovelaceConfig, entitiesMap],
  );

  const views = useMemo(
    () => activeLovelaceConfig?.views || [],
    [activeLovelaceConfig],
  );

  const safeViewIndex = useMemo(() => {
    if (views.length === 0) return 0;
    if (views[settings.selectedViewIndex] && !views[settings.selectedViewIndex].subview) {
      return settings.selectedViewIndex;
    }
    const firstNonSub = views.findIndex((v) => !v.subview);
    return firstNonSub >= 0 ? firstNonSub : 0;
  }, [settings.selectedViewIndex, views]);

  const { badges: currentBadges, sections: currentSections } = useMemo(() => {
    if (activeLovelaceConfig && views[safeViewIndex]) {
      return normalizeLovelaceView(views[safeViewIndex], entitiesMap);
    }
    const autoSections = buildAutoAreasOverview(
      entitiesMap,
      overviewMeta.areas,
      overviewMeta.entityRegistry,
      overviewMeta.deviceRegistry,
    );
    return { badges: [], sections: autoSections };
  }, [
    activeLovelaceConfig,
    entitiesMap,
    overviewMeta.areas,
    overviewMeta.deviceRegistry,
    overviewMeta.entityRegistry,
    safeViewIndex,
    views,
  ]);

  // Initialisation automatique des 3 favoris de la mini-pilule
  useEffect(() => {
    if (status !== 'connected' || settings.pillFavorites.length > 0) return;
    const candidates: string[] = [];
    for (const id of overviewEntityIds) {
      const domain = id.split('.')[0];
      if (domain !== 'media_player' && isDomainToggleable(domain) && liveEntities[id]) {
        candidates.push(id);
        if (candidates.length >= 3) break;
      }
    }
    if (candidates.length > 0) {
      updateSettings({ pillFavorites: candidates });
    }
  }, [liveEntities, overviewEntityIds, settings.pillFavorites.length, status, updateSettings]);

  // Tous les lecteurs media_player et routage intelligent Télé / Ampli
  const allMediaPlayers = useMemo(
    () => Object.values(entitiesMap).filter((e) => e.entity_id.startsWith('media_player.')),
    [entitiesMap],
  );

  const volumeCapablePlayers = useMemo(
    () => allMediaPlayers.filter(canControlEntityVolume),
    [allMediaPlayers],
  );

  const resolvedVolumeTarget = useMemo(
    () =>
      resolveVolumeTarget(
        allMediaPlayers,
        overviewEntityIds,
        settings.volumeTargetMode,
      ),
    [allMediaPlayers, overviewEntityIds, settings.volumeTargetMode],
  );

  const resolvedPlaybackTarget = useMemo(
    () =>
      resolvePlaybackTarget(
        allMediaPlayers,
        overviewEntityIds,
        settings.activeMediaPlayerId,
      ),
    [allMediaPlayers, overviewEntityIds, settings.activeMediaPlayerId],
  );

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
    if (!resolvedPlaybackTarget) return null;
    return resolveHaMediaUrl(
      settings.haUrl,
      resolvedPlaybackTarget.attributes.entity_picture,
    );
  }, [resolvedPlaybackTarget, settings.haUrl]);

  // Calcul réactif 100 % fidèle du badge de volume à partir de la vraie valeur remontée par Home Assistant
  const volumeFeedback = useMemo<VolumeFeedbackBadge | null>(() => {
    if (!activeVolumeToast) return null;
    const liveEntity = entitiesMap[activeVolumeToast.entityId];
    const targetLabel =
      liveEntity?.attributes.friendly_name ||
      (liveEntity ? shortEntityLabel(liveEntity, 2) : activeVolumeToast.targetLabel);

    if (activeVolumeToast.mode === 'set') {
      const pct = activeVolumeToast.explicitPct ?? 0;
      return {
        targetLabel,
        valueLabel: `${pct}%`,
        pct,
      };
    }

    if (activeVolumeToast.mode === 'mute') {
      const isMuted = liveEntity
        ? Boolean(liveEntity.attributes.is_volume_muted)
        : Boolean(activeVolumeToast.muted);
      const livePct =
        typeof liveEntity?.attributes.volume_level === 'number' &&
        !unreliableVolumeIds.has(activeVolumeToast.entityId)
          ? Math.round(liveEntity.attributes.volume_level * 100)
          : null;
      return {
        targetLabel,
        valueLabel: isMuted ? 'Muet' : livePct !== null ? `${livePct}%` : 'Son actif',
        pct: isMuted ? 0 : livePct,
      };
    }

    // Mode 'step' (volume_up / volume_down) : aucun ajout synthétique (+/-4%), lecture directe de HA !
    const liveVol =
      typeof liveEntity?.attributes.volume_level === 'number'
        ? liveEntity.attributes.volume_level
        : null;

    const changedFromBaseline =
      liveVol !== null &&
      (activeVolumeToast.observedChange ||
        (activeVolumeToast.baselineLevel !== null &&
          Math.abs(liveVol - activeVolumeToast.baselineLevel) > 0.0001));

    const atCeiling =
      activeVolumeToast.direction === 'up' && liveVol !== null && liveVol >= 0.995;
    const atRealFloor =
      activeVolumeToast.direction === 'down' &&
      liveVol !== null &&
      liveVol <= 0.005 &&
      !unreliableVolumeIds.has(activeVolumeToast.entityId) &&
      activeVolumeToast.observedChange;

    if (liveVol !== null && (changedFromBaseline || atCeiling || atRealFloor)) {
      const exactPct = Math.round(liveVol * 100);
      return {
        targetLabel,
        valueLabel: `${exactPct}%`,
        pct: exactPct,
      };
    }

    return {
      targetLabel,
      valueLabel: activeVolumeToast.direction === 'up' ? 'Vol +' : 'Vol −',
      pct: null,
    };
  }, [activeVolumeToast, entitiesMap, unreliableVolumeIds]);

  const scheduleToastReset = useCallback(() => {
    if (volumeBadgeTimerRef.current !== null) {
      window.clearTimeout(volumeBadgeTimerRef.current);
    }
    volumeBadgeTimerRef.current = window.setTimeout(() => {
      setActiveVolumeToast(null);
      volumeBadgeTimerRef.current = null;
    }, 1450);
  }, []);

  const runThrottledService = useCallback(
    (key: string, delayMs: number, fn: () => Promise<void>) => {
      const existing = throttleTimersRef.current.get(key);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const timer = window.setTimeout(() => {
        throttleTimersRef.current.delete(key);
        void fn().catch(() => {});
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

  // --- Réglage matériel du Volume (compatible Ampli AVR, Sonos, TV HDMI-CEC/ARC/IR/WebOS/Samsung) ---
  const setVolumePctOnEntity = useCallback(
    (target: HaEntity, pct: number, showFeedback = false) => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      const label = target.attributes.friendly_name || shortEntityLabel(target, 2);

      if (showFeedback) {
        setActiveVolumeToast({
          entityId: target.entity_id,
          targetLabel: label,
          mode: 'set',
          baselineLevel:
            typeof target.attributes.volume_level === 'number'
              ? target.attributes.volume_level
              : null,
          observedChange: true,
          explicitPct: clamped,
          triggeredAt: Date.now(),
        });
        scheduleToastReset();
      }

      if (typeof target.attributes.volume_level === 'number') {
        applyEntityOptimistic(target.entity_id, (cur) => ({
          ...cur,
          attributes: {
            ...cur.attributes,
            volume_level: clamped / 100,
            is_volume_muted: clamped === 0,
          },
        }));
      }

      if (!usingPreview) {
        const targetId = target.entity_id;
        runThrottledService(`vol:${targetId}`, 75, async () => {
          await wsClientRef.current?.callService(
            'media_player',
            'volume_set',
            { volume_level: clamped / 100 },
            { entity_id: targetId },
          );
        });
      }
    },
    [applyEntityOptimistic, runThrottledService, scheduleToastReset, usingPreview],
  );

  const stepVolumeOnEntity = useCallback(
    (target: HaEntity | null, direction: 'up' | 'down', showFeedback = true) => {
      if (!target) return;
      const label = target.attributes.friendly_name || shortEntityLabel(target, 2);
      const rawLevel =
        typeof target.attributes.volume_level === 'number'
          ? target.attributes.volume_level
          : null;
      const canSet = supportsVolumeSet(target) && rawLevel !== null;
      const canStep = supportsVolumeStep(target);

      if (usingPreview) {
        const cur = rawLevel !== null ? Math.round(rawLevel * 100) : 40;
        const next = Math.max(
          0,
          Math.min(
            100,
            cur + (direction === 'up' ? settings.volumeStepPct : -settings.volumeStepPct),
          ),
        );
        setVolumePctOnEntity(target, next, showFeedback);
        return;
      }

      // Envoie volume_up / volume_down matériel sans aucune estimation artificielle de %
      if (canStep || !canSet) {
        if (showFeedback) {
          setActiveVolumeToast((prev) => {
            const continuingSameEntity =
              prev && prev.entityId === target.entity_id && prev.mode === 'step';
            return {
              entityId: target.entity_id,
              targetLabel: label,
              mode: 'step',
              direction,
              baselineLevel: continuingSameEntity ? prev.baselineLevel : rawLevel,
              observedChange: continuingSameEntity ? prev.observedChange : false,
              triggeredAt: Date.now(),
            };
          });
          scheduleToastReset();
        }

        // Détecte les TV en relais HDMI-ARC/CEC dont volume_level reste figé à 0 après un Vol +
        if (direction === 'up' && rawLevel === 0) {
          const checkedId = target.entity_id;
          if (zeroProbeTimerRef.current !== null) {
            window.clearTimeout(zeroProbeTimerRef.current);
          }
          zeroProbeTimerRef.current = window.setTimeout(() => {
            const latest = liveEntitiesRef.current[checkedId];
            if (latest && latest.attributes.volume_level === 0) {
              setUnreliableVolumeIds((prev) => {
                if (prev.has(checkedId)) return prev;
                const copy = new Set(prev);
                copy.add(checkedId);
                return copy;
              });
            }
          }, 750);
        }

        void wsClientRef.current
          ?.callService(
            'media_player',
            direction === 'up' ? 'volume_up' : 'volume_down',
            {},
            { entity_id: target.entity_id },
          )
          .catch(() => {});
        return;
      }

      // Enceintes supportant exclusivement volume_set (sans volume_up/volume_down)
      const currentPct = Math.round((rawLevel as number) * 100);
      const delta = direction === 'up' ? settings.volumeStepPct : -settings.volumeStepPct;
      setVolumePctOnEntity(target, currentPct + delta, showFeedback);
    },
    [
      scheduleToastReset,
      setVolumePctOnEntity,
      settings.volumeStepPct,
      usingPreview,
    ],
  );

  const toggleMuteOnEntity = useCallback(
    (target: HaEntity | null) => {
      if (!target) return;
      const nextMuted = !target.attributes.is_volume_muted;
      const label = target.attributes.friendly_name || shortEntityLabel(target, 2);

      setActiveVolumeToast({
        entityId: target.entity_id,
        targetLabel: label,
        mode: 'mute',
        baselineLevel:
          typeof target.attributes.volume_level === 'number'
            ? target.attributes.volume_level
            : null,
        observedChange: true,
        muted: nextMuted,
        triggeredAt: Date.now(),
      });
      scheduleToastReset();

      applyEntityOptimistic(target.entity_id, (cur) => ({
        ...cur,
        attributes: { ...cur.attributes, is_volume_muted: nextMuted },
      }));

      if (!usingPreview) {
        void wsClientRef.current
          ?.callService(
            'media_player',
            'volume_mute',
            { is_volume_muted: nextMuted },
            { entity_id: target.entity_id },
          )
          .catch(() => {});
      }
    },
    [applyEntityOptimistic, scheduleToastReset, usingPreview],
  );

  // Interception globale Ctrl + Molette dans l'application (bloque le zoom WebView2 et pilote l'Ampli/Télé)
  const volumeTargetRef = useRef<HaEntity | null>(null);
  volumeTargetRef.current = resolvedVolumeTarget;
  const stepVolumeRef = useRef(stepVolumeOnEntity);
  stepVolumeRef.current = stepVolumeOnEntity;

  useEffect(() => {
    const onGlobalWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastGlobalWheelAtRef.current < 55) return;
      lastGlobalWheelAtRef.current = now;
      stepVolumeRef.current(volumeTargetRef.current, e.deltaY < 0 ? 'up' : 'down', true);
    };
    window.addEventListener('wheel', onGlobalWheel, { capture: true, passive: false });
    return () => window.removeEventListener('wheel', onGlobalWheel, { capture: true });
  }, []);

  // --- Actions Média Transport ---
  const triggerPlayPause = useCallback(
    (player: HaEntity | null) => {
      if (!player) return;
      const nextState = player.state === 'playing' ? 'paused' : 'playing';
      applyEntityOptimistic(player.entity_id, (cur) => ({ ...cur, state: nextState }));
      if (!usingPreview) {
        void wsClientRef.current
          ?.callService('media_player', 'media_play_pause', {}, { entity_id: player.entity_id })
          .catch(() => {});
      }
    },
    [applyEntityOptimistic, usingPreview],
  );

  const triggerNext = useCallback(
    (player: HaEntity | null) => {
      if (!player) return;
      if (usingPreview) {
        applyEntityOptimistic(player.entity_id, (cur) => ({
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
        ?.callService('media_player', 'media_next_track', {}, { entity_id: player.entity_id })
        .catch(() => {});
    },
    [applyEntityOptimistic, usingPreview],
  );

  const triggerPrev = useCallback(
    (player: HaEntity | null) => {
      if (!player) return;
      if (usingPreview) {
        triggerNext(player);
        return;
      }
      void wsClientRef.current
        ?.callService(
          'media_player',
          'media_previous_track',
          {},
          { entity_id: player.entity_id },
        )
        .catch(() => {});
    },
    [triggerNext, usingPreview],
  );

  // --- Actions universelles sur les favoris pilule et tuiles rapides ---
  const handlePrimaryTileToggle = useCallback(
    (entity: HaEntity) => {
      const domain = entity.entity_id.split('.')[0];

      if (domain === 'light' || domain === 'switch' || domain === 'input_boolean' || domain === 'fan') {
        const nextOn = entity.state !== 'on';
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          state: nextOn ? 'on' : 'off',
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(domain, nextOn ? 'turn_on' : 'turn_off', {}, { entity_id: entity.entity_id })
            .catch(() => {});
        }
        return;
      }

      if (domain === 'scene' || domain === 'script') {
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(domain, 'turn_on', {}, { entity_id: entity.entity_id })
            .catch(() => {});
        }
        return;
      }

      if (domain === 'button' || domain === 'input_button') {
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(domain, 'press', {}, { entity_id: entity.entity_id })
            .catch(() => {});
        }
        return;
      }

      if (domain === 'cover') {
        const isClosed = entity.state === 'closed';
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          state: isClosed ? 'open' : 'closed',
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(
              'cover',
              isClosed ? 'open_cover' : 'close_cover',
              {},
              { entity_id: entity.entity_id },
            )
            .catch(() => {});
        }
        return;
      }

      if (domain === 'lock') {
        const isLocked = entity.state === 'locked';
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          state: isLocked ? 'unlocked' : 'locked',
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(
              'lock',
              isLocked ? 'unlock' : 'lock',
              {},
              { entity_id: entity.entity_id },
            )
            .catch(() => {});
        }
        return;
      }

      if (domain === 'media_player') {
        if (entity.state === 'off' || entity.state === 'standby') {
          applyEntityOptimistic(entity.entity_id, (cur) => ({ ...cur, state: 'on' }));
          if (!usingPreview) {
            void wsClientRef.current
              ?.callService('media_player', 'turn_on', {}, { entity_id: entity.entity_id })
              .catch(() => {});
          }
        } else {
          triggerPlayPause(entity);
        }
      }
    },
    [applyEntityOptimistic, triggerPlayPause, usingPreview],
  );

  const tileActions = useMemo<HaTileActions>(
    () => ({
      haBaseUrl: settings.haUrl,
      onPrimaryToggle: handlePrimaryTileToggle,
      onLightBrightness: (entityId, pct) => {
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
          runThrottledService(`bri:${entityId}`, 85, async () => {
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
      onLightColorTemp: (entityId, kelvin) => {
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
          runThrottledService(`kelvin:${entityId}`, 85, async () => {
            await wsClientRef.current?.callService(
              'light',
              'turn_on',
              { color_temp_kelvin: kelvin },
              { entity_id: entityId },
            );
          });
        }
      },
      onLightRgb: (entityId, rgb) => {
        applyEntityOptimistic(entityId, (cur) => ({
          ...cur,
          state: 'on',
          attributes: { ...cur.attributes, color_mode: 'rgb', rgb_color: rgb },
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService('light', 'turn_on', { rgb_color: rgb }, { entity_id: entityId })
            .catch(() => {});
        }
      },
      onMediaPlayPause: triggerPlayPause,
      onMediaPrev: triggerPrev,
      onMediaNext: triggerNext,
      onMediaPowerToggle: (entity) => {
        const turnOn = entity.state === 'off' || entity.state === 'standby';
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          state: turnOn ? 'on' : 'off',
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(
              'media_player',
              turnOn ? 'turn_on' : 'turn_off',
              {},
              { entity_id: entity.entity_id },
            )
            .catch(() => {});
        }
      },
      onMediaVolumeSet: (entity, pct) => setVolumePctOnEntity(entity, pct, false),
      onMediaVolumeStep: (entity, direction) => stepVolumeOnEntity(entity, direction, true),
      onMediaMuteToggle: (entity) => toggleMuteOnEntity(entity),
      onMediaSelectSource: (entity, source) => {
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          attributes: { ...cur.attributes, source },
        }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(
              'media_player',
              'select_source',
              { source },
              { entity_id: entity.entity_id },
            )
            .catch(() => {});
        }
      },
      onCoverCommand: (entityId, cmd) => {
        if (usingPreview) {
          applyEntityOptimistic(entityId, (cur) => ({
            ...cur,
            state: cmd === 'close_cover' ? 'closed' : 'open',
            attributes: {
              ...cur.attributes,
              current_position: cmd === 'close_cover' ? 0 : cmd === 'open_cover' ? 100 : 50,
            },
          }));
          return;
        }
        void wsClientRef.current
          ?.callService('cover', cmd, {}, { entity_id: entityId })
          .catch(() => {});
      },
      onCoverPosition: (entityId, position) => {
        applyEntityOptimistic(entityId, (cur) => ({
          ...cur,
          state: position === 0 ? 'closed' : 'open',
          attributes: { ...cur.attributes, current_position: position },
        }));
        if (!usingPreview) {
          runThrottledService(`cov:${entityId}`, 100, async () => {
            await wsClientRef.current?.callService(
              'cover',
              'set_cover_position',
              { position },
              { entity_id: entityId },
            );
          });
        }
      },
      onClimateTemp: (entityId, temp) => {
        applyEntityOptimistic(entityId, (cur) => ({
          ...cur,
          attributes: { ...cur.attributes, temperature: temp },
        }));
        if (!usingPreview) {
          runThrottledService(`clim:${entityId}`, 120, async () => {
            await wsClientRef.current?.callService(
              'climate',
              'set_temperature',
              { temperature: temp },
              { entity_id: entityId },
            );
          });
        }
      },
      onClimateMode: (entityId, hvacMode) => {
        applyEntityOptimistic(entityId, (cur) => ({ ...cur, state: hvacMode }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(
              'climate',
              'set_hvac_mode',
              { hvac_mode: hvacMode },
              { entity_id: entityId },
            )
            .catch(() => {});
        }
      },
      onSelectOption: (entity, option) => {
        const domain = entity.entity_id.split('.')[0];
        applyEntityOptimistic(entity.entity_id, (cur) => ({ ...cur, state: option }));
        if (!usingPreview) {
          void wsClientRef.current
            ?.callService(domain, 'select_option', { option }, { entity_id: entity.entity_id })
            .catch(() => {});
        }
      },
      onNumberValue: (entity, value) => {
        const domain = entity.entity_id.split('.')[0];
        applyEntityOptimistic(entity.entity_id, (cur) => ({
          ...cur,
          state: String(value),
        }));
        if (!usingPreview) {
          runThrottledService(`num:${entity.entity_id}`, 90, async () => {
            await wsClientRef.current?.callService(
              domain,
              'set_value',
              { value },
              { entity_id: entity.entity_id },
            );
          });
        }
      },
    }),
    [
      applyEntityOptimistic,
      handlePrimaryTileToggle,
      runThrottledService,
      setVolumePctOnEntity,
      settings.haUrl,
      stepVolumeOnEntity,
      toggleMuteOnEntity,
      triggerNext,
      triggerPlayPause,
      triggerPrev,
      usingPreview,
    ],
  );

  // Abonnement aux événements natifs Windows (touches média -> playbackTarget, Ctrl+Volume -> volumeTarget)
  const keyActionRef = useRef<(cmd: NativeKeyCommand) => void>(() => {});
  keyActionRef.current = (cmd: NativeKeyCommand) => {
    switch (cmd) {
      case 'play_pause':
        triggerPlayPause(resolvedPlaybackTarget);
        break;
      case 'next':
        triggerNext(resolvedPlaybackTarget);
        break;
      case 'previous':
        triggerPrev(resolvedPlaybackTarget);
        break;
      case 'volume_up':
        stepVolumeOnEntity(resolvedVolumeTarget, 'up', true);
        break;
      case 'volume_down':
        stepVolumeOnEntity(resolvedVolumeTarget, 'down', true);
        break;
      case 'volume_mute':
        toggleMuteOnEntity(resolvedVolumeTarget);
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
      setBrowserSize({ width: 420, height: 680 });
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
    updateSettings({
      haUrl: cleanUrl,
      previewMode: false,
      dashboardDisplayMode: 'embedded',
    });
    if (cleanUrl && activeToken) {
      wsClientRef.current?.connect(cleanUrl, activeToken, settings.selectedDashboardPath);
    }
  };

  const handleClearToken = async () => {
    await deleteSecureToken();
    await clearLovelaceSessionNative();
    setHasStoredToken(false);
    wsClientRef.current?.disconnect();
    setLiveEntities({});
    setStatus('unconfigured');
  };

  const handleSelectDashboard = (urlPath: string | null) => {
    updateSettings({ selectedDashboardPath: urlPath, selectedViewIndex: 0 });
    void wsClientRef.current?.setDashboardPath(urlPath);
  };

  const handleRefreshOverview = () => {
    void wsClientRef.current?.refreshOverview();
    void reloadLovelaceWebviewNative();
  };

  const handleToggleAutostart = async (next: boolean) => {
    const confirmed = await setAutostartEnabled(next);
    setAutostart(confirmed);
  };

  const handleResetPosition = () => {
    setBrowserOffset(null);
    setBrowserSize({ width: 420, height: 680 });
    void resetPillAboveClockNative();
  };

  const handleStartDrag = useCallback(
    (coords: DragStartCoords) => {
      if (nativeTauri) {
        void startNativeWindowDrag();
        return;
      }

      const startRight = browserOffset?.x ?? 16;
      const startBottom = browserOffset?.y ?? 52;
      dragStartRef.current = {
        pointerX: coords.clientX,
        pointerY: coords.clientY,
        startRight,
        startBottom,
      };

      const activeW = expanded ? browserSize.width : 316;
      const activeH = expanded ? browserSize.height : 52;

      const onMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return;
        const dx = ev.clientX - dragStartRef.current.pointerX;
        const dy = ev.clientY - dragStartRef.current.pointerY;
        const maxRight = Math.max(12, window.innerWidth - activeW - 12);
        const maxBottom = Math.max(12, window.innerHeight - activeH - 12);
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
    },
    [browserOffset, browserSize.height, browserSize.width, expanded, nativeTauri],
  );

  const handleResizePointerDown = useCallback(
    (direction: FlyoutResizeDirection, e: React.PointerEvent<HTMLDivElement>) => {
      if (nativeTauri) {
        void startNativeResizeDrag(direction);
        return;
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = browserSize.width;
      const startH = browserSize.height;
      const startRight = browserOffset?.x ?? 16;
      const startBottom = browserOffset?.y ?? 52;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let nextW = startW;
        let nextH = startH;
        let nextRight = startRight;
        let nextBottom = startBottom;

        if (direction.includes('West')) {
          nextW = Math.max(320, Math.min(window.innerWidth - 24, startW - dx));
        } else if (direction.includes('East')) {
          nextW = Math.max(320, Math.min(window.innerWidth - 24, startW + dx));
          nextRight = Math.max(8, startRight - (nextW - startW));
        }

        if (direction.includes('North')) {
          nextH = Math.max(360, Math.min(window.innerHeight - 64, startH - dy));
        } else if (direction.includes('South')) {
          nextH = Math.max(360, Math.min(window.innerHeight - 64, startH + dy));
          nextBottom = Math.max(8, startBottom - (nextH - startH));
        }

        setBrowserSize({ width: Math.round(nextW), height: Math.round(nextH) });
        setBrowserOffset({ x: Math.round(nextRight), y: Math.round(nextBottom) });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [browserOffset, browserSize.height, browserSize.width, nativeTauri],
  );

  const widgetContent = !expanded ? (
    <MiniPill
      status={status}
      previewMode={usingPreview}
      playbackPlayer={resolvedPlaybackTarget}
      volumeTarget={resolvedVolumeTarget}
      unreliableVolumeIds={unreliableVolumeIds}
      coverUrl={coverUrl}
      favoriteEntities={favoriteEntities}
      volumeFeedback={volumeFeedback}
      onExpand={() => setExpanded(true)}
      onPlayPause={() => triggerPlayPause(resolvedPlaybackTarget)}
      onNextTrack={() => triggerNext(resolvedPlaybackTarget)}
      onWheelVolume={(dir) => stepVolumeOnEntity(resolvedVolumeTarget, dir, true)}
      onTriggerFavorite={handlePrimaryTileToggle}
      onStartDrag={handleStartDrag}
    />
  ) : (
    <div
      style={
        nativeTauri
          ? undefined
          : {
              width: `${browserSize.width}px`,
              height: `${browserSize.height}px`,
            }
      }
      className={`flyout-surface animate-flyout relative flex flex-col overflow-hidden rounded-flyout text-fluent-ink ${
        nativeTauri
          ? 'h-full w-full'
          : 'max-h-[calc(100vh-68px)] max-w-[calc(100vw-24px)]'
      }`}
      role="dialog"
      aria-label="Panneau MyHomeAssistant"
    >
      {/* Bandeau supérieur entièrement déplaçable (glisser n'importe où dans l'en-tête) */}
      <header
        onPointerDownCapture={(e) => handleSmartSurfacePointerDown(e, handleStartDrag)}
        className="flex h-10 shrink-0 cursor-grab select-none items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          {showSettings && (
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Retour à l'Aperçu"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}

          <h1 className="truncate text-xs font-semibold text-fluent-ink">
            {showSettings
              ? 'Paramètres'
              : activeLovelaceConfig?.title || 'Aperçu'}
          </h1>

          {volumeFeedback ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-fluent-accent/15 px-2 py-0.5 text-[11px] font-semibold text-fluent-accent tabular-data">
              <Volume2 className="h-3 w-3" strokeWidth={2} />
              {volumeFeedback.targetLabel} • {volumeFeedback.valueLabel}
            </span>
          ) : usingPreview ? (
            <span className="rounded-pill bg-fluent-accent/15 px-2 py-0.5 text-[11px] font-semibold text-fluent-accent">
              Démo
            </span>
          ) : status === 'connected' ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-fluent-online/15 px-2 py-0.5 text-[11px] font-semibold text-fluent-online">
              <Wifi className="h-2.5 w-2.5" strokeWidth={2} />
              En ligne
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-fluent-danger/15 px-2 py-0.5 text-[11px] font-semibold text-fluent-danger">
              <WifiOff className="h-2.5 w-2.5" strokeWidth={2} />
              Hors ligne
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {nativeTauri && Boolean(cleanHaBaseUrl) && !usingPreview && !showSettings && (
            <>
              {settings.dashboardDisplayMode === 'embedded' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({ hideHaHeader: !settings.hideHaHeader })
                    }
                    aria-label={
                      settings.hideHaHeader
                        ? 'Afficher la barre Home Assistant'
                        : 'Masquer la barre Home Assistant'
                    }
                    title={settings.hideHaHeader ? 'Barre HA' : 'Mode épuré'}
                    className={`flex h-7 w-7 items-center justify-center rounded-control transition-colors ${
                      settings.hideHaHeader
                        ? 'bg-fluent-accent/20 text-fluent-accent'
                        : 'text-fluent-secondary hover:bg-fluent-elevated hover:text-fluent-ink'
                    }`}
                  >
                    {settings.hideHaHeader ? (
                      <PanelTop className="h-3.5 w-3.5" strokeWidth={1.75} />
                    ) : (
                      <PanelTopClose className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void reloadLovelaceWebviewNative()}
                    aria-label="Actualiser la page Home Assistant"
                    title="Actualiser"
                    className="flex h-7 w-7 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    dashboardDisplayMode:
                      settings.dashboardDisplayMode === 'embedded' ? 'tiles' : 'embedded',
                  })
                }
                aria-label={
                  settings.dashboardDisplayMode === 'embedded'
                    ? 'Basculer en grille rapide'
                    : 'Basculer sur la page Lovelace Home Assistant'
                }
                title={
                  settings.dashboardDisplayMode === 'embedded'
                    ? 'Grille rapide'
                    : 'Lovelace HA'
                }
                className="flex h-7 w-7 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
              >
                {settings.dashboardDisplayMode === 'embedded' ? (
                  <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <AppWindow className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setShowSettings(false);
              setExpanded(false);
            }}
            aria-label="Replier en pilule"
            title="Replier"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* Corps principal : Page Lovelace Home Assistant intégrée, Grille rapide ou Paramètres */}
      {showSettings ? (
        <SettingsView
          settings={settings}
          status={status}
          errorDetail={errorDetail}
          hasStoredToken={hasStoredToken}
          allEntities={usingPreview ? PREVIEW_ENTITIES : liveEntities}
          overviewEntityIds={overviewEntityIds}
          dashboards={overviewMeta.dashboards}
          autostart={autostart}
          appVersion={appVersion}
          updateStatus={updateStatus}
          onSaveConnection={handleSaveConnection}
          onClearToken={handleClearToken}
          onSelectDashboard={handleSelectDashboard}
          onRefreshOverview={handleRefreshOverview}
          onUpdateSettings={updateSettings}
          onToggleAutostart={(next) => void handleToggleAutostart(next)}
          onResetPosition={handleResetPosition}
          onCheckUpdate={(installNow) =>
            void checkAndOptionallyInstallUpdate(installNow, setUpdateStatus)
          }
        />
      ) : !cleanHaBaseUrl && !usingPreview ? (
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
              Démo
            </button>
          </div>
        </div>
      ) : showEmbeddedLovelace ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <VolumeOutputBar
            volumePlayers={volumeCapablePlayers}
            volumeTargetMode={settings.volumeTargetMode}
            resolvedVolumeTarget={resolvedVolumeTarget}
            unreliableVolumeIds={unreliableVolumeIds}
            onChangeVolumeTargetMode={(mode) => updateSettings({ volumeTargetMode: mode })}
            onVolumeSet={tileActions.onMediaVolumeSet}
            onVolumeStep={tileActions.onMediaVolumeStep}
            onMuteToggle={tileActions.onMediaMuteToggle}
          />
          <EmbeddedLovelaceHost
            url={embeddedLovelaceUrl}
            active={showEmbeddedLovelace}
            hideHaHeader={settings.hideHaHeader}
          />
        </div>
      ) : (
        <LovelaceDashboardView
          views={views}
          selectedViewIndex={safeViewIndex}
          onSelectViewIndex={(idx) => updateSettings({ selectedViewIndex: idx })}
          badges={currentBadges}
          sections={currentSections}
          entities={entitiesMap}
          volumePlayers={volumeCapablePlayers}
          volumeTargetMode={settings.volumeTargetMode}
          resolvedVolumeTarget={resolvedVolumeTarget}
          unreliableVolumeIds={unreliableVolumeIds}
          onChangeVolumeTargetMode={(mode) => updateSettings({ volumeTargetMode: mode })}
          actions={tileActions}
        />
      )}

      {/* Pied de Flyout style Windows 11 Quick Settings */}
      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-white/[0.06] bg-fluent-base/80 pl-3.5 pr-4">
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
              className="inline-flex items-center gap-1 rounded-pill bg-fluent-accent px-2 py-0.5 text-[11px] font-semibold text-fluent-accentInk"
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

      {/* Poignées de redimensionnement 8 directions sur les bords et coins du Flyout */}
      <FlyoutResizeHandles onResizePointerDown={handleResizePointerDown} />
    </div>
  );

  if (nativeTauri) {
    return <main className="h-full w-full bg-transparent">{widgetContent}</main>;
  }

  return (
    <main
      style={{
        backgroundImage:
          'radial-gradient(540px circle at calc(100% - 170px) calc(100% - 280px), rgba(96, 165, 250, 0.22), transparent 72%)',
      }}
      className="relative min-h-screen w-full overflow-hidden bg-fluent-stage"
    >
      <nav
        aria-label="Modes d'affichage"
        className="fixed left-3 top-3 z-10 flex flex-wrap items-center gap-1.5 rounded-pill border border-white/[0.08] bg-fluent-base/90 p-1"
      >
        <button
          type="button"
          onClick={() => {
            setShowSettings(false);
            setExpanded(false);
          }}
          className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
            !expanded
              ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
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
              ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
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
              ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
              : 'text-fluent-secondary hover:text-fluent-ink'
          }`}
        >
          Paramètres
        </button>
      </nav>

      <div
        style={{
          right: `${browserOffset?.x ?? 16}px`,
          bottom: `${browserOffset?.y ?? 52}px`,
        }}
        className="fixed z-20 max-w-[calc(100vw-24px)]"
      >
        {widgetContent}
      </div>

      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-10 flex h-10 items-center justify-end border-t border-white/[0.06] bg-fluent-stage/95 px-4 text-xs text-fluent-secondary tabular-data"
      >
        <span>FRA &nbsp; 19:42</span>
      </div>
    </main>
  );
};
