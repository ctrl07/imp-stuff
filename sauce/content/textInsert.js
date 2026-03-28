let lastFocused = null;

function track(el) {
  if (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  ) {
    lastFocused = el;
  }
}

window.addEventListener("focusin", e => track(e.target));
window.addEventListener("contextmenu", e => track(e.target));

chrome.runtime.onMessage.addListener(msg => {
  if (msg.action === "insertText" && lastFocused) {
    lastFocused.focus();
    document.execCommand("insertText", false, msg.text);
  }
});