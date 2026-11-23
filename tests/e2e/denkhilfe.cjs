// Denkhilfe vor den ersten Rätseln, Einstellungen-Seite. 390 px, Touch-Emulation.
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, reporter, startStandort } = require("./lib.cjs");

(async () => {
  const r = reporter("Denkhilfe und Einstellungen");
  const { server, url } = await startServer();
  const browser = await launch();
  const TEXT = "Erst prüfen: Was bedroht der Gegner? Welche Figur ist ungedeckt?";

  const mutate = (page, src) =>
    page.evaluate(async (code) => {
      const { store } = await import("./js/storage.js");
      store.update(new Function("d", code));
    }, src);
  const line = (page) => page.evaluate(() => { const e = document.getElementById("lauf-denkhilfe"); return { hidden: e.hidden, text: e.textContent, h: e.getBoundingClientRect().height }; });
  const boardTop = (page) => page.evaluate(() => Math.round(document.getElementById("taktik-board").getBoundingClientRect().top));
  async function solve(page) {
    const cur = await currentPuzzle(page);
    const o = await waitForSide(page);
    const mv = cur.puzzle.zuege.split(" ");
    for (let k = 1; k < mv.length; k += 2) { await playUci(page, mv[k], o); await page.waitForTimeout(k === mv.length - 1 ? 300 : 900); }
    await page.waitForFunction(() => /Richtig/.test(document.getElementById("lauf-meldung").textContent), null, { timeout: 15000 });
  }

  // ---- Neuer Nutzer: Einstufung zeigt die Zeile ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(500);
    await page.click("#btn-einstufung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    await waitForSide(page);
    const l = await line(page);
    r.check("Einstufung, neuer Nutzer (Stärke unbekannt): Denkhilfe steht vor dem Rätsel", !l.hidden && l.text === TEXT, JSON.stringify(l));
    r.check("Die Zeile steht über dem Brett", await page.evaluate(() => document.getElementById("lauf-denkhilfe").getBoundingClientRect().bottom <= document.getElementById("taktik-board").getBoundingClientRect().top + 1));
    r.check("Kein Überlauf, keine Skriptfehler", (await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)) && page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Platz bleibt reserviert: das Brett springt nicht, wenn die Zeile endet ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(500);
    const ids = Array.from({ length: 9 }, (_, i) => `"g${i}":1`).join(",");
    await mutate(page, `d.taktik.staerke = 500; d.taktik.eingestuft = true; d.taktik.gesehen = {${ids}};`);
    await page.reload(); await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById("taktik-optionen").open = true; });
    await page.selectOption("#sel-groesse", "5");
    await page.click("#btn-sitzung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 20000 });
    await waitForSide(page);
    const l1 = await line(page);
    const top1 = await boardTop(page);
    r.check("Sitzung mit 9 gesehenen Rätseln und Stärke 500: Zeile beim 10. Rätsel sichtbar", !l1.hidden && l1.text === TEXT);
    await solve(page);
    await page.click("#btn-weiter");
    await page.waitForFunction(() => /Rätsel 2 von 5/.test(document.getElementById("lauf-fortschritt").textContent));
    await waitForSide(page);
    const l2 = await line(page);
    const top2 = await boardTop(page);
    r.check("Danach (11. Rätsel) ist der Text weg, aber der Platz bleibt: Brett springt nicht", l2.text === "" && !l2.hidden && l2.h >= 30 && top1 === top2, `${JSON.stringify(l2)} top ${top1}/${top2}`);
  }

  // ---- Keine Zeile: Stärke ab 900, schon 10 gesehen, Standortbestimmung ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(500);
    await mutate(page, "d.taktik.staerke = 1200; d.taktik.eingestuft = true;");
    await page.reload(); await page.waitForTimeout(500);
    await page.click("#btn-sitzung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 20000 });
    await waitForSide(page);
    r.check("Stärke 1200: keine Denkhilfe", (await line(page)).hidden);
    await page.click("#btn-beenden"); await page.click("#btn-beenden-ja");
    const ids = Array.from({ length: 10 }, (_, i) => `"g${i}":1`).join(",");
    await mutate(page, `d.taktik.staerke = 500; d.taktik.gesehen = {${ids}};`);
    await page.reload(); await page.waitForTimeout(500);
    await page.click("#btn-sitzung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 20000 });
    await waitForSide(page);
    r.check("Stärke 500, aber schon 10 Rätsel gespielt: keine Denkhilfe", (await line(page)).hidden);
    await page.click("#btn-beenden"); await page.click("#btn-beenden-ja");
  }
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(600);
    await startStandort(page, "einsteiger");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    await waitForSide(page);
    r.check("Standortbestimmung läuft ohne Hinweise (auch für neue Nutzer)", (await line(page)).hidden);
  }

  // ---- Einstellungen: abschaltbar ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/einstellungen");
    await page.waitForTimeout(400);
    r.check("Einstellungen hat den Abschnitt 'Training' mit der Denkhilfe", await page.evaluate(() => [...document.querySelectorAll("#page-einstellungen .set-titel")].some((h) => h.textContent.trim() === "Training") && !!document.getElementById("set-denkhilfe")));
    const sw = await page.evaluate(() => { const b = document.getElementById("set-denkhilfe"); const x = b.getBoundingClientRect(); return { text: b.textContent, on: b.getAttribute("aria-checked"), ok: x.height >= 43.5 && x.width >= 43.5 }; });
    r.check("Schalter Denkhilfe steht auf 'an' (Standard), mindestens 44 px", sw.text === "an" && sw.on === "true" && sw.ok, JSON.stringify(sw));
    await page.click("#set-denkhilfe");
    r.check("Antippen schaltet ab und speichert", (await page.textContent("#set-denkhilfe")) === "aus" && (await page.getAttribute("#set-denkhilfe", "aria-checked")) === "false" && (await page.evaluate(async () => (await import("./js/storage.js")).store.get().einstellungen.denkhilfe)) === false);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(500);
    await page.click("#btn-einstufung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    await waitForSide(page);
    r.check("Abgeschaltet: auch bei der Einstufung keine Zeile", (await line(page)).hidden);
    await page.click("#btn-beenden"); await page.click("#btn-beenden-ja");
    await page.goto(url + "index.html#/einstellungen");
    await page.waitForTimeout(300);
    await page.click("#set-denkhilfe");
    r.check("Wieder anschalten", (await page.textContent("#set-denkhilfe")) === "an");
    r.check("Einstellungen ist ein Hauptort: Zahnrad markiert, kein Zurück-Pfeil", (await page.getAttribute("#link-einstellungen", "aria-current")) === "page" && (await page.evaluate(() => document.getElementById("btn-zurueck").hidden)));
    r.check("keine Skriptfehler (Einstellungen)", page.__errors.length === 0, page.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
