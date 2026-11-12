// Statistik-Seite und Standortbestimmung (390 px, Touch-Emulation, verschobene Uhr).
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Statistik und Standortbestimmung");
  const { server, url } = await startServer();
  const browser = await launch();
  const T0 = new Date("2026-11-12T10:00:00");
  const day = (n) => new Date(T0.getTime() + n * 86400000);

  const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get().taktik)));
  const iso = (n) => day(n).toISOString();

  async function seed(page, mutate, time = T0) {
    await page.clock.install({ time });
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(400);
    await page.evaluate(async (src) => {
      const { store } = await import("./js/storage.js");
      store.update(new Function("d", src));
    }, mutate);
    await page.reload();
    await page.waitForTimeout(600);
  }

  // ---- Statistik mit Beispieldaten ----
  {
    const { page } = await newPage(browser);
    const d = (n) => `new Date(${day(n).getTime()}).toISOString()`;
    await seed(page, `
      const t = d.taktik;
      t.staerke = 1520; t.eingestuft = true; t.anzahl = 40;
      t.verlauf = [{t:${d(-40)},s:1400},{t:${d(-33)},s:1430},{t:${d(-20)},s:1415},{t:${d(-9)},s:1470},{t:${d(-2)},s:1500},{t:${d(0)},s:1520}];
      t.sitzungen = [${[-40, -33, -20, -9, -8, -2, 0].map((n) => `{datum:${d(n)},typ:"sitzung",n:10,ok:7,fehler:3,msSchnitt:20000,schwaechstes:null,staerke:1500}`).join(",")}];
      t.themen = {
        fork: {n: 12, ok: 6, ms: 12*20000}, pin: {n: 10, ok: 9, ms: 10*15000}, skewer: {n: 6, ok: 2, ms: 6*30000},
        mateIn2: {n: 8, ok: 7, ms: 8*40000}, endgame: {n: 20, ok: 12, ms: 20*25000}, trappedPiece: {n: 3, ok: 0, ms: 3*10000},
      };
    `);
    const text = await page.innerText("#page-statistik");
    r.check("Taktikstärke wird als ruhige Zahl angezeigt", (await page.textContent("#stat-staerke")) === "Taktikstärke: 1520");
    r.check("Liniendiagramm mit einem Punkt je Sitzung (6)", await page.evaluate(() => { const p = document.querySelector("#stat-diagramm polyline"); return !!p && p.getAttribute("points").split(" ").length === 6; }));
    r.check("Diagramm hat eine Beschriftung für Screenreader", /Verlauf der Taktikstärke: von 1400 auf 1520 in 6 Sitzungen/.test(await page.getAttribute("#stat-diagramm svg", "aria-label")));
    const weeks = await page.$$eval("#stat-wochen .week-row", (rows) => rows.map((x) => [x.querySelector(".week-label").textContent, x.querySelector(".week-count").textContent]));
    r.check("Sitzungen pro Woche: 8 Wochen, aktuelle Woche (ab 9. Nov.) hat 2", weeks.length === 8 && weeks[7][1] === "2" && /9\. Nov/.test(weeks[7][0]), JSON.stringify(weeks.slice(-3)));
    r.check("Themen mit weniger als 5 Versuchen: 'zu wenig Daten'", /Gefangene Figur[\s\S]*zu wenig Daten \(3 Versuche/.test(text));
    r.check("Themen mit genug Versuchen zeigen Trefferquote und Zeit", /Gabel[\s\S]*Trefferquote 50\s%, durchschnittlich 20\sSekunden, 12 Versuche/.test(text));
    const weak = await page.$$eval("#stat-schwach .weak-row", (rows) => rows.map((x) => x.querySelector("strong").textContent));
    r.check("Schwächste 3 Themen (mindestens 5 Versuche), niedrigste Quote zuerst", weak.join() === "Spieß,Gabel,Endspiel", weak.join());
    r.check("Knopf 'Dieses Thema üben' je Thema, mindestens 44 px", await page.$$eval("#stat-schwach button", (b) => b.length === 3 && b.every((x) => x.getBoundingClientRect().height >= 43.5 && /Dieses Thema üben/.test(x.textContent))));
    r.check("Keine Belohnungen oder Serien auf der Statistik-Seite", !/Abzeichen|Serie|Streak|Punkte|Rekord|Glückwunsch/i.test(text));
    r.check("Kein seitlicher Überlauf", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/statistik.png` : "/tmp/statistik.png", fullPage: true });

    // Dieses Thema üben
    await page.locator("#stat-schwach button").first().click();
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    const t = await state(page);
    r.check("'Dieses Thema üben' startet eine Sitzung nur mit Spieß-Rätseln", t.aktiv && t.aktiv.filter === "skewer" && t.aktiv.plan.length === 10 && t.aktiv.plan.every((i) => i.puzzle.themen.includes("skewer")), `${t.aktiv && t.aktiv.plan.length}`);
    r.check("keine Skriptfehler (Statistik)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Statistik ganz ohne Daten ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(500);
    const text = await page.innerText("#page-statistik");
    r.check("Ohne Daten: 'Noch nicht eingestuft', kein Diagramm, Hinweise statt Fehler", /Noch nicht eingestuft/.test(text) && /nach der zweiten Sitzung/.test(text) && /Noch zu wenig Daten/.test(text) && /Noch keine Ergebnisse/.test(text));
    r.check("keine Skriptfehler (leere Statistik)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Standortbestimmung ----
  {
    const { page } = await newPage(browser);
    await seed(page, `
      const t = d.taktik; t.staerke = 1500; t.eingestuft = true; t.anzahl = 40;
      t.versuche = [{id:"x1",t:new Date().toISOString(),ok:true,ms:1000,r:1500}]; t.themen = {fork:{n:1,ok:1,ms:1000}};
    `);
    const before = await state(page);
    r.check("Standortbestimmung ist anbietbar", await page.evaluate(() => !document.getElementById("btn-standort").disabled));
    await page.click("#btn-standort");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    const t = await state(page);
    const ratings = t.aktiv.plan.map((i) => i.puzzle.rating);
    r.check("20 Prüfrätsel, Wertung steigt von etwa 850 bis 2050", t.aktiv.plan.length === 20 && ratings[0] < 950 && ratings[19] > 1950 && ratings.every((x, i) => i === 0 || x >= ratings[i - 1]), `${ratings[0]}..${ratings[19]}`);
    r.check("Anzeige 'Rätsel 1 von 20' und 'Standortbestimmung'", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 20" && (await page.textContent("#lauf-art")) === "Standortbestimmung");

    // Abwechselnd richtig und falsch: 10 von 20
    let solved = 0;
    for (let i = 0; i < 20; i++) {
      const cur = await currentPuzzle(page);
      const orientation = await waitForSide(page);
      const moves = cur.puzzle.zuege.split(" ");
      if (i % 2 === 0) {
        for (let k = 1; k < moves.length; k += 2) { await playUci(page, moves[k], orientation); await page.waitForTimeout(k === moves.length - 1 ? 300 : 900); }
        solved += 1;
      } else {
        const wrong = await page.evaluate(async ([fen, zuege]) => {
          const { Chess } = await import("./vendor/chess.js/chess.js");
          const m = zuege.split(" "); const g = new Chess(fen);
          g.move({ from: m[0].slice(0, 2), to: m[0].slice(2, 4), promotion: m[0][4] });
          for (const x of g.moves({ verbose: true })) { const u = x.from + x.to + (x.promotion || ""); if (u !== m[1] && !x.promotion) { const q = new Chess(g.fen()); q.move(x); if (!q.isCheckmate()) return u; } }
        }, [cur.puzzle.fen, cur.puzzle.zuege]);
        await playUci(page, wrong, orientation);
      }
      await page.waitForFunction(() => /Antwort gespeichert/.test(document.getElementById("lauf-meldung").textContent), null, { timeout: 15000 });
      if (i === 1) {
        r.check("Standortbestimmung zeigt weder Lösung noch Nachspielen", !(await page.textContent("#lauf-meldung")).includes("Zugfolge"));
      }
      await page.click("#btn-weiter");
    }
    await page.waitForSelector("#taktik-zusammenfassung:not([hidden])", { timeout: 10000 });
    const text = await page.innerText("#zus-fakten");
    r.check("Ergebnis: Gelöst 10 von 20, durchschnittliche Zeit, Datum", /Gelöst\s+10 von 20/.test(text) && /Durchschnittliche Zeit\s+\d+ Sekunden je Rätsel/.test(text) && /12\. November 2026/.test(text), text.replace(/\s+/g, " "));
    const after = await state(page);
    const e = after.standort[0];
    r.check("Ergebnis mit Datum gespeichert (geloest, von, msSchnitt, satz)", after.standort.length === 1 && e.geloest === 10 && e.von === 20 && e.msSchnitt > 0 && e.satz && e.datum.startsWith("2026-11-12"));
    r.check("Taktikstärke, Versuche, Themen, Wiederholungen und Verlauf bleiben unberührt", after.staerke === 1500 && after.versuche.length === 1 && JSON.stringify(after.themen) === JSON.stringify(before.themen) && Object.keys(after.karten).length === 0 && after.verlauf.length === 0 && after.sitzungen.length === 0 && after.anzahl === 40);
    r.check("Prüfrätsel zählen nicht als 'gesehen' im Training", Object.keys(after.gesehen).length === 0);
    r.check("Keine Belohnungen im Ergebnis", !/Abzeichen|Serie|Punkte|Rekord|Glückwunsch|Bravo/i.test(text));
    r.check("keine Skriptfehler (Standortbestimmung)", page.__errors.length === 0, page.__errors.join("; "));

    // Liste früherer Ergebnisse
    await page.click('a[href="#/taktik/statistik"].btn-link-quiet');
    await page.waitForTimeout(400);
    const items = await page.$$eval("#stat-standort-liste li", (li) => li.map((x) => x.textContent));
    r.check("Frühere Ergebnisse als einfache Liste", items.length === 1 && /12\. November 2026: 10 von 20 gelöst, durchschnittlich \d+ Sekunden je Rätsel/.test(items[0]), items.join("|"));

    // Erinnerung nach 4 Wochen
    await page.clock.setFixedTime(day(27));
    await page.reload(); await page.waitForTimeout(500);
    r.check("Nach 27 Tagen: keine Erinnerung", await page.evaluate(() => document.getElementById("hinweis-standort").hidden));
    // Die Uhr lief während der Standortbestimmung weiter: eine Stunde Reserve nach 28 Tagen.
    await page.clock.setFixedTime(new Date(day(28).getTime() + 3600 * 1000));
    await page.reload(); await page.waitForTimeout(500);
    const banner = await page.evaluate(() => ({ hidden: document.getElementById("hinweis-standort").hidden, text: document.getElementById("hinweis-standort").innerText }));
    r.check("Nach 28 Tagen: ruhige Erinnerung, ohne Druck", !banner.hidden && /vier Wochen/.test(banner.text) && /Wenn du magst/.test(banner.text) && !/!|sofort|unbedingt|verpass/i.test(banner.text), banner.text.replace(/\s+/g, " "));
    await page.click("#hinweis-standort-spaeter");
    r.check("'Später' blendet die Erinnerung aus", await page.evaluate(() => document.getElementById("hinweis-standort").hidden));

    // Zweite Standortbestimmung: Abbrechen speichert nichts
    await page.reload(); await page.waitForTimeout(500);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(400);
    await page.click("#btn-standort");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    await page.click("#btn-beenden");
    r.check("Abbrechen fragt nach", /kein Ergebnis gespeichert/.test(await page.textContent("#beenden-text")));
    await page.click("#btn-beenden-ja");
    await page.waitForTimeout(300);
    const aborted = await state(page);
    r.check("Abgebrochene Standortbestimmung speichert nichts", aborted.standort.length === 1 && aborted.aktiv === null);
  }

  await browser.close();
  server.close();
  r.done();
})();
