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

**Getestet (emuliert):** `tests/e2e/overflow.cjs` (scrollWidth gleich Fensterbreite),
`tests/e2e/zoom-drag.cjs` (Viewport ohne Sperre, Ziehen scrollt die Seite nicht,
Wischen außerhalb des Bretts scrollt weiterhin).

**Offen:** Navigation und Info-Seite, Speicher, Daten-Export/Import, Installierbarkeit,
Rätsel-Daten.

## Phase 2 — Taktik-Training

Noch nicht begonnen.

## Phase 3 — Eigene Partien analysieren

Noch nicht begonnen.

## Phase 4 — Eröffnung und Endspiel

Noch nicht begonnen.

## Phase 5 — Tagesplan

Noch nicht begonnen.
