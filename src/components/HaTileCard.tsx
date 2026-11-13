import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Pause,
  Play,
  Plus,
  Power,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HaEntity, LovelaceActionConfig, VolumeCalibration } from '../types/ha';
import {
  getLightVisualColor,
  RGB_PRESETS,
  shortEntityLabel,
  supportsColorTemp as lightSupportsColorTemp,
  supportsRgbColor as lightSupportsRgb,
} from '../utils/color';
import {
  formatHaStateShort,
  getHaTileAccentColor,
  isDomainToggleable,
  isHaEntityActive,
  renderHaEntityIcon,
} from '../utils/haIcons';
import { resolveHaMediaUrl } from '../services/haWebsocket';
import type { NormalizedTileItem } from '../utils/lovelaceLayout';
import {
  canControlEntityVolume,
  HA_MEDIA_SUPPORT_NEXT_TRACK,
  HA_MEDIA_SUPPORT_PAUSE,
  HA_MEDIA_SUPPORT_PLAY,
  HA_MEDIA_SUPPORT_PREVIOUS_TRACK,
  HA_MEDIA_SUPPORT_TURN_OFF,
  HA_MEDIA_SUPPORT_TURN_ON,
  supportsVolumeMute,
  supportsVolumeSet,
} from '../utils/mediaRouting';
import {
  displayVolumeToRawLevel,
  formatEntityVolume,
} from '../utils/volumeScale';
import { VolumeScaleBadge } from './VolumeScaleBadge';

export interface HaTileActions {
  haBaseUrl: string;
  volumeScales: Record<string, VolumeCalibration>;
  unreliableVolumeIds: ReadonlySet<string>;
  onPrimaryToggle: (entity: HaEntity) => void;
  onExecuteTapAction: (tapAction: LovelaceActionConfig, fallbackEntity?: HaEntity) => void;
  onLightBrightness: (entityId: string, pct: number) => void;
  onLightColorTemp: (entityId: string, kelvin: number) => void;
  onLightRgb: (entityId: string, rgb: [number, number, number]) => void;
  onMediaPlayPause: (entity: HaEntity) => void;
  onMediaPrev: (entity: HaEntity) => void;
  onMediaNext: (entity: HaEntity) => void;
  onMediaPowerToggle: (entity: HaEntity) => void;
  onMediaVolumeSetRaw: (entity: HaEntity, rawLevel: number) => void;
  onMediaVolumeStep: (entity: HaEntity, direction: 'up' | 'down') => void;
  onMediaMuteToggle: (entity: HaEntity) => void;
  onMediaSelectSource: (entity: HaEntity, source: string) => void;
  onCalibrateVolume: (entity: HaEntity, rawInput: string) => boolean;
  onResetVolumeCalibration: (entityId: string) => void;
  onCoverCommand: (entityId: string, cmd: 'open_cover' | 'close_cover' | 'stop_cover') => void;
  onCoverPosition: (entityId: string, position: number) => void;
  onClimateTemp: (entityId: string, temp: number) => void;
  onClimateMode: (entityId: string, hvacMode: string) => void;
  onSelectOption: (entity: HaEntity, option: string) => void;
  onNumberValue: (entity: HaEntity, value: number) => void;
}

interface HaTileCardProps {
  tile: NormalizedTileItem;
  entity: HaEntity | undefined;
  actions: HaTileActions;
}

const HVAC_LABELS: Record<string, string> = {
  off: 'Arrêt',
  heat: 'Chauffe',
  cool: 'Clim',
  heat_cool: 'Auto',
  auto: 'Auto',
  dry: 'Sec',
  fan_only: 'Ventil.',
};

export const HaTileCard: React.FC<HaTileCardProps> = ({ tile, entity, actions }) => {
  const [expanded, setExpanded] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const rawPicture = tile.imageUrl || entity?.attributes.entity_picture;
  useEffect(() => {
    setImgError(false);
  }, [rawPicture]);

  if (!entity && !tile.imageUrl && !tile.tapAction) return null;

  const domain = entity ? entity.entity_id.split('.')[0] : 'picture';
  const active = entity ? isHaEntityActive(entity) : false;
  const accentColor = entity ? getHaTileAccentColor(entity) : null;
  const toggleable = entity ? isDomainToggleable(domain) : Boolean(tile.tapAction);
  const isStatelessTrigger =
    !entity ||
    domain === 'scene' ||
    domain === 'script' ||
    domain === 'button' ||
    domain === 'input_button';

  const displayName =
    tile.name ||
    entity?.attributes.friendly_name ||
    (entity ? shortEntityLabel(entity, 3) : '');
  const stateLabel = justTriggered
    ? 'Activé'
    : entity
      ? formatHaStateShort(entity)
      : '';

  const isShortcutCard =
    tile.cardType === 'picture-entity' ||
    tile.cardType === 'picture' ||
    tile.cardType === 'button';

  const hasRichDetails = Boolean(
    entity &&
      ((domain === 'light' &&
        (typeof entity.attributes.brightness === 'number' ||
          lightSupportsColorTemp(entity) ||
          lightSupportsRgb(entity))) ||
        (domain === 'media_player' && !isShortcutCard) ||
        domain === 'cover' ||
        domain === 'climate' ||
        ((domain === 'select' || domain === 'input_select') &&
          Array.isArray(entity.attributes.options)) ||
        domain === 'number' ||
        domain === 'input_number'),
  );

  const hasInlineFeatures =
    tile.features.length > 0 || (domain === 'media_player' && !isShortcutCard);
  const showControls = Boolean(entity) && (expanded || hasInlineFeatures);

  const triggerFlash = () => {
    setJustTriggered(true);
    window.setTimeout(() => setJustTriggered(false), 900);
  };

  const handlePrimaryClick = () => {
    if (tile.tapAction?.action && tile.tapAction.action !== 'more-info') {
      if (tile.tapAction.action === 'none') return;
      actions.onExecuteTapAction(tile.tapAction, entity);
      if (
        isStatelessTrigger ||
        tile.tapAction.action === 'perform-action' ||
        tile.tapAction.action === 'call-service'
      ) {
        triggerFlash();
      }
      return;
    }

    if (!entity) return;
    if (!toggleable) {
      if (hasRichDetails) setExpanded((v) => !v);
      return;
    }
    actions.onPrimaryToggle(entity);
    if (isStatelessTrigger) {
      triggerFlash();
    }
  };

  const canShowPicture = tile.showEntityPicture !== false;
  const resolvedPictureUrl = canShowPicture
    ? resolveHaMediaUrl(actions.haBaseUrl, rawPicture)
    : null;
  const validPictureUrl =
    resolvedPictureUrl &&
    !imgError &&
    (domain !== 'media_player' ||
      Boolean(tile.imageUrl) ||
      isShortcutCard ||
      entity?.state === 'playing' ||
      entity?.state === 'paused')
      ? resolvedPictureUrl
      : null;

  const isLiveCameraBanner = Boolean(tile.showBanner && domain === 'camera' && validPictureUrl);
  const isSquareVisualTile =
    !isLiveCameraBanner && !showControls && domain !== 'person' && Boolean(validPictureUrl);
  const isSquareActionTile =
    !isLiveCameraBanner &&
    !showControls &&
    !isSquareVisualTile &&
    (isStatelessTrigger || tile.cardType === 'button' || Boolean(tile.vertical));
  const isSquareTile = isSquareVisualTile || isSquareActionTile;

  // Format Tuile Carrée compacte (Scènes, Musique, Jeux, boutons & cartes à image non rognée)
  if (isSquareTile) {
    const showCaption = tile.showName !== false && Boolean(displayName);
    const clickable = toggleable || hasRichDetails || Boolean(tile.tapAction);

    return (
      <div
        style={
          active && accentColor && !justTriggered
            ? { borderColor: `${accentColor}88` }
            : undefined
        }
        className={`col-span-2 flex flex-col rounded-card border p-1.5 transition-colors duration-150 ${
          justTriggered
            ? 'border-fluent-online/55 bg-fluent-online/10'
            : active
              ? 'border-fluent-accent/55 bg-fluent-elevated'
              : 'border-white/[0.06] bg-fluent-elevated/85 hover:border-white/[0.14] hover:bg-fluent-hover/75'
        }`}
      >
        <button
          type="button"
          onClick={handlePrimaryClick}
          title={displayName || undefined}
          className={`flex w-full flex-col text-left ${
            clickable ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-control border border-white/[0.06] bg-[#0e1015]">
            {validPictureUrl ? (
              <img
                src={validPictureUrl}
                alt=""
                draggable={false}
                onError={() => setImgError(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <span
                style={
                  accentColor
                    ? {
                        backgroundColor: `${accentColor}26`,
                        color: accentColor,
                      }
                    : undefined
                }
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 ${
                  justTriggered
                    ? 'bg-fluent-online/25 text-fluent-online'
                    : accentColor
                      ? ''
                      : 'bg-white/[0.07] text-fluent-secondary'
                }`}
              >
                {justTriggered ? (
                  <Check className="h-5 w-5" strokeWidth={2.25} />
                ) : (
                  renderHaEntityIcon(entity, tile.icon, 'h-5 w-5')
                )}
              </span>
            )}
          </span>
        </button>

        {showCaption && (
          <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5">
            <button
              type="button"
              onClick={handlePrimaryClick}
              title={displayName}
              className={`min-w-0 flex-1 truncate text-left text-xs font-semibold leading-tight text-fluent-ink ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {displayName}
            </button>

            {justTriggered ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-fluent-online" strokeWidth={2.25} />
            ) : hasRichDetails && !hasInlineFeatures ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Plus de réglages"
                title="Réglages"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-control text-fluent-muted transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
              >
                <SlidersHorizontal className="h-3 w-3" strokeWidth={1.75} />
              </button>
            ) : active ? (
              <span
                aria-label={stateLabel}
                title={stateLabel}
                style={{ backgroundColor: accentColor || 'var(--accent-fluent)' }}
                className="h-2 w-2 shrink-0 rounded-full"
              />
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (!entity) return null;

  const isInlineSelect =
    showControls &&
    (domain === 'select' || domain === 'input_select') &&
    Array.isArray(entity.attributes.options);
  const spansFullModule = tile.fullWidth || (showControls && !isInlineSelect);
  const gridSpanClass = isInlineSelect
    ? 'col-span-6 min-[540px]:col-span-4'
    : spansFullModule
      ? 'col-span-6 min-[540px]:col-span-8 min-[680px]:col-span-5 min-[820px]:col-span-6 min-[1080px]:col-span-8'
      : 'col-span-3 min-[540px]:col-span-4 min-[680px]:col-span-5 min-[820px]:col-span-4 min-[1080px]:col-span-4';

  const mediaFeatures = entity.attributes.supported_features ?? 0;
  const mediaHasPower =
    (mediaFeatures & (HA_MEDIA_SUPPORT_TURN_ON | HA_MEDIA_SUPPORT_TURN_OFF)) !== 0;
  const mediaHasTransport =
    (mediaFeatures & (HA_MEDIA_SUPPORT_PAUSE | HA_MEDIA_SUPPORT_PLAY)) !== 0 ||
    entity.state === 'playing' ||
    entity.state === 'paused';
  const mediaHasPrev = (mediaFeatures & HA_MEDIA_SUPPORT_PREVIOUS_TRACK) !== 0;
  const mediaHasNext = (mediaFeatures & HA_MEDIA_SUPPORT_NEXT_TRACK) !== 0;
  const mediaSources = Array.isArray(entity.attributes.source_list)
    ? entity.attributes.source_list
    : [];
  const mediaHasNumericVol =
    typeof entity.attributes.volume_level === 'number' &&
    !actions.unreliableVolumeIds.has(entity.entity_id);
  const mediaCanDragVol = mediaHasNumericVol && supportsVolumeSet(entity);
  const mediaVolInfo = mediaHasNumericVol
    ? formatEntityVolume(entity, actions.volumeScales)
    : null;

  return (
    <div
      onWheel={
        domain === 'media_player' && canControlEntityVolume(entity)
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              actions.onMediaVolumeStep(entity, e.deltaY < 0 ? 'up' : 'down');
            }
          : undefined
      }
      className={`flex flex-col rounded-card border transition-colors duration-150 ${gridSpanClass} ${
        justTriggered
          ? 'border-fluent-online/45 bg-fluent-online/10'
          : active
            ? 'border-white/[0.11] bg-fluent-elevated'
            : 'border-white/[0.06] bg-fluent-elevated/85 hover:bg-fluent-hover/75'
      } p-2.5`}
    >
      {/* Flux caméra 16:9 complet non rogné */}
      {isLiveCameraBanner && validPictureUrl && (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className={`mb-2 aspect-video w-full overflow-hidden rounded-control border border-white/[0.06] bg-[#0e1015] ${
            toggleable || hasRichDetails ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <img
            src={validPictureUrl}
            alt=""
            draggable={false}
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        </button>
      )}

      {/* Ligne principale de la Tuile Home Assistant */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrimaryClick}
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
            toggleable || hasRichDetails ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <span
            style={
              accentColor
                ? {
                    backgroundColor: `${accentColor}26`,
                    color: accentColor,
                  }
                : undefined
            }
            className={`relative flex ${
              isInlineSelect ? 'h-7 w-7' : 'h-9 w-9'
            } shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors duration-150 ${
              justTriggered
                ? 'bg-fluent-online/25 text-fluent-online'
                : accentColor
                  ? ''
                  : 'bg-white/[0.06] text-fluent-secondary'
            }`}
          >
            {!isLiveCameraBanner && validPictureUrl ? (
              <img
                src={validPictureUrl}
                alt=""
                draggable={false}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : justTriggered ? (
              <Check className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              renderHaEntityIcon(
                entity,
                tile.icon,
                isInlineSelect ? 'h-3.5 w-3.5' : 'h-4 w-4',
              )
            )}
          </span>

          {/* Libellé + État synthétique (sans répétition redondante sur les listes déroulantes) */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-semibold leading-tight text-fluent-ink">
              {displayName}
            </span>
            {!isInlineSelect && (
              <span
                className={`truncate text-[11px] leading-tight tabular-data ${
                  justTriggered
                    ? 'font-medium text-fluent-online'
                    : active
                      ? 'text-fluent-secondary'
                      : 'text-fluent-muted'
                }`}
              >
                {stateLabel}
              </span>
            )}
          </span>
        </button>

        {/* Bouton rapide On/Off sur lecteur multimédia ou déploiement des réglages détaillés */}
        {domain === 'media_player' && mediaHasPower && (
          <button
            type="button"
            onClick={() => actions.onMediaPowerToggle(entity)}
            aria-label={entity.state === 'off' ? 'Allumer' : 'Éteindre'}
            title={entity.state === 'off' ? 'Allumer' : 'Éteindre'}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
              entity.state !== 'off' && entity.state !== 'standby'
                ? 'bg-fluent-accent/20 text-fluent-accent hover:bg-fluent-accent/30'
                : 'bg-white/[0.06] text-fluent-muted hover:text-fluent-ink'
            }`}
          >
            <Power className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}

        {hasRichDetails && !hasInlineFeatures && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Masquer les options' : 'Plus de réglages'}
            title="Réglages"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-colors ${
              expanded
                ? 'bg-fluent-hover text-fluent-ink'
                : 'text-fluent-muted hover:bg-fluent-hover hover:text-fluent-ink'
            }`}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      {/* Contrôles inline contextuels (Features Lovelace ou panneau déplié) */}
      {showControls && domain === 'light' && (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
          <div className="flex items-center gap-2">
            <input
              type="range"
              aria-label={`Luminosité ${displayName}`}
              min={0}
              max={100}
              value={
                entity.state === 'on'
                  ? Math.round(((entity.attributes.brightness ?? 255) / 255) * 100)
                  : 0
              }
              onChange={(e) => actions.onLightBrightness(entity.entity_id, Number(e.target.value))}
              style={
                {
                  '--slider-pct': `${
                    entity.state === 'on'
                      ? Math.round(((entity.attributes.brightness ?? 255) / 255) * 100)
                      : 0
                  }%`,
                  '--slider-fill': entity.state === 'on' ? getLightVisualColor(entity) : '#949eae',
                } as React.CSSProperties
              }
              className="fluent-range flex-1"
            />
          </div>

          {expanded && (lightSupportsColorTemp(entity) || lightSupportsRgb(entity)) && (
            <div className="flex flex-col gap-2">
              {lightSupportsColorTemp(entity) && (
                <div className="flex items-center gap-2">
                  <span className="w-11 shrink-0 text-[11px] text-fluent-secondary tabular-data">
                    {entity.attributes.color_temp_kelvin ?? 3200}K
                  </span>
                  <input
                    type="range"
                    aria-label={`Température ${displayName}`}
                    min={entity.attributes.min_color_temp_kelvin || 2200}
                    max={entity.attributes.max_color_temp_kelvin || 6500}
                    step={100}
                    value={entity.attributes.color_temp_kelvin || 3200}
                    onChange={(e) =>
                      actions.onLightColorTemp(entity.entity_id, Number(e.target.value))
                    }
                    style={
                      {
                        '--slider-pct': `${Math.round(
                          (((entity.attributes.color_temp_kelvin || 3200) -
                            (entity.attributes.min_color_temp_kelvin || 2200)) /
                            Math.max(
                              1,
                              (entity.attributes.max_color_temp_kelvin || 6500) -
                                (entity.attributes.min_color_temp_kelvin || 2200),
                            )) *
                            100,
                        )}%`,
                        '--slider-fill': '#fbbf24',
                      } as React.CSSProperties
                    }
                    className="fluent-range flex-1"
                  />
                </div>
              )}

              {lightSupportsRgb(entity) && (
                <div className="flex items-center justify-between gap-1.5">
                  {RGB_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => actions.onLightRgb(entity.entity_id, preset.rgb)}
                      aria-label={preset.label}
                      title={preset.label}
                      style={{ backgroundColor: preset.hex }}
                      className="h-5 flex-1 rounded-pill border border-white/20 transition-transform duration-150 hover:scale-105 active:scale-95"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showControls && domain === 'media_player' && entity.state !== 'off' && entity.state !== 'unavailable' && (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
          {/* Transport + Sélecteur de source */}
          {(mediaHasTransport || mediaSources.length > 0) && (
            <div className="flex items-center justify-between gap-2">
              {mediaSources.length > 0 ? (
                <div className="relative min-w-0 flex-1">
                  <select
                    aria-label={`Source ${displayName}`}
                    value={String(entity.attributes.source || '')}
                    onChange={(e) => actions.onMediaSelectSource(entity, e.target.value)}
                    className="w-full appearance-none truncate rounded-control border border-white/[0.08] bg-fluent-base py-1 pl-2 pr-6 text-[11px] text-fluent-secondary transition-colors hover:text-fluent-ink focus:outline-none"
                  >
                    {!entity.attributes.source && (
                      <option value="" className="bg-fluent-base">
                        Source
                      </option>
                    )}
                    {mediaSources.map((src) => (
                      <option key={src} value={src} className="bg-fluent-base">
                        {src}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-fluent-secondary"
                    strokeWidth={1.75}
                  />
                </div>
              ) : (
                <span className="truncate text-[11px] text-fluent-secondary">
                  {String(entity.attributes.media_artist || '')}
                </span>
              )}

              {mediaHasTransport && (
                <div className="flex shrink-0 items-center gap-1">
                  {mediaHasPrev && (
                    <button
                      type="button"
                      onClick={() => actions.onMediaPrev(entity)}
                      aria-label="Précédent"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-fluent-secondary transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
                    >
                      <SkipBack className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => actions.onMediaPlayPause(entity)}
                    aria-label={entity.state === 'playing' ? 'Pause' : 'Lecture'}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-fluent-accent text-fluent-accentInk transition-colors hover:bg-[#7bb6fc]"
                  >
                    {entity.state === 'playing' ? (
                      <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
                    ) : (
                      <Play className="h-3.5 w-3.5 translate-x-[0.5px] fill-current" strokeWidth={2} />
                    )}
                  </button>
                  {mediaHasNext && (
                    <button
                      type="button"
                      onClick={() => actions.onMediaNext(entity)}
                      aria-label="Suivant"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-fluent-secondary transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
                    >
                      <SkipForward className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contrôle Volume matériel (Slider continu OU boutons pas-à-pas CEC/IR) */}
          {canControlEntityVolume(entity) && (
            <div className="flex items-center gap-1.5">
              {supportsVolumeMute(entity) && (
                <button
                  type="button"
                  onClick={() => actions.onMediaMuteToggle(entity)}
                  aria-label={entity.attributes.is_volume_muted ? 'Réactiver le son' : 'Muet'}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fluent-secondary transition-colors hover:bg-fluent-hover hover:text-fluent-ink"
                >
                  {entity.attributes.is_volume_muted ? (
                    <VolumeX className="h-3.5 w-3.5 text-fluent-danger" strokeWidth={1.75} />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => actions.onMediaVolumeStep(entity, 'down')}
                aria-label="Baisser le volume"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>

              {mediaVolInfo ? (
                <>
                  {mediaCanDragVol ? (
                    <input
                      type="range"
                      aria-label={`Volume ${displayName}`}
                      min={mediaVolInfo.min}
                      max={mediaVolInfo.max}
                      step={1}
                      value={mediaVolInfo.displayValue}
                      onChange={(e) =>
                        actions.onMediaVolumeSetRaw(
                          entity,
                          displayVolumeToRawLevel(
                            Number(e.target.value),
                            mediaVolInfo.calibration,
                          ),
                        )
                      }
                      style={
                        {
                          '--slider-pct': `${mediaVolInfo.barPct}%`,
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
                        style={{ width: `${mediaVolInfo.barPct}%` }}
                        className="h-full rounded-full bg-fluent-accent"
                      />
                    </div>
                  )}

                  <VolumeScaleBadge
                    label={mediaVolInfo.label}
                    displayValue={mediaVolInfo.displayValue}
                    maxScale={mediaVolInfo.calibration.scale}
                    rawVolumeLevel={entity.attributes.volume_level as number}
                    calibrated={mediaVolInfo.calibrated}
                    onCalibrate={(input) => actions.onCalibrateVolume(entity, input)}
                    onReset={() => actions.onResetVolumeCalibration(entity.entity_id)}
                  />
                </>
              ) : (
                <span className="flex-1 text-center text-[11px] text-fluent-secondary">
                  Volume matériel
                </span>
              )}

              <button
                type="button"
                onClick={() => actions.onMediaVolumeStep(entity, 'up')}
                aria-label="Monter le volume"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover active:bg-fluent-active"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      )}

      {showControls && domain === 'cover' && (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => actions.onCoverCommand(entity.entity_id, 'open_cover')}
              aria-label="Ouvrir"
              className="flex h-7 flex-1 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => actions.onCoverCommand(entity.entity_id, 'stop_cover')}
              aria-label="Stop"
              className="flex h-7 flex-1 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover"
            >
              <Square className="h-3 w-3" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => actions.onCoverCommand(entity.entity_id, 'close_cover')}
              aria-label="Fermer"
              className="flex h-7 flex-1 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          {typeof entity.attributes.current_position === 'number' && (
            <input
              type="range"
              aria-label={`Position ${displayName}`}
              min={0}
              max={100}
              value={entity.attributes.current_position}
              onChange={(e) =>
                actions.onCoverPosition(entity.entity_id, Number(e.target.value))
              }
              style={
                {
                  '--slider-pct': `${entity.attributes.current_position}%`,
                  '--slider-fill': '#60a5fa',
                } as React.CSSProperties
              }
              className="fluent-range w-full"
            />
          )}
        </div>
      )}

      {showControls && domain === 'climate' && (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
          {typeof entity.attributes.temperature === 'number' && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  actions.onClimateTemp(
                    entity.entity_id,
                    Number(
                      (
                        (entity.attributes.temperature as number) -
                        (entity.attributes.target_temp_step || 0.5)
                      ).toFixed(1),
                    ),
                  )
                }
                aria-label="Baisser la consigne"
                className="flex h-7 w-9 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <span className="text-xs font-semibold text-fluent-ink tabular-data">
                {entity.attributes.temperature} °C
              </span>
              <button
                type="button"
                onClick={() =>
                  actions.onClimateTemp(
                    entity.entity_id,
                    Number(
                      (
                        (entity.attributes.temperature as number) +
                        (entity.attributes.target_temp_step || 0.5)
                      ).toFixed(1),
                    ),
                  )
                }
                aria-label="Monter la consigne"
                className="flex h-7 w-9 items-center justify-center rounded-control bg-fluent-base text-fluent-ink transition-colors hover:bg-fluent-hover"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {Array.isArray(entity.attributes.hvac_modes) &&
            entity.attributes.hvac_modes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {entity.attributes.hvac_modes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => actions.onClimateMode(entity.entity_id, mode)}
                    className={`flex-1 rounded-control py-1 text-[11px] font-medium transition-colors ${
                      entity.state === mode
                        ? 'bg-fluent-accent font-semibold text-fluent-accentInk'
                        : 'bg-fluent-base text-fluent-secondary hover:text-fluent-ink'
                    }`}
                  >
                    {HVAC_LABELS[mode] || mode}
                  </button>
                ))}
              </div>
            )}
        </div>
      )}

      {showControls &&
        (domain === 'select' || domain === 'input_select') &&
        Array.isArray(entity.attributes.options) && (
          <div className="mt-1.5">
            <div className="relative">
              <select
                aria-label={displayName}
                value={entity.state}
                onChange={(e) => actions.onSelectOption(entity, e.target.value)}
                className="w-full appearance-none rounded-control border border-white/[0.08] bg-fluent-base py-1.5 pl-2.5 pr-7 text-xs text-fluent-ink focus:outline-none"
              >
                {entity.attributes.options.map((opt) => (
                  <option key={opt} value={opt} className="bg-fluent-base">
                    {opt}
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

      {showControls && (domain === 'number' || domain === 'input_number') && (
        <div className="mt-2 border-t border-white/[0.06] pt-2">
          <input
            type="range"
            aria-label={displayName}
            min={entity.attributes.min ?? 0}
            max={entity.attributes.max ?? 100}
            step={entity.attributes.step ?? 1}
            value={Number(entity.state) || 0}
            onChange={(e) => actions.onNumberValue(entity, Number(e.target.value))}
            style={
              {
                '--slider-pct': `${Math.round(
                  (((Number(entity.state) || 0) - (entity.attributes.min ?? 0)) /
                    Math.max(
                      1,
                      (entity.attributes.max ?? 100) - (entity.attributes.min ?? 0),
                    )) *
                    100,
                )}%`,
                '--slider-fill': '#60a5fa',
              } as React.CSSProperties
            }
            className="fluent-range w-full"
          />
        </div>
      )}
    </div>
  );
};
