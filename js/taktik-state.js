// Fortschreiben der Taktik-Daten nach Rätseln und Sitzungen. Reine Logik auf dem Objekt
// `state.taktik` (wird von js/storage.js gespeichert).
import { updateStrength } from "./rating.js";
import { afterFailure, afterSuccess } from "./leitner.js";
import { addAttempt, cappedMs, sessionWeakest, averageMs } from "./stats.js";
import { CAPS } from "./storage.js";

// Ein erster Lösungsversuch ist abgeschlossen.
// art: "neu" | "wiederholung"; placement: Rätsel der Einstufung (zählt für den K-Wert,
// die Stärke selbst wird erst am Ende der Einstufung gesetzt).
export function recordAttempt(t, { puzzle, art, solved, ms, today, nowIso, placement = false }) {
  const time = cappedMs(ms);
  t.versuche.push({ id: puzzle.id, t: nowIso, ok: solved, ms: time, r: puzzle.rating });
  addAttempt(t.themen, puzzle.themen, solved, time);
  t.gesehen[puzzle.id] = 1;

  // Wiederholung (Leitner): nicht gelöst = Stufe 1; richtig in der Wiederholung = eine Stufe höher.
  if (art === "wiederholung" && t.karten[puzzle.id]) {
    if (solved) {
      const next = afterSuccess(t.karten[puzzle.id], today);
      if (next) t.karten[puzzle.id] = next;
      else delete t.karten[puzzle.id];
    } else {
      t.karten[puzzle.id] = afterFailure(puzzle, today);
    }
  } else if (!solved) {
    t.karten[puzzle.id] = afterFailure(puzzle, today);
  }

  // Taktikstärke: nur neue Rätsel werten (Wiederholungen sind bekannte Rätsel).
  if (art === "neu") {
    if (!placement && t.staerke !== null) t.staerke = updateStrength(t.staerke, puzzle.rating, solved, t.anzahl);
    t.anzahl += 1;
  }
  trimTaktik(t);
}

export function trimTaktik(t) {
  for (const key of Object.keys(CAPS)) {
    if (t[key].length > CAPS[key]) t[key] = t[key].slice(-CAPS[key]);
  }
}

// Sitzung abschließen: Eintrag in die Sitzungsliste und Punkt im Stärkeverlauf.
// results: [{ id, themen, ok, ms, art }]. Gibt die Zusammenfassung zurück.
export function finishSession(t, { typ, results, nowIso }) {
  const ok = results.filter((r) => r.ok).length;
  const summary = {
    typ,
    n: results.length,
    ok,
    fehler: results.length - ok,
    msSchnitt: Math.round(averageMs(results)),
    schwaechstes: sessionWeakest(results),
  };
  t.sitzungen.push({ datum: nowIso, ...summary, staerke: t.staerke === null ? null : Math.round(t.staerke) });
  if (t.staerke !== null) t.verlauf.push({ t: nowIso, s: Math.round(t.staerke) });
  trimTaktik(t);
  return { ...summary, staerke: t.staerke === null ? null : Math.round(t.staerke) };
}

// Einstufung abschließen.
export function applyPlacement(t, estimate) {
  t.staerke = estimate;
  t.eingestuft = true;
}

// Ergebnis der Standortbestimmung mit Datum speichern.
export function recordStandort(t, { results, satz, nowIso }) {
  const entry = {
    datum: nowIso,
    geloest: results.filter((r) => r.ok).length,
    von: results.length,
    msSchnitt: Math.round(averageMs(results)),
    satz,
  };
  t.standort.push(entry);
  trimTaktik(t);
  return entry;
}
