# Tradeflow — LLM Provider Reference

> **Audience**: AI agents and contributors.  
> **Rule**: Update this doc when adding/modifying LLM providers or changing model defaults.

---

## Overview

Tradeflow uses LLM inference for one purpose: **post-trade mentor reports**. The LLM receives trade details + pre-market context and generates a structured 5-section educational report.

The provider is configurable at runtime via `settings.json` → `llm.provider`. No restart required.

---

## Provider: Ollama (Local)

**When to use:** Offline-first, privacy-focused, no API costs, GPU available.

| Setting | Key | Default |
|---------|-----|---------|
| Provider | `llm.provider` | `"ollama"` |
| Base URL | `llm.ollama_base_url` | `"http://localhost:11434"` |
| Model | `llm.ollama_model` | `"qwen3.5:4b"` |

### Setup
```bash
# Install Ollama (Windows): https://ollama.com/download
# Pull the model:
ollama pull qwen3.5:4b
# Start the server:
ollama serve
```

### API Call
```
POST http://localhost:11434/api/generate
{
  "model": "qwen3.5:4b",
  "prompt": "...",
  "stream": false,
  "think": false,
  "options": { "temperature": 0.7, "num_predict": 600 }
}
```

### Requirements
- ~2.3 GB disk for `qwen3.5:4b` weights
- ~4 GB RAM during inference (CPU mode)
- Much faster with GPU (CUDA/ROCm)
- Inference time: ~10-60s on CPU, ~3-5s on GPU

### Model Notes
- `qwen3.5:4b` chosen for balance of quality vs resource usage
- Supports `<think>` tags — we strip them with `_strip_think()`
- Structured tokens (`THESIS_SCORE`, `PROCESS_VERDICT`) extracted via regex
- Alternative models: `llama3.2:3b` (faster, lower quality), `qwen3.5:8b` (better, needs more RAM)

---

## Provider: Groq (Cloud)

**When to use:** Fast inference (~2-3s), no local GPU, free tier sufficient.

| Setting | Key | Default |
|---------|-----|---------|
| Provider | `llm.provider` | `"groq"` |
| API Key | `llm.groq_api_key` | `""` (must be set) |
| Model | `llm.groq_model` | `"llama-3.1-8b-instant"` |

### Setup
1. Get a free API key at https://console.groq.com/
2. Enter the key in Settings → LLM Provider → Groq API Key
3. Switch provider to "Groq"

### API Call
Uses the `groq` Python SDK:
```python
from groq import Groq
client = Groq(api_key=key)
response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.7,
    max_tokens=600,
)
```

### Free Tier Limits (as of 2026)
- 14,400 requests/day
- 30 RPM for `llama-3.1-8b-instant`
- Tradeflow generates ~5-10 reports/day → well within limits

### Model Notes
- `llama-3.1-8b-instant` — fast, cheap, good enough for structured reports
- `llama3-70b-8192` — better quality but slower, lower rate limits on free tier
- Do NOT invent model names — only use confirmed working models

---

## Provider Interface

All providers implement the same interface:

```python
class LLMProvider:
    def generate(self, prompt: str) -> str:
        """Send prompt, return raw text response."""
        ...
    
    def health_check(self) -> dict:
        """Return {"ok": bool, "detail": str, "provider": str, "model": str}"""
        ...
```

### Factory

```python
from llm.provider import get_llm_provider

provider = get_llm_provider()  # reads settings.json
raw_text = provider.generate(prompt)
```

### Adding a New Provider

1. Create `backend/llm/new_provider.py` implementing `LLMProvider`
2. Add the provider name to the factory in `backend/llm/provider.py`
3. Add settings keys to the schema in `backend/settings.py`
4. Add UI controls to `frontend/src/pages/Settings.jsx`
5. Update this document

---

## Report Output Format

Regardless of provider, the report pipeline expects:

1. Raw text containing 5 markdown sections
2. Two machine-readable tokens at the end:
   - `THESIS_SCORE: N/10` (1-10 integer)
   - `PROCESS_VERDICT: EXCELLENT | GOOD | NEEDS_WORK`
3. Optional `<think>...</think>` blocks (stripped before parsing)

The extraction logic lives in `backend/trades/report.py::_extract_structured_tokens()`.
