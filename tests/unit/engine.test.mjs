// Prüft die Engine-Hülle mit einem künstlichen Worker (keine echte Engine nötig).
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, parseOption, parseInfo, parseBestmove, scoreToCp, scoreForWhite, EngineError, UNAVAILABLE_TEXT } from "../../js/engine.js";

test("parseOption: Zahl mit Bereich, Name mit Leerzeichen, Haken, Text", () => {
  assert.deepEqual(parseOption("option name UCI_Elo type spin default 1320 min 1320 max 3190"), { name: "UCI_Elo", type: "spin", default: 1320, min: 1320, max: 3190, vars: [] });
  assert.equal(parseOption("option name Skill Level type spin default 20 min 0 max 20").name, "Skill Level");
  assert.equal(parseOption("option name UCI_LimitStrength type check default false").default, false);
  assert.equal(parseOption("option name EvalFile type string default nn-61e7af4bb97d.nnue").default, "nn-61e7af4bb97d.nnue");
  assert.equal(parseOption("option name Clear Hash type button").type, "button");
  assert.equal(parseOption("nonsense"), null);
});

test("parseInfo: Centipawn, Matt, MultiPV, Grenzen", () => {
  const a = parseInfo("info depth 12 seldepth 15 multipv 2 score cp -35 nodes 1000 nps 50000 time 20 pv e7e5 g1f3");
  assert.equal(a.depth, 12);
  assert.equal(a.multipv, 2);
  assert.deepEqual(a.score, { type: "cp", value: -35 });
  assert.deepEqual(a.pv, ["e7e5", "g1f3"]);
  const m = parseInfo("info depth 8 multipv 1 score mate 3 nodes 5 pv d1h5");
  assert.deepEqual(m.score, { type: "mate", value: 3 });
  assert.equal(parseInfo("info depth 8 multipv 1 score cp 10 lowerbound nodes 5 pv d1h5").bound, "lowerbound");
  assert.equal(parseInfo("info string NNUE evaluation using nn.nnue"), null);
  assert.equal(parseInfo("info depth 1 currmove e2e4 currmovenumber 1"), null);
});

test("parseBestmove", () => {
  assert.deepEqual(parseBestmove("bestmove e2e4 ponder e7e5"), { best: "e2e4", ponder: "e7e5" });
  assert.deepEqual(parseBestmove("bestmove (none)"), { best: null, ponder: null });
  assert.equal(parseBestmove("readyok"), null);
});

test("scoreToCp deckelt; Matt zählt als Grenze; scoreForWhite dreht", () => {
  assert.equal(scoreToCp({ type: "cp", value: 4000 }), 1000);
  assert.equal(scoreToCp({ type: "cp", value: -4000 }), -1000);
  assert.equal(scoreToCp({ type: "cp", value: 120 }), 120);
  assert.equal(scoreToCp({ type: "mate", value: 2 }), 1000);
  assert.equal(scoreToCp({ type: "mate", value: -2 }), -1000);
  assert.deepEqual(scoreForWhite({ type: "cp", value: 50 }, "b"), { type: "cp", value: -50 });
  assert.deepEqual(scoreForWhite({ type: "cp", value: 50 }, "w"), { type: "cp", value: 50 });
});

// Künstlicher Worker, der UCI beantwortet.
function fakeWorker({ silent = false, throwOnCreate = false } = {}) {
  const log = [];
  const made = [];
  const makeWorker = () => {
    if (throwOnCreate) throw new Error("kein Worker");
    const w = {
      terminated: false,
      postMessage(cmd) {
        log.push(cmd);
        if (silent) return;
        const say = (t) => setTimeout(() => w.onmessage && w.onmessage({ data: t }), 0);
        if (cmd === "uci") {
          for (const l of ["id name Fake", "option name Hash type spin default 16 min 1 max 1024", "option name Threads type spin default 1 min 1 max 1", "option name MultiPV type spin default 1 min 1 max 256", "option name Skill Level type spin default 20 min 0 max 20", "uciok"]) say(l);
        } else if (cmd === "isready") say("readyok");
        else if (cmd.startsWith("go")) {
          say("info depth 5 multipv 1 score cp 30 pv e2e4 e7e5");
          say("info depth 6 multipv 1 score cp 35 pv e2e4 e7e5");
          say("info depth 6 multipv 2 score cp 10 pv d2d4 d7d5");
          if (!cmd.includes("infinite")) say("bestmove e2e4 ponder e7e5");
        } else if (cmd === "stop") say("bestmove d2d4");
      },
      terminate() {
        w.terminated = true;
      },
    };
    made.push(w);
    return w;
  };
  return { makeWorker, log, made };
}

test("Start lädt erst beim ersten Gebrauch, liest Optionen und setzt Hash 16 und Threads 1", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  assert.equal(f.made.length, 0, "vor dem ersten Gebrauch kein Worker");
  const opts = await e.init();
  assert.equal(f.made.length, 1);
  assert.equal(opts.get("Skill Level").max, 20);
  assert.ok(f.log.includes("setoption name Hash value 16"));
  assert.ok(f.log.includes("setoption name Threads value 1"));
  await e.init();
  assert.equal(f.made.length, 1, "nur ein Worker");
});

test("search: Stellung, MultiPV, beste Linien je Index, Bestzug", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  const r = await e.search({ fen: "startpos", moves: ["e2e4"], movetime: 100, multipv: 2 });
  assert.equal(r.best, "e2e4");
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].score.value, 35, "tiefste Zeile gewinnt");
  assert.ok(f.log.includes("position startpos moves e2e4"));
  assert.ok(f.log.includes("go movetime 100"));
  assert.ok(f.log.includes("setoption name MultiPV value 2"));
});

test("Zahlen werden auf den Bereich der Engine begrenzt", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  const used = await e.setOptions({ "Skill Level": 99 });
  assert.equal(used["Skill Level"], 20);
  await assert.rejects(e.setOptions({ Gibtsnicht: 1 }), EngineError);
});

test("eine Anfrage zur Zeit: die zweite wartet auf die erste", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  const a = e.search({ movetime: 50 });
  const b = e.search({ movetime: 60 });
  await Promise.all([a, b]);
  const goes = f.log.filter((c) => c.startsWith("go"));
  assert.deepEqual(goes, ["go movetime 50", "go movetime 60"]);
  assert.ok(f.log.indexOf("go movetime 60") > f.log.indexOf("go movetime 50"));
});

test("stop beendet eine laufende Suche mit dem bisherigen Ergebnis", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  const p = e.search({ depth: 99 });
  // depth ohne movetime: fake antwortet sofort; für den Stop-Test hängen wir eine "infinite"-Suche an.
  await p;
  const w = f.made[0];
  const orig = w.postMessage.bind(w);
  w.postMessage = (cmd) => (cmd.startsWith("go") ? f.log.push(cmd) : orig(cmd));
  const q = e.search({ movetime: 100000 });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(e.busy, true);
  e.stop();
  const r = await q;
  assert.equal(r.best, "d2d4");
  assert.equal(r.stopped, true);
  assert.equal(e.busy, false);
});

test("kein Worker möglich: verständliche Meldung, kein Absturz", async () => {
  const f = fakeWorker({ throwOnCreate: true });
  const e = createEngine({ makeWorker: f.makeWorker });
  await assert.rejects(e.init(), (err) => err instanceof EngineError && err.message === UNAVAILABLE_TEXT);
  await assert.rejects(e.search({ movetime: 10 }), (err) => err.message === UNAVAILABLE_TEXT);
});

test("Engine antwortet nie: Zeitablauf wird gemeldet (kurze Frist über Fake-Timer nicht nötig: terminate)", async () => {
  const f = fakeWorker({ silent: true });
  const e = createEngine({ makeWorker: f.makeWorker });
  const p = e.init();
  setTimeout(() => e.terminate(), 20);
  await assert.rejects(p, EngineError);
  assert.equal(f.made[0].terminated, true);
});

test("nach terminate startet die nächste Anfrage die Engine neu", async () => {
  const f = fakeWorker();
  const e = createEngine({ makeWorker: f.makeWorker });
  await e.init();
  e.terminate();
  await e.init();
  assert.equal(f.made.length, 2);
});
