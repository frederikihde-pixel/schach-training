// Einstellungen: Abschnitte, Standardwerte (Zug zurücknehmen, Patzer-Warnung, Chess.com-Wertung, Prüfset), Unterseiten.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Einstellungen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  const ein = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get().einstellungen)));
  await page.goto(url + "index.html");
  await page.click("#link-einstellungen");
  await page.waitForSelector("#page-einstellungen:not([hidden])");
  const titel = await page.locator("#page-einstellungen .set-titel").allTextContents();
  r.check("Abschnitte: Darstellung, Training, Weiteres", titel.join("|") === "Darstellung|Training|Weiteres", titel.join("|"));
  r.check("Darstellung: drei Brett-Designs, eines gewählt", (await page.locator("#design-liste .design-card").count()) === 3 && (await page.locator('#design-liste .design-card[aria-pressed="true"]').count()) === 1);
  r.check("Training enthält Denkhilfe, Zug zurücknehmen, Patzer-Warnung, Chess.com-Wertung, Prüfset", (await page.locator("#set-denkhilfe, #set-zuruecknahme, #set-warnung, #set-wertung, #set-pruefset").count()) === 5);
  const weiteres = await page.locator('#page-einstellungen nav[aria-label="Weiteres"] > *').allTextContents();
  r.check("Weiteres: Daten, Einführung, Freies Brett, Info und Lizenzen", weiteres.map((t) => t.trim()).join("|") === "Daten sichern und wiederherstellen|Einführung ansehen|Freies Brett|Info und Lizenzen", weiteres.join("|"));

  // Standardwerte
  const e0 = await ein();
  r.check("Standard: Zug zurücknehmen aus, Patzer-Warnung automatisch (an), Prüfset automatisch", e0.zuruecknahme === false && e0.patzerWarnung === null && e0.pruefset === null);
  r.check("Anzeige: Warnung 'an' mit Hinweis 'Automatisch ...'", (await page.textContent("#set-warnung")) === "an" && /Automatisch: an für die ersten 3 Partien/.test(await page.textContent("#set-warnung-info")));
  await page.click("#set-zuruecknahme");
  await page.click("#set-warnung");
  const e1 = await ein();
  r.check("Antippen speichert: Zurücknehmen an, Warnung ausdrücklich aus", e1.zuruecknahme === true && e1.patzerWarnung === false && (await page.textContent("#set-zuruecknahme")) === "an" && (await page.textContent("#set-warnung")) === "aus");
  await page.reload();
  await page.waitForSelector("#page-einstellungen:not([hidden])");
  r.check("Nach Neuladen bleiben die Werte", (await page.textContent("#set-zuruecknahme")) === "an" && (await page.textContent("#set-warnung")) === "aus");

  // Die Standardwerte gelten beim Start einer Partie und lassen sich dort überschreiben
  await page.goto(url + "index.html#/spielen/partie");
  await page.waitForSelector("#sp-btn-start");
  r.check("Partie übernimmt die Standardwerte (Zurücknehmen an, Warnung aus)", (await page.getAttribute("#sp-sw-zurueck", "aria-checked")) === "true" && (await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "false");
  await page.click("#sp-sw-warnung");
  r.check("Vor dem Start lässt sich die Warnung für diese Partie ändern, ohne den Standard zu ändern", (await page.getAttribute("#sp-sw-warnung", "aria-checked")) === "true" && (await ein()).patzerWarnung === false);

  // Chess.com-Wertung: nur hier
  await page.goto(url + "index.html#/einstellungen");
  await page.waitForTimeout(300);
  await page.fill("#set-wertung", "440");
  await page.waitForTimeout(100);
  r.check("Wertung 440: Vorschlag Stufe 2, gespeichert", /Stufe 2/.test(await page.textContent("#set-wertung-info")) && (await ein()).chesscomWertung === 440);
  await page.fill("#set-wertung", "abc");
  r.check("Ungültige Wertung wird gemeldet und nicht gespeichert", /ganze Zahl/.test(await page.textContent("#set-wertung-info")) && (await ein()).chesscomWertung === 440);
  await page.fill("#set-wertung", "");
  r.check("Leeres Feld löscht die Wertung", (await ein()).chesscomWertung === null);

  // Prüfset
  const opt = await page.locator("#set-pruefset .choice").evaluateAll((els) => els.map((e) => [e.dataset.wert, e.getAttribute("aria-pressed"), Math.round(e.getBoundingClientRect().height)]));
  r.check("Prüfset: Automatisch (gewählt), Einsteiger, Fortgeschritten, je mindestens 44 px", opt.map((o) => o[0]).join() === "auto,einsteiger,fortgeschritten" && opt[0][1] === "true" && opt.every((o) => o[2] >= 44), JSON.stringify(opt));
  await page.click('#set-pruefset .choice[data-wert="fortgeschritten"]');
  r.check("Prüfset-Wahl wird gespeichert", (await ein()).pruefset === "fortgeschritten" && (await page.getAttribute('#set-pruefset .choice[data-wert="fortgeschritten"]', "aria-pressed")) === "true");

  // Unterseiten
  await page.click('#page-einstellungen a[href="#/einstellungen/daten"]');
  await page.waitForTimeout(200);
  r.check("Daten ist eine Unterseite mit Zurück-Pfeil", (await page.textContent("#app-titel")) === "Daten" && (await page.evaluate(() => !document.getElementById("btn-zurueck").hidden)));
  await page.click("#btn-zurueck");
  await page.click('#page-einstellungen a[href="#/einstellungen/brett"]');
  await page.waitForTimeout(300);
  r.check("Freies Brett enthält FEN und PGN laden", (await page.textContent("#app-titel")) === "Freies Brett" && (await page.isVisible("#fen-input")) && (await page.locator("#pgn-input").count()) === 1);
  await page.click("#btn-zurueck");
  await page.click("#btn-einfuehrung");
  await page.waitForTimeout(200);
  r.check("Einführung öffnet sich aus den Einstellungen", await page.evaluate(() => !document.getElementById("intro").hidden));
  await page.click("#intro-ueberspringen");

  // Layout
  await page.goto(url + "index.html#/einstellungen");
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const klein = [...document.querySelectorAll("#page-einstellungen button, #page-einstellungen a, #page-einstellungen input, #page-einstellungen summary")].filter((e) => e.offsetParent).filter((e) => { const b = e.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5; }).map((e) => (e.id || e.textContent.trim().slice(0, 20)));
    return { klein, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, iw: window.innerWidth };
  });
  r.check("Alle Tippflächen mindestens 44 px, kein Überlauf", m.klein.length === 0 && m.w === m.iw, JSON.stringify(m));
  r.check("Seite höchstens 2,5 Bildschirme hoch", m.h <= 844 * 2.5, String(m.h));
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
