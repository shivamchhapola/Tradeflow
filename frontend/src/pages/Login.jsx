import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, TrendingUp, ShieldCheck, Brain } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../api";
import usePageTitle from "../hooks/usePageTitle";

export default function Login() {
  usePageTitle("Sign in");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      toast.success(`Welcome back, ${user.display_name || user.email}`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(formatApiError(err, "Login failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-form-panel">
        {/* Mobile brand header (shown only on small screens) */}
        <div className="auth-mobile-brand">
          <img src="/tradeflow.svg" alt="" aria-hidden width={24} height={24} />
          <span>Tradeflow</span>
        </div>

        <div className="auth-form-content">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Welcome back</h1>
            <p className="auth-form-subtitle">Sign in to your trading journal</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="email" className="auth-field-label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="auth-field-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-field-label">Password</label>
              <div className="auth-password-wrap">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  className="auth-field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <span className="auth-btn-inner">
                  <span className="auth-spinner" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="auth-form-footer">
              No account?{" "}
              <Link to="/signup" className="auth-link">
                Create one — it's free
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ children }) {
  return (
    <div className="auth-shell">
      {/* ── Left: marketing panel ── */}
      <div className="auth-hero-panel" aria-hidden="true">
        <div className="auth-hero-bg">
          <div className="auth-hero-orb auth-hero-orb-1" />
          <div className="auth-hero-orb auth-hero-orb-2" />
          <div className="auth-hero-orb auth-hero-orb-3" />
          <div className="auth-hero-grid" />
        </div>

        <div className="auth-hero-content">
          <div className="auth-hero-brand">
            <img src="/tradeflow.svg" alt="" aria-hidden width={28} height={28} />
            <span className="auth-hero-brand-name">Tradeflow</span>
          </div>

          <div className="auth-hero-tagline">
            <h2 className="auth-hero-title">
              Learn FnO trading<br />
              <span className="auth-hero-accent">without the risk.</span>
            </h2>
            <p className="auth-hero-desc">
              Paper trade NIFTY options with real market data. Get AI-powered
              mentor reports on every trade. Level up through process, not luck.
            </p>
          </div>

          <div className="auth-features">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <TrendingUp size={16} />
              </div>
              <div>
                <div className="auth-feature-title">Live NSE Option Chain</div>
                <div className="auth-feature-desc">Real-time NIFTY strikes, IV &amp; OI</div>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <Brain size={16} />
              </div>
              <div>
                <div className="auth-feature-title">AI Mentor Reports</div>
                <div className="auth-feature-desc">LLaMA 3 explains every closed trade</div>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="auth-feature-title">XP &amp; Streak System</div>
                <div className="auth-feature-desc">Rewards discipline, not just P&amp;L</div>
              </div>
            </div>
          </div>

          {/* Decorative terminal snippet */}
          <div className="auth-hero-terminal">
            <div className="auth-terminal-bar">
              <span className="auth-terminal-dot" style={{ background: "#ef4444" }} />
              <span className="auth-terminal-dot" style={{ background: "#f59e0b" }} />
              <span className="auth-terminal-dot" style={{ background: "#22c55e" }} />
              <span className="auth-terminal-title">premarket.py</span>
            </div>
            <div className="auth-terminal-body">
              <div><span className="auth-tc-muted"># 08:00 IST · Macro Analysis</span></div>
              <div><span className="auth-tc-key">GIFT Nifty</span>  <span className="auth-tc-bull">+0.42%</span>  <span className="auth-tc-muted">weight: 0.40</span></div>
              <div><span className="auth-tc-key">NASDAQ  </span>  <span className="auth-tc-bull">+0.81%</span>  <span className="auth-tc-muted">weight: 0.25</span></div>
              <div><span className="auth-tc-key">VIX     </span>  <span className="auth-tc-bear">+2.10%</span>  <span className="auth-tc-muted">weight: -0.20</span></div>
              <div className="auth-tc-gap" />
              <div><span className="auth-tc-muted">→ Score: </span><span className="auth-tc-score">+0.31</span> <span className="auth-tc-badge">Bullish · Grade A</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-form-panel-wrap">
        {children}
      </div>
    </div>
  );
}
