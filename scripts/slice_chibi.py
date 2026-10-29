#!/usr/bin/env python3
"""Slice a chibi sprite sheet into transparent 128x128 PNGs.
Usage (from the project root):
  python3 scripts/slice_chibi.py david                      full 4x4 sheet -> all 16 poses
Input : img/chars/_sheets/<slug>.(png|jpg|jpeg|webp)   (any FLAT background colour, detected automatically)
Output: img/chars/<slug>/<pose>.png  +  _preview.png  +  _mask.png
Options: --grid  force equal cells    --size N  canvas size (default 128)    --tol N  background tolerance (default 70)
         --bg R,G,B  force background colour   --green  same as --bg 0,255,0
         --cols C --rows R --poses a,b,c   custom sheet layout (first pose must be idle so sizes match)
Small re-do sheet: a 3x2 sheet with poses idle,walk_1,walk_2,run_1,run_2 (5 figures, last cell empty):
  save as img/chars/_sheets/<slug>_walk.png, run:  python3 scripts/slice_chibi.py <slug>_walk --out <slug> --cols 3 --rows 2 --poses idle,walk_1,walk_2,run_1,run_2 --skip-idle
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter

POSES = ['idle','walk_1','walk_2','run_1','run_2','jump','fall','getup','grabbed','sit','wave','dance1','dance2','peek','dance3','dance4']

def opt(name, default, cast=int):
    return cast(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default

def detect_bg(a):
    h, w, _ = a.shape; m = max(6, min(h, w) // 100)
    border = np.concatenate([a[:m].reshape(-1, 3), a[-m:].reshape(-1, 3), a[:, :m].reshape(-1, 3), a[:, -m:].reshape(-1, 3)])
    return np.median(border, axis=0)

def key_background(img, tol, bg=None):
    a = np.asarray(img.convert('RGB')).astype(float)
    B = np.array(bg, dtype=float) if bg is not None else detect_bg(a)
    dist = np.sqrt(((a - B) ** 2).sum(axis=2))
    alpha = np.clip((dist - tol * 0.5) / (tol * 0.7), 0, 1)
    al = alpha[..., None]
    fg = np.clip(np.where(al > 0.05, (a - (1 - al) * B) / np.maximum(al, 0.05), a), 0, 255)
    return Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), 'RGBA'), B, float((alpha < 0.5).mean())

def clean_mask(alpha):
    h, w = alpha.shape
    k = max(5, (w // 160) | 1)
    m = Image.fromarray(((alpha > 128) * 255).astype(np.uint8))
    opened = m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    keep = opened.filter(ImageFilter.MaxFilter(k + 6))
    return np.asarray(opened) > 128, np.asarray(keep) > 128

def bands(mask_1d, min_gap=3, min_len=8):
    idx = np.where(mask_1d)[0]
    if idx.size == 0: return []
    runs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > min_gap: runs.append((s, p + 1)); s = i
        p = i
    runs.append((s, p + 1))
    return [r for r in runs if r[1] - r[0] >= min_len]

def find_cells(solid, cols, rows, n, force):
    h, w = solid.shape
    if not force:
        rb = bands(solid.sum(axis=1) > 2)
        if len(rb) == rows:
            cells = []
            for (y0, y1) in rb:
                cb = bands(solid[y0:y1].sum(axis=0) > 2)
                if len(cb) > cols: cells = None; break
                cells += [(x0, y0, x1, y1) for (x0, x1) in cb]
            if cells and len(cells) == n: return cells, 'auto-detected figures'
    cw, ch = w // cols, h // rows
    return [(c * cw, r * ch, (c + 1) * cw, (r + 1) * ch) for r in range(rows) for c in range(cols)][:n], f'equal {cols}x{rows} grid'

def defringe(canvas, B, tol):
    """Remove leftover background-coloured edge pixels (the pink/magenta outline)."""
    a = np.asarray(canvas).astype(int).copy()
    alpha = a[..., 3]
    solid = Image.fromarray(((alpha > 0) * 255).astype(np.uint8))
    inner = np.asarray(solid.filter(ImageFilter.MinFilter(5))) > 0          # at least 2px away from transparent
    band = (alpha > 0) & ~inner                                              # the outer 2px ring
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dist = np.sqrt((r - B[0]) ** 2 + (g - B[1]) ** 2 + (b - B[2]) ** 2)
    kill = band & (dist < tol * 2.6)                                         # looks like background -> transparent
    if B[0] > 150 and B[2] > 150 and B[1] < 140:                             # magenta screen: also neutralise pink tint
        spill = np.maximum(0, np.minimum(r, b) - g)
        pinkish = band & ~kill & (spill > 35)
        kill |= pinkish & (spill > 110)
        fix = pinkish & ~kill
        a[..., 0] = np.where(fix, r - spill * 0.95, r); a[..., 2] = np.where(fix, b - spill * 0.95, b)
    a[..., 3] = np.where(kill, 0, alpha)
    a = np.clip(a, 0, 255).astype(np.uint8)
    out = Image.fromarray(a, 'RGBA')
    if '--erode' in sys.argv:
        al = out.getchannel('A').filter(ImageFilter.MinFilter(3)); out.putalpha(al)
    return out

def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith('--'): sys.exit(__doc__)
    slug = sys.argv[1]; outslug = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else slug
    size, tol, force = opt('--size', 128), opt('--tol', 70), '--grid' in sys.argv
    cols, rows = opt('--cols', 4), opt('--rows', 4)
    poses = sys.argv[sys.argv.index('--poses') + 1].split(',') if '--poses' in sys.argv else POSES
    found = [p for ext in ('png','jpg','jpeg','webp') for p in glob.glob(f'img/chars/_sheets/{slug}.{ext}')]
    if not found: sys.exit(f'Sheet not found: img/chars/_sheets/{slug}.png (or .jpg/.jpeg/.webp). Run from the project root.')
    bg = (0, 255, 0) if '--green' in sys.argv else None
    if '--bg' in sys.argv: bg = tuple(int(v) for v in sys.argv[sys.argv.index('--bg') + 1].split(','))
    img, B, clear = key_background(Image.open(found[0]), tol, bg)
    print(f'background colour {tuple(int(v) for v in B)}, {clear:.0%} of the sheet made transparent')
    if clear < 0.25: print('  WARNING: background was NOT removed properly (the sheet is not a flat colour). Regenerate it on a flat magenta/green background.')
    alpha = np.asarray(img)[..., 3]
    solid, keep = clean_mask(alpha)
    arr = np.asarray(img).copy(); arr[..., 3] = np.where(keep, arr[..., 3], 0)
    img = Image.fromarray(arr, 'RGBA')
    out = f'img/chars/{outslug}'; os.makedirs(out, exist_ok=True)
    Image.fromarray((solid * 255).astype(np.uint8)).save(f'{out}/_mask.png' if outslug == slug else f'{out}/_mask_{slug}.png')
    cells, how = find_cells(solid, cols, rows, len(poses), force)
    print(f'{found[0]} -> {how}, {len(cells)} figures')
    figs = []
    for (x0, y0, x1, y1) in cells:
        crop = img.crop((x0, y0, x1, y1)); bb = crop.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        figs.append(crop.crop(bb) if bb else None)
    ref = figs[0]
    if ref is None: sys.exit('First (idle) pose is empty - check the sheet / try --tol 100')
    scale = (size * 0.80) / ref.height
    prev = Image.new('RGBA', (size * len(poses), size), (120, 120, 130, 255))
    for i, (pose, f) in enumerate(zip(poses, figs)):
        if f is None: print(f'  MISSING {pose}'); continue
        s = min(scale, (size - 8) / f.width, (size - 8) / f.height)
        nw, nh = max(1, round(f.width * s)), max(1, round(f.height * s))
        small = f.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
        small.putalpha(small.getchannel('A').point(lambda v: 255 if v > 110 else 0))
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.paste(small, ((size - nw) // 2, size - 8 - nh), small)
        canvas = defringe(canvas, B, tol)
        if not (pose == 'idle' and '--skip-idle' in sys.argv): canvas.save(f'{out}/{pose}.png')
        prev.paste(canvas, (i * size, 0), canvas)
        print(f'  ok {pose}.png ({nw}x{nh})' + ('  (idle used only for sizing)' if pose == 'idle' and '--skip-idle' in sys.argv else ''))
    if outslug == slug: prev.save(f'{out}/_preview.png')
    print(f'\nDone. Look at {out}/_preview.png to check the poses.')
if __name__ == '__main__': main()
