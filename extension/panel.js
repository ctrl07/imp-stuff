'use strict';

// Globals (used by all panel scripts)

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

// Panel init

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

  function applyBetaTab(tabId, pageId, enabled) {
    const tab = document.getElementById(tabId);
    if (enabled) {
      tab?.classList.remove('hidden');
    } else {
      tab?.classList.add('hidden');
      if (tab?.classList.contains('active')) {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
        document.getElementById(pageId)?.classList.add('hidden');
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
      root.style.setProperty('--pico-form-element-active-border-color', color);
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

  function applyInputBg(color) {
    if (color) document.documentElement.style.setProperty('--tars-input-bg', color);
  }

  function applyHideBetaBadges(hide) {
    document.body.classList.toggle('hide-beta-badges', !!hide);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    chrome.storage.sync.get(['muteToast', 'betaScreenshot', 'betaGeocode', 'betaTimeTracker', 'betaServer', 'hideBetaBadge', 'defaultTab', 'accentColor', 'bgColor', 'inputColor'], ({ muteToast, betaScreenshot, betaGeocode, betaTimeTracker, betaServer, hideBetaBadge, defaultTab, accentColor, bgColor, inputColor }) => {
      _muteToast = !!muteToast;
      applyBetaTab('tab-screenshot',   'page-screenshot',   !!betaScreenshot);
      applyBetaTab('tab-geocode',      'page-geocode',      !!betaGeocode);
      applyBetaTab('tab-timetracker',  'page-timetracker',  !!betaTimeTracker);
      applyBetaTab('tab-server',       'page-server',       !!betaServer);
      applyHideBetaBadges(!!hideBetaBadge);
      applyAccent(accentColor);
      applyBg(bgColor);
      applyInputBg(inputColor);
      // Apply default tab — only if the tab is visible (not hidden by beta gate)
      if (defaultTab) {
        const tabBtn = document.querySelector(`.page-tab[data-page="${defaultTab}"]:not(.hidden)`);
        if (tabBtn) tabBtn.click();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if ('muteToast'    in changes) _muteToast = !!changes.muteToast.newValue;
      if ('betaScreenshot'  in changes) applyBetaTab('tab-screenshot',  'page-screenshot',  !!changes.betaScreenshot.newValue);
      if ('betaGeocode'     in changes) applyBetaTab('tab-geocode',     'page-geocode',     !!changes.betaGeocode.newValue);
      if ('betaTimeTracker' in changes) applyBetaTab('tab-timetracker', 'page-timetracker', !!changes.betaTimeTracker.newValue);
      if ('betaServer'      in changes) applyBetaTab('tab-server',      'page-server',      !!changes.betaServer.newValue);
      if ('hideBetaBadge' in changes) applyHideBetaBadges(!!changes.hideBetaBadge.newValue);
      if ('accentColor'  in changes) applyAccent(changes.accentColor.newValue);
      if ('bgColor'      in changes) applyBg(changes.bgColor.newValue);
      if ('inputColor'   in changes) applyInputBg(changes.inputColor.newValue);
    });
  });
})();
