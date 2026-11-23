// Startseite Heute: jeder Fall (a bis f und Fortsetzen) mit Knopf, Begründung, Nebenzeilen und dem, was der Knopf startet.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

const HEUTE = Date.now();
const iso = (tageZurueck) => new Date(HEUTE - tageZurueck * 86400000).toISOString();

async function setze(page, js) {
  await page.evaluate(async (code) => {
    const { store } = await import("./js/storage.js");
    const { dayKey, addDays } = await import("./js/leitner.js");
    const heute = dayKey(new Date());
    const karte = (id, faellig, eigen = false) => ({ stufe: 1, faellig, raetsel: { id, eigen, themen: eigen ? ["eigenerFehler"] : ["fork"], fen: "x", zuege: "a b", rating: 800 } });
    const partie = (id, tage) => ({ id, datum: new Date(Date.now() - tage * 86400000).toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", grund: "Aufgabe", zuege: 3, pgn: "1. e4 e5", warnung: false });
    store.reset();
    store.update((d) => {
      new Function("d", "karte", "partie", "heute", "addDays", code)(d, karte, partie, heute, addDays);
    });
  }, js);
}
const seite = async (page) => {
  await page.goto(page.__url + "index.html#/taktik");
  await page.goto(page.__url + "index.html#/heute");
  await page.waitForTimeout(300);
  return page.evaluate(() => ({ knopf: document.getElementById("heute-haupt").textContent.trim(), text: document.getElementById("heute-text").textContent.trim(), fall: document.getElementById("heute-haupt").dataset.fall, neben: [...document.querySelectorAll("#heute-neben .neben")].map((b) => b.textContent.trim()) }));
};
const EINGESTUFT = "d.taktik.eingestuft = true; d.taktik.staerke = 600; d.taktik.anzahl = 30;";
const RUHIG = EINGESTUFT + " d.spielen.partien.push(partie('p1', 1)); d.spielen.analysen.push({ id: 'p1', version: 1, summe: {} });";

(async () => {
  const r = reporter("Heute");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  page.__url = url;
  await page.goto(url + "index.html");
  await page.waitForTimeout(500);

  // Aussehen
  await setze(page, "");
  let s = await seite(page);
  r.check("Genau ein gefüllter Hauptknopf, mindestens 60 px hoch", (await page.locator("#page-heute .btn-haupt").count()) === 1 && (await page.locator("#heute-haupt").boundingBox()).height >= 60);
  r.check("Der Seitenname 'Heute' steht nur in der Kopfzeile (keine zweite Überschrift)", (await page.textContent("#app-titel")) === "Heute" && (await page.locator("#page-heute h2, #page-heute h3").count()) === 0);

  // Fall a
  s = await seite(page);
  r.check("a: noch keine Einstufung -> 'Einstufung starten', keine Nebenzeilen", s.fall === "a" && s.knopf === "Einstufung starten" && s.neben.length === 0, JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  r.check("a: ein Tipp startet die Einstufung", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv.typ)) === "einstufung");
  // Fortsetzen
  s = await seite(page);
  r.check("0: läuft die Einstufung, heißt der Knopf 'Sitzung fortsetzen'", s.fall === "fortsetzen" && s.knopf === "Sitzung fortsetzen", JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  r.check("0: der Knopf setzt die Einstufung fort (Rätsel läuft, nichts Neues)", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv.typ)) === "einstufung" && /Rätsel \d+ von 10/.test(await page.textContent("#lauf-fortschritt")));
  await setze(page, "");

  // Fall b
  await setze(page, EINGESTUFT + " d.taktik.karten.a = karte('a', addDays(heute, -1)); d.taktik.karten.b = karte('b', heute); d.taktik.karten.e1 = karte('e1', heute, true); d.taktik.karten.z = karte('z', addDays(heute, 2)); d.spielen.partien.push(partie('p1', 1)); d.spielen.analysen.push({ id: 'p1', version: 1, summe: {} });");
  s = await seite(page);
  r.check("b: 'Sitzung starten (3 fällig)' mit Begründung, eigene Fehler genannt", s.fall === "b" && s.knopf === "Sitzung starten (3 fällig)" && s.text === "3 Wiederholungen sind fällig, 1 davon aus eigenen Fehlern.", JSON.stringify(s));
  r.check("b: Nebenzeile 'Partie spielen' (keine doppelte Sitzung)", s.neben.join() === "Partie spielen", s.neben.join());
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  const sitz = await page.evaluate(async () => { const a = (await import("./js/storage.js")).store.get().taktik.aktiv; return { typ: a.typ, n: a.plan.length }; });
  r.check("b: ein Tipp startet die Sitzung", sitz.typ === "sitzung" && sitz.n >= 1, JSON.stringify(sitz));
  await setze(page, "");

  // Fall c
  await setze(page, EINGESTUFT + " d.spielen.partien.push(partie('p2', 1), partie('p3', 0));");
  s = await seite(page);
  r.check("c: offener Rückblick -> 'Rückblick ansehen'", s.fall === "c" && s.knopf === "Rückblick ansehen" && /2 Partien warten/.test(s.text), JSON.stringify(s));
  r.check("c: Nebenzeilen 'Rückblick offen' fehlt (ist der Hauptknopf), 'Sitzung starten' ist da", !s.neben.some((n) => /Rückblick/.test(n)) && s.neben.includes("Sitzung starten"), s.neben.join());
  await page.click("#heute-haupt");
  await page.waitForTimeout(300);
  r.check("c: der Knopf öffnet den neuesten offenen Rückblick", (await page.evaluate(() => location.hash)) === "#/spielen/rueckblick/p3");

  // Fall d
  await setze(page, EINGESTUFT + " d.spielen.partien.push(partie('p1', 5)); d.spielen.analysen.push({ id: 'p1', version: 1, summe: {} });");
  s = await seite(page);
  r.check("d: letzte Partie vor 5 Tagen -> 'Partie spielen' mit Begründung", s.fall === "d" && s.knopf === "Partie spielen" && /vor 5 Tagen/.test(s.text), JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForTimeout(300);
  r.check("d: der Knopf öffnet Spielen", (await page.evaluate(() => location.hash)) === "#/spielen");
  await setze(page, EINGESTUFT + " d.spielen.partien.push(partie('p1', 2)); d.spielen.analysen.push({ id: 'p1', version: 1, summe: {} });");
  s = await seite(page);
  r.check("d: 2 Tage sind noch kein Grund (Fall f)", s.fall === "f", JSON.stringify(s));
  await setze(page, EINGESTUFT);
  s = await seite(page);
  r.check("d: auch ohne jede Partie -> 'Partie spielen'", s.fall === "d" && /noch keine Partie/.test(s.text), JSON.stringify(s));

  // Fall e
  await setze(page, RUHIG + " d.taktik.standort.push({ datum: new Date(Date.now() - 30 * 86400000).toISOString(), geloest: 9, von: 20, msSchnitt: 20000, satz: 'x', pruefset: 'einsteiger' });");
  s = await seite(page);
  r.check("e: Standortbestimmung nach 4 Wochen -> 'Standortbestimmung'", s.fall === "e" && s.knopf === "Standortbestimmung", JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  const sb = await page.evaluate(async () => { const a = (await import("./js/storage.js")).store.get().taktik.aktiv; return { typ: a.typ, set: a.pruefset, n: a.plan.length }; });
  r.check("e: der Knopf startet die Standortbestimmung mit dem Prüfset aus den Einstellungen (automatisch: Einsteiger bei Stärke 600)", sb.typ === "standort" && sb.set === "einsteiger" && sb.n === 20, JSON.stringify(sb));
  await setze(page, RUHIG + " d.einstellungen.pruefset = 'fortgeschritten'; d.taktik.standort.push({ datum: new Date(Date.now() - 30 * 86400000).toISOString(), geloest: 9, von: 20, msSchnitt: 20000, satz: 'x', pruefset: 'einsteiger' });");
  s = await seite(page);
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  r.check("e: gewähltes Prüfset 'Fortgeschritten' wird benutzt", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv.pruefset)) === "fortgeschritten");

  // Reihenfolge: e wird von d verdeckt, bleibt aber als Nebenzeile
  await setze(page, EINGESTUFT + " d.spielen.partien.push(partie('p1', 6)); d.spielen.analysen.push({ id: 'p1', version: 1, summe: {} }); d.taktik.standort.push({ datum: new Date(Date.now() - 40 * 86400000).toISOString(), geloest: 9, von: 20, msSchnitt: 1, satz: 'x', pruefset: 'einsteiger' });");
  s = await seite(page);
  r.check("Reihenfolge: d geht vor e, die Erinnerung bleibt als Nebenzeile", s.fall === "d" && s.neben[0] === "Standortbestimmung ist fällig", JSON.stringify(s));
  r.check("Höchstens zwei Nebenzeilen", s.neben.length <= 2);

  // Fall f
  await setze(page, RUHIG);
  s = await seite(page);
  r.check("f: sonst 'Sitzung starten'", s.fall === "f" && s.knopf === "Sitzung starten" && s.neben.join() === "Partie spielen", JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 45000 });
  r.check("f: ein Tipp startet eine Sitzung", (await page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.aktiv.typ)) === "sitzung");

  // Partie läuft
  await setze(page, RUHIG + " d.spielen.aktiv = { id: 'x', modus: 'partie', farbe: 'w', stufe: 2, stufenversion: 1, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', zuege: ['e2e4', 'e7e5'], zuruecknahme: false, warnung: false, warnungen: 0, trotzdem: 0, zurueck: 0, aufgegeben: false, gestartet: new Date().toISOString() };");
  s = await seite(page);
  r.check("0: läuft eine Partie, heißt der Knopf 'Partie fortsetzen'", s.fall === "fortsetzen" && s.knopf === "Partie fortsetzen", JSON.stringify(s));
  await page.click("#heute-haupt");
  await page.waitForSelector("#sp-lauf:not([hidden])", { timeout: 10000 });
  r.check("0: der Knopf öffnet die Partie", (await page.evaluate(() => location.hash)) === "#/spielen/lauf");

  // Layout
  await setze(page, EINGESTUFT + " d.taktik.karten.a = karte('a', heute); d.spielen.partien.push(partie('p1', 1), partie('p2', 4));");
  await seite(page);
  const m = await page.evaluate(() => {
    const klein = [...document.querySelectorAll("#page-heute button")].filter((e) => e.offsetParent).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent);
    return { klein, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, iw: innerWidth, text: document.getElementById("page-heute").innerText };
  });
  r.check("Alle Tippflächen mindestens 44 px, kein Überlauf, Seite nicht länger als ein Bildschirm", m.klein.length === 0 && m.w === m.iw && m.h <= 844, JSON.stringify({ k: m.klein, h: m.h }));
  r.check("Keine Serien, Punkte, Auszeichnungen, Emojis im Text", !/Serie|Streak|Punkte|Abzeichen|Bravo|Super|Glückwunsch/i.test(m.text) && !/\p{Extended_Pictographic}/u.test(m.text));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
