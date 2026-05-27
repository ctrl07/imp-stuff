import json
import os
from pathlib import Path


def load() -> dict:
    p = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'TARS' / 'config.json'
    if p.exists():
        return json.loads(p.read_text(encoding='utf-8')) or {}
    return {}


_cfg = None


def get() -> dict:
    global _cfg
    if _cfg is None:
        _cfg = load()
    return _cfg


def chrome_debug_url() -> str:
    return get().get('chrome', {}).get('debug_url', 'http://localhost:9222')


def output_dir() -> Path:
    raw = get().get('output_dir', '')
    if raw:
        return Path(os.path.expandvars(raw))
    return Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'TARS' / 'out'


def backend_port() -> int:
    return int(get().get('backend', {}).get('port', 8765))


def backend_token() -> str:
    return get().get('backend', {}).get('token', '')
