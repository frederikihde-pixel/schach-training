// Auswertung für die Seite "Fortschritt". Reine Logik auf dem Speicherstand (`state.spielen`).
//
// Es zählen nur Partien mit der AKTUELLEN Stufenversion; frühere Versionen werden getrennt gezählt (aeltereVersionen),
// weil die Stufen sich zwischen Versionen ändern können und Ergebnisse sonst nicht vergleichbar wären.
// Partien MIT eingeschalteter Patzer-Warnung werden getrennt von Partien ohne Warnung gezählt.

import { STUFENVERSION } from "./stufen.js";
import { ANALYSE_VERSION } from "./analyse.js";

export const MIN_PARTIEN = 5; // darunter: "zu wenig Daten"
export const FENSTER = 5; // Mittel der letzten 5 Partien
export const AUSSAGEKRAEFTIG_AB = 10; // ehrlicher Hinweis: erst ab dieser Zahl sind die Zahlen aussagekräftig

const version = (e) => e.stufenversion ?? 1;
const durchschnitt = (liste) => (liste.length ? liste.reduce((s, x) => s + x, 0) / liste.length : null);

// Zählt gewonnen, remis, verloren.
export function bilanz(liste) {
  const b = { n: liste.length, gewonnen: 0, remis: 0, verloren: 0 };
  for (const e of liste) b[e.ausgang] += 1;
  return b;
}

// Partien (Modus "partie") der aktuellen Version, getrennt nach Patzer-Warnung.
export function partienGruppe(spielen, { stufenversion = STUFENVERSION, warnung = false } = {}) {
  return spielen.partien.filter((p) => p.modus === "partie" && version(p) === stufenversion && !!p.warnung === warnung);
}

// Auswertung einer Gruppe. Alles in Zahlen; die Seite formuliert den Text.
export function auswertung(spielen, { stufenversion = STUFENVERSION, warnung = false } = {}) {
  const partien = partienGruppe(spielen, { stufenversion, warnung });
  const out = { anzahl: partien.length, genug: partien.length >= MIN_PARTIEN, proStufe: [], analysiert: 0, genugAnalyse: false };

  const stufen = [...new Set(partien.map((p) => p.stufe))].sort((a, b) => a - b);
  out.proStufe = stufen.map((s) => ({ stufe: s, ...bilanz(partien.filter((p) => p.stufe === s)) }));

  const mitAnalyse = partien
    .map((p) => ({ p, a: spielen.analysen.find((x) => x.id === p.id && (x.version ?? 1) === ANALYSE_VERSION) }))
    .filter((x) => x.a);
  out.analysiert = mitAnalyse.length;
  out.genugAnalyse = mitAnalyse.length >= MIN_PARTIEN;

  // Patzer je Partie (nur analysierte), Mittel der letzten 5, chronologisch
  out.patzerProPartie = mitAnalyse.map(({ p, a }, i) => {
    const fenster = mitAnalyse.slice(Math.max(0, i - FENSTER + 1), i + 1).map((x) => x.a.summe.patzer);
    return { id: p.id, datum: p.datum, patzer: a.summe.patzer, mittel: i + 1 >= FENSTER ? durchschnitt(fenster) : null };
  });
  const mittel = out.patzerProPartie.filter((x) => x.mittel !== null);
  out.patzerMittel5 = mittel.length ? mittel[mittel.length - 1].mittel : null;

  const zuege = mitAnalyse.reduce((s, x) => s + x.a.summe.zuege, 0);
  out.verlustProZug = zuege ? mitAnalyse.reduce((s, x) => s + x.a.summe.verlustSumme, 0) / zuege : null; // Centipawn

  const phasen = { eroeffnung: 0, mittelspiel: 0, endspiel: 0 };
  const arten = { figur: 0, drohung: 0, chance: 0, sonstig: 0 };
  for (const { a } of mitAnalyse) {
    for (const e of a.eintraege) {
      if (e.art === "patzer") phasen[e.phase] += 1;
      // Matt erlaubt gilt als "Drohung übersehen"
      arten[e.ursache === "matt" ? "drohung" : e.ursache] += 1;
    }
  }
  out.patzerPhasen = phasen;
  out.fehlerArten = arten;
  out.patzerGesamt = phasen.eroeffnung + phasen.mittelspiel + phasen.endspiel;
  out.fehlerGesamt = arten.figur + arten.drohung + arten.chance + arten.sonstig;
  return out;
}

// Grundmatts: Quote und die letzten 5 Versuche je Figur.
export function grundmattZahlen(spielen, { stufenversion = STUFENVERSION } = {}) {
  const alle = spielen.versuche.filter((v) => v.modus === "grundmatt" && version(v) === stufenversion);
  const zahlen = (liste) => {
    const erfolge = liste.filter((v) => v.matt);
    return { n: liste.length, erfolge: erfolge.length, quote: liste.length ? erfolge.length / liste.length : null, schnitt: durchschnitt(erfolge.map((v) => v.mattIn)) };
  };
  const out = { gesamt: zahlen(alle), arten: {} };
  for (const art of ["dame", "turm"]) {
    const liste = alle.filter((v) => v.art === art);
    out.arten[art] = { alle: zahlen(liste), letzte5: zahlen(liste.slice(-FENSTER)) };
  }
  return out;
}

// Vorteil verwerten: Quote gewonnen (gewonnen, remis, verloren), insgesamt und je Vorteil.
export function vorteilZahlen(spielen, { stufenversion = STUFENVERSION } = {}) {
  const alle = spielen.versuche.filter((v) => v.modus === "vorteil" && version(v) === stufenversion);
  const mit = (liste) => ({ ...bilanz(liste), quote: liste.length ? liste.filter((v) => v.ausgang === "gewonnen").length / liste.length : null });
  const out = { gesamt: mit(alle), arten: {} };
  for (const art of ["dame", "turm", "springer"]) out.arten[art] = mit(alle.filter((v) => v.art === art));
  return out;
}

// Frühere (und spätere) Stufenversionen: getrennt gezählt, nicht in die Auswertung einbezogen.
export function aeltereVersionen(spielen, { stufenversion = STUFENVERSION } = {}) {
  const map = new Map();
  for (const e of [...spielen.partien, ...spielen.versuche]) {
    const v = version(e);
    if (v === stufenversion) continue;
    const eintrag = map.get(v) || { version: v, partien: 0, versuche: 0, gewonnen: 0, remis: 0, verloren: 0 };
    if (e.modus === "partie") eintrag.partien += 1;
    else eintrag.versuche += 1;
    eintrag[e.ausgang] += 1;
    map.set(v, eintrag);
  }
  return [...map.values()].sort((a, b) => a.version - b.version);
}

// Ruhiger Satz über die Menge der Daten: ab wann die Zahlen etwas aussagen.
export function aussagekraft(anzahl) {
  if (anzahl < MIN_PARTIEN) return "zu wenig Daten";
  if (anzahl < AUSSAGEKRAEFTIG_AB) return "noch wenig Daten";
  return "genug Daten für eine grobe Einschätzung";
}

export function formatBauerneinheiten(cp) {
  return (Math.round(cp / 10) / 10).toFixed(1).replace(".", ",");
}
