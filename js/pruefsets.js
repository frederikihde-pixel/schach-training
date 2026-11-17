// Die beiden Prüfsets der Standortbestimmung. Reine Daten und Logik ohne DOM.
// Die Ergebnisse beider Sätze werden getrennt gespeichert und nie miteinander verglichen.

export const PRUEFSETS = [
  { id: "einsteiger", name: "Prüfset Einsteiger", datei: "pruefset-einsteiger.json", beschreibung: "20 Rätsel, Wertung etwa 450 bis 1100" },
  { id: "fortgeschritten", name: "Prüfset Fortgeschritten", datei: "pruefset.json", beschreibung: "20 Rätsel, Wertung etwa 850 bis 2050" },
];

export const DEFAULT_PRUEFSET = "fortgeschritten"; // Ergebnisse aus früheren Versionen

export const PRUEFSET_IDS = PRUEFSETS.map((p) => p.id);

export function pruefsetInfo(id) {
  return PRUEFSETS.find((p) => p.id === id) || PRUEFSETS.find((p) => p.id === DEFAULT_PRUEFSET);
}

export const pruefsetName = (id) => pruefsetInfo(id).name;

// Empfohlen: Einsteiger bei Stärke unter 1000 oder noch unbekannter Stärke, sonst Fortgeschritten.
export function recommendedPruefset(strength, eingestuft = true) {
  if (!eingestuft || strength === null || strength === undefined) return "einsteiger";
  return strength < 1000 ? "einsteiger" : "fortgeschritten";
}
