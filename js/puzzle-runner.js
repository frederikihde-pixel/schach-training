// Spielt ein Rätsel auf einem Brett ab. Die Regeln kommen aus chess.js, Chessground zeigt nur an.
//
// Ablauf: Der erste Zug in "zuege" ist der Zug des Gegners und wird automatisch gespielt. Danach
// zieht der Spieler. Ein richtiger Zug löst die Gegnerantwort aus. Ein falscher Zug wird kurz
// gezeigt, dann zurückgenommen, und das Rätsel gilt als nicht gelöst. Jeder Zug, der sofort Matt
// setzt, gilt als richtig, auch wenn er nicht der gespeicherte ist. Es gibt keine Hinweise.

import { Chess } from "../vendor/chess.js/chess.js";
import { Chessground } from "../vendor/chessground/chessground.min.js";
import { askPromotion } from "./ui/promotion.js";
import { toColor, computeDests, keepBoundsFresh } from "./ui/board-util.js";
import { splitMoves } from "./puzzles.js";
import { MS_CAP } from "./stats.js";

export class Cancelled extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAUSE_OPPONENT = 450; // bis der Gegner antwortet
const PAUSE_WRONG = 800; // so lange bleibt ein falscher Zug sichtbar
const PAUSE_SOLUTION = 1000; // zwischen den Zügen der gezeigten Lösung

const parseUci = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });

// Zeit, in der die Seite sichtbar ist; Pausen im Hintergrund zählen nicht.
function createTimer() {
  let acc = 0;
  let last = null;
  let running = false;
  const pause = () => {
    if (last !== null) {
      acc += performance.now() - last;
      last = null;
    }
  };
  const resume = () => {
    if (running && last === null && !document.hidden) last = performance.now();
  };
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
  return {
    start() {
      acc = 0;
      last = null;
      running = true;
      resume();
    },
    stop() {
      pause();
      running = false;
      return Math.min(Math.round(acc), MS_CAP);
    },
  };
}

export function createRunner(boardEl) {
  let cg = null;
  let game = null;
  let runId = 0;
  let pending = null; // { resolve, reject } für den nächsten Zug des Spielers
  let solverColor = "white";
  const timer = createTimer();

  function ensureBoard() {
    if (cg) return;
    cg = Chessground(boardEl, {
      orientation: "white",
      coordinates: true,
      blockTouchScroll: true,
      disableContextMenu: true,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
      movable: { free: false, color: undefined, showDests: true, events: { after: onBoardMove } },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      premovable: { enabled: false },
    });
    keepBoundsFresh(boardEl, () => cg);
  }

  function render({ interactive = false, lastMove, animate = true } = {}) {
    // Chessground merkt sich die Brettposition. Verschiebt sich das Brett auf der Seite
    // (z. B. weil über dem Brett Text erscheint), würde es sonst das falsche Feld treffen.
    cg.state.dom.bounds.clear();
    const turnColor = toColor(game.turn());
    cg.set({
      fen: game.fen(),
      turnColor,
      check: game.isCheck() ? turnColor : false,
      lastMove,
      animation: { enabled: animate },
      movable: { color: interactive ? solverColor : undefined, dests: interactive ? computeDests(game) : new Map() },
    });
  }

  function onBoardMove(orig, dest) {
    if (!pending) return;
    const legal = game.moves({ verbose: true }).filter((m) => m.from === orig && m.to === dest);
    const { resolve } = pending;
    if (legal.length === 0) {
      render({ interactive: true });
      return;
    }
    if (legal.some((m) => m.promotion)) {
      cg.set({ movable: { color: undefined } });
      askPromotion(solverColor, (piece) => {
        pending = null;
        resolve({ from: orig, to: dest, promotion: piece });
      });
      return;
    }
    pending = null;
    resolve({ from: orig, to: dest });
  }

  function userMove(id) {
    return new Promise((resolve, reject) => {
      if (id !== runId) return reject(new Cancelled());
      pending = { resolve, reject };
    });
  }

  function check(id) {
    if (id !== runId) throw new Cancelled();
  }

  function play(uci) {
    const move = game.move(parseUci(uci));
    if (!move) throw new Error(`Unzulässiger Zug im Rätsel: ${uci}`);
    return move;
  }

  function wouldMate(attempt) {
    const probe = new Chess(game.fen());
    try {
      probe.move(attempt);
    } catch (err) {
      return false;
    }
    return probe.isCheckmate();
  }

  function isLegal(attempt) {
    return game.moves({ verbose: true }).some(
      (m) => m.from === attempt.from && m.to === attempt.to && (m.promotion || undefined) === (attempt.promotion || undefined),
    );
  }

  // Stellt die Ausgangsstellung her und spielt den Zug des Gegners.
  async function setup(puzzle, id) {
    ensureBoard();
    game = new Chess(puzzle.fen);
    solverColor = game.turn() === "w" ? "black" : "white";
    cg.set({ orientation: solverColor });
    render({ animate: false });
    await sleep(PAUSE_OPPONENT);
    check(id);
    const opp = splitMoves(puzzle)[0];
    play(opp);
    render({ lastMove: [opp.slice(0, 2), opp.slice(2, 4)] });
    await sleep(250);
    check(id);
    return { color: solverColor };
  }

  return {
    get solverColor() {
      return solverColor;
    },

    // Erster Lösungsversuch. Ergebnis: { solved, ms, wrongMove }.
    async solve(puzzle, { onReady } = {}) {
      const id = ++runId;
      const moves = splitMoves(puzzle);
      const { color } = await setup(puzzle, id);
      if (onReady) onReady({ color });
      render({ interactive: true, lastMove: lastMoveOf(moves[0]) });
      timer.start();
      let idx = 1;
      try {
        for (;;) {
          const attempt = await userMove(id);
          check(id);
          if (!isLegal(attempt)) {
            render({ interactive: true });
            continue;
          }
          const uci = attempt.from + attempt.to + (attempt.promotion || "");
          const mates = wouldMate(attempt);
          if (uci === moves[idx] || mates) {
            game.move(attempt);
            render({ lastMove: [attempt.from, attempt.to] });
            if (mates || idx === moves.length - 1) return { solved: true, ms: timer.stop() };
            idx += 1;
            await sleep(PAUSE_OPPONENT);
            check(id);
            play(moves[idx]);
            render({ lastMove: lastMoveOf(moves[idx]) });
            idx += 1;
            if (idx >= moves.length) return { solved: true, ms: timer.stop() };
            render({ interactive: true, lastMove: lastMoveOf(moves[idx - 1]) });
            continue;
          }
          // Falscher Zug: kurz zeigen, zurücknehmen.
          const ms = timer.stop();
          cg.set({ movable: { color: undefined } });
          await sleep(PAUSE_WRONG);
          check(id);
          render({ lastMove: lastMoveOf(moves[idx - 1]) });
          return { solved: false, ms, wrongMove: uci };
        }
      } catch (err) {
        timer.stop();
        throw err;
      }
    },

    // Zeigt die richtige Zugfolge Zug für Zug (ab dem ersten Zug des Spielers).
    async showSolution(puzzle) {
      const id = ++runId;
      const moves = splitMoves(puzzle);
      ensureBoard();
      game = new Chess(puzzle.fen);
      solverColor = game.turn() === "w" ? "black" : "white";
      cg.set({ orientation: solverColor });
      play(moves[0]);
      render({ lastMove: lastMoveOf(moves[0]), animate: false });
      for (let i = 1; i < moves.length; i++) {
        await sleep(PAUSE_SOLUTION);
        check(id);
        play(moves[i]);
        render({ lastMove: lastMoveOf(moves[i]) });
      }
      await sleep(400);
      check(id);
    },

    // Der Spieler spielt die richtige Zugfolge einmal selbst nach. Falsche Züge springen zurück
    // und zählen nicht; nach dem zweiten Fehlversuch zeigt ein Pfeil den richtigen Zug.
    async replay(puzzle, { onWrong } = {}) {
      const id = ++runId;
      const moves = splitMoves(puzzle);
      ensureBoard();
      game = new Chess(puzzle.fen);
      solverColor = game.turn() === "w" ? "black" : "white";
      cg.set({ orientation: solverColor });
      play(moves[0]);
      render({ lastMove: lastMoveOf(moves[0]), animate: false });
      let idx = 1;
      let wrong = 0;
      cg.setAutoShapes([]);
      for (;;) {
        render({ interactive: true, lastMove: lastMoveOf(moves[idx - 1]), animate: false });
        const attempt = await userMove(id);
        check(id);
        const uci = attempt.from + attempt.to + (attempt.promotion || "");
        if (isLegal(attempt) && (uci === moves[idx] || wouldMate(attempt))) {
          const done = wouldMate(attempt) || idx === moves.length - 1;
          game.move(attempt);
          cg.setAutoShapes([]);
          wrong = 0;
          render({ lastMove: [attempt.from, attempt.to] });
          if (done) return;
          idx += 1;
          await sleep(PAUSE_OPPONENT);
          check(id);
          play(moves[idx]);
          render({ lastMove: lastMoveOf(moves[idx]) });
          idx += 1;
          if (idx >= moves.length) return;
          continue;
        }
        wrong += 1;
        if (onWrong) onWrong(wrong);
        render({ interactive: true, lastMove: lastMoveOf(moves[idx - 1]) });
        if (wrong >= 2) {
          const m = parseUci(moves[idx]);
          cg.setAutoShapes([{ orig: m.from, dest: m.to, brush: "green" }]);
        }
      }
    },

    // Brett ohne Bedienung (z. B. beim Zusammenfassen).
    freeze() {
      if (cg) cg.set({ movable: { color: undefined } });
    },

    cancel() {
      runId += 1;
      if (pending) pending.reject(new Cancelled());
      pending = null;
      timer.stop();
    },
  };
}

function lastMoveOf(uci) {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}
