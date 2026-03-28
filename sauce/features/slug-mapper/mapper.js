console.log("[SlugMapper] Script loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SlugMapper] DOMContentLoaded fired");

  // DOM LOOKUPS
  const fromTable = document.getElementById("fromTable");
  const fromInput = document.getElementById("fromInput");
  const toInput = document.getElementById("toInput");
  const toStashEl = document.getElementById("toStash");

  const loadFromBtn = document.getElementById("loadFrom");
  const loadToBtn = document.getElementById("loadTo");

  const previewBtn = document.getElementById("previewCsv");
  const exportBtn = document.getElementById("exportCsv");

  const csvDialog = document.getElementById("csvDialog");
  const csvOutput = document.getElementById("csvOutput");

  console.log("[SlugMapper] DOM elements:", {
    fromTable,
    fromInput,
    toInput,
    toStashEl,
    loadFromBtn,
    loadToBtn,
    previewBtn,
    exportBtn,
    csvDialog,
    csvOutput
  });

  // STATE
  let fromRows = [];
  let toStash = [];

  // SAFETY CHECK
  if (!fromTable || !fromInput || !toInput || !toStashEl) {
    console.error("[SlugMapper] Critical DOM elements missing. JS will not run.");
    return;
  }

  // LOAD FROM URLS
  loadFromBtn.onclick = () => {
    console.log("[SlugMapper] loadFrom clicked");
    console.log("[SlugMapper] raw fromInput value:", fromInput.value);

    const values = fromInput.value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    console.log("[SlugMapper] parsed From values:", values);

    values.forEach(v => {
      fromRows.push({
        id: crypto.randomUUID(),
        from: v,
        to: null
      });
    });

    console.log("[SlugMapper] fromRows state after load:", fromRows);

    fromInput.value = "";
    renderFromRows();
  };

  // LOAD TO SLUGS
  loadToBtn.onclick = () => {
    console.log("[SlugMapper] loadTo clicked");
    console.log("[SlugMapper] raw toInput value:", toInput.value);

    const values = toInput.value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    console.log("[SlugMapper] parsed To values:", values);

    values.forEach(v => {
      toStash.push({
        id: crypto.randomUUID(),
        slug: v
      });
    });

    console.log("[SlugMapper] toStash state after load:", toStash);

    toInput.value = "";
    renderToStash();
  };

  // RENDER FROM ROWS
  function renderFromRows() {
    console.log("[SlugMapper] renderFromRows called");
    console.log("[SlugMapper] rendering rows:", fromRows);

    fromTable.innerHTML = "";

    fromRows.forEach((row, index) => {
      const div = document.createElement("div");
      div.className = "from-row" + (row.to ? "" : " unmapped");

      const num = document.createElement("div");
      num.textContent = index + 1;

      const fromCell = document.createElement("div");
      fromCell.textContent = row.from;

      const toCell = document.createElement("div");
      toCell.className = "from-to";
      toCell.textContent = row.to || "Drop To slug here";

      toCell.ondragover = e => e.preventDefault();

      toCell.ondrop = e => {
        const slug = e.dataTransfer.getData("text/plain");
        console.log("[SlugMapper] dropped slug:", slug);
        row.to = slug;
        renderFromRows();
      };

      div.append(num, fromCell, toCell);
      fromTable.appendChild(div);
    });
  }

  // RENDER TO STASH
  function renderToStash() {
    console.log("[SlugMapper] renderToStash called");
    console.log("[SlugMapper] rendering toStash:", toStash);

    toStashEl.innerHTML = "";

    toStash.forEach(item => {
      const card = document.createElement("div");
      card.className = "to-card";
      card.textContent = item.slug;
      card.draggable = true;

      card.ondragstart = e => {
        console.log("[SlugMapper] dragstart slug:", item.slug);
        e.dataTransfer.setData("text/plain", item.slug);
      };

      toStashEl.appendChild(card);
    });
  }

  // CSV
  previewBtn.onclick = () => {
    console.log("[SlugMapper] Preview CSV clicked");
    csvOutput.value = buildCSV();
    csvDialog.showModal();
  };

  exportBtn.onclick = () => {
    console.log("[SlugMapper] Export CSV clicked");
    const blob = new Blob([buildCSV()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "slug-mapping.csv";
    a.click();
  };

  function buildCSV() {
    console.log("[SlugMapper] buildCSV called");
    return [
      "From,To",
      ...fromRows.map(r => `"${r.from}","${r.to || ""}"`)
    ].join("\n");
  }

  console.log("[SlugMapper] Initialization complete");
});