(function() {
  'use strict';

  function applyVisibility(show) {
    const btn = document.getElementById('cache-clear-button');
    if (btn) btn.style.display = show ? 'flex' : 'none';
  }

  // Respect the Settings toggle — default off
  chrome.storage.sync.get({ showCacheBtn: false }, ({ showCacheBtn }) => {
    if (!showCacheBtn) return;
    inject();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !('showCacheBtn' in changes)) return;
    const show = !!changes.showCacheBtn.newValue;
    if (show && !document.getElementById('cache-clear-button')) {
      inject();
    } else {
      applyVisibility(show);
    }
  });

  function inject() {
  // Prevent duplicate button
  if (document.getElementById('cache-clear-button')) return;

  const style = document.createElement('style');
  style.textContent = `
    #cache-clear-button {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      padding: 4px;
      width: 36px;
      height: 36px;
      background: #888d94ff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0.68;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    #cache-clear-button:hover {
      opacity: 1.0;
    }
    #cache-clear-icon {
      width: 22px;
      height: 22px;
      display: block;
    }
    `;
  document.head.appendChild(style);
  // Use your SVG as icon (color set to white for contrast)
  const btn = document.createElement('button');
  btn.id = 'cache-clear-button';
  btn.type = 'button';
  btn.title = 'Clear Cache';
  btn.innerHTML = `
    <svg id="cache-clear-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#fff" d="m19 8l-4 4h3a6 6 0 0 1-6 6c-1 0-1.97-.25-2.8-.7l-1.46 1.46A7.93 7.93 0 0 0 12 20a8 8 0 0 0 8-8h3M6 12a6 6 0 0 1 6-6c1 0 1.97.25 2.8.7l1.46-1.46A7.93 7.93 0 0 0 12 4a8 8 0 0 0-8 8H1l4 4l4-4"/>
    </svg>
  `;
  btn.onclick = function() {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', Math.random().toString(36).slice(2, 8));
    window.location.href = url.toString();
  };
  document.body.appendChild(btn);
  } // end inject
})();
