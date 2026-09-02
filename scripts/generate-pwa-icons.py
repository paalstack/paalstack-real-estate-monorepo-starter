#!/usr/bin/env python3
"""Generate PWA icons for the starter from a simple brand mark.

Usage: python3 scripts/generate-pwa-icons.py [--source PATH]

If --source is omitted, this script generates a generic placeholder
"house" mark on a navy background. Override --source to point at a
512x512 RGBA PNG (the user's own logo) to ship real brand assets.

Output: apps/web/public/icons/{icon-192,icon-512,maskable-512,apple-touch-180}.png

Sizes and constraints:
  - icon-192.png        192x192 RGBA   "any"      — full-bleed mark
  - icon-512.png        512x512 RGBA   "any"      — full-bleed mark
  - maskable-512.png    512x512 RGBA   "maskable" — navy frame + mark
                                              inset to the 80% safe
                                              zone per maskable.app
  - apple-touch-180.png 180x180 RGBA   "any"      — iOS home-screen
                                              icon (Apple applies
                                              its own mask)

The manifest at apps/web/public/manifest.webmanifest references these
four filenames; do not rename without updating the manifest in lockstep.

Re-run after any brand-mark update. Safe to re-run idempotently.

Requires: Pillow >= 10 (pip install --user Pillow). Not declared as a
project dependency because this is a one-shot build script, not
runtime code.

This script is intentionally a placeholder pattern: drop the user's
own brand mark in via `--source` and the rest just works. The default
"house" mark is recognizable enough to install on a home screen
without looking like a developer placeholder.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.stderr.write(
        "Pillow is required. Install with: pip install --user Pillow\n"
        "(or: python3 -m pip install --user Pillow)\n"
    )
    sys.exit(1)

# Pillow < 10 exposed LANCZOS as Image.LANCZOS; Pillow >= 10 deprecated
# that and exposes it as Image.Resampling.LANCZOS.
RESAMPLE = Image.Resampling.LANCZOS

REPO_ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = REPO_ROOT / "apps" / "web" / "public" / "icons"

# Brand tokens (mirror packages/ui-tokens/brand.css — keep in sync).
NAVY = (15, 23, 42)        # #0f172a
GREEN = (98, 177, 50)      # #62b132
CREAM = (255, 255, 255)    # used as the "house" mark on the navy bg
ALPHA_OPAQUE = 255


def make_placeholder(size: int) -> Image.Image:
    """Render a simple 'house' mark on a navy background.

    The mark is intentionally generic so the starter can install and
    ship without a real brand mark; users replace via --source once
    they have one.
    """
    img = Image.new("RGBA", (size, size), NAVY + (ALPHA_OPAQUE,))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.22)
    body_top = int(size * 0.45)
    body_bot = int(size * 0.78)
    draw.rectangle((pad, body_top, size - pad, body_bot), fill=CREAM + (ALPHA_OPAQUE,))
    roof_peak = (size // 2, int(size * 0.22))
    draw.polygon(
        [roof_peak, (pad - int(size * 0.04), body_top), (size - pad + int(size * 0.04), body_top)],
        fill=GREEN + (ALPHA_OPAQUE,),
    )
    door_w = int(size * 0.10)
    door_h = int(size * 0.16)
    door_x = (size - door_w) // 2
    door_y = body_bot - door_h
    draw.rectangle((door_x, door_y, door_x + door_w, body_bot), fill=NAVY + (ALPHA_OPAQUE,))
    return img


def make_maskable(source: Image.Image) -> Image.Image:
    """Compose the mark into a 512x512 maskable icon with the central
    80% safe zone (logo inset from each edge).
    """
    size = 512
    canvas = Image.new("RGBA", (size, size), NAVY + (ALPHA_OPAQUE,))
    inner = int(size * 0.8)
    resized = source.resize((inner, inner), RESAMPLE)
    offset = (size - inner) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate PWA icons for the starter."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Path to a 512x512 RGBA PNG to use as the brand mark. "
        "If omitted, a generic 'house' placeholder is generated.",
    )
    args = parser.parse_args()

    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    if args.source is not None:
        source_img = Image.open(args.source).convert("RGBA")
        if source_img.size != (512, 512):
            source_img = source_img.resize((512, 512), RESAMPLE)
        full = source_img
        print(f"Using brand mark from {args.source} (resized to 512x512)")
    else:
        full = make_placeholder(512)
        print("Using generic 'house' placeholder mark. "
              "Re-run with --source to ship a real brand mark.")

    full.resize((192, 192), RESAMPLE).save(ICONS_DIR / "icon-192.png", "PNG", optimize=True)
    full.resize((512, 512), RESAMPLE).save(ICONS_DIR / "icon-512.png", "PNG", optimize=True)
    make_maskable(full).save(ICONS_DIR / "maskable-512.png", "PNG", optimize=True)
    full.resize((180, 180), RESAMPLE).save(
        ICONS_DIR / "apple-touch-180.png", "PNG", optimize=True
    )

    for f in sorted(ICONS_DIR.glob("*.png")):
        print(f"  {f.name}: {f.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
