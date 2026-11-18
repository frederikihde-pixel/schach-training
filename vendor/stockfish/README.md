# Stockfish.js 19.0.1 (lite, single-threaded)

Schach-Engine als WebAssembly, läuft im Browser in einem Web Worker (UCI-Protokoll über
`postMessage`). Ohne Server, ohne Build-Schritt, ohne CDN.

- **Version:** Stockfish.js 19.0.1 (Stockfish 19), Variante "lite single-threaded"
- **Quelle:** npm-Paket `stockfish@19.0.1` (https://www.npmjs.com/package/stockfish), Projekt
  nmrugg/stockfish.js (https://github.com/nmrugg/stockfish.js), Grundlage Stockfish
  (https://github.com/official-stockfish/Stockfish)
- **Dateien** (unverändert aus `bin/` des Pakets):
  - `stockfish-19-lite-single.js`, 28.230 Bytes, SHA-256 `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a`
  - `stockfish-19-lite-single.wasm`, 1.845.971 Bytes, SHA-256 `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de`
  - zusammen etwa 1,8 MB; die `.wasm`-Datei muss neben der `.js`-Datei liegen und als
    `application/wasm` ausgeliefert werden
- **Lizenz:** GPL-3.0, Text in `Copying.txt` (aus dem Paket). Laut Paket-README ist der
  Engine-Code GPLv3, das veröffentlichte npm-Paket steht wegen der enthaltenen Engine unter GPL-3.0;
  nicht zur Engine gehörender Code des Projekts steht unter MIT (er wird hier nicht benutzt).
- **Neuronales Netz:** `nn-61e7af4bb97d.nnue` ("Nets by Chris Bao (sscg13)", Kopfzeile der `.js`-Datei,
  https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d) ist fest in der `.wasm`-Datei
  eingebettet und keine eigene Datei. **Eine gesonderte Lizenzangabe für dieses Netz steht im Paket
  nicht.** Wir behaupten dazu nichts; die Datei wird, wie sie veröffentlicht wurde, unter der GPL-3.0 des
  Pakets weitergegeben.
- **Einbindung:** `js/engine.js`. Die Engine wird erst beim ersten Gebrauch geladen; der Service Worker
  legt sie dann für den Offline-Betrieb ab.

## Von der Engine gemeldete Optionen (zur Kontrolle, `uci`)

`Threads` 1 (min 1, max 1), `Hash` Standard 16 (min 1), `MultiPV` 1 bis 256, `Skill Level` 0 bis 20,
`UCI_LimitStrength`, `UCI_Elo` 1320 bis 3190, `Move Overhead`, `UCI_ShowWDL`.
