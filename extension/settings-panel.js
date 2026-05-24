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
  setStatus('st-update-status', 'Checking…');
  dlRow.classList.add('hidden');

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const latestSha = data.sha.slice(0, 7);

    if (latestSha === INSTALLED_SHA) {
      setStatus('st-update-status', `Up to date (${INSTALLED_SHA}).`);
    } else {
      setStatus('st-update-status', `Update available: ${latestSha} (installed: ${INSTALLED_SHA}).`);
      document.getElementById('st-download-link').href =
        `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;
      dlRow.classList.remove('hidden');
    }
  } catch (err) {
    setStatus('st-update-status', 'Check failed: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('st-version').textContent =
    `1.0.0 · ${INSTALLED_SHA}`;

  document.getElementById('st-check-btn').addEventListener('click', checkForUpdate);
});
