# Architecture Overview

This extension follows a strict, predictable flow:

Web Page (DOM)
→ Content Script (reads only)
→ Background (decides meaning)
→ UI (displays information)

## Content Script
- Reads data from the webpage
- Never decides meaning
- Never touches UI or storage
- Never imports utilities

## Background
- Receives raw data
- Uses utilities to apply logic
- Orchestrates responses
- Owns all decisions

## Utilities
- Pure functions only
- No DOM
- No Chrome APIs
- No UI dependencies

## UI (Side Panel)
- Displays results
- Handles copy/export actions
- Never inspects the page directly

## Add a New Inspector Section

HTML:
- <h4>My Section</h4>
- <div id="my-section"></div>

JS:
function renderMySection(data) {
  const el = document.getElementById("my-section");
  el.innerHTML = "";

  if (!data) {
    renderEmpty(el);
    return;
  }

  renderValue(el, data);
}