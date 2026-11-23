// "Meine Partien": gespeicherte Partien und Übungen mit "Im Brett ansehen" und "PGN kopieren".
import { store } from "../storage.js";
import { stufenName } from "../stufen.js";
import { farbName } from "../partie.js";
import { VORTEIL_ARTEN, GRUNDMATT } from "../uebungen.js";
import { ladePgn } from "./brett.js";

const $ = (id) => document.getElementById(id);

export function datumText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

const AUSGANG = { gewonnen: "gewonnen", remis: "remis", verloren: "verloren" };

export function titelText(e) {
  if (e.modus === "grundmatt") {
    const art = GRUNDMATT[e.art] ? GRUNDMATT[e.art].kurz : "Grundmatt";
    return `Grundmatt (${art}, Stellung ${(e.stellungNr ?? 0) + 1}): ${e.matt ? `Matt in ${e.mattIn} Zügen` : `kein Matt (${e.grund})`}`;
  }
  const art = e.modus === "vorteil" ? `Vorteil (${VORTEIL_ARTEN[e.art] ? VORTEIL_ARTEN[e.art].kurz : ""}), ` : "";
  return `${art}${stufenName(e.stufe)}, ${farbName(e.farbe)}: ${AUSGANG[e.ausgang]} (${e.grund})`;
}

function eintragElement(e, meldung) {
  const li = document.createElement("li");
  li.className = "game-item";
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = titelText(e);
  const sub = document.createElement("span");
  sub.className = "muted";
  sub.textContent = ` ${datumText(e.datum)}, ${e.zuege} Züge`;
  p.append(strong, document.createElement("br"), sub);
  const buttons = document.createElement("div");
  buttons.className = "game-buttons";
  const ansehen = document.createElement("button");
  ansehen.type = "button";
  ansehen.textContent = "Im Brett ansehen";
  ansehen.addEventListener("click", () => {
    try {
      ladePgn(e.pgn, { farbe: e.farbe });
      location.hash = "#/einstellungen/brett";
    } catch (err) {
      meldung("Diese Partie konnte nicht ins Brett geladen werden.");
    }
  });
  const kopieren = document.createElement("button");
  kopieren.type = "button";
  kopieren.textContent = "PGN kopieren";
  kopieren.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(e.pgn);
      meldung("PGN kopiert.");
    } catch (err) {
      meldung("Kopieren ist hier nicht möglich.");
    }
  });
  buttons.append(ansehen);
  if (e.modus !== "grundmatt") {
    const rb = document.createElement("a");
    rb.className = "btn-link-quiet";
    rb.href = `#/spielen/rueckblick/${e.id}`;
    rb.textContent = "Rückblick";
    buttons.append(rb);
  }
  buttons.append(kopieren);
  li.append(p, buttons);
  return li;
}

export function renderListe() {
  const sp = store.get().spielen;
  const meldung = (t) => {
    $("liste-meldung").textContent = t;
  };
  meldung("");
  for (const [id, liste, leer] of [
    ["liste-partien", sp.partien, "Noch keine Partie gespeichert. Nach dem Spielende erscheint sie hier."],
    ["liste-versuche", sp.versuche, "Noch keine Übung gespeichert."],
  ]) {
    const ul = $(id);
    ul.innerHTML = "";
    if (!liste.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = leer;
      ul.appendChild(li);
      continue;
    }
    for (const e of [...liste].reverse()) ul.appendChild(eintragElement(e, meldung));
  }
}
