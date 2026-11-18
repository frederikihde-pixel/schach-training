// Seite "Spielen": Startseite mit drei Wegen, Einstellungen, laufende Partie, Ende.
// Die Spielregeln kommen aus js/partie.js (chess.js), die Stärke aus js/stufen.js und die Engine aus js/engine.js.
import { Chess } from "../../vendor/chess.js/chess.js";
import { Chessground } from "../../vendor/chessground/chessground.min.js";
import { askPromotion } from "../ui/promotion.js";
import { toColor, computeDests, keepBoundsFresh } from "../ui/board-util.js";
import { store } from "../storage.js";
import { getEngine, uciMove, UNAVAILABLE_TEXT } from "../engine.js";
import { STUFEN, stufe as stufeDaten, stufenName, ungefaehreStaerke, STAERKE_HINWEIS, startStufe, spieleZug, GRUNDMATT_STUFE } from "../stufen.js";
import { neueAktive, stellung, legaleUci, ende, endeText, ausgang, farbName, kannZuruecknehmen, zuruecknehmen, eintrag, zugAnwenden, spielerAmZug, spielerZuege } from "../partie.js";
import { GRUNDMATT, VORTEIL_ARTEN, vorteilStart } from "../uebungen.js";
import { pruefeZug } from "../warnung.js";
import { empfehlung } from "../empfehlung.js";
import { ladePgn } from "./brett.js";

const $ = (id) => document.getElementById(id);
const VIEWS = ["sp-start", "sp-setup", "sp-grundmatt", "sp-lauf", "sp-ende"];
const GRUNDMATT_MS = 700; // kürzeste angezeigte Bedenkzeit bei den Grundmatts

let cg = null;
let sitz = null; // laufende Sitzung: { aktiv, chess, token, denkt, pruefen, fehler }
let letzte = null; // zuletzt beendeter Eintrag (für die Endseite)
let letzteUngesehen = false;
let setupModus = "partie";
let setupWarnung = true;
let setupZurueck = false;

function zeige(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
}

function meldung(id, text) {
  $(id).textContent = text || "";
}

function setSwitch(btn, on, an, aus) {
  btn.setAttribute("aria-checked", String(on));
  btn.textContent = on ? an : aus;
}

// ---------- Routen ----------

export function onShowSpielen(path) {
  if (path === "spielen/lauf") return ladeLauf();
  if (path === "spielen/ende") {
    if (!letzte) return void (location.hash = "#/spielen");
    return zeigeEnde();
  }
  if (path === "spielen/partie") return zeigeSetup("partie");
  if (path === "spielen/vorteil") return zeigeSetup("vorteil");
  if (path === "spielen/grundmatt") return zeigeGrundmatt();
  return zeigeStart();
}

// ---------- Startseite ----------

function aktivText(a) {
  const modus = { partie: "Partie", vorteil: "Vorteil verwerten", grundmatt: "Grundmatt" }[a.modus] || "Partie";
  return `Es läuft eine Übung: ${modus}, du spielst ${farbName(a.farbe)}, ${a.zuege.length} Halbzüge gespielt.`;
}

function zeigeStart() {
  zeige("sp-start");
  const a = store.get().spielen.aktiv;
  $("sp-fortsetzen").hidden = !a;
  $("sp-verwerfen-frage").hidden = true;
  if (a) $("sp-fortsetzen-text").textContent = aktivText(a);
  $("sp-letzte").hidden = !(letzteUngesehen && letzte);
  if (!$("sp-letzte").hidden) {
    const e = letzte.eintrag;
    $("sp-letzte-text").textContent = e.modus === "grundmatt" ? "Deine letzte Übung ist beendet." : endeText({ ergebnis: e.ergebnis, grund: e.grund }, e.farbe);
  }
  for (const link of document.querySelectorAll("#sp-start .subnav a")) {
    if (link.getAttribute("href") === "#/spielen") link.setAttribute("aria-current", "page");
  }
}

// ---------- Einstellungen: Partie und Vorteil ----------

function warnungStandard() {
  return store.get().spielen.gestartet < 3;
}

function stufenOptionen(select, gewaehlt) {
  select.innerHTML = "";
  for (const s of STUFEN) {
    const o = document.createElement("option");
    o.value = String(s.nr);
    o.textContent = `${stufenName(s.nr)} - ${ungefaehreStaerke(s.nr)}`;
    select.appendChild(o);
  }
  select.value = String(gewaehlt);
}

function zeigeSetup(modus) {
  setupModus = modus;
  zeige("sp-setup");
  const d = store.get();
  $("sp-setup-titel").textContent = modus === "vorteil" ? "Vorteil verwerten" : "Partie";
  $("sp-setup-text").textContent =
    modus === "vorteil"
      ? "Du startest mit einem Vorteil: Der Computer hat von Anfang an eine Figur weniger. Es zählt: gewonnen, remis oder verloren. Das wird getrennt von normalen Partien gezählt."
      : "Eine ganze Partie ohne Uhr. Der Computer antwortet nach kurzer Bedenkzeit.";
  $("sp-btn-start").textContent = modus === "vorteil" ? "Übung starten" : "Partie starten";
  $("sp-feld-art").hidden = modus !== "vorteil";
  if (modus === "vorteil") {
    const sel = $("sp-art");
    if (!sel.options.length) {
      for (const [k, v] of Object.entries(VORTEIL_ARTEN)) sel.add(new Option(v.name, k));
    }
  }
  const emp = modus === "partie" ? empfehlung(d.spielen.partien) : null;
  const wert = d.einstellungen.chesscomWertung;
  const start = emp ? emp.stufe : wert ? startStufe(wert) : 2;
  stufenOptionen($("sp-stufe"), start);
  const e = $("sp-empfehlung");
  e.hidden = !emp;
  if (emp) e.textContent = emp.satz;
  $("sp-wertung").value = wert ? String(wert) : "";
  aktualisiereStufeInfo();
  aktualisiereWertungInfo();
  setupZurueck = false;
  setupWarnung = warnungStandard();
  setSwitch($("sp-sw-zurueck"), setupZurueck, "Zug zurücknehmen: an", "Zug zurücknehmen: aus");
  setSwitch($("sp-sw-warnung"), setupWarnung, "Patzer-Warnung: an", "Patzer-Warnung: aus");
  $("sp-warn-info").textContent = warnungStandard()
    ? ""
    : "Du hast schon 3 Partien begonnen. Deshalb ist die Warnung zunächst aus. Du kannst sie einschalten.";
  meldung("sp-setup-meldung", "");
}

function aktualisiereStufeInfo() {
  const nr = Number($("sp-stufe").value);
  $("sp-stufe-info").textContent = `Ungefähre Stärke: ${ungefaehreStaerke(nr)}. ${STAERKE_HINWEIS}`;
}

function liesWertung() {
  const t = $("sp-wertung").value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 100 && n <= 3500 ? n : NaN;
}

function aktualisiereWertungInfo() {
  const w = liesWertung();
  const info = $("sp-wertung-info");
  if (w === null) info.textContent = "Mit deiner Wertung schlägt die App eine Startstufe vor.";
  else if (Number.isNaN(w)) info.textContent = "Bitte eine ganze Zahl zwischen 100 und 3500 eingeben.";
  else info.textContent = `Vorschlag für den Start: ${stufenName(startStufe(w))}. Das ist nur ein Richtwert.`;
}

function setupEvents() {
  $("sp-stufe").addEventListener("change", aktualisiereStufeInfo);
  $("sp-wertung").addEventListener("input", () => {
    const w = liesWertung();
    aktualisiereWertungInfo();
    if (w === null || !Number.isNaN(w)) {
      store.update((d) => {
        d.einstellungen.chesscomWertung = w;
      });
      if (w !== null && $("sp-empfehlung").hidden) {
        $("sp-stufe").value = String(startStufe(w));
        aktualisiereStufeInfo();
      }
    }
  });
  $("sp-sw-zurueck").addEventListener("click", () => {
    setupZurueck = !setupZurueck;
    setSwitch($("sp-sw-zurueck"), setupZurueck, "Zug zurücknehmen: an", "Zug zurücknehmen: aus");
  });
  $("sp-sw-warnung").addEventListener("click", () => {
    setupWarnung = !setupWarnung;
    setSwitch($("sp-sw-warnung"), setupWarnung, "Patzer-Warnung: an", "Patzer-Warnung: aus");
  });
  $("sp-btn-start").addEventListener("click", () => {
    if (Number.isNaN(liesWertung())) return meldung("sp-setup-meldung", "Bitte zuerst die Wertung korrigieren oder leer lassen.");
    let farbe = $("sp-farbe").value;
    if (farbe === "z") farbe = Math.random() < 0.5 ? "w" : "b";
    const stufeNr = Number($("sp-stufe").value);
    let startFen;
    let extra = {};
    if (setupModus === "vorteil") {
      const art = $("sp-art").value;
      startFen = vorteilStart(art, farbe);
      extra = { art };
    }
    starte(neueAktive({ modus: setupModus, farbe, stufe: stufeNr, startFen, zuruecknahme: setupZurueck, warnung: setupWarnung, extra }));
  });
}

// ---------- Grundmatts ----------

function zeigeGrundmatt() {
  zeige("sp-grundmatt");
  const art = $("gm-art");
  if (!art.options.length) for (const [k, v] of Object.entries(GRUNDMATT)) art.add(new Option(v.name, k));
  fuelleStellungen();
}

function fuelleStellungen() {
  const art = $("gm-art").value || "dame";
  const sel = $("gm-stellung");
  const versuche = store.get().spielen.versuche.filter((v) => v.modus === "grundmatt" && v.art === art);
  const gezaehlt = GRUNDMATT[art].stellungen.map((_, i) => versuche.filter((v) => v.stellungNr === i).length);
  const naechste = gezaehlt.indexOf(Math.min(...gezaehlt));
  sel.innerHTML = "";
  sel.add(new Option(`Nächste Stellung (Nr. ${naechste + 1})`, "auto"));
  GRUNDMATT[art].stellungen.forEach((_, i) => sel.add(new Option(`Stellung ${i + 1}${gezaehlt[i] ? ` (${gezaehlt[i]}x geübt)` : ""}`, String(i))));
  $("gm-info").textContent = `Referenz: ${GRUNDMATT[art].kurz} und König gegen König ist in höchstens ${GRUNDMATT[art].referenz} Zügen erzwingbar.`;
}

function grundmattEvents() {
  $("gm-art").addEventListener("change", fuelleStellungen);
  $("gm-btn-start").addEventListener("click", () => {
    const art = $("gm-art").value;
    let nr = $("gm-stellung").value;
    if (nr === "auto") {
      const versuche = store.get().spielen.versuche.filter((v) => v.modus === "grundmatt" && v.art === art);
      const gezaehlt = GRUNDMATT[art].stellungen.map((_, i) => versuche.filter((v) => v.stellungNr === i).length);
      nr = gezaehlt.indexOf(Math.min(...gezaehlt));
    } else nr = Number(nr);
    starte(neueAktive({ modus: "grundmatt", farbe: "w", stufe: GRUNDMATT_STUFE, startFen: GRUNDMATT[art].stellungen[nr], zuruecknahme: false, warnung: false, extra: { art, stellungNr: nr } }));
  });
}

// ---------- Sitzung starten, fortsetzen, verwerfen ----------

function starte(aktiv) {
  store.update((d) => {
    d.spielen.aktiv = aktiv;
    if (aktiv.modus !== "grundmatt") d.spielen.gestartet += 1;
  });
  sitz = null;
  if (location.hash === "#/spielen/lauf") ladeLauf();
  else location.hash = "#/spielen/lauf";
}

function verwerfen() {
  store.update((d) => {
    d.spielen.aktiv = null;
  });
  if (sitz) sitz.token = -1;
  sitz = null;
  zeigeStart();
}

// ---------- Brett und Lauf ----------

function baueBrett() {
  if (cg) return cg;
  cg = Chessground($("sp-board"), {
    fen: new Chess().fen(),
    coordinates: true,
    blockTouchScroll: true,
    disableContextMenu: true,
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 180 },
    movable: { free: false, color: undefined, showDests: true, dests: new Map(), events: { after: beiZug } },
    draggable: { enabled: true, showGhost: true },
    selectable: { enabled: true },
    premovable: { enabled: false },
  });
  keepBoundsFresh($("sp-board"), () => cg);
  return cg;
}

function ladeLauf() {
  const aktiv = store.get().spielen.aktiv;
  if (!aktiv) return void (location.hash = "#/spielen");
  zeige("sp-lauf");
  baueBrett();
  if (!sitz || sitz.aktiv.id !== aktiv.id) {
    let chess;
    try {
      chess = stellung(aktiv);
    } catch (err) {
      store.update((d) => {
        d.spielen.aktiv = null;
      });
      location.hash = "#/spielen";
      return;
    }
    sitz = { aktiv, chess, token: Math.random(), denkt: false, pruefen: false, fehler: false, wartetWarnung: false };
  }
  const modus = { partie: "Partie", vorteil: "Vorteil verwerten", grundmatt: "Grundmatt" }[aktiv.modus];
  $("sp-lauf-titel").textContent = aktiv.modus === "vorteil" ? `${modus}: ${VORTEIL_ARTEN[aktiv.art].kurz}` : modus;
  $("sp-lauf-stufe").textContent = aktiv.modus === "grundmatt" ? `Referenz: ${GRUNDMATT[aktiv.art].referenz} Züge` : stufenName(aktiv.stufe);
  $("sp-aufgeben-text").textContent = aktiv.modus === "grundmatt" ? "Wirklich aufgeben? Der Versuch zählt dann als Misserfolg." : "Wirklich aufgeben? Die Partie zählt dann als verloren.";
  $("sp-warnung").hidden = !sitz.wartetWarnung;
  $("sp-fehler").hidden = !sitz.fehler;
  $("sp-aufgeben-frage").hidden = true;
  meldung("sp-lauf-meldung", "");
  rendern(true);
  if (!pruefeEnde() && !spielerAmZug(sitz.aktiv, sitz.chess) && !sitz.denkt) computerZug();
}

function gesperrt() {
  return !sitz || sitz.denkt || sitz.pruefen || sitz.wartetWarnung || sitz.fehler;
}

function rendern(erstes = false) {
  if (!sitz || !cg) return;
  const { aktiv, chess } = sitz;
  const zuEnde = !!ende(chess, aktiv);
  const amZug = spielerAmZug(aktiv, chess);
  const sperre = gesperrt() || zuEnde || !amZug;
  const history = chess.history({ verbose: true });
  const letzter = history.length ? history[history.length - 1] : null;
  cg.selectSquare(null);
  cg.set({
    fen: chess.fen(),
    orientation: aktiv.farbe === "w" ? "white" : "black",
    turnColor: toColor(chess.turn()),
    check: chess.isCheck() ? toColor(chess.turn()) : false,
    lastMove: letzter ? [letzter.from, letzter.to] : undefined,
    animation: { enabled: !erstes },
    movable: { color: sperre ? undefined : toColor(aktiv.farbe), dests: sperre ? new Map() : computeDests(chess) },
  });
  statusAktualisieren();
}

function statusAktualisieren() {
  if (!sitz) return;
  const { aktiv, chess } = sitz;
  const zuEnde = !!ende(chess, aktiv);
  const amZug = spielerAmZug(aktiv, chess);
  let status;
  if (zuEnde) status = "";
  else if (sitz.denkt) status = "Computer denkt";
  else if (sitz.pruefen) status = "Dein Zug wird geprüft";
  else if (sitz.wartetWarnung) status = "Dein Zug wartet auf deine Entscheidung";
  else if (sitz.fehler) status = "Der Computer kann nicht ziehen";
  else if (amZug) status = `Du bist am Zug (${farbName(aktiv.farbe)})${chess.isCheck() ? ". Schach." : ""}`;
  else status = "Computer ist am Zug";
  $("sp-lauf-status").textContent = status;
  $("sp-btn-zurueck").hidden = !aktiv.zuruecknahme;
  $("sp-btn-zurueck").disabled = gesperrt() || !kannZuruecknehmen(aktiv, chess);
}

function sperreBrettOhneRueckblick() {
  // Das Brett zeigt weiter den gezogenen Stein (kein Zurückspringen während der Prüfung), ist aber gesperrt.
  cg.set({ movable: { color: undefined, dests: new Map() } });
  statusAktualisieren();
}

function speichern() {
  store.save();
}

function pruefeEnde() {
  const e = ende(sitz.chess, sitz.aktiv);
  if (!e) return false;
  beende(e);
  return true;
}

function beende(e) {
  const { aktiv } = sitz;
  const eint = eintrag(aktiv, e, { now: store.now() });
  store.update((d) => {
    if (aktiv.modus === "partie") d.spielen.partien.push(eint);
    else d.spielen.versuche.push(eint);
    d.spielen.aktiv = null;
  });
  letzte = { eintrag: eint };
  if (sitz) sitz.token = -1;
  sitz = null;
  if (location.hash === "#/spielen/lauf") location.hash = "#/spielen/ende";
  else letzteUngesehen = true; // beendet, während eine andere Seite offen war: die Startseite weist darauf hin
}

// ---------- Zug des Spielers ----------

function beiZug(orig, dest) {
  if (!sitz || gesperrt()) return rendern();
  const { chess } = sitz;
  const kandidaten = chess.moves({ verbose: true }).filter((m) => m.from === orig && m.to === dest);
  if (!kandidaten.length) return rendern();
  if (kandidaten.some((m) => m.promotion)) {
    cg.set({ movable: { color: undefined } });
    askPromotion(toColor(chess.turn()), (piece) => zugVersuchen(orig + dest + piece));
    return;
  }
  zugVersuchen(orig + dest);
}

async function zugVersuchen(uci) {
  const s = sitz;
  const { aktiv, chess } = s;
  if (aktiv.warnung && aktiv.modus !== "grundmatt") {
    s.pruefen = true;
    sperreBrettOhneRueckblick();
    const test = new Chess(chess.fen());
    zugAnwenden(test, uci);
    let urteil;
    try {
      urteil = await pruefeZug(test, getEngine());
    } catch (err) {
      urteil = { warnen: false };
    }
    if (sitz !== s) return;
    s.pruefen = false;
    if (urteil.warnen) {
      aktiv.warnungen += 1;
      speichern();
      s.wartetWarnung = true;
      s.offenerZug = uci;
      statusAktualisieren();
      $("sp-warnung-text").textContent = urteil.text;
      $("sp-warnung").hidden = false;
      return;
    }
  }
  spielerZug(uci);
}

function spielerZug(uci) {
  const s = sitz;
  zugAnwenden(s.chess, uci);
  s.aktiv.zuege.push(uci);
  speichern();
  rendern();
  if (!pruefeEnde()) computerZug();
}

// ---------- Zug des Computers ----------

function warte(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function computerZug() {
  const s = sitz;
  if (!s || s.denkt) return;
  s.denkt = true;
  s.fehler = false;
  $("sp-fehler").hidden = true;
  rendern();
  const { aktiv, chess } = s;
  const t0 = performance.now();
  let zug;
  try {
    const legal = legaleUci(chess);
    const r = await spieleZug(getEngine(), aktiv.stufe, { fen: aktiv.startFen, moves: aktiv.zuege, legal });
    zug = r.zug;
  } catch (err) {
    if (sitz !== s) return;
    s.denkt = false;
    s.fehler = true;
    $("sp-fehler-text").textContent = err && err.message ? err.message : UNAVAILABLE_TEXT;
    $("sp-fehler").hidden = false;
    rendern();
    return;
  }
  const mindest = aktiv.modus === "grundmatt" ? GRUNDMATT_MS : stufeDaten(aktiv.stufe).minMs;
  const rest = mindest - (performance.now() - t0);
  if (rest > 0) await warte(rest);
  if (sitz !== s || s.token < 0) return;
  s.denkt = false;
  zugAnwenden(s.chess, zug);
  aktiv.zuege.push(zug);
  speichern();
  rendern();
  pruefeEnde();
}

// ---------- Knöpfe im Lauf ----------

function laufEvents() {
  $("sp-warn-aendern").addEventListener("click", () => {
    if (!sitz) return;
    sitz.wartetWarnung = false;
    sitz.offenerZug = null;
    $("sp-warnung").hidden = true;
    rendern();
  });
  $("sp-warn-trotzdem").addEventListener("click", () => {
    if (!sitz || !sitz.offenerZug) return;
    const uci = sitz.offenerZug;
    sitz.aktiv.trotzdem += 1;
    sitz.wartetWarnung = false;
    sitz.offenerZug = null;
    $("sp-warnung").hidden = true;
    spielerZug(uci);
  });
  $("sp-btn-nochmal").addEventListener("click", () => {
    if (!sitz) return;
    sitz.fehler = false;
    $("sp-fehler").hidden = true;
    computerZug();
  });
  $("sp-btn-zurueck").addEventListener("click", () => {
    if (!sitz || gesperrt()) return;
    if (zuruecknehmen(sitz.aktiv)) {
      sitz.chess = stellung(sitz.aktiv);
      speichern();
      rendern();
    }
  });
  $("sp-btn-aufgeben").addEventListener("click", () => {
    $("sp-aufgeben-frage").hidden = false;
  });
  $("sp-btn-aufgeben-nein").addEventListener("click", () => {
    $("sp-aufgeben-frage").hidden = true;
  });
  $("sp-btn-aufgeben-ja").addEventListener("click", () => {
    if (!sitz) return;
    $("sp-aufgeben-frage").hidden = true;
    sitz.aktiv.aufgegeben = true;
    pruefeEnde();
  });
}

// ---------- Ende ----------

function fact(dl, name, wert) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = name;
  const dd = document.createElement("dd");
  dd.textContent = wert;
  row.append(dt, dd);
  dl.appendChild(row);
}

const AUSGANG_TEXT = { gewonnen: "gewonnen", remis: "remis", verloren: "verloren" };

function zeigeEnde() {
  letzteUngesehen = false;
  zeige("sp-ende");
  const e = letzte.eintrag;
  const grundmatt = e.modus === "grundmatt";
  $("sp-ende-titel").textContent = grundmatt ? "Übung beendet" : "Partie beendet";
  if (grundmatt) {
    $("sp-ende-text").textContent = e.matt
      ? `Matt gesetzt in ${e.mattIn} Zügen.`
      : `Kein Matt: ${e.grund === "Aufgabe" ? "aufgegeben" : e.grund === "Matt" ? "Matt gegen dich" : e.grund}.`;
  } else {
    $("sp-ende-text").textContent = endeText({ ergebnis: e.ergebnis, grund: e.grund }, e.farbe);
  }
  const dl = $("sp-ende-fakten");
  dl.innerHTML = "";
  fact(dl, "Ergebnis", AUSGANG_TEXT[e.ausgang]);
  fact(dl, "Grund", e.grund);
  fact(dl, "Meine Farbe", farbName(e.farbe));
  fact(dl, "Stufe", grundmatt ? "8 (Verteidigung)" : stufenName(e.stufe));
  fact(dl, "Meine Züge", String(e.zuege));
  if (grundmatt) fact(dl, "Referenz", `höchstens ${GRUNDMATT[e.art].referenz} Züge bis zum Matt`);
  if (e.modus === "partie" || e.modus === "vorteil") fact(dl, "Patzer-Warnung", e.warnung ? `an (${e.warnungen}x angezeigt, ${e.trotzdem}x Trotzdem)` : "aus");
  $("sp-ende-ansehen").onclick = (ev) => {
    ev.preventDefault();
    try {
      ladePgn(e.pgn, { farbe: e.farbe });
      location.hash = "#/brett";
    } catch (err) {
      meldung("sp-ende-meldung", "Die Partie konnte nicht ins Brett geladen werden.");
    }
  };
  $("sp-ende-pgn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(e.pgn);
      meldung("sp-ende-meldung", "PGN kopiert.");
    } catch (err) {
      meldung("sp-ende-meldung", "Kopieren ist hier nicht möglich.");
    }
  };
  const neu = $("sp-ende-neu");
  neu.textContent = { partie: "Neue Partie", vorteil: "Neue Übung", grundmatt: "Nächste Übung" }[e.modus];
  neu.setAttribute("href", { partie: "#/spielen/partie", vorteil: "#/spielen/vorteil", grundmatt: "#/spielen/grundmatt" }[e.modus]);
  meldung("sp-ende-meldung", "");
}

// ---------- Start ----------

export function initSpielen() {
  setupEvents();
  grundmattEvents();
  laufEvents();
  $("sp-btn-fortsetzen").addEventListener("click", () => {
    location.hash = "#/spielen/lauf";
  });
  $("sp-btn-verwerfen").addEventListener("click", () => {
    $("sp-verwerfen-frage").hidden = false;
  });
  $("sp-btn-verwerfen-nein").addEventListener("click", () => {
    $("sp-verwerfen-frage").hidden = true;
  });
  $("sp-btn-verwerfen-ja").addEventListener("click", verwerfen);
  document.addEventListener("daten-geaendert", () => {
    sitz = null;
  });
  // Nach einem App-Wechsel: Ist der Computer am Zug und denkt nicht (etwa weil die Engine im Hintergrund
  // beendet wurde), wird der Zug nachgeholt.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !sitz || location.hash !== "#/spielen/lauf") return;
    if (sitz.denkt || sitz.pruefen || sitz.wartetWarnung || sitz.fehler) return;
    if (ende(sitz.chess, sitz.aktiv) || spielerAmZug(sitz.aktiv, sitz.chess)) return;
    computerZug();
  });
}

export { uciMove, ausgang, spielerZuege };
