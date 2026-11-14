# Status

Diese Datei wird zu Beginn jeder Sitzung zuerst gelesen und nach jedem
Abschnitt aktualisiert. Stand: 14.11.2026.

## Nächste Schritte

1. **Auf dem echten Handy prüfen** (Liste ganz unten). Das ist die einzige offene Aufgabe
   aus den fertigen Phasen.
2. **Computergegner auf dem Brett:** gegen den Computer spielen, Stärke wählbar. Idee: eine
   Schach-Engine als WebAssembly (zum Beispiel Stockfish, GPL-3 passt zur Lizenz), sie läuft
   komplett im Browser, ohne Server. Vorher klären: Größe der Datei (einige MB) und
   Offline-Cache, Stärkestufen, Bedenkzeit.
3. **Phase 3, eigene Partien analysieren mit Chess.com:** Partien nach Benutzername holen
   (öffentliche, nur lesende Chess.com-Schnittstelle ohne Konto; alternativ eine PGN-Datei
   importieren), mit der Engine analysieren, Fehler als Rätsel in die Wiederholung übernehmen.
   Vorher klären: Der Benutzername verlässt das Gerät nur für die Abfrage; wie viele Partien
   werden gespeichert (Speichergrenze etwa 5 MB).
4. Danach Phase 4 (Eröffnung und Endspiel) und Phase 5 (Tagesplan).

## Stand auf einen Blick

| Teil | Stand |
| --- | --- |
| Phase 1: Brett | fertig, gemergt, emuliert getestet |
| Vorarbeiten: Mängel, Speichern, installierbar, Rätsel-Daten | fertig, gemergt |
| Phase 2: Taktik-Training mit Statistik und Standortbestimmung | fertig, gemergt (Rätsel-Daten und Prüfset liegen auf `main`) |
| Brett-Designs, Einführung, leere Zustände | fertig, Pull Request 4 (offen), emuliert getestet |
| Phase 3 bis 5 | nicht begonnen |

Alle Tests: `tests/run-all.sh` (Logik, Python, Browser mit 390 px und Touch-Emulation;
`QUICK=1` überspringt die langen Sitzungstests, sonst etwa 15 Minuten).

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
- Hash-Router (`#/brett`, `#/taktik`, `#/taktik/statistik`, `#/mehr/...`), feste untere Leiste
  (Brett, Taktik), Knopf "Mehr" oben rechts, Info-Seite mit Namensnennung Cburnett (CC BY-SA 3.0)
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

## Brett-Designs, Einführung, leere Zustände (Pull Request 4)

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

## Phase 3 — Eigene Partien analysieren

Noch nicht begonnen (siehe "Nächste Schritte").

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.

## Auf dem echten Handy prüfen (bisher nur emuliert)

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
- Diagramm in der Statistik lesbar; Erinnerung nach 4 Wochen wirkt ruhig genug.

Brett-Designs und Einführung (Pull Request 4):
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
