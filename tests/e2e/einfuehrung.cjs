// Einführung: erscheint nur beim ersten Start, lässt sich überspringen und wieder öffnen, Wischen, Inhalt.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Einführung");
  const { server, url } = await startServer();
  const browser = await launch();

  const visible = (page) => page.evaluate(() => !document.getElementById("intro").hidden);
  const seen = (page) =>
    page.evaluate(() => {
      const s = localStorage.getItem("schach-training");
      return s ? JSON.parse(s).einstellungen.einfuehrungGesehen : null;
    });
  const seite = (page) => page.textContent("#intro-seite");
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

  // ---- Erster Start ----
  const a = await newPage(browser, { seed: false });
  const page = a.page;
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(600);
  r.check("Erster Start: Einführung erscheint automatisch", await visible(page));
  r.check("Anzeige 'Seite 1 von 6'", (await seite(page)) === "Seite 1 von 6");
  r.check("Sechs Seiten (4 bis 6 verlangt)", (await page.$$("#intro-slides .intro-slide")).length === 6);
  r.check("Zurück ist auf der ersten Seite gesperrt", await page.evaluate(() => document.getElementById("intro-zurueck").disabled));
  r.check("Kein seitlicher Überlauf", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));

  const text = await page.evaluate(() => document.getElementById("intro").textContent.replace(/\s+/g, " "));
  const noetig = [
    ["Brett, frei spielen", /Brett:[^.]*frei spielen/],
    ["Taktik", /Taktik:/],
    ["Standortbestimmung", /Standortbestimmung:/],
    ["Statistik", /Statistik:/],
    ["Daten sichern", /Daten sichern:/],
    ["Einstufung mit 10 Rätseln", /Einstufung\. Das sind 10 Rätsel/],
    ["ein bis zwei kurze Sitzungen pro Tag", /ein- bis zweimal am Tag kurz/],
    ["ganze Zugfolge zu Ende denken", /ganze Zugfolge zu Ende/],
    ["Fehler kommen nach 1, 3, 7 und 21 Tagen wieder", /1, 3, 7 und 21 Tagen wieder/],
    ["Fehler sind das Training", /Fehler sind das Training/],
    ["Standortbestimmung nach 4 Wochen wiederholen", /Standortbestimmung nach 4 Wochen/],
    ["nur sie zeigt echten Fortschritt", /Nur sie zeigt echten Fortschritt/],
    ["Taktikstärke ist nur eine Schätzung", /Taktikstärke[^.]*nur eine Schätzung/],
    ["Daten regelmäßig exportieren", /Exportiere deine Daten regelmäßig/],
    ["immer denselben Link", /immer denselben Link/],
    ["Home-Bildschirm", /Home-Bildschirm/],
    ["ehrlicher Hinweis: Partien mit langer Bedenkzeit und Analyse", /Partien mit langer Bedenkzeit dazu und die Analyse/],
  ];
  for (const [name, re] of noetig) r.check(`Inhalt: ${name}`, re.test(text));
  r.check("Keine Emojis", !EMOJI.test(text));

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("#intro button")]
      .filter((b) => {
        const x = b.getBoundingClientRect();
        return x.height < 43.5 || x.width < 43.5;
      })
      .map((b) => b.id),
  );
  r.check("Alle Tippflächen der Einführung mindestens 44 px", small.length === 0, small.join());
  r.check(
    "Die App darunter ist nicht bedienbar (Einführung liegt darüber)",
    await page.evaluate(() => {
      const t = document.getElementById("tab-taktik").getBoundingClientRect();
      const el = document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2);
      return !!el.closest("#intro");
    }),
  );

  // Weiter und Zurück
  await page.click("#intro-weiter");
  await page.waitForTimeout(250);
  r.check("Weiter: Seite 2 von 6, Zurück ist frei", (await seite(page)) === "Seite 2 von 6" && !(await page.evaluate(() => document.getElementById("intro-zurueck").disabled)));
  await page.click("#intro-zurueck");
  await page.waitForTimeout(250);
  r.check("Zurück: wieder Seite 1", (await seite(page)) === "Seite 1 von 6");

  // Wischen (Touch)
  const client = await page.context().newCDPSession(page);
  const swipe = async (from, to) => {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y: 400 }] });
    for (let i = 1; i <= 8; i++) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y: 400 }] });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(600);
  };
  await swipe(330, 40);
  r.check("Wischen nach links: Seite 2", (await seite(page)) === "Seite 2 von 6", await seite(page));
  await swipe(330, 40);
  r.check("Nochmal wischen: Seite 3", (await seite(page)) === "Seite 3 von 6", await seite(page));
  await swipe(40, 330);
  r.check("Wischen nach rechts: zurück auf Seite 2", (await seite(page)) === "Seite 2 von 6", await seite(page));

  // Bis zum Ende
  for (let i = 0; i < 4; i++) {
    await page.click("#intro-weiter");
    await page.waitForTimeout(200);
  }
  r.check("Letzte Seite: Knopf heißt 'Fertig'", (await seite(page)) === "Seite 6 von 6" && (await page.textContent("#intro-weiter")) === "Fertig", await seite(page));
  await page.click("#intro-weiter");
  r.check("Fertig schließt die Einführung und zählt als gesehen", !(await visible(page)) && (await seen(page)) === true);
  r.check("Danach ist die App bedienbar", await page.evaluate(() => !document.getElementById("page-brett").hidden));

  await page.reload();
  await page.waitForTimeout(500);
  r.check("Neuladen: Einführung erscheint nicht wieder", !(await visible(page)));

  // Wieder öffnen über Mehr
  await page.click("#link-mehr");
  await page.waitForTimeout(150);
  r.check("Eintrag 'Einführung' unter Mehr, mindestens 44 px", await page.evaluate(() => {
    const b = document.getElementById("btn-einfuehrung").getBoundingClientRect();
    return b.height >= 43.5 && b.width >= 43.5;
  }));
  await page.click("#btn-einfuehrung");
  await page.waitForTimeout(200);
  r.check("Mehr > Einführung öffnet sie jederzeit wieder (Seite 1)", (await visible(page)) && (await seite(page)) === "Seite 1 von 6");
  await page.click("#intro-ueberspringen");
  r.check("Überspringen schließt sie wieder", !(await visible(page)));
  r.check("keine Skriptfehler (erster Start)", page.__errors.length === 0, page.__errors.join("; "));

  // ---- Überspringen zählt als gesehen ----
  const b = await newPage(browser, { seed: false });
  await b.page.goto(url + "index.html#/taktik");
  await b.page.waitForTimeout(500);
  r.check("Neuer Nutzer: Einführung erscheint auch auf einer anderen Startseite", await visible(b.page));
  await b.page.click("#intro-ueberspringen");
  r.check("Überspringen zählt als gesehen", (await seen(b.page)) === true && !(await visible(b.page)));
  await b.page.reload();
  await b.page.waitForTimeout(400);
  r.check("Nach Überspringen und Neuladen kein zweites Mal", !(await visible(b.page)));

  // ---- Bisherige Nutzer (Version 2 mit Daten): keine automatische Einführung ----
  const v2 = {
    app: "schach-training",
    version: 2,
    erstelltAm: "2026-11-01T10:00:00.000Z",
    letzterExport: null,
    einstellungen: {},
    taktik: { staerke: 1450, eingestuft: true, anzahl: 12, versuche: [{ id: "a" }], themen: {}, karten: {}, gesehen: {}, sitzungen: [], verlauf: [], standort: [], aktiv: null },
  };
  const c = await newPage(browser, { seed: false });
  await c.page.addInitScript((state) => {
    if (!localStorage.getItem("schach-training")) localStorage.setItem("schach-training", JSON.stringify(state));
  }, v2);
  await c.page.goto(url + "index.html#/brett");
  await c.page.waitForTimeout(500);
  r.check("Bisheriger Nutzer (Version 2): keine automatische Einführung", !(await visible(c.page)));
  await c.page.click("#link-mehr");
  await c.page.click("#btn-einfuehrung");
  r.check("Bisheriger Nutzer findet sie trotzdem unter Mehr", await visible(c.page));

  r.check("keine Skriptfehler", [b, c].every((x) => x.page.__errors.length === 0), [...b.page.__errors, ...c.page.__errors].join("; "));
  await browser.close();
  server.close();
  r.done();
})();
