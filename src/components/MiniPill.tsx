import React, { useState } from 'react';
import {
  ChevronUp,
  Disc3,
  GripVertical,
  Lightbulb,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HaConnectionStatus, HaEntity } from '../types/ha';
import { getLightVisualColor, shortEntityLabel } from '../utils/color';

interface MiniPillProps {
  status: HaConnectionStatus;
  previewMode: boolean;
  mediaPlayer: HaEntity | null;
  coverUrl: string | null;
  favoriteEntities: HaEntity[];
  volumeHighlight: number | null;
  onExpand: () => void;
  onPlayPause: () => void;
  onNextTrack: () => void;
  onWheelVolume: (deltaPct: number) => void;
  onTriggerFavorite: (entity: HaEntity) => void;
  onDragPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export const MiniPill: React.FC<MiniPillProps> = ({
  status,
  previewMode,
  mediaPlayer,
  coverUrl,
  favoriteEntities,
  volumeHighlight,
  onExpand,
  onPlayPause,
  onNextTrack,
  onWheelVolume,
  onTriggerFavorite,
  onDragPointerDown,
}) => {
  const [forceFavorites, setForceFavorites] = useState(false);

  const isPlaying = mediaPlayer?.state === 'playing';
  // Affiche le mini-lecteur uniquement lorsqu'un média est activement en lecture
  // (dès la mise en pause ou clic favoris, bascule sur les 3 favoris épinglés)
  const showMediaView = Boolean(mediaPlayer && isPlaying && !forceFavorites);

  const currentVolumePct =
    typeof mediaPlayer?.attributes.volume_level === 'number'
      ? Math.round(mediaPlayer.attributes.volume_level * 100)
      : 0;
  const isMuted = Boolean(mediaPlayer?.attributes.is_volume_muted);
  const displayedVolPct = volumeHighlight !== null ? volumeHighlight : currentVolumePct;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!mediaPlayer) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 4 : -4;
    onWheelVolume(step);
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
      onWheel={handleWheel}
      className="group flyout-surface relative flex h-[52px] w-[316px] max-w-full items-center gap-1.5 overflow-hidden rounded-pill px-2 text-fluent-ink"
      role="region"
      aria-label="Mini-pilule Home Assistant"
    >
      {/* Poignée de déplacement libre */}
      <button
        type="button"
        onPointerDown={onDragPointerDown}
        aria-label="Déplacer la pilule"
        title="Glisser pour déplacer"
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-pill text-fluent-muted transition-colors duration-150 hover:bg-fluent-elevated hover:text-fluent-ink active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {showMediaView && mediaPlayer ? (
        <>
          {/* Pochette miniature */}
          <div className="relative h-9 w-9 shrink-0">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-fluent-elevated border border-white/10">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Disc3 className="h-4 w-4 text-fluent-accent" strokeWidth={1.75} />
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-fluent-base ${statusColor}`}
            />
          </div>

          {/* Titre court + jauge volume au survol/molette */}
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 flex-col items-start justify-center rounded-control px-1 py-0.5 text-left transition-colors duration-150 hover:bg-white/5"
          >
            <span className="w-full truncate text-xs font-semibold leading-tight text-fluent-ink">
              {String(mediaPlayer.attributes.media_title || shortEntityLabel(mediaPlayer, 2))}
            </span>
            <span className="flex w-full items-center justify-between gap-1 text-[11px] leading-tight text-fluent-secondary">
              <span className="truncate">
                {String(mediaPlayer.attributes.media_artist || shortEntityLabel(mediaPlayer, 2))}
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-0.5 tabular-data transition-colors ${
                  volumeHighlight !== null ? 'font-semibold text-fluent-accent' : 'text-fluent-secondary'
                }`}
              >
                {isMuted ? (
                  <VolumeX className="h-3 w-3 text-fluent-danger" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="h-3 w-3" strokeWidth={1.75} />
                )}
                {isMuted ? '0%' : `${displayedVolPct}%`}
              </span>
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
          {/* État + 3 Favoris rapides */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-0.5">
            {mediaPlayer && isPlaying && forceFavorites ? (
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
                title={previewMode ? 'Aperçu' : status === 'connected' ? 'En ligne' : 'Hors ligne'}
              />
            )}

            {favoriteEntities.length > 0 ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {favoriteEntities.slice(0, 3).map((fav) => {
                  const domain = fav.entity_id.split('.')[0];
                  const isLightOn = domain === 'light' && fav.state === 'on';
                  const activeTint = isLightOn ? getLightVisualColor(fav) : undefined;

                  return (
                    <button
                      key={fav.entity_id}
                      type="button"
                      onClick={() => onTriggerFavorite(fav)}
                      title={fav.attributes.friendly_name || fav.entity_id}
                      style={
                        isLightOn && activeTint
                          ? { backgroundColor: activeTint, color: '#09111e' }
                          : undefined
                      }
                      className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-pill px-2 text-[11px] font-medium transition-colors duration-150 ${
                        isLightOn
                          ? 'font-semibold'
                          : 'bg-fluent-elevated text-fluent-ink hover:bg-fluent-hover active:bg-fluent-active'
                      }`}
                    >
                      {domain === 'light' ? (
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      )}
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
                {status === 'connected' ? 'Contrôles' : 'Configurer'}
              </button>
            )}
          </div>

          {mediaPlayer && !isPlaying && (
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

      {/* Jauge continue de volume (molette / survol) sur le rebord inférieur de la pilule */}
      {mediaPlayer && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-5 bottom-0 h-[2.5px] overflow-hidden rounded-full bg-white/[0.08] transition-opacity duration-150 ${
            volumeHighlight !== null ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
          }`}
        >
          <div
            style={{ width: `${isMuted ? 0 : displayedVolPct}%` }}
            className="h-full rounded-full bg-fluent-accent transition-transform duration-150"
          />
        </div>
      )}
    </div>
  );
};
