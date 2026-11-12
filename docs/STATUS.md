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

**Getestet (emuliert):** `tests/e2e/overflow.cjs` (scrollWidth gleich Fensterbreite),
`tests/e2e/zoom-drag.cjs` (Viewport ohne Sperre, Ziehen scrollt die Seite nicht,
Wischen außerhalb des Bretts scrollt weiterhin), `tests/e2e/brett.cjs` (alle
Phase-1-Szenarien als Regressionstest, 19 Prüfungen), `tests/e2e/navigation.cjs`
(Leiste, Seitenwechsel, Info-Seite, alle Tippflächen mindestens 44 px, Leiste verdeckt
nichts), `tests/unit/storage.test.mjs` (11 Logik-Tests mit `node --test "tests/unit/*.test.mjs"`:
Migration, Export/Import, Fehlerfälle, Begrenzung, 14-Tage-Erinnerung),
`tests/e2e/storage.cjs` (ein Schlüssel mit Version, persist() beim Start, Neuladen).

**Offen:** Daten-Export/Import-Seite, Installierbarkeit, Rätsel-Daten.

## Phase 2 — Taktik-Training

Noch nicht begonnen.

## Phase 3 — Eigene Partien analysieren

Noch nicht begonnen.

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.
