"""Draws the home-screen icons (no extra libraries needed): python3 make_icons.py"""
import math
import os
import struct
import zlib

BG = (0xF4, 0xF1, 0xEA)
# 2×2 blocks: sage, oat / clay, empty slot
BLOCKS = [(0xA3, 0xB0, 0x9A), (0xD8, 0xC4, 0x9C), (0xC9, 0x9A, 0x82), (0xDF, 0xD9, 0xCD)]


def rounded_box_distance(px, py, cx, cy, half, radius):
    qx = abs(px - cx) - (half - radius)
    qy = abs(py - cy) - (half - radius)
    outside = math.hypot(max(qx, 0), max(qy, 0))
    return outside + min(max(qx, qy), 0) - radius


def draw(size):
    block = size * 0.27
    gap = size * 0.05
    start = (size - (2 * block + gap)) / 2
    radius = block * 0.26
    boxes = []
    for n, colour in enumerate(BLOCKS):
        r, c = divmod(n, 2)
        cx = start + c * (block + gap) + block / 2
        cy = start + r * (block + gap) + block / 2
        boxes.append((cx, cy, colour))

    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            colour = BG
            for cx, cy, fill in boxes:
                d = rounded_box_distance(px, py, cx, cy, block / 2, radius)
                cover = min(max(0.5 - d, 0), 1)
                if cover > 0:
                    colour = tuple(round(a + (b - a) * cover) for a, b in zip(colour, fill))
            row += bytes(colour)
        rows.append(bytes(row))
    return b''.join(rows)


def write_png(path, size):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

    raw = draw(size)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(out, exist_ok=True)
    for s in (180, 192, 512):
        write_png(os.path.join(out, f'icon-{s}.png'), s)
    print('icons written to', out)
