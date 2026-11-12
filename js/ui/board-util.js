// Kleine Helfer zwischen chess.js (Regeln) und Chessground (Anzeige).

export function toColor(turn) {
  return turn === "w" ? "white" : "black";
}

export function computeDests(chess) {
  const dests = new Map();
  for (const move of chess.moves({ verbose: true })) {
    const list = dests.get(move.from) || [];
    if (!list.includes(move.to)) list.push(move.to);
    dests.set(move.from, list);
  }
  return dests;
}

// Chessground merkt sich die Position des Bretts auf dem Bildschirm. Verschiebt sich das Brett
// (z. B. weil über ihm ein Hinweis erscheint oder verschwindet), würde ein Tipp sonst das falsche
// Feld treffen. Darum wird der Merker vor jeder neuen Berührung gelöscht.
export function keepBoundsFresh(el, getCg) {
  const clear = () => {
    const cg = getCg();
    if (cg) cg.state.dom.bounds.clear();
  };
  el.addEventListener("touchstart", clear, { capture: true, passive: true });
  el.addEventListener("mousedown", clear, { capture: true, passive: true });
}
