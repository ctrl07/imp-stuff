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


def _parse_staff(
    html: str,
    base_url: str,
    selectors: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], list[Tag]]:
    """
    Heuristic staff card parser.
    Pass `selectors` to override any step with an explicit CSS selector:
      card, name, title, phone, email, bio, image
    """
    from urllib.parse import urljoin

    sel = selectors or {}
    soup = BeautifulSoup(html, 'lxml')

    # Remove nav/header/footer noise
    for tag in soup.select('nav, header, footer, script, style'):
        tag.decompose()

    # --- Card discovery ---
    if sel.get('card'):
        cards: list[Tag] = soup.select(sel['card'])
    else:
        CARD_SELECTORS = [
            '.staff-member', '.team-member', '.employee', '.person',
            '[class*="staff"]', '[class*="team-member"]', '[class*="employee"]',
            'article', '.card',
        ]
        cards = []
        for cs in CARD_SELECTORS:
            found = soup.select(cs)
            if len(found) >= 2:
                cards = found
                break

    staff: list[dict[str, Any]] = []
    seen_names: set[str] = set()

    def _extract_card(block: Tag) -> dict[str, Any] | None:
        text = _text(block)

        # Phone — selector or regex fallback
        if sel.get('phone'):
            phone_tag = block.select_one(sel['phone'])
            phone = _text(phone_tag) if phone_tag else ''
        else:
            phones = _PHONE_RE.findall(text)
            phone = phones[0] if phones else ''

        # Email — selector or regex fallback
        if sel.get('email'):
            email_tag = block.select_one(sel['email'])
            email = _text(email_tag) if email_tag else ''
        else:
            emails = _EMAIL_RE.findall(text)
            email = emails[0] if emails else ''

        # Name
        if sel.get('name'):
            name_tag = block.select_one(sel['name'])
        else:
            name_tag = block.find(['h1', 'h2', 'h3', 'h4', 'strong', 'b'])
        name = _text(name_tag) if name_tag else ''
        if not name or name in seen_names:
            return None
        seen_names.add(name)

        # Title
        if sel.get('title'):
            title_tag = block.select_one(sel['title'])
        else:
            title_tag = block.find(class_=re.compile(r'title|position|role|job', re.I))
            if not title_tag and name_tag:
                for sib in name_tag.find_next_siblings(['h1', 'h2', 'h3', 'h4', 'p', 'span']):
                    t = _text(sib)
                    if t and t != name:
                        title_tag = sib
                        break
        job_title = _text(title_tag) if title_tag else ''

        # Bio
        if sel.get('bio'):
            bio_tag = block.select_one(sel['bio'])
            bio = _text(bio_tag) if bio_tag else ''
        else:
            paras = [_text(p) for p in block.find_all('p') if len(_text(p)) > 40]
            bio = max(paras, key=len) if paras else ''

        # Image
        img_tag = block.select_one(sel['image']) if sel.get('image') else block.find('img')
        img_url = ''
        if img_tag:
            src = img_tag.get('data-src') or img_tag.get('src') or ''
            if src and not src.startswith('data:'):
                img_url = urljoin(base_url, src)

        return {
            'name':      name,
            'title':     job_title,
            'phone':     phone,
            'email':     email,
            'bio':       bio,
            'image_url': img_url,
        }

    matched_cards: list[Tag] = []
    for card in cards:
        entry = _extract_card(card)
        if entry:
            staff.append(entry)
            matched_cards.append(card)

    return staff, matched_cards


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


async def parse_and_package(
    html: str,
    base_url: str,
    selectors: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Parse staff cards from HTML, download images, return ZIP bytes.
    Called by both scrape() and the extension 403 fallback path."""
    sel = selectors or {}
    staff, _ = _parse_staff(html, base_url, sel)

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


async def scrape(url: str, selectors: dict[str, str] | None = None) -> dict[str, Any]:
    """Fetch URL with httpx then parse. Raises httpx.HTTPStatusError on 4xx/5xx."""
    async with httpx.AsyncClient(headers=HEADERS) as client:
        r = await client.get(url, timeout=20, follow_redirects=True)
        r.raise_for_status()
    return await parse_and_package(r.text, url, selectors)
