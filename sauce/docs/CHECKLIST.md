# Feature Addition Checklist

Before adding a new feature, confirm ALL items below.

## Problem
- Can the feature be explained in one sentence?
- Does it solve a real user need?

## Scope
- Can this start as read-only?
- Is automation absolutely required?

## Files
- 1 UI file
- 1 background handler (optional)
- 1 utility file (optional)

If more than 3 files are needed, the feature is too large.

## Boundaries
- DOM access only in content scripts
- Logic only in background
- UI displays data only

## Failure
- Missing data shows empty state
- No crashes
- No silent page manipulation

## Removal Test
Deleting the feature folder should not break the extension.