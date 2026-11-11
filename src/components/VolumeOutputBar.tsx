import React from 'react';
import { ChevronDown, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import type { HaEntity } from '../types/ha';
import { shortEntityLabel } from '../utils/color';
import {
  canControlEntityVolume,
  supportsVolumeMute,
  supportsVolumeSet,
} from '../utils/mediaRouting';

interface VolumeOutputBarProps {
  volumePlayers: HaEntity[];
  volumeTargetMode: string;
  resolvedVolumeTarget: HaEntity | null;
  unreliableVolumeIds: ReadonlySet<string>;
  onChangeVolumeTargetMode: (mode: string) => void;
  onVolumeSet: (entity: HaEntity, pct: number) => void;
  onVolumeStep: (entity: HaEntity, direction: 'up' | 'down') => void;
  onMuteToggle: (entity: HaEntity) => void;
}

export const VolumeOutputBar: React.FC<VolumeOutputBarProps> = ({
  volumePlayers,
  volumeTargetMode,
  resolvedVolumeTarget,
  unreliableVolumeIds,
  onChangeVolumeTargetMode,
  onVolumeSet,
  onVolumeStep,
  onMuteToggle,
}) => {
  const volTarget = resolvedVolumeTarget;
  if (!volTarget || !canControlEntityVolume(volTarget)) {
    return null;
  }

  const volTargetName =
    volTarget.attributes.friendly_name || shortEntityLabel(volTarget, 2);
  const hasRealNumericVol =
    typeof volTarget.attributes.volume_level === 'number' &&
    supportsVolumeSet(volTarget) &&
    !unreliableVolumeIds.has(volTarget.entity_id);
  const currentVolPct = hasRealNumericVol
    ? Math.round((volTarget.attributes.volume_level as number) * 100)
    : 0;
  const isMuted = Boolean(volTarget.attributes.is_volume_muted);

  return (
    <section
      aria-label="Sortie volume active"
      onWheel={(e) => {
        e.preventDefault();
        onVolumeStep(volTarget, e.deltaY < 0 ? 'up' : 'down');
      }}
      className="shrink-0 border-b border-white/[0.06] bg-fluent-base/80 px-3.5 py-2"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-fluent-secondary">
          Sortie volume
        </span>

        <div className="relative min-w-0 max-w-[240px]">
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
            onClick={() => onMuteToggle(volTarget)}
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
          onClick={() => onVolumeStep(volTarget, 'down')}
          aria-label="Volume moins"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>

        {hasRealNumericVol ? (
          <>
            <input
              type="range"
              aria-label={`Volume ${volTargetName}`}
              min={0}
              max={100}
              value={isMuted ? 0 : currentVolPct}
              onChange={(e) => onVolumeSet(volTarget, Number(e.target.value))}
              style={
                {
                  '--slider-pct': `${isMuted ? 0 : currentVolPct}%`,
                  '--slider-fill': '#60a5fa',
                } as React.CSSProperties
              }
              className="fluent-range flex-1"
            />
            <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-fluent-ink tabular-data">
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
          onClick={() => onVolumeStep(volTarget, 'up')}
          aria-label="Volume plus"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </section>
  );
};
