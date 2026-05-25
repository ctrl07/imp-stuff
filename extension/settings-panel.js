'use strict';

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

  const altHasColorInput = document.getElementById('st-alt-has-color');
  const altNoColorInput  = document.getElementById('st-alt-no-color');
  chrome.storage.sync.get(['altHasColor', 'altNoColor'], ({ altHasColor, altNoColor }) => {
    if (altHasColor) altHasColorInput.value = altHasColor;
    if (altNoColor)  altNoColorInput.value  = altNoColor;
  });
  altHasColorInput.addEventListener('change', () => {
    chrome.storage.sync.set({ altHasColor: altHasColorInput.value });
  });
  altNoColorInput.addEventListener('change', () => {
    chrome.storage.sync.set({ altNoColor: altNoColorInput.value });
  });

});
