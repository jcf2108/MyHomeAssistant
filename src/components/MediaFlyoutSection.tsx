import React from 'react';
import {
  ChevronDown,
  Disc3,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Speaker,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HaEntity } from '../types/ha';
import { shortEntityLabel } from '../utils/color';

interface MediaFlyoutSectionProps {
  players: HaEntity[];
  activePlayer: HaEntity | null;
  coverUrl: string | null;
  onSelectPlayer: (entityId: string) => void;
  onSelectSource: (source: string) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (pct: number) => void;
  onToggleMute: () => void;
}

export const MediaFlyoutSection: React.FC<MediaFlyoutSectionProps> = ({
  players,
  activePlayer,
  coverUrl,
  onSelectPlayer,
  onSelectSource,
  onPlayPause,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleMute,
}) => {
  if (!activePlayer) {
    return (
      <section className="mx-3 mt-2.5 mb-2 rounded-[10px] bg-[#242934]/85 border border-white/[0.07] px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-fluent-secondary">
          <span className="flex items-center gap-2">
            <Speaker className="h-4 w-4 text-fluent-muted" strokeWidth={1.75} />
            Aucun lecteur
          </span>
        </div>
      </section>
    );
  }

  const isPlaying = activePlayer.state === 'playing';
  const isUnavailable = activePlayer.state === 'unavailable';
  const volumePct =
    typeof activePlayer.attributes.volume_level === 'number'
      ? Math.round(activePlayer.attributes.volume_level * 100)
      : 0;
  const isMuted = Boolean(activePlayer.attributes.is_volume_muted);
  const sources = Array.isArray(activePlayer.attributes.source_list)
    ? activePlayer.attributes.source_list
    : [];

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (isUnavailable) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(100, volumePct + (e.deltaY < 0 ? 4 : -4)));
    onVolumeChange(next);
  };

  return (
    <section
      onWheel={handleWheel}
      className="mx-3 mt-2.5 mb-1.5 rounded-[10px] bg-[#242934]/85 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] px-3 pt-2.5 pb-3"
    >
      {/* Barre de sélection Enceinte + Source (dropdowns Fluent à chevrons dessinés) */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Speaker className="h-3.5 w-3.5 shrink-0 text-fluent-accent" strokeWidth={1.75} />
          {players.length > 1 ? (
            <div className="relative inline-flex items-center">
              <select
                aria-label="Choisir le lecteur multimédia"
                value={activePlayer.entity_id}
                onChange={(e) => onSelectPlayer(e.target.value)}
                className="max-w-[152px] appearance-none truncate rounded-control bg-fluent-elevated pl-2.5 pr-7 py-1 text-xs font-medium text-fluent-ink border border-white/[0.08] transition-colors hover:bg-fluent-hover focus:outline-none"
              >
                {players.map((p) => (
                  <option
                    key={p.entity_id}
                    value={p.entity_id}
                    className="bg-[#1c1e24] text-fluent-ink"
                  >
                    {p.attributes.friendly_name || p.entity_id}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-fluent-secondary"
                strokeWidth={1.75}
              />
            </div>
          ) : (
            <span className="truncate text-xs font-semibold text-fluent-ink">
              {shortEntityLabel(activePlayer, 3)}
            </span>
          )}
        </div>

        {sources.length > 0 && (
          <div className="relative inline-flex items-center">
            <select
              aria-label="Source audio"
              value={String(activePlayer.attributes.source || '')}
              onChange={(e) => onSelectSource(e.target.value)}
              disabled={isUnavailable}
              className="max-w-[138px] appearance-none truncate rounded-control bg-fluent-elevated pl-2.5 pr-7 py-1 text-[11px] font-medium text-fluent-secondary border border-white/[0.08] transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
            >
              {sources.map((src) => (
                <option key={src} value={src} className="bg-[#1c1e24] text-fluent-ink">
                  {src}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 h-3 w-3 text-fluent-secondary"
              strokeWidth={1.75}
            />
          </div>
        )}
      </div>

      {/* Pochette + Titre + Transport */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-fluent-elevated border border-white/[0.10]">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Disc3
              className={`h-5 w-5 ${isPlaying ? 'text-fluent-accent' : 'text-fluent-muted'}`}
              strokeWidth={1.75}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-snug text-fluent-ink">
            {String(
              activePlayer.attributes.media_title ||
                (isUnavailable ? 'Indisponible' : 'En veille'),
            )}
          </div>
          <div className="truncate text-xs leading-snug text-fluent-secondary">
            {String(
              activePlayer.attributes.media_artist ||
                activePlayer.attributes.source ||
                shortEntityLabel(activePlayer, 2),
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={isUnavailable}
            aria-label="Piste précédente"
            className="flex h-8 w-8 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors duration-150 hover:bg-fluent-hover active:bg-fluent-active disabled:opacity-40"
          >
            <SkipBack className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            disabled={isUnavailable}
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
            className="flex h-9 w-9 items-center justify-center rounded-control bg-fluent-accent text-fluent-accentInk transition-colors duration-150 hover:bg-[#7bb6fc] active:scale-95 disabled:bg-[#2a303c] disabled:text-fluent-muted"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" strokeWidth={2} />
            ) : (
              <Play className="h-4 w-4 translate-x-[0.5px] fill-current" strokeWidth={2} />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={isUnavailable}
            aria-label="Piste suivante"
            className="flex h-8 w-8 items-center justify-center rounded-control bg-fluent-elevated text-fluent-ink transition-colors duration-150 hover:bg-fluent-hover active:bg-fluent-active disabled:opacity-40"
          >
            <SkipForward className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Barre de Volume Windows 11 */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleMute}
          disabled={isUnavailable}
          aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fluent-secondary transition-colors duration-150 hover:bg-fluent-elevated hover:text-fluent-ink disabled:opacity-40"
        >
          {isMuted || volumePct === 0 ? (
            <VolumeX className="h-4 w-4 text-fluent-danger" strokeWidth={1.75} />
          ) : (
            <Volume2 className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : volumePct}
          disabled={isUnavailable}
          aria-label="Volume"
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          style={
            {
              '--slider-pct': `${isMuted ? 0 : volumePct}%`,
              '--slider-fill': 'var(--accent-fluent)',
            } as React.CSSProperties
          }
          className="fluent-range flex-1"
        />

        <span className="w-9 shrink-0 text-right text-xs font-medium text-fluent-secondary tabular-data">
          {isMuted ? 'Muet' : `${volumePct}%`}
        </span>
      </div>
    </section>
  );
};
