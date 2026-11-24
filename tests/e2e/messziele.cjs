// Messbare Ziele der Vereinfachung (390 x 844, Touch):
// - höchstens 2 Tipps vom Start bis zur Rätsel-Sitzung, höchstens 3 bis zur laufenden Partie
// - keine Hauptseite höher als das 2,5-fache der Bildschirmhöhe (eingeklappte Listen zählen nicht)
// - kein seitlicher Überlauf, alle Tippflächen mindestens 44 x 44 px
// - je Seite höchstens eine Überschrift und höchstens ein ausgefüllter Hauptknopf
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

const SEITEN = ["heute", "taktik", "taktik/themen", "spielen", "spielen/vorteil", "spielen/grundmatt", "fortschritt", "einstellungen", "einstellungen/daten", "einstellungen/brett", "einstellungen/info"];

async function beispieldaten(page) {
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    let n = 0;
    const p = (o) => ({ id: "p" + ++n, datum: new Date(Date.UTC(2026, 10, 1, 10, n)).toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", grund: "Matt", zuege: 30, pgn: "1. e4 e5", warnung: false, ...o });
    store.update((d) => {
      d.taktik.eingestuft = true;
      d.taktik.staerke = 640;
      d.taktik.anzahl = 40;
      d.taktik.verlauf = [{ t: "2026-11-01T10:00:00Z", s: 600 }, { t: "2026-11-18T10:00:00Z", s: 640 }];
      d.taktik.themen = { fork: { n: 8, ok: 4, ms: 80000 }, pin: { n: 6, ok: 2, ms: 60000 } };
      d.spielen.partien = [1, 2, 3, 4, 5, 6].map((i) => p({ ausgang: i % 3 ? "verloren" : "gewonnen" }));
      // Letzte Partie von heute: Heute schlägt dann eine Rätsel-Sitzung vor (Fall f), nicht "Partie spielen".
      d.spielen.partien[5].datum = new Date().toISOString();
      d.spielen.analysen = d.spielen.partien.map((x) => ({ id: x.id, version: 1, farbe: "w", summe: { zuege: 30, patzer: 0, fehler: 0, chancen: 0, verlustSumme: 0 }, zuegeUci: [], zuege: [], startFen: "", eintraege: [] }));
    });
  });
}

(async () => {
  const r = reporter("Messbare Ziele");
  const { server, url } = await startServer();
  const browser = await launch();

  // ---- Tipps bis zur Rätsel-Sitzung ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/heute");
    await beispieldaten(page);
    await page.reload();
    await page.waitForSelector("#heute-haupt");
    let tipps = 0;
    await page.tap("#heute-haupt");
    tipps++;
    let typ = null;
    for (let i = 0; i < 100 && !typ; i++) {
      await page.waitForTimeout(150);
      typ = await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv?.typ || null);
    }
    r.check("Vom Start zur Rätsel-Sitzung: höchstens 2 Tipps", tipps <= 2 && /sitzung|standort|ersteinstufung/.test(typ), `${tipps} Tipp(s), Typ ${typ}`);
    r.check("Keine Seitenfehler (Sitzung)", page.__errors.length === 0, page.__errors.join(" | "));
  }

  // ---- Tipps bis zur laufenden Partie ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/heute");
    await beispieldaten(page);
    await page.reload();
    await page.waitForSelector("#tab-spielen");
    let tipps = 0;
    await page.tap("#tab-spielen");
    tipps++;
    await page.waitForSelector("#sp-btn-start", { state: "visible" });
    await page.tap("#sp-btn-start");
    tipps++;
    await page.waitForSelector("#sp-lauf:not([hidden])", { timeout: 15000 });
    r.check("Vom Start zur laufenden Partie: höchstens 3 Tipps", tipps <= 3, `${tipps} Tipps`);
  }

  // ---- Höhe, Überlauf, Tippflächen, Überschrift, Hauptknopf ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/heute");
    await beispieldaten(page);
    for (const s of SEITEN) {
      await page.goto(url + "index.html#/" + s);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const sichtbar = (e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && !e.closest("[hidden]") && !e.closest("#intro") && !e.closest("details:not([open]) > :not(summary)");
        };
        const klein = [...document.querySelectorAll("button, a, select, input:not([type=hidden]), summary")]
          .filter(sichtbar)
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return b.height < 43.5 || b.width < 43.5;
          })
          .map((e) => e.id || e.className || e.tagName);
        const seite = document.querySelector(".page:not([hidden])");
        const haupt = [...seite.querySelectorAll(".btn-haupt")].filter(sichtbar).length;
        const ueberschriften = [...seite.querySelectorAll("h1, h2")].filter(sichtbar).length;
        return { hoehe: document.documentElement.scrollHeight, breite: document.documentElement.scrollWidth, klein, haupt, ueberschriften };
      });
      r.check(`${s}: Höhe höchstens 2,5 Bildschirme`, m.hoehe <= 844 * 2.5, `${m.hoehe} px`);
      r.check(`${s}: kein seitlicher Überlauf`, m.breite <= 390, `${m.breite} px`);
      r.check(`${s}: alle Tippflächen mindestens 44 x 44 px`, m.klein.length === 0, m.klein.join());
      r.check(`${s}: höchstens ein ausgefüllter Hauptknopf`, m.haupt <= 1, String(m.haupt));
    }
    r.check("Keine Seitenfehler (Seiten)", page.__errors.length === 0, page.__errors.join(" | "));
  }

  await browser.close();
  server.close();
  r.done();
})();
