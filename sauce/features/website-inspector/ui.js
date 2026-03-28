document.addEventListener("DOMContentLoaded", () => {
  const frame = document.getElementById("panel-frame");

  if (!frame) {
    console.warn("Panel frame not found");
    return;
  }

  document.querySelectorAll("button[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.page;

      if (!target) return;

      // Avoid unnecessary reloads
      if (!frame.src.endsWith(target)) {
        frame.src = target;
      }
    });
  });
});