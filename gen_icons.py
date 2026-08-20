#!/usr/bin/env python3
# 纯标准库生成 PWA 图标（无第三方依赖）
import zlib, struct, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

def make_png(path, size, draw):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0
        for x in range(size):
            raw += bytes(draw(x, y, size))
    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA
    sig = b"\x89PNG\r\n\x1a\n"
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b""))

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

DARK = (17, 20, 24, 255)
WHITE = (245, 246, 248, 255)
ACCENT = (120, 130, 145, 255)  # 浅灰（楼体/窗）

def building_pattern(x, y, size, safe):
    """画三栋高低写字楼剪影 + 窗户点阵，安全边距内绘制。"""
    if safe > 0:
        m = int(size * safe)
        if x < m or x >= size - m or y < m or y >= size - m:
            return DARK
    # 坐标归一化到内容区
    lo, hi = (int(size * safe), int(size * (1 - safe))) if safe > 0 else (0, size)
    cx0 = lo
    cx1 = hi
    W = cx1 - cx0
    # 三栋楼
    # 楼定义：(左比例, 右比例, 顶比例 from center-bottom)
    base_y = size - int(size * 0.14)  # 楼底
    buildings = [
        (0.08, 0.36, 0.40),
        (0.40, 0.62, 0.62),
        (0.66, 0.92, 0.30),
    ]
    # 楼底统一在 base_y，顶 = base_y - height
    for (l, r, h) in buildings:
        bx0 = int(cx0 + W * l)
        bx1 = int(cx0 + W * r)
        top = int(base_y - size * h)
        if bx0 <= x < bx1 and top <= y <= base_y:
            # 窗户点阵
            cell = max(6, int(size * 0.028))
            wx = (x - bx0) % cell
            wy = (y - top) % cell
            if wx in (1, 2, 3) and wy in (1, 2, 3):
                return ACCENT
            # 楼边缘描白
            if x - bx0 < 2 or bx1 - x <= 2 or y - top < 2 or base_y - y < 2:
                return WHITE
            return WHITE
    return DARK

# 普通图标（满铺）
make_png(os.path.join(OUT, "icon-192.png"), 192,
         lambda x, y, s: building_pattern(x, y, s, 0.0))
make_png(os.path.join(OUT, "icon-512.png"), 512,
         lambda x, y, s: building_pattern(x, y, s, 0.0))
make_png(os.path.join(OUT, "apple-touch-icon.png"), 180,
         lambda x, y, s: building_pattern(x, y, s, 0.0))
# maskable 图标（留 10% 安全边）
make_png(os.path.join(OUT, "icon-maskable-512.png"), 512,
         lambda x, y, s: building_pattern(x, y, s, 0.10))

print("icons generated:", os.listdir(OUT))
