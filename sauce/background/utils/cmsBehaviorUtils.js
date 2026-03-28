/*  Documented CMS behaviors, These are rules, not code paths. */

export const CMS_BEHAVIOR = {
  PAGE_CREATION_IS_ATOMIC: true,
  PLATFORM_PAGES_SHOULD_BE_SKIPPED: true,
  PREVIEW_URLS_ARE_DETERMINISTIC: true,
  CONTENT_EDITORS_ARE_UNSTABLE: true,
  AUTOMATION_MUST_BE_STOPPABLE: true
};

export function explainAutomationBoundary(reason) {
  const explanations = {
    content: 'Content editing is unstable and should remain manual.',
    platform: 'Platform pages are managed by the CMS.',
    safety: 'Automation stopped to prevent incomplete state.'
  };

  return explanations[reason] || 'Automation halted for safety.';
}