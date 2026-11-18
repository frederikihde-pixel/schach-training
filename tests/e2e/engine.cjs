// Echte Engine im Chromium: lädt erst bei Gebrauch, antwortet legal, Optionen, Abbruch, offline.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Engine");
  const { server, hits, url } = await startServer();
  const browser = await launch();
  const { context, page } = await newPage(browser);
  await page.goto(url + "index.html");
  await page.waitForTimeout(800);
  const loaded = () => Object.keys(hits).filter((k) => /stockfish/.test(k));
  r.check("Beim App-Start wird die Engine nicht geladen", loaded().length === 0, loaded().join(","));

  const wasm = await page.request.get(url + "vendor/stockfish/stockfish-19-lite-single.wasm");
  r.check("Dateityp der .wasm-Datei ist application/wasm", (wasm.headers()["content-type"] || "").startsWith("application/wasm"));
  delete hits["/vendor/stockfish/stockfish-19-lite-single.wasm"];

  const res = await page.evaluate(async () => {
    const { getEngine, scoreToCp } = await import("./js/engine.js");
    const { Chess } = await import("./vendor/chess.js/chess.js");
    const e = getEngine();
    const t0 = performance.now();
    const opts = await e.init();
    const startMs = Math.round(performance.now() - t0);
    const o = (n) => e.getOption(n);
    const info = { startMs, elo: o("UCI_Elo"), skill: o("Skill Level"), hash: o("Hash"), multipv: o("MultiPV"), limit: !!o("UCI_LimitStrength"), threads: o("Threads") };
    // legale Antwort aus der Startstellung
    const a = await e.search({ movetime: 300 });
    const c = new Chess();
    const m = a.best;
    let legalStart = false;
    try { c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); legalStart = true; } catch (err) {}
    // Matt in 1 (Weiß: Dh5-f7 matt, "Schäferzug"-Stellung)
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const b = await e.search({ fen, depth: 8, multipv: 3 });
    // Stellung ohne legalen Zug (Matt): bestmove none
    const mated = await e.search({ fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", movetime: 100 });
    // Abbruch
    const long = e.search({ movetime: 20000 });
    await new Promise((x) => setTimeout(x, 400));
    const tStop = performance.now();
    e.stop();
    const stopped = await long;
    return { info, startBest: a.best, legalStart, mateBest: b.best, mateLines: b.lines.map((l) => ({ score: l.score, pv: l.pv.slice(0, 2) })), matedBest: mated.best, stopped: stopped.stopped, stopMs: Math.round(performance.now() - tStop), stoppedBest: stopped.best };
  });
  console.log(JSON.stringify(res.info));
  r.check("Engine startet (Zeit in ms im Detail)", res.info.startMs < 8000, String(res.info.startMs));
  r.check("Optionen ausgelesen: UCI_Elo 1320 bis 3190, Skill Level 0 bis 20, MultiPV bis 256, Threads 1", res.info.elo && res.info.elo.min === 1320 && res.info.elo.max === 3190 && res.info.skill.min === 0 && res.info.skill.max === 20 && res.info.multipv.max === 256 && res.info.threads.max === 1 && res.info.limit);
  r.check("Hash ist 16 MB gesetzt (Option vorhanden)", !!res.info.hash);
  r.check("Antwort aus der Startstellung ist ein legaler Zug", res.legalStart, res.startBest);
  r.check("Matt in 1 wird gefunden (Dxf7), mit Matt-Bewertung", res.mateBest === "h5f7" && res.mateLines[0].score.type === "mate" && res.mateLines[0].score.value === 1, JSON.stringify(res.mateLines[0]));
  r.check("MultiPV 3 liefert drei Linien", res.mateLines.length === 3);
  r.check("Matte Stellung: kein Zug (best = null)", res.matedBest === null);
  r.check("Abbruch mit stop: Antwort kommt schnell, mit Zug", res.stopped === true && res.stopMs < 1000 && !!res.stoppedBest, `${res.stopMs} ms`);
  r.check("Engine-Dateien wurden erst jetzt geladen", loaded().length >= 2, loaded().join(","));

  // offline nach dem ersten Gebrauch (Service Worker hat die Dateien abgelegt)
  await page.reload();
  await page.waitForTimeout(800);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(800);
  const off = await page.evaluate(async () => {
    const { createEngine } = await import("./js/engine.js");
    const e = createEngine();
    try {
      await e.init();
      const a = await e.search({ movetime: 200 });
      e.terminate();
      return { ok: true, best: a.best };
    } catch (err) {
      return { ok: false, err: err.message };
    }
  });
  r.check("Offline: Engine startet aus dem Zwischenspeicher", off.ok && /^[a-h][1-8][a-h][1-8]/.test(off.best || ""), JSON.stringify(off));
  await context.setOffline(false);

  // Meldung statt Absturz, wenn die Engine-Datei fehlt
  const bad = await page.evaluate(async () => {
    const { createEngine } = await import("./js/engine.js");
    const e = createEngine({ url: new URL("./vendor/stockfish/gibt-es-nicht.js", location.href).href });
    try { await e.init(); return "kein Fehler"; } catch (err) { return err.message; }
  });
  r.check("Fehlende Engine-Datei: verständliche Meldung", bad === "Der Computergegner ist auf diesem Gerät nicht verfügbar.", bad);
  r.check("Keine Seitenfehler", page.__errors.length === 0, page.__errors.join(" | "));
  await browser.close();
  server.close();
  r.done();
})();
