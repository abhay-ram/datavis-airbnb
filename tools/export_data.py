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
DEMO_JS = os.path.join(ROOT, "src", "generated", "demography.js")
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


def load_demography():
    if not os.path.exists(DEMO_JS):
        return None
    with open(DEMO_JS, encoding="utf-8") as fh:
        raw = fh.read()
    return json.loads(raw[raw.index("=") + 1:raw.rindex(";")])


def export_demography():
    """Eigene Exporte für den zweiten Datensatz - ohne Airbnb-Werte."""
    d = load_demography()
    if not d:
        return []
    B = d["boroughs"]
    years = d["meta"]["years"]
    earn_years = d["meta"]["earnYears"]
    out = []

    # 1 · Bevölkerung, Dichte, Medianalter als lange Reihe
    rows = []
    for y in years:
        for b in sorted(B, key=lambda x: x["name"]):
            rows.append([
                b["name"], b["code"], y,
                b["pop"].get(str(y)), b["density"].get(str(y)),
                b["medianAge"].get(str(y)), b["popGrowth"].get(str(y)),
                round(b["pop"].get(str(y), 0) / 1000.0, 1),
                "ONS Mid-Year Population Estimates",
            ])
    p, s = write_csv("demografie-bevoelkerung-lang.csv",
                     ["Borough", "Area Code", "Year", "Population",
                      "Population density (people/km2)", "Median age",
                      "Population growth vs previous year %", "Population in thousands", "Source"], rows)
    out.append((p, s))

    # 2 · Strukturprofil je Bezirk in einer Zeile
    grows = []
    for b in sorted(B, key=lambda x: -(x["pop"].get("2025") or 0)):
        ag = b["ageGroups"]
        ed = b["education"]
        og = b["origin"]
        ind = b["originIndicators"]
        grows.append([
            b["name"], b["code"],
            b["pop"].get("2025"), b["density"].get("2025"), b["medianAge"].get("2025"),
            (ag.get("Age 0\u201315") or {}).get("share"),
            (ag.get("Age 16\u201364") or {}).get("share"),
            (ag.get("Age 65+") or {}).get("share"),
            (b["sex"].get("Female") or {}).get("share"),
            (b["sex"].get("Male") or {}).get("share"),
            (ed.get("No qualifications") or {}).get("share"),
            (ed.get("Level 4+") or {}).get("share"),
            (ind.get("UK-born") or {}).get("share"),
            (ind.get("Non-UK-born") or {}).get("share"),
            (og.get("EU-born") or {}).get("share"),
            (og.get("Africa-born") or {}).get("share"),
            (og.get("Middle East & Asia-born") or {}).get("share"),
            (og.get("Americas & Caribbean-born") or {}).get("share"),
            (b["earnings"].get("2024") or {}).get("value"),
        ])
    p, s = write_csv("demografie-bezirksprofil.csv",
                     ["Borough", "Area Code", "Population 2025", "Density 2025 (people/km2)",
                      "Median age 2025", "Share 0-15 %", "Share 16-64 %", "Share 65+ %",
                      "Share female %", "Share male %",
                      "No qualifications %", "Level 4+ %",
                      "UK-born %", "Non-UK-born %",
                      "EU-born %", "Africa-born %", "Middle East & Asia-born %",
                      "Americas & Caribbean-born %",
                      "Median gross weekly earnings 2024 (GBP)"], grows)
    out.append((p, s))

    # 3 · Altersstruktur in Einzeljahren
    arows = []
    for b in sorted(B, key=lambda x: x["name"]):
        tot = sum(b["ages"] or []) or 1
        for age, v in enumerate(b["ages"] or []):
            arows.append([b["name"], b["code"], 2025, age, v, round((v or 0) / tot * 100, 4)])
    p, s = write_csv("demografie-altersstruktur.csv",
                     ["Borough", "Area Code", "Year", "Age", "Population",
                      "Share of borough population %"], arows)
    out.append((p, s))

    # 4 · Lohnreihe
    erows = []
    for y in earn_years:
        for b in sorted(B, key=lambda x: x["name"]):
            e = (b["earnings"] or {}).get(str(y)) or {}
            erows.append([b["name"], b["code"], y, e.get("value"),
                          e.get("status") or "", "ONS ASHE / NOMIS"])
    p, s = write_csv("demografie-lohn-lang.csv",
                     ["Borough", "Area Code", "Year",
                      "Median gross weekly earnings (GBP)", "Publication status", "Source"], erows)
    out.append((p, s))

    return out


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
    print("%-34s %7.1f KB" % ("london-boroughs.geojson", g_size / 1024))
    for p2, s2 in export_demography():
        print("%-34s %7.1f KB" % (os.path.basename(p2), s2 / 1024))
    print("%-34s %7.1f KB" % ("london-boroughs-lite.geojson", gl_size / 1024))
    print("rows: long=%d wide=%d map=%d" % (len(rows), len(wrows), len(mrows)))


if __name__ == "__main__":
    main()
