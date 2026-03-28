// content/cmsContext.js
export function readCmsContext() {
  const pageId = document.querySelector('[data-page-id]')?.value || null;
  const slugInput = document.querySelector('input[name="vanityPath"]');

  return {
    url: window.location.href,
    slug: slugInput ? slugInput.value.trim() : null,
    pageId
  };
}