let mappings = [];
let cmsSlugs = [];
let idCounter = 0;

const fromInput = document.getElementById("from-input");
const cmsList = document.getElementById("cms-list");
const cmsSearch = document.getElementById("cms-search");
const mappingList = document.getElementById("mapping-list");

const csvDialog = document.getElementById("csv-dialog");
const csvPreview = document.getElementById("csv-preview");

function normalizeLines(text) {
  return text.split("\n").map(v => v.trim()).filter(Boolean);
}

/* Load From Slugs */
document.getElementById("import-from").onclick = () => {
  normalizeLines(fromInput.value).forEach(from => {
    mappings.push({
      id: ++idCounter,
      from,
      to: "",
    });
  });
  fromInput.value = "";
  renderMappings();
};

/* Load CMS Slugs */
(async function loadCMS() {
  const data = await chrome.runtime.sendMessage({ type: "RUN_WEBSITE_INSPECTION" });
  cmsSlugs = data.slugs || [];
  renderCMS();
})();

/* Render CMS Slugs */
function renderCMS(filter = "") {
  cmsList.innerHTML = "";
  cmsSlugs
    .filter(s => s.includes(filter))
    .forEach(slug => {
      const div = document.createElement("div");
      div.textContent = slug;
      div.className = "cms-item";
      div.onclick = () => assignSlug(slug);
      cmsList.appendChild(div);
    });
}

cmsSearch.oninput = () => renderCMS(cmsSearch.value);

/* Assign CMS Slug */
function assignSlug(slug) {
  const target = mappings.find(m => !m.to);
  if (!target) return;
  target.to = slug;
  renderMappings();
}

/* Render Mappings */
function renderMappings() {
  mappingList.innerHTML = "";

  mappings.forEach(m => {
    const div = document.createElement("article");
    div.className = `mapping-item ${m.to ? "mapped" : "unmapped"}`;

    div.innerHTML = `
      <strong>From:</strong> ${m.from}<br/>
      <strong>To:</strong>
      <input value="${m.to}" placeholder="Select CMS slug" />
    `;

    const input = div.querySelector("input");
    input.oninput = e => m.to = e.target.value;

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.onclick = () => {
      mappings = mappings.filter(x => x.id !== m.id);
      renderMappings();
    };

    div.appendChild(remove);
    mappingList.appendChild(div);
  });
}

/* CSV Preview */
document.getElementById("export-preview").onclick = () => {
  csvPreview.value = buildCSV();
  csvDialog.showModal();
};

document.getElementById("close-csv").onclick = () => csvDialog.close();

/* CSV Export */
document.getElementById("export-csv").onclick = () => {
  const csv = buildCSV();
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "slug-mappings.csv";
  a.click();
};

/* CSV Builder */
function buildCSV() {
  let csv = "From,To\n";
  mappings.forEach(m => {
    csv += `"${m.from}","${m.to || ""}"\n`;
  });
  return csv;
}