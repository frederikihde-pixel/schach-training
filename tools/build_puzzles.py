#!/usr/bin/env python3
"""Baut aus der Lichess-Rätsel-Datenbank kleine JSON-Dateien für die App.

Quelle (Lizenz CC0): https://database.lichess.org/#puzzles
Datei: lichess_db_puzzle.csv.zst  (zuerst entpacken, siehe unten)

Nur Python-Standardbibliothek. Aufruf:

    zstd -dc lichess_db_puzzle.csv.zst | python3 tools/build_puzzles.py -
    python3 tools/build_puzzles.py lichess_db_puzzle.csv

Spalten der CSV: PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
Themes, GameUrl, OpeningTags. Wichtig: Der ERSTE Zug in "Moves" ist der Zug des Gegners.
Die App spielt ihn automatisch; gelöst wird ab dem zweiten Zug.

Auswahl: Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100. Je Wertungsband von
100 Punkten (600 bis 2699, dazu ein offenes Band ab 2700) bis zu 1000 Rätsel, möglichst
gleichmäßig über die Themen verteilt. Bei gleicher Eingabe und gleichem --seed ist das
Ergebnis immer identisch.

Prüfset: 20 feste Rätsel für die "Standortbestimmung" (Wertung 850 bis 2050, über 20
verschiedene Themen verteilt) landen in pruefset.json und fehlen in den Bandateien. Existiert
pruefset.json schon, wird es unverändert übernommen, damit Ergebnisse über die Zeit
vergleichbar bleiben (neu erzeugen mit --pruefset-neu).
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import random
import sys
from collections import Counter

SOURCE = "https://database.lichess.org/#puzzles"
FIELDS = ["id", "fen", "zuege", "rating", "themen"]
REQUIRED = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes"]
FIRST_BAND = 600
LAST_BAND = 2700  # offenes Band: 2700 und höher

# Themen, über die gleichmäßig verteilt wird (Motive, Mattbilder, Spielphasen).
# Reine Schwierigkeits- oder Längen-Marken (crushing, advantage, master, short ...) bleiben draußen.
THEMES = {
    "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "deflection", "attraction",
    "interference", "intermezzo", "quietMove", "clearance", "capturingDefender", "xRayAttack",
    "zugzwang", "sacrifice", "hangingPiece", "trappedPiece", "exposedKing", "defensiveMove",
    "kingsideAttack", "queensideAttack", "attackingF2F7", "advancedPawn", "promotion",
    "underPromotion", "enPassant", "castling",
    "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5", "backRankMate", "smotheredMate",
    "anastasiaMate", "arabianMate", "bodenMate", "doubleBishopMate", "dovetailMate", "hookMate",
    "opening", "middlegame", "endgame", "pawnEndgame", "rookEndgame", "bishopEndgame",
    "knightEndgame", "queenEndgame", "queenRookEndgame",
}
MIX = "mix"  # Rätsel ohne eines der Themen oben

PRUEFSET_FILE = "pruefset.json"
PRUEFSET_SIZE = 20
PRUEFSET_MIN = 850
PRUEFSET_MAX = 2050
# Ein Thema je Platz, von leicht nach schwer. Fehlt ein Thema im passenden Band, wird ein
# anderes Thema aus demselben Band genommen.
PRUEFSET_LADDER = [
    "mateIn1", "hangingPiece", "fork", "pin", "backRankMate", "skewer", "mateIn2",
    "discoveredAttack", "trappedPiece", "deflection", "endgame", "attraction", "sacrifice",
    "quietMove", "clearance", "mateIn3", "interference", "opening", "xRayAttack", "zugzwang",
]


def band_of(rating):
    if rating < FIRST_BAND:
        return None
    if rating >= LAST_BAND:
        return LAST_BAND
    return rating // 100 * 100


def open_input(path):
    if path == "-":
        return sys.stdin
    if path.endswith(".zst"):
        try:
            from compression import zstd  # Python 3.14+
        except ImportError:
            sys.exit(
                "Python kann .zst erst ab Version 3.14 selbst lesen. Entpacke zuerst:\n"
                "  zstd -dc lichess_db_puzzle.csv.zst | python3 tools/build_puzzles.py -"
            )
        import io
        return io.TextIOWrapper(zstd.open(path, "rb"), encoding="utf-8", newline="")
    return open(path, encoding="utf-8", newline="")


def read_pools(stream, args, rng):
    """Liest die CSV einmal von vorn nach hinten und hält je Band und Thema eine Stichprobe."""
    reader = csv.reader(stream)
    header = next(reader, None)
    if header is None:
        sys.exit("Die Eingabe ist leer.")
    missing = [c for c in REQUIRED if c not in header]
    if missing:
        sys.exit(f"In der Kopfzeile fehlen Spalten: {', '.join(missing)}\nGefunden: {', '.join(header)}")
    col = {name: header.index(name) for name in REQUIRED}
    need = max(col.values()) + 1

    stats = Counter()
    pools = {}  # band -> thema -> Stichprobe
    seen = {}  # (band, thema) -> Zähler für Reservoir-Auswahl
    cap = args.pool_size

    for row in reader:
        stats["gelesen"] += 1
        if len(row) < need:
            stats["unvollstaendig"] += 1
            continue
        try:
            rating = int(row[col["Rating"]])
            deviation = int(row[col["RatingDeviation"]])
            popularity = int(row[col["Popularity"]])
            plays = int(row[col["NbPlays"]])
        except ValueError:
            stats["ungueltige_zahl"] += 1
            continue
        if popularity < args.min_popularity:
            stats["zu_wenig_beliebt"] += 1
            continue
        if plays < args.min_plays:
            stats["zu_wenig_gespielt"] += 1
            continue
        if deviation > args.max_deviation:
            stats["zu_unsicher"] += 1
            continue
        band = band_of(rating)
        if band is None:
            stats["wertung_zu_niedrig"] += 1
            continue
        moves = row[col["Moves"]].split()
        fen = row[col["FEN"]]
        if len(moves) < 2 or fen.count(" ") < 3:
            stats["unbrauchbar"] += 1
            continue
        tags = sorted(t for t in row[col["Themes"]].split() if t in THEMES)
        puzzle = (row[col["PuzzleId"]], fen, " ".join(moves), rating, tags)
        stats["qualifiziert"] += 1
        for tag in tags or [MIX]:
            key = (band, tag)
            n = seen.get(key, 0) + 1
            seen[key] = n
            pool = pools.setdefault(band, {}).setdefault(tag, [])
            if len(pool) < cap:
                pool.append(puzzle)
            else:
                j = rng.randrange(n)
                if j < cap:
                    pool[j] = puzzle
    return pools, stats


def choose_pruefset(pools):
    """Wählt 20 Rätsel: Wertung steigt von 850 auf 2050, jedes Rätsel hat ein anderes Hauptthema."""
    chosen = {}
    for i, theme in enumerate(PRUEFSET_LADDER):
        target = round(PRUEFSET_MIN + i * (PRUEFSET_MAX - PRUEFSET_MIN) / (PRUEFSET_SIZE - 1))
        band = band_of(target)
        pick = None
        for b in (band, band - 100, band + 100):
            cands = [p for p in pools.get(b, {}).get(theme, []) if p[0] not in chosen]
            if cands:
                pick = min(cands, key=lambda p: (abs(p[3] - target), p[0]))
                break
        if pick is None:
            cands = [p for pool in pools.get(band, {}).values() for p in pool if p[0] not in chosen]
            if not cands:
                sys.exit(f"Für das Prüfset fehlen Rätsel um Wertung {target}.")
            pick = min(cands, key=lambda p: (abs(p[3] - target), p[0]))
        chosen[pick[0]] = pick
    return sorted(chosen.values(), key=lambda p: (p[3], p[0]))


def pruefset_hash(puzzles):
    return hashlib.sha1(",".join(p[0] for p in puzzles).encode("utf-8")).hexdigest()[:8]


def load_pruefset(out):
    """Liest ein vorhandenes Prüfset (oder None). Das Prüfset bleibt bewusst fest."""
    path = os.path.join(out, PRUEFSET_FILE)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    puzzles = [(r[0], r[1], r[2], r[3], list(r[4])) for r in data["raetsel"]]
    if len(puzzles) != PRUEFSET_SIZE:
        sys.exit(f"{path} enthält {len(puzzles)} statt {PRUEFSET_SIZE} Rätseln. Mit --pruefset-neu neu erzeugen.")
    return puzzles


def remove_from_pools(pools, ids):
    for band in list(pools):
        for tag in list(pools[band]):
            pools[band][tag] = [p for p in pools[band][tag] if p[0] not in ids]
            if not pools[band][tag]:
                del pools[band][tag]
        if not pools[band]:
            del pools[band]


def select_band(pools, cap, seed, band):
    """Wählt bis zu `cap` Rätsel: reihum ein Rätsel je Thema, seltene Themen zuerst."""
    rng = random.Random(f"{seed}-{band}")
    order = sorted(pools, key=lambda t: (len(pools[t]), t))
    shuffled = {t: rng.sample(pools[t], len(pools[t])) for t in order}
    index = {t: 0 for t in order}
    chosen = {}
    while len(chosen) < cap:
        progressed = False
        for tag in order:
            items = shuffled[tag]
            i = index[tag]
            while i < len(items) and items[i][0] in chosen:
                i += 1
            if i < len(items):
                chosen[items[i][0]] = items[i]
                i += 1
                progressed = True
            index[tag] = i
            if len(chosen) >= cap:
                break
        if not progressed:
            break
    return sorted(chosen.values(), key=lambda p: (p[3], p[0]))


def band_json(band, puzzles):
    data = {"band": band, "felder": FIELDS, "raetsel": [list(p) for p in puzzles]}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def build(pools, args):
    cap = args.max_per_band
    while True:
        selected = {band: select_band(pools[band], cap, args.seed, band) for band in sorted(pools)}
        files = {band: band_json(band, puzzles) for band, puzzles in selected.items()}
        total = sum(len(b) for b in files.values())
        if total <= args.max_bytes or cap <= 50:
            return selected, files, total, cap
        cap = int(cap * 0.9)


def pruefset_json(puzzles):
    data = {"satz": pruefset_hash(puzzles), "felder": FIELDS, "raetsel": [list(p) for p in puzzles]}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def write_outputs(selected, files, total, cap, stats, args, pruefset):
    os.makedirs(args.out, exist_ok=True)
    for name in os.listdir(args.out):
        if name.startswith("band-") and name.endswith(".json"):
            os.remove(os.path.join(args.out, name))
    bands = []
    themes = Counter()
    for band in sorted(selected):
        name = f"band-{band}.json"
        with open(os.path.join(args.out, name), "wb") as f:
            f.write(files[band])
        puzzles = selected[band]
        for p in puzzles:
            themes.update(p[4])
        bands.append({
            "band": band,
            "datei": name,
            "anzahl": len(puzzles),
            "ratingMin": puzzles[0][3] if puzzles else None,
            "ratingMax": puzzles[-1][3] if puzzles else None,
            "bytes": len(files[band]),
        })
    pruefset_bytes = pruefset_json(pruefset)
    with open(os.path.join(args.out, PRUEFSET_FILE), "wb") as f:
        f.write(pruefset_bytes)
    index = {
        "version": 1,
        "erstellt": args.datum,
        "quelle": SOURCE,
        "lizenz": "CC0 1.0",
        "felder": FIELDS,
        "hinweis": "Der erste Zug in 'zuege' ist der Zug des Gegners und wird automatisch gespielt.",
        "filter": {
            "popularity": args.min_popularity,
            "nbPlays": args.min_plays,
            "ratingDeviation": args.max_deviation,
        },
        "maxProBand": cap,
        "pruefset": {
            "datei": PRUEFSET_FILE,
            "satz": pruefset_hash(pruefset),
            "anzahl": len(pruefset),
            "ratingMin": pruefset[0][3],
            "ratingMax": pruefset[-1][3],
            "bytes": len(pruefset_bytes),
        },
        "gesamtBytes": total,
        "gelesen": stats["gelesen"],
        "qualifiziert": stats["qualifiziert"],
        "baender": bands,
        "themen": [{"name": t, "anzahl": n} for t, n in sorted(themes.items(), key=lambda kv: (-kv[1], kv[0]))],
    }
    with open(os.path.join(args.out, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(args.out, "LICENSE.md"), "w", encoding="utf-8") as f:
        f.write(LICENSE_TEXT.format(datum=args.datum, quelle=SOURCE))
    return index


LICENSE_TEXT = """# Lizenz der Rätsel-Daten

Die Dateien `band-*.json` und `index.json` in diesem Ordner sind ein Auszug aus der
Lichess-Rätsel-Datenbank.

- Quelle: {quelle} (Datei `lichess_db_puzzle.csv.zst`)
- Lizenz: Creative Commons CC0 1.0 (Public Domain Dedication),
  https://creativecommons.org/publicdomain/zero/1.0/
- Abgerufen und ausgewertet am: {datum}
- Auswahl: Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100, je Wertungsband bis zu
  1000 Rätsel, gleichmäßig über die Themen verteilt. Erzeugt mit `tools/build_puzzles.py`.
- `pruefset.json`: 20 feste Rätsel für die Standortbestimmung; sie fehlen in den Bandateien.

Der erste Zug in `zuege` ist der Zug des Gegners.
"""


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("eingabe", help="entpackte CSV-Datei oder - für die Standardeingabe")
    p.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "puzzles"))
    p.add_argument("--seed", default="1")
    p.add_argument("--max-per-band", type=int, default=1000)
    p.add_argument("--max-bytes", type=int, default=5_000_000)
    p.add_argument("--pool-size", type=int, default=150, help="Stichprobengröße je Band und Thema")
    p.add_argument("--min-popularity", type=int, default=90)
    p.add_argument("--min-plays", type=int, default=500)
    p.add_argument("--max-deviation", type=int, default=100)
    p.add_argument("--datum", default=datetime.date.today().isoformat())
    p.add_argument("--pruefset-neu", action="store_true", help="vorhandenes pruefset.json nicht übernehmen")
    args = p.parse_args(argv)

    rng = random.Random(f"{args.seed}-lesen")
    with open_input(args.eingabe) as stream:
        pools, stats = read_pools(stream, args, rng)
    if not pools:
        sys.exit("Keine Rätsel haben die Filter bestanden.")

    pruefset = None if args.pruefset_neu else load_pruefset(args.out)
    reused = pruefset is not None
    if pruefset is None:
        pruefset = choose_pruefset(pools)
    remove_from_pools(pools, {p[0] for p in pruefset})

    selected, files, total, cap = build(pools, args)
    index = write_outputs(selected, files, total, cap, stats, args, pruefset)

    print(f"Zeilen gelesen:      {stats['gelesen']}")
    for key in ("unvollstaendig", "ungueltige_zahl", "zu_wenig_beliebt", "zu_wenig_gespielt", "zu_unsicher", "wertung_zu_niedrig", "unbrauchbar"):
        if stats[key]:
            print(f"  verworfen ({key}): {stats[key]}")
    print(f"Qualifiziert:        {stats['qualifiziert']}")
    print(f"Höchstzahl je Band:  {cap}")
    print("Band   Anzahl  Bytes")
    for b in index["baender"]:
        print(f"{b['band']:>5}  {b['anzahl']:>6}  {b['bytes']:>7}")
    ps = index["pruefset"]
    print(f"Prüfset:             {ps['anzahl']} Rätsel, Wertung {ps['ratingMin']} bis {ps['ratingMax']}, Satz {ps['satz']} ({'übernommen' if reused else 'neu gewählt'})")
    print(f"Gesamtgröße:         {total} Bytes ({total / 1e6:.2f} MB)")
    print("Häufigste Themen:    " + ", ".join(f"{t['name']} {t['anzahl']}" for t in index["themen"][:8]))
    print("Seltenste Themen:    " + ", ".join(f"{t['name']} {t['anzahl']}" for t in index["themen"][-5:]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
