// Stufenempfehlung aus den letzten Partien (Modus "partie"), ruhig formuliert, ohne Auszeichnung.
// Regel: Gewinne ich auf Stufe N in mindestens 3 der letzten 5 Partien auf dieser Stufe, wird N+1 empfohlen.
// Verliere ich 4 der letzten 5, wird N-1 empfohlen; sonst bleibt es bei N. Bezugsstufe ist die Stufe der
// zuletzt gespielten Partie. Es braucht mindestens 3 Partien auf dieser Stufe. Zusatz (Entscheidung des
// Autors): Wurden genau 3 Partien auf der Stufe gespielt und alle verloren, wird ebenfalls N-1 empfohlen.

import { STUFEN } from "./stufen.js";

export const MIN_PARTIEN = 3;
export const FENSTER = 5;

export function empfehlung(partien) {
  const echte = partien.filter((p) => p.modus === "partie");
  if (!echte.length) return null;
  const N = echte[echte.length - 1].stufe;
  const auf = echte.filter((p) => p.stufe === N).slice(-FENSTER);
  if (auf.length < MIN_PARTIEN) return null;
  const siege = auf.filter((p) => p.ausgang === "gewonnen").length;
  const remis = auf.filter((p) => p.ausgang === "remis").length;
  const niederlagen = auf.filter((p) => p.ausgang === "verloren").length;
  const hoechste = STUFEN.length;
  let stufe = N;
  if (siege >= 3) stufe = Math.min(hoechste, N + 1);
  else if (niederlagen >= 4 || (auf.length === 3 && niederlagen === 3)) stufe = Math.max(1, N - 1);
  const bilanz = `Auf Stufe ${N} hast du die letzten ${auf.length} Partien so gespielt: ${siege} gewonnen, ${remis} remis, ${niederlagen} verloren.`;
  let satz;
  if (stufe > N) satz = `${bilanz} Du könntest Stufe ${stufe} versuchen.`;
  else if (stufe < N) satz = `${bilanz} Stufe ${stufe} könnte besser passen.`;
  else satz = `${bilanz} Bleib bei Stufe ${N}.`;
  return { stufe, aktuell: N, n: auf.length, siege, remis, niederlagen, satz };
}
