import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  getSettings,
  updateSettings,
  getLLMStatus,
  testLLM,
  formatApiError,
} from "../api";

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
  const [settings, setSettings] = useState(null);
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

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({ llm: formLLM, data_sources: formDataSources });
      setSettings(updated);
      setFormLLM(updated.llm || {});
      setFormDataSources(updated.data_sources || {});
      setDirty(false);
      setLlmStatus(null);
      setTestResult(null);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(formatApiError(err, "Couldn't save settings."));
    } finally {
      setSaving(false);
    }
  };

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
                label="Model"
                value={formLLM.groq_model || ""}
                onChange={(v) => handleLLMChange("groq_model", v)}
                placeholder="llama-3.1-8b-instant"
                hint="Confirmed: llama-3.1-8b-instant, llama3-70b-8192"
              />
            </>
          )}
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
            placeholder="https://..."
            hint="The base URL used to construct option chain and market status requests. Refer to DATA_SOURCES.md for valid links."
          />
          <div className="settings-field">
            <label className="settings-field-label">Global Indices</label>
            <div className="settings-field-value-static">
              <span className="settings-badge">yfinance</span>
              <span className="settings-field-hint">NASDAQ, S&P 500, Nikkei, VIX, DXY, Crude, US 10Y</span>
            </div>
          </div>
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
