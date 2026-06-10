import { useLayoutEffect, useRef } from "react";

/**
 * useAnimatedSize — smoothly animate an element's height when its content
 * changes between renders.
 *
 * Implementation: Web Animations API (`element.animate(...)`).
 *
 * Why not CSS transitions?
 *   The CSS-transition + FLIP pattern (pin old height → rAF → set new
 *   height with transition) depends on the browser keeping two distinct
 *   style snapshots between which it can interpolate. Browsers can — and
 *   sometimes do — coalesce the two writes if they both happen within the
 *   same JavaScript turn, especially under React 18 concurrent updates.
 *   The result is the transition silently doesn't play and the user sees
 *   a snap.
 *
 *   The Web Animations API has no such issue. We hand it explicit `from`
 *   and `to` keyframes; the browser always animates between them, regardless
 *   of what state the DOM is in afterwards.
 *
 * How it works:
 *   - In `useLayoutEffect` (sync, before paint), measure the new natural
 *     height. We have to clear any inline height we may have left from a
 *     previous animation, otherwise we'd just read back the pinned value.
 *   - If a previous height was recorded and differs, call
 *     `el.animate([{height: oldPx}, {height: newPx}], { duration, easing })`.
 *   - Set `overflow: hidden` for the animation duration so child content
 *     doesn't visually overflow during the transition; clear it on finish.
 *
 * Constraints on the host element:
 *   - Will have `overflow: hidden` applied during the animation. If the
 *     element has children that visually overflow (tooltips that escape the
 *     card, dropdown menus, etc.), they'll be clipped briefly. For
 *     Tradeflow's `.card` containers this is fine.
 *
 * Edge cases:
 *   - First commit: nothing to animate from. Just record the height.
 *   - Same height: no animation, no inline styles touched.
 *   - prefers-reduced-motion: hook is a no-op (still records heights so
 *     that future content changes have a baseline once motion is restored).
 *   - Animation interrupted by a new content change: cancel the previous
 *     animation cleanly and start a new one from the current visible
 *     height (whatever the previous animation had reached).
 *   - Element unmounts mid-animation: ref cleanup cancels animation.
 *
 * Usage:
 *   const ref = useRef(null);
 *   useAnimatedSize(ref);
 *   <div ref={ref}>...content that changes...</div>
 */
export default function useAnimatedSize(
  ref,
  {
    duration = 420,
    easing = "cubic-bezier(0.22, 1, 0.36, 1)", // gentle ease-out
  } = {},
) {
  const prevHeight = useRef(null);
  const animationRef = useRef(null);

  useLayoutEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // If a previous animation is still running, capture the height the
    // user is currently seeing — that's the new "from" value. Cancel it so
    // we don't have two animations fighting.
    let visibleHeight = null;
    if (animationRef.current) {
      visibleHeight = el.getBoundingClientRect().height;
      try {
        animationRef.current.cancel();
      } catch {
        // already finished
      }
      animationRef.current = null;
    }

    // Clear any inline height we set on a previous animation finish. If we
    // don't, `offsetHeight` would just return the pinned value instead of
    // the real natural height after content change.
    el.style.height = "";
    el.style.overflow = "";

    const newHeight = el.offsetHeight;
    const fromHeight = visibleHeight ?? prevHeight.current;

    // Update the recorded height regardless of whether we animate.
    prevHeight.current = newHeight;

    // First commit ever, or no real change → nothing to animate.
    if (fromHeight == null) return;
    if (Math.abs(newHeight - fromHeight) < 1) return;
    if (prefersReducedMotion) return;

    // Hide overflow during the animation so children don't visually
    // protrude past the animated bounds.
    el.style.overflow = "hidden";

    const animation = el.animate(
      [{ height: `${fromHeight}px` }, { height: `${newHeight}px` }],
      { duration, easing, fill: "none" },
    );
    animationRef.current = animation;

    animation.onfinish = () => {
      el.style.overflow = "";
      if (animationRef.current === animation) animationRef.current = null;
    };
    animation.oncancel = () => {
      // Don't clear overflow on cancel — the next animation just took
      // over and will manage it.
    };
  });

  // Final cleanup on unmount.
  useLayoutEffect(() => {
    return () => {
      if (animationRef.current) {
        try {
          animationRef.current.cancel();
        } catch {
          /* ignore */
        }
        animationRef.current = null;
      }
    };
  }, []);
}
