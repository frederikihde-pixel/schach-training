// Seite "Spielen > Fortschritt": ruhige Zahlen aus den Partien. Rechnung in js/fortschritt.js.
// Es zählen nur Partien mit der aktuellen Stufenversion; Partien mit Patzer-Warnung werden getrennt gezählt.
import { store } from "../storage.js";
import { STUFENVERSION, stufenName } from "../stufen.js";
import { empfehlung } from "../empfehlung.js";
import { dayKey } from "../leitner.js";
import { eigeneZahlen } from "../eigene.js";
import { VORTEIL_ARTEN, GRUNDMATT } from "../uebungen.js";
import { auswertung, grundmattZahlen, vorteilZahlen, aeltereVersionen, aussagekraft, formatBauerneinheiten, MIN_PARTIEN, FENSTER } from "../fortschritt.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const prozent = (x) => `${Math.round(x * 100)} %`;
const komma = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");

function svgEl(name, attrs = {}, text = null) {
  const el = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== null) el.textContent = text;
  return el;
}

function zeile(dl, name, wert) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = name;
  const dd = document.createElement("dd");
  dd.textContent = wert;
  row.append(dt, dd);
  dl.appendChild(row);
}

function leeren(...ids) {
  for (const id of ids) $(id).innerHTML = "";
}

// Einfaches Liniendiagramm: Mittel der letzten 5 Partien (Patzer je Partie), gleiche Abstände, keine Füllung.
function diagramm(punkte) {
  const box = $("fs-diagramm");
  box.innerHTML = "";
  if (punkte.length < 2) {
    $("fs-diagramm-hinweis").textContent = `Das Diagramm erscheint, sobald ${FENSTER + 1} Partien einen Rückblick haben.`;
    return;
  }
  const W = 340;
  const H = 150;
  const left = 30;
  const right = 10;
  const top = 12;
  const bottom = 14;
  const hi = Math.max(1, Math.ceil(Math.max(...punkte)));
  const x = (i) => left + (i * (W - left - right)) / (punkte.length - 1);
  const y = (v) => top + ((hi - v) * (H - top - bottom)) / hi;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "chart-svg" });
  svg.setAttribute("aria-label", `Patzer pro Partie, Mittel der letzten ${FENSTER}: von ${komma(punkte[0])} auf ${komma(punkte[punkte.length - 1])}`);
  for (const v of [0, hi / 2, hi]) {
    svg.append(svgEl("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), class: "chart-grid" }));
    svg.append(svgEl("text", { x: left - 6, y: y(v) + 4, class: "chart-label", "text-anchor": "end" }, komma(v)));
  }
  svg.append(svgEl("polyline", { points: punkte.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" "), class: "chart-line", fill: "none" }));
  svg.append(svgEl("circle", { cx: x(punkte.length - 1), cy: y(punkte[punkte.length - 1]), r: 3.5, class: "chart-dot" }));
  box.append(svg);
  $("fs-diagramm-hinweis").textContent = `Ein Punkt je Partie mit Rückblick, jeweils das Mittel der letzten ${FENSTER}. Weniger ist besser.`;
}

function render() {
  const d = store.get();
  const sp = d.spielen;
  const warnung = $("fs-gruppe").value === "mit";
  $("fs-version").textContent = `Es zählen nur Partien mit der aktuellen Stufenversion (${STUFENVERSION}), die letzten 30 gespeicherten Partien.`;

  // Stufenempfehlung (ruhiger Satz)
  const emp = empfehlung(sp.partien);
  $("fs-empfehlung-text").textContent = emp ? emp.satz : "Noch keine Empfehlung. Sie erscheint, wenn du mindestens 3 Partien auf derselben Stufe gespielt hast.";

  const a = auswertung(sp, { warnung });
  const gruppe = warnung ? "mit Patzer-Warnung" : "ohne Patzer-Warnung";
  $("fs-anzahl").textContent = `Partien ${gruppe}: ${a.anzahl} (${aussagekraft(a.anzahl)}).`;
  leeren("fs-stufen");
  if (!a.genug) {
    zeile($("fs-stufen"), "Ergebnisse je Stufe", `zu wenig Daten (mindestens ${MIN_PARTIEN} Partien)`);
  } else {
    for (const s of a.proStufe) zeile($("fs-stufen"), `${stufenName(s.stufe)} (${s.n} ${s.n === 1 ? "Partie" : "Partien"})`, `${s.gewonnen} gewonnen, ${s.remis} remis, ${s.verloren} verloren`);
  }

  // Rückblick-Zahlen
  leeren("fs-zahlen", "fs-phasen", "fs-arten");
  const inhalt = $("fs-analyse-inhalt");
  if (!a.genug) {
    $("fs-analyse-text").textContent = "zu wenig Daten";
    inhalt.hidden = true;
  } else if (!a.genugAnalyse) {
    $("fs-analyse-text").textContent = `Für diese Zahlen brauchen mindestens ${MIN_PARTIEN} Partien einen Rückblick (bisher ${a.analysiert}). Den Rückblick findest du bei "Meine Partien".`;
    inhalt.hidden = true;
  } else {
    $("fs-analyse-text").textContent = `Aus ${a.analysiert} Partien mit Rückblick.`;
    inhalt.hidden = false;
    diagramm(a.patzerProPartie.filter((p) => p.mittel !== null).map((p) => p.mittel));
    zeile($("fs-zahlen"), `Patzer pro Partie (Mittel der letzten ${FENSTER})`, a.patzerMittel5 === null ? "-" : komma(a.patzerMittel5));
    zeile($("fs-zahlen"), "Durchschnittlicher Verlust pro Zug", `${formatBauerneinheiten(a.verlustProZug)} Bauerneinheiten`);
    const ph = a.patzerPhasen;
    const anteil = (n, ges) => (ges ? ` (${prozent(n / ges)})` : "");
    zeile($("fs-phasen"), "Eröffnung (Zug 1 bis 10)", `${ph.eroeffnung}${anteil(ph.eroeffnung, a.patzerGesamt)}`);
    zeile($("fs-phasen"), "Mittelspiel", `${ph.mittelspiel}${anteil(ph.mittelspiel, a.patzerGesamt)}`);
    zeile($("fs-phasen"), "Endspiel (wenige Figuren)", `${ph.endspiel}${anteil(ph.endspiel, a.patzerGesamt)}`);
    const fa = a.fehlerArten;
    zeile($("fs-arten"), "Figur eingestellt", `${fa.figur}${anteil(fa.figur, a.fehlerGesamt)}`);
    zeile($("fs-arten"), "Drohung übersehen", `${fa.drohung}${anteil(fa.drohung, a.fehlerGesamt)}`);
    zeile($("fs-arten"), "Chance verpasst", `${fa.chance}${anteil(fa.chance, a.fehlerGesamt)}`);
    zeile($("fs-arten"), "Sonstige Fehler", `${fa.sonstig}${anteil(fa.sonstig, a.fehlerGesamt)}`);
  }

  // Eigene Rätsel
  const e = eigeneZahlen(d, dayKey(store.now()));
  leeren("fs-eigene-zahlen");
  zeile($("fs-eigene-zahlen"), "Gespeicherte eigene Rätsel", String(e.anzahl));
  zeile($("fs-eigene-zahlen"), "Fällig", String(e.faellig));
  zeile($("fs-eigene-zahlen"), "Lösungsquote", e.versuche >= MIN_PARTIEN ? `${prozent(e.quote)} (${e.richtig} von ${e.versuche})` : `zu wenig Daten (${e.versuche} ${e.versuche === 1 ? "Versuch" : "Versuche"}, mindestens ${MIN_PARTIEN})`);

  // Grundmatts
  const g = grundmattZahlen(sp);
  leeren("fs-grundmatt-zahlen");
  if (!g.gesamt.n) zeile($("fs-grundmatt-zahlen"), "Versuche", "noch keine");
  for (const art of ["dame", "turm"]) {
    const z = g.arten[art];
    if (!z.alle.n) continue;
    const l = z.letzte5;
    zeile($("fs-grundmatt-zahlen"), `${GRUNDMATT[art].name}, letzte ${l.n} ${l.n === 1 ? "Versuch" : "Versuche"}`, `${l.erfolge} Matt${l.schnitt !== null ? `, im Mittel ${komma(l.schnitt)} Züge bis zum Matt` : ""}`);
    zeile($("fs-grundmatt-zahlen"), `${GRUNDMATT[art].kurz}: alle Versuche`, `${z.alle.erfolge} von ${z.alle.n} erfolgreich (${prozent(z.alle.quote)}); Referenz höchstens ${GRUNDMATT[art].referenz} Züge`);
  }

  // Vorteil verwerten
  const v = vorteilZahlen(sp);
  leeren("fs-vorteil-zahlen");
  if (!v.gesamt.n) zeile($("fs-vorteil-zahlen"), "Versuche", "noch keine");
  else {
    zeile($("fs-vorteil-zahlen"), "Quote gewonnen", `${prozent(v.gesamt.quote)} (${v.gesamt.gewonnen} gewonnen, ${v.gesamt.remis} remis, ${v.gesamt.verloren} verloren)`);
    for (const [art, z] of Object.entries(v.arten)) if (z.n) zeile($("fs-vorteil-zahlen"), VORTEIL_ARTEN[art].name, `${z.gewonnen} von ${z.n} gewonnen`);
  }

  // frühere Versionen
  const alt = aeltereVersionen(sp);
  $("fs-aeltere").hidden = alt.length === 0;
  leeren("fs-aeltere-zahlen");
  for (const x of alt) zeile($("fs-aeltere-zahlen"), `Stufenversion ${x.version}`, `${x.partien} Partien, ${x.versuche} Übungen: ${x.gewonnen} gewonnen, ${x.remis} remis, ${x.verloren} verloren`);
}

export function onShowFortschritt() {
  render();
}

export function initFortschritt() {
  $("fs-gruppe").addEventListener("change", render);
  document.addEventListener("daten-geaendert", render);
}
