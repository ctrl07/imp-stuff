'use strict';

// ── Globals (used by all panel scripts) ───────────────────────────────────────

function el(id) {
  return document.getElementById(id);
}

let _muteToast = false;

function showToast(msg, type = 'info', duration = 3000) {
  if (_muteToast) return () => {};
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const text = document.createElement('span');
  text.textContent = msg;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '×';

  const dismiss = () => toast.remove();
  close.addEventListener('click', dismiss);
  toast.appendChild(text);
  toast.appendChild(close);
  container.appendChild(toast);

  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}

// ── Panel init ────────────────────────────────────────────────────────────────

(function initPanel() {
  function initTabs() {
    const tabs = document.querySelectorAll('.page-tab[data-page]');
    const pages = document.querySelectorAll('.page');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        pages.forEach(p => p.classList.add('hidden'));

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const target = document.getElementById('page-' + tab.dataset.page);
        if (target) target.classList.remove('hidden');
      });
    });
  }

  function applyBetaFeatures(enabled) {
    const tab = document.getElementById('tab-compare');
    const themeFieldset = document.getElementById('st-theme-fieldset');
    if (enabled) {
      tab?.classList.remove('hidden');
      themeFieldset?.classList.remove('hidden');
    } else {
      tab?.classList.add('hidden');
      themeFieldset?.classList.add('hidden');
      // If currently on a beta tab, fall back to Launch
      if (tab?.classList.contains('active')) {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
        document.getElementById('page-compare')?.classList.add('hidden');
        const first = document.querySelector('.page-tab:not(.hidden)');
        if (first) first.click();
      }
    }
  }

  function applyAccent(color) {
    const root = document.documentElement;
    if (color) {
      root.style.setProperty('--tars-accent', color);
      root.style.setProperty('--pico-primary', color);
      root.style.setProperty('--pico-secondary', color);
    }
  }

  function applyBg(color) {
    const root = document.documentElement;
    if (color) {
      root.style.setProperty('--tars-bg', color);
      root.style.setProperty('--pico-background-color', color);
      root.style.setProperty('--pico-card-background-color', color);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    chrome.storage.sync.get(['muteToast', 'betaFeatures', 'accentColor', 'bgColor'], ({ muteToast, betaFeatures, accentColor, bgColor }) => {
      _muteToast = !!muteToast;
      applyBetaFeatures(!!betaFeatures);
      applyAccent(accentColor);
      applyBg(bgColor);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if ('muteToast' in changes) _muteToast = !!changes.muteToast.newValue;
      if ('betaFeatures' in changes) applyBetaFeatures(!!changes.betaFeatures.newValue);
      if ('accentColor' in changes) applyAccent(changes.accentColor.newValue);
      if ('bgColor' in changes) applyBg(changes.bgColor.newValue);
    });
  });
})();
