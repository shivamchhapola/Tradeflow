# Tradeflow — Settings System Reference

> **Audience**: AI agents and contributors.
> **Rule**: Update this doc when adding new settings keys or categories.

## Overview

Two configuration layers:

| Layer | File | Purpose | Runtime Mutable? |
|-------|------|---------|-------------------|
| **Environment** | `backend/.env` | Bootstrap secrets (JWT_SECRET) | No |
| **Settings** | `settings.json` (project root) | Runtime config (LLM, data sources) | Yes |

## Settings File

- Location: project root, next to `tradeflow.db`
- Gitignored (contains API keys)
- Auto-created with defaults on first access
- Atomically written (temp file + rename)

## Schema (v1)

```json
{
  "version": 1,
  "llm": {
    "provider": "ollama",
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "qwen3.5:4b",
    "groq_api_key": "",
    "groq_model": "llama-3.1-8b-instant"
  },
  "data_sources": {
    "option_chain": "nse",
    "gift_nifty": "nse"
  },
  "general": {
    "auto_squareoff_time": "15:15",
    "premarket_cron_time": "08:00"
  }
}
```

## API Endpoints

- `GET /api/settings` — current settings (API keys masked)
- `PUT /api/settings` — partial deep-merge update
- `GET /api/settings/llm/status` — LLM provider health check
- `POST /api/settings/llm/test` — send test prompt to verify LLM

## Backend (`backend/settings.py`)

```python
from settings import get_settings, update_settings
settings = get_settings()                          # full dict, defaults merged
update_settings({"llm": {"provider": "groq"}})     # deep merge, atomic write
```

## Adding a New Setting

1. Add key + default to `DEFAULTS` in `backend/settings.py`
2. Add UI control in `frontend/src/pages/Settings.jsx`
3. Update this doc
