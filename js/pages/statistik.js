// Seite "Statistik": Taktikstärke im Verlauf, Sitzungen pro Woche, Themen, schwächste Themen
// zum Üben und die Standortbestimmung. Alles ruhig und sachlich: keine Punkte, keine Effekte.

import { store } from "../storage.js";
import { puzzleStore } from "../puzzles.js";
import { themeStats, weakestThemes, sessionsPerWeek, MIN_ATTEMPTS } from "../stats.js";
import { themeLabel } from "../themes.js";
import { dayKey } from "../leitner.js";
import { practiceTheme, startStandortbestimmung, startFromStatistik } from "./taktik.js";

const $ = (id) => document.getElementById(id);
const taktik = () => store.get().taktik;
const SVG = "http://www.w3.org/2000/svg";

const percent = (rate) => `${Math.round(rate * 100)} %`;
const seconds = (ms) => `${Math.round(ms / 1000)} Sekunden`;
const shortDate = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
const longDate = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

function svgEl(name, attrs = {}, text = null) {
  const el = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== null) el.textContent = text;
  return el;
}

// Einfaches Liniendiagramm: ein Punkt je Sitzung, gleiche Abstände, keine Füllung, keine Animation.
function renderChart(verlauf) {
  const box = $("stat-diagramm");
  box.innerHTML = "";
  if (verlauf.length < 2) {
    $("stat-diagramm-hinweis").textContent = "Der Verlauf erscheint nach der zweiten Sitzung.";
    return;
  }
  const W = 340;
  const H = 160;
  const left = 38;
  const right = 10;
  const top = 12;
  const bottom = 26;
  const values = verlauf.map((p) => p.s);
  const lo = Math.floor((Math.min(...values) - 10) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 10) / 50) * 50;
  const x = (i) => left + (i * (W - left - right)) / (verlauf.length - 1);
  const y = (v) => top + ((hi - v) * (H - top - bottom)) / (hi - lo);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "chart-svg" });
  svg.setAttribute("aria-label", `Verlauf der Taktikstärke: von ${values[0]} auf ${values[values.length - 1]} in ${verlauf.length} Sitzungen`);
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg.append(svgEl("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), class: "chart-grid" }));
    svg.append(svgEl("text", { x: left - 6, y: y(v) + 4, class: "chart-label", "text-anchor": "end" }, Math.round(v)));
  }
  const points = verlauf.map((p, i) => `${x(i).toFixed(1)},${y(p.s).toFixed(1)}`).join(" ");
  svg.append(svgEl("polyline", { points, class: "chart-line", fill: "none" }));
  svg.append(svgEl("circle", { cx: x(verlauf.length - 1), cy: y(values[values.length - 1]), r: 3.5, class: "chart-dot" }));
  svg.append(svgEl("text", { x: left, y: H - 6, class: "chart-label", "text-anchor": "start" }, shortDate(verlauf[0].t)));
  svg.append(svgEl("text", { x: W - right, y: H - 6, class: "chart-label", "text-anchor": "end" }, shortDate(verlauf[verlauf.length - 1].t)));
  box.append(svg);
  $("stat-diagramm-hinweis").textContent = "Ein Punkt je Sitzung.";
}

function renderWeeks(sitzungen) {
  const weeks = sessionsPerWeek(sitzungen, dayKey(store.now()), 8);
  const max = Math.max(1, ...weeks.map((w) => w.anzahl));
  const list = $("stat-wochen");
  list.innerHTML = "";
  for (const w of weeks) {
    const li = document.createElement("li");
    li.className = "week-row";
    const label = document.createElement("span");
    label.className = "week-label";
    label.textContent = `Woche ab ${new Date(`${w.start}T12:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}`;
    const bar = document.createElement("span");
    bar.className = "week-bar";
    const fill = document.createElement("span");
    fill.style.width = `${(w.anzahl / max) * 100}%`;
    bar.append(fill);
    const count = document.createElement("span");
    count.className = "week-count";
    count.textContent = String(w.anzahl);
    li.append(label, bar, count);
    list.append(li);
  }
}

function themeLine(t) {
  if (!t.enough) return `zu wenig Daten (${t.n} ${t.n === 1 ? "Versuch" : "Versuche"}, mindestens ${MIN_ATTEMPTS})`;
  return `Trefferquote ${percent(t.rate)}, durchschnittlich ${seconds(t.avgMs)}, ${t.n} Versuche`;
}

function renderThemes(themen) {
  const stats = themeStats(themen).sort((a, b) => {
    if (a.enough !== b.enough) return a.enough ? -1 : 1;
    return a.enough ? a.rate - b.rate || themeLabel(a.tag).localeCompare(themeLabel(b.tag), "de") : b.n - a.n || themeLabel(a.tag).localeCompare(themeLabel(b.tag), "de");
  });
  $("stat-themen-leer").hidden = stats.length > 0;
  const list = $("stat-themen");
  list.innerHTML = "";
  for (const t of stats) {
    const li = document.createElement("li");
    li.className = "stat-row";
    const name = document.createElement("strong");
    name.textContent = themeLabel(t.tag);
    const line = document.createElement("span");
    line.className = "muted";
    line.textContent = themeLine(t);
    li.append(name, line);
    list.append(li);
  }

  const weak = weakestThemes(themen, 3);
  const weakList = $("stat-schwach");
  weakList.innerHTML = "";
  const empty = $("stat-schwach-leer");
  empty.hidden = weak.length > 0;
  empty.textContent = `Noch zu wenig Daten: ein Thema braucht mindestens ${MIN_ATTEMPTS} Versuche.`;
  for (const t of weak) {
    const li = document.createElement("li");
    li.className = "weak-row";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = themeLabel(t.tag);
    const line = document.createElement("span");
    line.className = "muted";
    line.textContent = `Trefferquote ${percent(t.rate)} bei ${t.n} Versuchen`;
    text.append(name, document.createElement("br"), line);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Dieses Thema üben";
    button.addEventListener("click", () => {
      if (taktik().aktiv) {
        $("stat-schwach-meldung").textContent = "Es läuft gerade eine Sitzung. Beende oder verwirf sie zuerst auf der Seite Üben.";
        return;
      }
      practiceTheme(t.tag);
    });
    li.append(text, button);
    weakList.append(li);
  }
  $("stat-schwach-meldung").textContent = "";
}

async function renderStandort() {
  const t = taktik();
  const list = $("stat-standort-liste");
  list.innerHTML = "";
  $("stat-standort-leer").hidden = t.standort.length > 0;

  let satz = null;
  let verfuegbar = true;
  try {
    satz = (await puzzleStore.loadPruefset()).satz;
  } catch (err) {
    verfuegbar = false;
  }

  for (const e of [...t.standort].reverse()) {
    const li = document.createElement("li");
    const other = satz && e.satz && e.satz !== satz ? " (anderer Prüfsatz)" : "";
    li.textContent = `${longDate(e.datum)}: ${e.geloest} von ${e.von} gelöst, durchschnittlich ${seconds(e.msSchnitt)} je Rätsel${other}`;
    list.append(li);
  }

  const button = $("btn-standort");
  const note = $("stat-standort-meldung");
  if (t.aktiv) {
    button.disabled = true;
    note.textContent = "Es läuft gerade eine Sitzung. Beende oder verwirf sie zuerst auf der Seite Üben.";
  } else if (!verfuegbar) {
    button.disabled = true;
    note.textContent = "Die Prüfrätsel sind gerade nicht verfügbar (Daten fehlen oder keine Verbindung).";
  } else {
    button.disabled = false;
    note.textContent = t.standort.length ? `Letzte Standortbestimmung: ${longDate(t.standort[t.standort.length - 1].datum)}.` : "";
  }
}

// Leerer Zustand: erklärender Satz und ein Knopf zur passenden Aktion statt einer leeren Seite.
function renderLeer(t) {
  const hasData = t.sitzungen.length > 0;
  $("stat-inhalt").hidden = !hasData;
  $("stat-leer").hidden = hasData;
  if (hasData) return;
  const button = $("btn-stat-leer");
  if (t.aktiv) {
    $("stat-leer-text").textContent = "Eine Sitzung läuft noch. Beende sie, dann erscheinen hier dein Verlauf und deine Themen.";
    button.textContent = "Zur Sitzung";
    button.dataset.aktion = "sitzung-fortsetzen";
  } else if (!t.eingestuft) {
    $("stat-leer-text").textContent =
      "Die Statistik füllt sich, sobald du Rätsel gelöst hast. Starte mit der Einstufung: 10 Rätsel, danach passt die App die Schwierigkeit an dich an.";
    button.textContent = "Einstufung starten";
    button.dataset.aktion = "einstufung";
  } else {
    $("stat-leer-text").textContent = "Noch keine Sitzung gespielt. Nach der ersten Sitzung erscheinen hier dein Verlauf und deine Themen.";
    button.textContent = "Sitzung starten";
    button.dataset.aktion = "sitzung";
  }
}

export function onShowStatistik() {
  const t = taktik();
  renderLeer(t);
  $("stat-staerke").textContent = t.eingestuft && t.staerke !== null ? `Taktikstärke: ${Math.round(t.staerke)}` : "Noch nicht eingestuft";
  renderChart(t.verlauf);
  renderWeeks(t.sitzungen);
  renderThemes(t.themen);
  renderStandort();
}

export function initStatistik() {
  $("btn-stat-leer").addEventListener("click", () => {
    const aktion = $("btn-stat-leer").dataset.aktion;
    if (aktion === "sitzung-fortsetzen") location.hash = "#/taktik";
    else startFromStatistik(aktion);
  });
  $("btn-standort").addEventListener("click", async () => {
    $("btn-standort").disabled = true;
    try {
      await startStandortbestimmung();
    } catch (err) {
      $("stat-standort-meldung").textContent = "Die Prüfrätsel konnten nicht geladen werden.";
      $("btn-standort").disabled = false;
    }
  });
  document.addEventListener("daten-geaendert", () => {
    if (!$("page-statistik").hidden) onShowStatistik();
  });
}
