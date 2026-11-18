// Offline nach dem ersten Spiel: Die Engine liegt im Zwischenspeicher. Ohne vorherigen Gebrauch: verständliche Meldung.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

async function until(page, fn, arg, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(150);
  }
  throw new Error("Zeitüberschreitung");
}
const zuege = (n) => until(arguments_page, async (n) => ((await import("./js/storage.js")).store.get().spielen.aktiv?.zuege.length || 0) >= n, n);
let arguments_page;

(async () => {
  const r = reporter("Spielen offline");
  const { server, hits, url } = await startServer();
  const browser = await launch();

  // --- A: erst online spielen, dann offline weiterspielen ---
  const { context, page } = await newPage(browser);
  arguments_page = page;
  await page.goto(url + "index.html#/spielen/partie");
  await page.waitForTimeout(800);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const engineVorher = Object.keys(hits).filter((k) => /stockfish-19.*\.(js|wasm)$/.test(k));
  r.check("Vor dem Spielen ist die Engine nicht geladen", engineVorher.length === 0);
  await page.selectOption("#sp-stufe", "1");
  if ((await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "true") await page.click("#sp-sw-warnung");
  await page.click("#sp-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await tapMove(page, "e2", "e4", "white", "#sp-board");
  await zuege(2);
  r.check("Online: Computer hat geantwortet, Engine wurde jetzt geladen", Object.keys(hits).filter((k) => /stockfish-19.*\.(js|wasm)$/.test(k)).length >= 2);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await page.waitForTimeout(500);
  r.check("Offline: App und laufende Partie sind da", (await page.locator("#sp-board piece").count()) >= 30);
  await tapMove(page, "g1", "f3", "white", "#sp-board");
  await zuege(4);
  const a = await page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen.aktiv);
  r.check("Offline: Computer antwortet mit der Engine aus dem Zwischenspeicher", a.zuege.length === 4 && a.zuege[2] === "g1f3");
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  r.check("Offline: Partie wird gespeichert", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen.partien.length)) === 1);
  await context.setOffline(false);
  r.check("Keine Seitenfehler (A)", page.__errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)).length === 0, page.__errors.join(" | "));
  await context.close();

  // --- B: offline, Engine nie geladen: verständliche Meldung statt Absturz ---
  const { context: c2, page: p2 } = await newPage(browser);
  arguments_page = p2;
  await p2.goto(url + "index.html#/spielen/partie");
  await p2.waitForTimeout(800);
  await p2.evaluate(() => navigator.serviceWorker.ready);
  await c2.setOffline(true);
  if ((await p2.getAttribute("#sp-sw-warnung", "aria-checked")) === "true") await p2.click("#sp-sw-warnung");
  await p2.selectOption("#sp-farbe", "b"); // Schwarz: der Computer muss zuerst ziehen
  await p2.click("#sp-btn-start");
  await p2.waitForSelector("#sp-lauf:not([hidden])");
  await p2.waitForSelector("#sp-fehler:not([hidden])", { timeout: 40000 });
  r.check("Engine offline nicht verfügbar: Meldung 'Der Computergegner ist auf diesem Gerät nicht verfügbar.'", (await p2.textContent("#sp-fehler-text")) === "Der Computergegner ist auf diesem Gerät nicht verfügbar.", await p2.textContent("#sp-fehler-text"));
  r.check("Brett bleibt gesperrt, Aufgeben und 'Erneut versuchen' sind möglich", (await p2.isVisible("#sp-btn-nochmal")) && !(await p2.isDisabled("#sp-btn-aufgeben")));
  await c2.setOffline(false);
  await p2.click("#sp-btn-nochmal");
  await until(p2, async () => ((await import("./js/storage.js")).store.get().spielen.aktiv?.zuege.length || 0) >= 1, null, 20000);
  r.check("Wieder online: 'Erneut versuchen' holt den Computerzug", true);
  r.check("Keine Seitenfehler (B)", p2.__errors.filter((e) => !/Failed to load resource|net::ERR|503/.test(e)).length === 0, p2.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
