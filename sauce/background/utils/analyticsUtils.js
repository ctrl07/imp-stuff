export function extractAnalyticsCodes(scriptSrcs) {
  const codes = { ga4: [], ua: [], gtm: [] };

  scriptSrcs.forEach(src => {
    const gtm = src.match(/GTM-[A-Z0-9]+/i);
    const ga4 = src.match(/G-[A-Z0-9]+/i);
    const ua = src.match(/UA-\d+-\d+/i);

    if (gtm && !codes.gtm.includes(gtm[0])) codes.gtm.push(gtm[0]);
    if (ga4 && !codes.ga4.includes(ga4[0])) codes.ga4.push(ga4[0]);
    if (ua && !codes.ua.includes(ua[0])) codes.ua.push(ua[0]);
  });

  return codes;
}