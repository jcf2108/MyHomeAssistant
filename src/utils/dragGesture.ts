import type React from 'react';

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="switch"], [data-no-drag="true"]';

const DRAG_THRESHOLD_PX = 4;
const HOLD_TO_DRAG_MS = 200;
const POST_RELEASE_SUPPRESS_MS = 400;

export interface DragStartCoords {
  clientX: number;
  clientY: number;
}

let currentGestureId = 0;
let activeDragGestureId = 0;
let suppressClicksUntil = 0;
let globalGuardInstalled = false;

function ensureGlobalClickGuard(): void {
  if (globalGuardInstalled || typeof window === 'undefined') return;
  globalGuardInstalled = true;

  const blockPostDragClick = (ev: MouseEvent) => {
    if (activeDragGestureId !== 0 || performance.now() < suppressClicksUntil) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if (activeDragGestureId === 0 && ev.type === 'click') {
        // Une fois le clic résiduel du relâchement absorbé, réautorise immédiatement le clic suivant
        suppressClicksUntil = 0;
      }
    }
  };

  window.addEventListener('click', blockPostDragClick, true);
  window.addEventListener('dblclick', blockPostDragClick, true);
  window.addEventListener('auxclick', blockPostDragClick, true);
}

function armDragHoldSession(
  gestureId: number,
  maybeAsyncDrag: Promise<unknown> | void,
): void {
  if (typeof window === 'undefined') return;

  activeDragGestureId = gestureId;
  suppressClicksUntil = Number.POSITIVE_INFINITY;
  document.documentElement.classList.add('is-dragging-window');

  const hasNativePromise = Boolean(
    maybeAsyncDrag && typeof (maybeAsyncDrag as Promise<unknown>).finally === 'function',
  );

  const cleanupListeners = () => {
    window.removeEventListener('pointerup', onDomRelease, true);
    window.removeEventListener('mouseup', onDomRelease, true);
    window.removeEventListener('pointercancel', onDomRelease, true);
    if (!hasNativePromise) {
      window.removeEventListener('blur', onDomRelease);
    }
  };

  const settleRelease = () => {
    cleanupListeners();
    if (currentGestureId !== gestureId) return;
    activeDragGestureId = 0;
    suppressClicksUntil = performance.now() + POST_RELEASE_SUPPRESS_MS;
    document.documentElement.classList.remove('is-dragging-window');
  };

  const onDomRelease = () => {
    settleRelease();
  };

  window.addEventListener('pointerup', onDomRelease, true);
  window.addEventListener('mouseup', onDomRelease, true);
  window.addEventListener('pointercancel', onDomRelease, true);
  if (!hasNativePromise) {
    window.addEventListener('blur', onDomRelease);
  } else {
    void (maybeAsyncDrag as Promise<unknown>).finally(() => {
      settleRelease();
    });
  }
}

/**
 * Permet de déplacer la fenêtre depuis n'importe quel point d'une surface sans jamais
 * déclencher de bouton ou de raccourci par erreur :
 * - Sur une zone non interactive : déplacement immédiat dès 0 px + protection anti-clic au relâchement.
 * - Sur un bouton / raccourci :
 *   • un clic court (< 200 ms et < 4 px) active normalement le bouton ;
 *   • un maintien du clic (>= 200 ms) OU un glisser (>= 4 px) bascule en déplacement de fenêtre
 *     et bloque 100 % du `click` final quelle que soit la durée du déplacement.
 */
export function handleSmartSurfacePointerDown(
  e: React.PointerEvent<HTMLElement>,
  onStartDrag: (coords: DragStartCoords) => Promise<unknown> | void,
): void {
  if (e.button !== 0) return;

  ensureGlobalClickGuard();
  const gestureId = ++currentGestureId;
  if (activeDragGestureId === 0) {
    suppressClicksUntil = 0;
  }

  const target = e.target as HTMLElement | null;
  if (target?.closest('[data-no-drag="true"]')) {
    return;
  }

  const interactive = target?.closest(INTERACTIVE_SELECTOR);
  if (!interactive) {
    e.preventDefault();
    const dragResult = onStartDrag({ clientX: e.clientX, clientY: e.clientY });
    armDragHoldSession(gestureId, dragResult);
    return;
  }

  const startClientX = e.clientX;
  const startClientY = e.clientY;
  const startScreenX = e.screenX;
  const startScreenY = e.screenY;
  let lastClientX = e.clientX;
  let lastClientY = e.clientY;
  let dragTriggered = false;
  let holdTimer: number | null = null;

  const cleanupPreDrag = () => {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', cleanupPreDrag, true);
    window.removeEventListener('mouseup', cleanupPreDrag, true);
    window.removeEventListener('pointercancel', cleanupPreDrag, true);
  };

  const triggerDragFromControl = (clientX: number, clientY: number) => {
    if (dragTriggered || currentGestureId !== gestureId) return;
    dragTriggered = true;
    cleanupPreDrag();
    const dragResult = onStartDrag({ clientX, clientY });
    armDragHoldSession(gestureId, dragResult);
  };

  holdTimer = window.setTimeout(() => {
    triggerDragFromControl(lastClientX, lastClientY);
  }, HOLD_TO_DRAG_MS);

  const onPointerMove = (ev: PointerEvent) => {
    if ((ev.buttons & 1) === 0) {
      cleanupPreDrag();
      return;
    }
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;

    const clientDist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
    const screenDist = Math.hypot(ev.screenX - startScreenX, ev.screenY - startScreenY);
    if (Math.max(clientDist, screenDist) < DRAG_THRESHOLD_PX) return;

    triggerDragFromControl(ev.clientX, ev.clientY);
  };

  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', cleanupPreDrag, true);
  window.addEventListener('mouseup', cleanupPreDrag, true);
  window.addEventListener('pointercancel', cleanupPreDrag, true);
}
