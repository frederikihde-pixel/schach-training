// Einfacher Router über den Teil nach dem # in der Adresse (z. B. #/taktik).
// Läuft ohne Server, auch auf GitHub Pages.
//
// Jede Route hat einen Seitennamen (steht oben in der Kopfzeile und im Tab-Titel) und optional eine Eltern-Route:
// Hat sie eine, zeigt die Kopfzeile links einen Zurück-Pfeil dorthin. Alte Adressen werden mit addRedirect auf die
// neuen Orte weitergeleitet, damit gespeicherte Lesezeichen und Verknüpfungen nicht brechen.

const routes = new Map();
const redirects = new Map();
let current = null;

export const START_ROUTE = "heute";

// prefix: Die Route gilt auch für Pfade darunter (z. B. "spielen/rueckblick/<id>"); onShow bekommt den ganzen Pfad.
// parent: Route, zu der der Zurück-Pfeil führt (fehlt bei Hauptorten). tab: markierter Reiter der unteren Leiste.
export function addRoute(path, { page, tab = null, title, onShow = null, prefix = false, parent = null }) {
  routes.set(path, { page, tab, title, onShow, prefix, parent });
}

// Alte Adresse (ohne "#/") auf neue Adresse (ohne "#/") umleiten.
export function addRedirect(from, to) {
  redirects.set(from, to);
}

function rawPath() {
  return location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
}

function matchRoute(path) {
  if (routes.has(path)) return routes.get(path);
  for (const [key, route] of routes) if (route.prefix && path.startsWith(key + "/")) return route;
  return null;
}

// Gibt den Pfad zurück, der angezeigt wird (unbekannte Adressen zeigen die Startseite).
function currentPath() {
  const raw = rawPath();
  return matchRoute(raw) ? raw : START_ROUTE;
}

function aktualisiereKopf(path, route) {
  const titel = document.getElementById("app-titel");
  if (titel) titel.textContent = route.title;
  const zurueck = document.getElementById("btn-zurueck");
  if (zurueck) {
    zurueck.hidden = !route.parent;
    if (route.parent) zurueck.setAttribute("href", `#/${route.parent}`);
  }
  const zahnrad = document.getElementById("link-einstellungen");
  if (zahnrad) {
    if (path === "einstellungen" || path.startsWith("einstellungen/") || path.startsWith("mehr")) zahnrad.setAttribute("aria-current", "page");
    else zahnrad.removeAttribute("aria-current");
  }
}

function show() {
  const raw = rawPath();
  if (redirects.has(raw)) {
    location.replace(`#/${redirects.get(raw)}`);
    return;
  }
  const path = currentPath();
  const route = matchRoute(path);

  for (const el of document.querySelectorAll(".page")) {
    el.hidden = el.id !== route.page;
  }
  for (const link of document.querySelectorAll(".tabbar a")) {
    if (link.id === `tab-${route.tab}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  aktualisiereKopf(path, route);

  document.title = `${route.title} - Schach-Training`;
  if (current !== path) window.scrollTo(0, 0);
  current = path;
  if (route.onShow) route.onShow(path);
}

export function startRouter() {
  window.addEventListener("hashchange", show);
  show();
}
