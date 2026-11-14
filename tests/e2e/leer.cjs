// Leere Zustände: Statistik und Wiederholungen ohne Daten zeigen einen erklärenden Satz und einen Knopf.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Leere Zustände");
  const { server, url } = await startServer();
  const browser = await launch();

  const hidden = (page, id) => page.evaluate((i) => document.getElementById(i).hidden, id);
  const setTaktik = (page, src) =>
    page.evaluate(async (code) => {
      const { store } = await import("./js/storage.js");
      store.update(new Function("d", code));
    }, src);

  // ---- Statistik ohne Einstufung ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(500);
    r.check("Statistik ohne Einstufung: Erklärung sichtbar", !(await hidden(page, "stat-leer")) && /Die Statistik füllt sich, sobald du Rätsel gelöst hast/.test(await page.textContent("#stat-leer-text")));
    r.check("Statistik ohne Einstufung: Knopf 'Einstufung starten', mindestens 44 px", await page.evaluate(() => {
      const b = document.getElementById("btn-stat-leer");
      const x = b.getBoundingClientRect();
      return b.textContent === "Einstufung starten" && x.height >= 43.5 && x.width >= 43.5;
    }));
    r.check("Leere Diagramme und Listen sind ausgeblendet", await hidden(page, "stat-inhalt"));
    r.check("Standortbestimmung bleibt sichtbar (mit Knopf und Hinweis 'Noch keine Ergebnisse')", !(await page.evaluate(() => document.getElementById("stat-standort").hidden)) && /Noch keine Ergebnisse/.test(await page.textContent("#stat-standort")));
    r.check("Kein Überlauf", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
    await page.click("#btn-stat-leer");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    r.check("Knopf startet die Einstufung ('Rätsel 1 von 10', 'Einstufung')", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 10" && (await page.textContent("#lauf-art")) === "Einstufung");
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/leer-statistik.png` : "/tmp/leer.png" }).catch(() => {});
    r.check("keine Skriptfehler (Einstufung aus der Statistik)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Statistik nach der Einstufung, noch keine Sitzung ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(400);
    await setTaktik(page, "d.taktik.staerke = 1400; d.taktik.eingestuft = true;");
    await page.reload();
    await page.waitForTimeout(500);
    r.check("Eingestuft, aber ohne Sitzung: 'Noch keine Sitzung gespielt'", /Noch keine Sitzung gespielt/.test(await page.textContent("#stat-leer-text")) && (await page.textContent("#btn-stat-leer")) === "Sitzung starten");
    await page.click("#btn-stat-leer");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    r.check("Knopf startet eine Sitzung ('Rätsel 1 von 10')", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 10");
    await page.click("#btn-beenden");
    await page.click("#btn-beenden-ja");
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(400);
    r.check("Die abgebrochene leere Sitzung zählt nicht: Erklärung bleibt", !(await hidden(page, "stat-leer")));
    r.check("keine Skriptfehler (Sitzung aus der Statistik)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Statistik mit Daten: keine Erklärung mehr ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(400);
    await setTaktik(page, `d.taktik.staerke = 1400; d.taktik.eingestuft = true; d.taktik.sitzungen = [{datum: new Date().toISOString(), typ: "sitzung", n: 5, ok: 3, fehler: 2, msSchnitt: 9000, schwaechstes: null, staerke: 1400}]; d.taktik.verlauf = [{t: new Date().toISOString(), s: 1400}];`);
    await page.reload();
    await page.waitForTimeout(500);
    r.check("Mit Daten: Erklärung weg, Inhalt sichtbar", (await hidden(page, "stat-leer")) && !(await hidden(page, "stat-inhalt")));
  }

  // ---- Wiederholungen ohne Daten (Seite Üben) ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(400);
    await setTaktik(page, "d.taktik.staerke = 1400; d.taktik.eingestuft = true;");
    await page.reload();
    await page.waitForTimeout(500);
    const info = await page.textContent("#taktik-info");
    r.check("Üben ohne Wiederholungen: erklärender Satz", /Noch keine Wiederholungen/.test(info) && /nach 1, 3, 7 und 21 Tagen wieder/.test(info), info);
    r.check("Daneben steht der Knopf 'Sitzung starten' (mindestens 44 px)", await page.evaluate(() => {
      const b = document.getElementById("btn-sitzung");
      const x = b.getBoundingClientRect();
      return !!b.offsetParent && b.textContent === "Sitzung starten" && x.height >= 43.5;
    }));
    await setTaktik(page, `d.taktik.karten = {a: {stufe: 1, faellig: "2999-01-01", raetsel: {id: "a", fen: "x", zuege: "a b", rating: 1400, themen: []}}};`);
    await page.reload();
    await page.waitForTimeout(500);
    r.check("Mit Karten (noch nicht fällig): 'Fällige Wiederholungen: 0'", (await page.textContent("#taktik-info")) === "Fällige Wiederholungen: 0");
    r.check("keine Skriptfehler (leere Wiederholungen)", page.__errors.length === 0, page.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
