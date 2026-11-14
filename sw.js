// Service Worker: Netzwerk zuerst. Online kommt immer die neueste Version vom Server;
// der Cache dient nur als Rückfall, wenn das Netzwerk fehlt.
// CACHE_VERSION erhöhen, wenn Dateien umbenannt oder entfernt werden (alte Caches werden
// beim Aktivieren gelöscht). Neue Dateien in PRECACHE eintragen; tests/unit/sw.test.mjs
// prüft, dass die Liste vollständig ist.

const CACHE_VERSION = 2;
const CACHE_PREFIX = "schach-training-";
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./LICENSE",
  "./css/app.css",
  "./css/board-theme.css",
  "./js/app.js",
  "./js/router.js",
  "./js/storage.js",
  "./js/board-designs.js",
  "./js/design.js",
  "./js/pages/darstellung.js",
  "./js/pages/brett.js",
  "./js/pages/daten.js",
  "./js/pages/mehr.js",
  "./js/ui/promotion.js",
  "./js/taktik-state.js",
  "./js/ui/board-util.js",
  "./js/puzzle-runner.js",
  "./js/pages/taktik.js",
  "./js/pages/statistik.js",
  "./js/themes.js",
  "./js/rating.js",
  "./js/leitner.js",
  "./js/stats.js",
  "./js/session.js",
  "./js/puzzles.js",
  "./vendor/chess.js/chess.js",
  "./vendor/chess.js/LICENSE",
  "./vendor/chessground/chessground.min.js",
  "./vendor/chessground/chessground.base.css",
  "./vendor/chessground/chessground.cburnett.css",
  "./vendor/chessground/LICENSE",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // "no-cache": immer beim Server nachfragen, auch wenn der HTTP-Cache (z. B. GitHub Pages) noch gültig wäre.
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("Offline und noch nicht zwischengespeichert.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
