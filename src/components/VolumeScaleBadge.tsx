import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';

interface VolumeScaleBadgeProps {
  label: string;
  displayValue: number;
  maxScale: number;
  rawVolumeLevel: number | null;
  calibrated: boolean;
  onCalibrate: (rawInput: string) => boolean;
  onReset: () => void;
}

export const VolumeScaleBadge: React.FC<VolumeScaleBadgeProps> = ({
  label,
  displayValue,
  maxScale,
  rawVolumeLevel,
  calibrated,
  onCalibrate,
  onReset,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canObserveLive = typeof rawVolumeLevel === 'number' && rawVolumeLevel > 0.01;

  const openEditor = () => {
    setDraft(canObserveLive ? String(displayValue) : String(Math.round(maxScale)));
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onCalibrate(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={containerRef}
        data-no-drag="true"
        onWheel={(e) => e.stopPropagation()}
        onBlur={(e) => {
          if (containerRef.current?.contains(e.relatedTarget as Node | null)) {
            return;
          }
          setEditing(false);
        }}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-control border border-fluent-accent/60 bg-fluent-base px-1 py-0.5"
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          aria-label={canObserveLive ? 'Valeur réelle TV / Ampli' : 'Volume max appareil'}
          placeholder={canObserveLive ? 'Réel' : 'Max'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className="w-10 bg-transparent text-right text-[11px] font-semibold text-fluent-ink tabular-data focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          aria-label="Valider l'étalonnage"
          title="Valider"
          className="flex h-5 w-5 items-center justify-center rounded text-fluent-accent transition-colors hover:bg-fluent-accent/15"
        >
          <Check className="h-3 w-3" strokeWidth={2.25} />
        </button>
        {calibrated && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onReset();
              setEditing(false);
            }}
            aria-label="Réinitialiser 100%"
            title="100%"
            className="flex h-5 w-5 items-center justify-center rounded text-fluent-secondary transition-colors hover:bg-white/10 hover:text-fluent-ink"
          >
            <RotateCcw className="h-2.5 w-2.5" strokeWidth={2} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-no-drag="true"
      onClick={openEditor}
      aria-label={`Étalonner le volume (${label})`}
      title="Cliquer pour étalonner (valeur TV / Ampli)"
      className={`min-w-[38px] shrink-0 rounded-control border px-1.5 py-0.5 text-right text-[11px] font-semibold tabular-data transition-colors ${
        calibrated
          ? 'border-fluent-accent/35 bg-fluent-accent/10 text-fluent-accent hover:border-fluent-accent/60'
          : 'border-white/[0.08] bg-fluent-elevated text-fluent-ink hover:border-fluent-accent/45 hover:text-fluent-accent'
      }`}
    >
      {label}
    </button>
  );
};
