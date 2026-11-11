import React from 'react';
import { ChevronDown, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import type { HaEntity, LovelaceViewConfig } from '../types/ha';
import { shortEntityLabel } from '../utils/color';
import { formatHaStateShort, renderHaEntityIcon } from '../utils/haIcons';
import type {
  NormalizedOverviewSection,
  NormalizedTileBadge,
} from '../utils/lovelaceLayout';
import { canControlEntityVolume, supportsVolumeMute } from '../utils/mediaRouting';
import { HaTileCard, type HaTileActions } from './HaTileCard';

interface LovelaceDashboardViewProps {
  views: LovelaceViewConfig[];
  selectedViewIndex: number;
  onSelectViewIndex: (index: number) => void;
  badges: NormalizedTileBadge[];
  sections: NormalizedOverviewSection[];
  entities: Record<string, HaEntity>;
  volumePlayers: HaEntity[];
  volumeTargetMode: string;
  resolvedVolumeTarget: HaEntity | null;
  onChangeVolumeTargetMode: (mode: string) => void;
  actions: HaTileActions;
}

export const LovelaceDashboardView: React.FC<LovelaceDashboardViewProps> = ({
  views,
  selectedViewIndex,
  onSelectViewIndex,
  badges,
  sections,
  entities,
  volumePlayers,
  volumeTargetMode,
  resolvedVolumeTarget,
  onChangeVolumeTargetMode,
  actions,
}) => {
  const visibleViews = views
    .map((v, idx) => ({ view: v, originalIndex: idx }))
    .filter((entry) => !entry.view.subview);

  const volTarget = resolvedVolumeTarget;
  const volTargetName = volTarget
    ? volTarget.attributes.friendly_name || shortEntityLabel(volTarget, 2)
    : '';
  const hasNumericVol = typeof volTarget?.attributes.volume_level === 'number';
  const currentVolPct = hasNumericVol
    ? Math.round((volTarget!.attributes.volume_level as number) * 100)
    : 0;
  const isMuted = Boolean(volTarget?.attributes.is_volume_muted);

  return (
    <div className="fluent-scroll flex flex-1 flex-col overflow-y-auto">
      {/* Barre rapide Sortie Audio & Volume (bascule intelligente Télé / Ampli) */}
      {volTarget && canControlEntityVolume(volTarget) && (
        <section
          aria-label="Sortie volume active"
          onWheel={(e) => {
            e.preventDefault();
            actions.onMediaVolumeStep(volTarget, e.deltaY < 0 ? 'up' : 'down');
          }}
          className="border-b border-white/[0.06] bg-fluent-base/60 px-3.5 py-2.5"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-fluent-secondary">
              Sortie volume
            </span>

            <div className="relative min-w-0 max-w-[215px]">
              <select
                aria-label="Cible du volume Home Assistant"
                value={volumeTargetMode}
                onChange={(e) => onChangeVolumeTargetMode(e.target.value)}
                className="w-full appearance-none truncate rounded-control border border-white/[0.08] bg-fluent-elevated py-1 pl-2.5 pr-6 text-[11px] font-medium text-fluent-ink transition-colors hover:bg-fluent-hover focus:outline-none"
              >
                <option value="auto" className="bg-fluent-base">
                  Auto ({volTargetName})
                </option>
                {volumePlayers.map((mp) => (
                  <option key={mp.entity_id} value={mp.entity_id} className="bg-fluent-base">
                    {mp.attributes.friendly_name || mp.entity_id}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-fluent-secondary"
                strokeWidth={1.75}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {supportsVolumeMute(volTarget) && (
              <button
                type="button"
                onClick={() => actions.onMediaMuteToggle(volTarget)}
                aria-label={isMuted ? 'Réactiver le son' : 'Muet'}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-elevated hover:text-fluent-ink"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-fluent-danger" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => actions.onMediaVolumeStep(volTarget, 'down')}
              aria-label="Volume moins"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>

            {hasNumericVol ? (
              <>
                <input
                  type="range"
                  aria-label={`Volume ${volTargetName}`}
                  min={0}
                  max={100}
                  value={isMuted ? 0 : currentVolPct}
                  onChange={(e) => actions.onMediaVolumeSet(volTarget, Number(e.target.value))}
                  style={
                    {
                      '--slider-pct': `${isMuted ? 0 : currentVolPct}%`,
                      '--slider-fill': '#60a5fa',
                    } as React.CSSProperties
                  }
                  className="fluent-range flex-1"
                />
                <span className="w-8 shrink-0 text-right text-[11px] font-medium text-fluent-secondary tabular-data">
                  {isMuted ? '0%' : `${currentVolPct}%`}
                </span>
              </>
            ) : (
              <span className="flex-1 truncate text-center text-[11px] text-fluent-secondary">
                {volTargetName} • Pas matériel
              </span>
            )}

            <button
              type="button"
              onClick={() => actions.onMediaVolumeStep(volTarget, 'up')}
              aria-label="Volume plus"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </section>
      )}

      {/* Onglets de vues Lovelace (si l'Aperçu comporte plusieurs vues) */}
      {visibleViews.length > 1 && (
        <nav
          aria-label="Vues Home Assistant"
          className="fluent-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2"
        >
          {visibleViews.map(({ view, originalIndex }) => {
            const isSelected = originalIndex === selectedViewIndex;
            const label = view.title || view.path || `Vue ${originalIndex + 1}`;
            return (
              <button
                key={`${view.path || originalIndex}`}
                type="button"
                onClick={() => onSelectViewIndex(originalIndex)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
                    : 'bg-fluent-elevated text-fluent-secondary hover:bg-fluent-hover hover:text-fluent-ink'
                }`}
              >
                {view.icon && renderHaEntityIcon(undefined, view.icon, 'h-3.5 w-3.5')}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Badges de vue éventuels */}
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-3">
          {badges.map((b, idx) => {
            const ent = entities[b.entityId];
            if (!ent) return null;
            return (
              <span
                key={`${b.entityId}-${idx}`}
                className="inline-flex items-center gap-1 rounded-pill border border-white/[0.06] bg-fluent-elevated px-2.5 py-1 text-[11px] text-fluent-secondary tabular-data"
              >
                {renderHaEntityIcon(ent, b.icon, 'h-3 w-3 text-fluent-accent')}
                <span className="font-medium text-fluent-ink">
                  {formatHaStateShort(ent)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Sections & Grille 2 colonnes de Tuiles identiques à l'Aperçu Home Assistant */}
      <div className="flex flex-col gap-3.5 px-3.5 py-3">
        {sections.length === 0 ? (
          <div className="py-8 text-center text-xs text-fluent-secondary">
            Aucune tuile trouvée dans cette vue
          </div>
        ) : (
          sections.map((section) => {
            const renderedItems = section.items.filter((it) => Boolean(entities[it.entityId]));
            if (renderedItems.length === 0 && section.badges.length === 0) return null;

            return (
              <section key={section.key} className="flex flex-col gap-2">
                {(section.title || section.badges.length > 0) && (
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    {section.title ? (
                      <h2 className="flex items-center gap-1.5 truncate text-xs font-semibold text-fluent-secondary">
                        {section.icon &&
                          renderHaEntityIcon(undefined, section.icon, 'h-3.5 w-3.5')}
                        <span className="truncate">{section.title}</span>
                      </h2>
                    ) : (
                      <span />
                    )}

                    {section.badges.length > 0 && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {section.badges.slice(0, 3).map((b, bIdx) => {
                          const bEnt = entities[b.entityId];
                          if (!bEnt) return null;
                          return (
                            <span
                              key={`${b.entityId}-${bIdx}`}
                              className="inline-flex items-center gap-1 text-[11px] text-fluent-secondary tabular-data"
                            >
                              {renderHaEntityIcon(bEnt, b.icon, 'h-3 w-3')}
                              <span>{formatHaStateShort(bEnt)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {renderedItems.map((tile) => (
                    <HaTileCard
                      key={tile.key}
                      tile={tile}
                      entity={entities[tile.entityId]}
                      actions={actions}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
