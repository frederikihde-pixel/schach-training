// Installierbarkeit, Service Worker (Netzwerk zuerst) und Offline-Start.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

(async () => {
  const r = reporter("Installierbar und offline");
  const { server, hits, overrides, url } = await startServer();
  const browser = await launch();
  const { context, page } = await newPage(browser);
  await page.goto(url + "index.html");
  await page.waitForTimeout(500);

  // Manifest und Icons
  const manifest = await (await page.request.get(url + "manifest.webmanifest")).json();
  r.check("Manifest: Name, Standalone, Start-URL, Farben", manifest.name && manifest.display === "standalone" && manifest.start_url && manifest.background_color && manifest.theme_color);
  let iconsOk = true;
  const found = [];
  for (const icon of manifest.icons) {
    const res = await page.request.get(url + icon.src);
    const buf = await res.body();
    const size = pngSize(buf);
    found.push(`${icon.purpose}:${size.w}x${size.h}`);
    if (!res.ok() || `${size.w}x${size.h}` !== icon.sizes) iconsOk = false;
  }
  r.check("Icons vorhanden, Größen stimmen (192, 512, maskable)", iconsOk && manifest.icons.length === 3, found.join(" "));
  r.check("Apple-Touch-Icon und Favicon verlinkt", await page.evaluate(() => !!document.querySelector('link[rel="apple-touch-icon"]') && !!document.querySelector('link[rel="icon"]')));

  // Service Worker aktiv
  const active = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active && reg.active.state;
  });
  r.check("Service Worker ist aktiv", active === "activated", String(active));
  await page.reload();
  await page.waitForTimeout(500);
  r.check("Seite wird vom Service Worker kontrolliert", await page.evaluate(() => !!navigator.serviceWorker.controller));

  // Installierbarkeit laut Chromium
  const client = await context.newCDPSession(page);
  const inst = await client.send("Page.getInstallabilityErrors");
  // "in-incognito" kommt nur von der Test-Umgebung (Playwright-Profile gelten als Inkognito).
  const instErrors = inst.installabilityErrors.filter((e) => e.errorId !== "in-incognito");
  r.check("Chromium meldet keine Installierbarkeits-Fehler (Manifest, Icons, Service Worker)", instErrors.length === 0, JSON.stringify(inst.installabilityErrors));

  // Cache enthält die Dateien, Name mit Versionsnummer
  const cacheInfo = await page.evaluate(async () => {
    const names = await caches.keys();
    const keys = names.length ? (await (await caches.open(names[0])).keys()).map((k) => new URL(k.url).pathname) : [];
    return { names, keys };
  });
  r.check("Cache-Name mit Versionsnummer", cacheInfo.names.length === 1 && /^schach-training-v\d+$/.test(cacheInfo.names[0]), cacheInfo.names.join());
  r.check("Grundgerüst ist vorab gecacht", ["/index.html", "/js/app.js", "/css/app.css", "/vendor/chess.js/chess.js", "/vendor/chessground/chessground.min.js", "/icons/icon-192.png"].every((p) => cacheInfo.keys.includes(p)));

  // Netzwerk zuerst: online kommt die neueste Version, auch wenn eine ältere im Cache liegt
  const before = hits["/css/app.css"] || 0;
  overrides["/css/app.css"] = { type: "text/css", body: "body{background:#123456 !important}" };
  await page.reload();
  await page.waitForTimeout(500);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  r.check("Online: neueste Version vom Server (nicht aus dem Cache)", bg === "rgb(18, 52, 86)" && (hits["/css/app.css"] || 0) > before, bg);
  delete overrides["/css/app.css"];
  await page.reload();
  await page.waitForTimeout(500);
  r.check("Online: Änderung am Server ist nach dem Neuladen sofort da", (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(21, 23, 27)");

  // Offline
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(600);
  r.check("Offline: App lädt aus dem Cache", await page.evaluate(() => !!document.querySelector("#board .cg-wrap, #board cg-container, #board cg-board") && !document.getElementById("page-brett").hidden));
  await tapMove(page, "e2", "e4");
  r.check("Offline: Brett funktioniert", (await page.inputValue("#fen-input")).startsWith("rnbqkbnr/pppppppp/8/8/4P3/8/"));
  await page.goto(url + "index.html#/mehr/info");
  await page.waitForTimeout(400);
  await page.locator("details.license").nth(2).locator("summary").click();
  await page.waitForTimeout(400);
  r.check("Offline: Info-Seite und Lizenztext laden", /GNU GENERAL PUBLIC LICENSE/.test(await page.locator("details.license").nth(2).locator("pre").innerText()));
  await page.goto(url + "index.html#/mehr/daten");
  await page.waitForTimeout(300);
  r.check("Offline: Daten-Seite sichtbar", await page.evaluate(() => !document.getElementById("page-daten").hidden));
  await context.setOffline(false);

  // Neue Cache-Version: alte eigene Caches werden gelöscht, fremde bleiben
  const fs = require("fs");
  const swSource = fs.readFileSync(require("path").join(__dirname, "../../sw.js"), "utf8");
  await page.evaluate(async () => {
    await caches.open("schach-training-v0");
    await caches.open("andere-app-v1");
  });
  overrides["/sw.js"] = { type: "text/javascript", body: swSource.replace("const CACHE_VERSION = 1;", "const CACHE_VERSION = 2;") };
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await reg.update(); });
  await page.waitForTimeout(1500);
  const names = (await page.evaluate(() => caches.keys())).sort();
  r.check("Neue Version: alte eigene Caches gelöscht, fremder bleibt", names.join() === "andere-app-v1,schach-training-v2", names.join());
  delete overrides["/sw.js"];

  r.check("keine Skriptfehler", page.__errors.filter((e) => !/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(e)).length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
