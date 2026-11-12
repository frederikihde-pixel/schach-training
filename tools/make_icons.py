#!/usr/bin/env python3
"""Erzeugt die App-Icons (schlichter Bauer auf dunklem Grund) als PNG.

Nur Python-Standardbibliothek. Aufruf: python3 tools/make_icons.py
Schreibt nach icons/. Der Bauer liegt innerhalb der "Safe Zone" für maskierbare Icons.
"""
import os
import struct
import zlib

BG = (21, 23, 27)  # #15171b
LIGHT = (228, 230, 234)  # #e4e6ea
ACCENT = (77, 106, 138)  # #4d6a8a

# Formen in Einheitskoordinaten (0..1). Reihenfolge: spätere überdecken frühere.
def shape_color(x, y):
    # Kopf
    if (x - 0.5) ** 2 + (y - 0.355) ** 2 <= 0.095**2:
        return LIGHT
    # Kragen
    if 0.45 <= y <= 0.487 and abs(x - 0.5) <= 0.125:
        return LIGHT
    # Körper (Trapez)
    if 0.487 < y <= 0.70:
        half = 0.07 + (y - 0.487) / (0.70 - 0.487) * (0.17 - 0.07)
        if abs(x - 0.5) <= half:
            return LIGHT
    # Sockel
    if 0.70 < y <= 0.78 and abs(x - 0.5) <= 0.22:
        return ACCENT
    return None


def render(size, samples=3):
    rows = []
    n = samples * samples
    for py in range(size):
        row = bytearray([0])  # Filter "keiner"
        for px in range(size):
            r = g = b = 0
            for sy in range(samples):
                for sx in range(samples):
                    x = (px + (sx + 0.5) / samples) / size
                    y = (py + (sy + 0.5) / samples) / size
                    c = shape_color(x, y) or BG
                    r += c[0]
                    g += c[1]
                    b += c[2]
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size):
    raw = render(size)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#15171b"/>
  <circle cx="50" cy="35.5" r="9.5" fill="#e4e6ea"/>
  <rect x="37.5" y="45" width="25" height="3.7" fill="#e4e6ea"/>
  <polygon points="43,48.7 57,48.7 67,70 33,70" fill="#e4e6ea"/>
  <rect x="28" y="70" width="44" height="8" fill="#4d6a8a"/>
</svg>
"""


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("icon-maskable-512.png", 512), ("apple-touch-icon.png", 180)):
        write_png(os.path.join(out, name), size)
        print("geschrieben:", name)
    with open(os.path.join(out, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(SVG)
    print("geschrieben: icon.svg")


if __name__ == "__main__":
    main()
