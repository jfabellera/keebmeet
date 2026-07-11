import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll position per history entry (react-router's `location.key`). Module
 * scope so positions outlive page remounts for the lifetime of the tab.
 */
const scrollPositions = new Map<string, number>();

/**
 * How long to keep re-trying a restore while the page's content is still
 * loading (a short page can't be scrolled to the saved offset yet).
 */
const RESTORE_WINDOW_MS = 2000;

/**
 * Restores an inner scroll container's position on browser back/forward.
 *
 * The app scrolls inside a container (the window never scrolls), so the
 * browser's native scroll restoration can't help. This hook records the
 * container's position per history entry and restores it on POP navigations.
 * PUSH/REPLACE navigations are deliberately left alone: a freshly mounted
 * container already starts at the top, and when the container survives the
 * navigation (e.g. the homepage behind the meetup modal, where both routes
 * render the same element) its position should be preserved, not reset.
 */
export const useScrollRestoration = <T extends HTMLElement>(): RefObject<
  T | null
> => {
  const ref = useRef<T>(null);
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // Record the position for the current entry as the user scrolls.
  useEffect(() => {
    const el = ref.current;
    if (el == null) return;
    const onScroll = (): void => {
      scrollPositions.set(keyRef.current, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const saved = scrollPositions.get(key);
    if (el == null || navigationType !== 'POP' || saved == null) return;

    let cancelled = false;
    const started = performance.now();
    // The assignment clamps while the content is shorter than the saved
    // offset (e.g. a query is still loading), so retry until it sticks, the
    // user scrolls themselves, or the window elapses.
    const attempt = (): void => {
      if (cancelled) return;
      el.scrollTop = saved;
      if (Math.abs(el.scrollTop - saved) < 1) return;
      if (performance.now() - started > RESTORE_WINDOW_MS) return;
      requestAnimationFrame(attempt);
    };
    attempt();

    const cancel = (): void => {
      cancelled = true;
    };
    el.addEventListener('wheel', cancel, { passive: true });
    el.addEventListener('touchstart', cancel, { passive: true });
    return () => {
      cancelled = true;
      el.removeEventListener('wheel', cancel);
      el.removeEventListener('touchstart', cancel);
    };
  }, [key, navigationType]);

  return ref;
};
