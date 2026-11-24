// Seite "Rückblick": Fortschritt der Analyse, Liste der Fehler, Brett mit der Stelle (gleiches Brett und gleiche
// Designs wie der Rest der App), Erklärung und "Als Rätsel üben".
import { Chess } from "../../vendor/chess.js/chess.js";
import { Chessground } from "../../vendor/chessground/chessground.min.js";
import { store } from "../storage.js";
import { rueckblick } from "../rueckblick.js";
import { ART_TEXT, PHASE_TEXT } from "../analyse.js";
import { raetselFuerEintrag } from "../eigene.js";
import { dayKey } from "../leitner.js";
import { keepBoundsFresh, toColor } from "../ui/board-util.js";
import { stufenName } from "../stufen.js";
import { farbName } from "../partie.js";
import { datumText } from "./partien-liste.js";
import { startEigenesRaetsel } from "./taktik.js";

const $ = (id) => document.getElementById(id);

let aktuelleId = null;
let cg = null;
let index = 0; // Eintrag in der Detailansicht
let nachZug = false;

function spiel(id) {
  const sp = store.get().spielen;
  return sp.partien.find((p) => p.id === id) || sp.versuche.find((p) => p.id === id) || null;
}

function teile(show) {
  for (const id of ["rb-fortschritt", "rb-fehler", "rb-andere", "rb-ergebnis", "rb-detail"]) $(id).hidden = !show.includes(id);
}

const AUSGANG = { gewonnen: "gewonnen", remis: "remis", verloren: "verloren" };

// ---------- Einstieg ----------

export function zeigeRueckblick(id) {
  aktuelleId = id;
  const p = spiel(id);
  $("rb-btn-liste").hidden = false;
  if (!p || p.modus === "grundmatt") {
    $("rb-kopf").textContent = "Diese Partie gibt es nicht mehr oder sie lässt sich nicht analysieren.";
    teile([]);
    return;
  }
  $("rb-kopf").textContent = `${datumText(p.datum)}, ${stufenName(p.stufe)}, ${farbName(p.farbe)}, ${AUSGANG[p.ausgang]}`;
  const fertig = rueckblick.eintrag(id);
  if (fertig) return zeigeErgebnis(fertig);
  const st = rueckblick.status();
  if (st && st.id !== id) {
    teile(["rb-andere"]);
    $("rb-andere-link").setAttribute("href", `#/spielen/rueckblick/${st.id}`);
    return;
  }
  // Noch nicht analysiert: die Analyse beginnt jetzt (der Nutzer hat den Rückblick selbst geöffnet).
  rueckblick.starte({ id, pgn: p.pgn, farbe: p.farbe });
  zeigeFortschritt();
}

function zeigeFortschritt() {
  const st = rueckblick.status();
  if (!st || st.id !== aktuelleId) return;
  if (st.fehler && !st.laeuft) {
    teile(["rb-fortschritt", "rb-fehler"]);
    $("rb-fehler-text").textContent = `Die Analyse wurde unterbrochen (${st.fehler}). Sie kann bei Stellung ${st.fertig + 1} von ${st.gesamt} weitergehen.`;
  } else {
    teile(["rb-fortschritt"]);
  }
  $("rb-fortschritt-text").textContent = `Stellung ${Math.min(st.fertig + 1, st.gesamt)} von ${st.gesamt}`;
  $("rb-balken").max = st.gesamt;
  $("rb-balken").value = st.fertig;
}

// ---------- Ergebnis ----------

function zeigeErgebnis(a) {
  teile(["rb-ergebnis"]);
  const s = a.summe;
  $("rb-zusammen").textContent = `${s.patzer} ${s.patzer === 1 ? "Patzer" : "Patzer"}, ${s.fehler} ${s.fehler === 1 ? "Fehler" : "Fehler"}, ${s.chancen} verpasste ${s.chancen === 1 ? "Chance" : "Chancen"}`;
  const leer = $("rb-leer");
  leer.hidden = a.eintraege.length > 0;
  leer.textContent = "Die Analyse hat keine groben Fehler gefunden. Kleine Ungenauigkeiten zeigt sie nicht an.";
  const ul = $("rb-liste");
  ul.innerHTML = "";
  a.eintraege.forEach((e, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rb-eintrag";
    const titel = document.createElement("strong");
    titel.textContent = `Zug ${e.nr}: ${e.san} (${ART_TEXT[e.art]})`;
    const sub = document.createElement("span");
    sub.textContent = e.text;
    b.append(titel, sub);
    b.addEventListener("click", () => zeigeDetail(i));
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function eintraege() {
  const a = rueckblick.eintrag(aktuelleId);
  return a ? a.eintraege : [];
}

// Das Brett wird bei jedem Öffnen der Detailansicht neu aufgebaut, wenn die Seite sichtbar ist. Eine Brettgröße, die
// Chessground gemerkt hat, während die Seite versteckt war, ergäbe sonst falsch berechnete Pfeile.
function baueBrett(farbe) {
  if (cg) {
    cg.destroy();
    cg = null;
    $("rb-board").className = "board";
    $("rb-board").innerHTML = "";
  }
  cg = Chessground($("rb-board"), {
    coordinates: true,
    viewOnly: true,
    disableContextMenu: true,
    blockTouchScroll: false,
    highlight: { lastMove: true, check: true },
    animation: { enabled: false },
    drawable: { enabled: false, visible: true },
  });
  keepBoundsFresh($("rb-board"), () => cg);
  void farbe;
  return cg;
}

function zeigeDetail(i) {
  const a = rueckblick.eintrag(aktuelleId);
  if (!a || !a.eintraege[i]) return;
  index = i;
  nachZug = false;
  teile(["rb-detail"]);
  baueBrett(a.farbe);
  zeichneDetail();
  window.scrollTo(0, 0);
}

function zeichneDetail() {
  const a = rueckblick.eintrag(aktuelleId);
  const e = a.eintraege[index];
  const c = new Chess(a.startFen);
  for (const u of a.zuegeUci.slice(0, e.ply)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const vorFen = c.fen();
  c.move({ from: e.uci.slice(0, 2), to: e.uci.slice(2, 4), promotion: e.uci[4] });
  const nachFen = c.fen();
  const fen = nachZug ? nachFen : vorFen;
  const aktuell = new Chess(fen);
  cg.state.dom.bounds.clear();
  cg.set({
    fen,
    orientation: a.farbe === "w" ? "white" : "black",
    turnColor: toColor(aktuell.turn()),
    check: aktuell.isCheck() ? toColor(aktuell.turn()) : false,
    lastMove: nachZug ? [e.uci.slice(0, 2), e.uci.slice(2, 4)] : undefined,
    viewOnly: true,
  });
  cg.setAutoShapes(
    nachZug
      ? []
      : [
          { orig: e.uci.slice(0, 2), dest: e.uci.slice(2, 4), brush: "red" },
          { orig: e.best.slice(0, 2), dest: e.best.slice(2, 4), brush: "green" },
        ],
  );
  $("rb-detail-titel").textContent = `Zug ${e.nr}: ${e.san}`;
  $("rb-detail-art").textContent = `${ART_TEXT[e.art]}, ${PHASE_TEXT[e.phase]}`;
  $("rb-legende").textContent = nachZug ? "So stand es nach deinem Zug." : `Rot: dein Zug (${e.san}). Grün: besserer Zug (${e.bestSan}).`;
  $("rb-text").textContent = e.text;
  $("rb-btn-vor").disabled = !nachZug;
  $("rb-btn-nach").disabled = nachZug;
  $("rb-btn-zurueck-stelle").disabled = index === 0;
  $("rb-btn-weiter-stelle").disabled = index >= a.eintraege.length - 1;
  $("rb-meldung").textContent = "";
}

function alsRaetsel() {
  const a = rueckblick.eintrag(aktuelleId);
  const e = a.eintraege[index];
  const meldung = (t) => {
    $("rb-meldung").textContent = t;
  };
  if (store.get().taktik.aktiv) return meldung("Es läuft gerade eine Sitzung. Beende oder verwirf sie zuerst auf der Seite Taktik.");
  let p = null;
  store.update((d) => {
    p = raetselFuerEintrag(d, a, e, { today: dayKey(store.now()), nowIso: store.now().toISOString() });
  });
  if (!p) return meldung("Für diese Stelle gibt es kein eindeutiges Rätsel: Mehrere Züge sind etwa gleich gut, oder es gab keinen Zug des Gegners davor.");
  startEigenesRaetsel(p);
}

// ---------- Ereignisse ----------

export function initRueckblick() {
  $("rb-btn-vor").addEventListener("click", () => {
    nachZug = false;
    zeichneDetail();
  });
  $("rb-btn-nach").addEventListener("click", () => {
    nachZug = true;
    zeichneDetail();
  });
  $("rb-btn-zurueck-stelle").addEventListener("click", () => zeigeDetail(Math.max(0, index - 1)));
  $("rb-btn-weiter-stelle").addEventListener("click", () => zeigeDetail(Math.min(eintraege().length - 1, index + 1)));
  $("rb-btn-liste").addEventListener("click", () => {
    const a = rueckblick.eintrag(aktuelleId);
    if (a) zeigeErgebnis(a);
  });
  $("rb-btn-raetsel").addEventListener("click", alsRaetsel);
  $("rb-btn-abbrechen").addEventListener("click", () => {
    rueckblick.abbrechen();
    location.hash = "#/fortschritt";
  });
  $("rb-btn-nochmal").addEventListener("click", () => {
    rueckblick.fortsetzen();
    zeigeFortschritt();
  });
  rueckblick.auf((e) => {
    if (e.id !== aktuelleId || location.hash !== `#/spielen/rueckblick/${aktuelleId}`) return;
    if (e.typ === "fertig") {
      const a = rueckblick.eintrag(aktuelleId);
      if (a) zeigeErgebnis(a);
    } else if (e.typ === "fortschritt" || e.typ === "fehler") zeigeFortschritt();
  });
  // Nach App-Wechsel oder Neuladen: unterbrochene Analyse fortsetzen
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) rueckblick.fortsetzen();
  });
}
