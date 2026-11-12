// Taktik-Trainer: Rätsel lösen, falsch lösen und nachspielen, Matt-in-1-Alternative, Einstufung,
// Sitzung, Wiederholungsplanung mit verschobenem Datum. 390 px, Touch-Emulation, echte Rätsel-Daten.
const fs = require("fs");
const path = require("path");
const { Chess } = (() => { try { return require("chess.js"); } catch (e) { return {}; } })();
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, solveCurrent, reporter, ROOT } = require("./lib.cjs");

const loadBand = (b) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/puzzles/band-${b}.json`), "utf8")).raetsel;

(async () => {
  const r = reporter("Taktik-Trainer");
  const { server, url } = await startServer();
  const browser = await launch();

  async function fresh(extra = {}) {
    const { context, page } = await newPage(browser, extra);
    return { context, page };
  }
  const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get().taktik)));
  const meldung = (page) => page.textContent("#lauf-meldung");
  async function waitMeldung(page, re, timeout = 25000) {
    await page.waitForFunction((src) => new RegExp(src).test(document.getElementById("lauf-meldung").textContent), re.source, { timeout });
  }
  async function setStrength(page, s, eingestuft = true) {
    await page.evaluate(async ([s, e]) => {
      const { store } = await import("./js/storage.js");
      store.update((d) => { d.taktik.staerke = s; d.taktik.eingestuft = e; });
    }, [s, eingestuft]);
  }
  async function start(page, hash = "#/taktik") {
    await page.goto(url + "index.html" + hash);
    await page.waitForTimeout(500);
  }

  // ---- Rätsel richtig lösen (Einstufung, erstes Rätsel) ----
  {
    const { page } = await fresh();
    await start(page);
    r.check("Erststart: Einstufung wird angeboten, Training noch nicht", await page.evaluate(() => !document.getElementById("taktik-einstufung").hidden && document.getElementById("taktik-training").hidden));
    await page.click("#btn-einstufung");
    await page.waitForSelector("#taktik-lauf:not([hidden])");
    const { cur, orientation } = await solveCurrent(page);
    await waitMeldung(page, /Richtig/);
    r.check("Rätsel richtig gelöst: Meldung und Weiter-Knopf", (await meldung(page)) === "Richtig." && (await page.isVisible("#btn-weiter")));
    r.check("Seite am Zug oben angezeigt, Brett aus Sicht des Spielers", (await page.textContent("#lauf-seite")) === (orientation === "white" ? "Weiß am Zug" : "Schwarz am Zug") && (await page.getAttribute("#taktik-board", "class")).includes(`orientation-${orientation}`));
    r.check("Fortschrittsanzeige 'Rätsel 1 von 10'", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 10");
    const t = await state(page);
    r.check("Versuch gespeichert (Zähler, gesehen)", t.versuche.length === 1 && t.versuche[0].ok === true && t.gesehen[cur.puzzle.id] === 1 && t.anzahl === 1);
    r.check("Gelöstes neues Rätsel kommt nicht in die Wiederholung", Object.keys(t.karten).length === 0);
    await page.click("#btn-weiter");
    await page.waitForFunction(() => /Rätsel 2 von 10/.test(document.getElementById("lauf-fortschritt").textContent));
    r.check("Weiter zeigt das nächste Rätsel", true);
    r.check("keine Skriptfehler (Rätsel lösen)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Falsch lösen, Lösung sehen, nachspielen ----
  {
    const { page } = await fresh();
    await start(page);
    await page.click("#btn-einstufung");
    await page.waitForSelector("#taktik-lauf:not([hidden])");
    const cur = await currentPuzzle(page);
    const orientation = await waitForSide(page);
    // absichtlich falscher, aber legaler Zug: irgendein Zug, der nicht der richtige ist
    const wrong = await page.evaluate(async ([fen, expected]) => {
      const { Chess } = await import("./vendor/chess.js/chess.js");
      const g = new Chess(fen);
      g.move({ from: expected.split(" ")[0].slice(0, 2), to: expected.split(" ")[0].slice(2, 4), promotion: expected.split(" ")[0][4] });
      const right = expected.split(" ")[1];
      for (const m of g.moves({ verbose: true })) {
        const uci = m.from + m.to + (m.promotion || "");
        if (uci === right || m.promotion) continue;
        const probe = new Chess(g.fen());
        probe.move(m.san);
        if (!probe.isCheckmate()) return uci;
      }
      return null;
    }, [cur.puzzle.fen, cur.puzzle.zuege]);
    await playUci(page, wrong, orientation);
    await waitMeldung(page, /Nicht gelöst/);
    r.check("Falscher Zug: 'Nicht gelöst', Rätsel endet", /Nicht gelöst/.test(await meldung(page)));
    await page.waitForTimeout(1200);
    const t1 = await state(page);
    r.check("Fehler zählt (nicht gelöst) und Rätsel kommt in die Wiederholung (Stufe 1, morgen)", t1.versuche[0].ok === false && t1.karten[cur.puzzle.id] && t1.karten[cur.puzzle.id].stufe === 1);
    // Position zurückgenommen: die Figur steht wieder auf dem Ausgangsfeld
    await waitMeldung(page, /Jetzt spiele die Zugfolge selbst nach/, 40000);
    r.check("Lösung wurde Zug für Zug gezeigt, danach Nachspielen", /selbst nach/.test(await meldung(page)));
    r.check("Weiter erst nach dem Nachspielen", !(await page.isVisible("#btn-weiter")));
    // einmal falsch beim Nachspielen: springt zurück, zählt nicht
    const moves = cur.puzzle.zuege.split(" ");
    await playUci(page, wrong, orientation);
    await page.waitForTimeout(500);
    r.check("Falscher Zug beim Nachspielen wird nicht gewertet", (await state(page)).versuche.length === 1);
    for (let i = 1; i < moves.length; i += 2) {
      await playUci(page, moves[i], orientation);
      await page.waitForTimeout(i === moves.length - 1 ? 300 : 900);
    }
    await waitMeldung(page, /Geschafft/);
    r.check("Nach dem Nachspielen: Weiter", await page.isVisible("#btn-weiter"));
    r.check("keine Skriptfehler (Fehler und Nachspielen)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Matt-in-1-Alternative wird akzeptiert ----
  {
    // Ein echtes Rätsel suchen, in dem es neben dem gespeicherten Mattzug einen zweiten Mattzug gibt.
    const { Chess: C } = await import("../../vendor/chess.js/chess.js");
    let found = null;
    for (const b of [600, 700, 800, 900, 1000, 1100, 1200]) {
      for (const [id, fen, zuege, rating, themen] of loadBand(b)) {
        const moves = zuege.split(" ");
        if (moves.length !== 2) continue;
        const g = new C(fen);
        g.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] });
        const mates = g.moves({ verbose: true }).filter((m) => { const p = new C(g.fen()); p.move(m); return p.isCheckmate(); });
        if (mates.length >= 2) {
          const alt = mates.map((m) => m.from + m.to + (m.promotion || "")).find((u) => u !== moves[1] && !u[4]);
          if (alt) { found = { puzzle: { id, fen, zuege, rating, themen }, alt }; break; }
        }
      }
      if (found) break;
    }
    r.check("Testdaten: Rätsel mit zweitem Mattzug gefunden", !!found);
    if (found) {
      const { page } = await fresh();
      await start(page);
      await setStrength(page, 1000);
      // Rätsel direkt in eine Sitzung legen
      await page.evaluate(async (p) => {
        const { store } = await import("./js/storage.js");
        store.update((d) => { d.taktik.aktiv = { typ: "sitzung", plan: [{ art: "neu", puzzle: p }], index: 0, ergebnisse: [], filter: "", start: new Date().toISOString() }; });
      }, found.puzzle);
      await page.reload();
      await page.waitForTimeout(500);
      await page.click("#btn-fortsetzen");
      const orientation = await waitForSide(page);
      await playUci(page, found.alt, orientation);
      await waitMeldung(page, /Richtig/);
      r.check(`Matt-in-1-Alternative (${found.alt} statt ${found.puzzle.zuege.split(" ")[1]}) gilt als richtig`, /Richtig/.test(await meldung(page)));
      r.check("Alternative zählt als gelöst", (await state(page)).versuche[0].ok === true);
    }
  }

  // ---- Einstufung komplett mit simulierten Antworten ----
  for (const skill of [900, 1500, 2100]) {
    const { page } = await fresh();
    await start(page);
    await page.click("#btn-einstufung");
    await page.waitForSelector("#taktik-lauf:not([hidden])");
    for (let i = 0; i < 10; i++) {
      const cur = await currentPuzzle(page);
      const orientation = await waitForSide(page);
      if (cur.puzzle.rating <= skill) {
        const moves = cur.puzzle.zuege.split(" ");
        for (let k = 1; k < moves.length; k += 2) { await playUci(page, moves[k], orientation); await page.waitForTimeout(k === moves.length - 1 ? 300 : 900); }
        await waitMeldung(page, /Richtig/);
      } else {
        // absichtlich falsch: irgendein legaler Zug, der nicht der richtige ist
        const wrong = await page.evaluate(async ([fen, zuege]) => {
          const { Chess } = await import("./vendor/chess.js/chess.js");
          const mv = zuege.split(" "); const g = new Chess(fen);
          g.move({ from: mv[0].slice(0, 2), to: mv[0].slice(2, 4), promotion: mv[0][4] });
          for (const m of g.moves({ verbose: true })) { const u = m.from + m.to + (m.promotion || ""); if (u !== mv[1] && !m.promotion) { const p = new Chess(g.fen()); p.move(m); if (!p.isCheckmate()) return u; } }
        }, [cur.puzzle.fen, cur.puzzle.zuege]);
        await playUci(page, wrong, orientation);
        await waitMeldung(page, /Jetzt spiele die Zugfolge selbst nach/, 60000);
        const mv = cur.puzzle.zuege.split(" ");
        for (let k = 1; k < mv.length; k += 2) { await playUci(page, mv[k], orientation); await page.waitForTimeout(k === mv.length - 1 ? 300 : 900); }
        await waitMeldung(page, /Geschafft/);
      }
      await page.click("#btn-weiter");
      if (i < 9) await page.waitForFunction((n) => new RegExp(`Rätsel ${n} von 10`).test(document.getElementById("lauf-fortschritt").textContent), i + 2);
    }
    await page.waitForSelector("#taktik-zusammenfassung:not([hidden])", { timeout: 10000 });
    const t = await state(page);
    r.check(`Einstufung bei Stärke ${skill}: Schätzung ${t.staerke} im erwarteten Band`, t.eingestuft && Math.abs(t.staerke - skill) <= 150, String(t.staerke));
    r.check(`Einstufung ${skill}: Zusammenfassung nennt Stärke`, /Geschätzte Taktikstärke/.test(await page.innerText("#zus-fakten")));
    r.check(`Einstufung ${skill}: 10 Versuche, Sitzung und Verlauf gespeichert`, t.versuche.length === 10 && t.sitzungen.length === 1 && t.verlauf.length === 1 && t.anzahl === 10);
    if (skill === 1500) {
      await page.click("#btn-zus-zurueck");
      r.check("Nach der Einstufung: Taktikstärke wird ruhig als Zahl angezeigt", /^Taktikstärke: \d+$/.test(await page.textContent("#taktik-staerke")));
      r.check("Nach der Einstufung: Training bereit, Einstufung weg", await page.evaluate(() => document.getElementById("taktik-einstufung").hidden && !document.getElementById("taktik-training").hidden));
    }
    r.check(`keine Skriptfehler (Einstufung ${skill})`, page.__errors.length === 0, page.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
