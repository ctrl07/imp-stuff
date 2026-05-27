"""Bulk SEO extraction — HTML supplied by extension (fetched via Chrome tab)."""

import asyncio
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}


def _extract_from_soup(soup, url: str) -> dict[str, Any]:
    title = (soup.find('title') or soup.new_tag('x')).get_text(strip=True)

    desc_tag = soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)})
    description = (desc_tag or {}).get('content', '') if desc_tag else ''

    h1_tag = soup.find('h1')
    h1 = h1_tag.get_text(strip=True) if h1_tag else ''

    canonical_tag = soup.find('link', rel='canonical')
    canonical = canonical_tag.get('href', '') if canonical_tag else ''

    robots_tag = soup.find('meta', attrs={'name': re.compile(r'^robots$', re.I)})
    robots = (robots_tag or {}).get('content', '') if robots_tag else ''

    return {
        'url':         url,
        'title':       title,
        'description': description,
        'h1':          h1,
        'canonical':   canonical,
        'robots':      robots,
        'error':       '',
    }


def _extract_custom(soup, url: str, fields: list[dict]) -> dict[str, Any]:
    result: dict[str, Any] = {'url': url, 'error': ''}
    for f in fields:
        if not f.get('enabled', True):
            continue
        key = f.get('key') or 'field'
        sel = f.get('selector', '')
        attr = f.get('attr', '')
        if not sel:
            result[key] = ''
            continue
        if f.get('multiple', False):
            result[key] = ', '.join(
                t.get(attr, '') if attr else t.get_text(strip=True)
                for t in soup.select(sel) if t
            )
        else:
            tag = soup.select_one(sel)
            result[key] = (tag.get(attr, '') if attr else tag.get_text(strip=True)) if tag else ''
    return result


def parse_one(html: str, url: str, fields: list[dict] | None = None) -> dict[str, Any]:
    """Parse SEO fields from pre-fetched HTML. Pass fields for custom extraction."""
    soup = BeautifulSoup(html, 'lxml')
    return _extract_custom(soup, url, fields) if fields else _extract_from_soup(soup, url)


async def _fetch_one(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    try:
        r = await client.get(url, timeout=15, follow_redirects=True)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')
        return _extract_from_soup(soup, url)
    except Exception as exc:
        return {'url': url, 'title': '', 'description': '', 'h1': '',
                'canonical': '', 'robots': '', 'error': str(exc)}


async def bulk_extract(urls: list[str], on_progress=None) -> list[dict[str, Any]]:
    results = []
    async with httpx.AsyncClient(headers=HEADERS) as client:
        tasks = [_fetch_one(client, u) for u in urls]
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            result = await coro
            results.append(result)
            if on_progress:
                on_progress(i + 1, len(urls))
    return results
