"""Staff page scraper — extracts name, title, phone, email, bio, image per staff member."""

import asyncio
import re
import unicodedata
import zipfile
import io
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup, Tag

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
}

_PHONE_RE = re.compile(r'(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})')
_EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')


def _slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^\w\s-]', '', s).strip().lower()
    return re.sub(r'[\s_]+', '-', s)


def _text(tag) -> str:
    return tag.get_text(separator=' ', strip=True) if tag else ''


def _parse_staff(html: str, base_url: str) -> list[dict[str, Any]]:
    """
    Heuristic staff card parser.
    Looks for repeated structural blocks containing a name + at least one of
    phone/email/image. Falls back to a flat scan if no cards found.
    """
    from urllib.parse import urljoin

    soup = BeautifulSoup(html, 'lxml')

    # Remove nav/header/footer noise
    for tag in soup.select('nav, header, footer, script, style'):
        tag.decompose()

    # Common card selectors used by DealerOn / typical dealer sites
    CARD_SELECTORS = [
        '.staff-member', '.team-member', '.employee', '.person',
        '[class*="staff"]', '[class*="team-member"]', '[class*="employee"]',
        'article', '.card',
    ]

    cards: list[Tag] = []
    for sel in CARD_SELECTORS:
        found = soup.select(sel)
        if len(found) >= 2:
            cards = found
            break

    staff = []
    seen_names: set[str] = set()

    def _extract_card(block: Tag) -> dict[str, Any] | None:
        text = _text(block)
        phones = _PHONE_RE.findall(text)
        emails = _EMAIL_RE.findall(text)

        # Name: first heading or strong inside card
        name_tag = block.find(['h1', 'h2', 'h3', 'h4', 'strong', 'b'])
        name = _text(name_tag) if name_tag else ''
        if not name or name in seen_names:
            return None
        seen_names.add(name)

        # Job title: second heading, or element with class containing 'title'/'position'/'role'
        title_tag = block.find(class_=re.compile(r'title|position|role|job', re.I))
        if not title_tag and name_tag:
            # try next sibling heading
            for sib in name_tag.find_next_siblings(['h1', 'h2', 'h3', 'h4', 'p', 'span']):
                t = _text(sib)
                if t and t != name:
                    title_tag = sib
                    break
        job_title = _text(title_tag) if title_tag else ''

        # Bio: longest <p> in the card
        paras = [_text(p) for p in block.find_all('p') if len(_text(p)) > 40]
        bio = max(paras, key=len) if paras else ''

        # Image
        img_tag = block.find('img')
        img_url = ''
        if img_tag:
            src = img_tag.get('data-src') or img_tag.get('src') or ''
            if src and not src.startswith('data:'):
                img_url = urljoin(base_url, src)

        return {
            'name':      name,
            'title':     job_title,
            'phone':     phones[0] if phones else '',
            'email':     emails[0] if emails else '',
            'bio':       bio,
            'image_url': img_url,
        }

    for card in cards:
        entry = _extract_card(card)
        if entry:
            staff.append(entry)

    return staff


async def _download_image(
    client: httpx.AsyncClient,
    url: str,
    filename: str,
) -> tuple[str, bytes | None]:
    try:
        r = await client.get(url, timeout=15, follow_redirects=True)
        if r.status_code == 200:
            return filename, r.content
    except Exception:
        pass
    return filename, None


async def parse_and_package(html: str, base_url: str) -> dict[str, Any]:
    """Parse staff cards from HTML, download images, return ZIP bytes.
    Called by both scrape() and the extension 403 fallback path."""
    staff = _parse_staff(html, base_url)
    if not staff:
        return {'staff': [], 'error': 'No staff cards detected on this page.', 'zip': None}

    # Download images in parallel
    async with httpx.AsyncClient(headers=HEADERS) as client:
        tasks = []
        for member in staff:
            if member['image_url']:
                slug = _slugify(member['name']) or 'staff'
                ext = member['image_url'].rsplit('.', 1)[-1].split('?')[0][:4] or 'jpg'
                fname = f'{slug}.{ext}'
                member['image_filename'] = fname
                tasks.append(_download_image(client, member['image_url'], fname))
            else:
                member['image_filename'] = ''
        image_results = await asyncio.gather(*tasks)

    images: dict[str, bytes] = {fname: data for fname, data in image_results if data}

    # Build CSV
    import csv, io as _io
    buf = _io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=['name', 'title', 'phone', 'email', 'bio', 'image_filename'])
    writer.writeheader()
    for m in staff:
        writer.writerow({k: m.get(k, '') for k in writer.fieldnames})
    csv_bytes = buf.getvalue().encode('utf-8-sig')

    # Build ZIP in memory
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('staff.csv', csv_bytes)
        for fname, data in images.items():
            zf.writestr(f'images/{fname}', data)
    zip_bytes = zip_buf.getvalue()

    return {'staff': staff, 'error': '', 'zip': zip_bytes}


async def scrape(url: str) -> dict[str, Any]:
    """Fetch URL with httpx then parse. Raises httpx.HTTPStatusError on 4xx/5xx."""
    async with httpx.AsyncClient(headers=HEADERS) as client:
        r = await client.get(url, timeout=20, follow_redirects=True)
        r.raise_for_status()
    return await parse_and_package(r.text, url)
