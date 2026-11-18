// Alle sichtbaren Bedienelemente der Spielen-Seiten (und der PGN-Eingabe im Brett) sind mindestens 44 x 44 px groß.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Tippflächen Spielen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html#/spielen");
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const { neueAktive, ende, eintrag, stellung } = await import("./js/partie.js");
    store.update((d) => {
      const a = neueAktive({ modus: "partie", farbe: "w", stufe: 2, zuruecknahme: true, warnung: true });
      a.zuege = ["e2e4", "e7e5"];
      d.spielen.aktiv = a;
      const b = neueAktive({ modus: "partie", farbe: "w", stufe: 1 });
      b.zuege = ["f2f3", "e7e5", "g2g4", "d8h4"];
      d.spielen.partien.push(eintrag(b, ende(stellung(b), b)));
    });
  });
  const pruefe = async (name, route, nachher = null) => {
    await page.goto(url + "index.html" + route);
    await page.reload();
    await page.waitForTimeout(500);
    if (nachher) await nachher();
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("button, a, select, input, textarea")) {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
        if (el.closest("[hidden]")) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.height < 43.5 || b.width < 43.5) out.push(`${el.id || el.textContent.trim().slice(0, 20)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return out;
    });
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    r.check(`${name}: alle Tippflächen mindestens 44 px`, bad.length === 0, bad.join("; "));
    r.check(`${name}: kein seitliches Überlaufen`, w[0] === w[1], w.join("/"));
  };
  await pruefe("Startseite (mit laufender Partie)", "#/spielen");
  await pruefe("Meine Partien", "#/spielen/liste");
  await pruefe("Partie: Einstellungen", "#/spielen/partie");
  await pruefe("Vorteil: Einstellungen", "#/spielen/vorteil");
  await pruefe("Grundmatts: Auswahl", "#/spielen/grundmatt");
  await pruefe("Partie läuft", "#/spielen/lauf", async () => {
    await page.click("#sp-btn-aufgeben");
  });
  await pruefe("Brett mit PGN-Eingabe", "#/brett");
  await page.goto(url + "index.html#/spielen/lauf");
  await page.waitForTimeout(500);
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  const bad = await page.evaluate(() => [...document.querySelectorAll("#sp-ende button, #sp-ende a")].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent));
  r.check("Endseite: alle Tippflächen mindestens 44 px", bad.length === 0, bad.join(","));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
