"""Tests für tools/build_puzzles.py mit einer künstlichen CSV im Lichess-Format.
Start: python3 -m unittest discover -s tests/python -v
"""
import csv
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPT = os.path.join(ROOT, "tools", "build_puzzles.py")
HEADER = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl", "OpeningTags"]
FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
GOOD = ["fork", "pin", "skewer", "mateIn1", "mateIn2", "mateIn3", "backRankMate", "discoveredAttack",
        "deflection", "endgame", "opening", "middlegame", "hangingPiece", "sacrifice", "quietMove", "trappedPiece"]
NOISE = ["short", "long", "crushing", "advantage", "master"]


def make_rows(n=120000, seed=7):
    rng = random.Random(seed)
    rows, info = [], {}
    for i in range(n):
        rating = rng.randint(400, 3100)
        if 2600 <= rating <= 2699:  # Band 2600 bleibt für die Grenzwert-Zeilen frei
            rating -= 200
        themes = rng.sample(GOOD, rng.randint(0, 3)) + rng.sample(NOISE, rng.randint(1, 2))
        pid = f"P{i:05d}"
        row = [pid, FEN, "e7e5 g1f3 b8c6", rating, rng.randint(60, 115), rng.randint(80, 100), rng.randint(300, 5000), " ".join(themes), "https://lichess.org/x", ""]
        rows.append(row)
        info[pid] = row
    # Grenzwerte in Band 2600: die ersten drei müssen drin sein, die nächsten drei nicht.
    extra = [
        ["OK_POP", FEN, "e7e5 g1f3", 2650, 80, 90, 900, "fork short", "", ""],
        ["OK_PLAYS", FEN, "e7e5 g1f3", 2651, 80, 95, 500, "pin", "", ""],
        ["OK_DEV", FEN, "e7e5 g1f3", 2652, 100, 95, 900, "", "", ""],
        ["BAD_POP", FEN, "e7e5 g1f3", 2653, 80, 89, 900, "fork", "", ""],
        ["BAD_PLAYS", FEN, "e7e5 g1f3", 2654, 80, 95, 499, "fork", "", ""],
        ["BAD_DEV", FEN, "e7e5 g1f3", 2655, 101, 95, 900, "fork", "", ""],
        ["TOO_LOW", FEN, "e7e5 g1f3", 299, 80, 95, 900, "fork", "", ""],
        ["ONE_MOVE", FEN, "e7e5", 1500, 80, 95, 900, "fork", "", ""],
    ]
    for row in extra:
        rows.append(row)
        info[row[0]] = row
    rng.shuffle(rows)
    return rows, info


def write_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)


def run(args, stdin=None):
    return subprocess.run([sys.executable, SCRIPT, *args], input=stdin, capture_output=True, text=True)


class BuildPuzzlesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.rows, cls.info = make_rows()
        cls.csv = os.path.join(cls.tmp.name, "in.csv")
        write_csv(cls.csv, cls.rows)
        cls.out = os.path.join(cls.tmp.name, "out")
        res = run([cls.csv, "--out", cls.out, "--datum", "2026-11-12"])
        assert res.returncode == 0, res.stderr + res.stdout
        cls.stdout = res.stdout
        with open(os.path.join(cls.out, "index.json"), encoding="utf-8") as f:
            cls.index = json.load(f)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def load(self, band):
        with open(os.path.join(self.out, f"band-{band}.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_dateien_und_bänder(self):
        bands = [b["band"] for b in self.index["baender"]]
        self.assertEqual(bands, list(range(400, 2700, 100)) + [2700])  # 300 fehlt: keine Rätsel dort
        for name in ("index.json", "LICENSE.md"):
            self.assertTrue(os.path.exists(os.path.join(self.out, name)))
        with open(os.path.join(self.out, "LICENSE.md"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn("CC0", text)
        self.assertIn("lichess", text.lower())
        self.assertIn("2026-11-12", text)

    def test_höchstens_1000_je_band_und_wertung_im_band(self):
        for b in self.index["baender"]:
            data = self.load(b["band"])
            self.assertLessEqual(len(data["raetsel"]), 1000)
            self.assertEqual(len(data["raetsel"]), b["anzahl"])
            self.assertEqual(data["felder"], ["id", "fen", "zuege", "rating", "themen"])
            for pid, fen, zuege, rating, themen in data["raetsel"]:
                if b["band"] == 2700:
                    self.assertGreaterEqual(rating, 2700)
                else:
                    self.assertTrue(b["band"] <= rating < b["band"] + 100, (b["band"], rating))

    def test_gesamtgröße_unter_5_mb(self):
        self.assertLess(self.index["gesamtBytes"], 5_000_000)
        real = sum(os.path.getsize(os.path.join(self.out, b["datei"])) for b in self.index["baender"])
        self.assertEqual(real, self.index["gesamtBytes"])

    def test_filter_und_grenzwerte(self):
        selected = {}
        for b in self.index["baender"]:
            for p in self.load(b["band"])["raetsel"]:
                selected[p[0]] = p
        for pid, p in selected.items():
            row = self.info[pid]
            low = int(row[3]) < 700
            self.assertGreaterEqual(int(row[5]), 80 if low else 90, pid)
            self.assertGreaterEqual(int(row[6]), 200 if low else 500, pid)
            self.assertLessEqual(int(row[4]), 100, pid)
            self.assertGreaterEqual(int(row[3]), 300, pid)
            self.assertGreaterEqual(len(row[2].split()), 2, pid)
        for ok in ("OK_POP", "OK_PLAYS", "OK_DEV"):
            self.assertIn(ok, selected)
        for bad in ("BAD_POP", "BAD_PLAYS", "BAD_DEV", "TOO_LOW", "ONE_MOVE"):
            self.assertNotIn(bad, selected)

    def test_erster_zug_bleibt_der_gegnerzug(self):
        for b in self.index["baender"][:3]:
            for pid, fen, zuege, rating, themen in self.load(b["band"])["raetsel"]:
                self.assertEqual(zuege, self.info[pid][2])
                self.assertEqual(fen, FEN)

    def test_themen_gleichmäßig_und_nur_bekannte(self):
        data = self.load(1500)
        counts = {}
        for p in data["raetsel"]:
            for t in p[4]:
                counts[t] = counts.get(t, 0) + 1
        self.assertTrue(set(counts) <= set(GOOD))
        for t in GOOD:
            self.assertGreaterEqual(counts.get(t, 0), 20, f"{t} zu selten: {counts}")
        self.assertLess(max(counts.values()) / min(counts.values()), 4, counts)

    def test_index_enthält_bänder_anzahl_themen(self):
        self.assertEqual(self.index["lizenz"], "CC0 1.0")
        self.assertEqual(self.index["felder"], ["id", "fen", "zuege", "rating", "themen"])
        names = {t["name"] for t in self.index["themen"]}
        self.assertTrue(set(GOOD) <= names)
        self.assertTrue(all("anzahl" in b and "datei" in b for b in self.index["baender"]))

    def test_gleiche_eingabe_gleiches_ergebnis(self):
        out2 = os.path.join(self.tmp.name, "out2")
        self.assertEqual(run([self.csv, "--out", out2, "--datum", "2026-11-12"]).returncode, 0)
        for b in self.index["baender"]:
            with open(os.path.join(self.out, b["datei"]), "rb") as a, open(os.path.join(out2, b["datei"]), "rb") as c:
                self.assertEqual(a.read(), c.read(), b["datei"])
        out3 = os.path.join(self.tmp.name, "out3")
        self.assertEqual(run([self.csv, "--out", out3, "--seed", "anders", "--datum", "2026-11-12"]).returncode, 0)
        with open(os.path.join(self.out, "band-1500.json"), "rb") as a, open(os.path.join(out3, "band-1500.json"), "rb") as c:
            self.assertNotEqual(a.read(), c.read())

    def test_standardeingabe(self):
        out = os.path.join(self.tmp.name, "out_stdin")
        with open(self.csv, encoding="utf-8") as f:
            res = run(["-", "--out", out, "--datum", "2026-11-12"], stdin=f.read())
        self.assertEqual(res.returncode, 0, res.stderr)
        with open(os.path.join(out, "band-1500.json"), "rb") as a, open(os.path.join(self.out, "band-1500.json"), "rb") as c:
            self.assertEqual(a.read(), c.read())

    def test_größenlimit_verkleinert_automatisch(self):
        out = os.path.join(self.tmp.name, "out_small")
        res = run([self.csv, "--out", out, "--max-bytes", "300000", "--datum", "2026-11-12"])
        self.assertEqual(res.returncode, 0, res.stderr)
        with open(os.path.join(out, "index.json"), encoding="utf-8") as f:
            idx = json.load(f)
        self.assertLessEqual(idx["gesamtBytes"], 300000)
        self.assertLess(idx["maxProBand"], 1000)

    def test_fehlende_spalten_werden_gemeldet(self):
        bad = os.path.join(self.tmp.name, "bad.csv")
        with open(bad, "w", encoding="utf-8") as f:
            f.write("a,b,c\n1,2,3\n")
        res = run([bad, "--out", os.path.join(self.tmp.name, "x")])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("fehlen Spalten", res.stderr)

    def load_pruefset(self, out=None):
        with open(os.path.join(out or self.out, "pruefset.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_pruefset_20_raetsel_ueber_800_bis_2000(self):
        ps = self.load_pruefset()
        self.assertEqual(len(ps["raetsel"]), 20)
        ratings = [r[3] for r in ps["raetsel"]]
        self.assertEqual(ratings, sorted(ratings))
        self.assertTrue(all(800 <= r < 2100 for r in ratings), ratings)
        self.assertLess(ratings[0], 950)
        self.assertGreater(ratings[-1], 1950)
        ids = [r[0] for r in ps["raetsel"]]
        self.assertEqual(len(set(ids)), 20)
        themes = {t for r in ps["raetsel"] for t in r[4]}
        self.assertGreaterEqual(len(themes), 12, themes)
        for r in ps["raetsel"]:
            self.assertEqual(r[2], self.info[r[0]][2])
        self.assertEqual(ps["felder"], ["id", "fen", "zuege", "rating", "themen"])
        self.assertRegex(ps["satz"], r"^[0-9a-f]{8}$")

    def test_pruefset_fehlt_im_trainingsvorrat(self):
        ids = {r[0] for r in self.load_pruefset()["raetsel"]}
        for b in self.index["baender"]:
            in_band = {p[0] for p in self.load(b["band"])["raetsel"]}
            self.assertFalse(ids & in_band, b["band"])

    def test_pruefset_im_index(self):
        info = self.index["pruefset"]
        ps = self.load_pruefset()
        self.assertEqual(info["datei"], "pruefset.json")
        self.assertEqual(info["anzahl"], 20)
        self.assertEqual(info["satz"], ps["satz"])
        self.assertEqual(info["bytes"], os.path.getsize(os.path.join(self.out, "pruefset.json")))

    def test_pruefset_bleibt_beim_neubau_fest(self):
        out = os.path.join(self.tmp.name, "out_fest")
        self.assertEqual(run([self.csv, "--out", out, "--datum", "2026-11-12"]).returncode, 0)
        first = self.load_pruefset(out)
        # anderer Startwert und andere Eingabe: das Prüfset darf sich nicht ändern
        rows, _ = make_rows(60000, seed=99)
        other = os.path.join(self.tmp.name, "other.csv")
        write_csv(other, rows)
        res = run([other, "--out", out, "--seed", "x", "--datum", "2026-12-01"])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("übernommen", res.stdout)
        self.assertEqual(self.load_pruefset(out), first)
        # mit --pruefset-neu wird neu gewählt
        res = run([other, "--out", out, "--seed", "x", "--pruefset-neu", "--datum", "2026-12-01"])
        self.assertIn("neu gewählt", res.stdout)
        self.assertNotEqual(self.load_pruefset(out)["satz"], first["satz"])

    def load_einsteiger(self, out=None):
        with open(os.path.join(out or self.out, "pruefset-einsteiger.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_pruefset_einsteiger_20_raetsel_450_bis_1100(self):
        ps = self.load_einsteiger()
        self.assertEqual(len(ps["raetsel"]), 20)
        ratings = [r[3] for r in ps["raetsel"]]
        self.assertEqual(ratings, sorted(ratings))
        self.assertTrue(all(400 <= r < 1200 for r in ratings), ratings)
        self.assertLess(ratings[0], 520)
        self.assertGreater(ratings[-1], 1050)
        self.assertEqual(len({r[0] for r in ps["raetsel"]}), 20)
        self.assertRegex(ps["satz"], r"^[0-9a-f]{8}$")
        self.assertEqual(ps["felder"], ["id", "fen", "zuege", "rating", "themen"])
        # jedes der 10 Themen kommt mindestens zweimal vor
        for theme in ["mateIn1", "hangingPiece", "fork", "pin", "mateIn2", "skewer", "backRankMate",
                      "discoveredAttack", "trappedPiece", "deflection"]:
            n = sum(1 for r in ps["raetsel"] if theme in r[4])
            self.assertGreaterEqual(n, 2, f"{theme}: {n}")
        # nur strenge Kandidaten (hier reichen sie), Züge unverändert
        for r in ps["raetsel"]:
            row = self.info[r[0]]
            self.assertGreaterEqual(int(row[5]), 90)
            self.assertGreaterEqual(int(row[6]), 500)
            self.assertLessEqual(int(row[4]), 100)
            self.assertEqual(r[2], row[2])

    def test_pruefset_einsteiger_getrennt_vom_anderen_und_vom_training(self):
        ein = {r[0] for r in self.load_einsteiger()["raetsel"]}
        fort = {r[0] for r in self.load_pruefset()["raetsel"]}
        self.assertFalse(ein & fort)
        for b in self.index["baender"]:
            in_band = {p[0] for p in self.load(b["band"])["raetsel"]}
            self.assertFalse(ein & in_band, b["band"])

    def test_index_hat_pruefsets_und_behaelt_alten_schluessel(self):
        sets = {p["id"]: p for p in self.index["pruefsets"]}
        self.assertEqual(list(sets), ["fortgeschritten", "einsteiger"])
        self.assertEqual(sets["fortgeschritten"]["name"], "Prüfset Fortgeschritten")
        self.assertEqual(sets["einsteiger"]["name"], "Prüfset Einsteiger")
        self.assertEqual(sets["einsteiger"]["datei"], "pruefset-einsteiger.json")
        self.assertEqual(sets["einsteiger"]["satz"], self.load_einsteiger()["satz"])
        self.assertEqual(sets["einsteiger"]["bytes"], os.path.getsize(os.path.join(self.out, "pruefset-einsteiger.json")))
        self.assertEqual(sets["fortgeschritten"]["anzahl"], 20)
        self.assertEqual(self.index["pruefset"]["satz"], sets["fortgeschritten"]["satz"])  # alter Schlüssel

    def test_pruefset_einsteiger_bleibt_fest_und_neu_mit_flag(self):
        out = os.path.join(self.tmp.name, "out_ein_fest")
        self.assertEqual(run([self.csv, "--out", out, "--datum", "2026-11-12"]).returncode, 0)
        first = self.load_einsteiger(out)
        rows, _ = make_rows(60000, seed=99)
        other = os.path.join(self.tmp.name, "other_ein.csv")
        write_csv(other, rows)
        res = run([other, "--out", out, "--seed", "x", "--datum", "2026-12-01"])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(self.load_einsteiger(out), first)
        res = run([other, "--out", out, "--seed", "x", "--einsteiger-neu", "--datum", "2026-12-01"])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertNotEqual(self.load_einsteiger(out)["satz"], first["satz"])

    def test_fehlendes_oneMove_wird_gemeldet(self):
        self.assertEqual(self.index["einsteiger"]["fehlendeThemen"], ["oneMove"])
        self.assertIn("nicht vorhanden: oneMove", self.stdout)

    def test_unabhaengige_baender(self):
        # ohne die Rätsel unter 600 bleibt ein hohes Band byte-gleich
        rows = [r for r in self.rows if int(r[3]) >= 600]
        path = os.path.join(self.tmp.name, "ohne_unten.csv")
        write_csv(path, rows)
        out = os.path.join(self.tmp.name, "out_ohne_unten")
        os.makedirs(out)
        for name in ("pruefset.json", "pruefset-einsteiger.json"):  # ohne Rätsel unten gäbe es kein Einsteiger-Set
            shutil.copy(os.path.join(self.out, name), os.path.join(out, name))
        self.assertEqual(run([path, "--out", out, "--datum", "2026-11-12"]).returncode, 0)
        with open(os.path.join(out, "band-1500.json"), "rb") as a, open(os.path.join(self.out, "band-1500.json"), "rb") as c:
            self.assertEqual(a.read(), c.read())

    def test_index_filter_je_band(self):
        for b in self.index["baender"]:
            self.assertIn("filter", b)
            self.assertIn("kandidaten", b)
            if b["band"] >= 700:
                self.assertEqual(b["filter"]["hoechsteStufe"], 0, b["band"])
                self.assertEqual(b["kandidaten"]["gelockert1"], 0, b["band"])
        self.assertEqual(self.index["lockernUnterBand"], 700)
        self.assertEqual(len(self.index["filterStufen"]), 3)

    def test_ausgabe_nennt_zusammenfassung(self):
        self.assertIn("Zeilen gelesen", self.stdout)
        self.assertIn("Gesamtgröße", self.stdout)


BEGINNER = ["mateIn1", "mateIn2", "hangingPiece", "fork", "pin", "oneMove"]


def pz(pid, rating, themes, pop=95, plays=900, dev=80):
    return [pid, FEN, "e7e5 g1f3 b8c6", rating, dev, pop, plays, " ".join(themes), "", ""]


def filler(per_band=30):
    """Genug strenge Rätsel in allen Bändern, damit beide Prüfsets gewählt werden können."""
    rows = []
    for band in range(400, 2800, 100):
        for i in range(per_band):
            rows.append(pz(f"F{band}_{i:02d}", band + i, [GOOD[(i + band // 100) % len(GOOD)]]))
    return rows


class LowBandTest(unittest.TestCase):
    """Bänder unter 700: gelockerte Filterstufen, Mindestzahl der Einsteiger-Themen, kleine Bänder."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        rows = filler()
        for i in range(400):  # streng
            rows.append(pz(f"S{i:03d}", 400 + i % 100, [BEGINNER[i % 6]]))
        for i in range(300):  # Stufe 1: nur NbPlays niedriger
            rows.append(pz(f"A{i:03d}", 400 + i % 100, [BEGINNER[i % 6]], pop=95, plays=300))
        for i in range(300):  # Stufe 2: auch Popularity niedriger
            rows.append(pz(f"B{i:03d}", 400 + i % 100, [BEGINNER[i % 6]], pop=85, plays=300))
        for i in range(20):
            rows.append(pz(f"R1_{i}", 450, ["fork"], pop=85, plays=100))  # zu wenig gespielt
            rows.append(pz(f"R2_{i}", 450, ["fork"], pop=70, plays=900))  # zu wenig beliebt
            rows.append(pz(f"R3_{i}", 450, ["fork"], dev=101))  # zu unsicher
        for i in range(50):  # Band 800: gelockerte Werte zählen dort nicht
            rows.append(pz(f"X{i:03d}", 800 + i, ["fork"], plays=300))
        for i in range(100):  # Band 500 braucht eigene Rätsel, sonst entfällt auch er
            rows.append(pz(f"M{i:03d}", 500 + i, [GOOD[i % len(GOOD)]]))
        for i in range(50):  # Band 300 zu klein
            rows.append(pz(f"K{i:03d}", 300 + i, ["fork"]))
        cls.rows = rows
        cls.csv = os.path.join(cls.tmp.name, "low.csv")
        write_csv(cls.csv, rows)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def build(self, name, *extra):
        out = os.path.join(self.tmp.name, name)
        res = run([self.csv, "--out", out, "--pool-size", "1000", "--datum", "2026-11-12", *extra])
        self.assertEqual(res.returncode, 0, res.stderr + res.stdout)
        with open(os.path.join(out, "index.json"), encoding="utf-8") as f:
            return out, json.load(f), res.stdout

    def band(self, out, band):
        with open(os.path.join(out, f"band-{band}.json"), encoding="utf-8") as f:
            return json.load(f)["raetsel"]

    def einsteiger_ids(self, out):
        with open(os.path.join(out, "pruefset-einsteiger.json"), encoding="utf-8") as f:
            return {r[0] for r in json.load(f)["raetsel"]}

    def test_streng_zuerst_dann_gelockert(self):
        out, idx, _ = self.build("a", "--max-per-band", "500")
        ids = [p[0] for p in self.band(out, 400)]
        self.assertEqual(len(ids), 500)
        removed = len(self.einsteiger_ids(out) & {r[0] for r in self.rows if r[0].startswith("S")})
        s = sum(1 for i in ids if i.startswith("S"))
        a = sum(1 for i in ids if i.startswith("A"))
        b = sum(1 for i in ids if i.startswith("B"))
        self.assertEqual(s, 400 - removed)  # alle strengen, bis auf die ins Prüfset gewählten
        self.assertGreater(a, 0)
        self.assertEqual(b, 0)  # Stufe 2 nur, wenn Stufe 1 nicht reicht
        entry = next(e for e in idx["baender"] if e["band"] == 400)
        self.assertEqual(entry["kandidaten"], {"streng": 430, "gelockert1": 300, "gelockert2": 300})  # 400 + 30 Füller
        self.assertEqual(entry["filter"]["hoechsteStufe"], 1)
        self.assertEqual(entry["filter"]["gewaehlt"], {"streng": 500 - a, "gelockert1": a, "gelockert2": 0})

    def test_stufe_2_wenn_noetig(self):
        out, idx, _ = self.build("b", "--max-per-band", "1000")
        ids = [p[0] for p in self.band(out, 400)]
        self.assertGreater(sum(1 for i in ids if i.startswith("B")), 0)
        self.assertFalse([i for i in ids if i.startswith("R")])  # nichts unter den Mindestwerten
        entry = next(e for e in idx["baender"] if e["band"] == 400)
        self.assertEqual(entry["filter"]["hoechsteStufe"], 2)

    def test_keine_lockerung_ab_700(self):
        out, idx, _ = self.build("c")
        ids = [p[0] for p in self.band(out, 800)]
        self.assertFalse([i for i in ids if i.startswith("X")])
        entry = next(e for e in idx["baender"] if e["band"] == 800)
        self.assertEqual(entry["kandidaten"]["gelockert1"], 0)

    def test_mindestzahl_einsteiger_themen_auch_mit_gelockerten(self):
        out, idx, stdout = self.build("d", "--max-per-band", "500")
        counts = {}
        for p in self.band(out, 400):
            for t in p[4]:
                counts[t] = counts.get(t, 0) + 1
        for t in BEGINNER:
            self.assertGreaterEqual(counts.get(t, 0), 80, counts)  # nur streng wären es ~67
        entry = next(e for e in idx["baender"] if e["band"] == 400)
        self.assertEqual(entry["einsteigerThemen"], {t: counts[t] for t in BEGINNER})
        self.assertEqual(idx["einsteiger"]["fehlendeThemen"], [])
        self.assertIn("oneMove", stdout)

    def test_band_unter_600_mit_zu_wenigen_raetseln_entfaellt(self):
        out, idx, stdout = self.build("e")
        bands = [b["band"] for b in idx["baender"]]
        self.assertNotIn(300, bands)
        self.assertFalse(os.path.exists(os.path.join(out, "band-300.json")))
        self.assertEqual(idx["entfalleneBaender"], {"300": 50})
        self.assertIn("Band 300 entfällt", stdout)

    def test_band_300_mit_genug_raetseln_entsteht(self):
        rows = self.rows + [pz(f"K2_{i:03d}", 300 + i % 100, ["fork"]) for i in range(120)]
        path = os.path.join(self.tmp.name, "mit300.csv")
        write_csv(path, rows)
        out = os.path.join(self.tmp.name, "f")
        res = run([path, "--out", out, "--pool-size", "1000", "--datum", "2026-11-12"])
        self.assertEqual(res.returncode, 0, res.stderr)
        with open(os.path.join(out, "index.json"), encoding="utf-8") as f:
            idx = json.load(f)
        self.assertEqual(idx["baender"][0]["band"], 300)
        self.assertGreaterEqual(idx["baender"][0]["anzahl"], 100)
        self.assertEqual(idx["entfalleneBaender"], {})

    def test_einsteiger_pruefset_aus_strengen_kandidaten(self):
        out, _, _ = self.build("g")
        ids = self.einsteiger_ids(out)
        self.assertEqual(len(ids), 20)
        self.assertFalse([i for i in ids if i[0] in "ABXRK"])  # S* und Füller sind streng


class QuotaTest(unittest.TestCase):
    """Seltene Einsteiger-Themen in einem Band über 700 bekommen trotzdem die Mindestzahl."""

    def test_mindestzahl_in_band_900(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = filler()
            themes = ["hangingPiece"] * 85 + ["fork"] * 90 + ["pin"] * 95 + ["mateIn1"] * 300 + ["mateIn2"] * 200
            others = ["endgame", "opening", "middlegame", "sacrifice", "quietMove", "skewer"]
            for i in range(230):
                themes.append(others[i % len(others)])
            for i, t in enumerate(themes):
                rows.append(pz(f"Q{i:04d}", 900 + i % 100, [t]))
            path = os.path.join(tmp, "q.csv")
            write_csv(path, rows)
            out = os.path.join(tmp, "out")
            res = run([path, "--out", out, "--pool-size", "1000", "--max-per-band", "600", "--datum", "2026-11-12"])
            self.assertEqual(res.returncode, 0, res.stderr)
            with open(os.path.join(out, "band-900.json"), encoding="utf-8") as f:
                data = json.load(f)["raetsel"]
            self.assertEqual(len(data), 600)
            counts = {}
            for p in data:
                for t in p[4]:
                    counts[t] = counts.get(t, 0) + 1
            for t in ("mateIn1", "mateIn2", "hangingPiece", "fork", "pin"):
                self.assertGreaterEqual(counts.get(t, 0), 80, counts)


if __name__ == "__main__":
    unittest.main()
