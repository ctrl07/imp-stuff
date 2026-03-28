document.getElementById("refresh-data").addEventListener("click", async () => {
  const data = await chrome.runtime.sendMessage({
    type: "RUN_WEBSITE_INSPECTION"
  });

  renderAll(data);
});

function renderAll(data) {
  renderURL(data.url);
  renderProvider(data.provider);
  renderMeta(data.meta);
  renderAddress(data.schema);
  renderGeo(data.schema);
  renderSocial(data.schema);
  renderAnalytics(data.analytics);
}