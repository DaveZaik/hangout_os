#!/usr/bin/env python3
"""Find poses that are (almost) identical, so you know which ones to regenerate.
Usage (project root):  python3 scripts/check_poses.py            (all characters)
                       python3 scripts/check_poses.py david ted  (some)
"""
import sys, glob, os
import numpy as np
from PIL import Image
PAIRS = [('walk_1','walk_2'),('run_1','run_2'),('dance1','dance2'),('dance3','dance4'),('idle','walk_1'),('idle','jump'),('walk_1','run_1')]
def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(int) if os.path.exists(p) else None
def diff(a, b):
    ua = (a[..., 3] > 0) | (b[..., 3] > 0)
    if ua.sum() == 0: return 0.0
    d = (a[..., 3] > 0) != (b[..., 3] > 0)
    d |= (np.abs(a[..., :3] - b[..., :3]).sum(axis=2) > 60) & (a[..., 3] > 0) & (b[..., 3] > 0)
    return d.sum() / ua.sum()
slugs = sys.argv[1:] or sorted(os.path.basename(d.rstrip('/')) for d in glob.glob('img/chars/*/') if not os.path.basename(d.rstrip('/')).startswith('_'))
bad = 0
for s in slugs:
    msgs = []
    for x, y in PAIRS:
        a, b = load(f'img/chars/{s}/{x}.png'), load(f'img/chars/{s}/{y}.png')
        if a is None or b is None: continue
        d = diff(a, b)
        if d < 0.06: msgs.append(f'{x} and {y} look the same ({d:.0%} different)')
    print(f'{s:9}', 'OK' if not msgs else 'REDO: ' + '; '.join(msgs)); bad += bool(msgs)
print(f'\n{bad} of {len(slugs)} characters need some poses regenerated.')
