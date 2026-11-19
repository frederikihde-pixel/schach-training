// Analyse einer Partie mit der Engine. Unabhängig von der Quelle: Eingabe sind Züge oder ein PGN und die
// Farbe des Spielers (eigene Partien, später Chess.com-Partien). Reine Logik plus ein Ablauf, der die Engine
// von außen bekommt; kein DOM. Schwellen und Grenzen der Genauigkeit stehen in docs/ANALYSE.md.
//
// Ablauf: Jede Stellung der Partie (vor dem ersten Zug bis nach dem letzten) wird nacheinander gesucht.
// Stellungen, in denen der Spieler am Zug ist, mit MultiPV 3 (für den besseren Zug und die Rätsel), die anderen mit
// MultiPV 1. Der Bewertungsverlust eines Zugs ist: beste Bewertung der Stellung minus Bewertung nach dem gespielten Zug.

import { Chess } from "../vendor/chess.js/chess.js";
import { uciMove, parseUciMove, scoreToCp } from "./engine.js";
import { gefaehrdeteFiguren, figurName, WERT } from "./material.js";

export const ANALYSE_VERSION = 1;
export const CAP = 1000; // Bewertungen werden auf +/- 1000 Centipawn begrenzt (Matt zählt als 1000)
export const SUCHZEIT_MS = 300; // je Stellung
export const MULTIPV_SPIELER = 3;
export const SCHWELLEN = Object.freeze({
  patzer: 300, // Verlust ab 300: Patzer, oder verpasste Chance (siehe klassifiziere)
  fehler: 150, // Verlust 150 bis 299: Fehler; darunter wird nichts angezeigt
  chanceRest: -150, // Nach einem Verlust ab 300 gilt es als verpasste Chance, wenn die Stellung danach nicht schlechter als -150 ist
});
export const ENGINE_OPTIONEN = Object.freeze({ UCI_LimitStrength: false, "Skill Level": 20 });
export const ENDSPIEL_FIGUREN = 6; // höchstens so viele Figuren (ohne Könige und Bauern, beide Seiten zusammen)
export const EROEFFNUNG_BIS_ZUG = 10;

const START_FEN = new Chess().fen();

// ---------- Eingabe ----------

// Eingabe: { pgn } oder { zuege (UCI), startFen }; farbe "w" | "b". Ergebnis: { startFen, zuege, farbe }.
export function leseEingabe({ pgn = null, zuege = null, startFen = null, farbe }) {
  if (farbe !== "w" && farbe !== "b") throw new RangeError("Farbe des Spielers fehlt");
  if (pgn) {
    const c = new Chess();
    c.loadPgn(pgn);
    return { startFen: c.header().FEN || START_FEN, zuege: c.history({ verbose: true }).map(uciMove), farbe };
  }
  if (!Array.isArray(zuege)) throw new RangeError("Keine Züge angegeben");
  return { startFen: startFen || START_FEN, zuege: [...zuege], farbe };
}

// Alle Stellungen der Partie: [{ i, fen, turn }], i = 0 ist die Startstellung.
export function stellungen(eingabe) {
  const c = new Chess(eingabe.startFen);
  const out = [{ i: 0, fen: c.fen(), turn: c.turn() }];
  eingabe.zuege.forEach((z, k) => {
    const p = parseUciMove(z);
    c.move({ from: p.from, to: p.to, promotion: p.promotion });
    out.push({ i: k + 1, fen: c.fen(), turn: c.turn() });
  });
  return out;
}

// ---------- Suche ----------

function legaleZuege(fen) {
  return new Chess(fen).moves().length;
}

// Auswertung einer Engine-Antwort für eine Stellung (Bewertungen aus Sicht der Seite am Zug, gedeckelt).
export function ergebnisVonSuche(i, antwort) {
  const lines = antwort.lines.map((l) => ({
    u: l.pv[0],
    cp: scoreToCp(l.score, CAP),
    m: l.score.type === "mate" ? l.score.value : null,
    pv: l.pv.slice(0, 3),
  }));
  const top = lines[0];
  return { i, cp: top ? top.cp : 0, mate: top ? top.m : null, best: antwort.best, lines };
}

export function endeErgebnis(i, chess) {
  // Matt: die Seite am Zug hat verloren. Sonst Remis (Patt, Material, Wiederholung, 50 Züge).
  if (chess.isCheckmate()) return { i, ende: true, cp: -CAP, mate: 0, best: null, lines: [] };
  return { i, ende: true, cp: 0, mate: null, best: null, lines: [] };
}

// Analysiert alle Stellungen nacheinander. Mit start und ergebnisse setzt eine unterbrochene Analyse fort.
// engine: wie js/engine.js (search). onPosition(ergebnis, fertig, gesamt) wird nach jeder Stellung aufgerufen
// (dort wird gespeichert). abbruch: { stop: false } wird von außen gesetzt; dann endet die Analyse ohne Fehler.
// Gibt { fertig: true|false, ergebnisse } zurück.
export async function analysiere(eingabe, { engine, movetime = SUCHZEIT_MS, start = 0, ergebnisse = [], onPosition = null, abbruch = { stop: false } } = {}) {
  const pos = stellungen(eingabe);
  const gesamt = pos.length;
  const out = ergebnisse.slice(0, start);
  for (let i = start; i < gesamt; i++) {
    if (abbruch.stop) return { fertig: false, ergebnisse: out };
    const c = new Chess(pos[i].fen);
    let r;
    if (c.isGameOver()) r = endeErgebnis(i, c);
    else {
      const spieler = pos[i].turn === eingabe.farbe;
      const antwort = await engine.search({
        fen: pos[i].fen,
        movetime,
        multipv: Math.min(spieler ? MULTIPV_SPIELER : 1, legaleZuege(pos[i].fen)),
        options: ENGINE_OPTIONEN,
      });
      if (abbruch.stop) return { fertig: false, ergebnisse: out };
      r = ergebnisVonSuche(i, antwort);
    }
    out.push(r);
    if (onPosition) await onPosition(r, i + 1, gesamt);
  }
  return { fertig: true, ergebnisse: out };
}

// ---------- Bewertung ----------

export function klassifiziere(verlust, eigenNachher) {
  if (verlust >= SCHWELLEN.patzer) return eigenNachher >= SCHWELLEN.chanceRest ? "chance" : "patzer";
  if (verlust >= SCHWELLEN.fehler) return "fehler";
  return null;
}

function nichtBauernFiguren(chess) {
  let n = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== "p" && sq.type !== "k") n++;
  return n;
}

export function phaseVon(chessVorher) {
  const zug = chessVorher.moveNumber();
  if (zug <= EROEFFNUNG_BIS_ZUG) return "eroeffnung";
  return nichtBauernFiguren(chessVorher) <= ENDSPIEL_FIGUREN ? "endspiel" : "mittelspiel";
}

// Deutsche Figurbuchstaben im Zug-Text (Springer = S, Läufer = L, Turm = T, Dame = D).
export function sanDeutsch(san) {
  return san.replace(/^[NBRQ]/, (c) => ({ N: "S", B: "L", R: "T", Q: "D" })[c]);
}

function bauerneinheiten(verlust) {
  if (verlust >= 900) return "mehr als 9";
  return (verlust / 100).toFixed(1).replace(".", ",");
}

// Bewertet alle Züge des Spielers. ergebnisse: Ergebnisse je Stellung (Index = Stellung).
// Gibt { zuege: [{ ply, nr, verlust, phase, art }], eintraege: [Details der angezeigten Züge], summe } zurück.
export function bewerteZuege(eingabe, ergebnisse) {
  const pos = stellungen(eingabe);
  const zuege = [];
  const eintraege = [];
  eingabe.zuege.forEach((uci, ply) => {
    if (pos[ply].turn !== eingabe.farbe) return;
    const vor = ergebnisse[ply];
    const nach = ergebnisse[ply + 1];
    if (!vor || !nach || !vor.lines.length) return;
    const chessVor = new Chess(pos[ply].fen);
    const p = parseUciMove(uci);
    const zug = chessVor.move({ from: p.from, to: p.to, promotion: p.promotion });
    const chessNach = new Chess(pos[ply + 1].fen);

    const beste = vor.lines[0];
    const gespielt = vor.lines.find((l) => l.u === uci);
    let eigenNachher;
    if (gespielt) eigenNachher = gespielt.cp;
    else if (nach.ende) eigenNachher = nach.mate === 0 ? -nach.cp : 0; // Matt gesetzt: +1000, sonst Remis
    else eigenNachher = -nach.cp;
    const verlust = uci === beste.u ? 0 : Math.max(0, Math.min(2 * CAP, beste.cp - eigenNachher));
    const art = klassifiziere(verlust, eigenNachher);
    const phase = phaseVon(new Chess(pos[ply].fen));
    const nr = new Chess(pos[ply].fen).moveNumber();
    zuege.push({ ply, nr, verlust, phase, art });
    if (!art) return;

    // Matt: erlaubt (Gegner hat danach Matt) oder verpasst (der Spieler hatte Matt)
    const mattErlaubt = !nach.ende && nach.mate !== null && nach.mate > 0 ? nach.mate : null;
    const mattVerpasst = beste.m !== null && beste.m > 0 && uci !== beste.u ? beste.m : null;
    // Ungedeckte Figuren des Spielers nach dem Zug (gegenüber vorher)
    const vorherUngedeckt = new Set(gefaehrdeteFiguren(chessVor, eingabe.farbe, { ohneBauern: true }).filter((f) => f.grund === "ungedeckt").map((f) => f.square));
    const danach = gefaehrdeteFiguren(chessNach, eingabe.farbe, { ohneBauern: true }).filter((f) => f.grund === "ungedeckt");
    const neu = danach.filter((f) => !vorherUngedeckt.has(f.square) || f.square === zug.to);
    const geblieben = danach.filter((f) => vorherUngedeckt.has(f.square) && f.square !== zug.to);
    let ursache = "sonstig";
    let hangs = null;
    if (art === "chance") ursache = "chance";
    else if (mattErlaubt !== null) ursache = "matt";
    else if (neu.length) {
      ursache = "figur";
      hangs = neu.sort((a, b) => WERT[b.type] - WERT[a.type])[0];
    } else if (geblieben.length) {
      ursache = "drohung";
      hangs = geblieben.sort((a, b) => WERT[b.type] - WERT[a.type])[0];
    }
    const bestSan = sanDeutsch(new Chess(pos[ply].fen).move({ from: beste.u.slice(0, 2), to: beste.u.slice(2, 4), promotion: beste.u[4] }).san);
    const eintrag = {
      ply,
      nr,
      uci,
      san: sanDeutsch(zug.san),
      art,
      ursache,
      phase,
      verlust,
      best: beste.u,
      bestSan,
      bestPv: beste.pv,
      lines: vor.lines.map((l) => ({ u: l.u, cp: l.cp, m: l.m, pv: l.pv })),
      mattErlaubt,
      mattVerpasst,
      ungedeckt: hangs ? { square: hangs.square, type: hangs.type } : null,
    };
    eintrag.text = erklaerung(eintrag);
    eintraege.push(eintrag);
  });
  const anzahl = (a) => eintraege.filter((e) => e.art === a).length;
  const summe = {
    zuege: zuege.length,
    patzer: anzahl("patzer"),
    fehler: anzahl("fehler"),
    chancen: anzahl("chance"),
    verlustSumme: zuege.reduce((s, z) => s + z.verlust, 0),
  };
  return { zuege, eintraege, summe };
}

const ARTIKEL = { p: "Der", n: "Der", b: "Der", r: "Der", q: "Die", k: "Der" };

// Erklärung in einfachem Deutsch, ohne Engine-Fachwörter.
// Reihenfolge: erlaubtes Matt, ungedeckte Figur, verpasstes Matt, sonst Bauerneinheiten und besserer Zug.
export function erklaerung(e) {
  if (e.mattErlaubt !== null) return `Das erlaubte Matt in ${e.mattErlaubt}.`;
  if (e.ungedeckt) return `${ARTIKEL[e.ungedeckt.type]} ${figurName(e.ungedeckt.type)} auf ${e.ungedeckt.square} war danach ungedeckt und konnte geschlagen werden.`;
  if (e.mattVerpasst !== null) return `Hier gab es Matt in ${e.mattVerpasst}.`;
  return `Dieser Zug verlor etwa ${bauerneinheiten(e.verlust)} Bauerneinheiten, besser war Zug ${e.bestSan}.`;
}

export const ART_TEXT = { patzer: "Patzer", fehler: "Fehler", chance: "Verpasste Chance" };
export const PHASE_TEXT = { eroeffnung: "Eröffnung", mittelspiel: "Mittelspiel", endspiel: "Endspiel" };

// Für die Anzeige: Ergebnis der Analyse als gespeicherter Eintrag.
export function analyseEintrag({ id, quelle = "partie", eingabe, ergebnisse, datum }) {
  const b = bewerteZuege(eingabe, ergebnisse);
  return {
    id,
    quelle,
    version: ANALYSE_VERSION,
    datum,
    farbe: eingabe.farbe,
    startFen: eingabe.startFen,
    zuegeUci: eingabe.zuege,
    zuege: b.zuege,
    eintraege: b.eintraege,
    summe: b.summe,
  };
}
