# Tradeflow — Architecture Decision Records (ADRs)

> **Format**: Each decision gets an entry with context, decision, and consequences.  
> **Rule**: Any AI agent or contributor making a structural change MUST add an ADR here.

---

## ADR-001: SQLite over Postgres

**Date:** 2025-05-14  
**Status:** Accepted

**Context:** Single-user app running on a local machine. No concurrent writes from multiple servers.

**Decision:** Use SQLite with WAL mode. No ORM — raw SQL with `sqlite3.Row` factory. (Later migrated to SQLModel for better type safety.)

**Consequences:**
- Zero setup — just a file next to the code
- No connection pool complexity
- Sufficient for years of single-user data
- Cannot scale to multi-server if ever needed (cross that bridge later)

---

## ADR-002: Groq → Ollama for LLM Reports

**Date:** 2026-06-07  
**Status:** Accepted, made configurable (ADR-006)

**Context:** Originally used Groq API (free tier) for LLM trade reports. Switched to Ollama for fully offline operation with `qwen3.5:4b` model.

**Decision:** Default LLM provider is Ollama (local). Groq remains available as an option via settings.

**Consequences:**
- No API key needed for default setup
- Requires ~2.3 GB disk for model weights + ~4 GB RAM during inference
- Slower on CPU-only machines (~30-60s per report vs ~3s on Groq)
- User must start Ollama separately (`ollama serve`)

---

## ADR-003: NSE-only for GIFT Nifty (no Kite hop)

**Date:** 2026-05-19  
**Status:** Accepted

**Context:** Previously tried: user's Kite token → freshest Kite token → NSE fallback. The Kite call required NSEIX segment subscription that most retail Zerodha accounts don't have.

**Decision:** GIFT Nifty is fetched exclusively from NSE's `/api/marketStatus`. All Kite-related GIFT Nifty code was removed.

**Consequences:**
- Simpler code path, no dead branches
- Works without any Zerodha subscription
- NSE data is ~15 min delayed (acceptable for pre-market analysis)

---

## ADR-004: File-Based Settings over Environment Variables

**Date:** 2026-06-08  
**Status:** Accepted

**Context:** Environment variables (`.env`) work for secrets but are painful for runtime configuration changes — requires restart, not user-friendly, can't be changed from a GUI.

**Decision:** Runtime settings stored in `settings.json` (next to `tradeflow.db`). Env vars (`.env`) remain for bootstrap secrets only (`JWT_SECRET`, `ADMIN_BOOTSTRAP_*`). Settings are read on every use (not cached permanently) and written atomically on mutation.

**Consequences:**
- Users can change LLM provider, model, API keys from the frontend Settings page
- No restart needed for config changes
- Settings file is gitignored (contains API keys)
- `.env` still loads on startup for backward compat
- Schema validated on read — unknown keys ignored, missing keys get defaults

---

## ADR-005: LLM Provider Abstraction

**Date:** 2026-06-08  
**Status:** Accepted

**Context:** Switching between Ollama and Groq required editing code. As an open-source project, users should pick their preferred LLM without touching Python.

**Decision:** Abstract LLM calls behind a `LLMProvider` interface in `backend/llm/`. Factory reads `settings.json` and returns the appropriate provider. Report generation is provider-agnostic.

**Consequences:**
- Adding a new provider (e.g., OpenAI, local llama.cpp) = one new file + factory case
- Settings page can switch providers at runtime
- Provider health checks available via `/api/settings/llm/status`

---

## ADR-006: Settings System Design

**Date:** 2026-06-08  
**Status:** Accepted

**Context:** Open-sourcing requires that users can configure integrations (LLM, data sources) without editing code or env files.

**Decision:** 
- Backend: `settings.py` manages a JSON file with schema validation and defaults
- API: `GET/PUT /api/settings` for reading/writing, plus health check endpoints
- Frontend: Dedicated `/settings` page with categorized config sections
- API keys are masked in GET responses (only last 4 chars shown)
- Settings require authentication (only logged-in users can change)

**Consequences:**
- Self-service configuration — no SSH/terminal needed
- API keys stored in plaintext JSON on disk (acceptable for single-user local app)
- Future: Electron app can pre-populate settings on first run

---

## Template for New ADRs

```markdown
## ADR-NNN: Title

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded by ADR-XXX

**Context:** Why is this decision needed?

**Decision:** What was decided?

**Consequences:** What are the trade-offs?
```
