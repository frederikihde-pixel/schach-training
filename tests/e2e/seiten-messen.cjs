// Misst alle Hauptseiten bei 390 x 844 (Höhe, Zahl der Tippflächen) und macht Screenshots.
// Aufruf: node tests/e2e/seiten-messen.cjs vorher|nachher
// Schreibt tests/screenshots/<phase>/*.png und messung.json. Ist kein Test, sondern ein Werkzeug für den Vergleich.
const fs = require("fs");
const path = require("path");
const { startServer, launch, newPage } = require("./lib.cjs");

const PHASE = process.argv[2] || "nachher";
const ROUTEN = {
  vorher: ["brett", "taktik", "taktik/statistik", "taktik/themen", "spielen", "spielen/partie", "spielen/grundmatt", "spielen/vorteil", "spielen/liste", "spielen/fortschritt", "mehr", "mehr/einstellungen", "mehr/darstellung", "mehr/daten", "mehr/info"],
  nachher: ["heute", "taktik", "taktik/themen", "spielen", "spielen/vorteil", "spielen/grundmatt", "fortschritt", "einstellungen", "einstellungen/daten", "einstellungen/brett", "einstellungen/info"],
};

// Gleiche Beispieldaten für Vorher und Nachher: eingestuft, 8 Partien, 6 Analysen, Rätselzähler.
async function beispieldaten(page) {
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    let n = 0;
    const p = (o) => ({ id: "p" + ++n, datum: new Date(Date.UTC(2026, 10, 1, 10, n)).toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", grund: "Matt", zuege: 30, pgn: "1. e4 e5", warnung: false, ...o });
    const an = (id, k) => ({ id, version: 1, farbe: "w", summe: { zuege: 30, patzer: k, fehler: 0, chancen: 0, verlustSumme: 2400 }, zuegeUci: [], zuege: [], startFen: "", eintraege: [...Array(k)].map(() => ({ art: "patzer", ursache: "figur", phase: "mittelspiel" })) });
    store.update((d) => {
      d.taktik.eingestuft = true;
      d.taktik.staerke = 640;
      d.taktik.anzahl = 40;
      d.taktik.verlauf = [{ t: "2026-11-01T10:00:00Z", s: 600 }, { t: "2026-11-10T10:00:00Z", s: 630 }, { t: "2026-11-18T10:00:00Z", s: 640 }];
      d.taktik.sitzungen = [{ datum: "2026-11-10T10:00:00Z", n: 10 }];
      d.taktik.themen = { fork: { n: 8, ok: 4, ms: 80000 }, pin: { n: 6, ok: 2, ms: 60000 }, mateIn1: { n: 9, ok: 8, ms: 40000 } };
      d.spielen.partien = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => p({ ausgang: i % 3 ? "verloren" : "gewonnen" }));
      d.spielen.analysen = [1, 2, 3, 4, 5, 6].map((i) => an("p" + i, i % 4));
    });
  });
}

(async () => {
  const dir = path.join(__dirname, "../screenshots", PHASE);
  fs.mkdirSync(dir, { recursive: true });
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser, { deviceScaleFactor: 1 });
  await page.goto(url + "index.html");
  await beispieldaten(page);
  const rows = [];
  for (const r of ROUTEN[PHASE]) {
    await page.goto(url + "index.html#/" + r);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const sichtbar = (e) => e.offsetParent && !e.closest("[hidden]") && !e.closest(".intro");
      const tipps = [...document.querySelectorAll("button, a, select, input, textarea")].filter(sichtbar).length;
      return { hoehe: document.documentElement.scrollHeight, tipps, breite: document.documentElement.scrollWidth };
    });
    rows.push({ route: r, ...m, bildschirme: +(m.hoehe / 844).toFixed(2) });
    await page.screenshot({ path: path.join(dir, r.replace(/\//g, "-") + ".png") });
  }
  fs.writeFileSync(path.join(dir, "messung.json"), JSON.stringify(rows, null, 1));
  for (const x of rows) console.log(`${x.route.padEnd(22)} ${String(x.hoehe).padStart(5)} px  ${String(x.bildschirme).padStart(5)}x  Tippflächen ${x.tipps}  Breite ${x.breite}`);
  await browser.close();
  server.close();
})();
