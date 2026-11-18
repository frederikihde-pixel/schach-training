// Spielzustand einer Partie gegen den Computer. Reine Logik auf Basis von chess.js, ohne DOM.
// Eine laufende Partie ("aktiv") besteht nur aus Startstellung und Zugliste (UCI-Text); die Stellung wird
// daraus immer neu aufgebaut. So lässt sich eine Partie nach Neuladen oder App-Wechsel sicher fortsetzen.

import { Chess } from "../vendor/chess.js/chess.js";
import { uciMove, parseUciMove } from "./engine.js";
import { STUFENVERSION } from "./stufen.js";

export const START_FEN = new Chess().fen();

export function neueId(now = new Date()) {
  return now.toISOString().replace(/[-:.TZ]/g, "") + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
}

// modus: "partie" | "vorteil" | "grundmatt"
export function neueAktive({ modus, farbe, stufe, startFen = START_FEN, zuruecknahme = false, warnung = false, extra = {}, now = new Date() }) {
  return {
    id: neueId(now),
    modus,
    farbe, // "w" | "b": die Farbe des Spielers
    stufe,
    stufenversion: STUFENVERSION,
    startFen,
    zuege: [],
    zuruecknahme,
    warnung,
    warnungen: 0, // wie oft die Patzer-Warnung erschien
    trotzdem: 0, // wie oft danach "Trotzdem" gewählt wurde
    zurueck: 0, // wie oft ein Zug zurückgenommen wurde
    aufgegeben: false,
    gestartet: now.toISOString(),
    ...extra,
  };
}

export function zugAnwenden(chess, uci) {
  const p = parseUciMove(uci);
  if (!p) throw new Error(`Ungültiger Zug: ${uci}`);
  return chess.move({ from: p.from, to: p.to, promotion: p.promotion });
}

// Baut die Stellung aus Startstellung und Zügen. Wirft, wenn die Zugliste nicht zur Stellung passt.
export function stellung(aktiv) {
  const chess = new Chess(aktiv.startFen);
  for (const z of aktiv.zuege) zugAnwenden(chess, z);
  return chess;
}

export function legaleUci(chess) {
  return chess.moves({ verbose: true }).map(uciMove);
}

export function spielerAmZug(aktiv, chess) {
  return chess.turn() === aktiv.farbe;
}

export function farbName(f) {
  return f === "w" ? "Weiß" : "Schwarz";
}

// Ist die Partie zu Ende? Gibt null oder { ergebnis, grund } zurück.
// ergebnis ist "1-0", "0-1" oder "1/2-1/2".
export function ende(chess, aktiv = null) {
  if (aktiv && aktiv.aufgegeben) {
    return { ergebnis: aktiv.farbe === "w" ? "0-1" : "1-0", grund: "Aufgabe" };
  }
  if (chess.isCheckmate()) return { ergebnis: chess.turn() === "w" ? "0-1" : "1-0", grund: "Matt" };
  if (chess.isStalemate()) return { ergebnis: "1/2-1/2", grund: "Patt" };
  if (chess.isInsufficientMaterial()) return { ergebnis: "1/2-1/2", grund: "Zu wenig Material" };
  if (chess.isThreefoldRepetition()) return { ergebnis: "1/2-1/2", grund: "Dreifache Wiederholung" };
  if (chess.isDrawByFiftyMoves()) return { ergebnis: "1/2-1/2", grund: "50-Züge-Regel" };
  if (chess.isDraw()) return { ergebnis: "1/2-1/2", grund: "Remis" };
  return null;
}

export function ausgang(ergebnis, farbe) {
  if (ergebnis === "1/2-1/2") return "remis";
  return (ergebnis === "1-0") === (farbe === "w") ? "gewonnen" : "verloren";
}

export function endeText(e, farbe) {
  const a = ausgang(e.ergebnis, farbe);
  if (e.grund === "Matt") return a === "gewonnen" ? "Schachmatt. Du hast gewonnen." : "Schachmatt. Der Computer hat gewonnen.";
  if (e.grund === "Aufgabe") return "Du hast aufgegeben. Die Partie ist verloren.";
  if (e.grund === "Patt") return "Patt. Die Partie ist remis.";
  if (e.grund === "Zu wenig Material") return "Remis durch zu wenig Material.";
  if (e.grund === "Dreifache Wiederholung") return "Remis durch dreifache Stellungswiederholung.";
  if (e.grund === "50-Züge-Regel") return "Remis durch die 50-Züge-Regel.";
  return "Die Partie ist remis.";
}

// Zug zurücknehmen: Es werden immer dein letzter Zug und die Antwort des Computers zurückgenommen.
// Geht nur, wenn du am Zug bist und schon ein eigener Zug gespielt wurde.
export function kannZuruecknehmen(aktiv, chess) {
  if (!aktiv.zuruecknahme || aktiv.aufgegeben || ende(chess, aktiv)) return false;
  if (!spielerAmZug(aktiv, chess)) return false;
  return aktiv.zuege.length >= (aktiv.farbe === "w" ? 2 : 3);
}

export function zuruecknehmen(aktiv) {
  const chess = stellung(aktiv);
  if (!kannZuruecknehmen(aktiv, chess)) return false;
  aktiv.zuege = aktiv.zuege.slice(0, -2);
  aktiv.zurueck += 1;
  return true;
}

// Ein Teil der Zugliste der letzten Hälfte: wie viele Züge hat der Spieler gemacht (für Grundmatts).
export function spielerZuege(aktiv) {
  const ersteSeite = new Chess(aktiv.startFen).turn();
  let n = 0;
  aktiv.zuege.forEach((_, i) => {
    const farbe = (i % 2 === 0) === (ersteSeite === "w") ? "w" : "b";
    if (farbe === aktiv.farbe) n++;
  });
  return n;
}

function pgnDatum(iso) {
  return iso.slice(0, 10).replace(/-/g, ".");
}

const MODUS_TEXT = { partie: "Partie", vorteil: "Vorteil verwerten", grundmatt: "Grundmatt" };

export function pgnVon(aktiv, e, { stufenText = `Computer Stufe ${aktiv.stufe}` } = {}) {
  const chess = stellung(aktiv);
  chess.setHeader("Event", `Training: ${MODUS_TEXT[aktiv.modus] || "Partie"}`);
  chess.setHeader("Site", "Schach-Training");
  chess.setHeader("Date", pgnDatum(aktiv.gestartet));
  chess.setHeader("White", aktiv.farbe === "w" ? "Ich" : stufenText);
  chess.setHeader("Black", aktiv.farbe === "b" ? "Ich" : stufenText);
  chess.setHeader("Result", e ? e.ergebnis : "*");
  if (e && e.grund === "Aufgabe") chess.setHeader("Termination", "Aufgabe");
  return chess.pgn();
}

// Eintrag für spielen.partien beziehungsweise spielen.versuche.
export function eintrag(aktiv, e, { now = new Date() } = {}) {
  const chess = stellung(aktiv);
  const out = {
    id: aktiv.id,
    datum: now.toISOString(),
    modus: aktiv.modus,
    farbe: aktiv.farbe,
    stufe: aktiv.stufe,
    stufenversion: aktiv.stufenversion,
    ergebnis: e.ergebnis,
    ausgang: ausgang(e.ergebnis, aktiv.farbe),
    grund: e.grund,
    zuege: spielerZuege(aktiv),
    halbzuege: aktiv.zuege.length,
    pgn: pgnVon(aktiv, e),
    startFen: aktiv.startFen,
    warnung: !!aktiv.warnung,
    warnungen: aktiv.warnungen,
    trotzdem: aktiv.trotzdem,
    zuruecknahme: !!aktiv.zuruecknahme,
    zurueck: aktiv.zurueck,
  };
  for (const key of ["art", "stellung", "stellungNr"]) if (aktiv[key] !== undefined) out[key] = aktiv[key];
  if (aktiv.modus === "grundmatt") {
    out.matt = e.grund === "Matt" && e.ergebnis === (aktiv.farbe === "w" ? "1-0" : "0-1");
    out.mattIn = out.matt ? out.zuege : null;
  }
  void chess;
  return out;
}
