import type { HaEntity, VolumeCalibration } from '../types/ha';

export const DEFAULT_VOLUME_CALIBRATION: VolumeCalibration = {
  offset: 0,
  scale: 100,
  unit: '%',
};

const STANDARD_HARDWARE_SCALES = [
  15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 98, 100, 120, 125, 150, 161, 200,
];

export function isDefaultVolumeCalibration(cal: VolumeCalibration): boolean {
  return cal.offset === 0 && Math.abs(cal.scale - 100) < 0.01 && cal.unit === '%';
}

export function getEntityVolumeCalibration(
  entityId: string | undefined,
  scales: Record<string, VolumeCalibration> | undefined,
): VolumeCalibration {
  if (!entityId || !scales) return DEFAULT_VOLUME_CALIBRATION;
  const found = scales[entityId];
  if (
    !found ||
    typeof found.scale !== 'number' ||
    !Number.isFinite(found.scale) ||
    found.scale <= 0 ||
    typeof found.offset !== 'number' ||
    !Number.isFinite(found.offset)
  ) {
    return DEFAULT_VOLUME_CALIBRATION;
  }
  return found;
}

export function isEntityVolumeCalibrated(
  entityId: string | undefined,
  scales: Record<string, VolumeCalibration> | undefined,
): boolean {
  if (!entityId || !scales) return false;
  const found = scales[entityId];
  if (!found) return false;
  return !isDefaultVolumeCalibration(found);
}

/**
 * Convertit le `volume_level` Home Assistant (0.0..1.0) vers la valeur affichée sur l'écran réel de la TV / de l'Ampli.
 */
export function rawLevelToDisplayVolume(
  rawLevel: number,
  cal: VolumeCalibration,
): number {
  const clamped = Math.max(0, Math.min(1, rawLevel));
  return Math.round(cal.offset + clamped * cal.scale);
}

/**
 * Convertit une valeur saisie / glissée dans l'échelle de l'appareil vers `volume_level` Home Assistant (0.0..1.0).
 */
export function displayVolumeToRawLevel(
  displayValue: number,
  cal: VolumeCalibration,
): number {
  if (cal.scale <= 0) return 0;
  return Math.max(0, Math.min(1, (displayValue - cal.offset) / cal.scale));
}

export function formatDisplayVolume(
  displayValue: number,
  cal: VolumeCalibration,
): string {
  return `${displayValue}${cal.unit}`;
}

export function formatEntityVolume(
  entity: HaEntity | null | undefined,
  scales: Record<string, VolumeCalibration> | undefined,
): {
  displayValue: number;
  min: number;
  max: number;
  barPct: number;
  label: string;
  calibrated: boolean;
  calibration: VolumeCalibration;
} | null {
  if (!entity || typeof entity.attributes.volume_level !== 'number') {
    return null;
  }
  const calibration = getEntityVolumeCalibration(entity.entity_id, scales);
  const raw = Math.max(0, Math.min(1, entity.attributes.volume_level));
  const isMuted = Boolean(entity.attributes.is_volume_muted);
  const min = Math.round(calibration.offset);
  const max = Math.round(calibration.offset + calibration.scale);
  const displayValue = isMuted ? min : rawLevelToDisplayVolume(raw, calibration);
  const barPct = isMuted ? 0 : Math.round(raw * 100);
  const label =
    isMuted && calibration.offset === 0
      ? `0${calibration.unit}`
      : formatDisplayVolume(displayValue, calibration);

  return {
    displayValue,
    min,
    max,
    barPct,
    label,
    calibrated: isEntityVolumeCalibrated(entity.entity_id, scales),
    calibration,
  };
}

export function createMaxScaleCalibration(rawInput: string): VolumeCalibration | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const hasPercent = trimmed.includes('%');
  const numeric = Number(trimmed.replace(/%/g, '').replace(',', '.').trim());
  if (!Number.isFinite(numeric) || numeric < 5 || numeric > 500) {
    return null;
  }
  const scale =
    Math.abs(numeric - Math.round(numeric)) <= 0.05
      ? Math.round(numeric)
      : Number(numeric.toFixed(1));
  return {
    offset: 0,
    scale,
    unit: hasPercent ? '%' : scale === 100 ? '%' : '',
  };
}

/**
 * Calcule automatiquement l'échelle réelle d'une TV ou d'un Ampli à partir de la valeur
 * actuellement affichée sur l'écran de l'équipement (ex: l'utilisateur saisit "40" pendant que HA remonte 0.50 -> échelle = 80).
 * Supporte aussi la saisie explicite du plafond ("/80", "40/80") et les amplis en dB négatifs ("-40" -> plage -80 dB).
 */
export function computeCalibrationFromObservedValue(
  rawLevel: number | null | undefined,
  rawInput: string,
): VolumeCalibration | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Syntaxe plafond explicite : "/80" ou "max 80" ou "40/80"
  const explicitSlash = trimmed.match(/^(?:max\s*|\/\s*)(\d+(?:[.,]\d+)?)%?$/i);
  if (explicitSlash) {
    return createMaxScaleCalibration(
      trimmed.includes('%') ? `${explicitSlash[1]}%` : explicitSlash[1],
    );
  }
  const ratioSlash = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)%?$/);
  if (ratioSlash) {
    return createMaxScaleCalibration(
      trimmed.includes('%') ? `${ratioSlash[2]}%` : ratioSlash[2],
    );
  }

  if (typeof rawLevel !== 'number' || !Number.isFinite(rawLevel) || rawLevel <= 0.01) {
    return createMaxScaleCalibration(trimmed);
  }

  const hasPercent = trimmed.includes('%');
  const hasDb = /db/i.test(trimmed);
  const numericStr = trimmed.replace(/%|db/gi, '').replace(',', '.').trim();
  const observed = Number(numericStr);
  if (!Number.isFinite(observed)) return null;

  if (observed < 0 || hasDb) {
    // Amplis Home-Cinéma affichant en dB (référence -80 dB à volume_level = 0)
    const offset = -80;
    const rawSpan = (observed - offset) / rawLevel;
    if (rawSpan <= 5 || rawSpan > 200) return null;
    const snappedSpan =
      Math.abs(rawSpan - Math.round(rawSpan)) <= 0.35
        ? Math.round(rawSpan)
        : Number(rawSpan.toFixed(1));
    return {
      offset,
      scale: snappedSpan,
      unit: ' dB',
    };
  }

  if (observed <= 0) return null;

  const rawScale = observed / rawLevel;
  if (rawScale < 5 || rawScale > 500) return null;

  // Compensation de l'arrondi à 2 décimales de certaines intégrations HA (round(vol / max, 2))
  if (Number.isInteger(observed)) {
    let bestStd: number | null = null;
    let bestDiff = Infinity;
    for (const candidate of STANDARD_HARDWARE_SCALES) {
      if (Math.round(rawLevel * candidate) !== observed) continue;
      const diff = Math.abs(observed / candidate - rawLevel);
      if (diff <= 0.006 && diff < bestDiff) {
        bestDiff = diff;
        bestStd = candidate;
      }
    }
    if (bestStd !== null) {
      return {
        offset: 0,
        scale: bestStd,
        unit: hasPercent ? '%' : bestStd === 100 ? '%' : '',
      };
    }
  }

  const nearestInt = Math.round(rawScale);
  const scale =
    Math.abs(rawScale - nearestInt) <= 0.35
      ? nearestInt
      : Number(rawScale.toFixed(1));

  return {
    offset: 0,
    scale,
    unit: hasPercent ? '%' : scale === 100 ? '%' : '',
  };
}
