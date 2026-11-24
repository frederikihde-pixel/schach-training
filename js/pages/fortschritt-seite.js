// Seite "Fortschritt": drei Abschnitte (Taktik, Partien, Standortbestimmung) auf einer Seite. Die Inhalte kommen aus
// statistik.js (Taktik, Standortbestimmung), fortschritt.js (Zahlen zu den Partien) und partien-liste.js (alle Partien).
import { store } from "../storage.js";
import { offeneRueckblicke } from "../rueckblick.js";
import { onShowStatistik } from "./statistik.js";
import { onShowFortschritt } from "./fortschritt.js";
import { renderListe } from "./partien-liste.js";

const $ = (id) => document.getElementById(id);
let ziel = null;

function offenZeile() {
  const offen = offeneRueckblicke(store.get().spielen);
  $("fp-offen").textContent = `Rückblicke offen: ${offen.length}`;
  $("fp-offen-btn").disabled = offen.length === 0;
  ziel = offen.length === 1 ? offen[0].id : null;
}

export function onShowFortschrittSeite() {
  onShowStatistik();
  onShowFortschritt();
  renderListe();
  offenZeile();
}

export function initFortschrittSeite() {
  // Genau ein offener Rückblick: direkt öffnen. Mehrere: die Liste aller Partien aufklappen (dort steht je Partie "Rückblick").
  $("fp-offen-btn").addEventListener("click", () => {
    if (ziel) {
      location.hash = `#/spielen/rueckblick/${ziel}`;
      return;
    }
    $("fp-alle").open = true;
    $("fp-alle").scrollIntoView({ block: "start" });
  });
  document.addEventListener("daten-geaendert", () => {
    if (!$("page-fortschritt").hidden) offenZeile();
  });
}
