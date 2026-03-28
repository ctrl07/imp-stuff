document.getElementById("refresh-data").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const data = await chrome.runtime.sendMessage({
    type: "RUN_WEBSITE_INSPECTION"
  });

  renderAll(data);
});

const frame = document.getElementById("panel-frame");

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    frame.src = btn.dataset.page;
  });
});