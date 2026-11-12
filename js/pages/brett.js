import { Chess } from "../../vendor/chess.js/chess.js";
import { Chessground } from "../../vendor/chessground/chessground.min.js";

const game = new Chess();
let startFen = game.fen();
let viewIndex = 0;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status-message");
const viewHintEl = document.getElementById("view-hint");
const moveListEl = document.getElementById("move-list");

const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnFlip = document.getElementById("btn-flip");
const btnReset = document.getElementById("btn-reset");

const fenInput = document.getElementById("fen-input");
const btnFenLoad = document.getElementById("btn-fen-load");
const btnFenCopy = document.getElementById("btn-fen-copy");
const fenErrorEl = document.getElementById("fen-error");

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

function getHistory() {
  const verbose = game.history({ verbose: true });
  const fens = [startFen, ...verbose.map((m) => m.after)];
  return { verbose, fens };
}

function renderPosition() {
  const { verbose, fens } = getHistory();
  const tip = fens.length - 1;
  if (viewIndex > tip) viewIndex = tip;
  if (viewIndex < 0) viewIndex = 0;

  const fen = fens[viewIndex];
  const atTip = viewIndex === tip;
  const posInfo = atTip ? game : new Chess(fen);
  const turnColor = toColor(posInfo.turn());
  const gameOver = atTip && posInfo.isGameOver();
  const frozen = !atTip || gameOver;
  const dests = frozen ? new Map() : computeDests(game);
  const lastMove = viewIndex > 0 ? [verbose[viewIndex - 1].from, verbose[viewIndex - 1].to] : undefined;

  cg.set({
    fen,
    turnColor,
    check: posInfo.isCheck() ? turnColor : false,
    lastMove,
    movable: {
      color: frozen ? undefined : "both",
      dests,
    },
  });

  btnBack.disabled = viewIndex === 0;
  btnForward.disabled = atTip;
  viewHintEl.hidden = atTip;

  renderMoveList(verbose, tip);
  if (document.activeElement !== fenInput) fenInput.value = fen;
  updateStatus(posInfo, atTip);
}

function updateStatus(posInfo, atTip) {
  if (!atTip) {
    statusEl.textContent = "";
    statusEl.className = "status-message";
    return;
  }

  if (posInfo.isCheckmate()) {
    const winner = posInfo.turn() === "w" ? "Schwarz" : "Weiß";
    statusEl.textContent = `Schachmatt. ${winner} gewinnt.`;
    statusEl.className = "status-message game-over";
  } else if (posInfo.isStalemate()) {
    statusEl.textContent = "Patt. Die Partie ist remis.";
    statusEl.className = "status-message game-over";
  } else if (posInfo.isThreefoldRepetition()) {
    statusEl.textContent = "Remis durch dreifache Stellungswiederholung.";
    statusEl.className = "status-message game-over";
  } else if (posInfo.isInsufficientMaterial()) {
    statusEl.textContent = "Remis durch zu wenig Material.";
    statusEl.className = "status-message game-over";
  } else if (posInfo.isDrawByFiftyMoves()) {
    statusEl.textContent = "Remis durch die 50-Züge-Regel.";
    statusEl.className = "status-message game-over";
  } else if (posInfo.isDraw()) {
    statusEl.textContent = "Die Partie ist remis.";
    statusEl.className = "status-message game-over";
  } else if (posInfo.isCheck()) {
    statusEl.textContent = "Schach.";
    statusEl.className = "status-message check";
  } else {
    statusEl.textContent = "";
    statusEl.className = "status-message";
  }
}

function renderMoveList(verbose, tip) {
  moveListEl.innerHTML = "";

  const parts = startFen.split(" ");
  const startActiveColor = parts[1];
  const startFullmove = parseInt(parts[5], 10) || 1;

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "move-entry" + (viewIndex === 0 ? " current" : "");
  startBtn.textContent = "Start";
  startBtn.addEventListener("click", () => {
    viewIndex = 0;
    renderPosition();
  });
  moveListEl.appendChild(startBtn);

  verbose.forEach((move, i) => {
    const pliesFromWhiteStart = i + (startActiveColor === "b" ? 1 : 0);
    const moveNumber = startFullmove + Math.floor(pliesFromWhiteStart / 2);
    const isWhiteMove = pliesFromWhiteStart % 2 === 0;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "move-entry" + (viewIndex === i + 1 ? " current" : "");
    const numberLabel = isWhiteMove ? `${moveNumber}.` : i === 0 ? `${moveNumber}…` : "";
    btn.innerHTML = numberLabel
      ? `<span class="move-number">${numberLabel}</span>${move.san}`
      : move.san;
    btn.addEventListener("click", () => {
      viewIndex = i + 1;
      renderPosition();
    });
    moveListEl.appendChild(btn);
  });

  if (tip === 0) moveListEl.innerHTML = "";
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
    renderPosition();
    return;
  }

  if (candidates.some((m) => m.promotion)) {
    cg.set({ movable: { color: undefined } });
    askPromotion(toColor(game.turn()), (piece) => {
      game.move({ from: orig, to: dest, promotion: piece });
      viewIndex = game.history().length;
      renderPosition();
    });
    return;
  }

  game.move({ from: orig, to: dest });
  viewIndex = game.history().length;
  renderPosition();
}

function loadFen(fen) {
  try {
    game.load(fen);
    startFen = game.fen();
    viewIndex = 0;
    fenErrorEl.hidden = true;
    renderPosition();
  } catch (err) {
    fenErrorEl.textContent = "Ungültige FEN-Stellung.";
    fenErrorEl.hidden = false;
  }
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

btnBack.addEventListener("click", () => {
  viewIndex = Math.max(0, viewIndex - 1);
  renderPosition();
});

btnForward.addEventListener("click", () => {
  const { fens } = getHistory();
  viewIndex = Math.min(fens.length - 1, viewIndex + 1);
  renderPosition();
});

btnFlip.addEventListener("click", () => {
  cg.toggleOrientation();
});

btnReset.addEventListener("click", () => {
  game.reset();
  startFen = game.fen();
  viewIndex = 0;
  fenErrorEl.hidden = true;
  renderPosition();
});

btnFenLoad.addEventListener("click", () => {
  loadFen(fenInput.value.trim());
});

fenInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadFen(fenInput.value.trim());
});

btnFenCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(fenInput.value);
  } catch (err) {
    fenInput.select();
    document.execCommand("copy");
  }
});

renderPosition();
