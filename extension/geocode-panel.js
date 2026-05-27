'use strict';

(function initGeocodePanel() {

  const NOMINATIM_HEADERS = { 'User-Agent': 'TARS-Extension', 'Accept-Language': 'en-US,en' };

  function setStatus(id, msg, isError) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = msg;
    node.style.color = isError ? 'var(--pico-del-color, #f44336)' : '';
  }

  function hideResult(id) {
    const node = document.getElementById(id);
    if (node) { node.innerHTML = ''; node.classList.add('hidden'); }
  }

  function copyRow(label, value) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;padding:0.15rem 0;border-bottom:1px solid var(--pico-card-border-color)';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:var(--pico-muted-color);font-size:0.75rem;flex-shrink:0';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.style.cssText = 'font-family:var(--pico-font-family-monospace,monospace);font-size:0.82rem;word-break:break-all;cursor:pointer;text-align:right';
    val.title = 'Click to copy';
    val.textContent = value;
    val.addEventListener('click', () => {
      navigator.clipboard.writeText(value).then(() => showToast(`Copied: ${value}`, 'success'));
    });

    row.appendChild(lbl);
    row.appendChild(val);
    return row;
  }

  function showFwdResult(containerId, result) {
    const node = document.getElementById(containerId);
    if (!node) return;
    node.innerHTML = '';
    node.classList.remove('hidden');

    const lat  = result.lat;
    const lng  = result.lon;
    const addr = result.address || {};

    node.appendChild(copyRow('Latitude',  lat));
    node.appendChild(copyRow('Longitude', lng));
    node.appendChild(copyRow('Lat, Lng',  `${lat}, ${lng}`));

    if (result.display_name) {
      node.appendChild(copyRow('Full address', result.display_name));
    }

    const parts = [
      addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : (addr.road || null),
      addr.city || addr.town || addr.village || null,
      addr.state || null,
      addr.postcode || null,
    ].filter(Boolean);

    if (parts.length) {
      const sub = document.createElement('div');
      sub.style.cssText = 'margin-top:0.3rem;font-size:0.72rem;color:var(--pico-muted-color)';
      sub.textContent = parts.join(', ');
      node.appendChild(sub);
    }
  }

  function showRevResult(containerId, result) {
    const node = document.getElementById(containerId);
    if (!node) return;
    node.innerHTML = '';
    node.classList.remove('hidden');

    const addr = result.address || {};

    if (result.display_name) {
      node.appendChild(copyRow('Full address', result.display_name));
    }

    const street = addr.house_number && addr.road
      ? `${addr.house_number} ${addr.road}`
      : (addr.road || null);
    if (street)        node.appendChild(copyRow('Street',  street));

    const city = addr.city || addr.town || addr.village;
    if (city)          node.appendChild(copyRow('City',    city));
    if (addr.state)    node.appendChild(copyRow('State',   addr.state));
    if (addr.postcode) node.appendChild(copyRow('ZIP',     addr.postcode));
    if (addr.county)   node.appendChild(copyRow('County',  addr.county));
  }

  document.addEventListener('DOMContentLoaded', () => {

    // Forward: address → lat/long
    el('gc-fwd-btn').addEventListener('click', async () => {
      const address = el('gc-address-input').value.trim();
      if (!address) { showToast('Enter an address.', 'warning'); return; }

      setStatus('gc-fwd-status', 'Looking up…', false);
      hideResult('gc-fwd-result');
      el('gc-fwd-btn').disabled = true;

      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&countrycodes=us&limit=1&addressdetails=1`;
        const res  = await fetch(url, { headers: NOMINATIM_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.length) {
          setStatus('gc-fwd-status', 'No results found for this address.', true);
          return;
        }

        // Open Google Maps with the address
        chrome.tabs.create({ url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, active: false });

        setStatus('gc-fwd-status', '', false);
        showFwdResult('gc-fwd-result', data[0]);
      } catch (err) {
        setStatus('gc-fwd-status', `Error: ${err.message}`, true);
      } finally {
        el('gc-fwd-btn').disabled = false;
      }
    });

    // Reverse: lat/long → address
    el('gc-rev-btn').addEventListener('click', async () => {
      const lat = el('gc-lat-input').value.trim();
      const lng = el('gc-lng-input').value.trim();
      if (!lat || !lng) { showToast('Enter both latitude and longitude.', 'warning'); return; }

      setStatus('gc-rev-status', 'Looking up…', false);
      hideResult('gc-rev-result');
      el('gc-rev-btn').disabled = true;

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`;
        const res  = await fetch(url, { headers: NOMINATIM_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.error) {
          setStatus('gc-rev-status', 'No address found for these coordinates.', true);
          return;
        }

        // Open Google Maps at the coordinates
        chrome.tabs.create({ url: `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`, active: false });

        setStatus('gc-rev-status', '', false);
        showRevResult('gc-rev-result', data);
      } catch (err) {
        setStatus('gc-rev-status', `Error: ${err.message}`, true);
      } finally {
        el('gc-rev-btn').disabled = false;
      }
    });

    // Clear buttons
    el('gc-fwd-clear').addEventListener('click', () => {
      el('gc-address-input').value = '';
      setStatus('gc-fwd-status', '', false);
      hideResult('gc-fwd-result');
    });

    el('gc-rev-clear').addEventListener('click', () => {
      el('gc-lat-input').value = '';
      el('gc-lng-input').value = '';
      setStatus('gc-rev-status', '', false);
      hideResult('gc-rev-result');
    });

    // Enter key on address input
    el('gc-address-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') el('gc-fwd-btn').click();
    });
  });
})();
