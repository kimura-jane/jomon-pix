#!/usr/bin/env python3
"""Evaluate two public-domain Wikimedia Commons dogu photos for museum sticker set.

The original photo owners explicitly released these photographs CC0 / public domain.
No external project is edited. This creates review previews only.
"""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import json
import requests
from PIL import Image, ImageDraw, ImageOps
from rembg import new_session
from evaluate_museum_cutouts import cutout

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"docs"/"audit"
PICKS={
    "d09":{
        "url":"https://upload.wikimedia.org/wikipedia/commons/c/c3/Periodo_jomon%2C_dogu%2C_2000-1000_a.c..JPG",
        "page":"https://commons.wikimedia.org/wiki/File:Periodo_jomon,_dogu,_2000-1000_a.c..JPG",
        "license":"CC0 1.0",
        "author":"Hiart",
        "label":"装飾の多い縄文土偶",
    },
    "d10":{
        "url":"https://upload.wikimedia.org/wikipedia/commons/e/e4/Figurine_Dogu_Jomon_Mus%C3%A9e_Guimet_70608_2.jpg",
        "page":"https://commons.wikimedia.org/wiki/File:Figurine_Dogu_Jomon_Mus%C3%A9e_Guimet_70608_2.jpg",
        "license":"Public Domain",
        "author":"Vassil",
        "label":"ギメ美術館の土偶",
    }
}


def main():
    dest=OUT/"realistic-candidates"
    dest.mkdir(parents=True,exist_ok=True)
    session=new_session("u2net")
    thumbs=[]
    data={}
    for key,spec in PICKS.items():
        urls = [
            (spec["url"], None),
            ("https://images.weserv.nl/", {"url": spec["url"], "w": 1200, "q": 90}),
            ("https://wsrv.nl/", {"url": spec["url"], "w": 1200, "q": 90}),
        ]
        raw=None
        for url,params in urls:
            try:
                res=requests.get(url,params=params,headers={"User-Agent":"Mozilla/5.0 (compatible; JOMONpix-open-access-art/1.0)"},timeout=40)
                res.raise_for_status()
                if len(res.content)<10000 or not res.headers.get("Content-Type","").startswith("image/"):
                    raise RuntimeError("Non-image or short response")
                raw=res.content
                break
            except Exception as err:
                print("Source endpoint failed",key,url,type(err).__name__,str(err)[:130],flush=True)
        if raw is None:raise RuntimeError("All image delivery endpoints failed for "+key)
        photo=Image.open(BytesIO(raw)).convert("RGB")
        rendered,stats=cutout(photo,session)
        save=dest/f"dogu-{key}.webp"
        rendered.save(save,"WEBP",quality=93,method=6)
        data[key]={**spec,"bytes":save.stat().st_size,**stats}
        thumbs.append((key,rendered))
        print("Prepared",key,stats,flush=True)
    cell=245
    sheet=Image.new("RGB",(cell*2,270),(245,245,245))
    draw=ImageDraw.Draw(sheet)
    for j,(name,im) in enumerate(thumbs):
        bg=Image.new("RGB",(231,231),(223,226,230))
        bd=ImageDraw.Draw(bg)
        for x in range(0,231,21):
            for y in range(0,231,21):
                if (x//21+y//21)%2==0:bd.rectangle((x,y,x+20,y+20),fill=(197,200,204))
        thumb=ImageOps.contain(im,(231,231),Image.Resampling.LANCZOS)
        bg.paste(thumb,((231-thumb.width)//2,(231-thumb.height)//2),thumb)
        sheet.paste(bg,(j*cell+7,22))
        draw.text((j*cell+10,5),name,fill=(0,0,0))
    sheet.save(OUT/"realistic-commons-dogu-cutouts.jpg",quality=90,optimize=True)
    (OUT/"realistic-commons-dogu-sources.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":
    main()
