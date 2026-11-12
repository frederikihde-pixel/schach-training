#!/usr/bin/env bash
# Startet alle Tests: Logik-Tests (node --test) und Browsertests (Playwright, 390 px, Touch-Emulation).
set -u
cd "$(dirname "$0")/.."
fail=0
node --test "tests/unit/*.test.mjs" 2>&1 | grep -E "^# (tests|pass|fail)" || fail=1
echo "== Python (Rätsel-Skript)"
python3 -m unittest discover -s tests/python 2>&1 | tail -3 || fail=1
# QUICK=1 überspringt die langen Browsertests (mehrere Minuten, spielen ganze Sitzungen durch).
SLOW="taktik.cjs taktik-session.cjs statistik.cjs"
for t in tests/e2e/*.cjs; do
  [ "$(basename "$t")" = "lib.cjs" ] && continue
  if [ -n "${QUICK:-}" ] && echo " $SLOW " | grep -q " $(basename "$t") "; then echo "== $t (übersprungen, QUICK)"; continue; fi
  echo "== $t"
  node "$t" || fail=1
done
exit $fail
