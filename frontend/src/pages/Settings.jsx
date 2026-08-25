import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Bot,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  ExternalLink,
  Info,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  getSettings,
  getSettingsStatus,
  updateSettings,
  getLLMStatus,
  testLLM,
  formatApiError,
} from "../api";

import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import "../styles/settings.css";

const LLM_PROVIDERS = [
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run models locally — private, no API costs, needs Ollama running.",
    icon: "🖥️",
  },
  {
    id: "groq",
    name: "Groq (Cloud)",
    description: "Fast cloud inference — free tier, needs API key.",
    icon: "☁️",
  },
];

export default function Settings() {
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const navigate = useNavigate();

  const { setIsDirty, registerSaveHandler, registerDiscardHandler } = useUnsavedChanges();

  const [settings, setSettings] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [llmStatus, setLlmStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // Local form state (editable copies)
  const [formLLM, setFormLLM] = useState({});
  const [formDataSources, setFormDataSources] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setIsDirty(dirty);
  }, [dirty, setIsDirty]);

  const fetchSettings = useCallback(async () => {
    try {
      const [data, status] = await Promise.all([getSettings(), getSettingsStatus()]);
      setSettings(data);
      setConfigStatus(status);
      setFormLLM(data.llm || {});
      setFormDataSources(data.data_sources || {});
      setDirty(false);
    } catch (err) {
      toast.error(formatApiError(err, "Couldn't load settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLLMChange = (key, value) => {
    setFormLLM((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setLlmStatus(null);
    setTestResult(null);
  };

  const handleDataSourceChange = (key, value) => {
    setFormDataSources((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleFillDefault = () => {
    setFormDataSources((prev) => ({
      ...prev,
      nse_base_url: "https://www.nseindia.com",
      yfinance_base_url: "https://query1.finance.yahoo.com",
    }));
    setDirty(true);
    toast.success("Filled default data source URLs. Click 'Save changes' to complete setup.");
  };

  const handleCancel = useCallback(() => {
    if (settings) {
      setFormLLM(settings.llm || {});
      setFormDataSources(settings.data_sources || {});
      setDirty(false);
      setLlmStatus(null);
      setTestResult(null);
      toast.info("Unsaved changes discarded.");
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    if (!formDataSources.nse_base_url?.trim()) {
      toast.error("NSE Base URL is required to complete initial setup.");
      return false;
    }

    setSaving(true);
    try {
      const updated = await updateSettings({ llm: formLLM, data_sources: formDataSources });
      const status = await getSettingsStatus();
      setSettings(updated);
      setConfigStatus(status);
      setFormLLM(updated.llm || {});
      setFormDataSources(updated.data_sources || {});
      setDirty(false);
      setLlmStatus(null);
      setTestResult(null);

      if (status.is_configured) {
        toast.success("Setup complete! All features unlocked.");
        if (isOnboarding) {
          navigate("/", { replace: true });
        }
      } else {
        toast.success("Settings saved.");
      }
      return true;
    } catch (err) {
      toast.error(formatApiError(err, "Couldn't save settings."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [formDataSources, formLLM, isOnboarding, navigate]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    registerDiscardHandler(handleCancel);
  }, [registerSaveHandler, registerDiscardHandler, handleSave, handleCancel]);

  const handleStatusCheck = async () => {
    setStatusLoading(true);
    setLlmStatus(null);
    try {
      const status = await getLLMStatus();
      setLlmStatus(status);
    } catch (err) {
      setLlmStatus({ ok: false, detail: formatApiError(err) });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testLLM();
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, detail: formatApiError(err) });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <Loader2 size={20} className="spin" />
          <span>Loading settings…</span>
        </div>
      </div>
    );
  }

  const currentProvider = formLLM.provider || "ollama";

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="settings-header-text">
          <h1 className="settings-title">
            <SettingsIcon size={22} />
            Settings
          </h1>
          <p className="settings-subtitle">
            Configure integrations and preferences. Changes are saved to{" "}
            <code>settings.json</code> — editable by hand too.
          </p>
        </div>
        {dirty && (
          <button
            className="btn btn-primary settings-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        )}
      </header>

      {/* ── Onboarding / Setup Required Banner ── */}
      {configStatus && !configStatus.is_configured && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md, 12px)",
            padding: "16px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 260 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.2)",
                color: "var(--amber, #f59e0b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary, #fff)" }}>
                Initial Setup Required
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary, #aaa)", lineHeight: 1.4 }}>
                Please set up your <strong>NSE Base URL</strong> under Data Sources below to unlock the platform.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleFillDefault}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Sparkles size={13} color="var(--amber, #f59e0b)" />
            Fill Default URL
          </button>
        </div>
      )}


      {/* ── LLM Provider ── */}
      <section className="settings-section">
        <div className="settings-section-header">
          <Bot size={18} />
          <div>
            <h2 className="settings-section-title">LLM Provider</h2>
            <p className="settings-section-desc">
              Powers the mentor trade reports. Switch between local (Ollama) and cloud (Groq).
            </p>
          </div>
        </div>

        <div className="settings-provider-grid">
          {LLM_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`settings-provider-card ${currentProvider === p.id ? "active" : ""}`}
              onClick={() => handleLLMChange("provider", p.id)}
            >
              <div className="settings-provider-card-header">
                <span className="settings-provider-icon">{p.icon}</span>
                <span className="settings-provider-name">{p.name}</span>
                {currentProvider === p.id && (
                  <CheckCircle2 size={16} className="settings-provider-check" />
                )}
              </div>
              <p className="settings-provider-desc">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Provider-specific fields */}
        <div className="settings-fields">
          {currentProvider === "ollama" && (
            <>
              <SettingsField
                label="Ollama Base URL"
                value={formLLM.ollama_base_url || ""}
                onChange={(v) => handleLLMChange("ollama_base_url", v)}
                placeholder="http://localhost:11434"
                hint="Address where Ollama is running."
              />
              <SettingsField
                label="Model"
                value={formLLM.ollama_model || ""}
                onChange={(v) => handleLLMChange("ollama_model", v)}
                placeholder="qwen3.5:4b"
                hint="Must be pre-pulled: ollama pull <model>"
              />
            </>
          )}
          {currentProvider === "groq" && (
            <>
              <SettingsField
                label="Groq API Key"
                value={formLLM.groq_api_key || ""}
                onChange={(v) => handleLLMChange("groq_api_key", v)}
                placeholder="gsk_..."
                hint={
                  <>
                    Free key at{" "}
                    <a
                      href="https://console.groq.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      console.groq.com <ExternalLink size={11} />
                    </a>
                  </>
                }
                type="password"
              />
              <SettingsField
                label="Groq Base URL"
                value={formLLM.groq_base_url || ""}
                onChange={(v) => handleLLMChange("groq_base_url", v)}
                placeholder="https://api.groq.com/openai/v1"
                hint="Base URL for Groq API endpoint or compatible proxy."
              />
              <SettingsField
                label="Model"
                value={formLLM.groq_model || ""}
                onChange={(v) => handleLLMChange("groq_model", v)}
                placeholder="llama-3.1-8b-instant"
                hint="Confirmed: llama-3.1-8b-instant, llama3-70b-8192"
              />
            </>
          )}
          <div className="settings-field">
            <label className="settings-field-label">Mentor Coaching Persona</label>
            <select
              className="settings-field-input"
              value={formLLM.mentor_persona || "supportive"}
              onChange={(e) => handleLLMChange("mentor_persona", e.target.value)}
              style={{ background: "var(--bg-input, #121214)", color: "var(--text-primary, #fff)" }}
            >
              <option value="supportive">Supportive Coach — Encouraging tone & constructive guidance</option>
              <option value="strict">Strict Risk Manager — Direct & uncompromising on discipline</option>
              <option value="educator">Textbook Educator — Deep dive into Greeks, IV & options structure</option>
            </select>
            <p className="settings-field-hint">Defines the coaching personality used in LLM trade reports.</p>
          </div>
          <SettingsField
            label="Temperature (Creativity)"
            value={formLLM.temperature ?? 0.7}
            onChange={(v) => handleLLMChange("temperature", v)}
            type="number"
            placeholder="0.7"
            hint="Randomness level between 0.0 (deterministic) and 1.0 (creative)."
          />
          <SettingsField
            label="Max Tokens"
            value={formLLM.max_tokens ?? 600}
            onChange={(v) => handleLLMChange("max_tokens", v)}
            type="number"
            placeholder="600"
            hint="Maximum response token limit for report generation (200–2000)."
          />
        </div>

        {/* Actions row */}
        <div className="settings-actions-row">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleStatusCheck}
            disabled={statusLoading || dirty}
            title={dirty ? "Save first to check status" : ""}
          >
            {statusLoading ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Zap size={13} />
            )}
            Check connection
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleTest}
            disabled={testLoading || dirty}
            title={dirty ? "Save first to test" : ""}
          >
            {testLoading ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Bot size={13} />
            )}
            Send test prompt
          </button>
        </div>

        {/* Status result */}
        {llmStatus && (
          <StatusBanner
            ok={llmStatus.ok}
            detail={llmStatus.detail}
            meta={llmStatus.ok ? `${llmStatus.provider} · ${llmStatus.model}` : null}
          />
        )}

        {/* Test result */}
        {testResult && (
          <div className={`settings-test-result ${testResult.ok ? "ok" : "err"}`}>
            <div className="settings-test-result-header">
              {testResult.ok ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )}
              <span>
                {testResult.ok
                  ? `Response in ${testResult.latency_ms}ms`
                  : "Test failed"}
              </span>
            </div>
            {testResult.response_preview && (
              <p className="settings-test-preview">
                {testResult.response_preview}
              </p>
            )}
            {testResult.detail && !testResult.ok && (
              <p className="settings-test-error">{testResult.detail}</p>
            )}
          </div>
        )}
      </section>

      {/* ── Data Sources ── */}
      <section className="settings-section">
        <div className="settings-section-header">
          <Database size={18} />
          <div>
            <h2 className="settings-section-title">Data Sources</h2>
            <p className="settings-section-desc">
              Market data integrations. More providers coming soon.
            </p>
          </div>
        </div>

        <div className="settings-info-row">
          <Info size={14} />
          <span>
            Option chain and GIFT Nifty currently use NSE India (free, ~15m
            delayed). Upstox and other broker integrations are planned.
          </span>
        </div>

        <div className="settings-fields">
          <SettingsField
            label="NSE Base URL"
            value={formDataSources.nse_base_url || ""}
            onChange={(v) => handleDataSourceChange("nse_base_url", v)}
            placeholder="https://www.nseindia.com"
            hint="Base URL for GIFT Nifty, option chain, and index chart requests. Refer to DATA_SOURCES.md for valid links."
          />
          <SettingsField
            label="Global Indices Base URL (Yahoo Finance / Proxy)"
            value={formDataSources.yfinance_base_url || ""}
            onChange={(v) => handleDataSourceChange("yfinance_base_url", v)}
            placeholder="https://query1.finance.yahoo.com"
            hint="Base endpoint or proxy URL for global indices data (NASDAQ, S&P 500, Nikkei, VIX, DXY, Crude, US 10Y)."
          />
          <SettingsField
            label="Option Chain Polling Interval (Seconds)"
            value={formDataSources.option_chain_interval ?? 60}
            onChange={(v) => handleDataSourceChange("option_chain_interval", v)}
            type="number"
            placeholder="60"
            hint="Frequency in seconds to poll live option chain data during market hours (15–300s)."
          />
          <SettingsField
            label="Intraday Chart Polling Interval (Seconds)"
            value={formDataSources.chart_interval ?? 60}
            onChange={(v) => handleDataSourceChange("chart_interval", v)}
            type="number"
            placeholder="60"
            hint="Frequency in seconds to poll intraday candlestick chart data (15–300s)."
          />
          <SettingsField
            label="Network Request Timeout (Seconds)"
            value={formDataSources.request_timeout ?? 10}
            onChange={(v) => handleDataSourceChange("request_timeout", v)}
            type="number"
            placeholder="10"
            hint="HTTP request timeout limit for market data queries (3–60s)."
          />
        </div>
      </section>

      {/* ── General ── */}
      <section className="settings-section">
        <div className="settings-section-header">
          <Clock size={18} />
          <div>
            <h2 className="settings-section-title">Schedule</h2>
            <p className="settings-section-desc">
              Automated jobs. Editable in <code>settings.json</code> (requires restart).
            </p>
          </div>
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-field-label">Pre-market Analysis</label>
            <div className="settings-field-value-static">
              <span className="mono">{settings?.general?.premarket_cron_time || "08:00"}</span>
              <span className="settings-field-hint">IST, weekdays only</span>
            </div>
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Auto Square-Off</label>
            <div className="settings-field-value-static">
              <span className="mono">{settings?.general?.auto_squareoff_time || "15:15"}</span>
              <span className="settings-field-hint">IST, 15 min before market close</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="settings-section settings-about">
        <p className="settings-about-name">
          Tradeflow <span className="settings-about-version">v0.1.0</span>
        </p>
        <p className="settings-about-desc">
          Open-source FnO paper trading + education platform for Indian markets.
        </p>
        <div className="settings-about-links">
          <a
            href="https://github.com/shivamchhapola/Tradeflow-v2"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <ExternalLink size={11} />
          </a>
        </div>
      </section>

      {/* ── Floating Unsaved Changes Bar ── */}
      {dirty && (
        <div className="settings-unsaved-bar" role="region" aria-label="Unsaved changes">
          <div className="settings-unsaved-bar-text">
            <AlertCircle size={16} className="settings-unsaved-icon" />
            <span>You have unsaved changes</span>
          </div>
          <div className="settings-unsaved-bar-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCancel}
              disabled={saving}
            >
              <RotateCcw size={13} />
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsField({ label, value, onChange, placeholder, hint, type = "text" }) {
  const [revealed, setRevealed] = useState(false);
  const isSecret = type === "password";
  const inputType = isSecret && !revealed ? "password" : "text";

  return (
    <div className="settings-field">
      <label className="settings-field-label">{label}</label>
      <div className="settings-field-input-wrap">
        <input
          type={inputType}
          className="settings-field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {isSecret && (
          <button
            type="button"
            className="settings-field-reveal"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {hint && <p className="settings-field-hint">{hint}</p>}
    </div>
  );
}

function StatusBanner({ ok, detail, meta }) {
  return (
    <div className={`settings-status-banner ${ok ? "ok" : "err"}`}>
      {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      <div>
        <span className="settings-status-text">{detail}</span>
        {meta && <span className="settings-status-meta">{meta}</span>}
      </div>
    </div>
  );
}
