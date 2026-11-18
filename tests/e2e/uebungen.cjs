// Grundmatts üben und Vorteil verwerten: Stellungen, Ablauf, Zählung, getrennte Statistik. Echte Engine.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

const spielen = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get().spielen)));
async function until(page, fn, arg, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(120);
  }
  throw new Error("Zeitüberschreitung: " + fn.toString().slice(0, 100));
}

// Lässt die Engine für den Spieler ziehen, bis die Partie zu Ende ist (nur für Tests).
async function spieleBisEnde(page, farbe = "white", maxZuege = 40) {
  for (let i = 0; i < maxZuege; i++) {
    const zustand = await until(page, () => !!document.querySelector("#sp-ende:not([hidden])") || /Du bist am Zug/.test(document.getElementById("sp-lauf-status").textContent)).then(() => page.evaluate(() => !!document.querySelector("#sp-ende:not([hidden])")));
    if (zustand) return true;
    const best = await page.evaluate(async () => {
      const { store } = await import("./js/storage.js");
      const { getEngine } = await import("./js/engine.js");
      const a = store.get().spielen.aktiv;
      const e = getEngine();
      await e.setOptions({ UCI_LimitStrength: false, "Skill Level": 20 });
      return (await e.search({ fen: a.startFen, moves: a.zuege, movetime: 400 })).best;
    });
    await tapMove(page, best.slice(0, 2), best.slice(2, 4), farbe, "#sp-board");
    await page.waitForTimeout(150);
  }
  return false;
}

async function seedUebung(page, o) {
  await page.goto(page.__url + "index.html#/spielen");
  await page.evaluate(async (o) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive } = await import("./js/partie.js");
    store.update((d) => {
      d.spielen.aktiv = neueAktive(o);
    });
  }, o);
  await page.goto(page.__url + "index.html#/spielen/lauf");
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
}

(async () => {
  const r = reporter("Grundmatts und Vorteil");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  page.__url = url;

  // --- Grundmatts: Stellungen gültig (auch im Browser), Seite ---
  await page.goto(url + "index.html#/spielen/grundmatt");
  await page.waitForSelector("#sp-grundmatt:not([hidden])");
  r.check("Auswahl: zwei Figuren, 10 Stellungen plus 'Nächste Stellung'", (await page.locator("#gm-art option").count()) === 2 && (await page.locator("#gm-stellung option").count()) === 11);
  r.check("Referenz sichtbar: Dame 10 Züge, Turm 16 Züge", /höchstens 10 Zügen/.test(await page.textContent("#gm-info")) && /höchstens 10 Züge/.test(await page.textContent("#sp-grundmatt")) && /16 Züge/.test(await page.textContent("#sp-grundmatt")));
  const gueltig = await page.evaluate(async () => {
    const { GRUNDMATT, pruefeStellung } = await import("./js/uebungen.js");
    const { Chess } = await import("./vendor/chess.js/chess.js");
    const out = [];
    for (const [art, d] of Object.entries(GRUNDMATT)) for (const fen of d.stellungen) {
      const p = pruefeStellung(fen);
      const c = new Chess(fen);
      out.push(p.weissAmZug && !p.schwarzImSchach && !p.zuEnde && c.moves().length > 0);
    }
    return out;
  });
  r.check("Alle 20 Grundmatt-Stellungen sind gültig (chess.js)", gueltig.length === 20 && gueltig.every(Boolean));

  // --- Grundmatt Dame: bis zum Matt spielen ---
  await page.selectOption("#gm-art", "dame");
  await page.selectOption("#gm-stellung", "3");
  await page.click("#gm-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  r.check("Grundmatt: ich spiele Weiß, Referenz in der Kopfzeile, kein Zurücknehmen", /Du bist am Zug \(Weiß\)/.test(await page.textContent("#sp-lauf-status")) && /Referenz: 10/.test(await page.textContent("#sp-lauf-stufe")) && (await page.locator("#sp-btn-zurueck").isHidden()));
  const fertig = await spieleBisEnde(page);
  r.check("Grundmatt (Dame): Matt gesetzt", fertig && /Matt gesetzt/.test(await page.textContent("#sp-ende-text")), await page.textContent("#sp-ende-text"));
  let sp = await spielen(page);
  let v = sp.versuche[sp.versuche.length - 1];
  r.check("Versuch gespeichert: Zahl der Züge bis zum Matt, Art, Stellung, Stufe 8", v.modus === "grundmatt" && v.matt === true && v.mattIn >= 1 && v.mattIn <= 10 && v.art === "dame" && v.stellungNr === 3 && v.stufe === 8, JSON.stringify({ m: v.matt, n: v.mattIn }));
  r.check("Grundmatt zählt nicht bei den normalen Partien", sp.partien.length === 0 && sp.aktiv === null);
  r.check("Endseite zeigt die Referenz ruhig", /höchstens 10 Züge bis zum Matt/.test(await page.textContent("#sp-ende-fakten")));
  r.check("Folgeknopf führt zur nächsten Übung", (await page.getAttribute("#sp-ende-neu", "href")) === "#/spielen/grundmatt");

  // Nächste Stellung wählt die am wenigsten geübte
  await page.click("#sp-ende-neu");
  await page.waitForSelector("#sp-grundmatt:not([hidden])");
  r.check("'Nächste Stellung' wählt eine noch nicht geübte (Nr. 1)", /Nr\. 1\)/.test(await page.textContent("#gm-stellung option")), await page.textContent("#gm-stellung option"));

  // --- Grundmatt Turm: Misserfolge zählen ---
  await page.selectOption("#gm-art", "turm");
  await page.selectOption("#gm-stellung", "0");
  await page.click("#gm-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await page.click("#sp-btn-aufgeben");
  r.check("Aufgeben im Grundmatt erklärt den Misserfolg", /Misserfolg/.test(await page.textContent("#sp-aufgeben-text")));
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("Aufgegeben: Misserfolg gespeichert (kein Matt)", v.matt === false && v.mattIn === null && v.grund === "Aufgabe" && v.art === "turm");

  await seedUebung(page, { modus: "grundmatt", farbe: "w", stufe: 8, startFen: "7k/8/5K2/8/8/8/6Q1/8 w - - 0 1", extra: { art: "dame", stellungNr: 99 } });
  await tapMove(page, "g2", "g6", "white", "#sp-board");
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 8000 });
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("Patt ist ein Misserfolg", v.matt === false && v.grund === "Patt" && /Kein Matt/.test(await page.textContent("#sp-ende-text")));

  await seedUebung(page, { modus: "grundmatt", farbe: "w", stufe: 8, startFen: "4k3/8/8/8/8/8/8/R3K3 w - - 99 80", extra: { art: "turm", stellungNr: 98 } });
  await tapMove(page, "a1", "a2", "white", "#sp-board");
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 8000 });
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("50-Züge-Regel ist ein Misserfolg", v.matt === false && v.grund === "50-Züge-Regel");

  // Dreifache Wiederholung: Stellung ist nach der Zugliste zum dritten Mal erreicht
  await seedUebung(page, { modus: "grundmatt", farbe: "w", stufe: 8, startFen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", extra: { art: "turm", stellungNr: 97 } });
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.spielen.aktiv.zuege = ["a1a2", "e8d8", "a2a1", "d8e8", "a1a2", "e8d8", "a2a1"];
    });
  });
  await page.reload();
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await until(page, () => /Du bist am Zug|Computer/.test(document.getElementById("sp-lauf-status").textContent) || !!document.querySelector("#sp-ende:not([hidden])"));
  // der Computer zieht d8e8 und stellt die Stellung zum dritten Mal her
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 15000 });
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("Dreifache Wiederholung ist ein Misserfolg", v.matt === false && v.grund === "Dreifache Wiederholung");

  // --- Vorteil verwerten ---
  await page.goto(url + "index.html#/spielen/vorteil");
  await page.waitForSelector("#sp-setup:not([hidden])");
  r.check("Vorteil: Einstellungen mit Art, Farbe, Stufe", (await page.isVisible("#sp-art")) && (await page.locator("#sp-art option").count()) === 3 && (await page.isVisible("#sp-stufe")) && /Eigene Statistik|getrennt/.test(await page.textContent("#sp-setup-text")));
  const partienVorher = (await spielen(page)).partien.length;
  await page.selectOption("#sp-art", "dame");
  await page.selectOption("#sp-farbe", "w");
  await page.selectOption("#sp-stufe", "1");
  await page.click("#sp-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  let a = (await spielen(page)).aktiv;
  r.check("Startstellung: Computer ohne Dame, Weiß ist komplett", a.startFen === "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" && a.modus === "vorteil" && a.art === "dame");
  r.check("Auf dem Brett fehlt die schwarze Dame", (await page.locator("#sp-board piece.queen.black").count()) === 0 && (await page.locator("#sp-board piece.queen.white").count()) === 1);
  await tapMove(page, "e2", "e4", "white", "#sp-board");
  await until(page, async () => ((await import("./js/storage.js")).store.get().spielen.aktiv?.zuege.length || 0) >= 2);
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("Vorteil-Versuch getrennt gespeichert (Versuche, nicht Partien) mit Art, Ergebnis, Stufenversion, Warnung", v.modus === "vorteil" && v.art === "dame" && v.ausgang === "verloren" && v.stufenversion === 1 && v.warnung === true && sp.partien.length === partienVorher);
  r.check("Endseite nennt den Vorteil nicht als normale Partie", /Partie beendet|Übung beendet/.test(await page.textContent("#sp-ende-titel")) && (await page.getAttribute("#sp-ende-neu", "href")) === "#/spielen/vorteil");

  // Vorteil als Schwarz, ohne Turm: Computer (Weiß) beginnt
  await page.goto(url + "index.html#/spielen/vorteil");
  await page.waitForSelector("#sp-setup:not([hidden])");
  await page.selectOption("#sp-art", "turm");
  await page.selectOption("#sp-farbe", "b");
  await page.selectOption("#sp-stufe", "1");
  await page.click("#sp-btn-start");
  await page.waitForSelector("#sp-lauf:not([hidden])");
  await until(page, async () => ((await import("./js/storage.js")).store.get().spielen.aktiv?.zuege.length || 0) >= 1);
  a = (await spielen(page)).aktiv;
  r.check("Vorteil als Schwarz (ohne Turm): Stellung gültig, Computer beginnt", a.farbe === "b" && a.startFen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1" && a.zuege.length === 1);
  await page.click("#sp-btn-aufgeben");
  await page.click("#sp-btn-aufgeben-ja");
  await page.waitForSelector("#sp-ende:not([hidden])");

  // Vorteil gewonnen: Der Computer wird matt gesetzt (Grundreihenmatt)
  await seedUebung(page, { modus: "vorteil", farbe: "w", stufe: 1, startFen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", zuege: [], extra: { art: "dame" }, warnung: false });
  await tapMove(page, "a1", "a8", "white", "#sp-board");
  await page.waitForSelector("#sp-ende:not([hidden])", { timeout: 8000 });
  sp = await spielen(page);
  v = sp.versuche[sp.versuche.length - 1];
  r.check("Vorteil gewonnen: als Versuch mit Ausgang gewonnen gespeichert, nicht bei den Partien", v.modus === "vorteil" && v.ausgang === "gewonnen" && v.grund === "Matt" && sp.partien.length === partienVorher);

  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
