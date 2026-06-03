'use strict';

(function initSettingsPanel() {
  const INSTALLED_SHA = 'f59367c';
  const REPO          = 'ctrl07/imp-stuff';
  const BRANCH        = 'ext-only';

  function setStatus(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  async function checkForUpdate() {
    const btn = document.getElementById('st-check-btn');
    const dlRow = document.getElementById('st-download-row');
    btn.disabled = true;
    setStatus('st-update-status', 'Checking for updates…');
    dlRow.classList.add('hidden');

    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const latestSha = data.sha.slice(0, 7);
      setStatus('st-update-status', '');

      if (latestSha === INSTALLED_SHA) {
        showToast(`You're all set — this is the latest version (${INSTALLED_SHA}).`, 'success');
      } else {
        document.getElementById('st-download-link').href =
          `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;
        dlRow.classList.remove('hidden');
        showToast(`A new version is available (${latestSha}). You're on ${INSTALLED_SHA}.`, 'warning', 0);
      }
    } catch (err) {
      setStatus('st-update-status', '');
      showToast('Couldn\'t connect please check your connection and try again.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('st-version').textContent =
      `1.0.0 · ${INSTALLED_SHA}`;

    document.getElementById('st-check-btn').addEventListener('click', checkForUpdate);

    const defaultTabSelect = document.getElementById('st-default-tab');
    chrome.storage.sync.get('defaultTab', ({ defaultTab }) => {
      if (defaultTab) defaultTabSelect.value = defaultTab;
    });
    defaultTabSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ defaultTab: defaultTabSelect.value });
    });

    // Tab manager — all tabs
    const TAB_TOGGLES = [
      { id: 'st-tab-url-opener',  key: 'showTabLaunch',    def: true  },
      { id: 'st-tab-tools',       key: 'showTabTools',     def: true  },
      { id: 'st-tab-audit',       key: 'showTabAudit',     def: true  },
      { id: 'st-tab-screenshot',  key: 'betaScreenshot',   def: false },
      { id: 'st-tab-geocode',     key: 'betaGeocode',      def: false },
      { id: 'st-tab-timetracker', key: 'betaTimeTracker',  def: false },
      { id: 'st-tab-staff',      key: 'betaStaff',        def: false },
    ];
    const defaults = Object.fromEntries(TAB_TOGGLES.map(t => [t.key, t.def]));
    chrome.storage.sync.get(defaults, stored => {
      TAB_TOGGLES.forEach(({ id, key, def }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = stored[key] !== undefined ? !!stored[key] : def;
        el.addEventListener('change', () => chrome.storage.sync.set({ [key]: el.checked }));
      });
    });

    // Screenshot timing / behavior settings
    const settleSlider       = document.getElementById('st-sc-settle');
    const settleVal          = document.getElementById('st-sc-settle-val');
    const batchDelaySlider   = document.getElementById('st-sc-batch-delay');
    const batchDelayVal      = document.getElementById('st-sc-batch-delay-val');
    const widthSelect        = document.getElementById('st-sc-width');
    const maxHeightSelect    = document.getElementById('st-sc-max-height');
    const scaleSelect        = document.getElementById('st-sc-scale');
    const scrollStepSlider   = document.getElementById('st-sc-scroll-step');
    const scrollStepVal      = document.getElementById('st-sc-scroll-step-val');
    const scrollSettleSlider = document.getElementById('st-sc-scroll-settle');
    const scrollSettleVal    = document.getElementById('st-sc-scroll-settle-val');
    const imgWaitSlider      = document.getElementById('st-sc-img-wait');
    const imgWaitVal         = document.getElementById('st-sc-img-wait-val');

    chrome.storage.sync.get(
      {
        screenshotSettleMs: 2000, screenshotBatchDelayMs: 500,
        screenshotWidth: 1280, screenshotMaxHeight: 8000, screenshotScale: 1,
        screenshotScrollStepMs: 80, screenshotScrollSettleMs: 300, screenshotImgWaitMs: 3000,
      },
      ({ screenshotSettleMs, screenshotBatchDelayMs, screenshotWidth, screenshotMaxHeight, screenshotScale,
         screenshotScrollStepMs, screenshotScrollSettleMs, screenshotImgWaitMs }) => {
        settleSlider.value        = screenshotSettleMs;
        settleVal.textContent     = screenshotSettleMs + ' ms';
        batchDelaySlider.value    = screenshotBatchDelayMs;
        batchDelayVal.textContent = screenshotBatchDelayMs + ' ms';
        widthSelect.value         = screenshotWidth;
        maxHeightSelect.value     = screenshotMaxHeight;
        scaleSelect.value         = screenshotScale;
        scrollStepSlider.value    = screenshotScrollStepMs;
        scrollStepVal.textContent = screenshotScrollStepMs + ' ms';
        scrollSettleSlider.value    = screenshotScrollSettleMs;
        scrollSettleVal.textContent = screenshotScrollSettleMs + ' ms';
        imgWaitSlider.value       = screenshotImgWaitMs;
        imgWaitVal.textContent    = screenshotImgWaitMs + ' ms';
      }
    );

    settleSlider.addEventListener('input', () => {
      settleVal.textContent = settleSlider.value + ' ms';
      chrome.storage.sync.set({ screenshotSettleMs: Number(settleSlider.value) });
    });
    batchDelaySlider.addEventListener('input', () => {
      batchDelayVal.textContent = batchDelaySlider.value + ' ms';
      chrome.storage.sync.set({ screenshotBatchDelayMs: Number(batchDelaySlider.value) });
    });
    widthSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ screenshotWidth: Number(widthSelect.value) });
    });
    maxHeightSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ screenshotMaxHeight: Number(maxHeightSelect.value) });
    });
    scaleSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ screenshotScale: Number(scaleSelect.value) });
    });
    scrollStepSlider.addEventListener('input', () => {
      scrollStepVal.textContent = scrollStepSlider.value + ' ms';
      chrome.storage.sync.set({ screenshotScrollStepMs: Number(scrollStepSlider.value) });
    });
    scrollSettleSlider.addEventListener('input', () => {
      scrollSettleVal.textContent = scrollSettleSlider.value + ' ms';
      chrome.storage.sync.set({ screenshotScrollSettleMs: Number(scrollSettleSlider.value) });
    });
    imgWaitSlider.addEventListener('input', () => {
      imgWaitVal.textContent = imgWaitSlider.value + ' ms';
      chrome.storage.sync.set({ screenshotImgWaitMs: Number(imgWaitSlider.value) });
    });

    const showDownloadUrlsToggle = document.getElementById('st-show-download-urls');
    chrome.storage.sync.get('showDownloadUrls', ({ showDownloadUrls }) => {
      // default is true (shown); only false if explicitly set
      showDownloadUrlsToggle.checked = showDownloadUrls !== false;
    });
    showDownloadUrlsToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ showDownloadUrls: showDownloadUrlsToggle.checked });
    });

    const hideBetaBadgeToggle = document.getElementById('st-hide-beta-badge');
    chrome.storage.sync.get('hideBetaBadge', ({ hideBetaBadge }) => {
      hideBetaBadgeToggle.checked = !!hideBetaBadge;
    });
    hideBetaBadgeToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ hideBetaBadge: hideBetaBadgeToggle.checked });
    });

    const cmsToggle = document.getElementById('st-cms-outline');
    chrome.storage.sync.get('allowCmsOutline', ({ allowCmsOutline }) => {
      cmsToggle.checked = !!allowCmsOutline;
    });
    cmsToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ allowCmsOutline: cmsToggle.checked });
    });

    const muteToastToggle = document.getElementById('st-mute-toast');
    chrome.storage.sync.get('muteToast', ({ muteToast }) => {
      muteToastToggle.checked = !!muteToast;
    });
    muteToastToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ muteToast: muteToastToggle.checked });
    });

    const cacheBtnToggle = document.getElementById('st-cache-btn');
    chrome.storage.sync.get({ showCacheBtn: false }, ({ showCacheBtn }) => {
      cacheBtnToggle.checked = !!showCacheBtn;
    });
    cacheBtnToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ showCacheBtn: cacheBtnToggle.checked });
    });

    const hideOverlaysToggle = document.getElementById('st-hide-overlays');
    chrome.storage.sync.get({ hideOverlays: false }, ({ hideOverlays }) => {
      hideOverlaysToggle.checked = !!hideOverlays;
    });
    hideOverlaysToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ hideOverlays: hideOverlaysToggle.checked });
    });

    const DEFAULT_HIDE_SELECTORS = [
      '// CarNow',
      '#cn_chat_container',
      '#cnpoke',
      '// Podium',
      '#podium-website-widget',
      'iframe#podium-prompt',
      '// BoldChat / LivePerson',
      '#bc-chat-container',
      '.bcFloat',
      '.lp_minimized',
      '.lp_maximized',
      '// SnapABug',
      '#SnapABug_bImg',
      '#SnapABug_Button',
      '// Intercom',
      '#intercom-container',
      '.intercom-lightweight-app',
      '// Drift',
      '#drift-widget',
      '#drift-frame-container',
      '// Matador',
      '[class*="matador-livechat"]',
      '// Termly cookie button',
      '.termly-floating-preferences',
    ].join('\n');

    const hideSelectorsArea = document.getElementById('st-hide-selectors');
    chrome.storage.sync.get({ hideSelectors: null }, ({ hideSelectors }) => {
      if (hideSelectors === null) {
        hideSelectorsArea.value = DEFAULT_HIDE_SELECTORS;
        chrome.storage.sync.set({ hideSelectors: DEFAULT_HIDE_SELECTORS });
      } else {
        hideSelectorsArea.value = hideSelectors;
      }
    });
    let hideSelectorsSaveTimer = null;
    hideSelectorsArea.addEventListener('input', () => {
      clearTimeout(hideSelectorsSaveTimer);
      hideSelectorsSaveTimer = setTimeout(() => {
        chrome.storage.sync.set({ hideSelectors: hideSelectorsArea.value });
      }, 600);
    });

    const THEME_DEFAULTS = {
      bgColor:      '#13191f',
      accentColor:  '#e8e8e8',
      outlineColor: '#f5a623',
      altHasColor:  '#4caf50',
      altNoColor:   '#f44336',
      inputColor:   '#1c2433',
    };

    const bgColorInput      = document.getElementById('st-bg-color');
    const accentColorInput  = document.getElementById('st-accent-color');
    const outlineColorInput = document.getElementById('st-outline-color');
    const altHasColorInput  = document.getElementById('st-alt-has-color');
    const altNoColorInput   = document.getElementById('st-alt-no-color');
    const inputColorInput   = document.getElementById('st-input-color');

    chrome.storage.sync.get(Object.keys(THEME_DEFAULTS), ({ bgColor, accentColor, outlineColor, altHasColor, altNoColor, inputColor }) => {
      if (bgColor)      bgColorInput.value      = bgColor;
      if (accentColor)  accentColorInput.value  = accentColor;
      if (outlineColor) outlineColorInput.value = outlineColor;
      if (altHasColor)  altHasColorInput.value  = altHasColor;
      if (altNoColor)   altNoColorInput.value   = altNoColor;
      if (inputColor)   inputColorInput.value   = inputColor;
    });
    bgColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ bgColor: bgColorInput.value });
    });
    accentColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ accentColor: accentColorInput.value });
    });
    outlineColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ outlineColor: outlineColorInput.value });
    });
    altHasColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ altHasColor: altHasColorInput.value });
    });
    altNoColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ altNoColor: altNoColorInput.value });
    });
    inputColorInput.addEventListener('change', () => {
      chrome.storage.sync.set({ inputColor: inputColorInput.value });
    });

    document.getElementById('st-reset-theme').addEventListener('click', () => {
      chrome.storage.sync.remove(Object.keys(THEME_DEFAULTS), () => {
        // Reset pickers to default values
        bgColorInput.value      = THEME_DEFAULTS.bgColor;
        accentColorInput.value  = THEME_DEFAULTS.accentColor;
        outlineColorInput.value = THEME_DEFAULTS.outlineColor;
        altHasColorInput.value  = THEME_DEFAULTS.altHasColor;
        altNoColorInput.value   = THEME_DEFAULTS.altNoColor;
        inputColorInput.value   = THEME_DEFAULTS.inputColor;

        // Remove CSS overrides so Pico defaults take over
        const root = document.documentElement;
        ['--tars-accent', '--tars-bg', '--tars-input-bg',
         '--pico-primary', '--pico-secondary',
         '--pico-background-color', '--pico-card-background-color',
         '--pico-form-element-active-border-color',
        ].forEach(prop => root.style.removeProperty(prop));

        showToast('Theme reset to defaults.', 'success');
      });
    });
  });
})();
