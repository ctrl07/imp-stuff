export function extractPageData() {
  const schemaScripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const schemaBlocks = [];

  schemaScripts.forEach(s => {
    try {
      schemaBlocks.push(JSON.parse(s.textContent.trim()));
    } catch {}
  });

  const schemaNodes = [];
  schemaBlocks.forEach(b => {
    if (Array.isArray(b)) schemaNodes.push(...b);
    else if (b?.["@graph"]) schemaNodes.push(...b["@graph"]);
    else if (typeof b === "object") schemaNodes.push(b);
  });

  return {
    url: location.href,
    title: document.title || null,
    description: document.querySelector('meta[name="description"]')?.content || null,
    schemaNodes,
    scriptSrcs: [...document.querySelectorAll("script[src]")].map(s => s.src.toLowerCase()),
    links: [...document.querySelectorAll("a[href]")].map(a => a.href.toLowerCase()),
    slugs: [...document.querySelectorAll('#mainTable > tbody > tr > td.colspace > em:first-of-type')]
      .map(el => el.textContent.trim())
      .filter(Boolean)
  };
}