import { useEffect, useState } from "react";
import { marketPhase, minsToMarketOpen, istClock } from "../lib/time";

/**
 * Live IST market-session state for the nav pill.
 * Updates every 30s — cheap and never hits the network.
 */
export default function useMarketSession() {
  const [tick, setTick] = useState(() => readSession());

  useEffect(() => {
    const id = setInterval(() => setTick(readSession()), 30_000);
    return () => clearInterval(id);
  }, []);

  return tick;
}

function readSession() {
  const now = new Date();
  const phase = marketPhase(now);
  const mins = minsToMarketOpen(now);
  const clock = istClock(now);
  let label = "";
  if (phase === "weekend") label = "Markets closed";
  else if (phase === "premarket") {
    if (mins != null && mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      label = `Pre-market · opens in ${timeStr}`;
    } else {
      label = "Pre-market";
    }
  }
  else if (phase === "live") label = `Live · ${clock} IST`;
  else label = "After hours";
  return { phase, mins, clock, label };
}
