// Eigene Fehler als Rätsel (Teil F). Reine Logik auf dem Speicherstand.
//
// Aus einem Patzer oder einer verpassten Chance der Analyse wird ein Rätsel in der Stellung vor dem eigenen Zug.
// Richtig sind alle Züge, die höchstens 50 Centipawn schlechter sind als der beste (aus MultiPV 3). Eindeutig
// ist das Rätsel nur, wenn der beste Zug außerhalb dieser Gruppe mindestens 150 Centipawn schlechter ist; sonst
// gibt es kein Rätsel. Die Rätsel laufen im Wiederholungssystem (Leitner 1, 3, 7, 21 Tage) und ändern die
// Taktikstärke nicht (Art "wiederholung").
//
// Ein Rätsel hat das Format der übrigen Rätsel, damit der bestehende Rätsel-Lauf es abspielen kann: "fen" ist die
// Stellung VOR dem letzten Zug des Gegners, der erste Zug in "zuege" ist dieser Gegnerzug. "zugFen" ist die
// Stellung vor dem eigenen Zug (zur Anzeige).

import { Chess } from "../vendor/chess.js/chess.js";
import { stellungen } from "./analyse.js";
import { afterFailure } from "./leitner.js";
import { EIGENER_FEHLER } from "./stats.js";
import { SPIELEN_CAPS } from "./storage.js";

export const TOLERANZ_CP = 50;
export const MIN_ABSTAND_CP = 150;
export const MAX_VARIANTE = 3; // Halbzüge der gezeigten Hauptvariante
export const MAX_EIGENE = SPIELEN_CAPS.eigene;

export function raetselId(analyseId, ply) {
  return `e-${analyseId}-${ply}`;
}

// Baut das Rätsel zu einem angezeigten Zug der Analyse. Gibt null zurück, wenn es keins geben soll.
// analyse: Eintrag aus spielen.analysen (startFen, zuegeUci), e: ein Eintrag aus analyse.eintraege.
export function baueRaetsel(analyse, e, { datum = null } = {}) {
  if (e.ply < 1) return null; // ohne vorherigen Gegnerzug lässt sich das Rätsel nicht aufbauen
  const lines = e.lines || [];
  if (lines.length < 2) return null;
  const beste = lines[0];
  const richtig = lines.filter((l) => l.cp >= beste.cp - TOLERANZ_CP);
  const falsch = lines.find((l) => l.cp < beste.cp - TOLERANZ_CP);
  // Alle drei Kandidaten gleich gut: Ob andere Züge schlecht sind, ist unbekannt. Kein klarer Abstand: nicht eindeutig.
  if (!falsch || falsch.cp > beste.cp - MIN_ABSTAND_CP) return null;

  const pos = stellungen({ startFen: analyse.startFen, zuege: analyse.zuegeUci });
  const gegnerZug = analyse.zuegeUci[e.ply - 1];
  const vorFen = pos[e.ply - 1].fen;
  const zugFen = pos[e.ply].fen;

  // Kurze Hauptvariante: der beste Zug und die Fortsetzung, höchstens 3 Halbzüge, nur legale Züge.
  const c = new Chess(zugFen);
  const variante = [];
  for (const u of beste.pv.slice(0, MAX_VARIANTE)) {
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      variante.push(u);
    } catch (err) {
      break;
    }
  }
  if (!variante.length) return null;
  return {
    id: raetselId(analyse.id, e.ply),
    fen: vorFen,
    zugFen,
    zuege: [gegnerZug, ...variante].join(" "),
    richtig: richtig.map((l) => l.u),
    rating: null,
    themen: [EIGENER_FEHLER],
    eigen: true,
    partieId: analyse.id,
    nr: e.nr,
    art: e.art,
    datum,
  };
}

// Nimmt ein Rätsel in das Wiederholungssystem auf (fällig am nächsten Tag, Stufe 1). Gibt true zurück, wenn neu.
// Bei mehr als MAX_EIGENE werden die ältesten (samt Karte) entfernt.
export function aufnehmen(d, puzzle, { today, nowIso }) {
  if (d.spielen.eigene.some((x) => x.id === puzzle.id) || d.taktik.karten[puzzle.id]) return false;
  d.taktik.karten[puzzle.id] = afterFailure(puzzle, today);
  d.spielen.eigene.push({ id: puzzle.id, datum: nowIso, partieId: puzzle.partieId, nr: puzzle.nr, art: puzzle.art });
  while (d.spielen.eigene.length > MAX_EIGENE) {
    const alt = d.spielen.eigene.shift();
    delete d.taktik.karten[alt.id];
  }
  return true;
}

// Nach einer fertigen Analyse: Patzer und verpasste Chancen werden zu Rätseln. Gibt die Zahl neuer Rätsel zurück.
export function ausAnalyse(d, analyse, { today, nowIso }) {
  let neu = 0;
  for (const e of analyse.eintraege) {
    if (e.art !== "patzer" && e.art !== "chance") continue;
    const p = baueRaetsel(analyse, e, { datum: analyse.datum || nowIso });
    if (p && aufnehmen(d, p, { today, nowIso })) neu += 1;
  }
  return neu;
}

// Rätsel zu einem einzelnen Eintrag auf Wunsch ("Als Rätsel üben", auch bei Fehlern). Gibt das Rätsel zurück
// (aus dem Wiederholungssystem oder neu gebaut und aufgenommen) oder null, wenn es nicht eindeutig ist.
export function raetselFuerEintrag(d, analyse, e, { today, nowIso }) {
  const id = raetselId(analyse.id, e.ply);
  const karte = d.taktik.karten[id];
  if (karte) return karte.raetsel;
  const p = baueRaetsel(analyse, e, { datum: analyse.datum || nowIso });
  if (!p) return null;
  aufnehmen(d, p, { today, nowIso });
  return p;
}

// Zahlen für Anzeige: Anzahl gespeicherter eigener Rätsel, fällige, Lösungsquote (aus dem Themenzähler).
export function eigeneZahlen(d, today) {
  const karten = Object.values(d.taktik.karten).filter((c) => c.raetsel && c.raetsel.eigen);
  const t = d.taktik.themen[EIGENER_FEHLER] || { n: 0, ok: 0 };
  return {
    anzahl: d.spielen.eigene.length,
    faellig: karten.filter((c) => c.faellig <= today).length,
    versuche: t.n,
    richtig: t.ok,
    quote: t.n ? t.ok / t.n : null,
  };
}
