// Einfache Material-Hilfen auf Basis von chess.js (ohne Engine, ohne DOM).
// Wird für Tests der Stufen, die Patzer-Warnung und die Erklärungen der Analyse benutzt.

export const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function wertSumme(chess, color) {
  let sum = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) sum += WERT[sq.type];
  return sum;
}

// Figuren (ohne König, ohne Bauern wenn ohneBauern) einer Farbe, die der Gegner schlagen könnte und
// dabei Material gewinnt: Die Figur ist angegriffen und ungedeckt, oder sie wird von einer billigeren
// Figur angegriffen. Pins und Zugpflicht bleiben unberücksichtigt (einfache Näherung).
// Ist der Gegner am Zug, zählt "ungedeckt" nur, wenn er die Figur auch mit einem legalen Zug schlagen kann
// (eine gefesselte Figur kann nicht schlagen).
// Ergebnis: [{ square, type, grund: "ungedeckt" | "tausch" }]
export function gefaehrdeteFiguren(chess, color, { ohneBauern = false } = {}) {
  const gegner = color === "w" ? "b" : "w";
  const out = [];
  const schlagbar = chess.turn() === gegner ? new Set(chess.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to)) : null;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === "k") continue;
      if (ohneBauern && sq.type === "p") continue;
      const angreifer = chess.attackers(sq.square, gegner);
      if (!angreifer.length) continue;
      const verteidiger = chess.attackers(sq.square, color).filter((s) => s !== sq.square);
      if (!verteidiger.length) {
        if (schlagbar && !schlagbar.has(sq.square)) continue;
        out.push({ square: sq.square, type: sq.type, grund: "ungedeckt" });
        continue;
      }
      const billigster = Math.min(...angreifer.map((s) => WERT[chess.get(s).type] || 99));
      if (billigster < WERT[sq.type]) out.push({ square: sq.square, type: sq.type, grund: "tausch" });
    }
  }
  return out;
}

export function figurName(type) {
  return { p: "Bauer", n: "Springer", b: "Läufer", r: "Turm", q: "Dame", k: "König" }[type];
}
