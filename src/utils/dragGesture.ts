import type React from 'react';

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="switch"], [data-no-drag="true"]';

const DRAG_THRESHOLD_PX = 5;

export interface DragStartCoords {
  clientX: number;
  clientY: number;
}

/**
 * Permet de déplacer la fenêtre depuis n'importe quel point d'une surface :
 * - Sur une zone non interactive (fond, titre, badge, pochette) : déplacement immédiat dès 0 px.
 * - Sur un contrôle interactif (bouton, favori, action) : un clic court déclenche le bouton,
 *   tandis qu'un glisser (>= 5 px) annule le clic et déplace la fenêtre de façon fluide.
 */
export function handleSmartSurfacePointerDown(
  e: React.PointerEvent<HTMLElement>,
  onStartDrag: (coords: DragStartCoords) => void,
): void {
  if (e.button !== 0) return;

  const target = e.target as HTMLElement | null;
  if (target?.closest('[data-no-drag="true"]')) {
    return;
  }

  const interactive = target?.closest(INTERACTIVE_SELECTOR);
  if (!interactive) {
    e.preventDefault();
    onStartDrag({ clientX: e.clientX, clientY: e.clientY });
    return;
  }

  const startClientX = e.clientX;
  const startClientY = e.clientY;

  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', cleanup);
    window.removeEventListener('pointercancel', cleanup);
  };

  const onPointerMove = (ev: PointerEvent) => {
    if ((ev.buttons & 1) === 0) {
      cleanup();
      return;
    }
    const dist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
    if (dist < DRAG_THRESHOLD_PX) return;

    cleanup();

    const suppressNextClick = (clickEv: MouseEvent) => {
      clickEv.preventDefault();
      clickEv.stopPropagation();
      window.removeEventListener('click', suppressNextClick, true);
    };
    window.addEventListener('click', suppressNextClick, true);
    window.setTimeout(() => {
      window.removeEventListener('click', suppressNextClick, true);
    }, 450);

    onStartDrag({ clientX: ev.clientX, clientY: ev.clientY });
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', cleanup);
  window.addEventListener('pointercancel', cleanup);
}
