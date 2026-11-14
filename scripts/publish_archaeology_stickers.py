#!/usr/bin/env python3
"""Publish authentic photographed archaeology stickers; preserve previous saved art.

The image candidates were audited independently; this script only promotes
visual-checked source cutouts from docs/audit/realistic-candidates/ into a
versioned folder in THIS repository. No other repository or image source is
modified, and the historic SVG designs are retained for saved artwork.
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs" / "audit"
IN_DIR = AUDIT / "realistic-candidates"
DEST = ROOT / "public" / "stickers" / "archaeology" / "v1"
SQUARE = 512

ARTIFACTS: dict[str, list[tuple[str, str]]] = {
    "haniwa": [
        ("h01", "武人埴輪・立像"),
        ("h02", "女性埴輪・結髪"),
        ("h03", "家形埴輪"),
        ("h04", "猪形埴輪・頭部"),
        ("h05", "猪の子埴輪"),
        ("h06", "武人埴輪・頭部"),
        ("h07", "女性埴輪・祭祀"),
        ("h08", "馬形埴輪"),
        ("h09", "盾形埴輪"),
        ("h10", "女性人物埴輪"),
    ],
    "dogu": [
        ("d01", "小型土偶"),
        ("d02", "遮光器土偶・模造"),
        ("d03", "土偶頭部・縄文後期"),
        ("d04", "腕を広げる土偶"),
        ("d05", "遮光器土偶・頭部"),
        ("d06", "土偶顔面・大きな眉"),
        ("d07", "土偶頭部・口開き"),
        ("d08", "女性立像土偶"),
        ("d09", "装飾土偶・縄文"),
        ("d10", "ギメ美術館の土偶"),
    ],
}


def clean_stands(im: Image.Image, kind: str, art_id: str) -> Image.Image:
    """Remove photographed museum mounting poles outside the artifact surface."""
    rgba = im.convert("RGBA")
    alpha = rgba.getchannel("A")
    dr = ImageDraw.Draw(alpha)
    if kind == "haniwa" and art_id == "h07":
        # The metal display rod starts below the torso's central bottom.
        dr.rectangle((253, 432, 311, 511), fill=0)
    if kind == "dogu" and art_id == "d02":
        # The white museum support under the clay replica's center.
        dr.rectangle((238, 348, 280, 511), fill=0)
    rgba.putalpha(alpha)
    arr=np.asarray(rgba).copy()
    arr[:,:,:3][arr[:,:,3] == 0] = 0
    return Image.fromarray(arr, "RGBA")


def image_sheet(kind: str, pictures: list[tuple[str, Image.Image]]) -> None:
    w,h,cols=243,260,5
    rows=(len(pictures)+cols-1)//cols
    result=Image.new("RGB",(w*cols,h*rows),(250,250,249))
    draw=ImageDraw.Draw(result)
    for index,(art_id,img) in enumerate(pictures):
        x,y=(index%cols)*w,(index//cols)*h
        bg=Image.new("RGB",(229,230),(236,237,239))
        grid=ImageDraw.Draw(bg)
        for xx in range(0,229,22):
            for yy in range(0,230,22):
                if (xx//22+yy//22)%2:grid.rectangle((xx,yy,xx+21,yy+21),fill=(211,213,216))
        thumb=ImageOps.contain(img,(229,230),Image.Resampling.LANCZOS)
        bg.paste(thumb,((229-thumb.width)//2,(230-thumb.height)//2),thumb)
        result.paste(bg,(x+7,y+23))
        draw.text((x+9,y+5),art_id,fill=(10,10,10))
    result.save(AUDIT/f"archaeology-final-{kind}.jpg","JPEG",quality=90,optimize=True)


def main() -> None:
    source_stats=json.loads((AUDIT/"realistic-candidate-metrics.json").read_text())
    extras=json.loads((AUDIT/"realistic-commons-dogu-sources.json").read_text())
    manifest=[]
    for kind, specs in ARTIFACTS.items():
        if len(specs)!=10:
            raise RuntimeError(f"Expected 10 {kind} stamps")
        outputs=[]
        (DEST/kind).mkdir(parents=True,exist_ok=True)
        for art_id,label in specs:
            source=IN_DIR/f"{kind}-{art_id}.webp"
            if not source.is_file():
                raise RuntimeError(f"Missing visually audited source: {source}")
            with Image.open(source) as original:
                image=clean_stands(original,kind,art_id)
            if image.size!=(SQUARE,SQUARE):
                raise RuntimeError(f"Incorrect source dimensions: {source}")
            target=DEST/kind/f"{art_id}.webp"
            image.save(target,"WEBP",quality=94,method=6)
            with Image.open(target) as check:
                if check.size != (SQUARE,SQUARE) or check.getchannel("A").getpixel((0,0))!=0:
                    raise RuntimeError(f"Invalid result: {target}")
                if sum(1 for px in check.getchannel("A").getdata() if px>210)<20000:
                    raise RuntimeError(f"Subject implausibly empty: {target}")
            if kind=="dogu" and art_id in extras:
                item=extras[art_id]
                credit={"museum":"Wikimedia Commons (photograph)", "source_url":item["page"],
                        "author":item["author"],"license":item["license"]}
            else:
                item=source_stats[art_id]
                credit={"museum":item["museum"],"source_url":item["source_url"],
                        "object_id":item["object_id"],"license":item["license"]}
            manifest.append({"id":art_id,"kind":kind,"label":label,
                             "file":str(target.relative_to(ROOT)),**credit})
            outputs.append((art_id,image))
            print(kind,art_id,label,target.stat().st_size,flush=True)
        image_sheet(kind,outputs)
    if len(manifest)!=20 or len({x["id"] for x in manifest})!=20:
        raise RuntimeError("Sticker catalog count or uniqueness mismatch")
    (AUDIT/"archaeology-sticker-source-manifest.json").write_text(
        json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Published 10 authentic haniwa plus 10 authentic dogu images",flush=True)


if __name__=="__main__":
    main()
