"""
Tradeflow — Ollama LLM Provider

Calls the local Ollama HTTP API at /api/generate.
Ollama must be running separately (`ollama serve`).
"""

import logging

import requests

from llm.provider import LLMProvider

logger = logging.getLogger("tradeflow.llm.ollama")


class OllamaProvider(LLMProvider):

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen3.5:2b",
        temperature: float = 0.7,
        max_tokens: int = 600,
        persona: str = "supportive",
    ):
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._persona = persona

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    def _resolve_model(self) -> str:
        """
        Check if the configured model is available in Ollama.
        If not found, return the first installed model as fallback.
        """
        try:
            resp = requests.get(f"{self._base_url}/api/tags", timeout=3)
            if resp.status_code == 200:
                tags = resp.json()
                models = [m.get("name", "") for m in tags.get("models", [])]
                if not models:
                    return self._model

                # Direct or base match
                for m in models:
                    if m == self._model or m.split(":")[0] == self._model.split(":")[0]:
                        return m

                # Fallback to first available model if configured model is missing
                fallback = models[0]
                logger.info(
                    "Configured model '%s' not found in Ollama. Falling back to installed model '%s'",
                    self._model,
                    fallback,
                )
                return fallback
        except Exception as e:
            logger.debug("Could not query Ollama tags: %s", e)
        return self._model

    def generate(self, prompt: str) -> str:
        url = f"{self._base_url}/api/generate"
        active_model = self._resolve_model()
        try:
            resp = requests.post(
                url,
                json={
                    "model": active_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self._temperature,
                        "num_predict": self._max_tokens,
                    },
                },
                timeout=300,
            )
            resp.raise_for_status()
        except requests.ConnectionError:
            raise RuntimeError(
                f"Cannot connect to Ollama at {self._base_url}. "
                "Make sure Ollama is running (`ollama serve`)."
            )
        except Exception as e:
            logger.error("Ollama request error: %s", e)
            raise RuntimeError(f"Ollama returned an error: {e}")

        data = resp.json()
        raw = (data.get("response") or "").strip()
        if not raw:
            raw = (data.get("thinking") or "").strip()
        if not raw and isinstance(data.get("message"), dict):
            raw = (data["message"].get("content") or "").strip()
        if not raw:
            raise RuntimeError("Ollama returned an empty response.")
        return raw

    def health_check(self) -> dict:
        """Ping Ollama and check if the model is available."""
        try:
            resp = requests.get(f"{self._base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            tags = resp.json()

            models = [m.get("name", "") for m in tags.get("models", [])]
            if not models:
                return {
                    "ok": False,
                    "provider": "ollama",
                    "model": self._model,
                    "detail": (
                        f"Ollama is running at {self._base_url}, but no models are installed. "
                        f"Pull a model with: ollama pull {self._model}"
                    ),
                }

            model_found = any(
                m == self._model or m.split(":")[0] == self._model.split(":")[0]
                for m in models
            )

            if model_found:
                active_model = next(
                    (m for m in models if m == self._model or m.split(":")[0] == self._model.split(":")[0]),
                    self._model,
                )
                return {
                    "ok": True,
                    "provider": "ollama",
                    "model": active_model,
                    "available_models": models,
                    "detail": f"Ollama running, model '{active_model}' available.",
                }
            else:
                fallback = models[0]
                return {
                    "ok": True,
                    "provider": "ollama",
                    "model": fallback,
                    "available_models": models,
                    "detail": (
                        f"Ollama running. Model '{self._model}' not found, but '{fallback}' is available. "
                        f"Using '{fallback}' for generation."
                    ),
                }
        except requests.ConnectionError:
            return {
                "ok": False,
                "provider": "ollama",
                "model": self._model,
                "detail": (
                    f"Cannot connect to Ollama at {self._base_url}. "
                    "Start it with: ollama serve"
                ),
            }
        except Exception as e:
            return {
                "ok": False,
                "provider": "ollama",
                "model": self._model,
                "detail": f"Ollama health check failed: {e}",
            }
