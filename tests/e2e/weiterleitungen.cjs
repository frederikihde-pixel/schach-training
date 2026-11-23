// Alte Adressen führen auf die neuen Orte; Kopfzeile mit Zurück-Pfeil und Zahnrad; vier Reiter in der unteren Leiste.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

// [alte Adresse, neue Adresse nach der Weiterleitung, sichtbare Seite, Seitenname in der Kopfzeile]
const TABELLE = [
  ["#/brett", "#/einstellungen/brett", "page-brett", "Freies Brett"],
  ["#/taktik/statistik", "#/fortschritt", "page-statistik", "Fortschritt"],
  ["#/mehr", "#/einstellungen", "page-einstellungen", "Einstellungen"],
  ["#/mehr/einstellungen", "#/einstellungen", "page-einstellungen", "Einstellungen"],
  ["#/mehr/darstellung", "#/einstellungen", "page-einstellungen", "Einstellungen"],
  ["#/mehr/daten", "#/einstellungen/daten", "page-daten", "Daten"],
  ["#/mehr/info", "#/einstellungen/info", "page-info", "Info und Lizenzen"],
  ["#/gibtesnicht", "#/gibtesnicht", "page-heute", "Heute"],
  ["", "", "page-heute", "Heute"],
];

(async () => {
  const r = reporter("Weiterleitungen und Kopfzeile");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  for (const [alt, neu, seite, titel] of TABELLE) {
    await page.goto(url + "index.html" + alt);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({ hash: location.hash, seite: [...document.querySelectorAll(".page")].filter((p) => !p.hidden).map((p) => p.id).join(), titel: document.getElementById("app-titel").textContent }));
    r.check(`${alt || "(leer)"} führt nach ${neu || "Heute"}, zeigt ${seite}, Kopfzeile "${titel}"`, (neu === "" || m.hash === neu) && m.seite === seite && m.titel === titel, JSON.stringify(m));
  }
  // Weiterleitung beim Neuladen und beim Wechseln innerhalb der App
  await page.goto(url + "index.html#/mehr/info");
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(300);
  r.check("Nach dem Neuladen bleibt die neue Adresse stehen", (await page.evaluate(() => location.hash)) === "#/einstellungen/info");
  await page.evaluate(() => { location.hash = "#/mehr/daten"; });
  await page.waitForTimeout(300);
  r.check("Auch ein Wechsel der Adresse in der laufenden App wird umgeleitet", (await page.evaluate(() => location.hash)) === "#/einstellungen/daten");
  r.check("Die Zurück-Taste des Browsers landet nicht in einer Schleife", await (async () => {
    await page.goBack();
    await page.waitForTimeout(300);
    return (await page.evaluate(() => location.hash)) !== "#/mehr/daten";
  })());

  // Rückblick-Adresse mit Parameter bleibt gültig
  await page.goto(url + "index.html#/spielen/rueckblick/gibt-es-nicht");
  await page.waitForTimeout(300);
  r.check("Adresse mit Parameter (Rückblick) bleibt gültig und zeigt Zurück-Pfeil", (await page.evaluate(() => location.hash)) === "#/spielen/rueckblick/gibt-es-nicht" && (await page.evaluate(() => !document.getElementById("btn-zurueck").hidden)));

  // Kopfzeile: Zurück-Pfeil nur auf Unterseiten, Zahnrad immer, beide mindestens 44 px
  await page.goto(url + "index.html#/taktik");
  await page.waitForTimeout(300);
  r.check("Hauptort Taktik: kein Zurück-Pfeil, Zahnrad sichtbar", await page.evaluate(() => document.getElementById("btn-zurueck").hidden && !!document.getElementById("link-einstellungen").offsetParent));
  await page.goto(url + "index.html#/einstellungen/info");
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => { const a = document.getElementById("btn-zurueck").getBoundingClientRect(); const g = document.getElementById("link-einstellungen").getBoundingClientRect(); return { a: [a.width, a.height, a.left], g: [g.width, g.height, g.right] }; });
  r.check("Unterseite: Pfeil oben links, Zahnrad oben rechts, mindestens 44 x 44 px", box.a[0] >= 44 && box.a[1] >= 44 && box.g[0] >= 44 && box.g[1] >= 44 && box.a[2] < 20 && box.g[2] > 370, JSON.stringify(box));
  await page.click("#btn-zurueck");
  await page.waitForTimeout(300);
  r.check("Der Pfeil führt zur übergeordneten Seite (Info -> Einstellungen)", (await page.evaluate(() => location.hash)) === "#/einstellungen");
  r.check("Das Zahnrad ist auf Einstellungen markiert und hat einen Namen für Hilfsprogramme", (await page.getAttribute("#link-einstellungen", "aria-current")) === "page" && (await page.getAttribute("#link-einstellungen", "aria-label")) === "Einstellungen");

  // Untere Leiste: vier Orte, jeder mindestens 44 px hoch und breit, keine zweite Reihe
  const leiste = await page.evaluate(() => [...document.querySelectorAll(".tabbar a")].map((a) => [a.textContent.trim(), Math.round(a.getBoundingClientRect().width), Math.round(a.getBoundingClientRect().height)]));
  r.check("Untere Leiste: Heute, Taktik, Spielen, Fortschritt, je mindestens 44 px", leiste.map((x) => x[0]).join() === "Heute,Taktik,Spielen,Fortschritt" && leiste.every(([, w, h]) => w >= 44 && h >= 44), JSON.stringify(leiste));
  r.check("Keine zweite Reihe von Unterreitern auf irgendeiner Seite", (await page.evaluate(() => document.querySelectorAll(".subnav").length)) === 0);
  r.check("Kein Textlink 'Zurück' mehr (der Zug-zurück-Knopf des freien Bretts ist ein Knopf, kein Link)", (await page.evaluate(() => [...document.querySelectorAll("a")].filter((e) => e.textContent.trim() === "Zurück").length)) === 0);
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
