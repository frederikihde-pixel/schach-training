# Lizenz der Rätsel-Daten

Die Dateien `band-*.json`, `pruefset*.json` und `index.json` in diesem Ordner sind ein Auszug aus der
Lichess-Rätsel-Datenbank.

- Quelle: https://database.lichess.org/#puzzles (Datei `lichess_db_puzzle.csv.zst`)
- Lizenz: Creative Commons CC0 1.0 (Public Domain Dedication),
  https://creativecommons.org/publicdomain/zero/1.0/
- Abgerufen und ausgewertet am: 2026-11-17
- Auswahl: je Wertungsband bis zu 1000 Rätsel, gleichmäßig über die Themen verteilt. Erzeugt mit
  `tools/build_puzzles.py`.
- Filter: streng (Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100). In den Bändern unter
  700, wo das nicht für 1000 Rätsel reicht, gelockert: Stufe 1 NbPlays >= 200, Stufe 2
  zusätzlich Popularity >= 80. Welche Stufe in welchem Band gilt, steht in `index.json`.
- In den Bändern unter 1100 gibt es von den Einsteiger-Themen (Matt in 1, Matt in 2, ungedeckte
  Figur, Gabel, Fesselung und, falls vorhanden, Einzüger) mindestens 80 Rätsel.
- `pruefset.json` ("Fortgeschritten") und `pruefset-einsteiger.json` ("Einsteiger"): je 20 feste
  Rätsel für die Standortbestimmung; sie fehlen in den Bandateien.

Der erste Zug in `zuege` ist der Zug des Gegners.
