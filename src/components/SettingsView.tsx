import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  AppSettings,
  HaConnectionStatus,
  HaEntity,
  LovelaceDashboardInfo,
  UpdateStatus,
} from '../types/ha';
import { isDomainToggleable, renderHaEntityIcon } from '../utils/haIcons';
import { canControlEntityVolume } from '../utils/mediaRouting';

interface SettingsViewProps {
  settings: AppSettings;
  status: HaConnectionStatus;
  errorDetail?: string;
  hasStoredToken: boolean;
  allEntities: Record<string, HaEntity>;
  overviewEntityIds: string[];
  dashboards: LovelaceDashboardInfo[];
  autostart: boolean;
  appVersion: string;
  updateStatus: UpdateStatus;
  onSaveConnection: (url: string, newToken: string) => Promise<void>;
  onClearToken: () => Promise<void>;
  onSelectDashboard: (urlPath: string | null) => void;
  onRefreshOverview: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleAutostart: (next: boolean) => void;
  onResetPosition: () => void;
  onCheckUpdate: (installNow: boolean) => void;
}

type SettingsTab = 'server' | 'favorites' | 'system';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  status,
  errorDetail,
  hasStoredToken,
  allEntities,
  overviewEntityIds,
  dashboards,
  autostart,
  appVersion,
  updateStatus,
  onSaveConnection,
  onClearToken,
  onSelectDashboard,
  onRefreshOverview,
  onUpdateSettings,
  onToggleAutostart,
  onResetPosition,
  onCheckUpdate,
}) => {
  const [tab, setTab] = useState<SettingsTab>('server');
  const [urlInput, setUrlInput] = useState(settings.haUrl);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConnection(urlInput, tokenInput);
      setTokenInput('');
    } finally {
      setSaving(false);
    }
  };

  const volumePlayers = useMemo(() => {
    return Object.values(allEntities)
      .filter((e) => e.entity_id.startsWith('media_player.') && canControlEntityVolume(e))
      .sort((a, b) =>
        (a.attributes.friendly_name || a.entity_id).localeCompare(
          b.attributes.friendly_name || b.entity_id,
        ),
      );
  }, [allEntities]);

  const pinnableEntities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const overviewOrder = new Map<string, number>();
    overviewEntityIds.forEach((id, idx) => overviewOrder.set(id, idx));

    return Object.values(allEntities)
      .filter((entity) => {
        const domain = entity.entity_id.split('.')[0];
        if (domain === 'media_player' || !isDomainToggleable(domain)) return false;
        if (!q) return true;
        const name = (entity.attributes.friendly_name || '').toLowerCase();
        return name.includes(q) || entity.entity_id.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aPinned = settings.pillFavorites.includes(a.entity_id) ? 0 : 1;
        const bPinned = settings.pillFavorites.includes(b.entity_id) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;

        const aIdx = overviewOrder.get(a.entity_id) ?? 99999;
        const bIdx = overviewOrder.get(b.entity_id) ?? 99999;
        if (aIdx !== bIdx) return aIdx - bIdx;

        return (a.attributes.friendly_name || a.entity_id).localeCompare(
          b.attributes.friendly_name || b.entity_id,
        );
      });
  }, [allEntities, overviewEntityIds, query, settings.pillFavorites]);

  const toggleFavorite = (entityId: string) => {
    if (settings.pillFavorites.includes(entityId)) {
      onUpdateSettings({
        pillFavorites: settings.pillFavorites.filter((id) => id !== entityId),
      });
      return;
    }
    const next = [...settings.pillFavorites.slice(-2), entityId];
    onUpdateSettings({ pillFavorites: next });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-4 py-2">
        {(
          [
            { id: 'server', label: 'Serveur' },
            { id: 'favorites', label: 'Pilule & Audio' },
            { id: 'system', label: 'Système' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-control py-1.5 text-xs font-medium transition-colors duration-100 ${
              tab === item.id
                ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
                : 'text-fluent-secondary hover:bg-fluent-elevated hover:text-fluent-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="fluent-scroll flex-1 overflow-y-auto px-4 py-3">
        {tab === 'server' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="ha-url-input"
                className="mb-1.5 block text-xs font-medium text-fluent-ink"
              >
                URL Home Assistant
              </label>
              <input
                id="ha-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://homeassistant.local:8123"
                className="w-full rounded-control border border-white/[0.08] bg-fluent-elevated px-3 py-2 text-xs text-fluent-ink placeholder:text-fluent-muted focus:border-fluent-accent focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="ha-token-input" className="text-xs font-medium text-fluent-ink">
                  Jeton d'accès
                </label>
                {hasStoredToken && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fluent-online">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Coffre Windows
                  </span>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  id="ha-token-input"
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    hasStoredToken ? '••••••••••••••••••••' : 'Coller le jeton longue durée'
                  }
                  className="w-full rounded-control border border-white/[0.08] bg-fluent-elevated py-2 pl-3 pr-9 text-xs text-fluent-ink placeholder:text-fluent-muted focus:border-fluent-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? 'Masquer le jeton' : 'Afficher le jeton'}
                  className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-fluent-secondary hover:text-fluent-ink"
                >
                  {showToken ? (
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {errorDetail && (
              <div className="rounded-control bg-fluent-danger/15 px-3 py-1.5 text-xs font-medium text-fluent-danger">
                {errorDetail}
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="submit"
                disabled={saving || !urlInput.trim() || (!tokenInput.trim() && !hasStoredToken)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-fluent-accent py-2 text-xs font-semibold text-fluent-accentInk transition-colors duration-150 hover:bg-[#7bb6fc] disabled:bg-[#282d37] disabled:text-fluent-muted"
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                {status === 'connected' ? 'Reconnecter' : 'Connecter'}
              </button>

              {hasStoredToken && (
                <button
                  type="button"
                  onClick={() => void onClearToken()}
                  aria-label="Supprimer le jeton enregistré"
                  title="Oublier le jeton"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-fluent-elevated text-fluent-danger transition-colors hover:bg-fluent-hover"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {status === 'connected' && (
              <div className="mt-1 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fluent-ink">Tableau de bord</span>
                  <button
                    type="button"
                    onClick={onRefreshOverview}
                    className="inline-flex items-center gap-1 rounded-control bg-fluent-elevated px-2 py-1 text-[11px] font-medium text-fluent-secondary transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
                  >
                    <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
                    Synchroniser
                  </button>
                </div>

                <div className="relative">
                  <select
                    aria-label="Tableau de bord Home Assistant"
                    value={settings.selectedDashboardPath ?? '__default__'}
                    onChange={(e) =>
                      onSelectDashboard(
                        e.target.value === '__default__' ? null : e.target.value,
                      )
                    }
                    className="w-full appearance-none rounded-control border border-white/[0.08] bg-fluent-elevated py-1.5 pl-3 pr-7 text-xs text-fluent-ink focus:outline-none"
                  >
                    {dashboards.map((d) => (
                      <option
                        key={d.url_path ?? '__default__'}
                        value={d.url_path ?? '__default__'}
                        className="bg-fluent-base"
                      >
                        {d.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-fluent-secondary"
                    strokeWidth={1.75}
                  />
                </div>
              </div>
            )}

            <div className="mt-1 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-xs font-medium text-fluent-ink">Mode démo hors-ligne</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.previewMode}
                onClick={() => onUpdateSettings({ previewMode: !settings.previewMode })}
                className={`relative h-5 w-9 rounded-full border transition-colors duration-150 ${
                  settings.previewMode
                    ? 'border-transparent bg-fluent-accent'
                    : 'border-white/15 bg-fluent-elevated'
                }`}
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
                    settings.previewMode
                      ? 'translate-x-[17px] bg-fluent-accentInk'
                      : 'translate-x-[3px] bg-fluent-secondary'
                  }`}
                />
              </button>
            </div>
          </form>
        )}

        {tab === 'favorites' && (
          <div className="flex flex-col gap-3">
            {/* Sélection de la sortie Volume (Auto Ampli/Télé ou appareil fixe) */}
            <div className="flex flex-col gap-1.5 border-b border-white/[0.06] pb-3">
              <label
                htmlFor="vol-target-select"
                className="text-xs font-medium text-fluent-ink"
              >
                Sortie volume (Ctrl + Volume / Molette)
              </label>
              <div className="relative">
                <select
                  id="vol-target-select"
                  value={settings.volumeTargetMode}
                  onChange={(e) => onUpdateSettings({ volumeTargetMode: e.target.value })}
                  className="w-full appearance-none rounded-control border border-white/[0.08] bg-fluent-elevated py-1.5 pl-3 pr-7 text-xs text-fluent-ink focus:outline-none"
                >
                  <option value="auto" className="bg-fluent-base">
                    Auto (Ampli actif → Télé active)
                  </option>
                  {volumePlayers.map((mp) => (
                    <option key={mp.entity_id} value={mp.entity_id} className="bg-fluent-base">
                      {mp.attributes.friendly_name || mp.entity_id}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-fluent-secondary"
                  strokeWidth={1.75}
                />
              </div>
            </div>

            {/* Sélection des 3 favoris de la Mini-Pilule */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fluent-ink">Favoris pilule (max 3)</span>
              <span className="text-[11px] text-fluent-secondary tabular-data">
                {settings.pillFavorites.length}/3
              </span>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-fluent-muted"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer une tuile..."
                className="w-full rounded-control border border-white/[0.06] bg-fluent-elevated py-1.5 pl-8 pr-2.5 text-xs text-fluent-ink placeholder:text-fluent-muted focus:border-fluent-accent focus:outline-none"
              />
            </div>

            {pinnableEntities.length === 0 ? (
              <div className="py-6 text-center text-xs text-fluent-secondary">
                Aucune entité disponible
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {pinnableEntities.slice(0, 40).map((entity) => {
                  const pinned = settings.pillFavorites.includes(entity.entity_id);
                  return (
                    <button
                      key={entity.entity_id}
                      type="button"
                      onClick={() => toggleFavorite(entity.entity_id)}
                      className="flex items-center justify-between gap-2 rounded-control bg-fluent-elevated px-2.5 py-1.5 text-left transition-colors hover:bg-fluent-hover"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="text-fluent-secondary">
                          {renderHaEntityIcon(entity, undefined, 'h-3.5 w-3.5')}
                        </span>
                        <span className="truncate text-xs text-fluent-ink">
                          {entity.attributes.friendly_name || entity.entity_id}
                        </span>
                      </span>

                      <Star
                        className={`h-3.5 w-3.5 shrink-0 ${
                          pinned ? 'fill-current text-fluent-warm' : 'text-fluent-muted'
                        }`}
                        strokeWidth={1.75}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'system' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fluent-ink">Démarrage Windows</span>
              <button
                type="button"
                role="switch"
                aria-checked={autostart}
                onClick={() => onToggleAutostart(!autostart)}
                className={`relative h-5 w-9 rounded-full border transition-colors duration-150 ${
                  autostart
                    ? 'border-transparent bg-fluent-accent'
                    : 'border-white/15 bg-fluent-elevated'
                }`}
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
                    autostart
                      ? 'translate-x-[17px] bg-fluent-accentInk'
                      : 'translate-x-[3px] bg-fluent-secondary'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fluent-ink">Priorité média PC</span>
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Délai priorité média PC"
                  value={settings.pcMediaGraceSeconds}
                  onChange={(e) =>
                    onUpdateSettings({ pcMediaGraceSeconds: Number(e.target.value) })
                  }
                  className="appearance-none rounded-control border border-white/[0.08] bg-fluent-elevated py-1 pl-2.5 pr-7 text-xs text-fluent-ink transition-colors hover:bg-fluent-hover focus:outline-none"
                >
                  <option value={45} className="bg-fluent-base">
                    Intelligente (45s)
                  </option>
                  <option value={15} className="bg-fluent-base">
                    Courte (15s)
                  </option>
                  <option value={0} className="bg-fluent-base">
                    Immédiate (0s)
                  </option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-fluent-secondary"
                  strokeWidth={1.75}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fluent-ink">Pas curseur (%)</span>
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Pas de réglage du volume"
                  value={settings.volumeStepPct}
                  onChange={(e) => onUpdateSettings({ volumeStepPct: Number(e.target.value) })}
                  className="appearance-none rounded-control border border-white/[0.08] bg-fluent-elevated py-1 pl-2.5 pr-7 text-xs text-fluent-ink tabular-data transition-colors hover:bg-fluent-hover focus:outline-none"
                >
                  <option value={1} className="bg-fluent-base">
                    1%
                  </option>
                  <option value={2} className="bg-fluent-base">
                    2%
                  </option>
                  <option value={5} className="bg-fluent-base">
                    5%
                  </option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-fluent-secondary"
                  strokeWidth={1.75}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
              <span className="text-xs font-medium text-fluent-ink">Position & taille</span>
              <button
                type="button"
                onClick={onResetPosition}
                className="inline-flex items-center gap-1.5 rounded-control bg-fluent-elevated px-2.5 py-1.5 text-xs font-medium text-fluent-ink transition-colors hover:bg-fluent-hover"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Réinitialiser
              </button>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-fluent-ink">Mises à jour auto</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.autoCheckUpdates}
                  onClick={() =>
                    onUpdateSettings({ autoCheckUpdates: !settings.autoCheckUpdates })
                  }
                  className={`relative h-5 w-9 rounded-full border transition-colors duration-150 ${
                    settings.autoCheckUpdates
                      ? 'border-transparent bg-fluent-accent'
                      : 'border-white/15 bg-fluent-elevated'
                  }`}
                >
                  <span
                    className={`block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
                      settings.autoCheckUpdates
                        ? 'translate-x-[17px] bg-fluent-accentInk'
                        : 'translate-x-[3px] bg-fluent-secondary'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-fluent-secondary tabular-data">
                  Version v{appVersion}
                </span>

                <button
                  type="button"
                  disabled={updateStatus.checking || updateStatus.installing}
                  onClick={() => onCheckUpdate(updateStatus.available)}
                  className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    updateStatus.available
                      ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
                      : 'bg-fluent-elevated text-fluent-ink hover:bg-fluent-hover'
                  } disabled:opacity-45`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      updateStatus.checking || updateStatus.installing ? 'animate-spin' : ''
                    }`}
                    strokeWidth={1.75}
                  />
                  {updateStatus.installing
                    ? 'Installation...'
                    : updateStatus.available
                      ? `Installer v${updateStatus.version}`
                      : updateStatus.checking
                        ? 'Recherche...'
                        : 'Vérifier MAJ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
