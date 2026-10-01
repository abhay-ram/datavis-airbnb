# -*- coding: utf-8 -*-
"""
Export the dataset for Datawrapper, Tableau and Pageflow.

Writes into dist/data/:
  airbnb-london-long.csv        tidy, one row per borough x snapshot (Datawrapper + Tableau)
  airbnb-london-wide.csv        one row per borough, all snapshots side by side
  airbnb-london-map.csv         keyed by area code for a Datawrapper custom map join
  london-boroughs.geojson       ONS boundaries, WGS84, all rings as MultiPolygon
  london-boroughs-lite.geojson  same, simplified to ~180 m for small embeds
"""
import csv
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOJSON = os.path.join(ROOT, "tools", "cache", "london_boroughs.geojson")
DATA_JS = os.path.join(ROOT, "src", "generated", "data.js")
OUT = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "dist", "data")

GEO_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0/query"
    "?where=LAD24CD+LIKE+%27E0900%25%27&outFields=LAD24CD%2CLAD24NM"
    "&f=geojson&outSR=4326"
)
YEARS = [2015, 2019, 2026]
SOURCE = "Inside Airbnb / GLA Housing Research Note 4 (2015, 2019); Inside Airbnb listing CSV, 19 Jun 2026"


def load_payload():
    with open(DATA_JS, encoding="utf-8") as fh:
        raw = fh.read()
    return json.loads(raw[raw.index("=") + 1:raw.rindex(";")])


def load_geo():
    if not os.path.exists(GEOJSON):
        os.makedirs(os.path.dirname(GEOJSON), exist_ok=True)
        with urllib.request.urlopen(GEO_URL, timeout=180) as r:
            open(GEOJSON, "wb").write(r.read())
    with open(GEOJSON, encoding="utf-8") as fh:
        return json.load(fh)


def write_csv(name, header, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    return path, os.path.getsize(path)


def _pct(v):
    """Anteile liegen als 0..1 vor - für Datawrapper/Tableau in Prozent."""
    return None if v is None else round(v * 100, 2)


def round_ring(ring, nd=5):
    out = []
    last = None
    for pt in ring:
        p = [round(pt[0], nd), round(pt[1], nd)]
        if p != last:
            out.append(p)
            last = p
    if len(out) >= 4 and out[0] != out[-1]:
        out.append(out[0])
    return out


def to_multipolygon(geom):
    """Tableau mag keine gemischten Typen - alles wird MultiPolygon."""
    if geom["type"] == "Polygon":
        polys = [geom["coordinates"]]
    else:
        polys = geom["coordinates"]
    return {
        "type": "MultiPolygon",
        "coordinates": [[round_ring(r) for r in poly if len(r) >= 4] for poly in polys]
    }


def rdp(points, eps):
    if len(points) < 3:
        return list(points)
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    den = (dx * dx + dy * dy) ** 0.5
    idx, best = -1, eps
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if den == 0:
            dist = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        else:
            dist = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / den
        if dist > best:
            idx, best = i, dist
    if idx < 0:
        return [points[0], points[-1]]
    return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)


def main():
    os.makedirs(OUT, exist_ok=True)
    data = load_payload()
    B = data["boroughs"]
    snap = data["meta"]["snapshots"]

    # ---------------------------------------------------------- long ------
    rows = []
    for y in YEARS:
        for b in sorted(B, key=lambda x: x["name"]):
            rows.append([
                b["name"], b["code"], y, snap[str(y)],
                b["listings"][str(y)], b["pop"][str(y)],
                ("%.3f" % b["per1k"][str(y)]).rstrip("0").rstrip("."),
                round(b["lat"], 5), round(b["lon"], 5), SOURCE,
            ])
    long_path, long_size = write_csv(
        "airbnb-london-long.csv",
        ["Borough", "Area Code", "Year", "Snapshot Date", "Airbnb Listings",
         "Population", "Listings per 1000 residents", "Latitude", "Longitude", "Source"],
        rows)

    # ---------------------------------------------------------- wide ------
    def pct(a, b):
        return "" if not a else ("%.1f" % ((b - a) / a * 100))

    wrows = []
    for b in sorted(B, key=lambda x: -x["listings"]["2026"]):
        wrows.append([
            b["name"], b["code"],
            b["listings"]["2015"], b["listings"]["2019"], b["listings"]["2026"],
            b["listings"]["2019"] - b["listings"]["2015"],
            pct(b["listings"]["2015"], b["listings"]["2019"]),
            b["listings"]["2026"] - b["listings"]["2019"],
            pct(b["listings"]["2019"], b["listings"]["2026"]),
            b["listings"]["2026"] - b["listings"]["2015"],
            pct(b["listings"]["2015"], b["listings"]["2026"]),
            ("%.2f" % b["per1k"]["2015"]), ("%.2f" % b["per1k"]["2019"]), ("%.2f" % b["per1k"]["2026"]),
            b["pop"]["2026"], round(b["lat"], 5), round(b["lon"], 5),
        ])
    wide_path, wide_size = write_csv(
        "airbnb-london-wide.csv",
        ["Borough", "Area Code",
         "Listings 2015", "Listings 2019", "Listings 2026",
         "Change 2015-2019", "Change 2015-2019 %",
         "Change 2019-2026", "Change 2019-2026 %",
         "Change 2015-2026", "Change 2015-2026 %",
         "Listings per 1000 2015", "Listings per 1000 2019", "Listings per 1000 2026",
         "Population 2025", "Latitude", "Longitude"],
        wrows)

    # ------------------------------------------------- map keyed by code --
    mrows = []
    for y in YEARS:
        for b in sorted(B, key=lambda x: x["name"]):
            mrows.append([b["code"], b["name"], y,
                          b["listings"][str(y)], b["per1k"][str(y)]])
    map_path, map_size = write_csv(
        "airbnb-london-map.csv",
        ["Area Code", "Borough", "Year", "Listings", "Listings per 1000"],
        mrows)

    # ------------------------------------------- joined Airbnb + Demografie
    demo_rows = []
    has_demo = any(b.get("demo") for b in B)
    if has_demo:
        for b in sorted(B, key=lambda x: -x["listings"]["2026"]):
            d = b.get("demo") or {}
            demo_rows.append([
                b["name"], b["code"],
                b["listings"]["2015"], b["listings"]["2019"], b["listings"]["2026"],
                ("%.2f" % b["per1k"]["2015"]), ("%.2f" % b["per1k"]["2019"]), ("%.2f" % b["per1k"]["2026"]),
                d.get("pop2025"), d.get("density"), d.get("medianAge"),
                _pct(d.get("popGrowth")),
                _pct(d.get("noQual")), _pct(d.get("level4")),
                _pct(d.get("ukBorn")), _pct(d.get("nonUkBorn")),
                _pct(d.get("africaBorn")), _pct(d.get("asiaBorn")), _pct(d.get("americasBorn")),
                d.get("earnings"),
                (round(d["earnings"] * 52 / 12, 1) if d.get("earnings") else None),
                round(b["lat"], 5), round(b["lon"], 5),
            ])
        demo_path, demo_size = write_csv(
            "airbnb-demografie-borough.csv",
            ["Borough", "Area Code",
             "Listings 2015", "Listings 2019", "Listings 2026",
             "Listings per 1000 2015", "Listings per 1000 2019", "Listings per 1000 2026",
             "Population 2025", "Density 2025 (people/km2)", "Median age 2025",
             "Population growth 2024-25 %",
             "No qualifications share 2021 %", "Level 4+ share 2021 %",
             "UK-born share 2021 %", "Non-UK-born share 2021 %",
             "Africa-born share 2021 %", "Middle East & Asia-born share 2021 %",
             "Americas & Caribbean-born share 2021 %",
             "Median gross weekly earnings 2024 (GBP)", "Approx. monthly gross (GBP)",
             "Latitude", "Longitude"],
            demo_rows)

    # ------------------------------------------------------- geojson ------
    geo = load_geo()
    by_code = {b["code"]: b for b in B}
    features, features_lite = [], []
    for f in geo["features"]:
        code = f["properties"]["LAD24CD"]
        name = by_code.get(code, {}).get("name", f["properties"]["LAD24NM"])
        geom = to_multipolygon(f["geometry"])
        props = {
            "code": code,
            "name": name,
            "listings_2015": by_code.get(code, {}).get("listings", {}).get("2015"),
            "listings_2019": by_code.get(code, {}).get("listings", {}).get("2019"),
            "listings_2026": by_code.get(code, {}).get("listings", {}).get("2026"),
        }
        features.append({"type": "Feature", "properties": props, "geometry": geom})
        lite = {
            "type": "MultiPolygon",
            "coordinates": [
                [rdp(ring, 0.0018) for ring in poly]
                for poly in geom["coordinates"]
            ]
        }
        features_lite.append({"type": "Feature", "properties": props, "geometry": lite})

    def dump(path, feats):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh,
                      ensure_ascii=False, separators=(",", ":"))
        return os.path.getsize(path)

    g_size = dump(os.path.join(OUT, "london-boroughs.geojson"), features)
    gl_size = dump(os.path.join(OUT, "london-boroughs-lite.geojson"), features_lite)

    for p, s in [(long_path, long_size), (wide_path, wide_size), (map_path, map_size)]:
        print("%-34s %7.1f KB" % (os.path.basename(p), s / 1024))
    if has_demo:
        print("%-34s %7.1f KB" % (os.path.basename(demo_path), demo_size / 1024))
    print("%-34s %7.1f KB" % ("london-boroughs.geojson", g_size / 1024))
    print("%-34s %7.1f KB" % ("london-boroughs-lite.geojson", gl_size / 1024))
    print("rows: long=%d wide=%d map=%d" % (len(rows), len(wrows), len(mrows)))


if __name__ == "__main__":
    main()
