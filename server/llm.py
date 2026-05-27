"""Ollama local-LLM client for TARS backend.

All functions are async and return empty strings / False on any error so
callers can treat LLM as a best-effort enhancement with zero required setup.
"""

import ollama

from . import config as cfg


async def chat(prompt: str) -> str:
    """Send a single-turn prompt to Ollama. Returns '' on any failure."""
    if not cfg.llm_enabled():
        return ''
    try:
        client = ollama.AsyncClient(
            host=cfg.ollama_url(),
            timeout=cfg.llm_timeout(),
        )
        response = await client.generate(
            model=cfg.llm_model(),
            prompt=prompt,
        )
        return (response.response or '').strip()
    except Exception:
        return ''


async def is_available() -> bool:
    """Return True if Ollama is running and the configured model is pulled."""
    try:
        client = ollama.AsyncClient(host=cfg.ollama_url(), timeout=5)
        result = await client.list()
        model = cfg.llm_model()
        return any(
            m.model.startswith(model)
            for m in (result.models or [])
        )
    except Exception:
        return False
