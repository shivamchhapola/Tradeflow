import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { signedInr } from "../../lib/format";

/**
 * P&L cell — sign + arrow + color so the info isn't conveyed by color alone.
 * (Accessibility: red/green text + a glyph + an explicit + / − prefix.)
 */
export default function PnL({ value, size = 13, mono = true }) {
  const n = Number(value);
  const isUp = Number.isFinite(n) && n > 0;
  const isDown = Number.isFinite(n) && n < 0;
  const color = isUp ? "var(--green)" : isDown ? "var(--red)" : "var(--text-muted)";
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        color,
        fontWeight: 600,
        fontSize: size,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Icon size={Math.round(size * 0.85)} strokeWidth={2.5} />
      {signedInr(n)}
    </span>
  );
}
