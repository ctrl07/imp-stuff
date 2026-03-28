# Feature: Website Inspector

## Purpose
Display key metadata, analytics, and platform signals from a website.

## User Value
Helps audit dealer and staging sites.

## Reads From
- Webpage DOM via content script
- Schema.org JSON
- Script URLs
- Meta tags

## Writes To
- UI
- Clipboard (manual copy)

## Uses Utilities
- providerUtils
- schemaUtils
- analyticsUtils

## Automation Level
- ✅ Read-only

## Failure Mode
Displays "No data found" instead of errors.

## Known Limitations
- Provider detection depends on identifiable scripts
- Analytics detection is script-based only

## UX Constraints
- User must manually refresh data
- No background auto-execution

## Future Extensions
- Provider-specific warnings
- Inspection comparison