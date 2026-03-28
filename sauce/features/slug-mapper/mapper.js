let rows = [];
let cmsSlugs = [];
let activeRow = null;
let idCounter = 0;

const rowsEl = document.getElementById("mapping-rows");
const fromInput = document.getElementById("from-input");
const cmsSearch = document.getElementById("cms-search");
const cmsResults = document.getElementById("cms-results");

const csvDialog = document.getElementById("csv-dialog");
const csvPreview = document.getElementById("csv-preview");

/* Helpers */
function splitLines(text) {
  return text.split("\n").map(v => v.trim()).filter(Boolean);
}

/* Load From slugs */
document.getElementById("load-from").onclick = () => {
  splitLines(fromInput.value).forEach(from => {
    rows.push({
      id: ++idCounter,
      from,
      to: ""
    });
  });

  fromInput.value = "";
  renderRows();
};

/* Load CMS slugs from inspector */
(async function () {
  const data = await chrome.runtime.sendMessage({
    type: "RUN_WEBSITE_INSPECTION"
  });

  cmsSlugs = data.slugs || [];
  renderCMS();
})();

/* CMS search */
cmsSearch.oninput = () => renderCMS(cmsSearch.value);

function renderCMS(filter = "") {
  cmsResults.innerHTML = "";

  cmsSlugs
    .filter(slug => slug.includes(filter))
    .forEach(slug => {
      const div = document.createElement("div");
      div.className = "cms-cell";
      div.textContent = slug;

      div.onclick = () => {
        if (!activeRow) return;
        activeRow.to = slug;
        renderRows();
      };

      cmsResults.appendChild(div);
    });
}

/* Render mapping rows */
function renderRows() {
  rowsEl.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");

    if (!r.to) tr.classList.add("unmapped");
    if (activeRow === r) tr.classList.add("active");

    /* From cell */
    const fromTd = document.createElement("td");
    fromTd.textContent = r.from;

    /* To cell */
    const toTd = document.createElement("td");
    const toInput = document.createElement("input");
    toInput.placeholder = "Select CMS slug";
    toInput.value = r.to;

    toInput.onfocus = () => {
      activeRow = r;
      renderRows();
      cmsSearch.focus();
    };

    toInput.oninput = e => {
      r.to = e.target.value;
    };

    toTd.appendChild(toInput);

    /* Actions */
    const actionTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "×";
    clearBtn.title = "Clear mapping";
    clearBtn.onclick = () => {
      r.to = "";
      renderRows();
    };

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove row";
    removeBtn.onclick = () => {
      rows = rows.filter(x => x.id !== r.id);
      renderRows();
    };

    actions.append(clearBtn, removeBtn);
    actionTd.appendChild(actions);

    tr.append(fromTd, toTd, actionTd);
    rowsEl.appendChild(tr);
  });
}

/* CSV helpers */
function buildCSV() {
  return ["From,To"]
    .concat(
      rows.map(r => `"${r.from}","${r.to || ""}"`)
    )
    .join("\n");
}

document.getElementById("preview-csv").onclick = () => {
  csvPreview.value = buildCSV();
  csvDialog.showModal();
};

document.getElementById("close-csv").onclick = () => {
  csvDialog.close();
};

document.getElementById("export-csv").onclick = () => {
  const blob = new Blob([buildCSV()], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "slug-mapping.csv";
  a.click();
};