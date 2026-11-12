"""Tests für tools/build_puzzles.py mit einer künstlichen CSV im Lichess-Format.
Start: python3 -m unittest discover -s tests/python -v
"""
import csv
import json
import os
import random
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPT = os.path.join(ROOT, "tools", "build_puzzles.py")
HEADER = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl", "OpeningTags"]
FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
GOOD = ["fork", "pin", "skewer", "mateIn1", "mateIn2", "mateIn3", "backRankMate", "discoveredAttack",
        "deflection", "endgame", "opening", "middlegame", "hangingPiece", "sacrifice", "quietMove"]
NOISE = ["short", "long", "crushing", "advantage", "master", "oneMove"]


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
        ["TOO_LOW", FEN, "e7e5 g1f3", 599, 80, 95, 900, "fork", "", ""],
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
        self.assertEqual(bands, list(range(600, 2700, 100)) + [2700])
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
            self.assertGreaterEqual(int(row[5]), 90, pid)
            self.assertGreaterEqual(int(row[6]), 500, pid)
            self.assertLessEqual(int(row[4]), 100, pid)
            self.assertGreaterEqual(int(row[3]), 600, pid)
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

    def test_ausgabe_nennt_zusammenfassung(self):
        self.assertIn("Zeilen gelesen", self.stdout)
        self.assertIn("Gesamtgröße", self.stdout)


if __name__ == "__main__":
    unittest.main()
