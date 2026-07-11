import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

// Movement (px) before a downward pointer gesture counts as a swipe rather
// than a jitter or a tap.
const SWIPE_SLOP = 8;
// A drag past this distance, or a quick flick faster than this velocity,
// dismisses on release.
const SWIPE_DISMISS_OFFSET = 120;
const SWIPE_DISMISS_VELOCITY = 0.5; // px per ms
const SWIPE_SPRING_BACK = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
const SWIPE_DISMISS_TRANSITION =
  'transform 0.25s ease-out, opacity 0.25s ease-out';
const OVERLAY_DISMISS_TRANSITION = 'opacity 0.25s ease-out';
const OVERLAY_SPRING_BACK = 'opacity 0.2s ease-out';

interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface UseSwipeToDismissOptions {
  /** When false, no handlers are returned and the gesture is inert. */
  enabled: boolean;
  /** Called once the user swipes far/fast enough to dismiss. */
  onDismiss: () => void;
}

// A downward pull is only a dismiss when nothing between the pointer and the
// dragged element is scrolled away from its top — otherwise it's a scroll.
const isScrolledToTop = (
  target: EventTarget | null,
  root: HTMLElement
): boolean => {
  let el = target instanceof HTMLElement ? target : null;
  while (el != null && el !== root) {
    if (el.scrollTop > 0) return false;
    el = el.parentElement;
  }
  return true;
};

/**
 * Swipe-down-to-dismiss gesture, intended for full-screen-ish dialogs on touch.
 *
 * Spread the returned handlers onto the element that should follow the finger
 * (typically the dialog content). The gesture is driven imperatively on that
 * element's own node, so dragging never re-renders the caller. It only engages
 * on a downward pull that starts at the top of the scrollable region, so it
 * never steals a scroll.
 *
 * Centering is left to the element's own layout; the handlers add a
 * `translateY` offset on top, so the two compose rather than fight.
 *
 * Returns `undefined` when `enabled` is false so the handlers can be spread
 * directly (`<El {...swipe} />`) with no effect.
 */
export const useSwipeToDismiss = ({
  enabled,
  onDismiss,
}: UseSwipeToDismissOptions): SwipeHandlers | undefined => {
  const state = useRef({
    card: null as HTMLElement | null,
    overlays: [] as HTMLElement[],
    active: false,
    dragging: false,
    startY: 0,
    startTime: 0,
  });

  if (!enabled) return undefined;

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    state.current = {
      card: event.currentTarget,
      overlays: [],
      active: true,
      dragging: false,
      startY: event.clientY,
      startTime: event.timeStamp,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const s = state.current;
    if (!s.active || s.card == null) return;
    const dy = event.clientY - s.startY;

    if (!s.dragging) {
      // Decide once, on the first meaningful movement, whether this gesture is
      // ours (downward, at the top) or belongs to the native scroll.
      if (dy > SWIPE_SLOP && isScrolledToTop(event.target, s.card)) {
        s.dragging = true;
        s.card.style.transition = 'none';
        // Grab the backdrop(s) so they can fade in step with the drag.
        s.overlays = Array.from(
          document.querySelectorAll<HTMLElement>('[data-slot="dialog-overlay"]')
        );
        s.overlays.forEach((overlay) => (overlay.style.transition = 'none'));
      } else if (dy > SWIPE_SLOP || dy < -SWIPE_SLOP) {
        s.active = false;
        return;
      } else {
        return;
      }
    }

    const offset = Math.max(0, dy - SWIPE_SLOP);
    s.card.style.transform = `translateY(${offset}px)`;
    // Fade the backdrop out as the card travels toward the bottom of the
    // viewport, so it's gone by the time a full swipe would clear the screen.
    const opacity = String(1 - Math.min(offset / window.innerHeight, 1));
    s.overlays.forEach((overlay) => (overlay.style.opacity = opacity));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    const s = state.current;
    state.current = { ...s, active: false, dragging: false };
    const card = s.card;
    if (!s.dragging || card == null) return;

    const dy = event.clientY - s.startY;
    const dt = event.timeStamp - s.startTime;
    const velocity = dt > 0 ? dy / dt : 0;

    if (dy > SWIPE_DISMISS_OFFSET || velocity > SWIPE_DISMISS_VELOCITY) {
      card.style.animation = 'none';
      card.style.transition = SWIPE_DISMISS_TRANSITION;
      card.style.transform = `translateY(${window.innerHeight}px)`;
      card.style.opacity = '0';
      // Finish fading the backdrop out alongside the card. `animation: none`
      // keeps its own close animation from restarting it at full opacity.
      s.overlays.forEach((overlay) => {
        overlay.style.animation = 'none';
        overlay.style.transition = OVERLAY_DISMISS_TRANSITION;
        overlay.style.opacity = '0';
      });
      const finish = (transitionEvent: TransitionEvent): void => {
        if (transitionEvent.propertyName !== 'transform') return;
        card.removeEventListener('transitionend', finish);
        onDismiss();
      };
      card.addEventListener('transitionend', finish);
    } else {
      card.style.transition = SWIPE_SPRING_BACK;
      card.style.transform = 'translateY(0px)';
      s.overlays.forEach((overlay) => {
        overlay.style.transition = OVERLAY_SPRING_BACK;
        overlay.style.opacity = '';
      });
      const clear = (): void => {
        card.style.transition = '';
        card.style.transform = '';
        s.overlays.forEach((overlay) => {
          overlay.style.transition = '';
        });
        card.removeEventListener('transitionend', clear);
      };
      card.addEventListener('transitionend', clear);
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
};
