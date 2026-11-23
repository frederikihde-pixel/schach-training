# Status

Diese Datei wird zu Beginn jeder Sitzung zuerst gelesen und nach jedem
Abschnitt aktualisiert. Stand: 19.11.2026.

## Nächste Schritte

1. **Pull Request 7 prüfen und mergen** (Teil E bis H: Analyse, Rückblick, eigene Fehler als Rätsel, Fortschritt, Einführung;
   Pull Request 6 mit Teil A bis D ist gemergt, Pull Request 5 ebenfalls). Danach **auf dem echten Handy prüfen** (Liste ganz
   unten, Abschnitte "Computergegner" und "Analyse und Rückblick"): Stufen, Bedenkzeit, Wärme und Akku, App-Wechsel auf dem iPhone,
   Dauer der Analyse (Schätzung 30 bis 40 Sekunden für 80 Stellungen, Grenze 90 Sekunden).
2. **Stufen und Analyse nach dem Handytest nachstellen**, falls nötig: Stufenwerte (Stufenversion erhöhen, `docs/STUFEN.md` anpassen),
   Suchzeit der Analyse (dann einstellbar machen: schnell 0,15 s, normal 0,3 s, genau 0,6 s).
3. **Phase 3, Partien von Chess.com holen:** Partien nach Benutzername holen (öffentliche, nur lesende Chess.com-Schnittstelle
   ohne Konto; alternativ eine PGN-Datei importieren, das Laden per PGN auf der Brett-Seite gibt es schon). Die **Analyse
   (`js/analyse.js`, `js/rueckblick.js`) ist quellenunabhängig und wartet darauf**: Eingabe PGN und Farbe des Spielers genügen, Fehler
   werden dann wie bei eigenen Partien zu Rätseln. Vorher klären: Der Benutzername verlässt das Gerät nur für die Abfrage; wie
   viele Partien werden gespeichert (Speichergrenze etwa 5 MB; eine Analyse braucht etwa 2 bis 5 KB, 50 Stück sind erlaubt).
4. Danach Phase 4 (Eröffnung und Endspiel) und Phase 5 (Tagesplan).

## Stand auf einen Blick

| Teil | Stand |
| --- | --- |
| Phase 1: Brett | fertig, gemergt, emuliert getestet |
| Vorarbeiten: Mängel, Speichern, installierbar, Rätsel-Daten | fertig, gemergt |
| Phase 2: Taktik-Training mit Statistik und Standortbestimmung | fertig, gemergt (Rätsel-Daten und Prüfset liegen auf `main`) |
| Brett-Designs, Einführung, leere Zustände | fertig, gemergt (Pull Request 4), emuliert getestet |
| Taktik für Einsteiger (Wertung um 440): leichtere Bänder, Prüfset Einsteiger, Einstufung ab 700, Denkhilfe, Themen-Seite | fertig, gemergt (Pull Request 5), emuliert getestet |
| Computergegner, Teil A bis D: Engine, 8 Stufen, Spielen, Grundmatts, Vorteil verwerten, Partien speichern | fertig, gemergt (Pull Request 6), emuliert getestet |
| Computergegner, Teil E bis H: Analyse, Rückblick, eigene Fehler als Rätsel, Fortschritt, Einführung | fertig, emuliert getestet (Pull Request 7, noch nicht gemergt) |
| Phase 3 (Partien von Chess.com holen) | nicht begonnen; die Analyse dafür ist fertig und quellenunabhängig |
| Phase 4 und 5 | nicht begonnen |

Alle Tests: `tests/run-all.sh` (Logik, Python, Browser mit 390 px und Touch-Emulation;
`QUICK=1` überspringt die langen Tests, sonst etwa 40 Minuten). Stand 19.11.2026: 151 Logik-Tests
(davon 10 Kontrast-Tests), 31 Python-Tests und 575 Browser-Prüfungen in 30 Dateien, alle bestanden.
Screenshots der Designs: `node tests/e2e/screenshots.cjs` (schreibt nach `tests/screenshots/`).

## Phase 1 — Ein Brett, auf dem ich beide Seiten spielen kann

**Fertig:**
- chess.js 1.4.0 und chessground 9.2.1 liegen im Repository (`vendor/`), Cburnett-Figurenset
  (CC-BY-SA-3.0). Das Repository steht unter GPL-3.0.
- Tippen-Tippen und Ziehen, erlaubte Züge, Schach, letzter Zug, Umwandlungsauswahl, Rochade,
  en passant. Die Seite scrollt beim Ziehen nicht.
- Zug zurück und vor (auch per Klick in der Zugliste), Brett drehen, Neustart, FEN laden und
  ausgeben, Spielende (Matt, Patt, dreifache Wiederholung, 50-Züge-Regel, zu wenig Material).
- Fehler behoben: Nach dem Hinweis "Schach." verschob sich das Brett auf der Seite, und
  Chessground traf mit dem gemerkten Standort das falsche Feld. Der Standort wird jetzt vor
  jeder Berührung neu gelesen (`keepBoundsFresh`).

**Getestet (emuliert):** Rochade kurz und lang, en passant, Umwandlung, Narrenmatt, Patt,
Zug zurück und vor, Drehen, FEN laden, Zug nach "Schach." (`tests/e2e/brett.cjs`).

**Bekannte Mängel:**
- Schwarze Figuren waren auf dem dunklen Brett schlecht zu erkennen (Kontrast nur 1,3 bis
  1,6 zu 1). Gelöst in Pull Request 4 durch auswählbare Brett-Designs (siehe dort).
- Die Zugliste zeigt nur die gespielte Hauptlinie, keine Varianten.

## Vorarbeiten (Mängel, Speichern, Installierbarkeit, Rätsel-Daten)

**Fertig:**
- Seite ist bei 390 px genau 390 px breit; Zoom erlaubt, Doppeltipp-Zoom auf dem Brett
  verhindert (`touch-action: manipulation`).
- Hash-Router (`#/brett`, `#/taktik`, `#/taktik/statistik`, `#/spielen/...`, `#/mehr/...`; Stand 19.11.2026: Pfade mit Parameter wie
  `#/spielen/rueckblick/<id>` möglich), feste untere Leiste (Brett, Taktik, Spielen), Knopf "Mehr" oben rechts, Info-Seite mit Namensnennung Cburnett (CC BY-SA 3.0)
  und den Lizenzen.
- Zentrale Speicherung `js/storage.js`: ein Schlüssel (`schach-training`) mit Versionsnummer und
  Migrationskette, Schutz vor unlesbaren Ständen, `navigator.storage.persist()` bei jedem Start.
- Seite "Mehr > Daten": exportieren, importieren (mit Vorschau und Rückfrage), löschen, Hinweis
  "immer denselben Link benutzen"; Hinweisleiste nach 14 Tagen ohne Export.
- Installierbar: `manifest.webmanifest`, Icons ohne Emojis (`tools/make_icons.py`), `sw.js` mit
  Netzwerk-zuerst (online immer die neueste Version, Cache nur als Rückfall), versionierter Cache.
- Rätsel-Daten: `tools/build_puzzles.py` (nur Standardbibliothek) und
  `.github/workflows/build-puzzles.yml` bauen `data/puzzles/` aus der Lichess-Datenbank (CC0).
  Echter Lauf am 12.11.2026: 6.193.530 Zeilen gelesen, 2.188.703 bestanden die Filter, 22 Bänder
  mit je 1000 Rätseln, 49 Themen, 3,18 MB.

## Phase 2 — Taktik-Training

**Fertig:**
- Rätsel lösen: Der erste Zug in `zuege` ist der Gegnerzug und wird automatisch gespielt, Brett
  aus Sicht des Spielers, "Weiß am Zug" oder "Schwarz am Zug" darüber. Falscher Zug: kurz gezeigt,
  zurückgenommen, Fehler, Rätsel nicht gelöst. Jeder Matt-in-1-Zug zählt. Keine Hinweise.
- Nach einem Fehler: Lösung Zug für Zug zeigen, dann einmal selbst nachspielen.
- Einstufung mit 10 adaptiven Rätseln ab 1000, danach einfaches Elo (K = 40, 24, 16), Rätsel
  im Bereich Stärke minus 50 bis plus 150. Die Stärke erscheint nur als ruhige Zahl.
- Wiederholung nach Leitner (1, 3, 7, 21 Tage), Sitzungen mit 10 Rätseln (30 Prozent
  Wiederholung, 70 Prozent neu, davon die Hälfte aus den schwächsten Themen), Fortschritt
  "Rätsel 4 von 10", ruhige Zusammenfassung, fortsetzbare Sitzungen, Themenfilter.
- Statistik: Trefferquote und Zeit je Thema (ab 5 Versuchen), Liniendiagramm der Stärke,
  Sitzungen pro Woche, die 3 schwächsten Themen mit "Dieses Thema üben".
- Standortbestimmung: 20 feste Prüfrätsel (`data/puzzles/pruefset.json`, Wertung 848 bis 2051,
  Satz `d5b8cbda`, nicht im Trainingsvorrat), ohne Hinweise, Ergebnis mit Datum als einfache
  Liste, ruhige Erinnerung nach 4 Wochen. Das Prüfset bleibt bei Neubauten der Daten unverändert.
- Bänder werden erst geladen, wenn sie gebraucht werden, und für offline zwischengespeichert.
- Speicherformat Version 2 mit Migration (`taktik.anzahl`, `taktik.standort`).

**Entscheidungen und bekannte Grenzen:**
- Wiederholungen ändern die Taktikstärke nicht; die Standortbestimmung auch nicht.
- Die Einstufung beim ersten Start kann man nicht überspringen.
- Beim ersten Start braucht die Taktik-Seite einmal eine Internetverbindung (Bänder holen).
- Sehr lange Rätsel kosten Zeit; die Zeitmessung deckelt bei 120 Sekunden.

**Getestet (emuliert, Stand 12.11.2026):** 41 Logik-Tests, 16 Python-Tests, 180 Browser-Prüfungen,
alle bestanden: Rätsel richtig und falsch lösen, Matt-in-1-Alternative, Einstufung mit
simulierten Spielern (Stärke 900, 1500, 2100 ergibt 909, 1490, 2090), Wiederholungsplanung mit
verschobenem Datum, Export/Import, Offline, Standortbestimmung komplett, Erinnerung nach 28 Tagen.

## Brett-Designs, Einführung, leere Zustände (Pull Request 4, gemergt)

**Fertig bisher:**
- Speicherformat Version 3: `einstellungen.brettDesign` und `einstellungen.einfuehrungGesehen`.
  Neue Nutzer: Design Klassisch, Einführung noch nicht gesehen. Bisherige Stände (Version 2 und
  älter, auch importierte Dateien): Design Dunkel, Einführung gilt als gesehen (bleibt unter
  "Mehr" erreichbar). Wer bisher nur das Brett benutzt und nie etwas gespeichert hat, zählt als neu.
- `js/board-designs.js`: eine Quelle für Feldfarben und Markierungen der drei Designs (Klassisch,
  Dunkel, Grün).
- `tests/unit/kontrast.test.mjs` berechnet den Kontrast aller Designs und gibt alle Werte aus.
  Dunkel: schwarze und weiße Figuren auf beiden Feldfarben mindestens 3:1 (gemessen schwarz 6,74
  und 3,34, weiß 3,11 und 6,28), Zielpunkte, Ringe, Schach-Rahmen und Koordinaten mindestens 3:1.
  Markierte Felder (letzter Zug, gewähltes Feld, Schach) heben sich um mindestens 1,3:1 ab,
  und Figuren bleiben darauf mindestens 3:1 erkennbar. Klassisch und Grün: Zielpunkte, Ringe und
  Schach-Rahmen mindestens 3:1 (sehr dunkle Markierungen), Flächen mindestens 1,2:1.
- Korrektur zu meiner früheren Aussage: 3:1 auf beiden Feldfarben ist bei braun/creme und
  grün/creme doch möglich, aber nur mit sehr dunklen Markierungen. Eine Fläche (letzter Zug,
  gewähltes Feld) mit 3:1 gegen das normale Feld geht dagegen nirgends, ohne die Figuren darauf
  unleserlich zu machen; dort gelten die niedrigeren Werte oben.

- Drei Designs: Klassisch (Standard für neue Nutzer), Dunkel (verbessert, mittelhelle Felder in
  Blaugrau) und Grün (Creme gegen gedämpftes Grün: vertraut, ruhig, wenig Blendung, schwarze Figuren
  mindestens 5,7:1). Nur das Brett ändert sich, die App-Oberfläche bleibt dunkel.
- Mehr > Darstellung (`#/mehr/darstellung`): drei Karten mit echter Vorschau (Figuren beider Farben
  auf beiden Feldfarben, letzter Zug, gewähltes Feld, Zielpunkte, Schlagring, Schach). Die Wahl wirkt
  sofort auf Brett, Taktik und Standortbestimmung und wird gespeichert (`js/design.js`).
- Die Figuren der Umwandlungsauswahl liegen auf der Feldfarbe des Designs mit dem besten Kontrast
  (weiße auf dem dunklen, schwarze auf dem hellen Feld).
- Kleiner Fehler im Brett behoben: Nach "Neustart" oder FEN laden blieb das zuvor gewählte Feld
  markiert.
- Getestet: `tests/e2e/design.cjs` (21 Prüfungen: Standard, sofortiger Wechsel auf allen Brettern,
  Speichern nach Neuladen, Migration, Vorschau, Umwandlung).

- Screenshots aller Designs (Startstellung; Stellung mit Schach, letztem Zug, gewähltem Feld,
  Zielpunkten und Schlagring) liegen unter `tests/screenshots/` (erzeugt mit
  `node tests/e2e/screenshots.cjs`).
- Service Worker: `CACHE_VERSION` ist jetzt 2, alte Caches werden beim Aktivieren gelöscht.
- Koordinaten (Buchstaben und Zahlen) liegen jetzt über den Figuren; vorher verdeckten die
  Figurensockel die Buchstaben der ersten Reihe.

**Schwächen, die ich auf den Screenshots sehe (ehrlich):**
- Dunkel: Die schwächsten Paare sind die schwarze Figur auf dem dunklen Feld (3,3:1) und die weiße
  Figur auf dem hellen Feld (3,1:1). Das ist die Grenze, bei der das Schachbrettmuster noch klar
  erkennbar bleibt; die Figuren sind auf den Bildern gut zu erkennen, draußen ungeprüft.
- Dunkel: Die Markierungen sind kräftige Farbflächen (Bernstein, Türkis, Rot). Das war nötig, damit
  die Figuren darauf lesbar bleiben (mindestens 3:1) und die Fläche sich vom Feld abhebt. Es wirkt
  weniger zurückhaltend als vorher.
- Klassisch und Grün: Die Füllung weißer Figuren auf den hellen Feldern ist nur etwa 1,2:1 hell
  gegen Creme; sie wird vom schwarzen Rand getragen. Auf den Bildern gut sichtbar, bei starkem
  Sonnenlicht zu prüfen.
- Letzter Zug bei Klassisch und Grün: Das gleiche Gelb sieht auf Creme heller aus als auf Braun
  oder Grün; die beiden Felder gehören trotzdem erkennbar zusammen.
- Koordinaten: Auf braunen und grünen Feldern stehen dunkle Zeichen mit hellem Rand (rund 3:1),
  die kleinen Buchstaben sind lesbar, aber keine Stärke. Einen einzelnen Farbwert mit 3:1 auf
  hellem und dunklem Feld gibt es dort nicht.
- Die Vorschau in "Darstellung" ist klein (112 px); Figuren sind dort nur zu erahnen, die Farben
  und Markierungen aber gut zu beurteilen.

- Einführung (`js/pages/einfuehrung.js`): Vollbild-Fenster mit 6 kurzen Seiten (Was die App kann; So
  fängst du an; So löst du ein Rätsel; Fehler sind das Training; Fortschritt messen; Daten, Gerät und
  ein ehrlicher Hinweis). Wischen (natives Einrasten) oder "Weiter" und "Zurück", immer
  "Überspringen", "Seite 2 von 6", keine Effekte, keine Emojis. Sie erscheint beim ersten Start
  automatisch (nur neue Nutzer) und ist unter Mehr > Einführung jederzeit wieder aufrufbar.
  "Überspringen" und "Fertig" zählen als gesehen (`einstellungen.einfuehrungGesehen`).
- Getestet: `tests/e2e/einfuehrung.cjs` (44 Prüfungen: nur beim ersten Start, überspringen, wieder
  öffnen, Weiter, Wischen per Touch, Inhalt, keine Emojis, Tippflächen, bisherige Nutzer ohne
  automatische Einführung). Alle anderen Browsertests starten mit "Einführung schon gesehen"
  (`tests/e2e/lib.cjs`, `seed: false` schaltet das für neue Nutzer aus).

- Leere Zustände: Die Statistik ohne Daten zeigt einen erklärenden Satz und einen Knopf
  ("Einstufung starten" vor der Einstufung, danach "Sitzung starten"; läuft eine Sitzung, "Zur
  Sitzung") statt leerer Diagramme. Auf der Seite Üben erklärt ein Satz die Wiederholungen
  ("Noch keine Wiederholungen. Rätsel, die du nicht löst, kommen nach 1, 3, 7 und 21 Tagen wieder."),
  darunter steht der Knopf "Sitzung starten".
- Getestet: `tests/e2e/leer.cjs` (16 Prüfungen).

**Offen:** Test auf dem echten Handy (Liste unten).

## Taktik für Einsteiger (Wertung um 440), fertig, emuliert getestet

Ausgangslage: Die Taktik-Funktionen waren für Spieler um 1000 gebaut (Einstufung ab 1000, Rätsel ab
Wertung 600, Prüfset 850 bis 2050). Für eine Chess.com-Wertung um 440 ist das zu schwer. Der Umbau läuft in
Abschnitten; nach jedem Abschnitt wird committet.

### Abschnitt 1: Rätsel-Daten (`tools/build_puzzles.py`), Skript fertig, Daten noch nicht gebaut

- Bänder ab 300 (je 100 Punkte). Bänder unter 600 entstehen nur, wenn mindestens 100 Rätsel die
  Filter bestehen; sonst steht im Log "Band ... entfällt" und in `index.json` unter `entfalleneBaender`.
- Filterstufen: überall zuerst streng (Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100).
  Nur in Bändern unter 700 wird zum Auffüllen gelockert: Stufe 1 NbPlays >= 200; Stufe 2 zusätzlich
  Popularity >= 80. Strenge Rätsel werden immer zuerst genommen. `index.json` hält je Band fest, wie viele
  Kandidaten jede Stufe hatte (`kandidaten`), wie viele gewählt wurden (`filter.gewaehlt`) und welche
  höchste Stufe vorkommt (`filter.hoechsteStufe`).
- Einsteiger-Themen: In allen Bändern unter 1100 mindestens je 80 Rätsel für `mateIn1`, `mateIn2`,
  `hangingPiece`, `fork`, `pin` und `oneMove` (nur falls der Rohdatensatz das Schlagwort hat; sonst steht es
  unter `einsteiger.fehlendeThemen` und im Log). Das Log listet außerdem alle echten Schlagworte der
  unteren Bänder.
- Zweites Prüfset `pruefset-einsteiger.json` (20 feste Rätsel, Wertung 450 bis 1100 von leicht nach schwer,
  10 Themen je zweimal; nur strenge Kandidaten wenn möglich; nicht im Trainingsvorrat; keine
  Überschneidung mit `pruefset.json`). Vorhandene Prüfsets werden beim Neubau übernommen
  (`--pruefset-neu`, `--einsteiger-neu` erzwingen eine neue Wahl). `index.json` bekommt `pruefsets`
  (Fortgeschritten und Einsteiger); der alte Schlüssel `pruefset` bleibt.
- Zufall: jedes Band, jede Stufe und jedes Thema hat einen eigenen Startwert. Rätsel-Auswahl in hohen
  Bändern ändert sich daher nicht, wenn untere Bänder dazukommen (getestet).
- Getestet (Python, künstliche CSV): 31 Tests, alle bestanden. Neu: Bänder ab 400 und Band 300 nur mit
  genug Rätseln, strenge zuerst und Stufen nur unter 700, Mindestzahl der Themen auch mit gelockerten
  Rätseln, Prüfset Einsteiger (20, Wertung, Themen, getrennt, fest, Neubau mit Flag), unabhängige Bänder.
- **Echte Daten gebaut** (GitHub-Lauf vom 17.11.2026 auf dem Arbeits-Branch; 6,19 Mio. Zeilen gelesen, 2,31 Mio. bestanden die
  Filter, Gesamtgröße 3,58 MB):

  | Band | Rätsel | streng gewählt | Stufe 1 | Stufe 2 | Kandidaten streng / Stufe 1 / Stufe 2 |
  | --- | --- | --- | --- | --- | --- |
  | 300 | 1000 | 117 | 651 | 232 | 117 / 780 / 339 |
  | 400 | 1000 | 948 | 44 | 8 | 3717 / 15283 / 5778 |
  | 500 | 1000 | 936 | 14 | 50 | 8524 / 23589 / 11217 |
  | 600 | 1000 | 1000 | 0 | 0 | 15679 / (30201 / 17912, nicht nötig) |
  | ab 700 | je 1000 | alle streng | 0 | 0 | nicht gelockert |

- Auffälligkeiten:
  - **Band 300 enthält nur Rätsel mit Wertung 399** (Untergrenze der Lichess-Wertung) und besteht zu 88 Prozent aus
    gelockerten Rätseln. Er taugt nicht zum Feinabstufen; die App lädt Bänder erst ab 400 (die Datei bleibt zunächst liegen).
  - `oneMove` gibt es im Rohdatensatz (157 418 Rätsel), aber praktisch nur zusammen mit `mateIn1` (157 330); es ist für die App
    kein eigenes Thema. Die Mindestzahl gilt für beide gleich.
  - Mindestzahl 80 je Einsteiger-Thema: erreicht in den Bändern 500 bis 1000; **Band 400: Fesselung (pin) nur 10**,
    Gabel (fork) genau 80; Band 300: Gabel 0, Fesselung 0, ungedeckte Figur 36. Es gibt dort schlicht kaum solche Rätsel
    (alle Stufen waren schon ausgeschöpft).
  - Rätsel mit einem Zug (nur Matt in 1): Band 400 gut die Hälfte (555 von 1000), Band 500 463, Band 600 393.
- Prüfset Einsteiger (`pruefset-einsteiger.json`, Satz `6f01270e`): 20 Rätsel, Wertung 450 bis 1100, aufsteigend, keine Überschneidung mit
  `pruefset.json` (Satz `d5b8cbda`, unverändert 848 bis 2051) und mit den Bändern.

### Abschnitt 2: Einstufung und Auswahl für Einsteiger, fertig (emuliert getestet)

- Die App liest `index.json` und lädt nur vorhandene Bänder ab 400 (Band 300 bleibt unbenutzt; ohne lesbare `index.json` gilt die
  Liste 400 bis 2700). Untergrenze für Rätselwertung und Stärke: 400.
- Einstufung beginnt bei 700 (vorher 1000). Schrittweite: 250, halbiert sich bei jedem Richtungswechsel (mindestens 50), wächst
  bei gleicher Richtung um die Hälfte (höchstens 400). Simulierte Spieler (Rätselwertung Ziel plus/minus 50): sichere
  Antworten höchstens 83 daneben (Stärke 400), bei 450 höchstens 53, 600 höchstens 47, 900 höchstens 41, 1500 höchstens 80;
  zufällige Antworten (200 Läufe) im Mittel höchstens 79 daneben (bei 450 etwas zu hoch, weil unten bei 400 Schluss ist).
- Neu auf der Seite Üben: "Einstufung wiederholen" mit Rückfrage. Verlauf, Wiederholungskarten und Statistik bleiben;
  die alte Stärke gilt, bis die neue Einstufung fertig ist; bereits gespielte Rätsel kommen nicht noch einmal.
- Das Schlagwort `oneMove` wird beim Laden nicht als Thema übernommen (doppelt zu "Matt in 1").

### Abschnitt 3: Sitzungen und Themen, fertig (emuliert getestet)

- Rätselfenster einer Sitzung: bei Stärke unter 1000 minus 50 bis plus 100, sonst wie bisher minus 50 bis plus 150. Anteil
  der schwächsten Themen unverändert.
- Jedes Thema hat einen deutschen Namen und einen erklärenden Satz (`js/themes.js`). Neue Seite `#/taktik/themen`
  (dritter Reiter neben Üben und Statistik): zehn Einsteiger-Themen oben, danach die übrigen, je mit "Dieses Thema üben".

### Abschnitt 4: Zwei Prüfsets, fertig (emuliert getestet)

- Statistik-Seite: Wahl zwischen "Prüfset Einsteiger" (20 Rätsel, etwa 450 bis 1100) und "Prüfset Fortgeschritten" (20 Rätsel,
  etwa 850 bis 2050, unverändert). "Empfohlen" steht beim Einsteiger-Set bei Stärke unter 1000 oder unbekannter Stärke,
  sonst beim Fortgeschrittenen-Set.
- Speicher **Version 4** mit Migration: vorhandene Ergebnisse gelten als "fortgeschritten"; jedes Ergebnis speichert den Satz
  (`pruefset`); die Ergebnislisten sind getrennt und werden nie verglichen oder vermischt. Neue Einstellung
  `einstellungen.denkhilfe` (Standard: an). Alte Sicherungsdateien (Version 2 und 3) lassen sich weiter importieren.
- Die Erinnerung nach 4 Wochen zählt ab dem letzten Ergebnis (egal welcher Satz) und nennt den Satz dieses Ergebnisses.
- Offline: `index.json`, beide Prüfsets und die Bänder um die eigene Stärke werden im Hintergrund vorab geholt (getestet:
  Standortbestimmung mit beiden Sätzen ohne Netzwerk).

### Abschnitt 5: Der häufigste Fehler, fertig (emuliert getestet)

- **Denkhilfe:** Zeile "Erst prüfen: Was bedroht der Gegner? Welche Figur ist ungedeckt?" über dem Brett. Sie erscheint nur bei den
  ersten 10 Rätseln überhaupt (gezählt an den bisher gespielten Rätseln) und nur bei Stärke unter 900 (unbekannt zählt dazu),
  nie in der Standortbestimmung. Der Platz wird zu Beginn eines Laufs reserviert; das Brett springt nicht (getestet).
  Abschaltbar unter Mehr, Einstellungen.
- **Einführung:** neue 7. Seite "Der häufigste Fehler: ungedeckte Figuren und übersehene Drohungen" mit den vier Fragen vor jedem Zug.
  Die Einführung hat jetzt 7 Seiten (vorher 6; die neue Vorgabe geht der früheren Grenze von 4 bis 6 vor).

### Was nur emuliert ist und was auf dem echten Handy zu prüfen ist (Taktik für Einsteiger)

Emuliert getestet (Chromium mit 390 px und Touch-Emulation, echte Rätsel-Daten): Rechenlogik der Einstufung mit simulierten
Spielern, Auswahl der Bänder, Seiten, Speicher-Migration, Offline-Betrieb mit dem Service Worker, Überlauf, Tippflächen
mindestens 44 px. **Nicht** emuliert beurteilbar (bitte auf dem echten Handy prüfen):
- Sind die Rätsel ab etwa 450 **machbar** (nicht zu schwer, nicht zu leicht)? Fühlt sich Band 400 und 500 sinnvoll an?
  (Jedes zweite Rätsel in Band 400 ist ein Matt in 1.)
- Landet die neue **Einstufung** nahe der eigenen Wertung (etwa 450 bis 500)? Die Simulation setzt voraus, dass jemand Rätsel unterhalb seiner
  Stärke sicher löst und darüber nicht; echte Menschen raten und schwanken.
- Ist die **Denkhilfe** hilfreich oder stört sie? Ist der Text auf dem Handy gut lesbar und hat er genug Abstand zum Brett?
- Sind die **Erklärungen der Themen** verständlich? Was fehlt oder ist unklar?
- Ist die Wahl zwischen den zwei **Prüfsets** auf der Statistik-Seite klar genug?

## Computergegner und Training mit Partien (Branch `claude/chess-computer-training-sz5jp1`)

Ziel: Partien gegen den Computer als Trainingsmethode (Spielen, Rückblick, eigene Fehler als Rätsel,
Fortschritt mit Zahlen). Keine Gamification.

### Teil A: Engine einbinden, fertig (Abschnitt 1)

- `vendor/stockfish/`: Stockfish.js 19.0.1, "lite single-threaded" (`.js` 28 KB, `.wasm` 1,85 MB), `Copying.txt`
  (GPL-3.0), README mit Version, Quelle, Größe und Prüfsummen.
- **Lizenz des Netzes unklar:** Das Netz `nn-61e7af4bb97d` (Chris Bao) steckt in der `.wasm`-Datei. Das Paket nennt
  GPL-3.0 für Engine-Code und Paket, aber keine eigene Lizenz für das Netz. Auf der Info-Seite steht genau das,
  ohne weitere Behauptung. Offen: bei Bedarf beim Projekt nachfragen.
- `js/engine.js`: Web Worker mit UCI (uci, isready, setoption, position, go movetime/depth/nodes, bestmove, info mit
  Centipawn, Matt, MultiPV). Promises, eine Anfrage zur Zeit (Schlange), `stop`, `terminate`, Fehlermeldung
  "Der Computergegner ist auf diesem Gerät nicht verfügbar." statt Absturz. Lädt erst beim ersten Gebrauch.
- Optionen kommen aus der Engine: `UCI_Elo` 1320 bis 3190 (also weit über 440 Chess.com-Punkten; Stufen 1 bis 3 brauchen
  deshalb eine eigene Fehlerlogik), `Skill Level` 0 bis 20, `MultiPV` 1 bis 256, `Threads` nur 1, Hash 16 MB gesetzt.
- Service Worker: Cache-Version 3. Die Engine steht nicht in der Vorab-Liste, sondern wird beim ersten Gebrauch abgelegt
  (Netzwerk-zuerst-Zwischenspeicher); `.wasm` wird als `application/wasm` geprüft.
- Getestet: 12 Logik-Tests (`tests/unit/engine.test.mjs`, künstlicher Worker) und 14 Browser-Prüfungen mit der echten
  Engine (`tests/e2e/engine.cjs`): lädt nicht beim Start, legale Antwort, Matt in 1 gefunden, MultiPV 3, Abbruch in
  11 ms, Start nach 180 ms, offline nach dem ersten Gebrauch, verständliche Meldung bei fehlender Datei.

### Teil B: Stärkestufen, Logik fertig (Abschnitt 2), Oberfläche kommt mit Abschnitt 3

- `js/stufen.js` (Stufenversion 1, fest und eingefroren), `js/material.js` (ungedeckte Figuren, Materialsumme),
  `docs/STUFEN.md` mit Zuordnung, Begründung und Messung. Stufen 1 bis 3 mit eigener Fehlerlogik (Skill Level, Knotenzahl,
  MultiPV-Kandidaten, gewichteter Zufall, Matt-1-Chance), Stufen 4 bis 7 mit `UCI_Elo` 1320, 1500, 1800, 2200 (Bereich aus der
  Engine), Stufe 8 voll.
- Gemessen (`tests/e2e/stufen-staerke.cjs`, 168 Partien, echte Engine): jede Stufe schlägt ihren Vorgänger; Stufe 1 verliert
  22,9 Bauerneinheiten je Partie gegen 8,5 bei Stufe 8, übersieht Matt in 1 in 8 von 18 Fällen (Stufe 8: 0 von 48).
- **Bekannte Mängel:** Stufe 3 und 4 liegen eng beieinander (4 zu 8). Die Richtwerte ("ungefähr 650") sind Schätzungen, nicht
  gegen Menschen gemessen. `UCI_Elo` spielt bei kurzer Bedenkzeit schwächer als der Nennwert; Stufen 4 bis 7 übersehen
  manchmal Matt in 1 (Eigenart der Engine-Begrenzung). Stufen 4 bis 8 hängen von der Geräteleistung ab.
- Getestet: 13 Logik-Tests (`tests/unit/stufen.test.mjs`).

### Teil C: Spielen, Abschnitt 3 (Partie) fertig

- Reiter "Spielen" in der unteren Leiste, Startseite mit den drei Wegen (Partie, Grundmatts üben, Vorteil verwerten; die zwei
  letzten Wege sind in Abschnitt 4 dran). Dateien: `js/pages/spielen.js` (Oberfläche), `js/partie.js` (Spielzustand, Ende,
  Zurücknehmen, PGN), `js/warnung.js`, `js/empfehlung.js`, `js/uebungen.js`.
- Partie: Farbe (Weiß, Schwarz, Zufall), Stufe 1 bis 8 mit ungefährer Stärke und ehrlichem Hinweis, freiwillige Chess.com-Wertung
  (nur lokal, Vorschlag der Startstufe; bei 440 Stufe 2), "Zug zurücknehmen erlauben" (Standard aus, mit Erklärung),
  Schalter "Patzer-Warnung" (an für die ersten 3 begonnenen Partien, danach aus vorgeschlagen). Keine Uhr, keine
  Bewertungsleiste, keine Zugvorschläge. "Computer denkt" bei gesperrtem Brett (0,5 bis 2 Sekunden je Stufe), Aufgeben mit
  Rückfrage, Spielende durch chess.js (Matt, Patt, dreifache Wiederholung, 50 Züge, Material).
- Gespeichert wird nach jedem Zug (`spielen.aktiv`); nach Neuladen oder App-Wechsel geht es weiter, ein verpasster
  Computerzug wird nachgeholt. Speicherformat **Version 5** (seit Teil E aktuell Version 6) mit Migration (`spielen.partien` höchstens 30, `spielen.versuche`
  höchstens 100, `spielen.aktiv`, `spielen.gestartet`, `einstellungen.chesscomWertung`); Export und Import nehmen alles mit.
- Patzer-Warnung (`js/warnung.js`): genaue Prüfung mit chess.js (Matt in 1; Schlag einer Figur ab Springer, auf die man nicht
  zurückschlagen kann), bei freier Figur fragt die Engine 150 ms nach, ob der Gegner sie wirklich nähme. Frage mit "Ändern"
  und "Trotzdem", kein Hinweis auf den besseren Zug. Gezählt werden Warnungen und "Trotzdem"; beides wird je Partie gespeichert.
- Stufenempfehlung (`js/empfehlung.js`) erscheint in den Einstellungen, sobald es mindestens 3 Partien auf der letzten Stufe gibt.
- Getestet: `tests/e2e/spielen.cjs` (43 Prüfungen, echte Engine, 390 px, Touch), Unit-Tests für Partie, Warnung, Übungen, Speicher
  (Migration 4 auf 5, Obergrenzen, Export/Import); die alten Browsertests wurden auf Version 5 und drei Reiter angepasst.
- **Bekannte Mängel:** Läuft die Engine im Hintergrund nicht weiter (iPhone), erscheint "Erneut versuchen". (Die Liste "Meine Partien"
  und das Laden per PGN-Eingabe sind inzwischen fertig, siehe Teil D.)

### Teil C: Grundmatts und Vorteil verwerten, Abschnitt 4 fertig

- **Grundmatts üben** (`#/spielen/grundmatt`): je 10 feste Stellungen für König und Dame sowie König und Turm gegen König
  (`js/uebungen.js`). Ich spiele Weiß, der Computer verteidigt mit Stufe 8. Matt = Erfolg; Misserfolg bei Patt, dreifacher
  Wiederholung, 50-Züge-Regel, Aufgabe oder Verlust der Figur. Gespeichert wird je Versuch die Zahl meiner Züge bis zum Matt
  (`spielen.versuche`, `mattIn`). Die Referenz (Dame höchstens 10, Turm höchstens 16 Züge) steht ruhig auf der Seite. "Nächste
  Stellung" wählt die am wenigsten geübte.
- Die Stellungen wurden mit festem Zufallsstartwert erzeugt und mit der Engine nach der Länge des Matts gewählt (Dame Matt in 3
  bis 8, Turm in 5 bis 14; die Engine meldet eine obere Grenze). Alle Stellungen sind mit chess.js geprüft (Weiß am Zug, Schwarz
  nicht im Schach, nicht zu Ende, keine hängende Figur).
- **Vorteil verwerten** (`#/spielen/vorteil`): Grundstellung, der Computer startet ohne Dame, ohne Turm (a-Turm) oder ohne
  Springer (b-Springer); Farbe und Stufe wählbar, auch Zug zurück und Patzer-Warnung. Es zählt gewonnen, remis, verloren. Die
  Versuche liegen getrennt von den normalen Partien (`spielen.versuche` mit `modus: "vorteil"`); die Auswertung kommt in Teil G.
- Getestet: `tests/e2e/uebungen.cjs` (23 Prüfungen, echte Engine: ein Dame-Matt wird vom Test mit Engine-Zügen zu Ende gespielt,
  Patt, 50 Züge, dreifache Wiederholung, Aufgabe, Vorteil als Weiß und Schwarz, getrennte Zählung), Unit-Tests in `partie.test.mjs`.
- **Bekannte Grenze:** Gegen Menschen (Stufe 8) kann ein Matt länger dauern als die Referenz; die Referenz ist das Maximum bei
  bestem Spiel von beiden Seiten.

### Teil D: Partien speichern, Abschnitt 5 fertig

- Nach Spielende wird gespeichert: Datum, Modus, Farbe, Stufe und Stufenversion, Ergebnis, Grund, PGN, Startstellung, Patzer-Warnung
  an/aus samt Zahl der Warnungen und "Trotzdem", Zurücknahme erlaubt und wie oft genutzt. Es bleiben die letzten 30 Partien und die
  letzten 100 Übungsversuche (Grundmatts, Vorteil); die Obergrenze greift beim Speichern. Ein Stand mit 30 Partien und 100 Versuchen
  ist etwa 100 KB groß (Grenze des Browsers etwa 5 MB).
- `#/spielen/liste` "Meine Partien" (`js/pages/partien-liste.js`): neueste zuerst, Partien und Übungen getrennt, je Eintrag
  "Im Brett ansehen" und "PGN kopieren". Die Brett-Seite hat dafür `ladePgn(...)` und einen Bereich "Partie laden (PGN)" mit
  Fehlermeldung (wird später auch für Chess.com-Partien gebraucht).
- Export und Import nehmen alles mit (Partien, Versuche, laufende Partie, Wertung); die Import-Vorschau nennt Partien und Übungen.

### Teststand nach Teil A bis D (18.11.2026)

Logik-Tests 110 (alle bestanden), Python 31, Browsertests in den Dateien `engine` (14), `spielen` (43), `uebungen` (23),
`partien-liste` (20), `spielen-offline` (10), `tippflaechen-spielen` (16) und alle bisherigen (angepasst auf Version 5 und drei
Reiter). `tests/e2e/stufen-staerke.cjs` (Messung der Stufen, etwa 8 Minuten) gehört zu den langen Tests (`QUICK=1` überspringt ihn).

## Teil E bis H: Analyse, eigene Fehler als Rätsel, Fortschritt, Einführung (zweiter Pull Request, Pull Request 7)

### Abschnitt 6: Analyse (fertig, ohne Oberfläche)

- `js/analyse.js` (quellenunabhängig: PGN oder Züge plus Farbe des Spielers), `js/rueckblick.js` (Steuerung: speichert nach jeder
  Stellung, geht nach Neuladen weiter), `docs/ANALYSE.md` (Schwellen, Genauigkeit, Messung). Speicherformat **Version 6**
  (`spielen.analysen` höchstens 50, `spielen.analyseLauf`, `spielen.eigene` höchstens 300) mit Migration.
- Schwellen: Bewertung auf plus/minus 1000 Centipawn gedeckelt; Patzer ab 300 Verlust, Fehler 150 bis 299, verpasste Chance
  (Verlust ab 300, Stellung danach nicht schlechter als minus 150); Ungenauigkeiten unter 150 werden nicht angezeigt.
- Erklärungen in einfachem Deutsch (erlaubtes Matt, ungedeckte Figur, verpasstes Matt, sonst Bauerneinheiten und besserer Zug).
- **Messung der Dauer (Zusatz 1):** 81 Stellungen (40 Züge) bei 0,3 s je Stellung in 23,2 Sekunden in Chromium (287 ms je Stellung);
  bei 0,6 s 46 s. Geschätzt für ein durchschnittliches Handy 30 bis 40 Sekunden (Suchzeit ist fest, ein langsames Handy sucht
  nur weniger tief), also **unter 90 Sekunden: Die Suchzeit ist nicht einstellbar**, Standard 0,3 s. Auf dem echten Handy zu
  prüfen; zeigt sich dort mehr als 90 Sekunden, kommt "schnell/normal/genau" (0,15/0,3/0,6 s, Standard normal).
- Ehrlich: Patzer bleiben bei anderer Suchzeit gleich (1), die Zahl kleiner Fehler schwankt (2, 4, 6 bei 0,15, 0,3, 0,6 s).
- Getestet: 16 Logik-Tests Analyse, 4 Tests der Steuerung (Fortsetzen, Abbruch, Obergrenze), `tests/e2e/analyse.cjs` (13 Prüfungen,
  echte Engine: eingestellte Dame wird als Patzer gefunden, Fortsetzen nach Neuladen), `tests/e2e/analyse-dauer.cjs` (Messung).

### Abschnitt 7: Rückblick-Seite (fertig)

- `#/spielen/rueckblick/<id>` (`js/pages/rueckblick.js`, Router kennt jetzt Pfade mit Parameter): Fortschritt "Stellung 23 von 80"
  mit Balken, die Analyse läuft im Hintergrund und geht nach App-Wechsel oder Neuladen weiter (auch ohne die Seite offen zu haben:
  `rueckblick.fortsetzen()` beim App-Start und beim Zurückkehren in die App); bei einem Fehler "Erneut versuchen".
- Ergebnis: "1 Patzer, 3 Fehler, 0 verpasste Chancen", Liste der Stellen (Zug, Art, Erklärung). Antippen: Brett mit der Stellung vor dem
  Zug, rotem Pfeil (gespielter Zug) und grünem Pfeil (besserer Zug), Legende, Erklärung; "Nach meinem Zug" und "Vor dem Zug",
  vorige und nächste Stelle, "Als Rätsel üben".
- **Gleiches Brett und gleiche Designs (Zusatz 3):** Das Rückblick-Brett ist dasselbe Chessground-Brett in demselben Behälter
  (`board-wrap`, `board`) wie Brett, Taktik und Spielen, ohne eigene Farben; die Designs wirken über die Variablen der Seite. Test
  `rueckblick.cjs`: in allen drei Designs gleiche Feld- und Figurenfarben wie auf der Brett-Seite, gleiche Klassen, quadratisch.
- Nach einer Partie steht auf der Endseite der ruhige Hinweis "Rückblick ansehen (ca. 3 Minuten)"; in "Meine Partien" gibt es den
  Knopf "Rückblick". Nichts startet von selbst.
- **Fehler gefunden und behoben:** Wurde das Rückblick-Brett nach dem Verlassen der Seite erneut geöffnet, rechnete Chessground die
  Pfeile mit einer veralteten Brettgröße (ungültige Koordinaten). Das Brett wird jetzt bei jedem Öffnen der Stelle neu aufgebaut.
- Getestet: `tests/e2e/rueckblick.cjs` (27 Prüfungen, echte Engine).

### Abschnitt 8: Eigene Fehler als Rätsel (Teil F, fertig)

- `js/eigene.js`: Nach jeder fertigen Analyse werden Patzer und verpasste Chancen zu Rätseln (Stellung vor dem Zug als FEN `zugFen`,
  richtige Züge, kurze Hauptvariante bis 3 Halbzüge). Fehler (150 bis 299) werden auf Wunsch ("Als Rätsel üben") zum Rätsel.
- **Richtig** sind alle Züge, die höchstens 50 Centipawn schlechter sind als der beste (MultiPV 3). **Eindeutig** (sonst kein Rätsel):
  Der beste Zug außerhalb dieser Gruppe ist mindestens 150 Centipawn schlechter; sind alle drei Kandidaten gleich gut, ist unbekannt,
  ob andere Züge schlecht sind, und es gibt kein Rätsel. Folge: **Viele Patzer in der Eröffnung ergeben kein Rätsel**, weil dort viele
  Züge gleich gut sind (so im Beispiel mit der Dame im 3. Zug); Rätsel entstehen vor allem bei verpassten Gewinnen, Matt in 1 und
  freien Figuren. Der Rückblick sagt das bei "Als Rätsel üben" ruhig.
- Wiederholungssystem: Karte Stufe 1, fällig am nächsten Tag, danach 3, 7 und 21 Tage; nicht gelöst: zurück auf Stufe 1. Art
  "wiederholung": Die **Taktikstärke und der Rätselzähler ändern sich nie** (getestet).
- Sitzungen (`js/session.js`): bis zu 25 Prozent eigene Fehler (bei 10 Rätseln 2 bis 3), solange welche fällig sind; im Trainer steht
  "Eigener Fehler (Zug N)". In der Statistik ist "Eigener Fehler" ein eigenes Thema (zählt nicht zu den schwächsten Themen); das
  Thema lässt sich auf der Taktik-Seite auch als Filter wählen. Obergrenze 300 gespeicherte eigene Rätsel (die ältesten fallen samt
  Karte weg). Der Rätsel-Lauf akzeptiert bei diesen Rätseln jeden richtigen Zug (`richtig`).
- Getestet: 10 Logik-Tests `eigene.test.mjs`, `tests/e2e/eigene-raetsel.cjs` (21 Prüfungen: Rätsel entsteht, richtig und falsch im Trainer
  gelöst, Leitner 1/3, Stärke unverändert, 2 bis 3 von 10 in der Sitzung, Statistik, nicht eindeutig).

### Abschnitt 9: Fortschritt (Teil G, fertig)

- `#/spielen/fortschritt` (`js/pages/fortschritt.js`, Rechnung in `js/fortschritt.js`; Unterreiter neben "Spielen" und "Meine Partien"):
  Zahl der Partien, Ergebnisse je Stufe, Patzer pro Partie als einfaches Liniendiagramm (Mittel der letzten 5), durchschnittlicher
  Verlust pro Zug, Verteilung der Patzer auf Eröffnung (Zug 1 bis 10), Mittelspiel und Endspiel (höchstens 6 Figuren ohne Könige und
  Bauern), Verteilung der Fehlerarten (Figur eingestellt, Drohung übersehen, Chance verpasst, dazu "Sonstige Fehler"; ein erlaubtes
  Matt zählt als "Drohung übersehen"), Zahl der eigenen Rätsel und Lösungsquote.
- Alles erst ab **mindestens 5 Partien** (die Rückblick-Zahlen ab 5 Partien mit Rückblick), sonst "zu wenig Daten". Ehrliche Hinweise auf
  der Seite: Zufall in einzelnen Partien ist groß, aussagekräftig erst ab 10 oder mehr Partien, der Computer spielt anders als Menschen.
- **Nur gleiche Stufenversion (Zusatz 2):** Es zählen nur Partien (und Übungen) mit der aktuellen Stufenversion, das gilt auch für die
  Stufenempfehlung und die Übungszahlen. Frühere Versionen stehen getrennt im Block "Frühere Stufenversionen" und werden nicht
  eingerechnet (getestet mit Version 0 und 1).
- **Patzer-Warnung getrennt:** Auswahl "Partien ohne Patzer-Warnung" (Standard) und "Partien mit Patzer-Warnung"; beide werden
  nie vermischt.
- Stufenempfehlung als ruhiger Satz (3 von 5 gewonnen: eine Stufe höher; 4 von 5 verloren: eine tiefer; sonst bleiben). Grundmatts:
  Mittel der Züge bis zum Matt der letzten 5 Versuche und Quote der erfolgreichen, je Figur, mit Referenz. Vorteil verwerten: Quote
  gewonnen, gesamt und je Vorteil.
- Getestet: 9 Logik-Tests `fortschritt.test.mjs`, `tests/e2e/fortschritt.cjs` (25 Prüfungen: leer, Beispieldaten mit 8 Partien, zwei
  Stufenversionen, Gruppe mit Warnung, Überlauf, Tippflächen).

### Abschnitt 10: Einführung und Startseite (Teil H, fertig)

- Einführung hat jetzt **8 Seiten**: Seite 1 nennt auch "Spielen", Seite 6 sagt ehrlich, dass die App Partien gegen Menschen mit langer
  Bedenkzeit nicht ersetzt, neu ist Seite 8 "Wie Partien dir helfen": zwei bis drei ganze Partien pro Woche ohne Zug zurücknehmen, jede
  mit Rückblick, die Rätsel mit eigenen Fehlern in der täglichen Sitzung, Grundmatts üben, bis sie in unter 20 Zügen sitzen, und der
  Vier-Fragen-Check vor jedem Zug (die vier Fragen stehen auch auf Seite 7).
- Startseite "Spielen": ein kleiner Hinweis mit "Offene Rückblicke: N" (Partien und Vorteil-Übungen ohne fertigen Rückblick, nicht
  Grundmatts; bei genau einem öffnet der Knopf ihn direkt, sonst "Meine Partien") und "Fällige eigene Rätsel: N" (Knopf "Üben" startet
  eine Sitzung nur mit diesen Rätseln, auch ohne Einstufung). Bei 0 sind die Knöpfe gesperrt, kein Effekt, keine Zahl-Blase.
- Getestet: `tests/e2e/spielen-hinweise.cjs` (12 Prüfungen), `tests/e2e/einfuehrung.cjs` (46 Prüfungen, auf 8 Seiten angepasst).

### Teststand nach Teil E bis H (19.11.2026)

Vollständiger Lauf von `tests/run-all.sh` (mit den langen Tests, etwa 40 Minuten): **151 Logik-Tests, 31 Python-Tests und 575
Browser-Prüfungen in 30 Dateien, alle bestanden.** Neu in Teil E bis H: `analyse` (13, echte Engine), `rueckblick` (27),
`eigene-raetsel` (21), `fortschritt` (25), `spielen-hinweise` (12), `analyse-dauer` (Messung, 2), Logik-Tests `analyse`, `rueckblick`,
`eigene`, `fortschritt`; angepasst wurden `einfuehrung` (8 Seiten), `daten`, `pruefsets`, `storage` (Speicherformat 6) und `denkhilfe`
(Wartezeit im Test: Der Seitenwechsel kam nach dem Klick erst im nächsten Schritt).
Die Messungen `stufen-staerke.cjs` (etwa 8 Minuten) und `analyse-dauer.cjs` (etwa 3 Minuten) gehören zu den langen Tests.

## Oberfläche vereinfachen (Pull Request 8, in Arbeit, keine neuen Funktionen)

Ziel: weniger Orte, weniger Auswahl vor dem Start, keine doppelten Wege. Daten und Logik bleiben; einzige Datenänderung: drei neue
Standardwerte in den Einstellungen (Speicherformat Version 7, nur zusätzliche Felder). Plan und Skizzen standen im Chat; die Regeln für
die Startseite stehen in `docs/HEUTE.md`.

### Abschnitt 1: Ausgangsmessung (fertig)

- `tests/e2e/seiten-messen.cjs vorher|nachher` misst alle Hauptseiten bei 390 x 844 und schreibt Screenshots nach
  `tests/screenshots/vorher/` beziehungsweise `nachher/` (mit `messung.json`). Es ist ein Werkzeug, kein Test.
- Ausgangswerte (mit Beispieldaten): Themen 8143 px (9,7 Bildschirme), Statistik 2111 px (2,5), Fortschritt 2110 px (2,5), Meine
  Partien 1916 px (2,3), Info 1820 px (2,2), Partie-Einstellungen 1250 px (1,5); alle anderen höchstens 1,5. Tipps bis zum Start:
  Rätsel-Sitzung 2, Partie 3. Kein Seitenüberlauf.

### Abschnitt 2: Gerüst (fertig)

- Kopfzeile: links der Zurück-Pfeil (nur auf Unterseiten, führt zur Eltern-Route), in der Mitte der Seitenname (ersetzt die doppelten
  Seitentitel), rechts das Zahnrad "Einstellungen" (einfaches Strichsymbol, kein Emoji). Untere Leiste mit vier Orten: Heute, Taktik,
  Spielen, Fortschritt. Alle Unterreiter und Textlinks "Zurück" sind entfernt. Startseite ist `#/heute`, unbekannte Adressen zeigen sie.
- Router (`js/router.js`): Routen haben `parent`, Weiterleitungen mit `addRedirect`. Schon umgeleitet: `#/brett` nach
  `#/einstellungen/brett`, `#/taktik/statistik` nach `#/fortschritt`, `#/mehr` nach `#/einstellungen`, `#/mehr/daten` nach
  `#/einstellungen/daten`, `#/mehr/info` nach `#/einstellungen/info`.
- **Vorläufig** (bis zu den Abschnitten 3, 4, 7): `#/einstellungen` zeigt (seit Abschnitt 3) die neue Seite,
  `#/fortschritt` zeigt noch die alte Statistik, "Meine Partien" und die Partien-Zahlen sind über zwei Links auf der Spielen-Seite
  erreichbar.
- Das freie Brett wird versteckt aufgebaut und beim Öffnen neu gemessen (`onShowBrett`).
- **Anpassungen an alten Tests** (nur Wege und Beschriftungen, keine Logik): `brett`, `design`, `taktik-session` (Wechsel zum freien Brett
  über die Adresse statt Reiter "Brett"), `design` und `einfuehrung` und `navigation` (Zahnrad `#link-einstellungen` statt "Mehr"),
  `navigation` (Leiste Heute/Taktik/Spielen/Fortschritt, Info-Link, Zurück-Pfeil, unbekannte Adresse zeigt Heute), `denkhilfe`
  (Zurück-Pfeil), `pwa` (Offline-Prüfung öffnet das freie Brett über die Adresse), `fortschritt` (Reiter und Unterreiter-Prüfungen durch
  Prüfung des Reiters Fortschritt und des Pfeils ersetzt, Neuladen statt gleicher Adresse), `themen` (Link "Themen-Übersicht" statt
  Unterreiter). Neu: `weiterleitungen.cjs` (19 Prüfungen).

### Abschnitt 3: Einstellungen und Speicherformat Version 7 (fertig)

- Eine Seite `#/einstellungen` (Zahnrad) mit drei Abschnitten: **Darstellung** (Brett-Design), **Training** (Denkhilfe, Zug zurücknehmen,
  Patzer-Warnung, Chess.com-Wertung, Prüfset der Standortbestimmung; längere Erklärungen hinter einem kleinen "Info") und **Weiteres**
  (Daten sichern und wiederherstellen, Einführung ansehen, Freies Brett, Info und Lizenzen). Daten, Freies Brett und Info sind Unterseiten
  mit Zurück-Pfeil, damit die Einstellungen nicht länger als zwei Bildschirme werden. `#/mehr/einstellungen` und `#/mehr/darstellung`
  führen hierher. Die Chess.com-Wertung gibt es nur hier (in den Partie-Einstellungen steht sie noch bis Abschnitt 6).
- **Speicherformat Version 7** (einzige Datenänderung, nur zusätzliche Felder): `einstellungen.zuruecknahme` (aus), `einstellungen.patzerWarnung`
  (null = automatisch: an für die ersten 3 Partien, danach aus; sonst ausdrücklich an oder aus) und `einstellungen.pruefset` (null =
  automatisch nach Taktikstärke). Die Migration setzt genau das bisherige Verhalten. `js/standards.js` liefert die wirksamen Standardwerte.
  Beim Start einer Partie gelten die Standardwerte und lassen sich für diese eine Partie ändern. Das Prüfset wird in Abschnitt 7 an die
  Standortbestimmung angeschlossen.
- **Anpassungen an alten Tests:** `denkhilfe` (Schalter heißt jetzt "an"/"aus" statt "Denkhilfe: an"/"aus", die Einstellungen sind ein
  Hauptort ohne Zurück-Pfeil), `design` (die Design-Karten stehen direkt auf der Einstellungsseite), `navigation` (Einstellungen über das
  Zahnrad), `daten`, `pruefsets`, `storage` (Version 7), Unit-Test `storage` (neue Felder in den Standardwerten). Neu: `einstellungen.cjs`
  (21 Prüfungen), Unit-Tests `standards` (4) und Migration 6 auf 7 (3).

### Abschnitt 4: Heute (fertig)

- Startseite `#/heute` (`js/pages/heute.js`, Regeln in `js/heute.js`, dokumentiert in `docs/HEUTE.md`): ein gefüllter Hauptknopf, eine kurze
  Begründung, höchstens zwei ruhige Nebenzeilen. Reihenfolge: (a) Einstufung starten, (b) Sitzung starten (N fällig), (c) Rückblick ansehen,
  (d) Partie spielen (letzte Partie 3 Tage oder länger her, oder keine), (e) Standortbestimmung (4 Wochen), (f) Sitzung starten. Davor
  (Fall 0, Ergänzung): Läuft eine Sitzung, Einstufung, Standortbestimmung oder Partie, ist "Fortsetzen" der Hauptknopf.
- Der Knopf startet direkt: Einstufung und Sitzung beginnen mit einem Tipp, der Rückblick öffnet den neuesten offenen, die
  Standortbestimmung startet das Prüfset aus den Einstellungen. Fall e wird von Fall d verdeckt, solange die letzte Partie 3 Tage oder
  länger zurückliegt (so ist die Reihenfolge gewünscht); die Erinnerung bleibt dann als Nebenzeile stehen.
- Getestet: 14 Logik-Tests `heute.test.mjs` (jeder Fall, Reihenfolge, Nebenzeilen, keine Gamification-Wörter) und `tests/e2e/heute.cjs`
  (28 Prüfungen: jeder Fall a bis f und Fortsetzen mit dem, was der Knopf startet, Layout, keine Emojis).

### Abschnitt 5: Taktik und Themen (fertig)

- Taktik: oben die Taktikstärke (eine Zeile) und der Hauptknopf "Sitzung starten" (vor der Einstufung "Einstufung starten", läuft etwas
  "Fortsetzen"). Sitzungslänge, Themenfilter, Themen-Übersicht und "Einstufung wiederholen" liegen eingeklappt unter "Mehr Optionen"; die
  Erklärung der Wiederholungen steht hinter einem kleinen "Info". Der Satz zur letzten Standortbestimmung ist von hier entfallen (gehört zu
  Fortschritt).
- Themen (`#/taktik/themen`): die zehn Einsteiger-Themen kompakt (Name, Knopf "Üben", ein Satz), alle anderen eingeklappt unter "Alle anderen
  Themen anzeigen". Höhe vorher 8143 px (9,7 Bildschirme), jetzt 1647 px (2,0 Bildschirme) mit eingeklappter Liste.
- **Anpassungen an alten Tests:** `denkhilfe`, `taktik-offline`, `taktik-session`, `taktik` (die Auswahl "Rätsel pro Sitzung" und
  "Einstufung wiederholen" liegen jetzt in "Mehr Optionen" und werden vor dem Antippen aufgeklappt), `leer` (kurzer Satz "Noch keine
  Wiederholungen." statt des langen, die Erklärung steht hinter "Info"), `themen` (Knopf heißt "Üben", Link zur Themen-Übersicht liegt in
  "Mehr Optionen" und erscheint erst nach der Einstufung, Tippflächen nur für sichtbare Elemente).

### Abschnitt 6: Spielen, Grundmatts, Vorteil (fertig)

- Spielen (`#/spielen`) ist jetzt die Partie-Startseite: Farbe (Weiß, Schwarz, Zufall; vorausgewählt Zufall) und Stufe (1 bis 8, die empfohlene
  Stufe vorausgewählt und als "empfohlen" markiert) als **große Schalter** statt Auswahlfeldern, ein Hauptknopf "Partie starten", darunter
  "Mehr Optionen" (Zug zurücknehmen und Patzer-Warnung für diese eine Partie; Standard aus den Einstellungen), "Info zu den Stufen" (ehrlicher
  Hinweis, Anpassen nach zwei bis drei Partien) und zwei kleine Karten "Grundmatts üben" und "Vorteil verwerten". Läuft eine Partie, ist
  "Partie fortsetzen" der einzige Hauptknopf (die Auswahl ist ausgeblendet, damit eine laufende Partie nicht versehentlich überschrieben wird).
  Das Feld Chess.com-Wertung ist hier entfallen (nur in den Einstellungen; sie bestimmt weiter die vorgeschlagene Startstufe). Der Hinweisblock
  "Offene Rückblicke / Fällige eigene Rätsel" ist entfallen (steht auf Heute und in Fortschritt). `#/spielen/partie` führt auf `#/spielen`.
- Vorteil verwerten und Grundmatts: ebenfalls große Schalter (Vorteil, Farbe, Stufe beziehungsweise Figur), Hauptknopf "Übung starten",
  Zusatzoptionen (Stellung, Zurücknehmen, Warnung) eingeklappt, lange Erklärungen hinter "Info". Neues gemeinsames Bauteil `js/ui/auswahl.js`.
- **Anpassungen an alten Tests:** `spielen` (Schalter statt Auswahlfelder, ein Hauptknopf, Wertung nur in den Einstellungen, laufende Partie zeigt
  "Partie fortsetzen", Optionen werden vor dem Antippen aufgeklappt), `uebungen`, `rueckblick`, `spielen-offline`, `einstellungen`,
  `tippflaechen-spielen` (gleiche Gründe), `lib.cjs` (neue Hilfsfunktion `waehle`), `heute` (längere Wartezeit beim Laden der Rätselbänder).
  **Entfallen:** `spielen-hinweise.cjs` (der Hinweisblock ist weg; die Fälle prüft `heute.cjs`).

## Phase 3 — Eigene Partien analysieren (Chess.com)

Die **Analyse eigener Partien ist fertig** (Teil E bis G, siehe oben; sie nimmt PGN und Farbe des Spielers und ist nicht an die
Quelle gebunden). Es fehlt noch das **Holen der Partien von Chess.com** (Benutzername, öffentliche Schnittstelle) und die
Anzeige dieser Partien; danach laufen Rückblick und eigene Rätsel unverändert. Siehe "Nächste Schritte".

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.

## Auf dem echten Handy prüfen (bisher nur emuliert)

Computergegner (Teil A bis D):
- **Bedenkzeit:** Wie lange dauert der erste Computerzug nach dem Öffnen (Engine laden, etwa 1,8 MB)? Fühlen sich 0,5 bis 2
  Sekunden je Stufe richtig an, oder ist "Computer denkt" zu lang oder zu kurz? Auf einem langsamen Handy spielen die Stufen 4 bis 8
  schwächer (feste Zeiten), die Stufen 1 bis 3 nicht (feste Knotenzahl).
- **Passt die Stufe?** Auf welcher Stufe fühlt sich eine Partie fair an (Richtwert für 440 Punkte: Stufe 2)? Ist Stufe 1 zu leicht?
  Hängt Stufe 1 bis 3 "glaubhaft" Figuren ein, oder wirken die Züge zufällig?
- **Wärme und Akku:** Wird das Handy bei einer ganzen Partie (etwa 40 Züge) warm? Wie viel Akku kostet eine Partie?
- **App-Wechsel auf dem iPhone:** Partie anfangen, in eine andere App wechseln (kurz und mehrere Minuten), zurückkehren: Geht es
  weiter? Wird ein verpasster Computerzug nachgeholt, oder erscheint "Erneut versuchen"? Nach Neuladen im Safari-Tab dasselbe.
- **Flugmodus:** Erst online eine Partie beginnen (Engine wird abgelegt), dann Flugmodus und weiterspielen.
- Brett: Ziehen und Tippen auf dem Spielen-Brett (auch während "Computer denkt" soll nichts passieren), Umwandlung, Schach.
- **Patzer-Warnung:** Erscheint sie nur, wenn wirklich etwas hängt? Stört sie? Ist die Frage verständlich?
- Grundmatts: Sind die Stellungen verständlich, sind einige zu leicht oder zu schwer?
- PGN kopieren auf dem iPhone (Zwischenablage) und PGN einfügen auf der Brett-Seite.

Analyse, Rückblick, eigene Rätsel, Fortschritt (Teil E bis H):
- **Analysedauer:** Wie lange braucht der Rückblick einer Partie mit etwa 40 Zügen (80 Stellungen) auf dem Handy? Erwartet sind 30 bis 40
  Sekunden (Chromium am PC: 23 Sekunden); die Grenze ist 90 Sekunden. Zeigt es sich länger, wird die Suchzeit einstellbar
  (schnell 0,15 s, normal 0,3 s, genau 0,6 s, Standard normal). Wird das Handy dabei warm, was kostet es an Akku?
- **App-Wechsel mitten in der Analyse (iPhone):** In eine andere App wechseln und zurückkehren, danach Safari-Tab neu laden: Geht es bei
  "Stellung N von 80" weiter, oder erscheint "Erneut versuchen"?
- **Rückblick-Brett:** Sind der rote und der grüne Pfeil gut zu unterscheiden (draußen, in allen drei Designs)? Ist die Legende klar?
  Sind die Erklärungen verständlich ("Die Dame auf e5 war danach ungedeckt ...")? Stimmen die gefundenen Patzer mit deinem Gefühl überein,
  werden zu viele oder zu wenige "Fehler" angezeigt (kleine Fehler schwanken je nach Suchzeit)?
- **Eigene Rätsel:** Entstehen genug Rätsel aus deinen Partien (viele Eröffnungsfehler ergeben keins, weil dort viele Züge gleich gut
  sind)? Fühlt sich der Anteil von 2 bis 3 eigenen Fehlern in einer Sitzung richtig an? Ist "Eigener Fehler (Zug N)" verständlich?
- **Fortschritt:** Sind die Zahlen verständlich und ruhig, oder verwirrt etwas (Auswahl "mit/ohne Patzer-Warnung", "Frühere
  Stufenversionen")? Passt der Satz zur Stufenempfehlung?
- **Startseite Spielen:** Sind "Offene Rückblicke" und "Fällige eigene Rätsel" hilfreich oder aufdringlich?
- **Einführung:** Ist die neue Seite 8 "Wie Partien dir helfen" verständlich, passt der empfohlene Wochenablauf?

Allgemein und Taktik:
- "Zum Home-Bildschirm" auf iPhone (Safari: Teilen) und Android (Chrome: App installieren);
  Icon, Name und Start im Vollbild.
- Pinch-Zoom geht; Ziehen einer Figur scrollt die Seite nicht (iOS-Safari und Android-Chrome).
- Untere Leiste sitzt über dem iPhone-Rand und verdeckt nichts.
- Export: iPhone-Safari lädt Dateien anders; "Datei teilen" nutzen, falls der Download nicht
  klappt. Import mit einer Datei aus "Dateien". "Dauerhafter Speicher" auf der Daten-Seite.
- Rätsel mit dem Finger lösen (Tippgenauigkeit, Umwandlung), auch nach "Schach.".
- Standortbestimmung am Stück (15 bis 25 Minuten): Bildschirm bleibt an, Fortsetzen nach
  Wechsel in eine andere App.
- Flugmodus: erst online eine Sitzung starten, dann offline weiterüben.
- Taktik für Einsteiger: siehe den Abschnitt "Taktik für Einsteiger" (machbare Rätsel ab 450, Einstufung, Denkhilfe, Themen-Erklärungen).
- Diagramm in der Statistik lesbar; Erinnerung nach 4 Wochen wirkt ruhig genug.

Brett-Designs und Einführung (Pull Request 4, gemergt):
- Lesbarkeit der Figuren **draußen bei Sonnenlicht** und bei niedriger Helligkeit, in allen drei
  Designs. Besonders: schwarze Dame und Turm, weiße Figuren auf hellen Feldern (Klassisch, Grün),
  schwarze Figuren auf dunklen Feldern (Dunkel). Welches Design nimmst du am liebsten?
- Wirkt "Klassisch" (hell) auf dem Handy neben der dunklen Oberfläche zu hell?
- Koordinaten (kleine Buchstaben und Zahlen am Brettrand) lesbar.
- Markierungen (Zielpunkte, letzter Zug, Schach) gut zu sehen, auch beim Ziehen mit dem Finger.
- Die Karten unter Mehr > Darstellung lassen sich sicher antippen; die kleinen Vorschauen sind
  verständlich.
- **Wischen in der Einführung** (iOS-Safari und Android-Chrome): rastet die Seite sauber ein,
  funktioniert "Weiter" und "Überspringen" mit dem Daumen, sind die Texte gut lesbar.
