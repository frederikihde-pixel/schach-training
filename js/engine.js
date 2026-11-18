// Hülle um die Schach-Engine (Stockfish, läuft als WebAssembly in einem Web Worker, UCI-Protokoll).
// - Die Engine wird erst beim ersten Gebrauch geladen, nicht beim App-Start.
// - Eine Anfrage zur Zeit: weitere Anfragen warten in einer Schlange.
// - Fehler werden als EngineError mit verständlichem Text gemeldet, nie als Absturz.
// Die Parser (parseInfo, parseOption, ...) sind reine Funktionen und laufen auch ohne Browser.

export const ENGINE_URL = new URL("../vendor/stockfish/stockfish-19-lite-single.js", import.meta.url).href;
export const UNAVAILABLE_TEXT = "Der Computergegner ist auf diesem Gerät nicht verfügbar.";
export const HASH_MB = 16;
const START_TIMEOUT_MS = 30000;
const SEARCH_GRACE_MS = 15000;

export class EngineError extends Error {
  constructor(message = UNAVAILABLE_TEXT, cause = null) {
    super(message);
    this.name = "EngineError";
    this.cause = cause;
  }
}

// "option name Skill Level type spin default 20 min 0 max 20" -> { name, type, default, min, max, vars }
export function parseOption(line) {
  const m = /^option name (.+?) type (\w+)(.*)$/.exec(line.trim());
  if (!m) return null;
  const opt = { name: m[1], type: m[2], default: null, min: null, max: null, vars: [] };
  const rest = m[3].trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === "default") {
      // Standardwert kann leer sein oder aus mehreren Wörtern bestehen (string-Optionen).
      const parts = [];
      while (i + 1 < rest.length && !["min", "max", "var"].includes(rest[i + 1])) parts.push(rest[++i]);
      opt.default = parts.join(" ");
    } else if (key === "min") opt.min = Number(rest[++i]);
    else if (key === "max") opt.max = Number(rest[++i]);
    else if (key === "var") opt.vars.push(rest[++i]);
  }
  if (opt.type === "spin" && opt.default !== null) opt.default = Number(opt.default);
  if (opt.type === "check") opt.default = opt.default === "true";
  return opt;
}

// "info depth 12 multipv 2 score cp -35 nodes ... pv e2e4 e7e5" -> { depth, multipv, score, pv } oder null.
// score: { type: "cp" | "mate", value } aus Sicht der Seite, die am Zug ist.
export function parseInfo(line) {
  if (!line.startsWith("info ") || !/ score /.test(line) || !/ pv /.test(line)) return null;
  const t = line.trim().split(/\s+/);
  const out = { depth: 0, multipv: 1, score: null, pv: [], bound: null };
  for (let i = 1; i < t.length; i++) {
    if (t[i] === "depth") out.depth = Number(t[++i]);
    else if (t[i] === "multipv") out.multipv = Number(t[++i]);
    else if (t[i] === "score") {
      const type = t[++i];
      const value = Number(t[++i]);
      if ((type === "cp" || type === "mate") && Number.isFinite(value)) out.score = { type, value };
      if (t[i + 1] === "lowerbound" || t[i + 1] === "upperbound") out.bound = t[++i];
    } else if (t[i] === "pv") {
      out.pv = t.slice(i + 1);
      break;
    }
  }
  return out.score ? out : null;
}

// "bestmove e2e4 ponder e7e5" -> { best, ponder }; "bestmove (none)" -> best: null
export function parseBestmove(line) {
  const m = /^bestmove (\S+)(?: ponder (\S+))?/.exec(line);
  if (!m) return null;
  return { best: m[1] === "(none)" || m[1] === "0000" ? null : m[1], ponder: m[2] || null };
}

// Bewertung als Zahl in Hundertstel-Bauerneinheiten (Centipawn), gedeckelt auf +/- cap.
// Matt in N zählt als cap (minus beim Gegner); je kürzer das Matt, desto näher an cap.
export function scoreToCp(score, cap = 1000) {
  if (!score) return 0;
  if (score.type === "cp") return Math.max(-cap, Math.min(cap, score.value));
  if (score.value === 0) return -cap;
  return score.value > 0 ? cap : -cap;
}

// Dreht eine Bewertung aus Sicht des Zugrechts in die Sicht von Weiß.
export function scoreForWhite(score, turn) {
  if (!score || turn === "w") return score;
  return { type: score.type, value: -score.value };
}

export function uciMove(move) {
  return move.from + move.to + (move.promotion || "");
}

export function parseUciMove(text) {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text || "");
  return m ? { from: m[1], to: m[2], promotion: m[3] } : null;
}

export function createEngine({ url = ENGINE_URL, makeWorker = (u) => new Worker(u) } = {}) {
  let worker = null;
  let starting = null; // Promise, solange die Engine startet oder läuft
  let options = null; // Map Name -> Option (nach dem Start)
  let onLine = null; // aktueller Zeilen-Empfänger
  let failCurrent = null; // bricht die laufende Anfrage ab
  let chain = Promise.resolve();
  let searching = false;
  let stopFlag = null; // markiert, dass der Abbruch von außen kam

  function send(cmd) {
    worker.postMessage(cmd);
  }

  function reset(err) {
    const w = worker;
    worker = null;
    starting = null;
    options = null;
    onLine = null;
    searching = false;
    try {
      if (w) w.terminate();
    } catch (e) {
      /* schon beendet */
    }
    if (failCurrent) {
      const f = failCurrent;
      failCurrent = null;
      f(err);
    }
  }

  // Wartet auf eine Zeile, die test() mit einem Wert beantwortet; sonst Zeitablauf.
  function waitLine(test, ms, what) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        onLine = null;
        failCurrent = null;
        reject(new EngineError(UNAVAILABLE_TEXT, new Error(`Zeitüberschreitung: ${what}`)));
        reset(new EngineError());
      }, ms);
      failCurrent = (e) => {
        clearTimeout(timer);
        reject(e);
      };
      onLine = (line) => {
        const r = test(line);
        if (r === undefined) return;
        clearTimeout(timer);
        onLine = null;
        failCurrent = null;
        resolve(r);
      };
    });
  }

  function start() {
    if (starting) return starting;
    const p = (async () => {
      try {
        worker = makeWorker(url);
      } catch (e) {
        worker = null;
        throw new EngineError(UNAVAILABLE_TEXT, e);
      }
      worker.onmessage = (ev) => {
        const text = typeof ev.data === "string" ? ev.data : ev.data && ev.data.data;
        if (typeof text !== "string") return;
        for (const line of text.split("\n")) if (onLine) onLine(line.trim());
      };
      worker.onerror = (ev) => reset(new EngineError(UNAVAILABLE_TEXT, ev && ev.message ? new Error(ev.message) : null));
      const found = new Map();
      const w = waitLine(
        (line) => {
          const o = line.startsWith("option ") ? parseOption(line) : null;
          if (o) found.set(o.name, o);
          if (line === "uciok") return found;
        },
        START_TIMEOUT_MS,
        "uci",
      );
      send("uci");
      options = await w;
      // Kleiner Speicher, ein Thread. Die Bereiche kommen aus der Engine selbst.
      applyOption("Hash", HASH_MB, true);
      applyOption("Threads", 1, true);
      const ready = waitLine((l) => (l === "readyok" ? true : undefined), START_TIMEOUT_MS, "isready");
      send("isready");
      await ready;
    })();
    starting = p.catch((e) => {
      const err = e instanceof EngineError ? e : new EngineError(UNAVAILABLE_TEXT, e);
      reset(err);
      throw err;
    });
    return starting;
  }

  function applyOption(name, value, quiet = false) {
    const o = options && options.get(name);
    if (!o) {
      if (quiet) return null;
      throw new EngineError(`Die Engine kennt die Option "${name}" nicht.`);
    }
    let v = value;
    if (o.type === "spin") v = Math.max(o.min, Math.min(o.max, Math.round(Number(value))));
    if (o.type === "check") v = value ? "true" : "false";
    send(`setoption name ${name} value ${v}`);
    return v;
  }

  function enqueue(job) {
    const run = chain.then(job, job);
    chain = run.catch(() => {});
    return run;
  }

  return {
    // Lädt die Engine (nur beim ersten Aufruf) und liefert die gemeldeten Optionen.
    async init() {
      await start();
      return options;
    },
    get ready() {
      return !!(starting && options);
    },
    get busy() {
      return searching;
    },
    // Bereich einer Option aus der Engine (z. B. UCI_Elo: min und max).
    getOption(name) {
      return options ? options.get(name) || null : null;
    },
    // Setzt Optionen; Zahlen werden auf den von der Engine gemeldeten Bereich begrenzt.
    setOptions(values) {
      return enqueue(async () => {
        await start();
        const used = {};
        for (const [name, value] of Object.entries(values)) used[name] = applyOption(name, value);
        return used;
      });
    },
    newGame() {
      return enqueue(async () => {
        await start();
        send("ucinewgame");
        const ready = waitLine((l) => (l === "readyok" ? true : undefined), START_TIMEOUT_MS, "isready");
        send("isready");
        await ready;
      });
    },
    // Sucht in einer Stellung. { fen, moves (UCI), movetime (ms) | depth | nodes, multipv, searchmoves }
    // Ergebnis: { best, ponder, lines: [{ multipv, depth, score, pv }], stopped }
    search({ fen = "startpos", moves = [], movetime = null, depth = null, nodes = null, multipv = 1, searchmoves = null } = {}) {
      return enqueue(async () => {
        await start();
        applyOption("MultiPV", multipv);
        send("isready");
        await waitLine((l) => (l === "readyok" ? true : undefined), START_TIMEOUT_MS, "isready");
        const pos = fen === "startpos" ? "position startpos" : `position fen ${fen}`;
        send(moves.length ? `${pos} moves ${moves.join(" ")}` : pos);
        let go = "go";
        if (searchmoves && searchmoves.length) go += ` searchmoves ${searchmoves.join(" ")}`;
        if (movetime) go += ` movetime ${Math.round(movetime)}`;
        else if (depth) go += ` depth ${depth}`;
        else if (nodes) go += ` nodes ${nodes}`;
        else go += " movetime 1000";
        const lines = new Map();
        let stoppedByUser = false;
        const budget = (movetime || 5000) + SEARCH_GRACE_MS;
        searching = true;
        const result = waitLine(
          (line) => {
            const info = line.startsWith("info ") ? parseInfo(line) : null;
            if (info && !info.bound) {
              const old = lines.get(info.multipv);
              if (!old || info.depth >= old.depth) lines.set(info.multipv, info);
            }
            const bm = parseBestmove(line);
            if (bm) return { ...bm, stopped: stoppedByUser };
          },
          budget + (depth && !movetime ? 60000 : 0),
          "go",
        );
        stopFlag = () => {
          stoppedByUser = true;
        };
        send(go);
        try {
          const r = await result;
          return { best: r.best, ponder: r.ponder, stopped: r.stopped, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
        } finally {
          searching = false;
          stopFlag = null;
        }
      });
    },
    // Bricht die laufende Suche ab; die Anfrage endet dann mit dem bisher besten Zug.
    stop() {
      if (worker && searching) {
        if (stopFlag) stopFlag();
        send("stop");
      }
    },
    // Beendet den Worker. Eine spätere Anfrage startet die Engine neu.
    terminate() {
      reset(new EngineError("Der Computergegner wurde beendet."));
    },
  };
}

// Gemeinsame Engine der App (lädt erst beim ersten Gebrauch).
let shared = null;
export function getEngine() {
  if (!shared) shared = createEngine();
  return shared;
}
