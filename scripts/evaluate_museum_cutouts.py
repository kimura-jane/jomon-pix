#!/usr/bin/env python3
"""Non-destructive visual audit of authentic CC0 museum haniwa/dogu cutouts.

Inputs: vetted CC0 image links in docs/audit/museum-*-sources.json.
Outputs: only docs/audit/realistic-candidates/ (not in public app).
Photos are not repainted or invented; original artifact RGB is preserved.
"""
from __future__ import annotations

from io import BytesIO
import json
from pathlib import Path
import requests
import numpy as np
from scipy.ndimage import label, binary_fill_holes
from PIL import Image, ImageDraw, ImageOps, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs" / "audit"
DEST = AUDIT / "realistic-candidates"
SIZE = 512
PAD = 18
PICKS = {
    "haniwa": [
        ("h01", "The Met", 45545),     # standing warrior
        ("h02", "The Met", 47272),     # female elaborate coiffure
        ("h03", "The Met", 45843),     # house
        ("h04", "The Met", 62462),     # boar head
        ("h05", "The Met", 44834),     # piglet
        ("h06", "The Met", 44833),     # warrior head
        ("h07", "The Met", 53156),     # shrine attendant
        ("h08", "Cleveland", 134753),  # horse
        ("h09", "Cleveland", 160882),  # shield
        ("h10", "Cleveland", 138495),  # female
        ("h11", "The Met", 44832),     # pottery figurine head
        ("h12", "The Met", 45548),     # male head
    ],
    "dogu": [
        ("d01", "The Met", 53625),
        ("d02", "The Met", 45532),
        ("d03", "The Met", 45519),
        ("d04", "The Met", 44824),
        ("d05", "The Met", 45533),
        ("d06", "The Met", 45530),
        ("d07", "The Met", 45531),
        ("d08", "The Met", 44822),
    ],
}
HTTP = requests.Session()
HTTP.headers.update({"User-Agent":"JOMON-pix-museum-stamp-cutout-audit/1.0"})


def fetch_artwork(url: str) -> Image.Image:
    res = HTTP.get(url,timeout=55)
    res.raise_for_status()
    if len(res.content)<10000:
        raise RuntimeError("Image response too short")
    return Image.open(BytesIO(res.content)).convert("RGB")


def cutout(photo: Image.Image, session) -> tuple[Image.Image, dict]:
    rgb = photo.copy()
    rgb.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    buf=BytesIO()
    rgb.save(buf,"PNG")
    mask_raw=remove(buf.getvalue(),session=session,only_mask=True,alpha_matting=False,post_process_mask=False)
    mask=Image.open(BytesIO(mask_raw)).convert("L")
    alpha=np.array(mask)>60
    components,count=label(alpha,np.ones((3,3),dtype=np.uint8))
    lengths=np.bincount(components.ravel())
    lengths[0]=0
    if count<1:
        raise RuntimeError("No object mask")
    big=components==np.argmax(lengths)
    big=binary_fill_holes(big)
    if big.mean()<0.025:
        raise RuntimeError("Foreground too small")
    alpha_image=Image.fromarray(np.uint8(big)*255,"L").filter(ImageFilter.GaussianBlur(0.7))
    fg=rgb.convert("RGBA")
    fg.putalpha(alpha_image)
    bbox=alpha_image.getbbox()
    if not bbox:
        raise RuntimeError("No bounds")
    fg=fg.crop(bbox)
    target=SIZE-2*PAD
    fg.thumbnail((target,target),Image.Resampling.LANCZOS)
    canvas=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
    canvas.alpha_composite(fg,((SIZE-fg.width)//2,(SIZE-fg.height)//2))
    a=np.asarray(canvas.getchannel("A"))
    corners=(int(a[0,0]),int(a[0,-1]),int(a[-1,0]),int(a[-1,-1]))
    return canvas,{"foreground_fraction":round(float(np.mean(a>200)),3),"bounding_box":bbox,"source_size":list(rgb.size),"output_size":[fg.width,fg.height],"corners":list(corners)}


def make_sheet(kind: str, items: list[tuple[str,str,Image.Image]]) -> None:
    tw,th,cols=245,257,4
    rows=(len(items)+cols-1)//cols
    board=Image.new("RGB",(tw*cols,th*rows),(247,246,244))
    d=ImageDraw.Draw(board)
    for idx,(key,title,photo) in enumerate(items):
        ox,oy=(idx%cols)*tw,(idx//cols)*th
        ck=Image.new("RGB",(228,218),(233,235,237))
        dc=ImageDraw.Draw(ck)
        for x in range(0,228,18):
            for y in range(0,218,18):
                if (x//18+y//18)%2:dc.rectangle((x,y,x+17,y+17),fill=(207,210,213))
        small=ImageOps.contain(photo,(228,218),Image.Resampling.LANCZOS)
        ck.paste(small,((228-small.width)//2,(218-small.height)//2),small)
        board.paste(ck,(ox+8,oy+22))
        d.text((ox+9,oy+4),key,fill=(0,0,0))
        d.text((ox+8,oy+242),title[:30],fill=(25,25,25))
    board.save(AUDIT/f"realistic-{kind}-cutouts.jpg","JPEG",quality=88,optimize=True,progressive=True)


def main():
    DEST.mkdir(parents=True,exist_ok=True)
    session=new_session("u2net")
    report={}
    for kind in ("haniwa","dogu"):
        catalog=json.loads((AUDIT/f"museum-{kind}-sources.json").read_text())["records"]
        index={(x["museum"],x["id"]):x for x in catalog}
        ready=[]
        for local_id,museum,source_id in PICKS[kind]:
            candidate=index[(museum,source_id)]
            try:
                source=fetch_artwork(candidate["image_url"])
                rendered,metrics=cutout(source,session)
                out=DEST/f"{kind}-{local_id}.webp"
                rendered.save(out,format="WEBP",quality=91,method=6)
                ready.append((local_id,candidate["title"],rendered))
                report[local_id]={"museum":museum,"object_id":source_id,"title":candidate["title"],"source_url":candidate["source_url"],"image_url":candidate["image_url"],"license":candidate["license"],"file":out.name,**metrics,"bytes":out.stat().st_size}
                print(local_id,metrics,"bytes",out.stat().st_size,flush=True)
            except Exception as exc:
                report[local_id]={"error":type(exc).__name__+" "+str(exc)}
                print("FAILED",local_id,repr(exc),flush=True)
        if ready:make_sheet(kind,ready)
    (AUDIT/"realistic-candidate-metrics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    good=sum("error" not in x for x in report.values())
    print("Candidate photos screened:",good,"/",len(report),flush=True)
    if good<10:
        raise RuntimeError("Too few museum assets could be segmented")


if __name__=="__main__":
    main()
