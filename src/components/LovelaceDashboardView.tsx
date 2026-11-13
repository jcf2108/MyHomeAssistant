import React, { useEffect, useState } from 'react';
import { resolveHaMediaUrl } from '../services/haWebsocket';
import type { HaEntity, LovelaceViewConfig } from '../types/ha';
import { formatHaStateShort, renderHaEntityIcon } from '../utils/haIcons';
import type {
  NormalizedOverviewSection,
  NormalizedTileBadge,
} from '../utils/lovelaceLayout';
import { HaTileCard, type HaTileActions } from './HaTileCard';
import { VolumeOutputBar } from './VolumeOutputBar';

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
  unreliableVolumeIds: ReadonlySet<string>;
  onChangeVolumeTargetMode: (mode: string) => void;
  actions: HaTileActions;
}

const SectionBanner: React.FC<{ haBaseUrl: string; rawUrl?: string }> = ({
  haBaseUrl,
  rawUrl,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [rawUrl]);

  const resolved = resolveHaMediaUrl(haBaseUrl, rawUrl);
  if (!resolved || failed) return null;

  return (
    <div className="h-24 w-full overflow-hidden rounded-card border border-white/[0.06] bg-fluent-elevated">
      <img
        src={resolved}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
};

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
  unreliableVolumeIds,
  onChangeVolumeTargetMode,
  actions,
}) => {
  const visibleViews = views
    .map((v, idx) => ({ view: v, originalIndex: idx }))
    .filter((entry) => !entry.view.subview);

  return (
    <div className="fluent-scroll flex flex-1 flex-col overflow-y-auto">
      <VolumeOutputBar
        volumePlayers={volumePlayers}
        volumeTargetMode={volumeTargetMode}
        resolvedVolumeTarget={resolvedVolumeTarget}
        unreliableVolumeIds={unreliableVolumeIds}
        volumeScales={actions.volumeScales}
        onChangeVolumeTargetMode={onChangeVolumeTargetMode}
        onVolumeSetRaw={actions.onMediaVolumeSetRaw}
        onVolumeStep={actions.onMediaVolumeStep}
        onMuteToggle={actions.onMediaMuteToggle}
        onCalibrateVolume={actions.onCalibrateVolume}
        onResetVolumeCalibration={actions.onResetVolumeCalibration}
      />

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

      {/* Sections & Grille adaptative haute densité (tuiles carrées 3 à 8 par ligne + modules larges) */}
      <div className="flex flex-col gap-3.5 px-3 py-3">
        {sections.length === 0 ? (
          <div className="py-8 text-center text-xs text-fluent-secondary">
            Aucune tuile trouvée
          </div>
        ) : (
          sections.map((section) => {
            const renderedItems = section.items.filter((it) =>
              it.entityId
                ? Boolean(entities[it.entityId])
                : Boolean(it.imageUrl || it.tapAction),
            );
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

                {section.bannerImageUrl && (
                  <SectionBanner
                    haBaseUrl={actions.haBaseUrl}
                    rawUrl={section.bannerImageUrl}
                  />
                )}

                <div className="grid grid-flow-row-dense grid-cols-6 gap-2 min-[540px]:grid-cols-8 min-[680px]:grid-cols-10 min-[820px]:grid-cols-12 min-[1080px]:grid-cols-[repeat(16,minmax(0,1fr))]">
                  {renderedItems.map((tile) => (
                    <HaTileCard
                      key={tile.key}
                      tile={tile}
                      entity={tile.entityId ? entities[tile.entityId] : undefined}
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
