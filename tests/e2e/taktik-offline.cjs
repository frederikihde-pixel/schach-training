// Offline: Nach einem ersten Besuch (online) laufen Sitzung und Standortbestimmung ohne Netzwerk.
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Taktik offline");
  const { server, url } = await startServer();
  const browser = await launch();
  const { context, page } = await newPage(browser);

  await page.goto(url + "index.html#/taktik");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => { d.taktik.staerke = 1500; d.taktik.eingestuft = true; });
  });
  // Neu laden: jetzt kontrolliert der Service Worker die Seite; die Taktik-Seite holt die Bänder im Hintergrund.
  await page.reload();
  await page.waitForTimeout(2500);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const keys = (await (await caches.open(names[0])).keys()).map((k) => new URL(k.url).pathname);
    return keys.filter((k) => k.includes("/data/puzzles/"));
  });
  r.check("Bänder rund um die Stärke (1300 bis 1700) und das Prüfset sind im Cache", ["band-1300", "band-1400", "band-1500", "band-1600", "band-1700", "pruefset"].every((n) => cached.some((k) => k.includes(n))), cached.map((k) => k.split("/").pop()).join(","));
  r.check("Nicht benötigte Bänder werden nicht geladen (nicht alle Dateien auf einmal)", cached.length <= 8, `${cached.length} Dateien`);

  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(800);
  r.check("Offline: Taktik-Seite lädt", await page.evaluate(() => !document.getElementById("page-taktik").hidden && !document.getElementById("btn-sitzung").disabled));
  await page.selectOption("#sel-groesse", "5");
  await page.click("#btn-sitzung");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 10000 });
  r.check("Offline: Sitzung startet aus den zwischengespeicherten Bändern", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 5");
  const cur = await currentPuzzle(page);
  const o = await waitForSide(page);
  const mv = cur.puzzle.zuege.split(" ");
  for (let k = 1; k < mv.length; k += 2) { await playUci(page, mv[k], o); await page.waitForTimeout(k === mv.length - 1 ? 300 : 900); }
  await page.waitForFunction(() => /Richtig/.test(document.getElementById("lauf-meldung").textContent), null, { timeout: 10000 });
  r.check("Offline: Rätsel lässt sich lösen und wird gespeichert", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.versuche.length)) === 1);
  await page.click("#btn-beenden");
  await page.click("#btn-beenden-ja");
  await page.waitForSelector("#taktik-zusammenfassung:not([hidden])");

  await page.goto(url + "index.html#/taktik/statistik");
  await page.waitForTimeout(600);
  r.check("Offline: Standortbestimmung ist verfügbar (Prüfset im Cache)", await page.evaluate(() => !document.getElementById("btn-standort").disabled));
  await page.click("#btn-standort");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 10000 });
  r.check("Offline: Standortbestimmung startet mit 20 Rätseln", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 20");
  await page.click("#btn-beenden");
  await page.click("#btn-beenden-ja");

  // Ein Band, das nie geladen wurde, fehlt offline: freundliche Meldung statt Absturz.
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => { d.taktik.staerke = 2400; });
  });
  await page.goto(url + "index.html#/taktik");
  await page.reload();
  await page.waitForTimeout(600);
  await page.click("#btn-sitzung");
  await page.waitForTimeout(1500);
  const msg = await page.textContent("#taktik-meldung");
  r.check("Offline ohne passendes Band: verständliche Meldung, App läuft weiter", /konnten nicht geladen werden/.test(msg) && (await page.evaluate(() => !document.getElementById("taktik-start").hidden)), msg);

  await context.setOffline(false);
  r.check("keine Skriptfehler (offline)", page.__errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|503/.test(e)).length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
