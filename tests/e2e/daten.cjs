// Daten-Seite: Export, Löschen, Import ergibt denselben Stand; Erinnerung nach 14 Tagen.
const fs = require("fs");
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Daten-Seite");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser, { acceptDownloads: true });
  await page.clock.install({ time: new Date("2026-11-12T10:00:00Z") });
  await page.goto(url + "index.html#/mehr/daten");
  await page.waitForTimeout(500);

  const getState = () => page.evaluate(async () => (await import("./js/storage.js")).store.get());
  r.check("Adresse und Hinweis auf denselben Link sichtbar", await page.evaluate(() => /immer denselben Link/.test(document.getElementById("page-daten").innerText) && document.getElementById("daten-adresse").textContent.startsWith("http")));
  r.check("Noch nie exportiert", (await page.textContent("#daten-letzter-export")).includes("Noch nie"));

  // Testdaten
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => {
      d.taktik.staerke = 1432;
      d.taktik.eingestuft = true;
      d.taktik.versuche.push({ id: "p1", ok: true, ms: 5000 }, { id: "p2", ok: false, ms: 9000 });
      d.taktik.themen.fork = { n: 2, ok: 1, ms: 14000 };
      d.taktik.karten.p2 = { stufe: 1, faellig: "2026-11-13" };
      d.taktik.sitzungen.push({ datum: "2026-11-12", n: 2 });
    });
  });

  // Export
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const file = "/tmp/schach-export-test.json";
  await download.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  r.check("Export lädt eine JSON-Datei mit Datum im Namen", /^schach-training-2026-11-12\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  r.check("Exportdatei hat Version und Daten", exported.version === 2 && exported.taktik.staerke === 1432);
  const afterExport = await getState();

  // Löschen
  await page.click("#btn-loeschen");
  r.check("Löschen verlangt Bestätigung", await page.evaluate(() => !document.getElementById("loeschen-bestaetigung").hidden));
  await page.click("#btn-loeschen-nein");
  r.check("Abbrechen löscht nichts", (await getState()).taktik.staerke === 1432);
  await page.click("#btn-loeschen");
  await page.click("#btn-loeschen-ja");
  const wiped = await getState();
  r.check("Nach Löschen leer", wiped.taktik.staerke === null && wiped.taktik.versuche.length === 0 && (await page.evaluate(() => localStorage.getItem("schach-training"))) === null);

  // Import
  await page.setInputFiles("#datei-import", file);
  await page.waitForTimeout(300);
  r.check("Import zeigt Vorschau und fragt nach", await page.evaluate(() => !document.getElementById("import-bestaetigung").hidden && /2 gespeicherte Versuche/.test(document.getElementById("import-bestaetigung-text").textContent)));
  await page.click("#btn-import-ja");
  const restored = await getState();
  r.check("Import ergibt denselben Stand wie nach dem Export", JSON.stringify(restored) === JSON.stringify(afterExport));

  // Fehlerhafte Dateien
  fs.writeFileSync("/tmp/schach-bad1.json", "das ist kein json");
  fs.writeFileSync("/tmp/schach-bad2.json", JSON.stringify({ app: "anderes", version: 1 }));
  fs.writeFileSync("/tmp/schach-bad3.json", JSON.stringify({ ...exported, version: 42 }));
  for (const [f, re] of [["bad1", /JSON/], ["bad2", /keine Sicherungsdatei/], ["bad3", /neueren Version/]]) {
    await page.setInputFiles("#datei-import", `/tmp/schach-${f}.json`);
    await page.waitForTimeout(250);
    const msg = await page.textContent("#daten-meldung");
    r.check(`Fehlerhafte Datei ${f} wird abgelehnt`, re.test(msg) && (await getState()).taktik.staerke === 1432, msg);
  }

  // Erinnerung: heute keine, nach 15 Tagen ohne Export (Export war heute) -> nein; nach 15 Tagen -> ja
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(300);
  r.check("Frisch exportiert: keine Erinnerung", await page.evaluate(() => document.getElementById("hinweis-export").hidden));
  await page.clock.setFixedTime(new Date("2026-11-27T10:00:00Z"));
  await page.reload();
  await page.waitForTimeout(500);
  r.check("Nach 15 Tagen ohne Export: Hinweis sichtbar", await page.evaluate(() => !document.getElementById("hinweis-export").hidden && /14 Tage/.test(document.getElementById("hinweis-export-text").textContent)));
  await page.click("#hinweis-export-spaeter");
  r.check("Später blendet den Hinweis aus", await page.evaluate(() => document.getElementById("hinweis-export").hidden));
  await page.reload();
  await page.waitForTimeout(400);
  await page.click(".btn-link");
  await page.waitForTimeout(200);
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  await dl2.path();
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(300);
  r.check("Nach neuem Export wieder keine Erinnerung", await page.evaluate(() => document.getElementById("hinweis-export").hidden));

  r.check("keine Skriptfehler", page.__errors.length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
