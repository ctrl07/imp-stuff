'use strict';

function el(id) {
  return document.getElementById(id);
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
});
