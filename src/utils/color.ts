import type { HaEntity } from '../types/ha';

export const RGB_PRESETS: Array<{ label: string; rgb: [number, number, number]; hex: string }> = [
  { label: 'Chaud', rgb: [255, 180, 92], hex: '#ffb45c' },
  { label: 'Ambre', rgb: [251, 191, 36], hex: '#fbbf24' },
  { label: 'Corail', rgb: [248, 113, 113], hex: '#f87171' },
  { label: 'Azur', rgb: [56, 189, 248], hex: '#38bdf8' },
  { label: 'Menthe', rgb: [52, 211, 153], hex: '#34d399' },
  { label: 'Lilas', rgb: [192, 132, 252], hex: '#c084fc' },
];

export function kelvinToHex(kelvin = 3200): string {
  const clamped = Math.max(2000, Math.min(6500, kelvin));
  const ratio = (clamped - 2000) / (6500 - 2000);
  // Smooth interpolation from warm candle amber (#ffb14a) through neutral (#ffe8c8) to cool daylight (#9bd8ff)
  if (ratio < 0.5) {
    const t = ratio * 2;
    const r = Math.round(255);
    const g = Math.round(177 + (228 - 177) * t);
    const b = Math.round(74 + (198 - 74) * t);
    return rgbToHex(r, g, b);
  }
  const t = (ratio - 0.5) * 2;
  const r = Math.round(255 + (155 - 255) * t);
  const g = Math.round(228 + (216 - 228) * t);
  const b = Math.round(198 + (255 - 198) * t);
  return rgbToHex(r, g, b);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getLightVisualColor(entity: HaEntity): string {
  if (entity.state !== 'on') {
    return '#60a5fa';
  }
  const rgb = entity.attributes.rgb_color;
  if (Array.isArray(rgb) && rgb.length === 3 && entity.attributes.color_mode !== 'color_temp') {
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  if (typeof entity.attributes.color_temp_kelvin === 'number') {
    return kelvinToHex(entity.attributes.color_temp_kelvin);
  }
  return '#fbbf24';
}

export function supportsRgbColor(entity: HaEntity): boolean {
  const modes = entity.attributes.supported_color_modes;
  if (!Array.isArray(modes)) return false;
  return modes.some((m) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m));
}

export function supportsColorTemp(entity: HaEntity): boolean {
  const modes = entity.attributes.supported_color_modes;
  if (!Array.isArray(modes)) return typeof entity.attributes.color_temp_kelvin === 'number';
  return modes.includes('color_temp');
}

export function shortEntityLabel(entity: HaEntity, maxWords = 2): string {
  const raw = (entity.attributes.friendly_name || entity.entity_id.split('.')[1] || entity.entity_id)
    .replace(/_/g, ' ')
    .trim();
  const words = raw.split(/\s+/);
  if (words.length <= maxWords) return raw;
  return words.slice(0, maxWords).join(' ');
}
