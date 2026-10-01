# -*- coding: utf-8 -*-
"""
Prepare the London Airbnb visualisation payload.

Reads  : London_Airbnb_Datawrapper_Ready_FINAL.xlsx
         tools/cache/london_boroughs.geojson   (ONS, downloaded once)
Writes : src/generated/data.js   - tidy data + pre-projected SVG geometry
"""
import json
import math
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "London_Airbnb_Datawrapper_Ready_FINAL.xlsx")
DEMO = os.path.join(ROOT, "London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx")
CACHE = os.path.join(ROOT, "tools", "cache")
GEOJSON = os.path.join(CACHE, "london_boroughs.geojson")
OUT = os.path.join(ROOT, "src", "generated", "data.js")

GEO_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0/query"
    "?where=LAD24CD+LIKE+%27E0900%25%27&outFields=LAD24CD%2CLAD24NM"
    "&f=geojson&outSR=4326"
)

YEARS = [2015, 2019, 2026]
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# ---------------------------------------------------------------- xlsx ------

def colnum(ref):
    letters = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def read_sheet(zf, name):
    root = ET.fromstring(zf.read("xl/worksheets/" + name))
    rows = []
    for r in root.iter(M + "row"):
        row = {}
        for c in r.iter(M + "c"):
            v = c.find(M + "v")
            inline = c.find(M + "is")
            if inline is not None:
                val = "".join(t.text or "" for t in inline.iter(M + "t"))
            elif v is not None:
                val = v.text
                if c.attrib.get("t") in (None, "n"):
                    try:
                        val = float(val)
                    except ValueError:
                        pass
            else:
                val = None
            row[colnum(c.attrib["r"])] = val
        if row:
            rows.append(row)
    head, body = rows[0], rows[1:]
    return [{head[k]: r.get(k) for k in sorted(head)} for r in body]


def load_data():
    zf = zipfile.ZipFile(XLSX)
    wide = read_sheet(zf, "sheet3.xml")     # one row per borough
    long_ = read_sheet(zf, "sheet2.xml")    # one row per borough x snapshot
    return wide, long_


# ----------------------------------------------------------- demography -----

DEMO_COLUMNS = [
    ("pop2025", "Population 2025", 0),
    ("density", "Density 2025", 0),
    ("medianAge", "Median age 2025", 1),
    ("popGrowth", "Population growth 2024", 4),
    ("noQual", "No qualifications share", 4),
    ("level4", "Level 4+ share", 4),
    ("ukBorn", "UK-born share", 4),
    ("nonUkBorn", "Non-UK-born share", 4),
    ("africaBorn", "Africa-born share", 4),
    ("asiaBorn", "Middle East & Asia-born share", 4),
    ("americasBorn", "Americas & Caribbean-born share", 4),
    ("earnings", "Median gross weekly earnings 2024", 1),
]


def load_demography():
    """Borough_Profile aus dem Demographie-Workbook, verknüpft über Area Code."""
    if not os.path.exists(DEMO):
        return {}, None
    zf = zipfile.ZipFile(DEMO)
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    names = [s.attrib["name"] for s in wb.iter(M + "sheet")]
    if "Borough_Profile" not in names:
        return {}, None
    idx = names.index("Borough_Profile") + 1
    rows = read_sheet(zf, "sheet%d.xml" % idx)
    if not rows:
        return {}, None

    # read_sheet liefert bereits Datensätze, deren Schlüssel die Kopfzeile sind.
    def pick(rec, prefix):
        for k in rec:
            if str(k).startswith(prefix):
                return rec[k]
        return None

    def num(v, nd):
        if v is None or v == "":
            return None
        try:
            return round(float(v), nd)
        except (TypeError, ValueError):
            return None

    out, sources = {}, set()
    for rec in rows:
        code = pick(rec, "Area Code")
        if not isinstance(code, str) or not code.startswith("E09"):
            continue
        row = {}
        for key, prefix, nd in DEMO_COLUMNS:
            row[key] = num(pick(rec, prefix), nd)
        out[code] = row
        for v in rec.values():
            if isinstance(v, str) and v.startswith("http"):
                sources.add(v)
    return out, sorted(sources)


# ----------------------------------------------------------------- geo ------

def fetch_geo():
    os.makedirs(CACHE, exist_ok=True)
    if not os.path.exists(GEOJSON):
        with urllib.request.urlopen(GEO_URL, timeout=180) as r:
            raw = r.read()
        with open(GEOJSON, "wb") as fh:
            fh.write(raw)
    with open(GEOJSON, "r", encoding="utf-8") as fh:
        return json.load(fh)


def mercator(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def rdp(points, eps):
    """Ramer-Douglas-Peucker on projected tuples."""
    if len(points) < 3:
        return list(points)
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    den = math.hypot(dx, dy)
    idx, best = -1, eps
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if den == 0:
            dist = math.hypot(px - x1, py - y1)
        else:
            dist = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / den
        if dist > best:
            idx, best = i, dist
    if idx < 0:
        return [points[0], points[-1]]
    return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)


def rings_of(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    out = []
    for poly in geometry["coordinates"]:
        out.append(poly[0])
    return out


def build_geo(features, width=1000, eps=0.35, min_area=1.2):
    pts = []
    for f in features:
        for ring in rings_of(f["geometry"]):
            for lon, lat in ring:
                pts.append(mercator(lon, lat))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = width / (x1 - x0)
    height = (y1 - y0) * scale

    paths, centroids, areas = {}, {}, {}
    for f in features:
        code = f["properties"]["LAD24CD"]
        pieces, anchors = [], []
        total_area = 0.0
        for ring in rings_of(f["geometry"]):
            proj = []
            for lon, lat in ring:
                mx, my = mercator(lon, lat)
                proj.append(((mx - x0) * scale, (y1 - my) * scale))
            # drop slivers / tiny islands
            rxs = [p[0] for p in proj]
            rys = [p[1] for p in proj]
            if (max(rxs) - min(rxs)) * (max(rys) - min(rys)) < min_area:
                continue
            simple = rdp(proj, eps)
            if len(simple) < 4:
                continue
            # shoelace area -> anchor for the bubble layer, weighted by size
            area = 0.0
            cx = cy = 0.0
            for i in range(len(simple) - 1):
                ax, ay = simple[i]
                bx, by = simple[i + 1]
                cross = ax * by - bx * ay
                area += cross
                cx += (ax + bx) * cross
                cy += (ay + by) * cross
            area *= 0.5
            total_area += abs(area)
            if area != 0:
                anchors.append((abs(area), cx / (6 * area), cy / (6 * area)))
            pieces.append(
                "M" + "L".join(
                    "%.1f %.1f" % (round(px, 1), round(py, 1)) for px, py in simple
                ) + "Z"
            )
        paths[code] = "".join(pieces)
        areas[code] = round(total_area, 1)
        if anchors:
            anchors.sort(reverse=True)
            centroids[code] = [round(anchors[0][1], 2), round(anchors[0][2], 2)]
    return {
        "width": width,
        "height": round(height, 1),
        "paths": paths,
        "areas": areas,
        "centroids": centroids,
        "source": "ONS Open Geography Portal, Local Authority Districts (May 2024), "
                  "generalised & clipped, Open Government Licence v3.0",
    }


# ---------------------------------------------------------------- main ------

def main():
    wide, long_ = load_data()
    demo, demoSources = load_demography()
    geo = build_geo(fetch_geo()["features"])

    def num(v):
        return 0.0 if v is None else float(v)

    boroughs = []
    for row in wide:
        code = row["Area Code"]
        boroughs.append({
            "code": code,
            "name": row["Borough"],
            "short": (row["Borough"]
                      .replace("Barking and Dagenham", "Barking & Dagenham")
                      .replace("Hammersmith and Fulham", "Hammersmith & Fulham")
                      .replace("Kensington and Chelsea", "Kensington & Chelsea")
                      .replace("Kingston upon Thames", "Kingston upon Thames")
                      .replace("Richmond upon Thames", "Richmond upon Thames")),
            "lat": round(num(row["Latitude"]), 5),
            "lon": round(num(row["Longitude"]), 5),
            "xy": geo["centroids"].get(code),
            "listings": {
                "2015": int(num(row["Airbnb Listings 2015"])),
                "2019": int(num(row["Airbnb Listings 2019"])),
                "2026": int(num(row["Airbnb Listings Current"])),
            },
            "per1k": {
                "2015": round(num(row["Listings/1,000 2015"]), 3),
                "2019": round(num(row["Listings/1,000 2019"]), 3),
                "2026": round(num(row["Listings/1,000 Current"]), 3),
            },
            "pop": {
                "2015": int(num(row["Population 2015"])),
                "2019": int(num(row["Population 2019"])),
                "2026": int(num(row["Population Reference Current (2025)"])),
            },
            "demo": demo.get(code),
        })

    missing = [b["code"] for b in boroughs if not geo["paths"].get(b["code"])]
    if missing:
        raise SystemExit("missing geometry for: %s" % missing)
    missing_xy = [b["name"] for b in boroughs if not b["xy"]]
    if missing_xy:
        raise SystemExit("missing centroid for: %s" % missing_xy)

    # sanity: long sheet must agree with the wide sheet
    grid = {}
    for row in long_:
        key = (row["Area Code"], int(num(row["Year"])))
        grid[key] = int(num(row["Airbnb Listings"]))
    for b in boroughs:
        for y in YEARS:
            got = grid.get((b["code"], y))
            want = b["listings"][str(y)]
            if got != want:
                raise SystemExit("%s %s: long=%s wide=%s" % (b["name"], y, got, want))

    notes = sorted({r["Data Note"] for r in long_})
    sources = sorted({r["Source"] for r in long_})

    payload = {
        "meta": {
            "title": "Airbnb in London",
            "subtitle": "Angebotene Unterkünfte in den 33 Bezirken von Greater London",
            "years": YEARS,
            "snapshots": {"2015": "Apr 2015", "2019": "May 2019", "2026": "19 Jun 2026"},
            "snapshotLong": {"2015": "April 2015", "2019": "Mai 2019", "2026": "19. Juni 2026"},
            "unitListings": "Inserate",
            "unitPer1k": "Inserate je 1.000 Einwohner:innen",
            "sources": sources,
            "notes": notes,
            "demoSources": demoSources,
            "demoAvailable": bool(demo),
            "demoNote": "Bevölkerung und Strukturmerkmale: ONS Mid-Year Population Estimates 2025, "
                        "Census 2021 (TS067, TS012), ONS ASHE. Verknüpfung über Area Code.",
            "geoSource": geo["source"],
            "generated": "2026",
        },
        "boroughs": sorted(boroughs, key=lambda b: b["name"]),
        "geo": {"width": geo["width"], "height": geo["height"], "paths": geo["paths"],
                "areas": geo["areas"]},
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("/* generated by tools/prepare_data.py - do not edit */\n")
        fh.write("window.LONDON_AIRBNB = ")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    tot = {str(y): sum(b["listings"][str(y)] for b in boroughs) for y in YEARS}
    print("boroughs : %d" % len(boroughs))
    print("totals   : %s" % tot)
    print("geo      : %d paths, viewBox %sx%s" % (len(geo["paths"]), geo["width"], geo["height"]))
    print("out      : %s (%.1f KB)" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
