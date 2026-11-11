import React, { useMemo, useState } from 'react';
import {
  Check,
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
import type { AppSettings, HaConnectionStatus, HaEntity, UpdateStatus } from '../types/ha';

interface SettingsViewProps {
  settings: AppSettings;
  status: HaConnectionStatus;
  errorDetail?: string;
  hasStoredToken: boolean;
  allEntities: Record<string, HaEntity>;
  autostart: boolean;
  appVersion: string;
  updateStatus: UpdateStatus;
  onSaveConnection: (url: string, newToken: string) => Promise<void>;
  onClearToken: () => Promise<void>;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleAutostart: (next: boolean) => void;
  onResetPosition: () => void;
  onCheckUpdate: (installNow: boolean) => void;
}

type SettingsTab = 'server' | 'entities' | 'system';
type EntityFilterDomain = 'media_player' | 'light' | 'scene';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  status,
  errorDetail,
  hasStoredToken,
  allEntities,
  autostart,
  appVersion,
  updateStatus,
  onSaveConnection,
  onClearToken,
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
  const [domainTab, setDomainTab] = useState<EntityFilterDomain>('light');
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

  const domainEntities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(allEntities)
      .filter((entity) => {
        const domain = entity.entity_id.split('.')[0];
        if (domainTab === 'scene') {
          if (domain !== 'scene' && domain !== 'script') return false;
        } else if (domain !== domainTab) {
          return false;
        }
        if (!q) return true;
        const name = (entity.attributes.friendly_name || '').toLowerCase();
        return name.includes(q) || entity.entity_id.toLowerCase().includes(q);
      })
      .sort((a, b) =>
        (a.attributes.friendly_name || a.entity_id).localeCompare(
          b.attributes.friendly_name || b.entity_id,
        ),
      );
  }, [allEntities, domainTab, query]);

  const isEntitySelected = (entityId: string): boolean => {
    const domain = entityId.split('.')[0];
    if (domain === 'media_player') return settings.enabledMediaPlayers.includes(entityId);
    if (domain === 'light') return settings.enabledLights.includes(entityId);
    return settings.enabledScenes.includes(entityId);
  };

  const toggleEntitySelection = (entityId: string) => {
    const domain = entityId.split('.')[0];
    if (domain === 'media_player') {
      const next = settings.enabledMediaPlayers.includes(entityId)
        ? settings.enabledMediaPlayers.filter((id) => id !== entityId)
        : [...settings.enabledMediaPlayers, entityId];
      onUpdateSettings({ enabledMediaPlayers: next });
    } else if (domain === 'light') {
      const next = settings.enabledLights.includes(entityId)
        ? settings.enabledLights.filter((id) => id !== entityId)
        : [...settings.enabledLights, entityId];
      onUpdateSettings({ enabledLights: next });
    } else {
      const next = settings.enabledScenes.includes(entityId)
        ? settings.enabledScenes.filter((id) => id !== entityId)
        : [...settings.enabledScenes, entityId];
      onUpdateSettings({ enabledScenes: next });
    }
  };

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
      {/* Navigation onglets instantanée (< 120 ms) */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-4 py-2">
        {(
          [
            { id: 'server', label: 'Serveur' },
            { id: 'entities', label: 'Entités' },
            { id: 'system', label: 'Système' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-control py-1.5 text-xs font-medium transition-colors duration-100 ${
              tab === item.id
                ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
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
                className="w-full rounded-control bg-fluent-elevated px-3 py-2 text-xs text-fluent-ink placeholder:text-fluent-muted border border-white/[0.08] focus:border-fluent-accent focus:outline-none"
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
                  className="w-full rounded-control bg-fluent-elevated py-2 pl-3 pr-9 text-xs text-fluent-ink placeholder:text-fluent-muted border border-white/[0.08] focus:border-fluent-accent focus:outline-none"
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-fluent-accent py-2 text-xs font-semibold text-fluent-accentInk transition-colors duration-150 hover:bg-[#7bb6fc] disabled:bg-[#2a303c] disabled:text-fluent-muted"
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                {status === 'connected' ? 'Actualiser' : 'Connecter'}
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

            <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-xs font-medium text-fluent-ink">Mode aperçu</span>
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

        {tab === 'entities' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'light', label: 'Lumières' },
                  { id: 'scene', label: 'Scènes' },
                  { id: 'media_player', label: 'Lecteurs' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDomainTab(d.id)}
                  className={`flex-1 rounded-control py-1 text-[11px] font-medium transition-colors ${
                    domainTab === d.id
                      ? 'bg-fluent-elevated text-fluent-ink border border-white/10'
                      : 'text-fluent-secondary hover:text-fluent-ink'
                  }`}
                >
                  {d.label}
                </button>
              ))}
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
                placeholder="Filtrer..."
                className="w-full rounded-control bg-fluent-elevated py-1.5 pl-8 pr-2.5 text-xs text-fluent-ink placeholder:text-fluent-muted border border-white/[0.06] focus:border-fluent-accent focus:outline-none"
              />
            </div>

            {domainEntities.length === 0 ? (
              <div className="py-6 text-center text-xs text-fluent-secondary">
                Aucune entité disponible
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {domainEntities.map((entity) => {
                  const selected = isEntitySelected(entity.entity_id);
                  const pinned = settings.pillFavorites.includes(entity.entity_id);
                  const canPin = !entity.entity_id.startsWith('media_player.');

                  return (
                    <div
                      key={entity.entity_id}
                      className="flex items-center justify-between gap-2 rounded-control bg-fluent-elevated px-2.5 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleEntitySelection(entity.entity_id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? 'border-fluent-accent bg-fluent-accent text-fluent-accentInk'
                              : 'border-white/25 bg-transparent'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                        </span>
                        <span className="truncate text-xs text-fluent-ink">
                          {entity.attributes.friendly_name || entity.entity_id}
                        </span>
                      </button>

                      {canPin && (
                        <button
                          type="button"
                          onClick={() => toggleFavorite(entity.entity_id)}
                          aria-label="Épingler sur la pilule"
                          title="Favori pilule (max 3)"
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors ${
                            pinned
                              ? 'text-fluent-warm'
                              : 'text-fluent-muted hover:text-fluent-secondary'
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`}
                            strokeWidth={1.75}
                          />
                        </button>
                      )}
                    </div>
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
                  className="appearance-none rounded-control bg-fluent-elevated py-1 pl-2.5 pr-7 text-xs text-fluent-ink border border-white/[0.08] transition-colors hover:bg-fluent-hover focus:outline-none"
                >
                  <option value={45} className="bg-[#1c1e24]">
                    Intelligente (45s)
                  </option>
                  <option value={15} className="bg-[#1c1e24]">
                    Courte (15s)
                  </option>
                  <option value={0} className="bg-[#1c1e24]">
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
              <span className="text-xs font-medium text-fluent-ink">Pas Ctrl + Volume</span>
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Pas de réglage du volume"
                  value={settings.volumeStepPct}
                  onChange={(e) => onUpdateSettings({ volumeStepPct: Number(e.target.value) })}
                  className="appearance-none rounded-control bg-fluent-elevated py-1 pl-2.5 pr-7 text-xs text-fluent-ink border border-white/[0.08] tabular-data transition-colors hover:bg-fluent-hover focus:outline-none"
                >
                  <option value={2} className="bg-[#1c1e24]">
                    2%
                  </option>
                  <option value={4} className="bg-[#1c1e24]">
                    4%
                  </option>
                  <option value={8} className="bg-[#1c1e24]">
                    8%
                  </option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-fluent-secondary"
                  strokeWidth={1.75}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
              <span className="text-xs font-medium text-fluent-ink">Position pilule</span>
              <button
                type="button"
                onClick={onResetPosition}
                className="inline-flex items-center gap-1.5 rounded-control bg-fluent-elevated px-2.5 py-1.5 text-xs font-medium text-fluent-ink transition-colors hover:bg-fluent-hover"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Au-dessus horloge
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
                      ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
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
