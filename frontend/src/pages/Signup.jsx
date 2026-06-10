import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../api";
import usePageTitle from "../hooks/usePageTitle";
import { AuthShell } from "./Login";

export default function Signup() {
  usePageTitle("Create account");
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user = await signup(
        email.trim().toLowerCase(),
        password,
        displayName.trim() || null,
      );
      toast.success(`Welcome, ${user.display_name || user.email}`);
      navigate("/", { replace: true });
    } catch (err) {
      setError(formatApiError(err, "Signup failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-form-panel">
        {/* Mobile brand header */}
        <div className="auth-mobile-brand">
          <img src="/tradeflow.svg" alt="" aria-hidden width={24} height={24} />
          <span>Tradeflow</span>
        </div>

        <div className="auth-form-content">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Create account</h1>
            <p className="auth-form-subtitle">Start your paper trading journey</p>
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
              <label htmlFor="display_name" className="auth-field-label">
                Display name <span className="auth-field-optional">(optional)</span>
              </label>
              <input
                id="display_name"
                type="text"
                maxLength={80}
                className="auth-field-input"
                placeholder="Trader"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-field-label">Password</label>
              <div className="auth-password-wrap">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="auth-field-input"
                  placeholder="Min. 8 characters"
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
              id="signup-submit"
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <span className="auth-btn-inner">
                  <span className="auth-spinner" />
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>

            <div className="auth-form-footer">
              Already have an account?{" "}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
