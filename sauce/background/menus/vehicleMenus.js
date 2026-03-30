export function registerVehicleMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "supplies",
      title: "Supplies",
      contexts: ["editable"]
    });

    const primaryMenus = [
      ["alt-text", "Alt Text"],
      ["filter", "Filter"],
      ["dealer", "Dealer Alt"],
      ["re-codes", "Replacement Codes"],
      // ["css", "CSS Snippets"]
    ];

    primaryMenus.forEach(([id, title]) => {
      chrome.contextMenus.create({
        id,
        parentId: "supplies",
        title,
        contexts: ["editable"]
      });
    });

    const replacementMenus = [
      ["dealership-name", "Name"],
      ["dealership-city", "City"],
      ["dealership-state-abbv", "State Abbv"],
      ["dealership-make", "Make"],
      ["city-state", "City, State"],
      ["schema-logo", "Schema Logo"],
      ["schema-desc", "Schema Desc"]
    ];

    replacementMenus.forEach(([id, title]) => {
      chrome.contextMenus.create({
        id,
        parentId: "re-codes",
        title,
        contexts: ["editable"]
      });
    });

    chrome.contextMenus.create({
      id: "css",
      parentId: "supplies",
      title: "CSS Snippets",
      contexts: ["editable"]
    });

    const cssMenus = [
      ["img-text", "Img + Text"],
      ["img-three", "3 Images"]
    ];

    cssMenus.forEach(([id, title]) => {
      chrome.contextMenus.create({
        id,
        parentId: "css",
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

    case "dealership-name":
      return "%(DEALERSHIP_NAME) ";

    case "dealership-city":
      return "%(CITY) ";

    case "dealership-state-abbv":
      return "%(STATE_ABBREV) ";

    case "dealership-make":
      return "%(MAKE) ";

    case "city-state":
      return "%(CITY), %(STATE_ABBREV) ";

    case "schema-logo":
      return "(Add Primary URL Here)/static/dealer-######/logo.png";

    case "schema-desc":
      return "#NAME# is a %(MAKE) dealer in %(CITY), %(STATE_ABBREV). We specialize in new %(MAKE), used cars, service, and financing.";

    case "img-text":
      return `<div class="row"><div class="col-md-6"><img class="img-responsive margin-auto" src="" ></div><div class="col-md-6"><p></p></div></div><br>`;

    case "img-three":
      return `<div class="row"><div class="col-md-4"><img class="img-responsive margin-auto" src=""></div><div class="col-md-4"><img class="img-responsive margin-auto" src=""></div><div class="col-md-4"><img class="img-responsive margin-auto" src="" ></div></div><br>`;

    default:
      return null;
  }
}