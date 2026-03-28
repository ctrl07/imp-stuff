# Architecture Overview

This extension is intentionally designed to be simple, explainable,
and safe to evolve.

It prioritizes clarity over cleverness.

---

## Core Principles

1. Planning comes before automation
2. Background code never touches the DOM
3. Content scripts do one thing only
4. UI is replaceable
5. Automation must be stoppable
6. Boring code is good code

---

## The Layers

### 1. Background (The Brain)
- Decision-making
- Validation
- Planning
- CMS rules
- No DOM access

### 2. Features (Tools)
Each feature:
- Lives in its own folder
- Has its own UI
- Talks to background only

### 3. Content Scripts (Hands & Eyes)
- Touch CMS DOM
- No business logic
- Disposable by design

### 4. Styles
- Minimal
- No heavy animation
- Scoped only to extension UI

---

## Why This Matters

This separation allows:

- reduce automation (our goal is to deliver qualiy over quantity)
- easier testing
- parallel contributions
- learning architecture gradually

This is intentional design, not overhead.