// Stärkestufen des Computergegners. Die Parameter sind FEST und versioniert (STUFENVERSION):
// Jede gespeicherte Partie merkt sich die Version, damit Ergebnisse vergleichbar bleiben.
// Wer hier etwas ändert, muss STUFENVERSION erhöhen und docs/STUFEN.md anpassen.
// Reine Logik ohne DOM; die Engine wird von außen übergeben (js/engine.js).

import { parseUciMove } from "./engine.js";

export const STUFENVERSION = 1;

// art "fehler": unterhalb des Minimums von UCI_Elo (1320). Skill Level, feste Suchtiefe über die
//   Knotenzahl (geräteunabhängig), MultiPV-Kandidaten und eine eigene Fehlerquote.
//   gewichte: Gewicht je Rang der Kandidatenliste (Rang 1 = Engine-Bestzug).
//   zufall: Anteil der Züge, die ganz zufällig aus allen legalen Zügen gewählt werden.
//   matt1: Chance, ein gefundenes Matt in 1 auch zu spielen (sonst wird normal gewählt, Stufe 1 übersieht es oft).
// art "elo": UCI_LimitStrength und UCI_Elo.
// art "voll": keine Begrenzung.
// minMs: kürzeste angezeigte Bedenkzeit ("Computer denkt"), damit der Zug nicht blitzartig kommt.
// richtwert: grobe Schätzung der Chess.com-Wertung, gegen die diese Stufe etwa spielt. NICHT gemessen.
export const STUFEN = Object.freeze(
  [
    { nr: 1, art: "fehler", skill: 0, nodes: 150, multipv: 8, gewichte: [2, 2, 2, 2, 2, 2, 2, 2], zufall: 0.3, matt1: 0.35, minMs: 500, richtwert: 200 },
    { nr: 2, art: "fehler", skill: 2, nodes: 800, multipv: 5, gewichte: [8, 4, 3, 2, 1], zufall: 0.08, matt1: 0.75, minMs: 700, richtwert: 400 },
    { nr: 3, art: "fehler", skill: 5, nodes: 1000, multipv: 4, gewichte: [11, 5, 3, 1], zufall: 0.06, matt1: 0.9, minMs: 900, richtwert: 650 },
    { nr: 4, art: "elo", elo: 1320, movetime: 150, minMs: 1100, richtwert: 900 },
    { nr: 5, art: "elo", elo: 1500, movetime: 200, minMs: 1300, richtwert: 1150 },
    { nr: 6, art: "elo", elo: 1800, movetime: 300, minMs: 1500, richtwert: 1450 },
    { nr: 7, art: "elo", elo: 2200, movetime: 400, minMs: 1700, richtwert: 1800 },
    { nr: 8, art: "voll", movetime: 600, minMs: 2000, richtwert: 2200 },
  ].map((s) => Object.freeze(s)),
);

export const GRUNDMATT_STUFE = 8;

export function stufe(nr) {
  const s = STUFEN.find((x) => x.nr === nr);
  if (!s) throw new RangeError(`Unbekannte Stufe: ${nr}`);
  return s;
}

export function stufenName(nr) {
  return nr <= 3 ? `Stufe ${nr} (Anfänger)` : `Stufe ${nr}`;
}

// Text für die Anzeige. Ehrlich: Richtwerte, nicht gemessen gegen Menschen.
export function ungefaehreStaerke(nr) {
  const s = stufe(nr);
  const rw = s.richtwert;
  const engine = s.art === "elo" ? ` (Engine-Wert ${s.elo})` : "";
  const text = s.art === "voll" ? "über 2200 (volle Stärke der kleinen Engine)" : `ungefähr ${rw}`;
  return `${text}${engine}`;
}

export const STAERKE_HINWEIS =
  "Die Zahlen sind grobe Richtwerte, keine Messung. Sie sind weder Chess.com- noch FIDE-Wertungen. Wie schwer eine Stufe für dich ist, zeigen die Partien.";

// Startstufe zur eigenen Chess.com-Wertung: die höchste Stufe, deren Richtwert nicht über der Wertung liegt.
export function startStufe(wertung) {
  if (!Number.isFinite(wertung)) return 1;
  let best = 1;
  for (const s of STUFEN) if (s.richtwert <= wertung) best = s.nr;
  return best;
}

// Wählt aus dem Suchergebnis den Zug. rng liefert Zahlen in [0, 1).
// ergebnis: { best, lines: [{ pv: [...] }] } wie js/engine.js; legal: alle legalen Züge als UCI-Text.
export function waehleZug(s, ergebnis, legal, rng = Math.random) {
  if (!legal.length) return null;
  if (s.art !== "fehler") return ergebnis.best || legal[0];
  if (legal.length === 1) return legal[0];
  // Matt in 1 steht bei kleiner Suche nicht immer auf Rang 1 (Matt in 2 kann davor stehen): alle Kandidaten prüfen.
  const matt = ergebnis.lines.find((l) => l.score.type === "mate" && l.score.value === 1 && l.pv[0] && legal.includes(l.pv[0]));
  if (matt && rng() < s.matt1) return matt.pv[0];
  if (rng() < s.zufall) return legal[Math.floor(rng() * legal.length)];
  const kandidaten = ergebnis.lines.map((l) => l.pv[0]).filter((m) => m && legal.includes(m));
  if (!kandidaten.length) return ergebnis.best || legal[0];
  const gewichte = kandidaten.map((_, i) => s.gewichte[Math.min(i, s.gewichte.length - 1)]);
  let rest = rng() * gewichte.reduce((a, b) => a + b, 0);
  for (let i = 0; i < kandidaten.length; i++) {
    rest -= gewichte[i];
    if (rest < 0) return kandidaten[i];
  }
  return kandidaten[0];
}

// Stellt die Engine für die Stufe ein und holt den Zug der Stufe.
// pos: { fen, moves, legal }  -> { zug (UCI), engineBest, rang }
export async function spieleZug(engine, nr, pos, rng = Math.random) {
  const s = stufe(nr);
  await engine.setOptions({
    UCI_LimitStrength: s.art === "elo",
    ...(s.art === "elo" ? { UCI_Elo: s.elo } : {}),
    "Skill Level": s.art === "fehler" ? s.skill : 20,
  });
  const such = { fen: pos.fen, moves: pos.moves || [] };
  const ergebnis = await engine.search(
    s.art === "fehler" ? { ...such, nodes: s.nodes, multipv: Math.min(s.multipv, pos.legal.length) } : { ...such, movetime: s.movetime, multipv: 1 },
  );
  const zug = waehleZug(s, ergebnis, pos.legal, rng);
  return { zug, engineBest: ergebnis.best, parsed: parseUciMove(zug) };
}
