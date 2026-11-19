// Misst die Analysedauer je Stellung in Chromium mit der echten Engine und schätzt die Dauer einer Partie mit
// 40 Zügen (80 Stellungen). Lang (etwa 3 Minuten). Schreibt tests/analyse-messung.json.
// Aufruf: node tests/e2e/analyse-dauer.cjs
const fs = require("fs");
const path = require("path");
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Analysedauer");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html");
  const res = await page.evaluate(async () => {
    const { getEngine, uciMove } = await import("./js/engine.js");
    const { spieleZug } = await import("./js/stufen.js");
    const { Chess } = await import("./vendor/chess.js/chess.js");
    const { leseEingabe, stellungen, analysiere, bewerteZuege, ENGINE_OPTIONEN } = await import("./js/analyse.js");
    const e = getEngine();
    const t0 = performance.now();
    await e.init();
    const startMs = Math.round(performance.now() - t0);

    // Beispielpartie: Stufe 5 gegen Stufe 5, 80 Halbzüge (40 Züge) mit festem Zufallsstartwert
    let a = 4242;
    const rng = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let zuege = [];
    for (let versuch = 0; versuch < 6 && zuege.length < 80; versuch++) {
      zuege = [];
      const c = new Chess();
      await e.newGame();
      while (!c.isGameOver() && zuege.length < 80) {
        const legal = c.moves({ verbose: true }).map(uciMove);
        const z = (await spieleZug(e, 5, { fen: "startpos", moves: zuege, legal }, rng)).zug;
        c.move({ from: z.slice(0, 2), to: z.slice(2, 4), promotion: z[4] });
        zuege.push(z);
      }
    }
    const eingabe = leseEingabe({ zuege, farbe: "w" });
    const pos = stellungen(eingabe);
    const out = { halbzuege: zuege.length, stellungen: pos.length, startMs, varianten: {} };

    // Zeit je Suchzeit: gesamte Analyse mit allen Stellungen
    for (const movetime of [150, 300, 600]) {
      const zeiten = [];
      let last = performance.now();
      const erg = await analysiere(eingabe, { engine: e, movetime, onPosition: () => { const n = performance.now(); zeiten.push(n - last); last = n; } });
      const gesamt = zeiten.reduce((s, x) => s + x, 0);
      const tiefe = erg.ergebnisse.filter((x) => !x.ende).map((x) => x.lines.length);
      const b = bewerteZuege(eingabe, erg.ergebnisse);
      out.varianten["movetime" + movetime] = {
        gesamtSek: +(gesamt / 1000).toFixed(1),
        proStellungMs: Math.round(gesamt / zeiten.length),
        langsteMs: Math.round(Math.max(...zeiten)),
        patzer: b.summe.patzer, fehler: b.summe.fehler, chancen: b.summe.chancen,
      };
    }
    // Feste Tiefe (rechnerabhängig): Tiefe 10 und 12
    for (const depth of [10, 12]) {
      const zeiten = [];
      for (const p of pos) {
        if (new Chess(p.fen).isGameOver()) continue;
        const t = performance.now();
        await e.search({ fen: p.fen, depth, multipv: 1, options: ENGINE_OPTIONEN });
        zeiten.push(performance.now() - t);
      }
      const gesamt = zeiten.reduce((s, x) => s + x, 0);
      out.varianten["tiefe" + depth] = { gesamtSek: +(gesamt / 1000).toFixed(1), proStellungMs: Math.round(gesamt / zeiten.length), langsteMs: Math.round(Math.max(...zeiten)) };
    }
    // erreichte Tiefe bei 300 ms: aus einer Stichprobe von Stellungen
    const tiefen = [];
    const npsProbe = [];
    for (const p of pos.filter((_, i) => i % 8 === 0)) {
      if (new Chess(p.fen).isGameOver()) continue;
      const rr = await e.search({ fen: p.fen, movetime: 300, multipv: 1, options: ENGINE_OPTIONEN });
      tiefen.push(rr.lines[0].depth);
    }
    out.tiefeBei300ms = { mittel: +(tiefen.reduce((s, x) => s + x, 0) / tiefen.length).toFixed(1), min: Math.min(...tiefen), max: Math.max(...tiefen) };
    void npsProbe;
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(__dirname, "../analyse-messung.json"), JSON.stringify(res, null, 1));
  const v300 = res.varianten.movetime300;
  r.check("Beispielpartie hat 40 Züge (80 Halbzüge, 81 Stellungen)", res.halbzuege >= 78, String(res.halbzuege));
  r.check("Analyse mit 0,3 s je Stellung dauert in Chromium unter 60 Sekunden", v300.gesamtSek < 60, v300.gesamtSek + " s");
  await browser.close();
  server.close();
  r.done();
})();
