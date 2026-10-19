#!/usr/bin/env python3
"""Slice a 4x4 chibi sprite sheet into 16 transparent 128x128 PNGs.
Usage (from the project root):  python3 scripts/slice_chibi.py david
Input : img/chars/_sheets/<slug>.(png|jpg|jpeg|webp)   (any FLAT background colour; detected automatically)
Output: img/chars/<slug>/<pose>.png  +  img/chars/<slug>/_preview.png
Options: --grid  force an equal 4x4 grid   --size N  canvas size (default 128)   --tol N  background tolerance (default 70)
         --bg R,G,B  force the background colour   --green  same as --bg 0,255,0
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter

POSES = ['idle','walk_1','walk_2','run_1','run_2','jump','fall','getup','grabbed','sit','wave','dance1','dance2','peek','dance3','dance4']

def arg(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default

def detect_bg(a):
    """Background colour = median colour of the outer border of the sheet."""
    h, w, _ = a.shape; m = max(6, min(h, w) // 100)
    border = np.concatenate([a[:m].reshape(-1, 3), a[-m:].reshape(-1, 3), a[:, :m].reshape(-1, 3), a[:, -m:].reshape(-1, 3)])
    return np.median(border, axis=0)

def key_background(img, tol, bg=None):
    a = np.asarray(img.convert('RGB')).astype(float)
    B = np.array(bg, dtype=float) if bg is not None else detect_bg(a)
    dist = np.sqrt(((a - B) ** 2).sum(axis=2))
    alpha = np.clip((dist - tol * 0.5) / (tol * 0.7), 0, 1)           # soft edge
    al = alpha[..., None]
    fg = np.clip(np.where(al > 0.05, (a - (1 - al) * B) / np.maximum(al, 0.05), a), 0, 255)  # remove background tint from edges
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA'), B, float((alpha < 0.5).mean())

def clean_mask(alpha):
    """Binary mask with thin lines (cell borders, grid lines, JPEG specks) removed by a morphological opening."""
    h, w = alpha.shape
    k = max(5, (w // 160) | 1)                      # odd kernel, ~13px on a 2048px sheet
    m = Image.fromarray(((alpha > 128) * 255).astype(np.uint8))
    opened = m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    keep = opened.filter(ImageFilter.MaxFilter(k + 6))  # slightly fatter so figure edges survive
    return np.asarray(opened) > 128, np.asarray(keep) > 128

def bands(mask_1d, min_gap=3, min_len=8):
    """Split a 1D boolean profile into [start, end) runs separated by gaps."""
    idx = np.where(mask_1d)[0]
    if idx.size == 0: return []
    runs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > min_gap: runs.append((s, p + 1)); s = i
        p = i
    runs.append((s, p + 1))
    return [r for r in runs if r[1] - r[0] >= min_len]

def find_cells(solid, force_grid):
    h, w = solid.shape
    if not force_grid:
        rows = bands(solid.sum(axis=1) > 2)
        if len(rows) == 4:
            cells = []
            for (y0, y1) in rows:
                cols = bands(solid[y0:y1].sum(axis=0) > 2)
                if len(cols) != 4: cells = None; break
                cells += [(x0, y0, x1, y1) for (x0, x1) in cols]
            if cells: return cells, 'auto-detected figures'
    cw, ch = w // 4, h // 4
    return [(c * cw, r * ch, (c + 1) * cw, (r + 1) * ch) for r in range(4) for c in range(4)], 'equal 4x4 grid'

def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith('--'):
        sys.exit(__doc__)
    slug, size, tol, force = sys.argv[1], arg('--size', 128), arg('--tol', 70), '--grid' in sys.argv
    found = [p for ext in ('png','jpg','jpeg','webp') for p in glob.glob(f'img/chars/_sheets/{slug}.{ext}')]
    if not found: sys.exit(f'Sheet not found: img/chars/_sheets/{slug}.png (or .jpg/.webp). Run from the project root.')
    bg = None
    if '--green' in sys.argv: bg = (0, 255, 0)
    if '--bg' in sys.argv: bg = tuple(int(v) for v in sys.argv[sys.argv.index('--bg') + 1].split(','))
    img, B, clear = key_background(Image.open(found[0]), tol, bg)
    print(f'background colour {tuple(int(v) for v in B)}, {clear:.0%} of the sheet made transparent')
    if clear < 0.25: print('  WARNING: background was NOT removed properly (the sheet is not a flat colour). Regenerate it on a flat magenta/green background.')
    alpha = np.asarray(img)[..., 3]
    solid, keep = clean_mask(alpha)
    arr = np.asarray(img).copy(); arr[..., 3] = np.where(keep, arr[..., 3], 0)   # erase grid lines / specks
    img = Image.fromarray(arr, 'RGBA')
    os.makedirs(f'img/chars/{slug}', exist_ok=True)
    Image.fromarray((solid * 255).astype(np.uint8)).save(f'img/chars/{slug}/_mask.png')  # debug: white = what was kept
    cells, how = find_cells(solid, force)
    print(f'{found[0]} -> {how}, {len(cells)} figures')
    figs = []
    for (x0, y0, x1, y1) in cells:
        crop = img.crop((x0, y0, x1, y1)); bb = crop.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        figs.append(crop.crop(bb) if bb else None)
    ref = figs[0]
    if ref is None: sys.exit('Idle pose is empty - check the sheet / try --tol 100')
    scale = (size * 0.80) / ref.height            # ONE scale for the whole character
    out = f'img/chars/{slug}'; os.makedirs(out, exist_ok=True)
    prev = Image.new('RGBA', (size * 16, size), (120, 120, 130, 255))
    for i, (pose, f) in enumerate(zip(POSES, figs)):
        if f is None: print(f'  MISSING {pose}'); continue
        s = min(scale, (size - 8) / f.width, (size - 8) / f.height)   # never overflow the canvas
        nw, nh = max(1, round(f.width * s)), max(1, round(f.height * s))
        small = f.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')  # premultiplied: no pink halo
        a = small.getchannel('A').point(lambda v: 255 if v > 110 else 0)           # crisp edge
        small.putalpha(a)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.paste(small, ((size - nw) // 2, size - 8 - nh), small)                # feet on baseline
        canvas.save(f'{out}/{pose}.png'); prev.paste(canvas, (i * size, 0), canvas)
        print(f'  ok {pose}.png ({nw}x{nh})')
    prev.save(f'{out}/_preview.png')
    print(f'\nDone. Look at {out}/_preview.png to check all poses line up.')
if __name__ == '__main__': main()
