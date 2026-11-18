// Feste Übungsstellungen: Grundmatts (König und Dame beziehungsweise König und Turm gegen König) und
// Startstellungen für "Vorteil verwerten". Der Spieler hat immer Weiß beziehungsweise die Seite mit dem Vorteil.
// Alle Stellungen werden mit chess.js geprüft (tests/unit/uebungen.test.mjs).

import { Chess } from "../vendor/chess.js/chess.js";

// Weiß mit Dame beziehungsweise Turm am Zug, Schwarz hat nur den König. Verschiedene Lagen von beiden Königen
// und der Figur: Rand, Ecke, Mitte; Figur nah und fern. Keine Stellung ist Schach, Matt oder Patt, und keine Figur
// steht im ersten Zug ungedeckt neben dem schwarzen König.
export const GRUNDMATT = {
  dame: {
    name: "König und Dame gegen König",
    kurz: "Dame",
    referenz: 10,
    stellungen: [
      "8/8/8/8/6K1/2Q5/8/7k w - - 0 1",
      "7k/8/8/2K5/8/8/8/2Q5 w - - 0 1",
      "1k6/8/8/2K5/8/3Q4/8/8 w - - 0 1",
      "2K5/8/8/8/8/3Q4/k7/8 w - - 0 1",
      "8/8/6Q1/8/1k6/8/8/K7 w - - 0 1",
      "5Q2/1K6/8/8/8/8/3k4/8 w - - 0 1",
      "8/2K5/4k3/8/8/Q7/8/8 w - - 0 1",
      "8/6K1/8/8/6Q1/2k5/8/8 w - - 0 1",
      "8/8/8/7k/8/1K6/3Q4/8 w - - 0 1",
      "8/5k2/8/8/3K4/8/8/6Q1 w - - 0 1",
    ],
  },
  turm: {
    name: "König und Turm gegen König",
    kurz: "Turm",
    referenz: 16,
    stellungen: [
      "8/8/8/8/6K1/6R1/8/7k w - - 0 1",
      "8/8/8/3K4/8/8/2R5/k7 w - - 0 1",
      "4K3/7k/8/8/8/8/8/4R3 w - - 0 1",
      "8/8/6K1/8/k7/8/8/2R5 w - - 0 1",
      "8/1k6/8/8/K4R2/8/8/8 w - - 0 1",
      "8/1k6/8/8/2R5/6K1/8/8 w - - 0 1",
      "8/8/8/3K3R/8/5k2/8/8 w - - 0 1",
      "5R2/8/2k5/8/8/8/8/K7 w - - 0 1",
      "8/1K6/3R4/8/8/8/8/1k6 w - - 0 1",
      "8/3K4/8/1k6/8/4R3/8/8 w - - 0 1",
    ],
  },
};

export const GRUNDMATT_ARTEN = Object.keys(GRUNDMATT);

// Vorteil verwerten: Grundstellung, der Computer startet ohne eine Figur.
// Dame: d1/d8. Turm: Turm auf der a-Linie (Rochade auf dieser Seite entfällt). Springer: b1/b8.
export const VORTEIL_ARTEN = {
  dame: { name: "Computer ohne Dame", kurz: "ohne Dame" },
  turm: { name: "Computer ohne Turm", kurz: "ohne Turm" },
  springer: { name: "Computer ohne Springer", kurz: "ohne Springer" },
};

const WEISS_ZEILE = "RNBQKBNR";
const SCHWARZ_ZEILE = "rnbqkbnr";

function ohne(zeile, art) {
  const index = { dame: 3, turm: 0, springer: 1 }[art];
  const stuecke = zeile.split("");
  stuecke[index] = "1";
  return stuecke.join("").replace(/1+/g, (m) => String(m.length));
}

// spieler: Farbe des Spielers ("w" oder "b"); der Computer verliert die Figur.
export function vorteilStart(art, spieler) {
  if (!VORTEIL_ARTEN[art]) throw new RangeError(`Unbekannter Vorteil: ${art}`);
  const computerWeiss = spieler === "b";
  const schwarz = computerWeiss ? SCHWARZ_ZEILE : ohne(SCHWARZ_ZEILE, art);
  const weiss = computerWeiss ? ohne(WEISS_ZEILE, art) : WEISS_ZEILE;
  let rechte = "KQkq";
  if (art === "turm") rechte = computerWeiss ? "Kkq" : "KQk";
  return `${schwarz}/pppppppp/8/8/8/8/PPPPPPPP/${weiss} w ${rechte} - 0 1`;
}

// Prüft eine Übungsstellung: gültig, Weiß am Zug, Schwarz nicht im Schach, nicht zu Ende.
export function pruefeStellung(fen) {
  const c = new Chess(fen);
  const flip = fen.replace(/ w /, " b ");
  const gegner = new Chess(flip);
  return {
    weissAmZug: c.turn() === "w",
    schwarzImSchach: gegner.isCheck(),
    zuEnde: c.isGameOver(),
  };
}
