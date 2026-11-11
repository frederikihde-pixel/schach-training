import { Chess } from "../vendor/chess.js/chess.js";
import { Chessground } from "../vendor/chessground/chessground.min.js";

const game = new Chess();

const boardEl = document.getElementById("board");

const cg = Chessground(boardEl, {
  fen: game.fen(),
  orientation: "white",
  coordinates: true,
  viewOnly: true,
});
