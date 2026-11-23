// Fortschritt: leer ("zu wenig Daten") und mit Beispieldaten; nur aktuelle Stufenversion, Patzer-Warnung getrennt.
const { startServer, launch, newPage, reporter, oeffneAlle } = require("./lib.cjs");

(async () => {
  const r = reporter("Fortschritt");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  const text = (id) => page.innerText(id);

  // --- leer ---
  await page.goto(url + "index.html#/spielen/fortschritt");
  await page.waitForSelector("#page-fortschritt:not([hidden])");
  await oeffneAlle(page);
  r.check("Alte Adresse #/spielen/fortschritt führt zu Fortschritt, Reiter markiert, Hauptort ohne Zurück-Pfeil", (await page.getAttribute("#tab-fortschritt", "aria-current")) === "page" && (await page.evaluate(() => location.hash)) === "#/fortschritt" && (await page.isHidden("#btn-zurueck")));
  r.check("Leer: 'zu wenig Daten' statt Zahlen, kein Diagramm", /zu wenig Daten/.test(await text("#fs-partien")) && /zu wenig Daten/.test(await text("#fs-analyse")) && (await page.isHidden("#fs-analyse-inhalt")) && (await page.locator("#fs-diagramm svg").count()) === 0);
  r.check("Leer: Stufenempfehlung nennt, was fehlt", /Noch keine Empfehlung/.test(await text("#fs-empfehlung-text")));
  r.check("Leer: eigene Rätsel 0, Grundmatts und Vorteil 'noch keine'", /Gespeicherte eigene Rätsel 0/.test((await text("#fs-eigene-zahlen")).replace(/\s+/g, " ")) && /noch keine/.test(await text("#fs-grundmatt-zahlen")) && /noch keine/.test(await text("#fs-vorteil-zahlen")));
  r.check("Ehrliche Hinweise: Zufall, ab 10 Partien aussagekräftig, Computer spielt anders", /Zufall in einzelnen Partien ist groß/.test(await text("#page-fortschritt")) && /10 oder mehr Partien/.test(await text("#page-fortschritt")) && /Computer spielt anders als Menschen/.test(await text("#page-fortschritt")));
  r.check("Keine Punkte, Abzeichen, Serien, Effekte im Text", !/Punkte|Abzeichen|Serie|Streak|Bestenliste|Konfetti|Level/i.test(await text("#page-fortschritt")));

  // --- Beispieldaten ---
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    let n = 0;
    const p = (o) => ({ id: "p" + ++n, datum: new Date(Date.UTC(2026, 10, 1, 10, n)).toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", grund: "Matt", zuege: 30, halbzuege: 60, pgn: "1. e4 e5", warnung: false, warnungen: 0, trotzdem: 0, ...o });
    const a = (id, patzer, phasen, arten) => ({ id, version: 1, farbe: "w", summe: { zuege: 30, patzer, fehler: 0, chancen: 0, verlustSumme: 30 * 80 }, zuegeUci: [], zuege: [], startFen: "", eintraege: [...Array(patzer)].map((_, i) => ({ art: "patzer", ursache: arten[i % arten.length], phase: phasen[i % phasen.length] })) });
    const partien = [
      // aktuelle Version, ohne Warnung: 8 Partien (Stufe 2: 5, Stufe 3: 3)
      p({ stufe: 2, ausgang: "verloren" }), p({ stufe: 2, ausgang: "verloren" }), p({ stufe: 2, ausgang: "gewonnen" }), p({ stufe: 2, ausgang: "remis" }), p({ stufe: 2, ausgang: "gewonnen" }),
      p({ stufe: 3, ausgang: "gewonnen" }), p({ stufe: 3, ausgang: "gewonnen" }), p({ stufe: 3, ausgang: "gewonnen" }),
      // mit Patzer-Warnung: 3 Partien
      p({ warnung: true, ausgang: "gewonnen" }), p({ warnung: true, ausgang: "verloren" }), p({ warnung: true, ausgang: "verloren" }),
      // frühere Stufenversion 0: 2 Partien
      p({ stufenversion: 0, ausgang: "gewonnen" }), p({ stufenversion: 0, ausgang: "verloren" }),
    ];
    const analysen = [
      a("p1", 3, ["eroeffnung", "mittelspiel", "endspiel"], ["figur", "drohung", "chance"]),
      a("p2", 2, ["mittelspiel"], ["figur"]),
      a("p3", 1, ["mittelspiel"], ["matt"]),
      a("p4", 0, [], []),
      a("p5", 2, ["endspiel"], ["figur"]),
      a("p6", 1, ["eroeffnung"], ["figur"]),
      a("p9", 4, ["mittelspiel"], ["figur"]), // gehört zur Gruppe mit Warnung
    ];
    const versuche = [
      ...[true, false, true, true, true, true, false].map((m, i) => ({ id: "g" + i, modus: "grundmatt", art: "dame", matt: m, mattIn: m ? 12 - i : null, stufenversion: 1, ausgang: m ? "gewonnen" : "remis", datum: new Date().toISOString() })),
      { id: "g9", modus: "grundmatt", art: "turm", matt: true, mattIn: 14, stufenversion: 1, ausgang: "gewonnen", datum: new Date().toISOString() },
      { id: "v1", modus: "vorteil", art: "dame", ausgang: "gewonnen", stufenversion: 1, datum: new Date().toISOString() },
      { id: "v2", modus: "vorteil", art: "dame", ausgang: "gewonnen", stufenversion: 1, datum: new Date().toISOString() },
      { id: "v3", modus: "vorteil", art: "turm", ausgang: "remis", stufenversion: 1, datum: new Date().toISOString() },
      { id: "v4", modus: "vorteil", art: "springer", ausgang: "verloren", stufenversion: 1, datum: new Date().toISOString() },
    ];
    store.update((d) => {
      d.spielen.partien = partien;
      d.spielen.analysen = analysen;
      d.spielen.versuche = versuche;
      d.taktik.themen.eigenerFehler = { n: 6, ok: 4, ms: 10000 };
      d.spielen.eigene = [1, 2, 3].map((i) => ({ id: "e" + i, datum: new Date().toISOString(), partieId: "p1", nr: i, art: "patzer" }));
    });
  });
  await page.reload();
  await page.waitForSelector("#page-fortschritt:not([hidden])");
  await oeffneAlle(page);
  r.check("Nur die 8 Partien ohne Warnung der aktuellen Version zählen", /Partien ohne Patzer-Warnung: 8 \(noch wenig Daten\)/.test(await text("#fs-anzahl")), await text("#fs-anzahl"));
  const stufen = (await text("#fs-stufen")).replace(/\s+/g, " ");
  r.check("Ergebnisse je Stufe (gewonnen, remis, verloren)", /Stufe 2 \(Anfänger\) \(5 Partien\)\s*2 gewonnen, 1 remis, 2 verloren/.test(stufen) && /Stufe 3 \(Anfänger\) \(3 Partien\)\s*3 gewonnen, 0 remis, 0 verloren/.test(stufen), stufen);
  r.check("Die Partien der früheren Stufenversion sind nicht eingerechnet, aber getrennt gezählt", !(await page.isHidden("#fs-aeltere")) && /Stufenversion 0\s*2 Partien, 0 Übungen: 1 gewonnen, 0 remis, 1 verloren/.test((await text("#fs-aeltere-zahlen")).replace(/\s+/g, " ")), (await text("#fs-aeltere-zahlen")).replace(/\s+/g, " "));
  r.check("Die aktuelle Stufenversion wird genannt", /Stufenversion \(1\)/.test(await text("#fs-version")));
  const emp = await text("#fs-empfehlung-text");
  r.check("Stufenempfehlung als ruhiger Satz (letzte 5 Partien auf der zuletzt gespielten Stufe 2: 2 gewonnen, 1 remis, 2 verloren -> bleiben)", /^Auf Stufe 2 hast du die letzten 5 Partien so gespielt: 2 gewonnen, 1 remis, 2 verloren\. Bleib bei Stufe 2\.$/.test(emp), emp);
  r.check("Rückblick-Zahlen: 6 analysierte Partien, Diagramm vorhanden", /Aus 6 Partien mit Rückblick/.test(await text("#fs-analyse-text")) && (await page.locator("#fs-diagramm svg polyline").count()) === 1);
  const zahlen = (await text("#fs-zahlen")).replace(/\s+/g, " ");
  // Patzer je Partie 3,2,1,0,2,1 -> Mittel der letzten 5 (2,1,0,2,1... Fenster ab Partie 5 und 6): (3+2+1+0+2)/5 = 1,6 und (2+1+0+2+1)/5 = 1,2
  r.check("Patzer pro Partie, Mittel der letzten 5: 1,2; Verlust pro Zug 0,8 Bauerneinheiten", /Patzer pro Partie \(Mittel der letzten 5\) 1,2/.test(zahlen) && /Durchschnittlicher Verlust pro Zug 0,8 Bauerneinheiten/.test(zahlen), zahlen);
  const phasen = (await text("#fs-phasen")).replace(/\s+/g, " ");
  r.check("Verteilung der Patzer: Eröffnung 2, Mittelspiel 4, Endspiel 3 (von 9)", /Eröffnung \(Zug 1 bis 10\) 2 \(22 %\)/.test(phasen) && /Mittelspiel 4 \(44 %\)/.test(phasen) && /Endspiel \(wenige Figuren\) 3 \(33 %\)/.test(phasen), phasen);
  const arten = (await text("#fs-arten")).replace(/\s+/g, " ");
  r.check("Verteilung der Fehlerarten: Figur eingestellt 6, Drohung übersehen 2, Chance verpasst 1", /Figur eingestellt 6/.test(arten) && /Drohung übersehen 2/.test(arten) && /Chance verpasst 1/.test(arten), arten);
  const eigene = (await text("#fs-eigene-zahlen")).replace(/\s+/g, " ");
  r.check("Eigene Rätsel: Anzahl 3 und Lösungsquote 67 % (4 von 6)", /Gespeicherte eigene Rätsel 3/.test(eigene) && /67 % \(4 von 6\)/.test(eigene), eigene);
  const gm = (await text("#fs-grundmatt-zahlen")).replace(/\s+/g, " ");
  r.check("Grundmatts: Mittel der letzten 5 Versuche und Quote der erfolgreichen", /König und Dame gegen König, letzte 5 Versuche\s*4 Matt, im Mittel 8,5 Züge bis zum Matt/.test(gm) && /Dame: alle Versuche 5 von 7 erfolgreich \(71 %\)/.test(gm) && /Referenz höchstens 10 Züge/.test(gm), gm);
  const vt = (await text("#fs-vorteil-zahlen")).replace(/\s+/g, " ");
  r.check("Vorteil verwerten: Quote gewonnen 50 % (2 gewonnen, 1 remis, 1 verloren)", /Quote gewonnen 50 % \(2 gewonnen, 1 remis, 1 verloren\)/.test(vt), vt);

  // --- Gruppe mit Warnung ---
  await page.selectOption("#fs-gruppe", "mit");
  await page.waitForTimeout(200);
  r.check("Partien mit Patzer-Warnung werden getrennt gezählt (3 Partien: zu wenig Daten)", /Partien mit Patzer-Warnung: 3 \(zu wenig Daten\)/.test(await text("#fs-anzahl")) && /zu wenig Daten/.test(await text("#fs-stufen")) && (await page.isHidden("#fs-analyse-inhalt")));
  await page.selectOption("#fs-gruppe", "ohne");

  // --- Layout ---
  const tap = await page.locator("#page-fortschritt select").evaluateAll((els) => els.map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]));
  r.check("Auswahl mindestens 44 px hoch", tap.every(([, h, w]) => h >= 44 && w >= 44), JSON.stringify(tap));
  r.check("Seite läuft bei 390 px nicht über", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));

  // --- alte Version: Stand mit Version 0 nur, aktuelle leer ---
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.spielen.partien = [1, 2, 3, 4, 5, 6].map((i) => ({ id: "alt" + i, datum: new Date().toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 0, ausgang: "gewonnen", grund: "Matt", warnung: false, pgn: "" }));
    });
  });
  await page.reload();
  await page.waitForTimeout(400);
  await oeffneAlle(page);
  r.check("Nur Partien einer früheren Version: die aktuelle Auswertung bleibt leer, die frühere steht getrennt da", /Partien ohne Patzer-Warnung: 0 \(zu wenig Daten\)/.test(await text("#fs-anzahl")) && /6 Partien/.test(await text("#fs-aeltere-zahlen")));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
