# URL Redirects 0.1

Human-driven workspace for mapping legacy URLs to CMS slugs.

## Design Principles
- No automation
- No persistence
- No guessing
- Explicit human decisions

## Core Model
Each "From" slug becomes a to-do item that must be mapped
to exactly one CMS slug or left blank.

## UX Guarantees
- Unequal lists handled safely
- Visual status for unmapped rows
- CMS context available while deciding
- Explicit export confirmation

## Non-Goals
- CMS updates
- Redirect creation
- Batch automation