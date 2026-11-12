# Status

Diese Datei wird zu Beginn jeder Sitzung zuerst gelesen und nach jedem
Abschnitt aktualisiert.

## Phase 1 — Ein Brett, auf dem ich beide Seiten spielen kann

**Fertig:**
- Grundlagen angelegt: CLAUDE.md, LICENSE (GPL-3.0), diese Datei.
- chess.js 1.4.0 und chessground 9.2.1 vendort (vendor/), Cburnett-
  Figurenset (CC-BY-SA-3.0).
- Grundgerüst: index.html, dunkles Brett-Theme, Chessground zeigt die
  Startstellung bei 390 px Breite an.
- Zugausführung: Tippen-Tippen und Ziehen, erlaubte Züge markieren,
  Schach hervorheben, letzten Zug markieren, Umwandlungsauswahl,
  Rochade, en passant. Seite scrollt beim Ziehen nicht.
- Steuerung: Zug zurück/vor (auch per Klick in der Zugliste), Brett
  drehen, Neustart, FEN laden (mit Fehlermeldung) und ausgeben
  (mit Kopieren-Knopf).
- Spielende-Erkennung: Matt, Patt, dreifache Stellungswiederholung,
  50-Züge-Regel, zu wenig Material — jeweils mit klarem Hinweistext.

**Getestet:** Browsertests mit Touch-Emulation bei 390 px Breite
(Playwright, iPhone-Profil) für: Rochade kurz und lang, en passant,
Bauernumwandlung (Auswahl + Ergebnis), Narrenmatt, eine Patt-Stellung,
Zug zurück/vor, Brett drehen, FEN laden (gültig und ungültig). Alle
Szenarien liefern die erwartete Stellung bzw. Meldung.

**Offen:**
- Keine bekannten offenen Punkte für Phase 1.

**Bekannte Mängel:**
- Kontrast schwarzer Figuren auf dunklen Feldern ist bewusst dezent
  gehalten (ruhiger Stil); bei Bedarf später die Feldfarben aufhellen.
- Zugliste zeigt noch keine Nebenlinien/Varianten, nur die gespielte
  Hauptlinie (reicht für Phase 1).

## Vorarbeiten für Phase 2 (Mängel, Speichern, Installierbarkeit, Rätsel-Daten)

Stand: erledigt und gemergt (Pull Request 2). Die Rätsel-Daten wurden mit dem Workflow erzeugt.

**Fertig:**
- Seitenüberlauf behoben: Seite ist bei 390 px genau 390 px breit (Ursache war
  die Buchstabenzeile unter dem Brett, die Chessground um 24 px versetzt).
- Zoom wieder erlaubt (kein `user-scalable=no`, kein `maximum-scale`);
  Doppeltipp-Zoom auf dem Brett per `touch-action: manipulation` verhindert.
- Browsertests liegen jetzt im Repository unter `tests/e2e/` (Playwright,
  Start mit `node tests/e2e/<datei>.cjs`).
- App-Hülle: Hash-Router (`#/brett`, `#/taktik`, `#/mehr`, `#/mehr/info`), feste untere
  Leiste mit "Brett" und "Taktik" (56 px hoch, berücksichtigt den iPhone-Rand), Knopf
  "Mehr" oben rechts. Der Brett-Code liegt unverändert in `js/pages/brett.js`; die
  Partie bleibt beim Seitenwechsel erhalten. Die Taktik-Seite ist noch ein Platzhalter.
- Info-Seite mit Namensnennung Cburnett (CC BY-SA 3.0), Lizenzen von chess.js,
  Chessground und Lichess-Rätseln; die Lizenztexte werden aus den Dateien im
  Repository geladen.
- Zentrale Speicherung `js/storage.js`: alle Daten unter einem Schlüssel
  (`schach-training`) mit Versionsnummer, Migrationsfunktion (Kette von Version zu
  Version), Begrenzung der Protokolle, Schutz vor unlesbaren Ständen (Kopie unter
  `schach-training.defekt`), Meldung statt Absturz bei vollem oder gesperrtem Speicher.
  `navigator.storage.persist()` wird bei jedem Start angefragt.
- Seite "Mehr > Daten": Daten exportieren (JSON-Datei), importieren (mit Vorschau und
  Rückfrage, bestehende Daten werden ersetzt), alle Daten löschen (mit Rückfrage),
  Anzeige von Adresse, Speicherschutz und letztem Export, Hinweis "immer denselben
  Link benutzen". Wo der Browser es kann, gibt es zusätzlich "Datei teilen".
- Hinweisleiste oben: Erinnerung, wenn seit 14 Tagen kein Export war (nur wenn es
  überhaupt Daten zu sichern gibt; "Später" blendet sie bis zum nächsten Start aus);
  Warnung, wenn der Browser das Speichern nicht erlaubt.

- Installierbar ("Zum Home-Bildschirm"): `manifest.webmanifest`, schlichte Icons ohne
  Emojis (Bauer auf dunklem Grund; erzeugt mit `tools/make_icons.py`), `sw.js` mit
  Netzwerk-zuerst (online immer die neueste Version, Cache nur als Rückfall offline),
  Cache-Name mit Versionsnummer, alte Caches werden beim Aktivieren gelöscht, das
  Grundgerüst wird vorab zwischengespeichert.

- Rätsel-Daten vorbereitet: `tools/build_puzzles.py` (nur Python-Standardbibliothek) liest
  die entpackte Lichess-CSV (Datei oder Standardeingabe), filtert (Popularity >= 90,
  NbPlays >= 500, RatingDeviation <= 100) und schreibt `data/puzzles/band-600.json` bis
  `band-2700.json` (je bis zu 1000 Rätsel, gleichmäßig über die Themen, 2700 ist offen nach
  oben), `index.json` und `LICENSE.md` (CC0, Quelle, Datum). Größe wird auf 5 MB
  begrenzt (verkleinert sich selbst). Der erste Zug in `zuege` ist der Gegnerzug.
- Der direkte Download der Lichess-Datei war in dieser Umgebung gesperrt (Netzwerk
  antwortet 403). Deshalb baut `.github/workflows/build-puzzles.yml` die Daten auf dem
  GitHub-Server (manuell startbar, `contents: write`, committet in den gewählten Branch).
  **Die echten Rätsel-Daten sind noch nicht im Repository**, sie entstehen erst durch den
  ersten Workflow-Lauf.

**Getestet (emuliert):** alle Tests starten mit `tests/run-all.sh`. `tests/e2e/overflow.cjs` (scrollWidth gleich Fensterbreite),
`tests/e2e/zoom-drag.cjs` (Viewport ohne Sperre, Ziehen scrollt die Seite nicht,
Wischen außerhalb des Bretts scrollt weiterhin), `tests/e2e/brett.cjs` (alle
Phase-1-Szenarien als Regressionstest, 19 Prüfungen), `tests/e2e/navigation.cjs`
(Leiste, Seitenwechsel, Info-Seite, alle Tippflächen mindestens 44 px, Leiste verdeckt
nichts), `tests/unit/storage.test.mjs` (11 Logik-Tests mit `node --test "tests/unit/*.test.mjs"`:
Migration, Export/Import, Fehlerfälle, Begrenzung, 14-Tage-Erinnerung),
`tests/e2e/storage.cjs` (ein Schlüssel mit Version, persist() beim Start, Neuladen),
`tests/e2e/daten.cjs` (Export, Löschen, Import ergibt denselben Stand; fehlerhafte
Dateien; Erinnerung mit verschobener Uhr nach 15 Tagen), `tests/e2e/pwa.cjs`
(Manifest, Icons, Service Worker aktiv, Chromium-Installierbarkeitsprüfung, Netzwerk
zuerst, App lädt offline, neue Cache-Version räumt auf), `tests/unit/sw.test.mjs`
(Vorab-Liste vollständig), `tests/python/test_build_puzzles.py` (12 Tests mit künstlicher
CSV: Filter und Grenzwerte, Bänder, höchstens 1000 je Band, Größe, Themenverteilung,
gleiche Eingabe gleiches Ergebnis, Standardeingabe, Fehlerfälle). Die Shell-Abfolge des
Workflows wurde lokal mit einer künstlichen CSV nachgestellt (Bauen, Zusammenfassung,
Commit, Fehlercode bei kaputter Eingabe). Der echte Lauf auf GitHub ist noch nicht erfolgt.

**Echter Workflow-Lauf (12.11.2026):** erfolgreich. 6.193.530 Zeilen gelesen, 2.188.703
bestanden die Filter, 22 Bänder mit je 1000 Rätseln, 49 Themen, 3,18 MB. Das Dateiformat
der Lichess-Datei passte zum Skript.

**Prüfset (Zusatz zur Standortbestimmung):** `tools/build_puzzles.py` wählt zusätzlich 20 feste
Rätsel (Wertung 850 bis 2050, 20 verschiedene Hauptthemen von leicht nach schwer) und legt
sie in `data/puzzles/pruefset.json` ab. Sie fehlen in den Bandateien (nicht mehr im normalen
Training). Ein vorhandenes `pruefset.json` wird bei jedem Neubau unverändert übernommen, damit
Ergebnisse vergleichbar bleiben (neu erzeugen nur mit `--pruefset-neu`). Das Prüfset ist noch
**nicht** im Repository: dafür muss der Workflow einmal neu laufen.

**Offen:** nichts aus diesem Teil; das Prüfset und der Taktik-Trainer stehen unter Phase 2.

**Nur emuliert, bitte auf dem echten Handy prüfen (Vorarbeiten):**
- "Zum Home-Bildschirm" auf iPhone (Safari: Teilen, dann "Zum Home-Bildschirm") und auf
  Android (Chrome: Menü, "App installieren"); Icon, Name und Start im Vollbild.
- Pinch-Zoom auf der Seite geht; auf dem Brett verhindert Doppeltippen das Zoomen nicht
  ungewollt Züge. Ziehen einer Figur scrollt die Seite nicht (in iOS-Safari besonders prüfen).
- Untere Leiste sitzt über dem iPhone-Rand (Home-Balken) und verdeckt nichts.
- Export per "Daten exportieren": iPhone-Safari öffnet oder lädt die Datei anders als
  Desktop-Browser; "Datei teilen" nutzen, falls der Download nicht klappt. Import mit
  einer Datei aus "Dateien" testen.
- "Dauerhafter Speicher" (Daten-Seite): ob der Browser den Schutz gewährt.
- App im Flugmodus starten (nach einmaligem Besuch online).

**Nur emuliert, bitte auf dem echten Handy prüfen (Taktik, Pull Request 3):**
- Rätsel mit dem Finger lösen: Tippen-Tippen und Ziehen auf dem Taktik-Brett, auch kleine
  Felder (Treffgenauigkeit), Umwandlung per Auswahlfenster.
- Nach "Schach." oder anderen Hinweisen über dem Brett: der nächste Tipp trifft das richtige Feld.
- Die Seite scrollt beim Ziehen einer Figur nicht (iOS-Safari und Android-Chrome).
- Brett und Texte bei Zoom und bei gedrehtem Gerät (Hochformat ist das Ziel).
- Standortbestimmung am Stück (15 bis 25 Minuten): Bildschirm geht nicht aus, Fortsetzen nach
  Wechsel in eine andere App.
- Zeitmessung fühlt sich richtig an (läuft nur bei sichtbarer App).
- Flugmodus: erst online eine Sitzung starten, dann im Flugmodus weiterüben.
- Diagramm in der Statistik gut lesbar auf dem kleinen Bildschirm.
- Ob die Erinnerung nach 4 Wochen ruhig genug wirkt (Text steht in `index.html`).

## Phase 2 — Taktik-Training

Stand: Pull Request 3 (Taktik-Trainer) ist in Arbeit beziehungsweise zur Prüfung.

**Fertig:**
- Rätsel laden (`js/puzzles.js`): Bandateien werden erst geladen, wenn sie gebraucht werden, und
  im Speicher gehalten. Rund um die eigene Stärke (minus 150 bis plus 250) und das Prüfset
  werden die Dateien im Hintergrund abgeholt, damit der Service Worker sie für offline ablegt.
- Rätsel lösen (`js/puzzle-runner.js`): Stellung nach dem Gegnerzug (erster Zug in `zuege`, wird
  automatisch gespielt), Brett aus Sicht des Spielers, darüber "Weiß am Zug" oder "Schwarz am Zug".
  Richtiger Zug: die Gegnerantwort kommt automatisch. Falscher Zug: wird kurz gezeigt,
  zurückgenommen, zählt als Fehler und beendet das Rätsel als nicht gelöst. Jeder Zug, der sofort
  Matt setzt, gilt als richtig. Keine Hinweise. Zeitmessung pausiert, wenn die App im Hintergrund
  ist (einzelne Zeiten werden bei 120 Sekunden gedeckelt).
- Nach einem Fehler: die richtige Zugfolge wird Zug für Zug gezeigt (etwa 1 Sekunde je Zug),
  danach spielt der Spieler sie einmal selbst nach (falsche Züge springen zurück und zählen nicht;
  nach dem zweiten Fehlversuch zeigt ein Pfeil den richtigen Zug), dann "Weiter".
- Einstufung (`js/rating.js`): beim ersten Start 10 adaptive Rätsel ab Wertung 1000 (Schritte
  400, 300, 200, 150, dann 100: richtig = schwerer, falsch = leichter). Danach einfaches Elo mit
  K = 40 (erste 30 Rätsel), 24 (bis 100), 16 (danach); Rätsel für die Sitzungen liegen im Bereich
  Stärke minus 50 bis plus 150. Die Taktikstärke wird nur als ruhige Zahl angezeigt.
- Wiederholung nach Leitner (`js/leitner.js`): nicht gelöste Rätsel kommen nach 1, 3, 7, 21 Tagen
  wieder (nach Kalendertag); richtig = nächste Stufe, falsch = zurück auf Stufe 1, richtig auf
  Stufe 4 = erledigt. Wiederholungen ändern die Taktikstärke nicht. Die Karten enthalten das
  ganze Rätsel, Wiederholungen gehen deshalb auch nach einem Neubau der Daten und offline.
- Sitzung (`js/session.js`): standardmäßig 10 Rätsel (wählbar 5, 10, 20), etwa 30 Prozent fällige
  Wiederholungen, Rest neu, davon die Hälfte aus den schwächsten Themen; fehlen Fällige, werden
  neue aufgefüllt. Anzeige "Rätsel 4 von 10" (keine Serien, keine Auszeichnungen). Ende: ruhige
  Zusammenfassung (gelöst, Fehler, durchschnittliche Zeit, schwächstes Thema der Sitzung). Eine
  unterbrochene Sitzung kann fortgesetzt oder verworfen werden. Themenfilter bei jeder Sitzung.
- Statistik (`#/taktik/statistik`): Taktikstärke, Liniendiagramm des Verlaufs (einfaches SVG, ein
  Punkt je Sitzung), Sitzungen pro Woche (8 Wochen), je Thema Trefferquote und durchschnittliche
  Zeit (ab 5 Versuchen, sonst "zu wenig Daten"), die 3 schwächsten Themen mit dem Knopf "Dieses
  Thema üben".
- Standortbestimmung (Zusatz): 20 feste Prüfrätsel (Wertung 850 bis 2050, 20 verschiedene
  Hauptthemen), ohne Hinweise, ohne Lösung und ohne Nachspielen. Ergebnis (gelöst von 20,
  durchschnittliche Zeit) wird mit Datum gespeichert und als einfache Liste angezeigt. Sie ändert
  Taktikstärke, Statistik und Wiederholungen nicht. Die Prüfrätsel fehlen im normalen
  Trainingsvorrat. Ruhige Erinnerung nach 4 Wochen (Hinweisleiste mit "Zur Statistik" und
  "Später"); wer noch keine gemacht hat, wird nicht erinnert.
- Speicherformat Version 2 (`taktik.anzahl`, `taktik.standort`), alte Sicherungsdateien
  (Version 1) werden beim Import und beim Laden umgestellt.
- Fehler aus Phase 1 behoben: Nach dem Hinweis "Schach." verschob sich das Brett auf der Seite,
  und Chessground traf mit dem gemerkten alten Standort das falsche Feld. Jetzt wird der Standort
  vor jeder Berührung neu gelesen (`keepBoundsFresh`), mit Regressionstest.

**Getestet (emuliert, 390 px, Touch-Emulation, echte Rätsel-Daten):** `tests/run-all.sh`
(Stand 12.11.2026: 41 Logik-Tests, 16 Python-Tests, 180 Browser-Prüfungen, alle bestanden;
`QUICK=1 tests/run-all.sh` überspringt die langen Sitzungstests, Gesamtdauer sonst etwa 15 Minuten)
- `tests/unit/logic.test.mjs`: Elo, Einstufung mit simulierten Spielern (Stärke 700 bis 2400,
  Abweichung höchstens 100), Leitner, Statistik, Sitzungsplanung, Rätsel laden, Taktik-Zustand.
- `tests/e2e/taktik.cjs`: Rätsel richtig lösen, falsch lösen und nachspielen, Matt-in-1-Alternative
  (zweiter Mattzug aus den echten Daten), komplette Einstufung mit simulierten Antworten bei Stärke
  900, 1500, 2100 (Schätzung 909, 1490, 2090).
- `tests/e2e/taktik-session.cjs`: Fälligkeit mit künstlich verschobenem Datum, Sitzung mit 3
  Wiederholungen und 7 neuen Rätseln, Stufen steigen und fallen, Zusammenfassung, Fortsetzen.
- `tests/e2e/statistik.cjs`: Statistik mit Beispieldaten, leere Statistik, "Dieses Thema üben",
  vollständige Standortbestimmung (10 von 20), Erinnerung nach 28 Tagen (nicht nach 27).
- `tests/e2e/taktik-offline.cjs`: nach einem Besuch online laufen Sitzung und Standortbestimmung
  ohne Netzwerk; fehlt ein Band, kommt eine verständliche Meldung.
- Solange `data/puzzles/pruefset.json` noch nicht gebaut ist, liefern die Tests ein gleichwertiges
  Prüfset aus den Bandateien (`tests/e2e/lib.cjs`).

**Offen:**
- Workflow ein zweites Mal starten, damit `data/puzzles/pruefset.json` entsteht (ohne die Datei
  ist die Standortbestimmung nicht verfügbar; der Knopf zeigt dann eine Meldung).

**Bekannte Mängel / Entscheidungen:**
- Das Prüfset ist fest: bei späteren Neubauten bleibt es unverändert (`--pruefset-neu` ändert es;
  dann wird in der Liste "anderer Prüfsatz" vermerkt).
- Rätsel mit sehr langer Zugfolge (bis 10 Züge) kosten Zeit; die Zeitmessung deckelt bei 120 s.
- Die Einstufung kann man nicht überspringen.
- Beim ersten Start braucht die Taktik-Seite einmal eine Internetverbindung, um die Bänder zu holen.

## Phase 3 — Eigene Partien analysieren

Noch nicht begonnen.

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.
