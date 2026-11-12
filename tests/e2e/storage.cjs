// Prüft im Browser: ein Schlüssel mit Versionsnummer, persist() wird bei jedem Start angefragt.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Speicher im Browser");
  const { server, url } = await startServer();
  const browser = await launch();
  const { context, page } = await newPage(browser);
  await page.addInitScript(() => {
    window.__persistCalls = 0;
    const orig = navigator.storage.persist.bind(navigator.storage);
    navigator.storage.persist = () => { window.__persistCalls++; return orig(); };
  });
  await page.goto(url + "index.html");
  await page.waitForTimeout(500);
  r.check("persist() wird beim Start angefragt", (await page.evaluate(() => window.__persistCalls)) >= 1);

  const mod = await page.evaluate(async () => {
    const m = await import("./js/storage.js");
    m.store.update((d) => { d.taktik.staerke = 1111; });
    const keys = Object.keys(localStorage);
    return { keys, stored: JSON.parse(localStorage.getItem("schach-training")) };
  });
  r.check("genau ein Schlüssel in localStorage", mod.keys.join() === "schach-training", mod.keys.join());
  r.check("Schlüssel enthält Versionsnummer", mod.stored.version === 2 && mod.stored.app === "schach-training");
  await page.reload();
  await page.waitForTimeout(400);
  const again = await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.staerke);
  r.check("Daten überstehen ein Neuladen", again === 1111, String(again));
  r.check("keine Skriptfehler", page.__errors.length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
