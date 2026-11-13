import React from 'react';
import { ChevronDown, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import type { HaEntity, VolumeCalibration } from '../types/ha';
import { shortEntityLabel } from '../utils/color';
import {
  canControlEntityVolume,
  supportsVolumeMute,
  supportsVolumeSet,
} from '../utils/mediaRouting';
import {
  displayVolumeToRawLevel,
  formatEntityVolume,
} from '../utils/volumeScale';
import { VolumeScaleBadge } from './VolumeScaleBadge';

interface VolumeOutputBarProps {
  volumePlayers: HaEntity[];
  volumeTargetMode: string;
  resolvedVolumeTarget: HaEntity | null;
  unreliableVolumeIds: ReadonlySet<string>;
  volumeScales: Record<string, VolumeCalibration>;
  onChangeVolumeTargetMode: (mode: string) => void;
  onVolumeSetRaw: (entity: HaEntity, rawLevel: number) => void;
  onVolumeStep: (entity: HaEntity, direction: 'up' | 'down') => void;
  onMuteToggle: (entity: HaEntity) => void;
  onCalibrateVolume: (entity: HaEntity, rawInput: string) => boolean;
  onResetVolumeCalibration: (entityId: string) => void;
}

export const VolumeOutputBar: React.FC<VolumeOutputBarProps> = ({
  volumePlayers,
  volumeTargetMode,
  resolvedVolumeTarget,
  unreliableVolumeIds,
  volumeScales,
  onChangeVolumeTargetMode,
  onVolumeSetRaw,
  onVolumeStep,
  onMuteToggle,
  onCalibrateVolume,
  onResetVolumeCalibration,
}) => {
  const volTarget = resolvedVolumeTarget;
  if (!volTarget || !canControlEntityVolume(volTarget)) {
    return null;
  }

  const volTargetName =
    volTarget.attributes.friendly_name || shortEntityLabel(volTarget, 2);
  const hasRealNumericVol =
    typeof volTarget.attributes.volume_level === 'number' &&
    !unreliableVolumeIds.has(volTarget.entity_id);
  const canDragSlider = hasRealNumericVol && supportsVolumeSet(volTarget);
  const volInfo = hasRealNumericVol
    ? formatEntityVolume(volTarget, volumeScales)
    : null;
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

        {volInfo ? (
          <>
            {canDragSlider ? (
              <input
                type="range"
                aria-label={`Volume ${volTargetName}`}
                min={volInfo.min}
                max={volInfo.max}
                step={1}
                value={volInfo.displayValue}
                onChange={(e) =>
                  onVolumeSetRaw(
                    volTarget,
                    displayVolumeToRawLevel(Number(e.target.value), volInfo.calibration),
                  )
                }
                style={
                  {
                    '--slider-pct': `${volInfo.barPct}%`,
                    '--slider-fill': '#60a5fa',
                  } as React.CSSProperties
                }
                className="fluent-range flex-1"
              />
            ) : (
              <div
                aria-hidden="true"
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.12]"
              >
                <div
                  style={{ width: `${volInfo.barPct}%` }}
                  className="h-full rounded-full bg-fluent-accent"
                />
              </div>
            )}

            <VolumeScaleBadge
              label={volInfo.label}
              displayValue={volInfo.displayValue}
              maxScale={volInfo.calibration.scale}
              rawVolumeLevel={volTarget.attributes.volume_level as number}
              calibrated={volInfo.calibrated}
              onCalibrate={(input) => onCalibrateVolume(volTarget, input)}
              onReset={() => onResetVolumeCalibration(volTarget.entity_id)}
            />
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
