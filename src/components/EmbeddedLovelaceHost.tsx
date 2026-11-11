import React, { useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { syncLovelaceWebviewNative } from '../services/tauriBridge';

interface EmbeddedLovelaceHostProps {
  url: string;
  active: boolean;
  hideHaHeader: boolean;
}

export const EmbeddedLovelaceHost: React.FC<EmbeddedLovelaceHostProps> = ({
  url,
  active,
  hideHaHeader,
}) => {
  const slotRef = useRef<HTMLDivElement | null>(null);

  const syncGeometry = useCallback(() => {
    const el = slotRef.current;
    if (!el || !active || !url.trim()) {
      void syncLovelaceWebviewNative({
        url: '',
        visible: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        hideHaHeader,
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    // Préserve 5px sur les bords gauche/droit pour les poignées de redimensionnement natives du Flyout
    const x = Math.max(5, Math.round(rect.left) + 4);
    const y = Math.max(1, Math.round(rect.top));
    const width = Math.max(0, Math.round(rect.width) - 8);
    const height = Math.max(0, Math.round(rect.height));

    void syncLovelaceWebviewNative({
      url,
      visible: width >= 40 && height >= 40,
      x,
      y,
      width,
      height,
      hideHaHeader,
    });
  }, [active, hideHaHeader, url]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(syncGeometry);
    // Second tick après l'animation d'ouverture Flyout (180ms) pour un alignement au pixel près
    const settleTimer = window.setTimeout(syncGeometry, 200);

    const el = slotRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        syncGeometry();
      });
      observer.observe(el);
    }

    window.addEventListener('resize', syncGeometry);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', syncGeometry);
    };
  }, [syncGeometry]);

  useEffect(() => {
    return () => {
      void syncLovelaceWebviewNative({
        url: '',
        visible: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        hideHaHeader: false,
      });
    };
  }, []);

  return (
    <div
      ref={slotRef}
      aria-label="Page Lovelace Home Assistant"
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-fluent-base"
    >
      <div className="flex items-center gap-2 text-xs text-fluent-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-fluent-accent" strokeWidth={1.75} />
        <span>Home Assistant</span>
      </div>
    </div>
  );
};
