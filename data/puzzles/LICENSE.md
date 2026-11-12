# Lizenz der Rätsel-Daten

Die Dateien `band-*.json` und `index.json` in diesem Ordner sind ein Auszug aus der
Lichess-Rätsel-Datenbank.

- Quelle: https://database.lichess.org/#puzzles (Datei `lichess_db_puzzle.csv.zst`)
- Lizenz: Creative Commons CC0 1.0 (Public Domain Dedication),
  https://creativecommons.org/publicdomain/zero/1.0/
- Abgerufen und ausgewertet am: 2026-11-12
- Auswahl: Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100, je Wertungsband bis zu
  1000 Rätsel, gleichmäßig über die Themen verteilt. Erzeugt mit `tools/build_puzzles.py`.

Der erste Zug in `zuege` ist der Zug des Gegners.
