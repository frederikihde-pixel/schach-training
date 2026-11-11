# Mitgelieferte Bibliotheken

Diese Bibliotheken liegen als Datei im Repository, damit die App ohne
Build-Schritt und ohne Internetverbindung läuft. Jede behält ihre eigene
Lizenz (siehe die jeweilige `LICENSE`-Datei).

## chess.js — Version 1.4.0

Schachregeln und Spielzustand (Züge, Schach/Matt/Patt-Erkennung, FEN/PGN).
Lizenz: BSD-2-Clause. Quelle: https://github.com/jhlywa/chess.js

Datei: `chess.js/chess.js` (ES-Modul, unverändert aus dem npm-Paket
`chess.js@1.4.0`, `dist/esm/chess.js`).

## chessground — Version 9.2.1

Zeigt das Brett an und nimmt Touch-/Maus-Eingaben entgegen. Kennt selbst
keine Schachregeln. Lizenz: GPL-3.0. Quelle: https://github.com/lichess-org/chessground

Datei: `chessground/chessground.min.js` (ES-Modul, unverändert aus dem
npm-Paket `chessground@9.2.1`, `dist/chessground.min.js`).

### Figurenset: Cburnett

Die Figuren sind als eingebettete SVGs in `chessground.cburnett.css`
enthalten. Das Cburnett-Figurenset von Colin M.L. Burnett steht unter der
CC-BY-SA-3.0-Lizenz (freie Lizenz, verlangt Namensnennung bei
Weiterverbreitung):
https://en.wikipedia.org/wiki/User:Cburnett/GFDL_images/Chess_pieces
