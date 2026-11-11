import { Chess } from "../vendor/chess.js/chess.js";
import { Chessground } from "../vendor/chessground/chessground.min.js";

const game = new Chess();

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status-message");
const promotionOverlay = document.getElementById("promotion-overlay");
const promotionChoices = document.getElementById("promotion-choices");

const PROMOTION_PIECES = [
  { code: "q", role: "queen", label: "Dame" },
  { code: "r", role: "rook", label: "Turm" },
  { code: "b", role: "bishop", label: "Läufer" },
  { code: "n", role: "knight", label: "Springer" },
];

function toColor(turn) {
  return turn === "w" ? "white" : "black";
}

function computeDests(chess) {
  const dests = new Map();
  for (const move of chess.moves({ verbose: true })) {
    const list = dests.get(move.from) || [];
    if (!list.includes(move.to)) list.push(move.to);
    dests.set(move.from, list);
  }
  return dests;
}

function syncBoard() {
  const turnColor = toColor(game.turn());
  const played = game.history({ verbose: true });
  const last = played[played.length - 1];

  cg.set({
    fen: game.fen(),
    turnColor,
    check: game.isCheck() ? turnColor : false,
    lastMove: last ? [last.from, last.to] : undefined,
    movable: {
      color: "both",
      dests: computeDests(game),
    },
  });

  updateStatus();
}

function updateStatus() {
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Schwarz" : "Weiß";
    statusEl.textContent = `Schachmatt. ${winner} gewinnt.`;
    statusEl.className = "status-message game-over";
  } else if (game.isCheck()) {
    statusEl.textContent = "Schach.";
    statusEl.className = "status-message check";
  } else {
    statusEl.textContent = "";
    statusEl.className = "status-message";
  }
}

function askPromotion(color, onChoose) {
  promotionChoices.innerHTML = "";
  for (const piece of PROMOTION_PIECES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "promo-btn";
    btn.innerHTML =
      `<span class="cg-wrap promo-piece"><piece class="${piece.role} ${color}"></piece></span>` +
      `<span class="promo-label">${piece.label}</span>`;
    btn.addEventListener("click", () => {
      promotionOverlay.hidden = true;
      onChoose(piece.code);
    });
    promotionChoices.appendChild(btn);
  }
  promotionOverlay.hidden = false;
}

function onAfterMove(orig, dest) {
  const candidates = game.moves({ verbose: true }).filter((m) => m.from === orig && m.to === dest);

  if (!candidates.length) {
    syncBoard();
    return;
  }

  if (candidates.some((m) => m.promotion)) {
    cg.set({ movable: { color: undefined } });
    askPromotion(toColor(game.turn()), (piece) => {
      game.move({ from: orig, to: dest, promotion: piece });
      syncBoard();
    });
    return;
  }

  game.move({ from: orig, to: dest });
  syncBoard();
}

const cg = Chessground(boardEl, {
  fen: game.fen(),
  orientation: "white",
  coordinates: true,
  blockTouchScroll: true,
  disableContextMenu: true,
  highlight: { lastMove: true, check: true },
  animation: { enabled: true, duration: 180 },
  movable: {
    free: false,
    color: "both",
    showDests: true,
    dests: computeDests(game),
    events: { after: onAfterMove },
  },
  draggable: { enabled: true, showGhost: true },
  selectable: { enabled: true },
  premovable: { enabled: false },
});
