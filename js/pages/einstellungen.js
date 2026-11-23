// Seite "Einstellungen" (Zahnrad): Darstellung, Training, Weiteres. Alle Standardwerte stehen hier; sie gelten beim Start
// von Partien und der Standortbestimmung und lassen sich dort einmalig überschreiben. Die Chess.com-Wertung steht NUR hier.
import { store } from "../storage.js";
import { startStufe, stufenName } from "../stufen.js";
import { warnungStandard, warnungIstAutomatisch, WARNUNG_AUTOMATISCH_PARTIEN } from "../standards.js";
import { PRUEFSETS, recommendedPruefset, pruefsetName } from "../pruefsets.js";
import { onShowDarstellung } from "./darstellung.js";

const $ = (id) => document.getElementById(id);

function schalter(id, an) {
  const b = $(id);
  b.setAttribute("aria-checked", String(an));
  b.textContent = an ? "an" : "aus";
}

function liesWertung() {
  const t = $("set-wertung").value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 100 && n <= 3500 ? n : NaN;
}

function wertungInfo() {
  const w = liesWertung();
  const info = $("set-wertung-info");
  if (w === null) info.textContent = "Mit deiner Wertung schlägt die App eine Startstufe für Partien vor.";
  else if (Number.isNaN(w)) info.textContent = "Bitte eine ganze Zahl zwischen 100 und 3500 eingeben.";
  else info.textContent = `Vorschlag für den Start: ${stufenName(startStufe(w))}. Das ist nur ein Richtwert.`;
}

function pruefsetGruppe(d) {
  const box = $("set-pruefset");
  box.innerHTML = "";
  const empf = recommendedPruefset(d.taktik.staerke, d.taktik.eingestuft);
  const optionen = [
    { wert: null, name: "Automatisch", info: `Empfohlen für dich: ${pruefsetName(empf)}` },
    ...PRUEFSETS.map((p) => ({ wert: p.id, name: p.name, info: p.beschreibung })),
  ];
  for (const o of optionen) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.dataset.wert = o.wert === null ? "auto" : o.wert;
    b.setAttribute("aria-pressed", String(d.einstellungen.pruefset === o.wert));
    const n = document.createElement("strong");
    n.textContent = o.name;
    const i = document.createElement("span");
    i.className = "muted";
    i.textContent = o.info;
    b.append(n, i);
    b.addEventListener("click", () => {
      store.update((x) => {
        x.einstellungen.pruefset = o.wert;
      });
      render();
    });
    box.append(b);
  }
}

function render() {
  const d = store.get();
  schalter("set-denkhilfe", d.einstellungen.denkhilfe);
  schalter("set-zuruecknahme", d.einstellungen.zuruecknahme);
  schalter("set-warnung", warnungStandard(d));
  $("set-warnung-info").textContent = warnungIstAutomatisch(d)
    ? `Automatisch: an für die ersten ${WARNUNG_AUTOMATISCH_PARTIEN} Partien, danach aus`
    : "Standard für neue Partien";
  const w = d.einstellungen.chesscomWertung;
  if (document.activeElement !== $("set-wertung")) $("set-wertung").value = w ? String(w) : "";
  wertungInfo();
  pruefsetGruppe(d);
}

export function onShowEinstellungen() {
  render();
  onShowDarstellung();
}

export function initEinstellungen() {
  $("set-denkhilfe").addEventListener("click", () => {
    store.update((d) => {
      d.einstellungen.denkhilfe = !d.einstellungen.denkhilfe;
    });
    render();
  });
  $("set-zuruecknahme").addEventListener("click", () => {
    store.update((d) => {
      d.einstellungen.zuruecknahme = !d.einstellungen.zuruecknahme;
    });
    render();
  });
  $("set-warnung").addEventListener("click", () => {
    store.update((d) => {
      d.einstellungen.patzerWarnung = !warnungStandard(d);
    });
    render();
  });
  $("set-wertung").addEventListener("input", () => {
    const w = liesWertung();
    wertungInfo();
    if (w === null || !Number.isNaN(w)) {
      store.update((d) => {
        d.einstellungen.chesscomWertung = w;
      });
    }
  });
  document.addEventListener("daten-geaendert", render);
}
