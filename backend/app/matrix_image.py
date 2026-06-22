from __future__ import annotations

import binascii
import math
import struct
import zlib
from io import BytesIO


RGB = tuple[int, int, int]

CATEGORY_COLORS: dict[str, RGB] = {
    "E": (37, 163, 111),
    "S": (213, 144, 63),
    "G": (85, 109, 200),
}

FONT: dict[str, list[str]] = {
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "11110", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
}


def _chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)


def _encode_png(width: int, height: int, pixels: bytearray) -> bytes:
    stride = width * 3
    raw = bytearray()
    for row in range(height):
        raw.append(0)
        raw.extend(pixels[row * stride : (row + 1) * stride])
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _chunk(b"IEND", b"")
    )


def _set_pixel(pixels: bytearray, width: int, height: int, x: int, y: int, color: RGB) -> None:
    if 0 <= x < width and 0 <= y < height:
        index = (y * width + x) * 3
        pixels[index : index + 3] = bytes(color)


def _line(pixels: bytearray, width: int, height: int, x1: int, y1: int, x2: int, y2: int, color: RGB) -> None:
    dx = abs(x2 - x1)
    dy = -abs(y2 - y1)
    sx = 1 if x1 < x2 else -1
    sy = 1 if y1 < y2 else -1
    error = dx + dy
    while True:
        _set_pixel(pixels, width, height, x1, y1, color)
        if x1 == x2 and y1 == y2:
            break
        error2 = 2 * error
        if error2 >= dy:
            error += dy
            x1 += sx
        if error2 <= dx:
            error += dx
            y1 += sy


def _rect(pixels: bytearray, width: int, height: int, x1: int, y1: int, x2: int, y2: int, color: RGB, fill: bool = False) -> None:
    if fill:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                _set_pixel(pixels, width, height, x, y, color)
        return
    _line(pixels, width, height, x1, y1, x2, y1, color)
    _line(pixels, width, height, x2, y1, x2, y2, color)
    _line(pixels, width, height, x2, y2, x1, y2, color)
    _line(pixels, width, height, x1, y2, x1, y1, color)


def _circle(pixels: bytearray, width: int, height: int, cx: int, cy: int, radius: int, color: RGB, border: RGB) -> None:
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            distance = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            if distance <= radius:
                _set_pixel(pixels, width, height, x, y, color)
            if radius - 1 <= distance <= radius + 1:
                _set_pixel(pixels, width, height, x, y, border)


def _text(pixels: bytearray, width: int, height: int, x: int, y: int, text: str, color: RGB, scale: int = 2) -> None:
    cursor = x
    for char in text.upper():
        glyph = FONT.get(char, FONT[" "])
        for row, line in enumerate(glyph):
            for col, bit in enumerate(line):
                if bit == "1":
                    _rect(
                        pixels,
                        width,
                        height,
                        cursor + col * scale,
                        y + row * scale,
                        cursor + col * scale + scale - 1,
                        y + row * scale + scale - 1,
                        color,
                        fill=True,
                    )
        cursor += 6 * scale


def create_matrix_png(data: dict, width: int = 1200, height: int = 800) -> BytesIO:
    pixels = bytearray([255, 255, 255] * width * height)
    margin_left, margin_right, margin_top, margin_bottom = 115, 80, 90, 105
    plot_left, plot_right = margin_left, width - margin_right
    plot_top, plot_bottom = margin_top, height - margin_bottom
    axis = (30, 53, 42)
    grid = (231, 236, 233)
    threshold = (145, 164, 154)
    text = (25, 53, 42)

    def px(value: float) -> int:
        value = max(1, min(5, value or 0))
        return int(plot_left + (value - 1) / 4 * (plot_right - plot_left))

    def py(value: float) -> int:
        value = max(1, min(5, value or 0))
        return int(plot_bottom - (value - 1) / 4 * (plot_bottom - plot_top))

    _text(pixels, width, height, 350, 24, "DOUBLE MATERIALITY MATRIX", text, scale=3)
    _text(pixels, width, height, 430, height - 55, "FINANCIAL MATERIALITY", text, scale=2)
    _text(pixels, width, height, 16, 30, "IMPACT", text, scale=2)
    _text(pixels, width, height, 16, 55, "MATERIALITY", text, scale=2)

    _rect(pixels, width, height, plot_left, plot_top, plot_right, plot_bottom, axis)
    for tick in range(1, 6):
        x = px(tick)
        y = py(tick)
        _line(pixels, width, height, x, plot_top, x, plot_bottom, grid)
        _line(pixels, width, height, plot_left, y, plot_right, y, grid)
        _text(pixels, width, height, x - 5, plot_bottom + 18, str(tick), text, scale=2)
        _text(pixels, width, height, plot_left - 36, y - 7, str(tick), text, scale=2)

    campaign = data["campaign"]
    tx = px(campaign.financial_threshold)
    ty = py(campaign.impact_threshold)
    for y in range(plot_top, plot_bottom, 18):
        _line(pixels, width, height, tx, y, tx, min(y + 9, plot_bottom), threshold)
    for x in range(plot_left, plot_right, 18):
        _line(pixels, width, height, x, ty, min(x + 9, plot_right), ty, threshold)

    _text(pixels, width, height, plot_left + 20, plot_top + 18, "DISCLOSURE", text, scale=2)
    _text(pixels, width, height, tx + 20, plot_top + 18, "MATERIAL", text, scale=2)
    _text(pixels, width, height, plot_left + 20, plot_bottom - 38, "WATCH", text, scale=2)
    _text(pixels, width, height, tx + 20, plot_bottom - 38, "RISK", text, scale=2)

    active_topics = [topic for topic in data["topics"] if topic["response_count"] > 0]
    for index, topic in enumerate(active_topics):
        x = px(topic["financial"])
        y = py(topic["impact"])
        color = CATEGORY_COLORS.get(topic["category"], (77, 106, 90))
        _circle(pixels, width, height, x, y, 13, color, (255, 255, 255))
        label_y = y - 34 if index % 2 else y + 20
        _text(pixels, width, height, min(x + 16, plot_right - 70), max(plot_top + 4, label_y), topic["code"], text, scale=2)

    _text(pixels, width, height, plot_left, height - 82, "E ENVIRONMENT   S SOCIAL   G GOVERNANCE", (92, 110, 100), scale=2)
    output = BytesIO(_encode_png(width, height, pixels))
    output.seek(0)
    return output
