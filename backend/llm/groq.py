"""
Tradeflow — Groq Cloud LLM Provider

Uses the Groq Python SDK for fast cloud inference.
Requires a valid API key from https://console.groq.com/
"""

import logging

from llm.provider import LLMProvider

logger = logging.getLogger("tradeflow.llm.groq")


class GroqProvider(LLMProvider):

    def __init__(self, api_key: str = "", model: str = "llama-3.1-8b-instant"):
        self._api_key = api_key
        self._model = model

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model_name(self) -> str:
        return self._model

    def generate(self, prompt: str) -> str:
        if not self._api_key:
            raise RuntimeError(
                "Groq API key is not configured. "
                "Set it in Settings → LLM Provider → Groq API Key."
            )

        try:
            from groq import Groq
        except ImportError:
            raise RuntimeError(
                "The 'groq' package is not installed. "
                "Run: pip install groq"
            )

        try:
            client = Groq(api_key=self._api_key)
            response = client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=600,
            )
            text = response.choices[0].message.content
            if not text:
                raise RuntimeError("Groq returned an empty response.")
            return text
        except Exception as e:
            if "groq" in type(e).__module__.lower() if hasattr(type(e), '__module__') else False:
                logger.error("Groq API error: %s", e)
                raise RuntimeError(f"Groq API error: {e}")
            raise

    def health_check(self) -> dict:
        """Validate the API key by listing models."""
        if not self._api_key:
            return {
                "ok": False,
                "provider": "groq",
                "model": self._model,
                "detail": "Groq API key is not set. Enter it in Settings.",
            }

        try:
            from groq import Groq
        except ImportError:
            return {
                "ok": False,
                "provider": "groq",
                "model": self._model,
                "detail": "The 'groq' pip package is not installed.",
            }

        try:
            client = Groq(api_key=self._api_key)
            models = client.models.list()
            model_ids = [m.id for m in models.data] if hasattr(models, 'data') else []

            if self._model in model_ids:
                return {
                    "ok": True,
                    "provider": "groq",
                    "model": self._model,
                    "detail": f"Groq connected, model '{self._model}' available.",
                }
            elif model_ids:
                return {
                    "ok": False,
                    "provider": "groq",
                    "model": self._model,
                    "detail": (
                        f"Groq connected but model '{self._model}' not found. "
                        f"Available: {', '.join(model_ids[:5])}"
                    ),
                }
            else:
                return {
                    "ok": True,
                    "provider": "groq",
                    "model": self._model,
                    "detail": "Groq API key valid (couldn't list models to verify).",
                }
        except Exception as e:
            return {
                "ok": False,
                "provider": "groq",
                "model": self._model,
                "detail": f"Groq health check failed: {e}",
            }
