export function normalizeSchema(nodes) {
  const result = {
    address: {},
    geo: {},
    maps: [],
    social: []
  };

  nodes.forEach(node => {
    if (!node || typeof node !== "object") return;

    if (node.address) {
      Object.assign(result.address, {
        street: result.address.street ?? node.address.streetAddress,
        city: result.address.city ?? node.address.addressLocality,
        state: result.address.state ?? node.address.addressRegion,
        zip: result.address.zip ?? node.address.postalCode,
        country: result.address.country ?? node.address.addressCountry
      });
    }

    if (node.geo) {
      result.geo.lat ??= node.geo.latitude;
      result.geo.lng ??= node.geo.longitude;
    }

    if (node.hasMap) {
      Array.isArray(node.hasMap)
        ? result.maps.push(...node.hasMap)
        : result.maps.push(node.hasMap);
    }

    if (Array.isArray(node.sameAs)) {
      result.social.push(...node.sameAs);
    }
  });

  result.maps = [...new Set(result.maps)];
  result.social = [...new Set(result.social)];

  return result;
}