import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { User, LogOut, Flame, Zap, Settings } from "lucide-react";

import Pill from "../ui/Pill";
import WindowControls from "./WindowControls";
import useMarketSession from "../../hooks/useMarketSession";
import { useAuth } from "../../context/AuthContext";
import { NAV } from "../../lib/copy";
import NotificationBell from "../notifications/NotificationBell";

import { useUnsavedChanges } from "../../context/UnsavedChangesContext";

const LEVEL_XP = 500;

export default function Nav() {
  const location = useLocation();
  const { user } = useAuth();
  const { confirmNavigation } = useUnsavedChanges();
  const noChrome = location.pathname === "/login" || location.pathname === "/signup";

  const handleNavClick = (to, e) => {
    if (!confirmNavigation(to)) {
      e.preventDefault();
    }
  };

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav-left">
        <Link to="/" className="nav-brand" onClick={(e) => handleNavClick("/", e)}>
          <img
            src="/tradeflow.svg"
            alt=""
            className="nav-brand-mark"
            aria-hidden
            width="20"
            height="20"
          />
          <span className="nav-brand-text">{NAV.brand}</span>
        </Link>
        {!noChrome && user && (
          <div className="nav-links">
            <NavLink to="/" end onClick={(e) => handleNavClick("/", e)}>{NAV.links.analysis}</NavLink>
            <NavLink to="/trade" onClick={(e) => handleNavClick("/trade", e)}>{NAV.links.trade}</NavLink>
            <NavLink to="/portfolio" onClick={(e) => handleNavClick("/portfolio", e)}>{NAV.links.portfolio}</NavLink>
            <NavLink to="/reports" onClick={(e) => handleNavClick("/reports", e)}>{NAV.links.reports}</NavLink>
            <NavLink to="/learn" onClick={(e) => handleNavClick("/learn", e)}>{NAV.links.learn}</NavLink>
          </div>
        )}
      </div>
      {!noChrome && user && (
        <div className="nav-right">
          <SessionPill />
          <NavStats />
          <NotificationBell />
          <UserMenu />
        </div>
      )}
      {/* Native window controls (only renders in Electron) */}
      <WindowControls />
    </nav>
  );
}


function SessionPill() {
  const { phase, label } = useMarketSession();
  const variant =
    phase === "live" ? "bull" : phase === "premarket" ? "amber" : "muted";
  return (
    <Pill variant={variant} icon={<DotIcon phase={phase} />}>
      {label}
    </Pill>
  );
}

function DotIcon({ phase }) {
  const color =
    phase === "live"
      ? "var(--green)"
      : phase === "premarket"
      ? "var(--amber)"
      : "var(--text-muted)";
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        boxShadow: phase === "live" ? "0 0 6px rgba(34,197,94,0.6)" : "none",
        display: "inline-block",
      }}
    />
  );
}

const LEVEL_RANKS = [
  "Novice Trader",
  "F&O Apprentice",
  "Options Practitioner",
  "Volatility Specialist",
  "Derivatives Analyst",
  "Market Strategist",
  "Master Trader",
];

function getRankTitle(level) {
  const index = Math.max(0, level - 1);
  return LEVEL_RANKS[index] || "Master Trader";
}

function NavStats() {
  const { user, stats } = useAuth();
  const [pulse, setPulse] = useState(false);

  const xp = stats?.total_xp ?? 0;
  const streak = stats?.streak_days ?? 0;
  const level = Math.floor(xp / LEVEL_XP) + 1;

  useEffect(() => {
    if (!user?.id || !stats) return;
    const key = `tradeflow.lastSeenLevel.${user.id}`;
    const stored = parseInt(localStorage.getItem(key), 10);
    if (!Number.isFinite(stored)) {
      localStorage.setItem(key, String(level));
      return;
    }
    if (level > stored) {
      const rankTitle = getRankTitle(level);
      toast.success(`🎉 LEVEL UP! You reached Level ${level} · ${rankTitle}`, {
        duration: 6000,
        description: `Keep executing disciplined trades and completing daily quests!`,
      });
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2400);
      localStorage.setItem(key, String(level));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [level, user?.id, stats]);

  if (!stats) return null;

  const streakTooltip =
    `${streak}-day streak. Earn XP on a weekday to extend it. ` +
    `Weekends are forgiven; miss a weekday and it resets to 1.`;

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {streak > 0 && (
        <Pill
          variant="amber"
          data-tooltip-id="global-tooltip"
          data-tooltip-content={streakTooltip}
          icon={
            <Flame
              size={11}
              color="var(--streak)"
              style={{ filter: "drop-shadow(0 0 3px rgba(251,146,60,0.5))" }}
            />
          }
        >
          <span className="mono">{streak}</span>d
        </Pill>
      )}
      <LevelPill xp={xp} level={level} pulse={pulse} />
    </div>
  );
}

function LevelPill({ xp, level, pulse = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const xpInLevel = xp % LEVEL_XP;
  const xpToNext = LEVEL_XP - xpInLevel;
  const progressPct = (xpInLevel / LEVEL_XP) * 100;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <Pill
        as="button"
        variant="muted"
        className={pulse ? "level-pill-pulse" : ""}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Level ${level}. Show XP details.`}
      >
        Lv <span className="mono" style={{ marginLeft: 2 }}>{level}</span>
      </Pill>
      {open && (
        <div
          role="dialog"
          aria-label="XP progress"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--elev-2)",
            minWidth: 240,
            padding: "12px 14px",
            zIndex: 200,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-muted)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              <Zap size={12} color="var(--xp)" />
              Level {level}
            </div>
            <span className="xp-label" style={{ fontSize: 12 }}>
              {xp.toLocaleString()} XP
            </span>
          </div>
          <div className="xp-bar" aria-hidden>
            <div className="xp-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 8,
              fontVariantNumeric: "tabular-nums",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              {xpInLevel} / {LEVEL_XP} in Lv {level}
            </span>
            <span>{xpToNext} XP to Lv {level + 1}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = user.display_name || user.email;

  const { confirmNavigation } = useUnsavedChanges();

  const handleSettingsClick = () => {
    if (confirmNavigation("/settings")) {
      navigate("/settings");
      setOpen(false);
    }
  };

  const handleLogout = () => {
    if (confirmNavigation("/login")) {
      logout();
      setOpen(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm nav-user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        style={{ padding: "5px 10px", gap: 6 }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={12} />
        <span className="nav-user-menu-label" style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="nav-user-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--elev-2)",
            minWidth: 220,
            padding: 6,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{user.email}</div>
          </div>
          <button
            type="button"
            onClick={handleSettingsClick}
            className="btn btn-ghost btn-sm nav-user-menu__item"
            style={{
              justifyContent: "flex-start",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: "transparent",
            }}
          >
            <Settings size={13} aria-hidden />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-ghost btn-sm nav-user-menu__signout"
            style={{
              justifyContent: "flex-start",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: "transparent",
            }}
          >
            <LogOut size={13} aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
