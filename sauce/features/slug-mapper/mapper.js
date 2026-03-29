const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const stashSearch = document.getElementById("stashSearch");
const fromTable = document.getElementById("fromTable");
const toStashEl = document.getElementById("toStash");

const csvDialog = document.getElementById("csvDialog");
const csvOutput = document.getElementById("csvOutput");

const hostnameInput = document.getElementById("hostnameInput");
const addWWWCheckbox = document.getElementById("addWWW");
const is301Checkbox = document.getElementById("is301");
const expirationInput = document.getElementById("expiration");

let fromRows = [];
let toStash = [];
let activeFromIndex = null;
let activeStashIndex = 0;

/* Load Inputs */

document.getElementById("loadFrom").onclick = () => {
  fromInput.value
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean)
    .forEach(v => fromRows.push({ from: v, to: "" }));

  fromInput.value = "";
  if (activeFromIndex === null) activeFromIndex = 0;
  renderFromRows();
};

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

/* Render From Rows */

function renderFromRows() {
  fromTable.innerHTML = "";

  fromRows.forEach((row, i) => {
    const div = document.createElement("div");
    div.className =
      "from-row" +
      (row.to ? "" : " unmapped") +
      (i === activeFromIndex ? " active" : "");

    const num = document.createElement("div");
    num.textContent = i + 1;

    const fromCell = document.createElement("div");
    fromCell.contentEditable = true;
    fromCell.textContent = row.from;
    fromCell.oninput = e => row.from = e.target.textContent;

    const toCell = document.createElement("div");
    toCell.className = "from-to";
    toCell.ondragover = e => e.preventDefault();

    const input = document.createElement("input");
    input.value = row.to;
    input.placeholder = "Assign To slug";

    input.onfocus = () => {
      activeFromIndex = i;
      renderFromRows();
    };

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
      if (e.key === "Tab") {
        stashSearch.focus();
        e.preventDefault();
      }
    };

    input.oninput = e => row.to = e.target.value;

    toCell.ondrop = e => {
      const slug = e.dataTransfer.getData("text/plain");
      assignToActive(slug);
    };

    toCell.appendChild(input);
    div.append(num, fromCell, toCell);
    fromTable.appendChild(div);
  });
}

function focusActiveTo() {
  const inputs = fromTable.querySelectorAll(".from-to input");
  if (inputs[activeFromIndex]) inputs[activeFromIndex].focus();
}

/*  Stash Search + Keyboard */

stashSearch.oninput = () => {
  activeStashIndex = 0;
  renderToStash();
};

stashSearch.onkeydown = e => {
  const matches = getFilteredStash();
  if (!matches.length || activeFromIndex === null) return;

  if (e.key === "ArrowDown") {
    activeStashIndex = (activeStashIndex + 1) % matches.length;
    renderToStash(true);
    e.preventDefault();
  }

  if (e.key === "ArrowUp") {
    activeStashIndex =
      (activeStashIndex - 1 + matches.length) % matches.length;
    renderToStash(true);
    e.preventDefault();
  }

  if (e.key === "Enter") {
    assignToActive(matches[activeStashIndex]);
    e.preventDefault();
  }
};

/* Assign + Auto Advance */

function assignToActive(slug) {
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

/* Render To Stash */

function getFilteredStash() {
  const q = stashSearch.value.trim();
  return q ? toStash.filter(s => s.includes(q)) : toStash;
}

function renderToStash(scrollActive = false) {
  const filtered = getFilteredStash();
  toStashEl.innerHTML = "";

  filtered.forEach((slug, i) => {
    const div = document.createElement("div");
    div.className =
      "to-card" + (i === activeStashIndex ? " active" : "");
    div.textContent = slug;
    div.draggable = true;

    div.ondragstart = e => {
      e.dataTransfer.setData("text/plain", slug);
    };

    div.onclick = () => assignToActive(slug);

    toStashEl.appendChild(div);

    if (scrollActive && i === activeStashIndex) {
      div.scrollIntoView({ block: "nearest" });
    }
  });
}

/* CSV */

document.getElementById("previewCsv").onclick = () => {
  csvOutput.value = buildCSV();
  csvDialog.showModal();
};

document.getElementById("exportCsv").onclick = () => {
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