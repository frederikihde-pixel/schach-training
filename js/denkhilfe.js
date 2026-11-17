// Denkhilfe: eine Zeile vor dem Rätsel, nur für Anfänger. Reine Logik ohne DOM.

export const DENKHILFE_TEXT = "Erst prüfen: Was bedroht der Gegner? Welche Figur ist ungedeckt?";
export const DENKHILFE_ERSTE = 10; // nur die ersten Rätsel überhaupt
export const DENKHILFE_UNTER = 900; // und nur unter dieser Taktikstärke (unbekannt zählt als darunter)

// einstellung: Schalter unter Mehr > Einstellungen; gesehen: Zahl der bisher gespielten Rätsel;
// staerke: geschätzte Taktikstärke oder null; typ: "einstufung" | "sitzung" | "standort"
export function denkhilfeAktiv({ einstellung, gesehen, staerke, typ }) {
  if (typ === "standort") return false; // die Standortbestimmung läuft ohne Hinweise
  if (!einstellung) return false;
  if (gesehen >= DENKHILFE_ERSTE) return false;
  return staerke === null || staerke === undefined || staerke < DENKHILFE_UNTER;
}
