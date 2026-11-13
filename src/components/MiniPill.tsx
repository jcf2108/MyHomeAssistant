import React, { useRef, useState } from 'react';
import {
  ChevronUp,
  Disc3,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  HaConnectionStatus,
  HaEntity,
  VolumeCalibration,
  VolumeFeedbackBadge,
} from '../types/ha';
import { shortEntityLabel } from '../utils/color';
import { type DragStartCoords, handleSmartSurfacePointerDown } from '../utils/dragGesture';
import { getHaTileAccentColor, renderHaEntityIcon } from '../utils/haIcons';
import { formatEntityVolume } from '../utils/volumeScale';

interface MiniPillProps {
  status: HaConnectionStatus;
  previewMode: boolean;
  playbackPlayer: HaEntity | null;
  volumeTarget: HaEntity | null;
  unreliableVolumeIds: ReadonlySet<string>;
  volumeScales: Record<string, VolumeCalibration>;
  coverUrl: string | null;
  favoriteEntities: HaEntity[];
  volumeFeedback: VolumeFeedbackBadge | null;
  onExpand: () => void;
  onPlayPause: () => void;
  onNextTrack: () => void;
  onWheelVolume: (direction: 'up' | 'down') => void;
  onTriggerFavorite: (entity: HaEntity) => void;
  onStartDrag: (coords: DragStartCoords) => void;
}

export const MiniPill: React.FC<MiniPillProps> = ({
  status,
  previewMode,
  playbackPlayer,
  volumeTarget,
  unreliableVolumeIds,
  volumeScales,
  coverUrl,
  favoriteEntities,
  volumeFeedback,
  onExpand,
  onPlayPause,
  onNextTrack,
  onWheelVolume,
  onTriggerFavorite,
  onStartDrag,
}) => {
  const [forceFavorites, setForceFavorites] = useState(false);
  const lastWheelAtRef = useRef<number>(0);

  const isPlaying = playbackPlayer?.state === 'playing';
  const showMediaView = Boolean(playbackPlayer && isPlaying && !forceFavorites);

  const volSource = volumeTarget || playbackPlayer;
  const hasRealNumericVol =
    Boolean(volSource) &&
    typeof volSource!.attributes.volume_level === 'number' &&
    !unreliableVolumeIds.has(volSource!.entity_id);
  const volInfo = hasRealNumericVol
    ? formatEntityVolume(volSource, volumeScales)
    : null;
  const isMuted = Boolean(volSource?.attributes.is_volume_muted);
  const barPct =
    volumeFeedback?.pct !== null && volumeFeedback?.pct !== undefined
      ? volumeFeedback.pct
      : volInfo?.barPct ?? null;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!volSource) return;
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastWheelAtRef.current < 55) return;
    lastWheelAtRef.current = now;
    onWheelVolume(e.deltaY < 0 ? 'up' : 'down');
  };

  const statusColor = previewMode
    ? 'bg-fluent-accent'
    : status === 'connected'
      ? 'bg-fluent-online'
      : status === 'connecting'
        ? 'bg-fluent-warm'
        : 'bg-fluent-danger';

  return (
    <div
      onPointerDownCapture={(e) => handleSmartSurfacePointerDown(e, onStartDrag)}
      onWheel={handleWheel}
      className="group flyout-surface relative flex h-[52px] w-[316px] max-w-full cursor-grab select-none items-center gap-1.5 overflow-hidden rounded-pill px-3 text-fluent-ink active:cursor-grabbing"
      role="region"
      aria-label="Mini-pilule Home Assistant"
    >
      {volumeFeedback ? (
        /* Retour visuel direct lors d'un réglage de volume (affiche la vraie valeur étalonnée) */
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-control px-2 py-1 text-left"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-fluent-ink">
            <Volume2 className="h-4 w-4 shrink-0 text-fluent-accent" strokeWidth={1.75} />
            <span className="truncate">{volumeFeedback.targetLabel}</span>
          </span>
          <span className="shrink-0 rounded-pill bg-fluent-accent/20 px-2 py-0.5 text-xs font-semibold text-fluent-accent tabular-data">
            {volumeFeedback.valueLabel}
          </span>
        </button>
      ) : showMediaView && playbackPlayer ? (
        <>
          {/* Pochette miniature */}
          <div className="relative h-9 w-9 shrink-0">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-fluent-elevated">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Disc3 className="h-4 w-4 text-fluent-accent" strokeWidth={1.75} />
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-fluent-base ${statusColor}`}
            />
          </div>

          {/* Titre court + volume réel de la sortie active */}
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 flex-col items-start justify-center rounded-control px-1 py-0.5 text-left transition-colors duration-150 hover:bg-white/5"
          >
            <span className="w-full truncate text-xs font-semibold leading-tight text-fluent-ink">
              {String(
                playbackPlayer.attributes.media_title || shortEntityLabel(playbackPlayer, 2),
              )}
            </span>
            <span className="flex w-full items-center justify-between gap-1 text-[11px] leading-tight text-fluent-secondary">
              <span className="truncate">
                {String(
                  playbackPlayer.attributes.media_artist ||
                    volSource?.attributes.friendly_name ||
                    shortEntityLabel(playbackPlayer, 2),
                )}
              </span>
              {volSource && (isMuted || volInfo !== null) && (
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-data text-fluent-secondary">
                  {isMuted ? (
                    <VolumeX className="h-3 w-3 text-fluent-danger" strokeWidth={1.75} />
                  ) : (
                    <Volume2 className="h-3 w-3" strokeWidth={1.75} />
                  )}
                  {isMuted ? (volInfo ? volInfo.label : '0%') : volInfo?.label}
                </span>
              )}
            </span>
          </button>

          {/* Transport rapide */}
          <button
            type="button"
            onClick={onPlayPause}
            aria-label="Pause"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fluent-accent text-fluent-accentInk transition-colors duration-150 hover:bg-[#7bb6fc] active:scale-95"
          >
            <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={onNextTrack}
            aria-label="Piste suivante"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fluent-elevated text-fluent-ink transition-colors duration-150 hover:bg-fluent-hover active:bg-fluent-active"
          >
            <SkipForward className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>

          {favoriteEntities.length > 0 && (
            <button
              type="button"
              onClick={() => setForceFavorites(true)}
              aria-label="Afficher les favoris"
              title="Favoris"
              className="flex h-8 w-7 shrink-0 items-center justify-center rounded-full text-fluent-secondary transition-colors duration-150 hover:bg-fluent-elevated hover:text-fluent-ink"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </>
      ) : (
        <>
          {/* État + 3 Tuiles favorites issues de l'Aperçu */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-0.5">
            {playbackPlayer && isPlaying && forceFavorites ? (
              <button
                type="button"
                onClick={() => setForceFavorites(false)}
                aria-label="Retour au lecteur"
                title="Lecteur"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fluent-accent text-fluent-accentInk"
              >
                <Play className="h-3 w-3 fill-current" strokeWidth={2} />
              </button>
            ) : (
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`}
                title={
                  previewMode ? 'Aperçu' : status === 'connected' ? 'En ligne' : 'Hors ligne'
                }
              />
            )}

            {favoriteEntities.length > 0 ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {favoriteEntities.slice(0, 3).map((fav) => {
                  const activeTint = getHaTileAccentColor(fav);

                  return (
                    <button
                      key={fav.entity_id}
                      type="button"
                      onClick={() => onTriggerFavorite(fav)}
                      title={fav.attributes.friendly_name || fav.entity_id}
                      style={
                        activeTint
                          ? { backgroundColor: activeTint, color: '#09111e' }
                          : undefined
                      }
                      className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-pill px-2 text-[11px] font-medium transition-colors duration-150 ${
                        activeTint
                          ? 'font-semibold'
                          : 'bg-fluent-elevated text-fluent-ink hover:bg-fluent-hover active:bg-fluent-active'
                      }`}
                    >
                      {renderHaEntityIcon(fav, undefined, 'h-3.5 w-3.5 shrink-0')}
                      <span className="truncate">{shortEntityLabel(fav, 1)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={onExpand}
                className="truncate px-1.5 text-xs font-medium text-fluent-secondary hover:text-fluent-ink"
              >
                {status === 'connected' ? 'Aperçu' : 'Configurer'}
              </button>
            )}
          </div>

          {playbackPlayer && !isPlaying && playbackPlayer.state === 'paused' && (
            <button
              type="button"
              onClick={onPlayPause}
              aria-label="Relancer la lecture"
              title="Lecture"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fluent-elevated text-fluent-ink transition-colors duration-150 hover:bg-fluent-hover"
            >
              <Play className="h-3.5 w-3.5 translate-x-[0.5px]" strokeWidth={1.75} />
            </button>
          )}
        </>
      )}

      {/* Bouton déplier */}
      <button
        type="button"
        onClick={onExpand}
        aria-label="Déplier le panneau"
        title="Déplier"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fluent-elevated text-fluent-ink transition-colors duration-150 hover:bg-fluent-hover active:bg-fluent-active"
      >
        <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {/* Jauge continue de volume uniquement si l'appareil remonte un niveau numérique réel */}
      {volSource && barPct !== null && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-5 bottom-0 h-[2.5px] overflow-hidden rounded-full bg-white/[0.08] transition-opacity duration-150 ${
            volumeFeedback !== null ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
          }`}
        >
          <div
            style={{ width: `${isMuted ? 0 : barPct}%` }}
            className="h-full rounded-full bg-fluent-accent"
          />
        </div>
      )}
    </div>
  );
};
