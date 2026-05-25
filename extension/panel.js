'use strict';

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

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  chrome.storage.sync.get('muteToast', ({ muteToast }) => {
    _muteToast = !!muteToast;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && 'muteToast' in changes) {
      _muteToast = !!changes.muteToast.newValue;
    }
  });
});
