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

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen3.5:4b"):
        self._base_url = base_url.rstrip("/")
        self._model = model

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    def generate(self, prompt: str) -> str:
        url = f"{self._base_url}/api/generate"
        try:
            resp = requests.post(
                url,
                json={
                    "model": self._model,
                    "prompt": prompt,
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 600,
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
        raw = data.get("response", "")
        if not raw:
            raise RuntimeError("Ollama returned an empty response.")
        return raw

    def health_check(self) -> dict:
        """Ping Ollama and check if the model is available."""
        try:
            # Check server is up
            resp = requests.get(f"{self._base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            tags = resp.json()

            # Check our model exists
            models = [m.get("name", "") for m in tags.get("models", [])]
            # Ollama model names can be "qwen3.5:4b" or "qwen3.5:4b-latest"
            model_found = any(
                m == self._model or m.startswith(f"{self._model}")
                for m in models
            )

            if model_found:
                return {
                    "ok": True,
                    "provider": "ollama",
                    "model": self._model,
                    "detail": f"Ollama running, model '{self._model}' available.",
                }
            else:
                available = ", ".join(models[:5]) or "none"
                return {
                    "ok": False,
                    "provider": "ollama",
                    "model": self._model,
                    "detail": (
                        f"Ollama running but model '{self._model}' not found. "
                        f"Available: {available}. "
                        f"Pull it with: ollama pull {self._model}"
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
