'use strict';

function removeOverlays() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  document.querySelectorAll('*').forEach(el => {
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;

    const pos = s.position;
    const z   = parseInt(s.zIndex) || 0;

    // Fixed: z-index >= 100 catches chat panels, banners, modals
    // Absolute: z-index >= 1000 — higher threshold avoids removing normal layout elements
    //           (Termly cookie button uses position:absolute + z-index:999999)
    const qualifies = (pos === 'fixed' && z >= 100) || (pos === 'absolute' && z >= 1000);
    if (!qualifies) return;

    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) return;

    // Preserve full-width top nav bars (fixed, anchored at top, spans ≥80% viewport)
    if (pos === 'fixed' && r.top <= 80 && r.width >= vw * 0.8) return;

    el.remove();
  });
}

function applyCustomSelectors(selectors) {
  selectors.forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach(el => el.remove());
    } catch { /* invalid selector — skip */ }
  });
}

chrome.storage.sync.get({ hideOverlays: false, hideSelectors: '' }, ({ hideOverlays, hideSelectors }) => {
  const customSelectors = (hideSelectors || '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('//'));

  const hasCustom = customSelectors.length > 0;
  if (!hideOverlays && !hasCustom) return;

  function sweep() {
    if (hideOverlays) removeOverlays();
    if (hasCustom)    applyCustomSelectors(customSelectors);
  }

  // Initial sweep + body scroll-lock cleanup
  sweep();
  if (hideOverlays) {
    document.body.classList.remove(
      'modal-open', 'overflow-hidden', 'noscroll', 'no-scroll', 'scroll-lock', 'body-locked'
    );
    document.body.style.removeProperty('overflow');
  }

  // Timed retries — catch widgets that initialise after document_idle
  setTimeout(sweep, 800);
  setTimeout(sweep, 2500);
  setTimeout(sweep, 5000);

  // MutationObserver for dynamically injected nodes — debounced
  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(sweep, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => { observer.disconnect(); clearTimeout(timer); }, 15_000);
});
