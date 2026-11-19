// Eigene Fehler als Rätsel: aus der Analyse übernommen, im Trainer lösbar (richtig und falsch), Wiederholung nach
// Leitner, Anteil in Sitzungen, Thema "Eigener Fehler" in der Statistik, Taktikstärke unverändert.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

// 1.e4 e5 2.Lc4 Sc6 3.Dh5 Sf6?? 4.Sf3?? (statt 4.Dxf7 matt) Sxh5: Weiß übersieht Matt in 1 und stellt die Dame ein
const ZUEGE = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "g1f3", "f6h5"];
// Dame im 3. Zug eingestellt, aber viele Züge davor sind gleich gut: kein eindeutiges Rätsel
const ZUEGE_UNKLAR = ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5", "c6e5", "g1f3", "e5f3", "g2f3"];

async function until(page, fn, arg, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(120);
  }
  throw new Error("Zeitüberschreitung: " + fn.toString().slice(0, 100));
}
const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get())));

(async () => {
  const r = reporter("Eigene Rätsel");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html");
  await page.waitForTimeout(400);
  const heute = await page.evaluate(async () => (await import("./js/leitner.js")).dayKey(new Date()));
  const morgen = await page.evaluate(async () => { const { dayKey, addDays } = await import("./js/leitner.js"); return addDays(dayKey(new Date()), 1); });
  const inTagen = (n) => page.evaluate(async (n) => { const { dayKey, addDays } = await import("./js/leitner.js"); return addDays(dayKey(new Date()), n); }, n);

  await page.evaluate(async (zuege) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive, ende, eintrag, stellung } = await import("./js/partie.js");
    const a = neueAktive({ modus: "partie", farbe: "w", stufe: 2, warnung: false });
    a.zuege = zuege;
    a.aufgegeben = true;
    const e = eintrag(a, ende(stellung(a), a), { now: new Date() });
    e.id = "p-dame";
    store.update((d) => {
      d.spielen.partien.push(e);
      d.taktik.eingestuft = true;
      d.taktik.staerke = 600;
      d.taktik.anzahl = 30;
    });
  }, ZUEGE);

  // --- Rätsel entsteht aus der Analyse ---
  await page.goto(url + "index.html#/spielen/rueckblick/p-dame");
  await until(page, () => !document.getElementById("rb-ergebnis").hidden);
  let s = await state(page);
  const karte = s.taktik.karten["e-p-dame-6"];
  r.check("Der Patzer wurde zu einem eigenen Rätsel (Karte im Wiederholungssystem)", !!karte && s.spielen.eigene.length === 1, JSON.stringify(Object.keys(s.taktik.karten)));
  r.check("Leitner: Stufe 1, fällig morgen", karte.stufe === 1 && karte.faellig === morgen, JSON.stringify([karte.stufe, karte.faellig, morgen]));
  const p = karte.raetsel;
  r.check("Rätsel: Stellung vor dem Zug (FEN), richtige Züge, kurze Hauptvariante bis 3 Halbzüge, Thema, Herkunft", /^\S+ w /.test(p.zugFen) && p.richtig.length >= 1 && p.zuege.split(" ").length <= 4 && p.themen[0] === "eigenerFehler" && p.eigen === true && p.partieId === "p-dame" && p.nr === 4, JSON.stringify({ r: p.richtig, z: p.zuege }));
  r.check("Taktikstärke durch das Anlegen unverändert", s.taktik.staerke === 600 && s.taktik.anzahl === 30);

  // --- Als Rätsel üben: richtig lösen ---
  await page.locator("#rb-liste .rb-eintrag").first().click();
  await page.waitForSelector("#rb-detail:not([hidden])");
  await page.click("#rb-btn-raetsel");
  await page.waitForSelector("#taktik-lauf:not([hidden])");
  await until(page, () => /am Zug/.test(document.getElementById("lauf-seite").textContent));
  await page.waitForTimeout(400);
  r.check("Im Trainer: Herkunft 'Eigener Fehler' mit Zugnummer, Rätsel 1 von 1", /Eigener Fehler \(Zug 4\)/.test(await page.textContent("#lauf-art")) && /Rätsel 1 von 1/.test(await page.textContent("#lauf-fortschritt")));
  r.check("Die Stellung ist vor dem Fehler: Weiß am Zug, Dame auf h5", (await page.textContent("#lauf-seite")) === "Weiß am Zug" && (await page.evaluate(() => [...document.querySelectorAll("#taktik-board piece.queen.white")].map((x) => x.cgKey).join())) === "h5");
  const richtig = p.richtig[0];
  await tapMove(page, richtig.slice(0, 2), richtig.slice(2, 4), "white", "#taktik-board");
  await until(page, () => /Richtig/.test(document.getElementById("lauf-meldung").textContent));
  r.check("Richtiger Zug wird als richtig gewertet (jeder Zug aus der Gruppe der richtigen Züge)", true);
  await page.click("#btn-weiter");
  await page.waitForSelector("#taktik-zusammenfassung:not([hidden])");
  s = await state(page);
  const k2 = s.taktik.karten["e-p-dame-6"];
  r.check("Richtig gelöst: Leitner Stufe 2, fällig in 3 Tagen", k2.stufe === 2 && k2.faellig === (await inTagen(3)), JSON.stringify([k2.stufe, k2.faellig]));
  r.check("Taktikstärke und Rätselzähler bleiben unverändert", s.taktik.staerke === 600 && s.taktik.anzahl === 30);
  r.check("Als Thema 'Eigener Fehler' gezählt (1 Versuch, 1 richtig)", s.taktik.themen.eigenerFehler && s.taktik.themen.eigenerFehler.n === 1 && s.taktik.themen.eigenerFehler.ok === 1);
  r.check("Der Versuch steht ohne Wertung im Verlauf (Rätselwertung leer)", s.taktik.versuche.at(-1).id === "e-p-dame-6" && s.taktik.versuche.at(-1).ok === true);

  // --- falsch lösen: Lösung zeigen, nachspielen ---
  await page.goto(url + "index.html#/spielen/rueckblick/p-dame");
  await page.waitForTimeout(300);
  await page.locator("#rb-liste .rb-eintrag").first().click();
  await page.click("#rb-btn-raetsel");
  await page.waitForSelector("#taktik-lauf:not([hidden])");
  await until(page, () => /am Zug/.test(document.getElementById("lauf-seite").textContent));
  await page.waitForTimeout(400);
  await tapMove(page, "g1", "f3", "white", "#taktik-board"); // der Fehler aus der Partie
  await until(page, () => /Jetzt spiele die Zugfolge selbst nach/.test(document.getElementById("lauf-meldung").textContent), null, 20000);
  r.check("Falscher Zug (der Fehler aus der Partie): nicht gelöst, Lösung wird gezeigt, dann selbst nachspielen", true);
  await tapMove(page, richtig.slice(0, 2), richtig.slice(2, 4), "white", "#taktik-board");
  await until(page, () => /Geschafft/.test(document.getElementById("lauf-meldung").textContent), null, 15000);
  await page.click("#btn-weiter");
  await page.waitForSelector("#taktik-zusammenfassung:not([hidden])");
  s = await state(page);
  const k3 = s.taktik.karten["e-p-dame-6"];
  r.check("Falsch gelöst: zurück auf Stufe 1, fällig morgen; Taktikstärke unverändert", k3.stufe === 1 && k3.faellig === morgen && s.taktik.staerke === 600 && s.taktik.anzahl === 30, JSON.stringify(k3 && [k3.stufe, k3.faellig]));
  r.check("Zähler 'Eigener Fehler': 2 Versuche, 1 richtig", s.taktik.themen.eigenerFehler.n === 2 && s.taktik.themen.eigenerFehler.ok === 1);

  // --- Sitzung: 20 bis 30 Prozent eigene Fehler, solange fällig ---
  await page.evaluate(async (gestern) => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      const basis = d.taktik.karten["e-p-dame-6"].raetsel;
      for (let i = 1; i <= 4; i++) {
        const id = "e-test-" + i;
        d.taktik.karten[id] = { stufe: 1, faellig: gestern, raetsel: { ...basis, id } };
        d.spielen.eigene.push({ id, datum: new Date().toISOString(), partieId: "test", nr: 3, art: "patzer" });
      }
      d.taktik.karten["e-p-dame-6"].faellig = gestern;
    });
  }, await inTagen(-1));
  await page.goto(url + "index.html#/taktik");
  if (await page.isVisible("#btn-zus-zurueck")) await page.click("#btn-zus-zurueck");
  await page.waitForSelector("#btn-sitzung");
  await page.click("#btn-sitzung");
  await page.waitForSelector("#taktik-lauf:not([hidden])");
  s = await state(page);
  const plan = s.taktik.aktiv.plan;
  const eigene = plan.filter((x) => x.puzzle.eigen);
  r.check("Sitzung mit 10 Rätseln enthält 2 bis 3 eigene Fehler (20 bis 30 Prozent)", plan.length === 10 && eigene.length >= 2 && eigene.length <= 3, `${eigene.length} von ${plan.length}`);
  r.check("Eigene Fehler gelten als Wiederholung (ändern die Stärke nicht), die übrigen wie bisher", eigene.every((x) => x.art === "wiederholung"));
  await page.click("#btn-beenden");
  await page.click("#btn-beenden-ja");

  // --- Statistik: eigenes Thema ---
  await page.goto(url + "index.html#/taktik/statistik");
  await page.waitForTimeout(500);
  const themen = await page.textContent("#stat-themen");
  r.check("Statistik: 'Eigener Fehler' steht als eigenes Thema in der Themenliste", /Eigener Fehler/.test(themen) && /2 Versuche/.test(themen), themen.slice(0, 120));
  r.check("Das Thema 'Eigener Fehler' steht nicht unter den schwächsten Themen", !/Eigener Fehler/.test(await page.textContent("#stat-schwach")));

  // --- Als Rätsel üben bei laufender Sitzung: Hinweis statt Fehler ---
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.taktik.aktiv = { typ: "sitzung", plan: [{ art: "neu", puzzle: { id: "x", fen: "8/8/8/8/8/8/8/K1k5 w - - 0 1", zuege: "a1a2 c1c2", rating: 500, themen: [] } }], index: 0, ergebnisse: [], filter: "", start: new Date().toISOString() };
    });
  });
  await page.goto(url + "index.html#/spielen/rueckblick/p-dame");
  await page.waitForTimeout(300);
  await page.locator("#rb-liste .rb-eintrag").first().click();
  await page.click("#rb-btn-raetsel");
  r.check("Läuft schon eine Sitzung, erklärt die App das ruhig", /läuft gerade eine Sitzung/.test(await page.textContent("#rb-meldung")));
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.taktik.aktiv = null;
    });
  });

  // --- Nicht eindeutig: viele gleich gute Züge, kein Rätsel ---
  await page.evaluate(async (zuege) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive, ende, eintrag, stellung } = await import("./js/partie.js");
    const a = neueAktive({ modus: "partie", farbe: "w", stufe: 2, warnung: false });
    a.zuege = zuege;
    a.aufgegeben = true;
    const e = eintrag(a, ende(stellung(a), a), { now: new Date() });
    e.id = "p-unklar";
    store.update((d) => {
      d.spielen.partien.push(e);
    });
  }, ZUEGE_UNKLAR);
  await page.goto(url + "index.html#/spielen/rueckblick/p-unklar");
  await until(page, () => !document.getElementById("rb-ergebnis").hidden);
  const vorher = (await state(page)).spielen.eigene.length;
  await page.locator("#rb-liste .rb-eintrag").first().click();
  await page.click("#rb-btn-raetsel");
  s = await state(page);
  r.check("Nicht eindeutig (viele gleich gute Züge): kein Rätsel, ruhige Erklärung, nichts gespeichert", /kein eindeutiges Rätsel/.test(await page.textContent("#rb-meldung")) && s.spielen.eigene.length === vorher && !s.taktik.karten["e-p-unklar-4"]);

  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
