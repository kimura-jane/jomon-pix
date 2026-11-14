#!/usr/bin/env python3
"""Audit freely reusable museum photographs for realistic haniwa/dogu stamps.

READ ONLY: The Met and Cleveland Museum of Art public CC0 catalogues.
WRITE ONLY: jomon-pix/docs/audit/museum-*. No source repositories are modified.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import quote

import requests
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "audit"
MET_OBJECT = "https://collectionapi.metmuseum.org/public/collection/v1/objects/"
MET_SEARCH = "https://collectionapi.metmuseum.org/public/collection/v1.1/search"
CMA_SEARCH = "https://openaccess-api.clevelandart.org/api/artworks/"
IDS = {
    "haniwa": [45545, 47272, 47271, 47273, 45546, 45547, 45548, 45843, 48795, 72656],
    "dogu": [53625, 45532, 45519, 44824, 45533, 45530, 45531],
}
TERMS = {
    "haniwa": ("haniwa", "clay tomb sculpture", "terracotta haniwa"),
    "dogu": ("dogu", "dogū", "clay figure Jomon"),
}
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "JOMON-pix-open-access-museum-image-audit/1.0"})


def get_json(url: str, params: dict | None = None) -> dict:
    response = SESSION.get(url, params=params, timeout=35)
    response.raise_for_status()
    return response.json()


def sources_for(category: str) -> list[dict]:
    records: list[dict] = []
    seen: set[str] = set()
    errors: list[str] = []

    def add(rec: dict) -> None:
        key = f"{rec['museum']}:{rec['id']}"
        if key not in seen:
            seen.add(key)
            records.append(rec)

    for object_id in IDS[category]:
        try:
            obj = get_json(MET_OBJECT + str(object_id))
            title = obj.get("title", "")
            photo = obj.get("primaryImageSmall") or obj.get("primaryImage")
            if obj.get("isPublicDomain") and photo:
                add({
                    "museum": "The Met", "id": object_id,
                    "title": title, "date": obj.get("objectDate", ""),
                    "source_url": obj.get("objectURL", ""),
                    "image_url": photo, "license": "CC0",
                })
            else:
                errors.append(f"Met {object_id}: no CC0 image")
        except Exception as exc:
            errors.append(f"Met {object_id}: {type(exc).__name__}: {exc}")
    for term in TERMS[category]:
        try:
            search = get_json(MET_SEARCH, {"q": term, "hasImages": "true"})
            ids = search.get("objectIDs") or search.get("results") or []
            for objid in ids[:30]:
                if isinstance(objid, dict):
                    objid = objid.get("objectID")
                if not isinstance(objid, int) or f"The Met:{objid}" in seen:
                    continue
                try:
                    obj = get_json(MET_OBJECT + str(objid))
                    title = obj.get("title", "")
                    photo = obj.get("primaryImageSmall") or obj.get("primaryImage")
                    if obj.get("isPublicDomain") and photo and (
                        category == "haniwa" and ("haniwa" in title.lower() or "clay tomb" in title.lower())
                        or category == "dogu" and ("dogū" in title.lower() or "dogu" in title.lower() or ("clay figure" in title.lower() and "japan" in str(obj.get("culture","")).lower()))
                    ):
                        add({"museum":"The Met","id":objid,"title":title,
                             "date":obj.get("objectDate",""),"source_url":obj.get("objectURL",""),
                             "image_url":photo,"license":"CC0"})
                except Exception as exc:
                    errors.append(f"Met {objid}: {type(exc).__name__}")
                if len(records) >= 24:
                    break
        except Exception as exc:
            errors.append(f"Met search {term}: {type(exc).__name__}: {exc}")
        if len(records) >= 24:
            break
    for term in TERMS[category]:
        try:
            data = get_json(CMA_SEARCH, {"q": term, "has_image":1, "limit":50, "cc0":""})
            for obj in data.get("data", []):
                title = obj.get("title", "")
                image = (obj.get("images") or {}).get("web") or {}
                url = image.get("url")
                if obj.get("share_license_status") != "CC0" or not url:
                    continue
                desc = (title + " " + str(obj.get("culture", [])) + " " + str(obj.get("creation_date", ""))).lower()
                if "japan" not in desc and "haniwa" not in desc and "dogu" not in desc and "dogū" not in desc:
                    continue
                if category == "haniwa" and not ("haniwa" in desc or "tomb figure" in desc):
                    continue
                if category == "dogu" and not ("dogu" in desc or "dogū" in desc or "jomon" in desc or "jōmon" in desc):
                    continue
                add({"museum":"Cleveland","id":obj["id"],"title":title,
                     "date":obj.get("creation_date",""),"source_url":obj.get("url",""),
                     "image_url":url,"license":"CC0"})
        except Exception as exc:
            errors.append(f"CMA search {term}: {type(exc).__name__}: {exc}")
    print(category, "records", len(records), "errors", errors[:12], flush=True)
    return records, errors


def download_photo(rec: dict) -> Image.Image:
    response = SESSION.get(rec["image_url"], timeout=55)
    response.raise_for_status()
    raw = response.content
    if len(raw) < 5000:
        raise RuntimeError("Image too small")
    return Image.open(BytesIO(raw)).convert("RGB")


def sheet(category: str, records: list[dict]) -> None:
    cols, tw, th = 5, 228, 255
    chosen = records[:25]
    board = Image.new("RGB", (cols * tw, ((len(chosen) + cols - 1)//cols) * th), (247,246,244))
    draw = ImageDraw.Draw(board)
    downloaded: list[dict] = []
    for i, rec in enumerate(chosen):
        x, y = (i % cols) * tw, (i // cols) * th
        try:
            image = download_photo(rec)
            thumb = ImageOps.contain(image, (212, 207), Image.Resampling.LANCZOS)
            board.paste(thumb, (x+(tw-thumb.width)//2, y+20+(207-thumb.height)//2))
            downloaded.append({"id":rec["id"],"title":rec["title"],"w":image.width,"h":image.height})
        except Exception as exc:
            draw.rectangle((x+7,y+20,x+221,y+226),fill=(230,215,215))
            draw.text((x+12,y+70),"IMAGE UNAVAILABLE",fill=(120,25,25))
            downloaded.append({"id":rec["id"],"error":str(exc)[:120]})
        draw.text((x+7, y+2), f"{i+1:02d}: {rec['museum']} {rec['id']}",fill=(25,25,25))
        draw.text((x+7, y+231), rec["title"][:27],fill=(25,25,25))
    board.save(OUT / f"museum-{category}-originals.jpg",quality=86,progressive=True,optimize=True)
    (OUT / f"museum-{category}-download-report.json").write_text(json.dumps(downloaded,ensure_ascii=False,indent=2)+"\n")


def main() -> None:
    OUT.mkdir(parents=True,exist_ok=True)
    for cat in ("haniwa","dogu"):
        records,errors=sources_for(cat)
        (OUT / f"museum-{cat}-sources.json").write_text(
            json.dumps({"records":records,"errors":errors},ensure_ascii=False,indent=2)+"\n"
        )
        if records:
            sheet(cat,records)
    print("Completed museum photo source audit.",flush=True)


if __name__=="__main__":
    main()
