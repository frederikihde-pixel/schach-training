// Seite "Heute": ein Hauptknopf mit kurzer Begründung und höchstens zwei ruhige Nebenzeilen. Die Regeln stehen in js/heute.js
// und docs/HEUTE.md. Die Seite startet den vorgeschlagenen Schritt direkt (ein Tipp).
import { store } from "../storage.js";
import { naechsterSchritt } from "../heute.js";
import { pruefsetStandard } from "../standards.js";
import { startFromStatistik, startStandortbestimmung, fortsetzenSitzung } from "./taktik.js";

const $ = (id) => document.getElementById(id);
let schritt = null;

function meldung(text) {
  $("heute-meldung").textContent = text || "";
}

async function fuehreAus(aktion) {
  meldung("");
  switch (aktion.typ) {
    case "sitzung-fortsetzen":
      return void fortsetzenSitzung();
    case "partie-fortsetzen":
      location.hash = "#/spielen/lauf";
      return;
    case "einstufung":
      return void startFromStatistik("einstufung");
    case "sitzung":
      return void startFromStatistik("sitzung");
    case "rueckblick":
      location.hash = aktion.id ? `#/spielen/rueckblick/${aktion.id}` : "#/fortschritt";
      return;
    case "partie":
      location.hash = "#/spielen";
      return;
    case "standort":
      try {
        await startStandortbestimmung(pruefsetStandard(store.get()));
      } catch (err) {
        meldung("Die Prüfrätsel sind gerade nicht verfügbar (Daten fehlen oder keine Verbindung).");
      }
      return;
    default:
  }
}

function render() {
  schritt = naechsterSchritt(store.get(), store.now());
  $("heute-haupt").textContent = schritt.knopf;
  $("heute-haupt").dataset.fall = schritt.fall;
  $("heute-text").textContent = schritt.text;
  const liste = $("heute-neben");
  liste.innerHTML = "";
  for (const n of schritt.neben) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "neben";
    b.textContent = n.text;
    b.addEventListener("click", () => fuehreAus(n.aktion));
    li.append(b);
    liste.append(li);
  }
  meldung("");
}

export function onShowHeute() {
  render();
}

export function initHeute() {
  $("heute-haupt").addEventListener("click", () => {
    if (schritt) fuehreAus(schritt.aktion);
  });
  document.addEventListener("daten-geaendert", () => {
    if (!$("page-heute").hidden) render();
  });
}
