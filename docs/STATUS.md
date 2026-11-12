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

Stand: in Arbeit (Pull Request 1 umfasst Teil A bis C, Pull Request 2 den Taktik-Trainer).

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

**Offen:** echter Workflow-Lauf auf GitHub (Daten erzeugen), danach Phase 2 (Taktik-Trainer).

**Nur emuliert, bitte auf dem echten Handy prüfen (Stand Pull Request 1):**
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

## Phase 2 — Taktik-Training

Noch nicht begonnen.

## Phase 3 — Eigene Partien analysieren

Noch nicht begonnen.

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.
