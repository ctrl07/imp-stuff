export function registerVehicleMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "supplies",
      title: "Supplies",
      contexts: ["editable"]
    });

    const items = [
      ["alt-text", "Alt Text"],
      ["filter", "Filter"],
      ["dealer", "Dealer Alt"],
    ];

    items.forEach(([id, title]) => {
      chrome.contextMenus.create({
        id,
        parentId: "supplies",
        title,
        contexts: ["editable"]
      });
    });
  });
}

export function resolveVehicleMenuText(menuId) {
  switch (menuId) {
    case "alt-text":
      return "#CURRENTYEAR# #DEALERMAKE# (insert model here) in #CITY# #STATE#";
    case "filter":
      return "/searchnew.aspx?Year=2026&ModelAndTrim=(insert model here)";
    case "dealer":
      return "(add banner context) at #NAME# in #CITY# #STATE#.";
    default:
      return null;
  }
}