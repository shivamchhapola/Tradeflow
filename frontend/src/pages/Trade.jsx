import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Table, Activity } from "lucide-react";

import { closeTrade, createTrade, getOpenTrades, getOptionChain, getSettings } from "../api";
import OpenPositions from "../components/trade/OpenPositions";
import OptionPremiumChart from "../components/trade/OptionPremiumChart";
import OptionChain from "../components/trade/OptionChain";
import TradeHeader from "../components/trade/TradeHeader";
import TradeTicket from "../components/trade/TradeTicket";
import { LOT_SIZES } from "../components/trade/tradeConstants";
import { invalidateStats } from "../hooks/useStats";
import usePageTitle from "../hooks/usePageTitle";
import { marketPhase } from "../lib/time";

const SYMBOL = "NIFTY";

export default function Trade() {
  const [chain, setChain] = useState(null);
  const [chainFetchedAt, setChainFetchedAt] = useState(null);
  const [chainError, setChainError] = useState("");
  const [chainLoading, setChainLoading] = useState(false);
  const [openTrades, setOpenTrades] = useState([]);
  const [chartRefreshToken, setChartRefreshToken] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(15_000);
  const [activeTab, setActiveTab] = useState("chain"); // "chain" | "positions"

  const [chartContract, setChartContract] = useState({
    isIndex: true,
    symbol: "NIFTY",
    name: "NIFTY 50",
  });
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [, startTransition] = useTransition();

  usePageTitle("Trade");

  useEffect(() => {
    getSettings()
      .then((s) => {
        const oci = s?.data_sources?.option_chain_interval;
        if (oci && !isNaN(oci)) {
          setRefreshInterval(Math.max(5, oci) * 1000);
        }
      })
      .catch(() => {});
  }, []);

  const loadOpenTrades = useCallback(async () => {
    try {
      setOpenTrades(await getOpenTrades());
    } catch {
      // Auth expiry is handled by the API interceptor.
    }
  }, []);

  const fetchChain = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setChainLoading(true);
    if (!silent) setChainError("");

    try {
      const data = await getOptionChain(SYMBOL);
      startTransition(() => {
        setChain(data);
        setChainFetchedAt(data?.fetched_at || new Date().toISOString());
      });
    } catch (err) {
      const msg = err.response?.data?.detail || "Couldn't fetch option chain.";
      setChainError(msg);
      if (!silent) toast.error(msg);
    } finally {
      if (!silent) setChainLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchChain();
    setChartRefreshToken((t) => t + 1);
  }, [fetchChain]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  useEffect(() => {
    if (marketPhase(new Date()) !== "live") return undefined;

    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchChain({ silent: true });
        setChartRefreshToken((t) => t + 1);
      }
    }, refreshInterval);

    return () => clearInterval(id);
  }, [fetchChain]);

  useEffect(() => {
    loadOpenTrades();
  }, [loadOpenTrades]);

  // Re-poll open trades every 30s during market hours so SL/target
  // auto-closes (triggered by the backend scheduler) show up without
  // the user needing to manually refresh.
  useEffect(() => {
    if (marketPhase(new Date()) !== "live") return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadOpenTrades();
    }, 15_000);
    return () => clearInterval(id);
  }, [loadOpenTrades]);

  /**
   * Check every open trade against the freshly-arrived chain LTPs.
   * Fires whenever chain updates (every 30s during market hours).
   * This replaces the old backend scheduler approach — same data, zero delay.
   */
  useEffect(() => {
    if (!chain?.strikes?.length || !openTrades.length) return;

    // Build a fast LTP lookup: { "NIFTY 23700 CE": 145.5, ... }
    const ltpMap = {};
    for (const s of chain.strikes) {
      if (s.ce_ltp > 0) ltpMap[`NIFTY ${s.strike} CE`] = s.ce_ltp;
      if (s.pe_ltp > 0) ltpMap[`NIFTY ${s.strike} PE`] = s.pe_ltp;
    }

    let anyHit = false;
    for (const trade of openTrades) {
      const ltp = ltpMap[trade.instrument];
      if (!ltp) continue;

      const { direction, stop_loss: sl, target, id, instrument } = trade;
      let reason = null;

      if (direction === "BUY") {
        if (sl && ltp <= sl)     reason = "stop_hit";
        else if (target && ltp >= target) reason = "target_hit";
      } else {
        if (sl && ltp >= sl)     reason = "stop_hit";
        else if (target && ltp <= target) reason = "target_hit";
      }

      if (reason) {
        anyHit = true;
        closeTrade(id, ltp, reason)
          .then(() => {
            const label = reason === "stop_hit" ? "🛑 SL hit" : "🎯 Target hit";
            toast[reason === "stop_hit" ? "error" : "success"](
              `${label} — ${instrument} closed at ₹${ltp.toFixed(2)}`
            );
            invalidateStats();
          })
          .catch((err) => {
            // 404 = already closed by backend scheduler (race) — safe to ignore
            if (err.response?.status !== 404)
              console.warn("Auto-close trade error:", err);
          });
      }
    }

    if (anyHit) loadOpenTrades();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  const handleSelectChart = useCallback((strikeData, type) => {
    setChartContract({
      symbol: SYMBOL,
      strike: strikeData.strike,
      type,
      identifier:
        type === "CE" ? strikeData.ce_identifier : strikeData.pe_identifier,
    });
  }, []);

  const handleResetToIndexChart = useCallback(() => {
    setChartContract({
      isIndex: true,
      symbol: "NIFTY",
      name: "NIFTY 50",
    });
  }, []);

  const handleBuyClick = useCallback((strikeData, type) => {
    // Open the trade ticket modal. TradeTicket handles zero/missing LTP gracefully.
    setSelectedStrike({ ...strikeData, type, initialDirection: "BUY" });
  }, []);

  const handleSellClick = useCallback((strikeData, type) => {
    setSelectedStrike({ ...strikeData, type, initialDirection: "SELL" });
  }, []);

  const handlePlace = useCallback(
    async (tradeData) => {
      setSubmitting(true);
      try {
        await createTrade(tradeData);
        toast.success("Trade placed successfully.");
        setSelectedStrike(null);
        invalidateStats();
        loadOpenTrades();
        setActiveTab("positions"); // Auto switch to Open Positions tab to view the order
      } catch (err) {
        toast.error(
          err.response?.data?.detail || "Trade failed. Check backend.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [loadOpenTrades],
  );

  return (
    <div className="trade-container">
      <TradeHeader
        chain={chain}
        chainLoading={chainLoading}
        chainFetchedAt={chainFetchedAt}
        showChart={showChart}
        onToggleChart={() => setShowChart((v) => !v)}
        onRefresh={refreshAll}
      />

      <div className={`trade-body ${showChart ? "with-chart" : "no-chart"}`}>
        {showChart && (
          <div className="trade-chart-panel">
            <OptionPremiumChart
              contract={chartContract}
              onResetToIndex={handleResetToIndexChart}
              refreshToken={chartRefreshToken}
              spotPrice={chain?.underlying ?? null}
            />
          </div>
        )}

        <div className="trade-chain-panel">
          <div className="trade-panel-tabs">
            <button
              type="button"
              className={`trade-panel-tab ${activeTab === "chain" ? "active" : ""}`}
              onClick={() => setActiveTab("chain")}
            >
              <Table size={14} />
              <span>Option Chain</span>
            </button>
            <button
              type="button"
              className={`trade-panel-tab ${activeTab === "positions" ? "active" : ""}`}
              onClick={() => setActiveTab("positions")}
            >
              <Activity size={14} />
              <span>Open Positions</span>
              {openTrades.length > 0 && (
                <span className="trade-tab-badge">{openTrades.length}</span>
              )}
            </button>
          </div>

          {activeTab === "chain" ? (
            <OptionChain
              chain={chain}
              error={chainError}
              loading={chainLoading}
              symbol={SYMBOL}
              onSelectChart={handleSelectChart}
              onBuyClick={handleBuyClick}
              onSellClick={handleSellClick}
              chartContract={chartContract}
            />
          ) : (
            <OpenPositions
              trades={openTrades}
              onTradesChange={loadOpenTrades}
              chain={chain}
            />
          )}
        </div>

        {/* Trade ticket — Centered Modal Dialog */}
        {selectedStrike && (
          <div
            className="trade-ticket-modal-overlay"
            onClick={() => setSelectedStrike(null)}
          >
            <div
              className="trade-ticket-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <TradeTicket
                selected={selectedStrike}
                symbol={SYMBOL}
                lotSize={LOT_SIZES[SYMBOL]}
                onPlace={handlePlace}
                onClear={() => setSelectedStrike(null)}
                submitting={submitting}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
