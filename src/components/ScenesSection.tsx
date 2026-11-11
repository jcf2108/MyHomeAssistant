import React, { useState } from 'react';
import { Check, Play, Sparkles } from 'lucide-react';
import type { HaEntity } from '../types/ha';
import { shortEntityLabel } from '../utils/color';

interface ScenesSectionProps {
  scenes: HaEntity[];
  onActivateScene: (entity: HaEntity) => void;
}

export const ScenesSection: React.FC<ScenesSectionProps> = ({ scenes, onActivateScene }) => {
  const [recentId, setRecentId] = useState<string | null>(null);

  if (scenes.length === 0) {
    return null;
  }

  const handleTrigger = (scene: HaEntity) => {
    onActivateScene(scene);
    setRecentId(scene.entity_id);
    window.setTimeout(() => {
      setRecentId((prev) => (prev === scene.entity_id ? null : prev));
    }, 1100);
  };

  return (
    <section className="px-4 pt-3 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-fluent-ink">Scènes</h2>
        <span className="text-[11px] font-medium text-fluent-secondary tabular-data">
          {scenes.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {scenes.map((scene) => {
          const isScript = scene.entity_id.startsWith('script.');
          const isTriggered = recentId === scene.entity_id;

          return (
            <button
              key={scene.entity_id}
              type="button"
              onClick={() => handleTrigger(scene)}
              title={scene.attributes.friendly_name || scene.entity_id}
              className={`flex h-9 items-center gap-2 rounded-control px-3 text-left text-xs font-medium transition-colors duration-150 ${
                isTriggered
                  ? 'bg-fluent-accent text-fluent-accentInk font-semibold'
                  : 'bg-fluent-elevated text-fluent-ink hover:bg-fluent-hover active:bg-fluent-active'
              }`}
            >
              {isTriggered ? (
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              ) : isScript ? (
                <Play className="h-3.5 w-3.5 shrink-0 text-fluent-accent" strokeWidth={1.75} />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-fluent-accent" strokeWidth={1.75} />
              )}
              <span className="truncate">{shortEntityLabel(scene, 2)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
