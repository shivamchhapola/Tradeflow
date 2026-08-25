"""
Tradeflow — LLM Provider Interface & Factory

Abstracts LLM inference behind a common interface so the report engine
doesn't care whether we're hitting Ollama, Groq, or a future provider.
"""

import logging
from abc import ABC, abstractmethod

from settings import get_settings

logger = logging.getLogger("tradeflow.llm")


class LLMProvider(ABC):
    """Base class for all LLM providers."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Send a prompt, return raw text response."""
        ...

    @abstractmethod
    def health_check(self) -> dict:
        """
        Return provider health status.
        Shape: {"ok": bool, "provider": str, "model": str, "detail": str}
        """
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        ...


def get_llm_provider() -> LLMProvider:
    """
    Factory: read settings.json and return the appropriate provider instance.
    Called on every report request — no stale singletons.
    """
    settings = get_settings()
    llm = settings.get("llm", {})
    provider = llm.get("provider", "ollama")

    if provider == "groq":
        from llm.groq import GroqProvider
        return GroqProvider(
            api_key=llm.get("groq_api_key", ""),
            model=llm.get("groq_model", "llama-3.1-8b-instant"),
            base_url=llm.get("groq_base_url", "https://api.groq.com/openai/v1"),
        )

    # Default: Ollama
    from llm.ollama import OllamaProvider
    return OllamaProvider(
        base_url=llm.get("ollama_base_url", "http://localhost:11434"),
        model=llm.get("ollama_model", "qwen3.5:4b"),
    )
