# CLAUDE.md

Diese Datei gilt für alle Arbeiten in diesem Repository.

## Was das ist

Eine Schach-Trainings-App für einen kleinen Freundeskreis. Statische
Webseite ohne Server und ohne Build-Schritt, gehostet über GitHub Pages.

## Feste Regeln

- **Oberfläche auf Deutsch.** Alle Texte, Beschriftungen und Hinweise in
  der App sind deutsch.
- **Mobile-first.** Zielgerät ist das Smartphone (390 px Breite). Alle
  Tippflächen sind mindestens 44×44 px groß.
- **Ruhiger, dunkler Stil.** Kein grelles Design, keine Animationen ohne
  Funktion, keine Werbung, keine Tracker.
- **Keine Emojis** in der App und in Commit-Nachrichten.
- **Keine Gamification.** Keine Punkte, Abzeichen, Serien ("Streaks"),
  Konfetti, Bestenlisten oder ähnliche Mechaniken.
- **Daten nur lokal im Browser** (z. B. `localStorage`). Es gibt keinen
  Server, keine Datenbank, kein Backend, keine Analytics.
- **Kein Build-Schritt.** Die App läuft direkt aus statischen
  HTML/CSS/JS-Dateien. Bibliotheken werden mit fester Version als Datei
  ins Repository kopiert (`vendor/`), nicht per CDN oder npm-Build
  eingebunden.

## Lizenz

Das Repository steht unter der GPL-3.0, weil die Brett-Bibliothek
Chessground GPL-lizenziert ist. Mitgelieferte Bibliotheken behalten ihre
eigene Lizenz (siehe `vendor/*/LICENSE`).

## Technik

- Reines HTML, CSS und JavaScript (ES-Module), keine Frameworks.
- `chess.js` liefert die Schachregeln und den Spielzustand.
- `chessground` zeigt das Brett an und nimmt Eingaben entgegen; es kennt
  selbst keine Schachregeln.
- Seiten laufen über Hash-Routen (`#/brett`, `#/taktik`, `#/mehr/...`), siehe
  `js/router.js`; eine Seite pro `<div class="page">` in `index.html`.
- Alle gespeicherten Daten gehen ausschließlich über `js/storage.js` (ein
  Schlüssel mit Versionsnummer und Migration). Kein direktes `localStorage`
  anderswo. Neue Felder: Standardwerte in `defaults()` ergänzen, bei Formatänderung
  `SCHEMA_VERSION` erhöhen und eine Migration schreiben.
- Neue App-Dateien in die `PRECACHE`-Liste in `sw.js` eintragen
  (`tests/unit/sw.test.mjs` prüft das).
- Rätsel-Daten (`data/puzzles/`) entstehen mit `tools/build_puzzles.py`
  (Lichess, CC0); der erste Zug in `zuege` ist der Gegnerzug.

## Arbeitsweise

- Vor jeder Sitzung zuerst `docs/STATUS.md` lesen.
- Ein Abschnitt nach dem anderen umsetzen, nach jedem Abschnitt committen.
- `docs/STATUS.md` nach jedem Abschnitt aktualisieren: fertig, getestet,
  offen, bekannte Mängel.
- Änderungen an der Bedienung mit Touch-Emulation bei 390 px Breite testen.
  Alle Tests: `tests/run-all.sh` (Logik, Python, Browser). Jede Seite darf bei
  390 px nicht seitlich überlaufen (`tests/e2e/overflow.cjs`).
