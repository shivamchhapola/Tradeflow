import { useEffect, useRef } from "react";

/**
 * Visibility-aware polling.
 * Calls `fn` immediately, then every `intervalMs` while the tab is visible.
 * Pauses (clears the interval) when the tab is hidden, resumes on visibility return
 * — halves NSE/Ollama load when the user steps away.
 *
 * @param {() => void} fn      Callback to invoke on each tick.
 * @param {number} intervalMs  Tick interval in ms.
 * @param {boolean} enabled    Switch the entire poll on/off.
 */
export default function usePolling(fn, intervalMs, enabled = true) {
  const fnRef = useRef(fn);
  
  // React 19: Refs should be updated in effects, not during render
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return undefined;
    let id = null;

    const start = () => {
      if (id != null) return;
      fnRef.current?.();
      id = setInterval(() => {
        fnRef.current?.();
      }, intervalMs);
    };

    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
