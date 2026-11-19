// Analyse mit der echten Engine: Beispielpartie mit eingestellter Dame, Einstufung als Patzer, Fortsetzen nach Neuladen.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

// 1.e4 e5 2.Dh5 Sc6 3.Dxe5+?? Sxe5 4.Sf3 Sxf3+ 5.gxf3 (Weiß stellt die Dame ein)
const ZUEGE = ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5", "c6e5", "g1f3", "e5f3", "g2f3"];

(async () => {
  const r = reporter("Analyse");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html");
  await page.waitForTimeout(500);

  const res = await page.evaluate(async (zuege) => {
    const { store } = await import("./js/storage.js");
    const { getEngine } = await import("./js/engine.js");
    const { createRueckblick } = await import("./js/rueckblick.js");
    const rb = createRueckblick({ store, getEngine });
    const t0 = performance.now();
    rb.starte({ id: "test1", farbe: "w", zuege });
    await rb.warteBisFertig();
    const e = rb.eintrag("test1");
    return { sek: +((performance.now() - t0) / 1000).toFixed(1), e };
  }, ZUEGE);
  const e = res.e;
  const patzer = e.eintraege.find((x) => x.ply === 4);
  console.log(JSON.stringify({ sek: res.sek, summe: e.summe, patzer: patzer && { art: patzer.art, verlust: patzer.verlust, text: patzer.text, best: patzer.bestSan, nr: patzer.nr, phase: patzer.phase } }));
  r.check("Analyse läuft durch und speichert ein Ergebnis", !!e && e.zuege.length === 5 && e.version === 1);
  r.check("Die eingestellte Dame (3. Zug, Dxe5+) wird gefunden", !!patzer && patzer.san === "Dxe5+", patzer && patzer.san);
  r.check("Sie wird als Patzer eingestuft (Verlust mindestens 300)", patzer && patzer.art === "patzer" && patzer.verlust >= 300, patzer && `${patzer.art} ${patzer.verlust}`);
  r.check("Erklärung: Dame auf e5 war danach ungedeckt", patzer && /^Die Dame auf e5 war danach ungedeckt und konnte geschlagen werden\.$/.test(patzer.text), patzer && patzer.text);
  r.check("Zugnummer 3, Spielphase Eröffnung, besserer Zug vorhanden", patzer && patzer.nr === 3 && patzer.phase === "eroeffnung" && /^[A-Za-z]/.test(patzer.bestSan));
  r.check("Nur der Damenverlust wird beanstandet, die vernünftigen Züge (e4, Dh5, Sf3) nicht", e.eintraege.map((x) => x.ply).join() === "4", e.eintraege.map((x) => x.ply + x.art).join());
  r.check("Der Zug gxf3 nach dem Damenverlust ist kein Patzer", !e.eintraege.some((x) => x.ply === 8 && x.art === "patzer"));
  r.check("Zusammenfassung zählt den Patzer", e.summe.patzer >= 1 && e.summe.zuege === 5);
  r.check("Dauer der Mini-Analyse (10 Stellungen) unter 10 Sekunden", res.sek < 10, res.sek + " s");

  // Fortsetzen nach Neuladen
  const teil = await page.evaluate(async (zuege) => {
    const { store } = await import("./js/storage.js");
    const { getEngine } = await import("./js/engine.js");
    const { createRueckblick } = await import("./js/rueckblick.js");
    const rb = createRueckblick({ store, getEngine });
    const stand = [];
    rb.auf((x) => x.typ === "fortschritt" && stand.push(x.fertig));
    rb.starte({ id: "test2", farbe: "w", zuege });
    while ((rb.status() ? rb.status().fertig : 0) < 4) await new Promise((r) => setTimeout(r, 50));
    return rb.status().fertig;
  }, ZUEGE);
  await page.reload(); // Seite weg, Engine weg: es zählt nur der gespeicherte Stand
  await page.waitForTimeout(600);
  const nachNeuladen = await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const { getEngine } = await import("./js/engine.js");
    const { createRueckblick } = await import("./js/rueckblick.js");
    const rb = createRueckblick({ store, getEngine });
    const vorher = rb.status();
    const gesehen = [];
    rb.auf((x) => x.typ === "fortschritt" && gesehen.push(x.fertig));
    rb.fortsetzen();
    await rb.warteBisFertig();
    return { vorher, gesehen, fertig: !!rb.eintrag("test2"), lauf: store.get().spielen.analyseLauf };
  });
  r.check("Vor dem Neuladen waren mindestens 4 Stellungen gespeichert", teil >= 4, String(teil));
  r.check("Nach Neuladen ist der Stand da (Stellung " + (nachNeuladen.vorher && nachNeuladen.vorher.fertig) + " von 10)", nachNeuladen.vorher && nachNeuladen.vorher.fertig >= 4 && nachNeuladen.vorher.gesamt === 10 && nachNeuladen.vorher.laeuft === false);
  r.check("Die Analyse setzt fort (nicht von vorn) und wird fertig", nachNeuladen.fertig && nachNeuladen.gesehen[0] === nachNeuladen.vorher.fertig && nachNeuladen.gesehen.every((x) => x >= nachNeuladen.vorher.fertig) && nachNeuladen.gesehen.at(-1) === 10 && nachNeuladen.lauf === null, JSON.stringify(nachNeuladen.gesehen));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
