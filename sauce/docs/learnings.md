#  Notes

This document captures observed Website Providers and CMS behavior.

No automation should contradict these notes.

## Background = Service Worker

Event‑driven
Starts/stops automatically
No DOM
Best place for:

orchestration
planning
validation
storage access
CMS knowledge

This is why our utils layer belongs here.



Content Scripts = Page Interaction

Run inside web pages
Can read/modify DOM
Isolated JS environment
Cannot directly access most Chrome APIs

Best for:

reading CMS state
clicking buttons
filling forms
observing results

Content scripts should be dumb and disposable


Extension Pages (Popup / Side Panel / Tabs)

Normal HTML/CSS/JS
Full access to Chrome APIs
No access to page DOM

Best for:

tools
planners
dashboards
bulk workflows
future “isolated window” idea

Chrome APIs You Will ACTUALLY Use
Below is the only subset that matters for your project.

chrome.runtime — The Backbone

Used for:

messaging between background, features, and content
lifecycle events (install, update)
getting manifest metadata

Key concepts:

sendMessage
onMessage
long‑lived ports (optional later)

Official docs:https://developer.chrome.com/docs/extensions/reference/api/runtime

Messaging overview: https://developer.chrome.com/docs/extensions/develop/concepts/messaging


chrome.tabs — Navigation Awareness

Used for:

knowing which tab is active
opening preview tabs
reloading CMS after changes
associating content scripts to tabs

Important facts:

Background + extension pages only
Content scripts cannot call this API

Official docs: https://developer.chrome.com/docs/extensions/reference/api/tabs


chrome.storage — Real Extension Storage

This is what you should move toward eventually instead of localStorage.

Why:

works in service worker
async
extension‑scoped
persistent

You will mainly use:

chrome.storage.local
possibly chrome.storage.session later

Official docs: https://developer.chrome.com/docs/extensions/reference/api/storage
Practical guide: https://www.mellowtel.com/blog/chrome-extension-storage-api-guide


chrome.scripting — Controlled Injection
This replaces old “execute arbitrary JS” patterns.
Used for:

injecting content scripts on demand
running read‑only helpers
future automation triggers

Permissions required:

scripting
activeTab or host permissions

📘 Official docs: https://developer.chrome.com/docs/extensions/reference/api/scripting

chrome.sidePanel — Isolated Workspace

Side panel is ideal for:

planners
bulk tools
checklists
dashboards
long‑running workflows

Important:

Chrome 114+
MV3 only
Much better than popups for complex tools

Official docs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
Practical walkthrough: https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel


(Mental Model)

UI
 └─ request preview
Background
 ├─ normalize inputs
 ├─ apply CMS rules
 └─ return preview URL