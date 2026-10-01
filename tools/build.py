# -*- coding: utf-8 -*-
"""
Assemble the self-contained embeds.

  src/theme.css                  -> inlined into every file
  src/core.js                    -> inlined into every file
  src/generated/data.js          -> inlined into every file
  src/versions/<id>.html         -> body markup of that version
  src/versions/<id>.css          -> optional extra css
  src/versions/<id>.js           -> optional extra js
  dist/<out>                     -> single file, zero external requests
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
VER = os.path.join(SRC, "versions")
DIST = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "dist")

CORE_CSS = os.path.join(SRC, "theme.css")
CORE_JS = os.path.join(SRC, "core.js")
DATA_JS = os.path.join(SRC, "generated", "data.js")

VERSIONS = [
    dict(
        id="chart-1-bump-lines",
        out="1-linien-nach-bezirk.html",
        title="Airbnb in London · Linien nach Bezirk",
        desc="Interaktives Liniendiagramm: Jahre auf der X-Achse, alle 33 Bezirke auf der Y-Achse.",
    ),
    dict(
        id="chart-2-slope-ranks",
        out="2-slope-und-balken.html",
        title="Airbnb in London · Slope & Ränge",
        desc="Slope-Diagramm 2015–2019–2026 mit Ranglisten-Balken.",
    ),
    dict(
        id="chart-3-scrolly",
        out="3-scrolly-story-linien.html",
        title="Airbnb in London · Die Story",
        desc="Scroll-Story mit animierten Balken- und Liniendiagrammen.",
    ),
    dict(
        id="map-1-choropleth",
        out="4-karte-choropleth.html",
        title="Airbnb in London · Karte",
        desc="Choroplethenkarte aller 33 Bezirke mit Jahresumschaltung.",
    ),
    dict(
        id="map-2-bubbles",
        out="5-karte-bubbles.html",
        title="Airbnb in London · Blasenkarte",
        desc="Proportionale Blasenkarte plus Kleine-Vielfache für drei Jahre.",
    ),
    dict(
        id="map-3-scrolly",
        out="6-scrolly-story-karte.html",
        title="Airbnb in London · Kartenstory",
        desc="Scroll-Story auf der Karte: Hotspots, Wachstum und Konzentration.",
    ),
    dict(
        id="chart-7-demography",
        out="7-airbnb-und-demografie.html",
        title="Airbnb in London · Airbnb und Demografie",
        desc="Streudiagramm: Airbnb-Dichte im Verhältnis zu Bevölkerungsdichte, Alter, Bildung und Herkunft.",
    ),
]

GALLERY = dict(
    id="gallery",
    out="index.html",
    title="Airbnb in London · sechs embeddable Visualisierungen",
    desc="Übersicht und Einbettungscodes für alle Varianten.",
)


def read(path, required=True):
    if not os.path.exists(path):
        if required:
            sys.exit("missing file: %s" % path)
        return ""
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s*\n\s*", "\n", css)
    css = re.sub(r"\n{2,}", "\n", css)
    return css.strip()


def build(spec):
    body = read(os.path.join(VER, spec["id"] + ".html"))
    extra_css = read(os.path.join(VER, spec["id"] + ".css"), required=False)
    extra_js = read(os.path.join(VER, spec["id"] + ".js"), required=False)

    css = minify_css(read(CORE_CSS) + "\n" + extra_css)
    js = "\n".join([
        "/* ---- data ---- */", read(DATA_JS),
        "/* ---- core ---- */", read(CORE_JS),
        "/* ---- version: %s ---- */" % spec["id"], extra_js,
    ])

    html = "\n".join([
        "<!doctype html>",
        '<html lang="de" data-viz="%s">' % spec["id"],
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="color-scheme" content="light dark">',
        "<title>%s</title>" % spec["title"],
        '<meta name="description" content="%s">' % spec["desc"].replace('"', "&quot;"),
        '<meta name="generator" content="London Airbnb viz build">',
        "<style>",
        css,
        "</style>",
        "</head>",
        "<body>",
        body.strip(),
        "<script>",
        js,
        "</script>",
        "</body>",
        "</html>",
        "",
    ])

    out = os.path.join(DIST, spec["out"])
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    return out, len(html.encode("utf-8"))


def main():
    os.makedirs(DIST, exist_ok=True)
    total = 0
    for spec in VERSIONS + [GALLERY]:
        out, size = build(spec)
        total += size
        print("%-34s %7.1f KB" % (os.path.basename(out), size / 1024))
    print("%-34s %7.1f KB" % ("TOTAL", total / 1024))


if __name__ == "__main__":
    main()
