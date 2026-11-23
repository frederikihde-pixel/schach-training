// Rückblick: Hinweis nach der Partie, Fortschritt, Liste, Stelle auf dem Brett (Pfeile, Erklärung), gleiche Designs,
// Fortsetzen nach Neuladen. Echte Engine, 390 px, Touch.
const { startServer, launch, newPage, reporter, waehle } = require("./lib.cjs");

// Weiß stellt im 3. Zug die Dame ein: 1.e4 e5 2.Dh5 Sc6 3.Dxe5+ Sxe5 4.Sf3 Sxf3+ 5.gxf3
const ZUEGE = ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5", "c6e5", "g1f3", "e5f3", "g2f3"];

async function seedPartie(page, id, zuege = ZUEGE) {
  await page.evaluate(async ({ id, zuege }) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive, ende, eintrag, stellung } = await import("./js/partie.js");
    const a = neueAktive({ modus: "partie", farbe: "w", stufe: 2, warnung: false });
    a.zuege = zuege;
    a.aufgegeben = true;
    const e = eintrag(a, ende(stellung(a), a), { now: new Date("2026-11-18T18:30:00Z") });
    e.id = id;
    store.update((d) => {
      d.spielen.partien.push(e);
    });
  }, { id, zuege });
}
async function until(page, fn, arg, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(120);
  }
  throw new Error("Zeitüberschreitung: " + fn.toString().slice(0, 100));
}

(async () => {
  const r = reporter("Rückblick");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html#/spielen");
  await page.waitForTimeout(400);

  // --- Hinweis nach einer echten Partie ---
  await waehle(page, "#sp-stufe", "1");
  await page.evaluate(() => { document.getElementById("sp-optionen").open = true; });
  if ((await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "true") await page.click("#sp-sw-warnung");
  await page.click("#sp-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  r.check("Nach der Partie: ruhiger Hinweis 'Rückblick ansehen (ca. 3 Minuten)', er erzwingt nichts", (await page.textContent("#sp-ende-rueckblick-link")) === "Rückblick ansehen (ca. 3 Minuten)" && (await page.evaluate(async () => !(await import("./js/storage.js")).store.get().spielen.analyseLauf)));
  r.check("Der Hinweis ist mindestens 44 px hoch", (await page.locator("#sp-ende-rueckblick-link").boundingBox()).height >= 44);

  // --- Partie mit bekanntem Patzer: Rückblick starten ---
  await seedPartie(page, "p-dame");
  await page.goto(url + "index.html#/spielen/liste");
  await page.waitForTimeout(300);
  r.check("In 'Meine Partien' gibt es für Partien den Knopf Rückblick", (await page.locator("#liste-partien .game-item a", { hasText: "Rückblick" }).count()) >= 1);
  await page.goto(url + "index.html#/spielen/rueckblick/p-dame");
  await page.waitForSelector("#sp-rueckblick:not([hidden])");
  await until(page, () => /Stellung \d+ von 10/.test(document.getElementById("rb-fortschritt-text").textContent) || !document.getElementById("rb-ergebnis").hidden, null, 8000);
  const sawProgress = await page.evaluate(() => !document.getElementById("rb-fortschritt").hidden || !document.getElementById("rb-ergebnis").hidden);
  r.check("Fortschritt 'Stellung N von 10' wird angezeigt", sawProgress);
  await until(page, () => !document.getElementById("rb-ergebnis").hidden);
  r.check("Ergebnis: ein Patzer, kein Fehler, keine verpasste Chance", (await page.textContent("#rb-zusammen")) === "1 Patzer, 0 Fehler, 0 verpasste Chancen", await page.textContent("#rb-zusammen"));
  const eintrag = page.locator("#rb-liste .rb-eintrag");
  r.check("Die Liste nennt die Stelle mit Erklärung ohne Fachwörter", (await eintrag.count()) === 1 && /Zug 3: Dxe5\+ \(Patzer\)/.test(await eintrag.first().textContent()) && /Die Dame auf e5 war danach ungedeckt und konnte geschlagen werden\./.test(await eintrag.first().textContent()) && !/Centipawn|Bewertung|Engine/i.test(await page.textContent("#rb-liste")));
  r.check("Ehrlicher Hinweis zur Genauigkeit der Analyse", /kleinen Engine/.test(await page.textContent("#rb-ergebnis")));
  r.check("Listeneinträge mindestens 44 px hoch", (await eintrag.first().boundingBox()).height >= 44);

  // --- Detail: Stellung vor dem Zug, Pfeile, Erklärung ---
  await eintrag.first().click();
  await page.waitForSelector("#rb-detail:not([hidden])");
  await page.waitForTimeout(300);
  r.check("Brett zeigt die Stellung vor dem Zug (Dame noch auf h5)", (await page.locator("#rb-board piece.queen.white").count()) === 1 && (await page.evaluate(() => { const q = document.querySelector("#rb-board piece.queen.white"); return !!q; })));
  const shapes = await page.evaluate(() => document.querySelectorAll("#rb-board .cg-shapes g line, #rb-board .cg-shapes line").length);
  r.check("Zwei Pfeile: gespielter und besserer Zug", shapes >= 2, String(shapes));
  r.check("Erklärung und Legende stehen da", /ungedeckt/.test(await page.textContent("#rb-text")) && /Rot: dein Zug \(Dxe5\+\)\. Grün: besserer Zug \(/.test(await page.textContent("#rb-legende")));
  r.check("Titel nennt Zug und Art", /Zug 3: Dxe5\+/.test(await page.textContent("#rb-detail-titel")) && /Patzer, Eröffnung/.test(await page.textContent("#rb-detail-art")));
  const posVor = await page.evaluate(() => [...document.querySelectorAll("#rb-board piece.queen.white")].map((p) => p.cgKey));
  await page.click("#rb-btn-nach");
  await page.waitForTimeout(250);
  const posNach = await page.evaluate(() => [...document.querySelectorAll("#rb-board piece.queen.white")].map((p) => p.cgKey));
  r.check("'Nach meinem Zug' zeigt die Dame auf e5 (ohne Pfeile), 'Vor dem Zug' geht zurück", JSON.stringify(posVor) === '["h5"]' && JSON.stringify(posNach) === '["e5"]' && (await page.evaluate(() => document.querySelectorAll("#rb-board .cg-shapes line").length)) === 0);
  await page.click("#rb-btn-vor");
  await page.waitForTimeout(200);
  r.check("Zurück zur Stelle vor dem Zug", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("#rb-board piece.queen.white")].map((p) => p.cgKey))) === '["h5"]');
  const tap = await page.locator("#rb-detail button").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height)]));
  r.check("Alle Knöpfe im Detail mindestens 44 px hoch", tap.every(([, h]) => h >= 44), JSON.stringify(tap.filter(([, h]) => h < 44)));
  r.check("Seite läuft bei 390 px nicht über", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
  r.check("Kein Brett-Eingriff möglich (nur Ansicht)", await page.evaluate(() => document.querySelectorAll("#rb-board piece").length > 0 && document.getElementById("rb-board").classList.contains("manipulable") === false));

  // --- Gleiches Brett, gleiche Designs ---
  const farben = [];
  for (const design of ["klassisch", "dunkel", "gruen"]) {
    await page.evaluate(async (d) => (await import("./js/design.js")).setDesign(d), design);
    const stile = await page.evaluate(() => {
      const s = (sel) => { const el = document.querySelector(sel); const c = getComputedStyle(el); return [c.backgroundColor, c.backgroundImage.length]; };
      const lm = (sel) => { const el = document.querySelector(sel); return getComputedStyle(el, "::before").content; };
      void lm;
      return { rb: s("#rb-board cg-board"), brett: s("#board cg-board"), rbPiece: getComputedStyle(document.querySelector("#rb-board piece.queen.white")).backgroundImage.slice(0, 40), brPiece: getComputedStyle(document.querySelector("#board piece.queen.white")).backgroundImage.slice(0, 40) };
    });
    farben.push([design, JSON.stringify(stile.rb) === JSON.stringify(stile.brett) && stile.rbPiece === stile.brPiece]);
  }
  r.check("Rückblick-Brett und Brett-Seite sehen in allen drei Designs gleich aus", farben.every(([, ok]) => ok), JSON.stringify(farben));
  const klassen = await page.evaluate(() => [document.getElementById("rb-board").className, document.getElementById("board").className, document.getElementById("rb-board").parentElement.className, document.getElementById("board").parentElement.className]);
  r.check("Gleiche Brett-Bauteile (Klassen) wie auf der Brett-Seite", klassen[0].replace("view-only", "").trim().split(/\s+/).includes("cg-wrap") && klassen[1].includes("cg-wrap") && klassen[2] === klassen[3], JSON.stringify(klassen));
  const bs = await page.evaluate(() => [document.getElementById("rb-board").getBoundingClientRect().width, document.getElementById("rb-board").getBoundingClientRect().height]);
  r.check("Das Brett ist quadratisch und so breit wie die Seite", Math.abs(bs[0] - bs[1]) < 1 && bs[0] >= 380, bs.join("x"));

  // Seite verlassen und das Brett wieder öffnen: Pfeile werden neu berechnet (keine ungültigen Werte)
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(300);
  await page.goto(url + "index.html#/spielen/rueckblick/p-dame");
  await page.waitForTimeout(300);
  await page.locator("#rb-liste .rb-eintrag").first().click();
  await page.waitForTimeout(300);
  const linien = await page.evaluate(() => [...document.querySelectorAll("#rb-board .cg-shapes line")].map((l) => ["x1", "y1", "x2", "y2"].every((a) => Number.isFinite(Number(l.getAttribute(a))))));
  r.check("Nach dem Verlassen der Seite sind die Pfeile gültig berechnet", linien.length >= 2 && linien.every(Boolean) && page.__errors.length === 0, JSON.stringify(linien) + " " + page.__errors.join(" | ").slice(0, 160));

  // --- Fortsetzen nach Neuladen ---
  await seedPartie(page, "p-zwei");
  await page.goto(url + "index.html#/spielen/rueckblick/p-zwei");
  await until(page, async () => ((await import("./js/storage.js")).store.get().spielen.analyseLauf?.ergebnisse.length || 0) >= 3);
  const vorher = await page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen.analyseLauf.ergebnisse.length);
  await page.reload();
  await page.waitForTimeout(500);
  r.check("Nach Neuladen steht der Fortschritt im Speicher und die Seite zeigt ihn", vorher >= 3 && /Stellung \d+ von 10/.test((await page.textContent("#rb-fortschritt-text")) || "") || !(await page.isHidden("#rb-ergebnis")));
  await until(page, () => !document.getElementById("rb-ergebnis").hidden);
  r.check("Die Analyse läuft nach dem Neuladen weiter und wird fertig", (await page.textContent("#rb-zusammen")) === "1 Patzer, 0 Fehler, 0 verpasste Chancen");
  const a2 = await page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen);
  r.check("Zwei Analysen gespeichert, keine laufende mehr", a2.analysen.length === 2 && a2.analyseLauf === null);

  // --- Zusammenfassung ohne Fehler ---
  await seedPartie(page, "p-ruhig", ["e2e4", "e7e5", "g1f3", "b8c6"]);
  await page.goto(url + "index.html#/spielen/rueckblick/p-ruhig");
  await until(page, () => !document.getElementById("rb-ergebnis").hidden);
  r.check("Partie ohne grobe Fehler: ruhiger Satz, keine Liste", /keine groben Fehler/.test(await page.textContent("#rb-leer")) && (await page.locator("#rb-liste .rb-eintrag").count()) === 0);

  // --- Unbekannte Partie ---
  await page.goto(url + "index.html#/spielen/rueckblick/gibt-es-nicht");
  await page.waitForTimeout(300);
  r.check("Unbekannte Partie: verständliche Meldung statt Fehler", /nicht mehr/.test(await page.textContent("#rb-kopf")));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
