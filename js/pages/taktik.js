// Seite "Taktik": Einstufung, Sitzungen mit Rätseln, Wiederholung, Zusammenfassung.
// Rechenlogik steckt in rating.js, leitner.js, session.js, stats.js und taktik-state.js.

import { store } from "../storage.js";
import { puzzleStore } from "../puzzles.js";
import { createRunner, Cancelled } from "../puzzle-runner.js";
import { placementNextTarget, placementEstimate, PLACEMENT_COUNT, bandsFor } from "../rating.js";
import { dayKey, dueCards } from "../leitner.js";
import { buildSession } from "../session.js";
import { weakestThemes } from "../stats.js";
import { recordAttempt, finishSession, applyPlacement, recordStandort } from "../taktik-state.js";
import { themeLabel, allThemes } from "../themes.js";

const $ = (id) => document.getElementById(id);
const today = () => dayKey(store.now());
const nowIso = () => store.now().toISOString();
const taktik = () => store.get().taktik;

let runner = null;
let running = false;
let loopToken = 0;
let waitForNext = null; // Auflösen, wenn "Weiter" getippt wird
let autoRun = false; // Standortbestimmung wurde von der Statistik-Seite gestartet
let pendingTheme = null; // "Dieses Thema üben" von der Statistik-Seite

const VIEWS = ["taktik-start", "taktik-lauf", "taktik-zusammenfassung"];
function showView(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
}

function setMessage(text, isError = false) {
  const el = $("taktik-meldung");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function seconds(ms) {
  return `${Math.round(ms / 1000)} Sekunden`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- Startansicht ----------

function renderStart() {
  const t = taktik();
  const aktiv = t.aktiv;

  $("taktik-staerke").textContent = t.eingestuft && t.staerke !== null ? `Taktikstärke: ${Math.round(t.staerke)}` : "Noch nicht eingestuft";
  const due = dueCards(t.karten, today()).length;
  $("taktik-info").textContent = t.eingestuft ? `Fällige Wiederholungen: ${due}` : "";

  $("taktik-fortsetzen").hidden = !aktiv;
  $("taktik-einstufung").hidden = !!aktiv || t.eingestuft;
  $("taktik-training").hidden = !!aktiv || !t.eingestuft;
  if (aktiv) {
    const label = { einstufung: "Die Einstufung", sitzung: "Die Sitzung", standort: "Die Standortbestimmung" }[aktiv.typ];
    $("taktik-fortsetzen-text").textContent = `${label} ist noch nicht beendet (Rätsel ${Math.min(aktiv.index + 1, totalOf(aktiv))} von ${totalOf(aktiv)}).`;
  }

  const select = $("sel-thema");
  if (!select.options.length) {
    select.add(new Option("Alle Themen", ""));
    const themes = allThemes().map((tag) => [tag, themeLabel(tag)]).sort((a, b) => a[1].localeCompare(b[1], "de"));
    for (const [tag, label] of themes) select.add(new Option(label, tag));
  }

  const last = t.standort[t.standort.length - 1];
  $("taktik-standort-info").textContent = last ? `Letzte Standortbestimmung: ${formatDate(last.datum)}.` : "";

  warmForOffline();
}

// Bänder rund um die eigene Stärke und das Prüfset vorab laden, damit sie offline bereitstehen.
function warmForOffline() {
  const t = taktik();
  if (!t.eingestuft || t.staerke === null) return;
  puzzleStore.warmBands(bandsFor(t.staerke - 150, t.staerke + 250));
  puzzleStore.warmPruefset();
}

function totalOf(a) {
  return a.typ === "einstufung" ? PLACEMENT_COUNT : a.plan.length;
}

// ---------- Rätsel auswählen ----------

function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

async function addPlacementPuzzle(a) {
  const target = placementNextTarget(a.placement);
  const known = new Set([...Object.keys(taktik().gesehen), ...a.plan.map((i) => i.puzzle.id)]);
  let candidates = [];
  for (const spread of [80, 160, 320]) {
    candidates = (await puzzleStore.inRange(target - spread, target + spread)).filter((p) => !known.has(p.id));
    if (candidates.length >= 5) break;
  }
  if (!candidates.length) throw new Error("keine Rätsel");
  candidates.sort((x, y) => Math.abs(x.rating - target) - Math.abs(y.rating - target));
  const puzzle = pick(candidates.slice(0, 15));
  store.update((d) => d.taktik.aktiv.plan.push({ art: "neu", puzzle, target }));
}

async function planSession(size, filter) {
  const t = taktik();
  const strength = t.staerke;
  const known = new Set([...Object.keys(t.gesehen), ...Object.keys(t.karten)]);
  let candidates = [];
  for (const widen of [0, 100, 250, 500]) {
    const all = await puzzleStore.inRange(strength - 50 - widen, strength + 150 + widen);
    candidates = all.filter((p) => !known.has(p.id) && (!filter || p.themen.includes(filter)));
    if (candidates.length >= size * 3) break;
  }
  if (candidates.length < size) {
    // Vorrat ausgeschöpft: auch schon gesehene Rätsel zulassen.
    const all = await puzzleStore.inRange(strength - 150, strength + 250);
    candidates = all.filter((p) => !t.karten[p.id] && (!filter || p.themen.includes(filter)));
  }
  const weak = weakestThemes(t.themen, 3).map((x) => x.tag);
  return buildSession({ size, due: dueCards(t.karten, today()), candidates, weakThemes: weak, themeFilter: filter || null });
}

// ---------- Starten ----------

async function guarded(fn) {
  setMessage("");
  try {
    await fn();
  } catch (err) {
    if (err instanceof Cancelled) return;
    setMessage("Die Rätsel konnten nicht geladen werden. Beim ersten Mal wird eine Internetverbindung gebraucht.", true);
  }
}

async function startEinstufung() {
  await guarded(async () => {
    const a = { typ: "einstufung", plan: [], index: 0, ergebnisse: [], placement: [], start: nowIso() };
    store.update((d) => {
      d.taktik.aktiv = a;
    });
    await addPlacementPuzzle(a);
    beginRun();
  });
}

async function startSitzung() {
  await guarded(async () => {
    const size = Number($("sel-groesse").value);
    const filter = $("sel-thema").value;
    $("btn-sitzung").disabled = true;
    try {
      const plan = await planSession(size, filter);
      if (!plan.length) {
        setMessage("Dazu gibt es gerade keine passenden Rätsel.", true);
        return;
      }
      store.update((d) => {
        d.taktik.aktiv = { typ: "sitzung", plan, index: 0, ergebnisse: [], filter, start: nowIso() };
      });
      beginRun();
    } finally {
      $("btn-sitzung").disabled = false;
    }
  });
}

// Wird von der Statistik-Seite aufgerufen.
export async function startStandortbestimmung() {
  const pruefset = await puzzleStore.loadPruefset();
  store.update((d) => {
    d.taktik.aktiv = {
      typ: "standort",
      plan: pruefset.raetsel.map((puzzle) => ({ art: "neu", puzzle })),
      index: 0,
      ergebnisse: [],
      satz: pruefset.satz,
      start: nowIso(),
    };
  });
  autoRun = true;
  location.hash = "#/taktik";
}

// Wird von der Statistik-Seite aufgerufen: eine Sitzung nur mit diesem Thema starten.
export function practiceTheme(tag) {
  pendingTheme = tag;
  location.hash = "#/taktik";
}

// ---------- Ablauf ----------

function beginRun() {
  showView("taktik-lauf");
  $("beenden-bestaetigung").hidden = true;
  running = true;
  runLoop();
}

function abortRun() {
  if (!running) return;
  running = false;
  loopToken += 1;
  if (runner) runner.cancel();
  if (waitForNext) waitForNext.cancel();
  waitForNext = null;
}

function waitForWeiter() {
  return new Promise((resolve, reject) => {
    const button = $("btn-weiter");
    button.hidden = false;
    waitForNext = {
      cancel: () => {
        button.hidden = true;
        reject(new Cancelled());
      },
    };
    button.onclick = () => {
      button.hidden = true;
      waitForNext = null;
      resolve();
    };
  });
}

function artText(a, item) {
  if (a.typ === "einstufung") return "Einstufung";
  if (a.typ === "standort") return "Standortbestimmung";
  return item.art === "wiederholung" ? "Wiederholung" : "";
}

async function runLoop() {
  const token = ++loopToken;
  if (!runner) runner = createRunner($("taktik-board"));
  try {
    for (;;) {
      const a = taktik().aktiv;
      if (!a) return;
      if (a.index >= totalOf(a)) break;
      if (!a.plan[a.index]) await addPlacementPuzzle(a);
      if (token !== loopToken) return;
      const item = taktik().aktiv.plan[a.index];

      $("lauf-fortschritt").textContent = `Rätsel ${a.index + 1} von ${totalOf(a)}`;
      $("lauf-art").textContent = artText(a, item);
      $("lauf-seite").textContent = "";
      $("lauf-meldung").textContent = "";
      $("btn-weiter").hidden = true;

      const result = await runner.solve(item.puzzle, {
        onReady: ({ color }) => {
          $("lauf-seite").textContent = color === "white" ? "Weiß am Zug" : "Schwarz am Zug";
        },
      });
      if (token !== loopToken) return;

      store.update((d) => {
        const t = d.taktik;
        const cur = t.aktiv;
        if (cur.typ !== "standort") {
          recordAttempt(t, {
            puzzle: item.puzzle,
            art: item.art,
            solved: result.solved,
            ms: result.ms,
            today: today(),
            nowIso: nowIso(),
            placement: cur.typ === "einstufung",
          });
        }
        cur.ergebnisse.push({ id: item.puzzle.id, themen: item.puzzle.themen, ok: result.solved, ms: result.ms, art: item.art });
        if (cur.typ === "einstufung") cur.placement.push({ target: item.target, rating: item.puzzle.rating, solved: result.solved });
        cur.index += 1;
      });

      if (a.typ === "standort") {
        $("lauf-meldung").textContent = "Antwort gespeichert.";
      } else if (result.solved) {
        $("lauf-meldung").textContent = "Richtig.";
      } else {
        $("lauf-meldung").textContent = "Nicht gelöst. Die richtige Zugfolge wird gezeigt.";
        await runner.showSolution(item.puzzle);
        $("lauf-meldung").textContent = "Jetzt spiele die Zugfolge selbst nach.";
        await runner.replay(item.puzzle);
        $("lauf-meldung").textContent = "Geschafft. Weiter, wenn du bereit bist.";
      }
      if (token !== loopToken) return;
      await waitForWeiter();
    }
    await finishRun();
  } catch (err) {
    if (err instanceof Cancelled) return;
    running = false;
    showView("taktik-start");
    renderStart();
    setMessage("Es ist ein Fehler aufgetreten. Du kannst die Sitzung fortsetzen.", true);
    console.error(err);
  }
}

// ---------- Abschluss ----------

function facts(rows) {
  const dl = $("zus-fakten");
  dl.innerHTML = "";
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.append(dt, dd);
    dl.append(row);
  }
}

function showSummary(typ, s) {
  running = false;
  showView("taktik-zusammenfassung");
  if (typ === "standort") {
    $("zus-titel").textContent = "Standortbestimmung abgeschlossen";
    facts([
      ["Gelöst", `${s.geloest} von ${s.von}`],
      ["Durchschnittliche Zeit", `${seconds(s.msSchnitt)} je Rätsel`],
      ["Gespeichert am", formatDate(s.datum)],
    ]);
    return;
  }
  $("zus-titel").textContent = typ === "einstufung" ? "Einstufung abgeschlossen" : "Sitzung beendet";
  const rows = [];
  if (typ === "einstufung") rows.push(["Geschätzte Taktikstärke", String(s.staerke)]);
  rows.push(
    ["Gelöst", `${s.ok} von ${s.n}`],
    ["Fehler", String(s.fehler)],
    ["Durchschnittliche Zeit", `${seconds(s.msSchnitt)} je Rätsel`],
    ["Schwächstes Thema dieser Sitzung", s.schwaechstes ? themeLabel(s.schwaechstes) : "keines (keine Fehler)"],
  );
  if (typ === "sitzung" && s.staerke !== null) rows.push(["Taktikstärke", String(s.staerke)]);
  facts(rows);
}

async function finishRun() {
  const a = taktik().aktiv;
  let summary;
  store.update((d) => {
    const t = d.taktik;
    if (a.typ === "einstufung") {
      applyPlacement(t, placementEstimate(a.placement));
      summary = finishSession(t, { typ: a.typ, results: a.ergebnisse, nowIso: nowIso() });
    } else if (a.typ === "sitzung") {
      summary = finishSession(t, { typ: a.typ, results: a.ergebnisse, nowIso: nowIso() });
    } else {
      summary = recordStandort(t, { results: a.ergebnisse, satz: a.satz, nowIso: nowIso() });
    }
    t.aktiv = null;
  });
  document.dispatchEvent(new CustomEvent("daten-geaendert"));
  showSummary(a.typ, summary);
}

function askEnd() {
  const a = taktik().aktiv;
  const text = {
    sitzung: a.ergebnisse.length ? "Die Sitzung beenden? Die bisherigen Ergebnisse werden gespeichert." : "Die Sitzung beenden?",
    einstufung: "Die Einstufung abbrechen? Du kannst sie später neu beginnen. Die bisher gespielten Rätsel bleiben in der Statistik.",
    standort: "Die Standortbestimmung abbrechen? Es wird kein Ergebnis gespeichert.",
  }[a.typ];
  $("beenden-text").textContent = text;
  $("beenden-bestaetigung").hidden = false;
}

async function endEarly() {
  const a = taktik().aktiv;
  abortRun();
  if (a.typ === "sitzung" && a.ergebnisse.length > 0) {
    let summary;
    store.update((d) => {
      summary = finishSession(d.taktik, { typ: "sitzung", results: a.ergebnisse, nowIso: nowIso() });
      d.taktik.aktiv = null;
    });
    document.dispatchEvent(new CustomEvent("daten-geaendert"));
    showSummary("sitzung", summary);
    return;
  }
  store.update((d) => {
    d.taktik.aktiv = null;
  });
  showView("taktik-start");
  renderStart();
}

// ---------- Anbindung ----------

export function onShowTaktik() {
  if (autoRun && taktik().aktiv) {
    autoRun = false;
    beginRun();
    return;
  }
  if (running) return;
  showView("taktik-start");
  renderStart();
  if (pendingTheme) {
    const tag = pendingTheme;
    pendingTheme = null;
    $("sel-thema").value = tag;
    if (!taktik().aktiv && taktik().eingestuft) startSitzung();
  }
}

export function initTaktik() {
  $("btn-einstufung").addEventListener("click", startEinstufung);
  $("btn-sitzung").addEventListener("click", startSitzung);
  $("btn-fortsetzen").addEventListener("click", () => guarded(async () => {
    const a = taktik().aktiv;
    if (a.typ === "einstufung" && !a.plan[a.index]) await addPlacementPuzzle(a);
    beginRun();
  }));
  $("btn-verwerfen").addEventListener("click", () => {
    store.update((d) => {
      d.taktik.aktiv = null;
    });
    renderStart();
  });
  $("btn-beenden").addEventListener("click", askEnd);
  $("btn-beenden-nein").addEventListener("click", () => {
    $("beenden-bestaetigung").hidden = true;
  });
  $("btn-beenden-ja").addEventListener("click", endEarly);
  $("btn-zus-zurueck").addEventListener("click", () => {
    showView("taktik-start");
    renderStart();
  });
  document.addEventListener("sw-ready", warmForOffline);
  window.addEventListener("hashchange", () => {
    if (running && !/^#\/taktik\/?$/.test(location.hash)) abortRun();
  });
  document.addEventListener("daten-geaendert", () => {
    if (!running && !$("taktik-start").hidden) renderStart();
  });
}
