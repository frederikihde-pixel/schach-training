// Einfacher Router über den Teil nach dem # in der Adresse (z. B. #/taktik).
// Läuft ohne Server, auch auf GitHub Pages.

const routes = new Map();
let current = null;

export function addRoute(path, { page, tab = null, title, onShow = null }) {
  routes.set(path, { page, tab, title, onShow });
}

function currentPath() {
  const raw = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return routes.has(raw) ? raw : "brett";
}

function show() {
  const path = currentPath();
  const route = routes.get(path);

  for (const el of document.querySelectorAll(".page")) {
    el.hidden = el.id !== route.page;
  }
  for (const link of document.querySelectorAll(".tabbar a")) {
    if (link.id === `tab-${route.tab}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const mehr = document.getElementById("link-mehr");
  if (path === "mehr" || path.startsWith("mehr/")) mehr.setAttribute("aria-current", "page");
  else mehr.removeAttribute("aria-current");

  document.title = `${route.title} - Schach-Training`;
  if (current !== path) window.scrollTo(0, 0);
  current = path;
  if (route.onShow) route.onShow(path);
}

export function startRouter() {
  window.addEventListener("hashchange", show);
  show();
}
