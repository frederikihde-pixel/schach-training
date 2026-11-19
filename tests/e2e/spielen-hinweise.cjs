// Startseite Spielen: "Offene Rückblicke: N" und "Fällige eigene Rätsel: N", jeweils mit Knopf.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Hinweise Startseite Spielen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html#/spielen");
  await page.waitForSelector("#sp-start:not([hidden])");
  const t = (id) => page.textContent(id);
  r.check("Leer: 'Offene Rückblicke: 0' und 'Fällige eigene Rätsel: 0', Knöpfe gesperrt", (await t("#sp-hinweis-rueckblick")) === "Offene Rückblicke: 0" && (await t("#sp-hinweis-raetsel")) === "Fällige eigene Rätsel: 0" && (await page.isDisabled("#sp-hinweis-rueckblick-btn")) && (await page.isDisabled("#sp-hinweis-raetsel-btn")));

  const seed = async () => page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const { dayKey, addDays } = await import("./js/leitner.js");
    const e = (id, modus, min) => ({ id, datum: new Date(Date.UTC(2026, 10, 10, 10, min)).toISOString(), modus, farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", grund: "Aufgabe", zuege: 3, pgn: "1. e4 e5", warnung: false, art: "dame", matt: false, mattIn: null });
    const gestern = addDays(dayKey(new Date()), -1);
    const heute = dayKey(new Date());
    const morgen = addDays(heute, 1);
    const puzzle = (id) => ({ id, fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 1", zuege: "g8f6 h5f7", richtig: ["h5f7"], rating: null, themen: ["eigenerFehler"], eigen: true, nr: 4, partieId: "x", art: "patzer", datum: null });
    store.update((d) => {
      d.spielen.partien.push(e("pa", "partie", 1), e("pb", "partie", 2));
      d.spielen.versuche.push(e("g1", "grundmatt", 3), e("v1", "vorteil", 4));
      for (const id of ["e1", "e2", "e3"]) d.taktik.karten[id] = { stufe: 1, faellig: gestern, raetsel: puzzle(id) };
      d.taktik.karten.e4 = { stufe: 2, faellig: morgen, raetsel: puzzle("e4") };
      d.taktik.karten.n1 = { stufe: 1, faellig: gestern, raetsel: { ...puzzle("n1"), eigen: false, themen: ["fork"] } };
    });
  });
  await seed();
  await page.goto(url + "index.html#/brett");
  await page.goto(url + "index.html#/spielen");
  await page.waitForTimeout(300);
  r.check("Offene Rückblicke zählt Partien und Vorteil-Übungen, nicht Grundmatts: 3", (await t("#sp-hinweis-rueckblick")) === "Offene Rückblicke: 3", await t("#sp-hinweis-rueckblick"));
  r.check("Fällige eigene Rätsel zählt nur eigene Fehler, die fällig sind: 3", (await t("#sp-hinweis-raetsel")) === "Fällige eigene Rätsel: 3", await t("#sp-hinweis-raetsel"));
  const hoehen = await page.locator("#sp-hinweise button").evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]));
  r.check("Beide Knöpfe mindestens 44 px", hoehen.length === 2 && hoehen.every(([h, w]) => h >= 44 && w >= 44), JSON.stringify(hoehen));
  r.check("Der Hinweis ist klein und ruhig (keine Zahl-Blase, kein Effekt)", await page.evaluate(() => !document.querySelector("#sp-hinweise .badge, #sp-hinweise [class*=pulse]") && document.documentElement.scrollWidth === window.innerWidth));
  await page.click("#sp-hinweis-rueckblick-btn");
  await page.waitForTimeout(200);
  r.check("Knopf bei mehreren offenen Rückblicken führt zu 'Meine Partien'", (await page.evaluate(() => location.hash)) === "#/spielen/liste");

  // genau ein offener Rückblick: direkt dorthin
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.spielen.analysen.push({ id: "pa", version: 1, farbe: "w", startFen: "", zuegeUci: [], zuege: [], eintraege: [], summe: { zuege: 0, patzer: 0, fehler: 0, chancen: 0, verlustSumme: 0 } });
      d.spielen.analysen.push({ id: "pb", version: 1, farbe: "w", startFen: "", zuegeUci: [], zuege: [], eintraege: [], summe: { zuege: 0, patzer: 0, fehler: 0, chancen: 0, verlustSumme: 0 } });
    });
  });
  await page.goto(url + "index.html#/spielen");
  await page.waitForTimeout(200);
  r.check("Mit fertigem Rückblick sinkt die Zahl: 1", (await t("#sp-hinweis-rueckblick")) === "Offene Rückblicke: 1");
  await page.click("#sp-hinweis-rueckblick-btn");
  await page.waitForTimeout(300);
  r.check("Bei genau einem offenen Rückblick öffnet der Knopf ihn direkt", (await page.evaluate(() => location.hash)) === "#/spielen/rueckblick/v1");

  // eigene Rätsel üben (ohne Einstufung)
  await page.goto(url + "index.html#/spielen");
  await page.waitForTimeout(200);
  await page.click("#sp-hinweis-raetsel-btn");
  await page.waitForSelector("#taktik-lauf:not([hidden])");
  await page.waitForTimeout(800);
  const a = await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv);
  r.check("Der Knopf startet eine Sitzung nur mit den 3 fälligen eigenen Rätseln (auch ohne Einstufung)", a.plan.length === 3 && a.plan.every((x) => x.puzzle.eigen && x.art === "wiederholung"), String(a.plan.length));
  r.check("Im Trainer steht 'Eigener Fehler (Zug 4)', 'Rätsel 1 von 3'", /Eigener Fehler \(Zug 4\)/.test(await t("#lauf-art")) && /Rätsel 1 von 3/.test(await t("#lauf-fortschritt")));

  // Läuft eine Sitzung, erklärt die Seite es ruhig
  await page.goto(url + "index.html#/spielen");
  await page.waitForTimeout(200);
  await page.click("#sp-hinweis-raetsel-btn");
  r.check("Bei laufender Sitzung: ruhige Erklärung, nichts wird überschrieben", /läuft gerade eine Sitzung/.test(await t("#sp-hinweis-meldung")) && (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv.plan.length)) === 3);
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
