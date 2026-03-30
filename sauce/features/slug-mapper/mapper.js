document.addEventListener("DOMContentLoaded", () => {
  /* DOM References */
  const fromInput = document.getElementById("fromInput");
  const toInput = document.getElementById("toInput");
  const stashSearch = document.getElementById("stashSearch");
  const fromTable = document.getElementById("fromTable");
  const toStashEl = document.getElementById("toStash");

  const previewBtn = document.getElementById("previewCsv");
  const exportBtn = document.getElementById("exportCsv");

  const csvDialog = document.getElementById("csvDialog");
  const csvOutput = document.getElementById("csvOutput");
  const closeCsvBtn = document.getElementById("closeCsv");

  const hostnameInput = document.getElementById("hostnameInput");
  const addWWWCheckbox = document.getElementById("addWWW");
  const is301Checkbox = document.getElementById("is301");
  const expirationInput = document.getElementById("expiration");

  /* Basic State Management */
  let fromRows = [];
  let toStash = [];
  let activeFromIndex = null;
  let activeStashIndex = 0;

  /* Load From URLs */
  document.getElementById("loadFrom").onclick = () => {
    fromInput.value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean)
      .forEach(v => {
        fromRows.push({ from: v, to: "" });
      });

    fromInput.value = "";

    if (activeFromIndex === null && fromRows.length) {
      activeFromIndex = 0;
    }

    renderFromRows();
  };

  /* Load To Slugs */
  document.getElementById("loadTo").onclick = () => {
    toInput.value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean)
      .forEach(v => toStash.push(v));

    toInput.value = "";
    activeStashIndex = 0;

    renderToStash();
  };

  /* Render From rows */
  function renderFromRows() {
    fromTable.innerHTML = "";

    fromRows.forEach((row, i) => {
      const div = document.createElement("div");
      div.className =
        "from-row" +
        (row.to ? "" : " unmapped") +
        (i === activeFromIndex ? " active" : "");

      /* # column */
      const num = document.createElement("div");
      num.textContent = i + 1;

      /* Editable From cell */
      const fromCell = document.createElement("div");
      fromCell.contentEditable = true;
      fromCell.textContent = row.from;
      fromCell.oninput = e => { row.from = e.target.textContent; };

      /* To cell */
      const toCell = document.createElement("div");
      toCell.className = "from-to";
      toCell.ondragover = e => e.preventDefault();

      const input = document.createElement("input");
      input.placeholder = "Assign To slug";
      input.value = row.to;

      /* Track active row */
      input.onfocus = () => { activeFromIndex = i; renderFromRows(); };

      /* Spreadsheet-style navigation */
      input.onkeydown = e => {
        if (e.key === "ArrowDown" && i < fromRows.length - 1) {
          activeFromIndex++;
          renderFromRows();
          focusActiveTo();
          e.preventDefault();
        }
        if (e.key === "ArrowUp" && i > 0) {
          activeFromIndex--;
          renderFromRows();
          focusActiveTo();
          e.preventDefault();
        }
        if (e.key === "Tab") { stashSearch.focus(); e.preventDefault(); }
        if (e.key === "Escape") { input.value = ""; row.to = ""; e.preventDefault(); }
      };

      /* Manual override */
      input.oninput = e => { row.to = e.target.value; };

      /* Drag from To stash */
      toCell.ondrop = e => {
        const slug = e.dataTransfer.getData("text/plain");
        assignToActive(slug);
      };

      /* Clear-to button */
      const clearBtn = document.createElement("button");
      clearBtn.className = "icon-btn";
      clearBtn.title = "Clear assigned slug";
      clearBtn.textContent = "✕";
      clearBtn.onclick = () => { row.to = ""; renderFromRows(); focusActiveTo(); };

      toCell.appendChild(input);
      toCell.appendChild(clearBtn);

      /* Row delete button */
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.title = "Delete this row";
      delBtn.textContent = "\uD83D\uDDD1";
      delBtn.onclick = () => {
        fromRows.splice(i, 1);
        if (fromRows.length === 0) { activeFromIndex = null; }
        else if (activeFromIndex >= fromRows.length) { activeFromIndex = fromRows.length - 1; }
        renderFromRows();
      };

      div.append(num, fromCell, toCell, delBtn);
      fromTable.appendChild(div);
    });
  }

  function focusActiveTo() {
    const inputs = fromTable.querySelectorAll(".from-to input");
    if (activeFromIndex != null && inputs[activeFromIndex]) {
      inputs[activeFromIndex].focus();
    }
  }

  /* Search */
  stashSearch.oninput = () => { activeStashIndex = 0; renderToStash(); };
  stashSearch.onkeydown = e => {
    const matches = getFilteredStashWithIndex();
    if (!matches.length || activeFromIndex === null) return;

    if (e.key === "ArrowDown") { activeStashIndex = (activeStashIndex + 1) % matches.length; renderToStash(true); e.preventDefault(); }
    if (e.key === "ArrowUp") { activeStashIndex = (activeStashIndex - 1 + matches.length) % matches.length; renderToStash(true); e.preventDefault(); }
    if (e.key === "Enter") { assignToActive(matches[activeStashIndex].slug); e.preventDefault(); }
  };

  /* Assign and advance to next */
  function assignToActive(slug) {
    if (activeFromIndex == null) return;
    fromRows[activeFromIndex].to = slug;
    if (activeFromIndex < fromRows.length - 1) {
      activeFromIndex++;
      renderFromRows();
      focusActiveTo();
    } else {
      renderFromRows();
    }
    stashSearch.focus();
  }

  /* Render To stash */
  function getFilteredStashWithIndex() {
    const q = stashSearch.value.trim();
    const pairs = toStash.map((slug, idx) => ({ slug, idx }));
    return q ? pairs.filter(p => p.slug.includes(q)) : pairs;
  }

  function renderToStash(scrollActive = false) {
    const filtered = getFilteredStashWithIndex();
    toStashEl.innerHTML = "";

    filtered.forEach((item, i) => {
      const { slug, idx } = item;
      const div = document.createElement("div");
      div.className = "to-card" + (i === activeStashIndex ? " active" : "");
      div.draggable = true;

      /* Drag payload */
      div.ondragstart = e => { e.dataTransfer.setData("text/plain", slug); };

      /* Slug text (editable on dblclick) */
      const text = document.createElement("div");
      text.className = "slug-text";
      text.textContent = slug;

      /* Edit button */
      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.title = "Edit slug";
      editBtn.textContent = "✎";
      editBtn.onclick = () => beginEdit(idx, div, slug);

      /* Delete button */
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.title = "Delete slug";
      delBtn.textContent = "\uD83D\uDDD1";
      delBtn.onclick = () => { toStash.splice(idx, 1); renderToStash(true); };

      /* Double-click to edit */
      text.ondblclick = () => beginEdit(idx, div, slug);

      div.append(text, editBtn, delBtn);
      toStashEl.appendChild(div);

      if (scrollActive && i === activeStashIndex) { div.scrollIntoView({ block: "nearest" }); }
    });
  }

  function beginEdit(originalIndex, container, currentValue) {
    container.innerHTML = "";

    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = currentValue;

    const saveBtn = document.createElement("button");
    saveBtn.className = "icon-btn";
    saveBtn.title = "Save";
    saveBtn.textContent = "✔";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "icon-btn";
    cancelBtn.title = "Cancel";
    cancelBtn.textContent = "✕";

    const doSave = () => {
      const next = input.value.trim();
      if (next) { toStash[originalIndex] = next; }
      renderToStash(true);
    };

    saveBtn.onclick = doSave;
    cancelBtn.onclick = () => renderToStash(true);

    input.onkeydown = e => {
      if (e.key === 'Enter') doSave();
      if (e.key === 'Escape') renderToStash(true);
    };

    container.append(input, saveBtn, cancelBtn);
    input.focus();
    input.select();
  }

  /* CSV Preview & Export */
  previewBtn.onclick = () => { csvOutput.value = buildCSV(); csvDialog.showModal(); };
  exportBtn.onclick = () => {
    const blob = new Blob([buildCSV()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "url-redirects.csv";
    a.click();
  };

  function buildCSV() {
    const hostname = hostnameInput.value.trim();
    const addWWW = addWWWCheckbox.checked ? "TRUE" : "FALSE";
    const is301 = is301Checkbox.checked ? "TRUE" : "FALSE";
    const expiration = expirationInput.value || "0";

    return [
      "Hostname,From,To,Add WWW,Is 301?,Expiration",
      ...fromRows.map(row =>
        `"${hostname}","${row.from}","${row.to}","${addWWW}","${is301}","${expiration}"`
      )
    ].join("\n");
  }

  /* Modal controls */
  closeCsvBtn.onclick = () => { csvDialog.close(); };

  // Click outside dialog to close
  csvDialog.addEventListener("click", event => {
    const rect = csvDialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!inside) { csvDialog.close(); }
  });
});