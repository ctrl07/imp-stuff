'use strict';

(function initLlmPanel() {

  const BACKEND  = 'http://localhost:8765';
  const POLL_MS  = 30000; // re-check model status every 30 s while tab is open

  let _pollTimer = null;

  // Status dot

  function setDot(available, modelName) {
    const dot   = document.getElementById('llm-dot');
    const label = document.getElementById('llm-model-label');
    if (!dot) return;
    if (available) {
      dot.style.background = '#4caf50';
      label.textContent    = modelName || 'AI ready';
      label.style.color    = '';
    } else {
      dot.style.background = 'var(--pico-muted-color)';
      label.textContent    = 'Offline: start Ollama and pull a model';
      label.style.color    = 'var(--pico-muted-color)';
    }
  }

  async function checkStatus() {
    try {
      const { aiEnabled } = await new Promise(res =>
        chrome.storage.sync.get({ aiEnabled: true }, res)
      );
      if (!aiEnabled) { setDot(false, 'AI disabled'); return; }

      const r    = await fetch(`${BACKEND}/llm/status`, { signal: AbortSignal.timeout(2000) });
      const data = r.ok ? await r.json() : {};
      setDot(!!(data.available), data.available ? data.model : null);
    } catch {
      setDot(false);
    }
  }

  // Chat 

  function setStatus(msg, busy) {
    const s = document.getElementById('llm-send-status');
    if (s) s.textContent = msg;
    const btn = document.getElementById('llm-send-btn');
    if (btn) btn.disabled = busy;
  }

  function showResponse(text) {
    const box = document.getElementById('llm-response');
    const pre = document.getElementById('llm-response-text');
    if (!box || !pre) return;
    pre.textContent = text;
    box.style.display = 'block';
  }

  async function sendPrompt() {
    const textarea = document.getElementById('llm-prompt');
    const prompt   = textarea?.value.trim();
    if (!prompt) { showToast('Enter a prompt first.', 'warning'); return; }

    const { aiEnabled } = await new Promise(res =>
      chrome.storage.sync.get({ aiEnabled: true }, res)
    );
    if (!aiEnabled) {
      showToast('AI is disabled in Settings.', 'warning');
      return;
    }

    setStatus('Sending…', true);
    try {
      const r = await fetch(`${BACKEND}/llm/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        const msg = err.detail || r.statusText;
        setStatus('', false);
        showToast(`AI error: ${msg}`, 'error');
        return;
      }
      const data = await r.json();
      showResponse(data.response || '');
      setStatus('', false);
    } catch (e) {
      setStatus('', false);
      showToast('Could not reach backend.', 'error');
    }
  }

  // Init

  document.addEventListener('DOMContentLoaded', () => {

    // Send on button click or Ctrl+Enter in textarea
    document.getElementById('llm-send-btn')?.addEventListener('click', sendPrompt);
    document.getElementById('llm-prompt')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendPrompt();
      }
    });

    // Clear button
    document.getElementById('llm-clear-btn')?.addEventListener('click', () => {
      const ta = document.getElementById('llm-prompt');
      if (ta) ta.value = '';
      const box = document.getElementById('llm-response');
      if (box) box.style.display = 'none';
      setStatus('', false);
    });

    // Copy response
    document.getElementById('llm-copy-btn')?.addEventListener('click', () => {
      const text = document.getElementById('llm-response-text')?.textContent || '';
      navigator.clipboard.writeText(text).then(() => showToast('Copied.', 'success'));
    });

    // Quick-prompt chips — append chip text to textarea
    document.querySelectorAll('.llm-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ta = document.getElementById('llm-prompt');
        if (!ta) return;
        ta.value = chip.dataset.prompt + (ta.value.trim() ? '\n' + ta.value.trim() : '');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    });

    // Poll status when this tab is visible
    document.getElementById('tab-llm')?.addEventListener('click', () => {
      checkStatus();
      clearInterval(_pollTimer);
      _pollTimer = setInterval(checkStatus, POLL_MS);
    });

    // Initial check
    checkStatus();

    // Refresh dot when aiEnabled toggle changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && 'aiEnabled' in changes) checkStatus();
    });
  });

})();
