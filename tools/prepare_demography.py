# -*- coding: utf-8 -*-
"""
Prepare the London demography payload - strictly separate from the Airbnb data.

Reads  : London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx
         tools/cache/london_boroughs.geojson  (shared boundaries, ONS)
Writes : src/generated/demography.js  ->  window.LONDON_DEMOGRAPHY

No value from the Airbnb workbook is merged in here.
"""
import json
import math
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx")
CACHE = os.path.join(ROOT, "tools", "cache")
GEOJSON = os.path.join(CACHE, "london_boroughs.geojson")
OUT = os.path.join(ROOT, "src", "generated", "demography.js")

GEO_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0/query"
    "?where=LAD24CD+LIKE+%27E0900%25%27&outFields=LAD24CD%2CLAD24NM"
    "&f=geojson&outSR=4326"
)

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"

POP_YEARS = list(range(2011, 2026))
EARN_YEARS = list(range(2002, 2025))

AGE_GROUPS = ["Age 0\u201315", "Age 16\u201364", "Age 65+"]
AGE_LABELS = {"Age 0\u201315": "0\u201315 Jahre", "Age 16\u201364": "16\u201364 Jahre",
              "Age 65+": "65 Jahre und \u00e4lter"}


# --------------------------------------------------------------- xlsx -------

def _colnum(ref):
    letters = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def _cell_value(c):
    inline = c.find(M + "is")
    v = c.find(M + "v")
    if inline is not None:
        return "".join(t.text or "" for t in inline.iter(M + "t"))
    if v is None:
        return None
    val = v.text
    if c.attrib.get("t") in (None, "n"):
        try:
            return float(val)
        except (TypeError, ValueError):
            return val
    return val


def read_workbook(path):
    """{sheet name: [ {header: value, ...}, ... ]} - Auflösung über die rels."""
    if not os.path.exists(path):
        raise SystemExit("Datei fehlt: %s" % path)
    zf = zipfile.ZipFile(path)
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    target = {}
    for rel in rels.iter(PR + "Relationship"):
        target[rel.attrib["Id"]] = rel.attrib["Target"].lstrip("/")
    wb = ET.fromstring(zf.read("xl/workbook.xml"))

    out = {}
    for sh in wb.iter(M + "sheet"):
        name = sh.attrib["name"]
        rid = sh.attrib.get(R + "id")
        path_ = target.get(rid, "")
        if path_ and not path_.startswith("xl/"):
            path_ = "xl/" + path_
        if not path_:
            continue
        root = ET.fromstring(zf.read(path_))
        rows = []
        for r in root.iter(M + "row"):
            row = {}
            for c in r.iter(M + "c"):
                row[_colnum(c.attrib["r"])] = _cell_value(c)
            if row:
                rows.append(row)
        if not rows:
            out[name] = []
            continue
        head = rows[0]
        out[name] = [
            {head[k]: r.get(k) for k in sorted(head) if head.get(k)}
            for r in rows[1:]
        ]
    return out


def num(v, nd=None):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, nd) if nd is not None else f


def pct(v, nd=2):
    """Anteile liegen als 0..1 vor."""
    f = num(v)
    return None if f is None else round(f * 100, nd)


# ----------------------------------------------------------------- geo ------

def mercator(lon, lat):
    return math.radians(lon), math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def rdp(points, eps):
    if len(points) < 3:
        return list(points)
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    den = math.hypot(dx, dy)
    idx, best = -1, eps
    for i in range(1, len(points) - 1):
        px, py = points[i]
        dist = math.hypot(px - x1, py - y1) if den == 0 else \
            abs(dy * px - dx * py + x2 * y1 - y2 * x1) / den
        if dist > best:
            idx, best = i, dist
    if idx < 0:
        return [points[0], points[-1]]
    return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)


def rings_of(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    return [poly[0] for poly in geometry["coordinates"]]


def load_geo():
    os.makedirs(CACHE, exist_ok=True)
    if not os.path.exists(GEOJSON):
        with urllib.request.urlopen(GEO_URL, timeout=180) as r:
            open(GEOJSON, "wb").write(r.read())
    with open(GEOJSON, encoding="utf-8") as fh:
        return json.load(fh)


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

    paths, centroids, areas = {}, {}, {}
    for f in features:
        code = f["properties"]["LAD24CD"]
        pieces, anchors, total = [], [], 0.0
        for ring in rings_of(f["geometry"]):
            proj = []
            for lon, lat in ring:
                mx, my = mercator(lon, lat)
                proj.append(((mx - x0) * scale, (y1 - my) * scale))
            rxs = [p[0] for p in proj]
            rys = [p[1] for p in proj]
            if (max(rxs) - min(rxs)) * (max(rys) - min(rys)) < min_area:
                continue
            simple = rdp(proj, eps)
            if len(simple) < 4:
                continue
            area = cx = cy = 0.0
            for i in range(len(simple) - 1):
                ax, ay = simple[i]
                bx, by = simple[i + 1]
                cross = ax * by - bx * ay
                area += cross
                cx += (ax + bx) * cross
                cy += (ay + by) * cross
            area *= 0.5
            total += abs(area)
            if area:
                anchors.append((abs(area), cx / (6 * area), cy / (6 * area)))
            pieces.append("M" + "L".join(
                "%.1f %.1f" % (round(px, 1), round(py, 1)) for px, py in simple) + "Z")
        paths[code] = "".join(pieces)
        areas[code] = round(total, 1)
        if anchors:
            anchors.sort(reverse=True)
            centroids[code] = [round(anchors[0][1], 2), round(anchors[0][2], 2)]
    return {"width": width, "height": round((y1 - y0) * scale, 1),
            "paths": paths, "areas": areas, "centroids": centroids}


# ----------------------------------------------------------------- main -----

def main():
    sheets = read_workbook(XLSX)
    geo = build_geo(load_geo()["features"])

    name_by_code, latlon = {}, {}
    boroughs = {}

    def ensure(code, name):
        if code not in boroughs:
            boroughs[code] = {
                "code": code, "name": name, "short": name,
                "xy": geo["centroids"].get(code),
                "pop": {}, "density": {}, "medianAge": {}, "popGrowth": {},
                "ageGroups": {}, "ages": None, "sex": {},
                "education": {}, "origin": {}, "originIndicators": {},
                "earnings": {},
            }
        return boroughs[code]

    # ---- Bevölkerung, Dichte, Medianalter, Wachstum (2011-2025) ----
    for r in sheets.get("Population_Long", []):
        code = r.get("Area Code")
        y = num(r.get("Year"))
        if not code or y is None:
            continue
        b = ensure(code, r.get("Borough"))
        name_by_code[code] = r.get("Borough")
        b["pop"][str(int(y))] = num(r.get("Population"))
        b["density"][str(int(y))] = num(r.get("Population density (people/km\u00b2)"))
        b["medianAge"][str(int(y))] = num(r.get("Median age"), 1)
        b["popGrowth"][str(int(y))] = pct(r.get("Population growth vs previous year (%)"))

    # ---- Altersgruppen 2025 ----
    for r in sheets.get("Age_Groups_2025", []):
        code = r.get("Area Code")
        if not code:
            continue
        b = ensure(code, r.get("Borough"))
        grp = r.get("Age group")
        if grp in AGE_GROUPS:
            b["ageGroups"][grp] = {"pop": num(r.get("Population")),
                                   "share": pct(r.get("Share of borough population"))}

    # ---- Einzeljahres-Alter 2025 (für das Altersprofil) ----
    for r in sheets.get("Age_SingleYear_2025", []):
        code = r.get("Area Code")
        age = num(r.get("Age"))
        if not code or age is None:
            continue
        b = ensure(code, r.get("Borough"))
        if b["ages"] is None:
            b["ages"] = [0] * 91
        a = int(age)
        if 0 <= a <= 90:
            b["ages"][a] = num(r.get("Population")) or 0

    # ---- Geschlecht 2025 ----
    for r in sheets.get("Sex_2025", []):
        code = r.get("Area Code")
        if not code:
            continue
        b = ensure(code, r.get("Borough"))
        b["sex"][r.get("Sex")] = {"pop": num(r.get("Population")),
                                  "share": pct(r.get("Share of borough population"))}

    # ---- Bildung 2021 ----
    for r in sheets.get("Education_2021", []):
        code = r.get("Area Code")
        if not code:
            continue
        b = ensure(code, r.get("Borough"))
        cat = r.get("Education category")
        b["education"][cat] = {
            "code": num(r.get("Education category code")),
            "people": num(r.get("People")),
            "share": pct(r.get("Share of applicable 16+ population")),
        }

    # ---- Herkunft 2021 (Gruppen) ----
    for r in sheets.get("Country_Groups_2021", []):
        code = r.get("Area Code")
        if not code:
            continue
        b = ensure(code, r.get("Borough"))
        b["origin"][r.get("Origin group")] = {
            "people": num(r.get("People")),
            "share": pct(r.get("Share of applicable population")),
        }

    # ---- Herkunft 2021 (UK / Nicht-UK) ----
    for r in sheets.get("Country_Indicators_2021", []):
        code = r.get("Area Code")
        if not code:
            continue
        b = ensure(code, r.get("Borough"))
        b["originIndicators"][r.get("Indicator")] = {
            "people": num(r.get("People")),
            "share": pct(r.get("Share of applicable population")),
        }

    # ---- Medianlohn 2002-2024 ----
    for r in sheets.get("Earnings_Long", []):
        code = r.get("Area Code")
        y = num(r.get("Year"))
        if not code or y is None:
            continue
        b = ensure(code, r.get("Borough"))
        v = num(r.get("Median gross weekly earnings (\u00a3)"))
        b["earnings"][str(int(y))] = {
            "value": v,
            "conf": num(r.get("Confidence (%)")),
            "status": r.get("Publication status") or None,
        }

    # ---- Koordinaten aus Borough_Profile, sofern vorhanden ----
    profile = {}
    for r in sheets.get("Borough_Profile", []):
        code = r.get("Area Code")
        if not code:
            continue
        profile[code] = r
        b = ensure(code, r.get("Borough"))
        lat, lon = num(r.get("Latitude")), num(r.get("Longitude"))
        if lat is not None and lon is not None:
            latlon[code] = (lat, lon)

    # Bezirksnamen vereinheitlichen (Population_Long ist die Referenz)
    for code, b in boroughs.items():
        b["name"] = name_by_code.get(code, b["name"])
        b["short"] = (b["name"]
                      .replace("Barking and Dagenham", "Barking & Dagenham")
                      .replace("Hammersmith and Fulham", "Hammersmith & Fulham")
                      .replace("Kensington and Chelsea", "Kensington & Chelsea"))

    missing_geo = [b["code"] for b in boroughs.values() if not b["xy"]]
    if missing_geo:
        raise SystemExit("Geometrie fehlt für: %s" % missing_geo)

    # London-Summen je Jahr (nur Demografie, keine Airbnb-Werte)
    city = {"pop": {}, "density": {}, "medianAge": {}}
    for y in POP_YEARS:
        tot = sum((b["pop"].get(str(y)) or 0) for b in boroughs.values())
        city["pop"][str(y)] = int(round(tot))
        ages = [b["medianAge"].get(str(y)) for b in boroughs.values()]
        ages = [a for a in ages if a is not None]
        city["medianAge"][str(y)] = round(sum(ages) / len(ages), 1) if ages else None
    # Londoner Altersprofil = Summe aller Bezirke
    city_ages = [0] * 91
    for b in boroughs.values():
        if not b["ages"]:
            continue
        for i, v in enumerate(b["ages"]):
            city_ages[i] += v or 0
    city["ages"] = city_ages
    city["ageGroups"] = {}
    for grp in AGE_GROUPS:
        s = sum((b["ageGroups"].get(grp, {}).get("pop") or 0) for b in boroughs.values())
        city["ageGroups"][grp] = int(round(s))
    gsum = sum(city["ageGroups"].values()) or 1
    city["ageGroupShare"] = {g: round(v / gsum * 100, 2) for g, v in city["ageGroups"].items()}

    payload = {
        "meta": {
            "title": "London in Zahlen",
            "subtitle": "Bev\u00f6lkerung und Struktur der 33 Bezirke von Greater London",
            "years": POP_YEARS,
            "earnYears": EARN_YEARS,
            "ageGroups": AGE_GROUPS,
            "ageLabels": AGE_LABELS,
            "educationOrder": [
                "No qualifications", "Level 1 / entry level", "Level 2",
                "Apprenticeship", "Level 3", "Level 4+", "Other qualifications",
            ],
            "originOrder": [
                "UK-born", "EU-born", "Rest of Europe-born", "Africa-born",
                "Middle East & Asia-born", "Americas & Caribbean-born",
                "Oceania-born", "Other",
            ],
            "sources": {
                "population": "ONS Mid-Year Population Estimates (2011\u20132025)",
                "age": "ONS Mid-Year Population Estimates 2025",
                "education": "ONS Census 2021, TS067",
                "origin": "ONS Census 2021, TS012",
                "earnings": "ONS ASHE / NOMIS (2002\u20132024)",
            },
            "note": "Bev\u00f6lkerungssch\u00e4tzungen sind gerundet; Census-Angaben beziehen sich auf 2021. "
                    "Der Medianlohn wird f\u00fcr kleine Bezirke teilweise nicht ver\u00f6ffentlicht.",
            "geoSource": "ONS Open Geography Portal, Local Authority Districts (May 2024), "
                         "generalised & clipped, Open Government Licence v3.0",
        },
        "city": city,
        "boroughs": sorted(boroughs.values(), key=lambda b: b["name"]),
        "geo": {"width": geo["width"], "height": geo["height"],
                "paths": geo["paths"], "areas": geo["areas"]},
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("/* generated by tools/prepare_demography.py - do not edit */\n")
        fh.write("window.LONDON_DEMOGRAPHY = ")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    print("Bezirke      : %d" % len(payload["boroughs"]))
    print("Bev\u00f6lkerung  : %s \u2192 %s" % (city["pop"]["2011"], city["pop"]["2025"]))
    print("Altersprofil : %d Jahrg\u00e4nge, %s Personen" % (len(city["ages"]), sum(city["ages"])))
    print("Lohnjahre    : %d\u2013%d" % (EARN_YEARS[0], EARN_YEARS[-1]))
    print("out          : %s (%.1f KB)" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
