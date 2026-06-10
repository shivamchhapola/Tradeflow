import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { getAnalysisHistoryCandles } from "../../api";
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  ReferenceLine,
  Dot,
} from "recharts";

function formatRunAt(timeStr) {
  if (!timeStr) return "";
  let s = String(timeStr).trim();
  if (s.includes("T") && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    const base = s.length >= 19 ? s.slice(0, 19) : s;
    s = `${base}+05:30`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(timeStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function biasLabelFromScore(score) {
  if (score > 0.08) return "Bullish";
  if (score < -0.08) return "Bearish";
  return "Neutral";
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `YYYY-MM-DD` → `11 May` (for axis; avoids timezone shifts) */
function formatAxisDayMonth(iso) {
  const parts = String(iso).split("-");
  if (parts.length !== 3) return String(iso);
  const y = parts[0];
  const mo = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!y || mo < 1 || mo > 12 || day < 1 || day > 31) return String(iso);
  return `${day} ${MONTH_SHORT[mo - 1]}`;
}

export default function ScoreSparkline() {
  const [rows, setRows] = useState([]);
  const chartWrapRef = useRef(null);
  const [chartW, setChartW] = useState(0);

  useEffect(() => {
    getAnalysisHistoryCandles(5)
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const { chartData, yDomain } = useMemo(() => {
    const valid = rows.filter((c) => c.close != null && !Number.isNaN(Number(c.close)));

    if (!valid.length) {
      return { chartData: [], yDomain: [-0.16, 0.16] };
    }

    const vals = valid.map((c) => Number(c.close));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo;
    const pad = Math.max(span * 0.12, 0.02, 0.008);

    const chartData = rows.map((c) => {
      const sc = c.close != null && !Number.isNaN(Number(c.close)) ? Number(c.close) : null;
      return {
        date: c.date,
        displayDate: formatAxisDayMonth(c.date),
        score: sc,
        bias: c.end_bias ?? null,
        last_run_at: c.last_run_at,
        isMock: false,
      };
    });

    return { chartData, yDomain: [lo - pad, hi + pad] };
  }, [rows]);

  useLayoutEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return undefined;
    if (typeof ResizeObserver === "undefined") {
      setChartW(Math.floor(el.clientWidth));
      return undefined;
    }
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect?.width;
      if (cw != null && cw > 0) setChartW(Math.floor(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dotR = useMemo(() => {
    const n = chartData.length || 1;
    const w = chartW > 0 ? chartW : 360;
    const inner = Math.max(100, w - 40);
    const band = inner / n;
    return Math.min(5, Math.max(3, band * 0.12));
  }, [chartW, chartData.length]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    if (d.score == null || Number.isNaN(d.score)) {
      return (
        <div
          style={{
            background: "#1a1a1d",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "11px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>{d.date}</div>
          <div style={{ marginTop: 6, opacity: 0.75 }}>No snapshot in 8:00–9:15 IST</div>
        </div>
      );
    }
    return (
      <div
        style={{
          position: "relative",
          background: "#1a1a1d",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "10px 14px",
          paddingRight: d.isMock ? 52 : 14,
          borderRadius: "8px",
          fontSize: "11px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
          zIndex: 1000,
        }}
      >
        <div style={{ color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>{d.date}</div>
        <div style={{ fontSize: "13px", fontWeight: 700 }}>
          Score:{" "}
          <span
            style={{
              color: d.score > 0 ? "#22c55e" : d.score < 0 ? "#ef4444" : "rgba(148, 163, 184, 0.95)",
            }}
          >
            {d.score.toFixed(3)}
          </span>
        </div>
        {d.bias != null && String(d.bias).trim() !== "" && (
          <div style={{ marginTop: 6, opacity: 0.85 }}>Bias: {String(d.bias)}</div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: "10px",
            color: "rgba(255,255,255,0.45)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 6,
          }}
        >
          Last snapshot in 8:00–9:15 IST
          {d.last_run_at ? ` · ${formatRunAt(d.last_run_at)} IST` : ""}
        </div>
      </div>
    );
  };

  if (!chartData.length) return null;

  return (
    <div style={{ width: "100%", marginTop: 12 }}>
      <div
        style={{
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Recent Trend
        </div>
      </div>

      <div ref={chartWrapRef} style={{ height: 108 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 10, left: 14, bottom: 20 }}>
            <XAxis
              dataKey="displayDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "#6a6a70" }}
              interval={0}
            />
            <YAxis hide domain={yDomain} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="score"
              stroke="rgba(148, 163, 184, 0.9)"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.score == null || Number.isNaN(payload.score)) return null;
                const fill =
                  payload.score > 0 ? "#22c55e" : payload.score < 0 ? "#ef4444" : "#94a3b8";
                return <Dot cx={cx} cy={cy} r={dotR} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />;
              }}
              activeDot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.score == null || Number.isNaN(payload.score)) return null;
                const fill =
                  payload.score > 0 ? "#22c55e" : payload.score < 0 ? "#ef4444" : "#94a3b8";
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dotR}
                    fill={fill}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
