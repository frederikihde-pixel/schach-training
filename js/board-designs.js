// Brett-Designs: eine Quelle für Feldfarben und Markierungen. Die Seite setzt daraus CSS-Variablen
// (`applyDesign`), der Kontrasttest (tests/unit/kontrast.test.mjs) liest dieselben Werte.
//
// Farben sind "#rrggbb" (deckend) oder [r, g, b, alpha] (Überlagerung über das Feld).
// zeichen:   Zielpunkt, Schlagring und Rahmen des Schach-Feldes (deckend)
// letzter:   Felder des letzten Zugs (Überlagerung)
// gewaehlt:  gewähltes Feld (Überlagerung)
// schach:    Feld des Königs im Schach (Überlagerung, dazu Rahmen in `zeichen`)

export const DESIGNS = {
  dunkel: {
    id: "dunkel",
    name: "Dunkel",
    beschreibung: "Mittelhelle Felder in Blaugrau. Passt zur dunklen Oberfläche, Figuren beider Farben gut erkennbar.",
    hell: "#8393ad",
    dunkel: "#566171",
    zeichen: "#ffffff",
    letzter: [170, 105, 45, 0.95],
    gewaehlt: [5, 130, 170, 0.95],
    schach: [225, 60, 75, 0.95],
    koordinaten: "#ffffff",
    koordinatenRand: "rgba(0, 0, 0, 0.55)",
  },
  klassisch: {
    id: "klassisch",
    name: "Klassisch",
    beschreibung: "Helle Creme-Felder gegen dunkles Braun wie auf einem Holzbrett.",
    hell: "#f0e6d2",
    dunkel: "#8b5e3c",
    zeichen: "#04182c",
    letzter: [190, 155, 0, 0.8],
    gewaehlt: [20, 90, 190, 0.7],
    schach: [230, 50, 50, 0.85],
    koordinaten: "#2a1a0e",
    koordinatenRand: "rgba(255, 255, 255, 0.55)",
  },
  gruen: {
    id: "gruen",
    name: "Grün",
    beschreibung: "Gedämpftes Grün gegen Creme. Ruhige, vertraute Farben, wenig Blendung im Sonnenlicht.",
    hell: "#ecebd0",
    dunkel: "#6f8f5f",
    zeichen: "#041c0c",
    letzter: [200, 180, 0, 0.8],
    gewaehlt: [30, 100, 200, 0.75],
    schach: [215, 45, 45, 0.85],
    koordinaten: "#1c2a14",
    koordinatenRand: "rgba(255, 255, 255, 0.55)",
  },
};

export const DESIGN_IDS = ["klassisch", "dunkel", "gruen"];
export const DEFAULT_DESIGN = "klassisch";

export function resolveDesign(id) {
  return DESIGNS[id] ? id : DEFAULT_DESIGN;
}

export const rgbaCss = ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`;

// Zwei mal zwei Felder als SVG; Chessground legt es viermal nebeneinander und untereinander.
export function backgroundSvg(hell, dunkel) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" shape-rendering="crispEdges">' +
    `<rect width="1" height="1" x="0" y="0" fill="${hell}"/><rect width="1" height="1" x="1" y="0" fill="${dunkel}"/>` +
    `<rect width="1" height="1" x="0" y="1" fill="${dunkel}"/><rect width="1" height="1" x="1" y="1" fill="${hell}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function designVars(id) {
  const d = DESIGNS[resolveDesign(id)];
  return {
    "--feld-hell": d.hell,
    "--feld-dunkel": d.dunkel,
    "--brett-hintergrund": backgroundSvg(d.hell, d.dunkel),
    "--mk-zeichen": d.zeichen,
    "--mk-letzter": rgbaCss(d.letzter),
    "--mk-gewaehlt": rgbaCss(d.gewaehlt),
    "--mk-schach": rgbaCss(d.schach),
    "--koordinaten": d.koordinaten,
    "--koordinaten-rand": d.koordinatenRand,
  };
}

// Setzt das Design auf einem Element (auf <html> für alle Bretter, auf einer Vorschau nur dort).
export function applyDesign(el, id) {
  for (const [name, value] of Object.entries(designVars(id))) el.style.setProperty(name, value);
  el.dataset.brettDesign = resolveDesign(id);
}
