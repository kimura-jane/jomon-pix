#!/usr/bin/env python3
"""Generate transparent TAF DOG sticker assets for JOMON pix.

READ ONLY: original images from kimura-jane/inu.
WRITE ONLY: jomon-pix/public/stickers/taf-dog/taf_dog_XX.webp.
No modifications are made to the source NFT repository.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import urllib.request

from PIL import Image
from rembg import new_session, remove

# Pin the source repository to a known commit for reproducible outputs.
SOURCE_COMMIT = "1cdcd7d35a0d2657be95b40d049bab11d4538229"
BASE_URL = (
    "https://raw.githubusercontent.com/kimura-jane/inu/"
    + SOURCE_COMMIT + "/"
)
DESTINATION = (
    Path(__file__).resolve().parents[1] / "public" / "stickers" / "taf-dog"
)
DOG_IDS = range(1, 21)
SIZE = 512
PADDING = 22


def download_png(number: int) -> bytes:
    filename = f"taf_dog_{number:02d}.png"
    request = urllib.request.Request(
        BASE_URL + filename,
        headers={"User-Agent": "JOMON-pix-asset-generator/1.0"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()
    if len(data) < 1000 or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Unexpected or invalid source PNG: {filename}")
    return data


def make_sticker(original: bytes, session) -> Image.Image:
    foreground_bytes = remove(
        original,
        session=session,
        alpha_matting=False,
        post_process_mask=False,
    )
    image = Image.open(BytesIO(foreground_bytes)).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Segmentation returned no visible subject")

    # Avoid uploading a full, opaque NFT background accidentally.
    extrema = alpha.getextrema()
    if extrema[0] >= 250:
        raise RuntimeError("No transparent background detected in output")

    subject = image.crop(bbox)
    if subject.width < 25 or subject.height < 25:
        raise RuntimeError("Segmentation produced implausibly small subject")

    maximum = SIZE - PADDING * 2
    ratio = min(maximum / subject.width, maximum / subject.height)
    dims = (
        max(1, round(subject.width * ratio)),
        max(1, round(subject.height * ratio)),
    )
    subject = subject.resize(dims, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(
        subject,
        ((SIZE - dims[0]) // 2, (SIZE - dims[1]) // 2),
    )
    return canvas


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    print("Loading illustration segmentation model (isnet-anime)")
    session = new_session("isnet-anime")
    processed = []

    # Fail on any missing/invalid image. The workflow must not commit a
    # mixed set of transparent dogs and unprocessed background images.
    for number in DOG_IDS:
        source = download_png(number)
        sticker = make_sticker(source, session)
        output = DESTINATION / f"taf_dog_{number:02d}.webp"
        sticker.save(output, format="WEBP", quality=91, method=6)
        # Verify actual alpha after encoding.
        with Image.open(output) as check:
            if check.mode not in ("RGBA", "LA") or check.getchannel("A").getextrema()[0] >= 250:
                raise RuntimeError(f"Background is not transparent: {output.name}")
        processed.append(output)
        print(f"{output.name}: {output.stat().st_size:,} bytes")

    print(f"Generated {len(processed)} transparent NFT dog stickers in {DESTINATION}")


if __name__ == "__main__":
    main()
