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

    const betaAuditToggle   = document.getElementById('st-beta-audit');
    const betaMigrateToggle = document.getElementById('st-beta-migrate');
    chrome.storage.sync.get(['betaAudit', 'betaMigrate'], ({ betaAudit, betaMigrate }) => {
      betaAuditToggle.checked   = !!betaAudit;
      betaMigrateToggle.checked = !!betaMigrate;
    });
    betaAuditToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ betaAudit: betaAuditToggle.checked });
    });
    betaMigrateToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ betaMigrate: betaMigrateToggle.checked });
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

    const renamePdfToggle = document.getElementById('st-rename-pdf');
    chrome.storage.sync.get('renamePdfDownloads', ({ renamePdfDownloads }) => {
      renamePdfToggle.checked = !!renamePdfDownloads;
    });
    renamePdfToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ renamePdfDownloads: renamePdfToggle.checked });
    });

    const muteToastToggle = document.getElementById('st-mute-toast');
    chrome.storage.sync.get('muteToast', ({ muteToast }) => {
      muteToastToggle.checked = !!muteToast;
    });
    muteToastToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ muteToast: muteToastToggle.checked });
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
