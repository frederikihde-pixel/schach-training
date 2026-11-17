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

Bänder: je 100 Wertungspunkte, von 300 bis 2699, dazu ein offenes Band ab 2700. Bänder unter 600
entstehen nur, wenn mindestens 100 Rätsel vorhanden sind (sonst steht das im Log).

Filter: überall zuerst streng (Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100). Nur in
den Bändern unter 700 und nur, wenn das nicht für 1000 Rätsel reicht, wird gelockert:
  Stufe 1: NbPlays >= 200
  Stufe 2: NbPlays >= 200 und Popularity >= 80
Es werden zuerst strenge Rätsel genommen und mit gelockerten aufgefüllt. index.json hält je Band
fest, welche Stufe gilt und wie viele Kandidaten jede Stufe hatte.

Einsteiger-Themen: In den Bändern unter 1100 gibt es von jedem der Themen mateIn1, mateIn2,
hangingPiece, fork, pin und oneMove (falls im Rohdatensatz vorhanden) mindestens 80 Rätsel;
danach wird gleichmäßig über die übrigen Themen aufgefüllt.

Prüfsets (feste Rätsel für die "Standortbestimmung", nicht im Trainingsvorrat):
  pruefset.json            "Fortgeschritten": 20 Rätsel, Wertung 850 bis 2050
  pruefset-einsteiger.json "Einsteiger": 20 Rätsel, Wertung 450 bis 1100
Vorhandene Dateien werden unverändert übernommen, damit Ergebnisse über die Zeit vergleichbar
bleiben (neu erzeugen mit --pruefset-neu beziehungsweise --einsteiger-neu).

Bei gleicher Eingabe und gleichem --seed ist das Ergebnis immer identisch.
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
FIRST_BAND = 300
LAST_BAND = 2700  # offenes Band: 2700 und höher
MIN_BAND_SIZE = 100  # Bänder unter 600 mit weniger Rätseln entfallen
SMALL_BAND_BELOW = 600

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
    "oneMove",  # Einzüger; ob der Rohdatensatz ihn enthält, zeigt das Log
}
MIX = "mix"  # Rätsel ohne eines der Themen oben

# Einsteiger: gelockerte Filter und feste Mindestzahl einfacher Themen
RELAX_BELOW = 700
EINSTEIGER_BELOW = 1100
EINSTEIGER_THEMES = ["mateIn1", "mateIn2", "hangingPiece", "fork", "pin", "oneMove"]
EINSTEIGER_MIN = 80

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

EINSTEIGER_FILE = "pruefset-einsteiger.json"
EINSTEIGER_RATING_MIN = 450
EINSTEIGER_RATING_MAX = 1100
# 10 Themen, je zweimal, von leicht nach schwer.
EINSTEIGER_LADDER = [
    "mateIn1", "hangingPiece", "mateIn1", "fork", "hangingPiece", "pin", "fork", "mateIn2",
    "pin", "skewer", "mateIn2", "backRankMate", "skewer", "discoveredAttack", "backRankMate",
    "trappedPiece", "discoveredAttack", "deflection", "trappedPiece", "deflection",
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


def filter_tier(popularity, plays, deviation, band, args):
    """0 = streng, 1 und 2 = gelockert (nur in Bändern unter RELAX_BELOW), None = verworfen."""
    if deviation > args.max_deviation:
        return None
    if popularity >= args.min_popularity and plays >= args.min_plays:
        return 0
    if band < args.lockern_unter:
        if popularity >= args.min_popularity and plays >= args.relax_plays:
            return 1
        if popularity >= args.relax_popularity and plays >= args.relax_plays:
            return 2
    return None


class Pools:
    """Stichproben je Filterstufe, Band und Thema: tiers[stufe][band][thema] = Liste von Rätseln."""

    def __init__(self):
        self.tiers = [{}, {}, {}]
        self.seen = {}
        self.rngs = {}
        self.lax_ids = {}  # Rätsel-Id -> Stufe (nur für gelockerte)
        self.cand = {}  # band -> Counter(stufe -> Zahl der Kandidaten)

    def add(self, band, tier, tag, puzzle, cap, seed):
        key = (band, tier, tag)
        n = self.seen.get(key, 0) + 1
        self.seen[key] = n
        pool = self.tiers[tier].setdefault(band, {}).setdefault(tag, [])
        if len(pool) < cap:
            pool.append(puzzle)
            if tier:
                self.lax_ids[puzzle[0]] = tier
            return
        rng = self.rngs.get(key)
        if rng is None:
            rng = self.rngs[key] = random.Random(f"{seed}-lesen-{band}-{tier}-{tag}")
        j = rng.randrange(n)
        if j < cap:
            pool[j] = puzzle
            if tier:
                self.lax_ids[puzzle[0]] = tier

    @property
    def strict(self):
        return self.tiers[0]

    def bands(self):
        out = set()
        for t in self.tiers:
            out |= set(t)
        return sorted(out)

    def remove(self, ids):
        for tier in self.tiers:
            for band in list(tier):
                for tag in list(tier[band]):
                    tier[band][tag] = [p for p in tier[band][tag] if p[0] not in ids]
                    if not tier[band][tag]:
                        del tier[band][tag]
                if not tier[band]:
                    del tier[band]


def read_pools(stream, args):
    """Liest die CSV einmal von vorn nach hinten und hält je Band, Stufe und Thema eine Stichprobe."""
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
    raw_themes = Counter()  # alle Schlagworte der Rätsel in Bändern unter EINSTEIGER_BELOW
    pools = Pools()
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
        band = band_of(rating)
        if band is None:
            stats["wertung_zu_niedrig"] += 1
            continue
        tier = filter_tier(popularity, plays, deviation, band, args)
        if tier is None:
            if popularity < args.min_popularity:
                stats["zu_wenig_beliebt"] += 1
            elif plays < args.min_plays:
                stats["zu_wenig_gespielt"] += 1
            else:
                stats["zu_unsicher"] += 1
            continue
        moves = row[col["Moves"]].split()
        fen = row[col["FEN"]]
        if len(moves) < 2 or fen.count(" ") < 3:
            stats["unbrauchbar"] += 1
            continue
        all_tags = row[col["Themes"]].split()
        if band < EINSTEIGER_BELOW:
            raw_themes.update(all_tags)
        tags = sorted(t for t in all_tags if t in THEMES)
        puzzle = (row[col["PuzzleId"]], fen, " ".join(moves), rating, tags)
        stats["qualifiziert"] += 1
        pools.cand.setdefault(band, Counter())[tier] += 1
        for tag in tags or [MIX]:
            pools.add(band, tier, tag, puzzle, cap, args.seed)
    return pools, stats, raw_themes


def nearest(candidates, target):
    return min(candidates, key=lambda p: (abs(p[3] - target), p[0]))


def choose_pruefset(pools):
    """Wählt 20 Rätsel: Wertung steigt von 850 auf 2050, jedes Rätsel hat ein anderes Hauptthema."""
    chosen = {}
    for i, theme in enumerate(PRUEFSET_LADDER):
        target = round(PRUEFSET_MIN + i * (PRUEFSET_MAX - PRUEFSET_MIN) / (PRUEFSET_SIZE - 1))
        band = band_of(target)
        pick = None
        for b in (band, band - 100, band + 100):
            cands = [p for p in pools.strict.get(b, {}).get(theme, []) if p[0] not in chosen]
            if cands:
                pick = nearest(cands, target)
                break
        if pick is None:
            cands = [p for pool in pools.strict.get(band, {}).values() for p in pool if p[0] not in chosen]
            if not cands:
                sys.exit(f"Für das Prüfset fehlen Rätsel um Wertung {target}.")
            pick = nearest(cands, target)
        chosen[pick[0]] = pick
    return sorted(chosen.values(), key=lambda p: (p[3], p[0]))


def choose_einsteiger(pools, exclude):
    """Wählt 20 Rätsel für Einsteiger: Wertung 450 bis 1100, leicht nach schwer, 10 Themen je zweimal.
    Bevorzugt strenge Kandidaten; gelockerte nur, wenn die strengen nicht reichen."""
    chosen = {}
    n = len(EINSTEIGER_LADDER)
    for i, theme in enumerate(EINSTEIGER_LADDER):
        target = round(EINSTEIGER_RATING_MIN + i * (EINSTEIGER_RATING_MAX - EINSTEIGER_RATING_MIN) / (n - 1))
        band = band_of(target)
        pick = None
        for tier in pools.tiers:  # streng zuerst
            for b in (band, band - 100, band + 100):
                cands = [p for p in tier.get(b, {}).get(theme, []) if p[0] not in chosen and p[0] not in exclude]
                if cands:
                    pick = nearest(cands, target)
                    break
            if pick:
                break
        if pick is None:
            for tier in pools.tiers:
                cands = [p for pool in tier.get(band, {}).values() for p in pool if p[0] not in chosen and p[0] not in exclude]
                if cands:
                    pick = nearest(cands, target)
                    break
        if pick is None:
            sys.exit(f"Für das Einsteiger-Prüfset fehlen Rätsel um Wertung {target}.")
        chosen[pick[0]] = pick
    return sorted(chosen.values(), key=lambda p: (p[3], p[0]))


def pruefset_hash(puzzles):
    return hashlib.sha1(",".join(p[0] for p in puzzles).encode("utf-8")).hexdigest()[:8]


def load_pruefset(out, filename, flag):
    """Liest ein vorhandenes Prüfset (oder None). Prüfsets bleiben bewusst fest."""
    path = os.path.join(out, filename)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    puzzles = [(r[0], r[1], r[2], r[3], list(r[4])) for r in data["raetsel"]]
    if len(puzzles) != PRUEFSET_SIZE:
        sys.exit(f"{path} enthält {len(puzzles)} statt {PRUEFSET_SIZE} Rätseln. Mit {flag} neu erzeugen.")
    return puzzles


def round_robin(pools, chosen, cap, rng):
    """Reihum ein Rätsel je Thema, seltene Themen zuerst."""
    order = sorted(pools, key=lambda t: (len(pools[t]), t))
    shuffled = {t: rng.sample(pools[t], len(pools[t])) for t in order}
    index = {t: 0 for t in order}
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


def fill_quota(tiers, chosen, themes, minimum, cap, rng):
    """Stellt sicher, dass jedes der Themen mindestens `minimum` mal vorkommt (wenn es genug gibt)."""
    for theme in themes:
        have = sum(1 for p in chosen.values() if theme in p[4])
        for pools in tiers:
            if have >= minimum:
                break
            items = pools.get(theme, [])
            for p in rng.sample(items, len(items)):
                if have >= minimum or len(chosen) >= cap:
                    break
                if p[0] not in chosen:
                    chosen[p[0]] = p
                    have += 1


def select_band(tiers, cap, seed, band, quota=None):
    """Wählt bis zu `cap` Rätsel eines Bandes. tiers = [streng, Stufe 1, Stufe 2] (Thema -> Liste)."""
    rng = random.Random(f"{seed}-{band}")
    chosen = {}
    if quota:
        fill_quota(tiers, chosen, quota[0], quota[1], cap, rng)
    for pools in tiers:  # zuerst streng, dann gelockert auffüllen
        if len(chosen) >= cap:
            break
        round_robin(pools, chosen, cap, rng)
    return sorted(chosen.values(), key=lambda p: (p[3], p[0]))


def band_json(band, puzzles):
    data = {"band": band, "felder": FIELDS, "raetsel": [list(p) for p in puzzles]}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def build(pools, args):
    cap = args.max_per_band
    while True:
        selected = {}
        dropped = {}
        for band in pools.bands():
            tiers = [t.get(band, {}) for t in pools.tiers]
            quota = (EINSTEIGER_THEMES, args.einsteiger_min) if band < EINSTEIGER_BELOW else None
            chosen = select_band(tiers, cap, args.seed, band, quota)
            if band < SMALL_BAND_BELOW and len(chosen) < args.min_band_size:
                dropped[band] = len(chosen)
                continue
            selected[band] = chosen
        files = {band: band_json(band, puzzles) for band, puzzles in selected.items()}
        total = sum(len(b) for b in files.values())
        if total <= args.max_bytes or cap <= 50:
            return selected, files, total, cap, dropped
        cap = int(cap * 0.9)


def pruefset_json(puzzles, extra=None):
    data = dict(extra or {})
    data.update({"satz": pruefset_hash(puzzles), "felder": FIELDS, "raetsel": [list(p) for p in puzzles]})
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def pruefset_info(id_, name, filename, puzzles, data):
    return {
        "id": id_,
        "name": name,
        "datei": filename,
        "satz": pruefset_hash(puzzles),
        "anzahl": len(puzzles),
        "ratingMin": puzzles[0][3],
        "ratingMax": puzzles[-1][3],
        "bytes": len(data),
    }


FILTER_STUFEN = [
    {"stufe": 0, "name": "streng"},
    {"stufe": 1, "name": "gelockert 1"},
    {"stufe": 2, "name": "gelockert 2"},
]


def write_outputs(selected, files, total, cap, stats, args, pools, fortgeschritten, einsteiger, raw_themes, dropped):
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
        per_tier = Counter(pools.lax_ids.get(p[0], 0) for p in puzzles)
        cand = pools.cand.get(band, Counter())
        entry = {
            "band": band,
            "datei": name,
            "anzahl": len(puzzles),
            "ratingMin": puzzles[0][3] if puzzles else None,
            "ratingMax": puzzles[-1][3] if puzzles else None,
            "bytes": len(files[band]),
            "filter": {
                "hoechsteStufe": max(per_tier) if per_tier else 0,
                "gewaehlt": {"streng": per_tier[0], "gelockert1": per_tier[1], "gelockert2": per_tier[2]},
            },
            "kandidaten": {"streng": cand[0], "gelockert1": cand[1], "gelockert2": cand[2]},
        }
        if band < EINSTEIGER_BELOW:
            entry["einsteigerThemen"] = {t: sum(1 for p in puzzles if t in p[4]) for t in EINSTEIGER_THEMES}
        bands.append(entry)

    fort_bytes = pruefset_json(fortgeschritten)
    with open(os.path.join(args.out, PRUEFSET_FILE), "wb") as f:
        f.write(fort_bytes)
    ein_bytes = pruefset_json(einsteiger, {"id": "einsteiger", "name": "Prüfset Einsteiger"})
    with open(os.path.join(args.out, EINSTEIGER_FILE), "wb") as f:
        f.write(ein_bytes)
    fort_info = pruefset_info("fortgeschritten", "Prüfset Fortgeschritten", PRUEFSET_FILE, fortgeschritten, fort_bytes)
    ein_info = pruefset_info("einsteiger", "Prüfset Einsteiger", EINSTEIGER_FILE, einsteiger, ein_bytes)

    index = {
        "version": 2,
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
        "filterStufen": [
            {**FILTER_STUFEN[0], "popularity": args.min_popularity, "nbPlays": args.min_plays, "ratingDeviation": args.max_deviation},
            {**FILTER_STUFEN[1], "popularity": args.min_popularity, "nbPlays": args.relax_plays, "ratingDeviation": args.max_deviation},
            {**FILTER_STUFEN[2], "popularity": args.relax_popularity, "nbPlays": args.relax_plays, "ratingDeviation": args.max_deviation},
        ],
        "lockernUnterBand": args.lockern_unter,
        "einsteiger": {
            "themen": EINSTEIGER_THEMES,
            "mindestzahl": args.einsteiger_min,
            "unterBand": EINSTEIGER_BELOW,
            "imRohdatensatz": {t: raw_themes[t] for t in EINSTEIGER_THEMES},
            "fehlendeThemen": [t for t in EINSTEIGER_THEMES if raw_themes[t] == 0],
        },
        "entfalleneBaender": {str(b): n for b, n in sorted(dropped.items())},
        "maxProBand": cap,
        "pruefset": {k: v for k, v in fort_info.items() if k not in ("id", "name")},
        "pruefsets": [fort_info, ein_info],
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
        f.write(LICENSE_TEXT.format(datum=args.datum, quelle=SOURCE, relax_plays=args.relax_plays, relax_popularity=args.relax_popularity, lockern=args.lockern_unter, mind=args.einsteiger_min))
    return index


LICENSE_TEXT = """# Lizenz der Rätsel-Daten

Die Dateien `band-*.json`, `pruefset*.json` und `index.json` in diesem Ordner sind ein Auszug aus der
Lichess-Rätsel-Datenbank.

- Quelle: {quelle} (Datei `lichess_db_puzzle.csv.zst`)
- Lizenz: Creative Commons CC0 1.0 (Public Domain Dedication),
  https://creativecommons.org/publicdomain/zero/1.0/
- Abgerufen und ausgewertet am: {datum}
- Auswahl: je Wertungsband bis zu 1000 Rätsel, gleichmäßig über die Themen verteilt. Erzeugt mit
  `tools/build_puzzles.py`.
- Filter: streng (Popularity >= 90, NbPlays >= 500, RatingDeviation <= 100). In den Bändern unter
  {lockern}, wo das nicht für 1000 Rätsel reicht, gelockert: Stufe 1 NbPlays >= {relax_plays}, Stufe 2
  zusätzlich Popularity >= {relax_popularity}. Welche Stufe in welchem Band gilt, steht in `index.json`.
- In den Bändern unter 1100 gibt es von den Einsteiger-Themen (Matt in 1, Matt in 2, ungedeckte
  Figur, Gabel, Fesselung und, falls vorhanden, Einzüger) mindestens {mind} Rätsel.
- `pruefset.json` ("Fortgeschritten") und `pruefset-einsteiger.json` ("Einsteiger"): je 20 feste
  Rätsel für die Standortbestimmung; sie fehlen in den Bandateien.

Der erste Zug in `zuege` ist der Zug des Gegners.
"""


def print_summary(index, stats, cap, total, raw_themes, reused, dropped, args):
    print(f"Zeilen gelesen:      {stats['gelesen']}")
    for key in ("unvollstaendig", "ungueltige_zahl", "zu_wenig_beliebt", "zu_wenig_gespielt", "zu_unsicher", "wertung_zu_niedrig", "unbrauchbar"):
        if stats[key]:
            print(f"  verworfen ({key}): {stats[key]}")
    print(f"Qualifiziert:        {stats['qualifiziert']}")
    print(f"Höchstzahl je Band:  {cap}")
    print("Band  Anzahl  Bytes | gewählt streng/Stufe1/Stufe2 | Kandidaten streng/Stufe1/Stufe2")
    for b in index["baender"]:
        g, k = b["filter"]["gewaehlt"], b["kandidaten"]
        print(f"{b['band']:>5}  {b['anzahl']:>6}  {b['bytes']:>6} | {g['streng']:>5}/{g['gelockert1']:>5}/{g['gelockert2']:>5} | {k['streng']:>8}/{k['gelockert1']:>7}/{k['gelockert2']:>7}")
    for band, n in sorted(dropped.items()):
        print(f"  Band {band} entfällt: nur {n} Rätsel (mindestens {args.min_band_size} nötig)")
    for ps in index["pruefsets"]:
        key = "fort" if ps["id"] == "fortgeschritten" else "ein"
        print(f"{ps['name']}: {ps['anzahl']} Rätsel, Wertung {ps['ratingMin']} bis {ps['ratingMax']}, Satz {ps['satz']} ({'übernommen' if reused[key] else 'neu gewählt'})")
    print(f"Gesamtgröße:         {total} Bytes ({total / 1e6:.2f} MB)")
    print("Einsteiger-Themen im Rohdatensatz (Bänder unter 1100): " + ", ".join(f"{t} {raw_themes[t]}" for t in EINSTEIGER_THEMES))
    if index["einsteiger"]["fehlendeThemen"]:
        print("  Im Rohdatensatz nicht vorhanden: " + ", ".join(index["einsteiger"]["fehlendeThemen"]))
    unknown = [(t, n) for t, n in raw_themes.most_common() if t not in THEMES]
    print("Alle Schlagworte der unteren Bänder (* = nicht in der Auswahlliste):")
    print("  " + ", ".join(f"{t}{'' if t in THEMES else '*'} {n}" for t, n in raw_themes.most_common(90)))
    print("Häufigste Themen:    " + ", ".join(f"{t['name']} {t['anzahl']}" for t in index["themen"][:8]))
    print("Seltenste Themen:    " + ", ".join(f"{t['name']} {t['anzahl']}" for t in index["themen"][-5:]))
    return unknown


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("eingabe", help="entpackte CSV-Datei oder - für die Standardeingabe")
    p.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "puzzles"))
    p.add_argument("--seed", default="1")
    p.add_argument("--max-per-band", type=int, default=1000)
    p.add_argument("--max-bytes", type=int, default=5_000_000)
    p.add_argument("--pool-size", type=int, default=150, help="Stichprobengröße je Band, Stufe und Thema")
    p.add_argument("--min-popularity", type=int, default=90)
    p.add_argument("--min-plays", type=int, default=500)
    p.add_argument("--max-deviation", type=int, default=100)
    p.add_argument("--lockern-unter", type=int, default=RELAX_BELOW, help="Filter nur in Bändern unter dieser Wertung lockern")
    p.add_argument("--relax-plays", type=int, default=200, help="NbPlays in den gelockerten Stufen")
    p.add_argument("--relax-popularity", type=int, default=80, help="Popularity in Stufe 2")
    p.add_argument("--einsteiger-min", type=int, default=EINSTEIGER_MIN, help="Mindestzahl je Einsteiger-Thema in Bändern unter 1100")
    p.add_argument("--min-band-size", type=int, default=MIN_BAND_SIZE, help="Bänder unter 600 mit weniger Rätseln entfallen")
    p.add_argument("--datum", default=datetime.date.today().isoformat())
    p.add_argument("--pruefset-neu", action="store_true", help="vorhandenes pruefset.json nicht übernehmen")
    p.add_argument("--einsteiger-neu", action="store_true", help="vorhandenes pruefset-einsteiger.json nicht übernehmen")
    args = p.parse_args(argv)

    with open_input(args.eingabe) as stream:
        pools, stats, raw_themes = read_pools(stream, args)
    if not pools.bands():
        sys.exit("Keine Rätsel haben die Filter bestanden.")

    fortgeschritten = None if args.pruefset_neu else load_pruefset(args.out, PRUEFSET_FILE, "--pruefset-neu")
    reused = {"fort": fortgeschritten is not None}
    if fortgeschritten is None:
        fortgeschritten = choose_pruefset(pools)
    fort_ids = {p[0] for p in fortgeschritten}

    einsteiger = None if args.einsteiger_neu else load_pruefset(args.out, EINSTEIGER_FILE, "--einsteiger-neu")
    reused["ein"] = einsteiger is not None
    if einsteiger is None:
        einsteiger = choose_einsteiger(pools, fort_ids)
    pools.remove(fort_ids | {p[0] for p in einsteiger})

    selected, files, total, cap, dropped = build(pools, args)
    index = write_outputs(selected, files, total, cap, stats, args, pools, fortgeschritten, einsteiger, raw_themes, dropped)
    print_summary(index, stats, cap, total, raw_themes, reused, dropped, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
