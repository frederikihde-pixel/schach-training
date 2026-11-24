// Standardwerte aus den Einstellungen, die beim Start einer Partie oder der Standortbestimmung gelten.
// Reine Logik auf dem Speicherstand, kein DOM.
import { recommendedPruefset } from "./pruefsets.js";

export const WARNUNG_AUTOMATISCH_PARTIEN = 3; // automatisch: Patzer-Warnung an für die ersten 3 begonnenen Partien

// Patzer-Warnung: ausdrücklich gewählt (an oder aus) oder automatisch.
export function warnungStandard(d) {
  const w = d.einstellungen.patzerWarnung;
  return w === null ? d.spielen.gestartet < WARNUNG_AUTOMATISCH_PARTIEN : w;
}

export const warnungIstAutomatisch = (d) => d.einstellungen.patzerWarnung === null;

export const zuruecknahmeStandard = (d) => d.einstellungen.zuruecknahme;

// Prüfset: ausdrücklich gewählt oder nach Taktikstärke empfohlen.
export function pruefsetStandard(d) {
  const p = d.einstellungen.pruefset;
  return p === null ? recommendedPruefset(d.taktik.staerke, d.taktik.eingestuft) : p;
}
