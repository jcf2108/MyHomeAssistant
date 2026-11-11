import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { HaEntity } from '../types/ha';
import {
  getLightVisualColor,
  kelvinToHex,
  RGB_PRESETS,
  rgbToHex,
  shortEntityLabel,
  supportsColorTemp,
  supportsRgbColor,
} from '../utils/color';

interface LightsSectionProps {
  lights: HaEntity[];
  onToggleLight: (entityId: string) => void;
  onBrightnessChange: (entityId: string, pct: number) => void;
  onColorTempChange: (entityId: string, kelvin: number) => void;
  onRgbChange: (entityId: string, rgb: [number, number, number]) => void;
}

export const LightsSection: React.FC<LightsSectionProps> = ({
  lights,
  onToggleLight,
  onBrightnessChange,
  onColorTempChange,
  onRgbChange,
}) => {
  const [openColorId, setOpenColorId] = useState<string | null>(null);

  if (lights.length === 0) {
    return null;
  }

  const onCount = lights.filter((l) => l.state === 'on').length;

  return (
    <section className="px-3.5 pt-2 pb-2.5 border-b border-white/[0.06]">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-xs font-semibold text-fluent-ink">Lumières</h2>
        <span className="text-[11px] font-medium text-fluent-secondary tabular-data">
          {onCount}/{lights.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {lights.map((light) => {
          const isOn = light.state === 'on';
          const isUnavailable = light.state === 'unavailable';
          const rawBri =
            typeof light.attributes.brightness === 'number' ? light.attributes.brightness : 204;
          const briPct = isOn ? Math.max(1, Math.round((rawBri / 255) * 100)) : 0;
          const activeTint = getLightVisualColor(light);
          const hasTemp = supportsColorTemp(light);
          const hasRgb = supportsRgbColor(light);
          const isColorExpanded = openColorId === light.entity_id;
          const minK = light.attributes.min_color_temp_kelvin ?? 2200;
          const maxK = light.attributes.max_color_temp_kelvin ?? 6500;
          const curK = light.attributes.color_temp_kelvin ?? 3200;
          const kelvinPct = Math.round(((curK - minK) / Math.max(1, maxK - minK)) * 100);

          const storedSwatch =
            Array.isArray(light.attributes.rgb_color) &&
            light.attributes.rgb_color.length === 3 &&
            light.attributes.color_mode === 'rgb'
              ? rgbToHex(
                  light.attributes.rgb_color[0],
                  light.attributes.rgb_color[1],
                  light.attributes.rgb_color[2],
                )
              : kelvinToHex(curK);

          return (
            <div
              key={light.entity_id}
              className="rounded-control bg-fluent-elevated px-2.5 py-1.5 transition-colors duration-150 hover:bg-fluent-hover"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => onToggleLight(light.entity_id)}
                  aria-label={`Basculer ${light.attributes.friendly_name || light.entity_id}`}
                  style={isOn ? { backgroundColor: activeTint, color: '#09111e' } : undefined}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control transition-colors duration-150 ${
                    isOn
                      ? 'shadow-sm'
                      : 'bg-[#1f232c] text-fluent-secondary hover:text-fluent-ink'
                  } disabled:opacity-40`}
                >
                  <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-fluent-ink">
                      {shortEntityLabel(light, 2)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {(hasTemp || hasRgb) && !isUnavailable && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenColorId((prev) =>
                              prev === light.entity_id ? null : light.entity_id,
                            )
                          }
                          aria-label="Température et couleur"
                          aria-expanded={isColorExpanded}
                          className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-medium tabular-data transition-colors duration-150 ${
                            isColorExpanded
                              ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
                              : 'bg-[#1e222b] text-fluent-secondary hover:text-fluent-ink'
                          }`}
                        >
                          <span
                            style={{ backgroundColor: storedSwatch }}
                            className="h-2 w-2 rounded-full border border-white/25"
                          />
                          <span>{hasTemp ? `${curK}K` : 'RVB'}</span>
                        </button>
                      )}

                      <span className="w-9 text-right text-[11px] font-medium text-fluent-secondary tabular-data">
                        {isUnavailable ? 'Off' : isOn ? `${briPct}%` : 'Éteint'}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={briPct}
                    disabled={isUnavailable}
                    aria-label={`Luminosité ${light.attributes.friendly_name || light.entity_id}`}
                    onChange={(e) => onBrightnessChange(light.entity_id, Number(e.target.value))}
                    style={
                      {
                        '--slider-pct': `${briPct}%`,
                        '--slider-fill': isOn ? activeTint : '#525b6c',
                      } as React.CSSProperties
                    }
                    className="fluent-range block"
                  />
                </div>
              </div>

              {isColorExpanded && (hasTemp || hasRgb) && (
                <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
                  {hasTemp && (
                    <div className="flex items-center gap-2">
                      <span className="w-11 text-[11px] text-fluent-secondary tabular-data">
                        {curK}K
                      </span>
                      <input
                        type="range"
                        min={minK}
                        max={maxK}
                        step={100}
                        value={curK}
                        aria-label="Température Kelvin"
                        onChange={(e) => onColorTempChange(light.entity_id, Number(e.target.value))}
                        style={
                          {
                            '--slider-pct': `${kelvinPct}%`,
                            '--slider-fill': '#fbbf24',
                          } as React.CSSProperties
                        }
                        className="fluent-range flex-1"
                      />
                    </div>
                  )}

                  {hasRgb && (
                    <div className="flex items-center justify-between gap-1.5">
                      {RGB_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onRgbChange(light.entity_id, preset.rgb)}
                          title={preset.label}
                          aria-label={preset.label}
                          style={{ backgroundColor: preset.hex }}
                          className="h-5 flex-1 rounded-full border border-white/20 transition-transform duration-150 hover:scale-105 active:scale-95"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
