export function detectProvider(schemaNodes, links, scriptSrcs) {
  const providers = [
    { name: "dealer-inspire", match: "dealerinspire.com" },
    { name: "dealer-com", match: "dealer.com" },
    { name: "dealeron", match: "dealeron.com" },
    { name: "dealerfire", match: "dealerfire.com" },
    { name: "team-velocity", match: "teamvelocitymarketing.com" },
    { name: "dealer-eprocess", match: "dealereprocess.com" },
    { name: "cloud-software-group", match: "cloudsoftwaregroup.com" },
    { name: "flexdealer", match: "flexdealer.com" },
    { name: "haystak-digital", match: "haystakdigital.com" },
    { name: "netsertive", match: "netsertive.com" },
    { name: "leadcar", match: "leadcar.com" },
    { name: "360-agency", match: "360.agency" }
  ];

  for (const p of providers) {
    if (scriptSrcs.some(src => src.includes(p.match))) {
      return { name: p.name, confidence: "high" };
    }
  }

  for (const p of providers) {
    if (links.some(link => link.includes(p.match))) {
      return { name: p.name, confidence: "medium" };
    }
  }

  if (schemaNodes.length) {
    return { name: "unknown", confidence: "medium" };
  }

  return { name: "unknown", confidence: "low" };
}