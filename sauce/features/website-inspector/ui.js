const frame = document.getElementById("panel-frame");

document.querySelectorAll("button[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.page;

    if (!frame || !target) return;

    frame.src = target;
  });
});