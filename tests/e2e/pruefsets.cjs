// Zwei Prüfsets: Auswahl auf der Statistik-Seite, Empfehlung, getrennte Ergebnislisten,
// Erinnerung nennt den Satz, Umstellung alter Ergebnisse. 390 px, Touch-Emulation.
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Zwei Prüfsets");
  const { server, url } = await startServer();
  const browser = await launch();

  const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get())));
  const mutate = (page, src) =>
    page.evaluate(async (code) => {
      const { store } = await import("./js/storage.js");
      store.update(new Function("d", code));
    }, src);
  const daysAgo = (n) => `new Date(Date.now() - ${n} * 86400000).toISOString()`;
  const visible = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden && !e.closest("[hidden]"); }, id);

  // ---- Auswahl und Empfehlung ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(700);
    r.check("Beide Prüfsets stehen zur Wahl, mit Knopf mindestens 44 px", await page.evaluate(() =>
      ["btn-standort-einsteiger", "btn-standort-fortgeschritten"].every((id) => { const b = document.getElementById(id); const x = b.getBoundingClientRect(); return !b.disabled && x.height >= 43.5 && x.width >= 43.5; })));
    r.check("Stärke unbekannt: 'Empfohlen' beim Prüfset Einsteiger, nicht beim anderen", (await visible(page, "empf-einsteiger")) && !(await visible(page, "empf-fortgeschritten")));
    await mutate(page, "d.taktik.staerke = 950; d.taktik.eingestuft = true;");
    await page.reload(); await page.waitForTimeout(600);
    r.check("Stärke 950: weiter Einsteiger empfohlen", (await visible(page, "empf-einsteiger")) && !(await visible(page, "empf-fortgeschritten")));
    await mutate(page, "d.taktik.staerke = 1300;");
    await page.reload(); await page.waitForTimeout(600);
    r.check("Stärke 1300: Fortgeschritten empfohlen", !(await visible(page, "empf-einsteiger")) && (await visible(page, "empf-fortgeschritten")));
    r.check("Kein Überlauf auf der Statistik-Seite", await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
    r.check("keine Skriptfehler (Auswahl)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Prüfset Einsteiger durchspielen ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(500);
    await mutate(page, "d.taktik.staerke = 480; d.taktik.eingestuft = true; d.taktik.anzahl = 10;");
    await page.reload(); await page.waitForTimeout(600);
    const before = (await state(page)).taktik;
    await page.click("#btn-standort-einsteiger");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    const t = (await state(page)).taktik;
    const ratings = t.aktiv.plan.map((i) => i.puzzle.rating);
    r.check("20 Prüfrätsel, Wertung steigt von etwa 450 bis 1100", t.aktiv.plan.length === 20 && ratings[0] < 520 && ratings[19] > 1050 && ratings.every((x, i) => i === 0 || x >= ratings[i - 1]), `${ratings[0]}..${ratings[19]}`);
    r.check("Gespeichert wird, welches Prüfset läuft", t.aktiv.typ === "standort" && t.aktiv.pruefset === "einsteiger");
    r.check("Anzeige 'Rätsel 1 von 20' und 'Standortbestimmung'", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 20" && (await page.textContent("#lauf-art")) === "Standortbestimmung");
    let solved = 0;
    for (let i = 0; i < 20; i++) {
      const cur = await currentPuzzle(page);
      const orientation = await waitForSide(page);
      const moves = cur.puzzle.zuege.split(" ");
      if (moves.length === 2) {
        await playUci(page, moves[1], orientation);
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
      await page.click("#btn-weiter");
    }
    await page.waitForSelector("#taktik-zusammenfassung:not([hidden])", { timeout: 10000 });
    const text = await page.innerText("#zus-fakten");
    r.check("Zusammenfassung nennt das Prüfset und das Ergebnis", /Verwendet\s+Prüfset Einsteiger/.test(text) && new RegExp(`Gelöst\\s+${solved} von 20`).test(text), text.replace(/\s+/g, " "));
    const after = (await state(page)).taktik;
    r.check("Ergebnis mit Prüfset 'einsteiger' gespeichert; Stärke, Versuche, Verlauf unberührt", after.standort.length === 1 && after.standort[0].pruefset === "einsteiger" && after.staerke === 480 && after.versuche.length === before.versuche.length && after.verlauf.length === before.verlauf.length && Object.keys(after.gesehen).length === 0);
    await page.click("#btn-zus-zurueck");
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(600);
    r.check("Liste Einsteiger zeigt das Ergebnis, Liste Fortgeschritten bleibt leer", (await page.$$eval("#stat-standort-liste-einsteiger li", (l) => l.length)) === 1 && (await page.$$eval("#stat-standort-liste-fortgeschritten li", (l) => l.length)) === 0 && (await visible(page, "stat-standort-leer-fortgeschritten")) && !(await visible(page, "stat-standort-leer-einsteiger")));
    r.check("keine Skriptfehler (Prüfset Einsteiger)", page.__errors.length === 0, page.__errors.join("; "));

    // ein Ergebnis des anderen Satzes dazu: Listen bleiben getrennt
    await mutate(page, `d.taktik.standort.push({ datum: ${daysAgo(1)}, geloest: 12, von: 20, msSchnitt: 20000, satz: "x", pruefset: "fortgeschritten" });`);
    await page.reload(); await page.waitForTimeout(600);
    const lists = await page.evaluate(() => ({ e: [...document.querySelectorAll("#stat-standort-liste-einsteiger li")].map((x) => x.textContent), f: [...document.querySelectorAll("#stat-standort-liste-fortgeschritten li")].map((x) => x.textContent) }));
    r.check("Getrennte Listen: Einsteiger 1 Eintrag, Fortgeschritten 12 von 20", lists.e.length === 1 && lists.f.length === 1 && /12 von 20 gelöst/.test(lists.f[0]) && !/12 von 20/.test(lists.e[0]), JSON.stringify(lists));
    r.check("Hinweis nennt den zuletzt gemachten Satz", /Letzte Standortbestimmung: .*\(Prüfset Fortgeschritten\)/.test(await page.textContent("#stat-standort-meldung")));
  }

  // ---- Abbrechen speichert nichts ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(500);
    await page.click("#btn-standort-einsteiger");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
    await page.click("#btn-beenden");
    await page.click("#btn-beenden-ja");
    await page.waitForTimeout(300);
    const s = (await state(page)).taktik;
    r.check("Abgebrochenes Prüfset Einsteiger speichert nichts", s.standort.length === 0 && s.aktiv === null);
  }

  // ---- Erinnerung nennt den Satz des letzten Ergebnisses ----
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(500);
    await mutate(page, `d.taktik.standort = [
      { datum: ${daysAgo(60)}, geloest: 9, von: 20, msSchnitt: 1000, satz: "x", pruefset: "fortgeschritten" },
      { datum: ${daysAgo(30)}, geloest: 8, von: 20, msSchnitt: 1000, satz: "y", pruefset: "einsteiger" }];`);
    await page.reload(); await page.waitForTimeout(600);
    const text = await page.innerText("#hinweis-standort");
    r.check("Nach 30 Tagen: Erinnerung nennt 'Prüfset Einsteiger' (das letzte Ergebnis), ruhig formuliert", !(await page.evaluate(() => document.getElementById("hinweis-standort").hidden)) && /Prüfset Einsteiger/.test(text) && /vier Wochen/.test(text) && /Wenn du magst/.test(text) && !/!|sofort|unbedingt/i.test(text), text.replace(/\s+/g, " "));
    await mutate(page, `d.taktik.standort.push({ datum: ${daysAgo(2)}, geloest: 10, von: 20, msSchnitt: 1000, satz: "x", pruefset: "fortgeschritten" });`);
    await page.reload(); await page.waitForTimeout(600);
    r.check("Neues Ergebnis vor 2 Tagen: keine Erinnerung mehr", await page.evaluate(() => document.getElementById("hinweis-standort").hidden));
  }

  // ---- Alter Stand (Version 3, Ergebnisse ohne Prüfset) wird umgestellt ----
  {
    const { page } = await newPage(browser, { seed: false });
    await page.addInitScript(() => {
      if (!localStorage.getItem("schach-training")) {
        localStorage.setItem("schach-training", JSON.stringify({
          app: "schach-training", version: 3, erstelltAm: "2026-10-01T10:00:00.000Z", letzterExport: null,
          einstellungen: { brettDesign: "dunkel", einfuehrungGesehen: true },
          taktik: { staerke: 1450, eingestuft: true, anzahl: 40, versuche: [], themen: {}, karten: {}, gesehen: {}, sitzungen: [], verlauf: [],
            standort: [{ datum: "2026-11-01T10:00:00.000Z", geloest: 13, von: 20, msSchnitt: 25000, satz: "d5b8cbda" }], aktiv: null },
        }));
      }
    });
    await page.goto(url + "index.html#/taktik/statistik");
    await page.waitForTimeout(700);
    const s = await state(page);
    r.check("Version 3 wird auf 4 umgestellt; altes Ergebnis gehört zu 'fortgeschritten'", s.version === 4 && s.taktik.standort[0].pruefset === "fortgeschritten" && s.einstellungen.denkhilfe === true && s.taktik.standort[0].geloest === 13);
    r.check("Das alte Ergebnis steht in der Liste Fortgeschritten, Einsteiger bleibt leer", (await page.$$eval("#stat-standort-liste-fortgeschritten li", (l) => l.length)) === 1 && (await page.$$eval("#stat-standort-liste-einsteiger li", (l) => l.length)) === 0);
    r.check("keine Skriptfehler (Umstellung)", page.__errors.length === 0, page.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
