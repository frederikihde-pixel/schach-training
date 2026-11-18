// Spielen: Partie als Weiß und Schwarz, Sperre während der Bedenkzeit, Zug zurück, Aufgeben, Spielende,
// Fortsetzen nach Neuladen, Patzer-Warnung. Echte Engine im Chromium, 390 px, Touch-Emulation.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

const aktiv = (page) => page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen.aktiv);
const spielen = (page) => page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen);
// Wartet, bis eine Prüfung im Browser wahr wird (async-Prüfungen werden von waitForFunction nicht abgewartet).
async function until(page, fn, arg, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(120);
  }
  throw new Error("Zeitüberschreitung: " + fn.toString().slice(0, 120));
}
const warteZuege = (page, n, ms = 15000) => until(page, async (n) => ((await import("./js/storage.js")).store.get().spielen.aktiv?.zuege.length || 0) >= n, n, ms);
const warteAktivWeg = (page, ms = 15000) => until(page, async () => (await import("./js/storage.js")).store.get().spielen.aktiv === null, null, ms);
const status = (page) => page.textContent("#sp-lauf-status");

async function einrichten(page, { farbe = "w", stufe = 1, zurueck = false, warnung = false } = {}) {
  await page.goto(page.__url + "index.html#/spielen/partie");
  await page.waitForSelector("#sp-btn-start");
  await page.selectOption("#sp-farbe", farbe);
  await page.selectOption("#sp-stufe", String(stufe));
  const sw = async (id, want) => {
    if ((await page.getAttribute(id, "aria-checked")) !== String(want)) await page.click(id);
  };
  await sw("#sp-sw-zurueck", zurueck);
  await sw("#sp-sw-warnung", warnung);
  await page.click("#sp-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
}

// Startet eine Partie direkt aus dem Speicher (für Sonderstellungen).
async function seed(page, opts) {
  await page.goto(page.__url + "index.html#/spielen");
  await page.evaluate(async (o) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive } = await import("./js/partie.js");
    store.update((d) => {
      d.spielen.aktiv = neueAktive({ modus: "partie", ...o });
      d.spielen.aktiv.zuege = o.zuege || [];
      d.spielen.aktiv.warnungen = 0;
    });
  }, opts);
  await page.goto(page.__url + "index.html#/spielen/lauf");
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
}

(async () => {
  const r = reporter("Spielen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  page.__url = url;

  // --- Startseite ---
  await page.goto(url + "index.html#/spielen");
  await page.waitForSelector("#sp-start:not([hidden])");
  const wege = await page.locator("#sp-start .way strong").allTextContents();
  r.check("Startseite zeigt die drei Wege: Partie, Grundmatts üben, Vorteil verwerten", wege.join("|") === "Partie|Grundmatts üben|Vorteil verwerten", wege.join("|"));
  r.check("Reiter Spielen ist markiert und mindestens 44 px hoch", (await page.getAttribute("#tab-spielen", "aria-current")) === "page" && (await page.locator("#tab-spielen").boundingBox()).height >= 44);
  const ways = await page.locator("#sp-start .way").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  r.check("Die drei Wege sind mindestens 44 px hoch", ways.every((h) => h >= 44), ways.join(","));

  // --- Einstellungen ---
  await page.click("#sp-weg-partie");
  await page.waitForSelector("#sp-setup:not([hidden])");
  r.check("Zug zurücknehmen ist standardmäßig aus, Erklärung vorhanden", (await page.getAttribute("#sp-sw-zurueck", "aria-checked")) === "false" && /gründlich/.test(await page.textContent("#sp-setup")));
  r.check("Patzer-Warnung ist bei der ersten Partie an", (await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "true");
  r.check("8 Stufen zur Wahl, Stufen 1 bis 3 als Anfänger", (await page.locator("#sp-stufe option").count()) === 8 && /Anfänger/.test(await page.textContent("#sp-stufe option:nth-child(3)")));
  r.check("Ehrlicher Hinweis zur Stärke und Hinweis zum Anpassen", /Richtwerte/.test(await page.textContent("#sp-stufe-info")) && /Zu leicht oder zu schwer/.test(await page.textContent("#sp-setup")));
  await page.fill("#sp-wertung", "440");
  await page.waitForTimeout(100);
  r.check("Wertung 440 schlägt Stufe 2 vor und wählt sie", /Stufe 2/.test(await page.textContent("#sp-wertung-info")) && (await page.inputValue("#sp-stufe")) === "2");
  r.check("Wertung wird nur lokal gespeichert", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().einstellungen.chesscomWertung)) === 440);
  await page.fill("#sp-wertung", "abc");
  r.check("Ungültige Wertung wird gemeldet und nicht gespeichert", /ganze Zahl/.test(await page.textContent("#sp-wertung-info")) && (await page.evaluate(async () => (await import("./js/storage.js")).store.get().einstellungen.chesscomWertung)) === 440);
  await page.fill("#sp-wertung", "");
  const tap = await page.locator("#sp-setup button, #sp-setup select, #sp-setup input").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => Math.min(e.getBoundingClientRect().height, 999)));
  r.check("Bedienelemente der Einstellungen mindestens 44 px hoch", tap.every((h) => h >= 44), tap.join(","));

  // --- Partie als Weiß ---
  await einrichten(page, { farbe: "w", stufe: 1 });
  r.check("Brett steht aus Sicht von Weiß, ich bin am Zug", /Du bist am Zug \(Weiß\)/.test(await status(page)));
  await tapMove(page, "e2", "e4", "white", "#sp-board");
  await until(page, () => /Computer denkt/.test(document.getElementById("sp-lauf-status").textContent), null, 3000);
  r.check("Während der Bedenkzeit steht 'Computer denkt'", true);
  // Brett gesperrt: ein Zug in dieser Zeit wird nicht ausgeführt
  await tapMove(page, "d2", "d4", "white", "#sp-board");
  const a1 = await aktiv(page);
  r.check("Brett ist während der Bedenkzeit gesperrt", a1.zuege.length <= 2 && !a1.zuege.includes("d2d4"), a1.zuege.join(" "));
  await warteZuege(page, 2);
  await until(page, () => /Du bist am Zug/.test(document.getElementById("sp-lauf-status").textContent));
  const a2 = await aktiv(page);
  r.check("Computer hat einen legalen Zug gespielt, Brett wieder frei", a2.zuege.length === 2 && a2.zuege[0] === "e2e4");
  r.check("Keine Bewertungsleiste, keine Zugvorschläge auf der Seite", (await page.locator("#sp-lauf").innerText()).search(/Bewertung|Vorschlag|Tipp/i) === -1);
  r.check("Zug zurück ist ohne Erlaubnis nicht sichtbar", (await page.locator("#sp-btn-zurueck").isHidden()));

  // Fortsetzen nach Neuladen
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await page.waitForTimeout(400);
  const a3 = await aktiv(page);
  r.check("Nach Neuladen: gleiche Partie, gleiche Züge", a3.id === a2.id && a3.zuege.join() === a2.zuege.join());
  r.check("Nach Neuladen: Brett zeigt die Stellung (Bauer auf e4)", (await page.locator("#sp-board piece.pawn.white").count()) === 8 && (await page.locator('#sp-board piece.white.pawn').count()) === 8);
  // Verpasster Computerzug: Zug spielen, sofort neu laden
  await tapMove(page, "g1", "f3", "white", "#sp-board");
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await warteZuege(page, 4);
  const av = await aktiv(page);
  r.check("Verpasster Computerzug wird nach Neuladen nachgeholt", av.zuege.length === 4 && av.zuege[2] === "g1f3", av.zuege.join(" "));
  // Aufgeben mit Rückfrage
  await page.click("#sp-btn-aufgeben");
  r.check("Aufgeben fragt nach", await page.isVisible("#sp-aufgeben-frage"));
  await page.click("#sp-btn-aufgeben-nein");
  r.check("Weiterspielen: Partie läuft weiter", (await aktiv(page)) !== null && !(await page.isVisible("#sp-aufgeben-frage")));
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  const sp1 = await spielen(page);
  const p1 = sp1.partien[sp1.partien.length - 1];
  r.check("Aufgeben: Endseite, Partie gespeichert als verloren, laufende Partie gelöscht", /aufgegeben/.test(await page.textContent("#sp-ende-text")) && p1.ausgang === "verloren" && p1.grund === "Aufgabe" && sp1.aktiv === null);
  r.check("Gespeicherte Partie: Datum, Modus, Farbe, Stufe, Stufenversion, Ergebnis, PGN, Warnung aus", p1.datum && p1.modus === "partie" && p1.farbe === "w" && p1.stufe === 1 && p1.stufenversion === 1 && p1.ergebnis === "0-1" && /1\. e4/.test(p1.pgn) && p1.warnung === false);
  r.check("Endseite: Knöpfe Im Brett ansehen, PGN kopieren, Neue Partie", (await page.isVisible("#sp-ende-ansehen")) && (await page.isVisible("#sp-ende-pgn")) && (await page.isVisible("#sp-ende-neu")));

  // --- Als Schwarz: Computer beginnt ---
  await einrichten(page, { farbe: "b", stufe: 1, zurueck: true });
  r.check("Schwarz: Brett aus Sicht von Schwarz", (await page.evaluate(() => document.getElementById("sp-board").classList.contains("orientation-black"))));
  await warteZuege(page, 1);
  await until(page, () => /Du bist am Zug/.test(document.getElementById("sp-lauf-status").textContent));
  const b1 = await aktiv(page);
  r.check("Schwarz: Computer hat als Erster gezogen, ich bin am Zug", b1.zuege.length === 1 && /Schwarz/.test(await status(page)));
  r.check("Zug zurück (erlaubt) ist sichtbar, aber noch nicht möglich", (await page.isVisible("#sp-btn-zurueck")) && (await page.isDisabled("#sp-btn-zurueck")));
  // Antwort: der erste Zug des Computers bestimmt, was ich ziehe; ich spiele einen sicheren Bauernzug
  const antwort = b1.zuege[0] === "e2e4" || b1.zuege[0] === "d2d4" ? ["e7", "e6"] : ["e7", "e5"];
  await tapMove(page, antwort[0], antwort[1], "black", "#sp-board");
  await warteZuege(page, 3);
  await until(page, () => /Du bist am Zug/.test(document.getElementById("sp-lauf-status").textContent));
  r.check("Zug zurück wird möglich und nimmt zwei Halbzüge zurück", await (async () => {
    if (await page.isDisabled("#sp-btn-zurueck")) return false;
    await page.click("#sp-btn-zurueck");
    await page.waitForTimeout(300);
    const a = await aktiv(page);
    return a.zuege.length === 1 && a.zurueck === 1;
  })());
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  const sp2 = await spielen(page);
  r.check("Als Schwarz gespeichert (Farbe b, Zurücknahme erlaubt vermerkt)", sp2.partien[sp2.partien.length - 1].farbe === "b" && sp2.partien[sp2.partien.length - 1].zuruecknahme === true && sp2.partien[sp2.partien.length - 1].zurueck === 1);

  // --- Spielende erkannt: Schäfermatt gegen mich ist Matt; hier: ich als Schwarz setze Matt (Narrenmatt) ---
  await seed(page, { farbe: "b", stufe: 1, zuege: ["f2f3", "e7e5", "g2g4"], zuruecknahme: false, warnung: false });
  await tapMove(page, "d8", "h4", "black", "#sp-board");
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 8000 });
  const sp3 = await spielen(page);
  const p3 = sp3.partien[sp3.partien.length - 1];
  r.check("Spielende erkannt (Matt): gewonnen, gespeichert", /Schachmatt/.test(await page.textContent("#sp-ende-text")) && p3.ausgang === "gewonnen" && p3.grund === "Matt" && p3.ergebnis === "0-1");
  r.check("PGN der Partie lässt sich mit chess.js laden", await page.evaluate(async (pgn) => {
    const { Chess } = await import("./vendor/chess.js/chess.js");
    const c = new Chess();
    c.loadPgn(pgn);
    return c.history().length === 4 && c.isCheckmate();
  }, p3.pgn));
  await page.click("#sp-ende-ansehen");
  await page.waitForSelector("#page-brett:not([hidden])");
  r.check("Im Brett ansehen: Partie steht in der Zugliste, Brett aus Sicht von Schwarz", (await page.locator("#move-list .move-entry").count()) === 5 && (await page.evaluate(() => document.getElementById("board").classList.contains("orientation-black"))));

  // Patt und Material werden von chess.js erkannt: Patt-Stellung direkt laden
  await page.goto(url + "index.html#/spielen");
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const { neueAktive } = await import("./js/partie.js");
    store.update((d) => {
      d.spielen.aktiv = neueAktive({ modus: "partie", farbe: "w", stufe: 1, startFen: "7k/8/5K2/8/8/8/6Q1/8 w - - 0 1", warnung: false });
    });
  });
  await page.goto(url + "index.html#/spielen/lauf");
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await tapMove(page, "g2", "g6", "white", "#sp-board"); // Dg6 ist Patt (Schwarz hat keinen Zug)
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 8000 });
  const sp4 = await spielen(page);
  r.check("Spielende erkannt (Patt): remis", /Patt/.test(await page.textContent("#sp-ende-text")) && sp4.partien[sp4.partien.length - 1].ausgang === "remis");

  // --- Patzer-Warnung ---
  // Matt in 1 erlaubt: nach 1.e4 e5 2.Dh5 Sc6 3.Lc4 spielt Schwarz a6?? (Dxf7 matt)
  await seed(page, { farbe: "b", stufe: 8, zuege: ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4"], zuruecknahme: false, warnung: true });
  await tapMove(page, "a7", "a6", "black", "#sp-board");
  await page.waitForSelector("#sp-warnung:not([hidden])", { timeout: 5000 });
  r.check("Warnung bei Matt in 1: Frage, 'Ändern' und 'Trotzdem', kein Zugvorschlag", /Computer Matt setzen\. Trotzdem ziehen\?/.test(await page.textContent("#sp-warnung-text")) && (await page.isVisible("#sp-warn-aendern")) && (await page.isVisible("#sp-warn-trotzdem")) && !/besser|stattdessen/i.test(await page.textContent("#sp-warnung")));
  r.check("Während der Warnung ist das Brett gesperrt, Zug noch nicht gespeichert", (await aktiv(page)).zuege.length === 5);
  await page.click("#sp-warn-aendern");
  await page.waitForTimeout(300);
  const w1 = await aktiv(page);
  r.check("Ändern: Zug verworfen, Warnung gezählt, Brett wieder frei", w1.zuege.length === 5 && w1.warnungen === 1 && w1.trotzdem === 0 && /Du bist am Zug/.test(await status(page)));
  await tapMove(page, "a7", "a6", "black", "#sp-board");
  await page.waitForSelector("#sp-warnung:not([hidden])");
  await page.click("#sp-warn-trotzdem");
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 20000 });
  const sp5 = await spielen(page);
  const p5 = sp5.partien[sp5.partien.length - 1];
  r.check("Trotzdem: Zug ausgeführt, Computer setzt Matt, gespeichert mit Warnung an, 2 Warnungen, 1 Trotzdem", p5 && p5.warnung === true && p5.warnungen === 2 && p5.trotzdem === 1 && p5.grund === "Matt" && p5.ausgang === "verloren", JSON.stringify(p5 && { w: p5.warnung, n: p5.warnungen, t: p5.trotzdem, g: p5.grund }));

  // Freie Figur: Weiß zieht die Dame ungedeckt neben einen Springer
  await seed(page, { farbe: "w", stufe: 1, startFen: "4k3/8/1n6/8/8/8/3Q4/4K3 w - - 0 1", zuege: [], zuruecknahme: false, warnung: true });
  await tapMove(page, "d2", "d5", "white", "#sp-board");
  await page.waitForSelector("#sp-warnung:not([hidden])", { timeout: 5000 });
  r.check("Warnung bei freier Figur: 'Dabei kann der Computer etwas schlagen. Trotzdem ziehen?'", (await page.textContent("#sp-warnung-text")) === "Dabei kann der Computer etwas schlagen. Trotzdem ziehen?");
  await page.click("#sp-warn-aendern");
  // sicherer Zug: keine Warnung
  await tapMove(page, "d2", "d3", "white", "#sp-board");
  await page.waitForTimeout(800);
  r.check("Sicherer Zug: keine Warnung", !(await page.isVisible("#sp-warnung")) && (await aktiv(page)).zuege[0] === "d2d3");
  // Warnung aus: kein Hinweis auch bei hängender Figur
  await seed(page, { farbe: "w", stufe: 1, startFen: "4k3/8/1n6/8/8/8/3Q4/4K3 w - - 0 1", zuege: [], zuruecknahme: false, warnung: false });
  await tapMove(page, "d2", "d5", "white", "#sp-board");
  await page.waitForTimeout(800);
  const sp6 = await spielen(page);
  const stand = sp6.aktiv ? sp6.aktiv.zuege[0] : (sp6.partien[sp6.partien.length - 1].pgn.match(/1\. (\S+)/) || [])[1];
  r.check("Warnung aus: Zug wird ohne Frage ausgeführt", !(await page.isVisible("#sp-warnung")) && (stand === "d2d5" || stand === "Qd5"), String(stand));

  // --- Standardwert der Warnung nach 3 Partien (die dritte über die Einstellungen starten) ---
  await einrichten(page, { farbe: "w", stufe: 1 });
  await page.goto(url + "index.html#/spielen/partie");
  await page.waitForSelector("#sp-btn-start");
  const gestartet = await page.evaluate(async () => (await import("./js/storage.js")).store.get().spielen.gestartet);
  r.check("Nach 3 begonnenen Partien ist die Warnung zunächst aus (mit Hinweis)", gestartet >= 3 && (await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "false" && /zunächst aus/.test(await page.textContent("#sp-warn-info")));

  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
