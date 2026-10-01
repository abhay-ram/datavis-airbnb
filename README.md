# London Airbnb · sechs einbettbare Visualisierungen

Drei Karten-Varianten und drei reine Balken-/Linien-Varianten auf Basis von
`London_Airbnb_Datawrapper_Ready_FINAL.xlsx` — 33 Bezirke von Greater London über die
drei Stichtage **April 2015**, **Mai 2019** und **19. Juni 2026**.

Jede Variante ist **eine einzige HTML-Datei**: keine Bibliothek, kein CDN, kein Tile-Server,
keine externen Requests. Damit läuft sie offline, in jedem CMS und in jedem iframe.

---

## Schnellstart

```bash
# Vorschau-Server (http://127.0.0.1:4173/)
node tools/serve.mjs

# alles neu bauen (nach dist/)
python tools/build.py

# Website für GitHub Pages nach docs/ bauen
python tools/publish.py

# Datenexporte für Datawrapper / Tableau neu erzeugen
python tools/export_data.py

# automatisierte Prüfung aller Varianten
cd tools && node smoke.mjs
```

---

## Veröffentlichen (GitHub Pages)

Das Repository ist vorbereitet: Branch `main`, Remote `origin`,
veröffentlichter Ordner `docs/`.

```bash
git remote -v                       # origin -> datavis-airbnb.git
git push -u origin main             # Zugangsdaten werden einmalig abgefragt
```

Danach im Repository einmalig einstellen:
**Settings → Pages → Source: „Deploy from a branch“ → Branch: `main` → Ordner: `/docs` → Save**

Nach ein bis zwei Minuten ist die Seite erreichbar unter

```
https://abhay-ram.github.io/datavis-airbnb/
```

Diese Adresse ist zugleich die Basis für die Pageflow-Einbettung, z. B.
`https://abhay-ram.github.io/datavis-airbnb/1-linien-nach-bezirk.html?embed=1`.

Nach Änderungen an den Quellen genügt:

```bash
python tools/publish.py && git add -A && git commit -m "Update" && git push
```

---

## Die sechs Varianten (`dist/`)

| Datei | Typ | Inhalt |
|---|---|---|
| `1-linien-nach-bezirk.html` | Diagramm | **Liniendiagramm: X = Jahr, Y = die 33 Bezirke.** Umschaltbar zwischen Rang, Wert und Anteil; Jahresfilter, Suche, fixierbare Bezirke |
| `2-slope-und-balken.html` | Diagramm | Ranglisten-Balken, die beim Jahreswechsel wandern, plus Slope-Verlauf und größte Bewegungen |
| `3-scrolly-story-linien.html` | Diagramm | Scroll-Story mit 8 Schritten; im Embed ein Player mit Weiter/Zurück |
| `4-karte-choropleth.html` | Karte | Echte ONS-Bezirksgrenzen, Jahresumschaltung, Zeitachse zum Abspielen, Flächen oder Blasen |
| `5-karte-bubbles.html` | Karte | Proportionale Blasenkarte plus drei synchronisierte Mini-Karten (ein Stichtag je Karte) |
| `6-scrolly-story-karte.html` | Karte | Scroll-Story auf der Karte: Konzentration, Wachstum, Pro-Kopf-Dichte, Stadtrand, Rückgang |
| `index.html` | — | Embed-Kit: Live-Vorschauen, Einbettungscodes, Datenbeschreibungen, Parameterübersicht |

**Interaktion in allen Varianten:** Bezirke per Zeiger hervorheben, per Klick fixieren,
nach Jahr filtern, Messgröße wechseln (Inserate ↔ Inserate je 1.000 Einwohner:innen).
Tastaturbedienung ist eingebaut.

---

## Einbetten

### Pageflow

Pageflow bettet über eine **URL** ein – die Dateien müssen also erreichbar sein
(GitHub Pages, Netlify Drop, eigener Webspace):

1. Ordner `dist/` unverändert hochladen.
2. Im Editor **+** → **iframe embed** → URL eintragen, z. B.
   `https://ihre-domain.de/1-linien-nach-bezirk.html?embed=1`
3. **Dynamic Height** aktivieren. Die Dateien senden das dafür nötige
   `iframe.resize`-Signal von sich aus – die Höhe passt sich automatisch an.

Für die native Datawrapper-Anbindung: **+** → **Datawrapper chart** → Datawrapper-URL einfügen.

### Überall sonst

```html
<iframe
  src="https://ihre-domain.de/4-karte-choropleth.html?embed=1"
  title="Airbnb in London – Karte"
  loading="lazy"
  style="width:100%;border:0;min-height:620px;display:block"
  allowfullscreen></iframe>
```

### Steuerung aus der Host-Seite

```js
const frame = document.querySelector('iframe');
frame.contentWindow.postMessage({ type: 'year', years: [2026] }, '*');
frame.contentWindow.postMessage({ type: 'metric', metric: 'per1k' }, '*');
frame.contentWindow.postMessage({ type: 'focus', codes: ['E09000033'] }, '*');
frame.contentWindow.postMessage({ type: 'step', index: 3 }, '*');   // Stories
frame.contentWindow.postMessage({ type: 'theme', theme: 'dark' }, '*');
```

---

## URL-Parameter

| Parameter | Werte | Wirkung |
|---|---|---|
| `embed` | `1` | Kompakter Modus für iframes; Stories werden zum Player |
| `theme` | `light`, `dark` | Farbschema erzwingen (Standard: Systemeinstellung) |
| `year` | `2015`, `2019`, `2026` | Startstichtag |
| `metric` | `listings`, `per1k` | Inserate oder Inserate je 1.000 Einwohner:innen |
| `mode` | `rank`, `value`, `share` | Y-Achse der Linien-Variante |
| `topn` | `10`, `20` | Nur die größten Bezirke |
| `sort` | `value`, `name`, `growth` | Sortierung (Variante 2) |
| `view` | `choropleth`, `bubbles` | Darstellung (Variante 4) |
| `labels` | `top`, `all`, `none` | Beschriftung (Variante 5) |
| `focus` | Area Codes, kommagetrennt | Bezirke vorab fixieren |
| `step` | `0` … `6` | Startschritt der Stories |
| `player` | `1` | Player-Modus auch außerhalb eines iframes |
| `autoplay` | `1` | Stories laufen automatisch durch |

---

## Daten für Datawrapper & Tableau (`dist/data/`)

| Datei | Inhalt |
|---|---|
| `airbnb-london-long.csv` | Bereinigt: eine Zeile je Bezirk × Stichtag, mit Einwohnerzahlen und Koordinaten |
| `airbnb-london-wide.csv` | Ein Bezirk pro Zeile, die drei Stichtage als Spalten plus Veränderungen |
| `airbnb-london-map.csv` | Auf den Kartenschlüssel reduziert (`Area Code`, Bezirk, Jahr, Werte) |
| `london-boroughs.geojson` | ONS-Bezirksgrenzen in WGS84, alle Ringe als MultiPolygon |
| `london-boroughs-lite.geojson` | Dieselben Grenzen, auf ~180 m vereinfacht |

**Datawrapper-Karte:** Custom Map mit `london-boroughs.geojson`, Daten aus
`airbnb-london-map.csv`, Verbindung über `Area Code` = `code`.
**Datawrapper-Diagramm:** `airbnb-london-wide.csv`, Spalten *Listings 2015/2019/2026* als Wertereihen.
**Tableau:** `airbnb-london-long.csv` verbinden, optional `london-boroughs.geojson` als
Spatial File über `Area Code` = `code` verknüpfen; Karte über Latitude/Longitude oder die Geometrie.

---

## Quellen

* **Daten:** Inside Airbnb / GLA Housing Research Note 4 (April 2015, Mai 2019);
  Bezirksaggregation aus dem Inside-Airbnb-Listing-CSV vom 19. Juni 2026
  (92.799 Inserate in 33 Bezirken). Einwohnerzahlen: ONS.
* **Getrennt gehalten:** Das Demografie-Workbook
  (`London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx`) wird **nicht** mit den
  Airbnb-Daten vermischt. Es hat eigene Datenexporte und eigene Visualisierungen.
* **Geometrie:** ONS Open Geography Portal, *Local Authority Districts (May 2024)*,
  generalised & clipped, Open Government Licence v3.0.
* **Hinweis:** Alle Werte sind Stichtagsbeobachtungen, keine Jahresdurchschnitte.
  Die GLA-Erhebung von 2015 fällt systematisch niedriger aus als spätere Zählungen,
  wodurch das Wachstum 2015 → 2019 überzeichnet sein dürfte. Für Havering und Sutton
  weist die GLA-Quelle 2015 „–“ aus; der Wert ist als 0 codiert.

---

## Projektstruktur

```
London_Airbnb_Datawrapper_Ready_FINAL.xlsx        Quelldaten Airbnb
London_Demographie_Datawrapper_Ready_FINAL...xlsx Quelldaten Demografie
src/
  theme.css                 gemeinsames Design-System
  core.js                   Datenzugriff, Skalen, Tooltip, Fokus, Embed-Bridge, Story-Engine
  generated/data.js         erzeugt: Daten + vorprojizierte SVG-Bezirkspfade
  versions/<id>.{html,css,js}   Markup, Stil und Logik je Variante
tools/
  prepare_data.py           xlsx + GeoJSON -> src/generated/data.js
  export_data.py            -> <out>/data/*.csv, *.geojson
  build.py [out]            baut die eigenständigen HTML-Dateien
  publish.py                baut die komplette Website nach docs/
  smoke.mjs                 jsdom-Prüfung aller Varianten und Themes
  serve.mjs                 Vorschau-Server
dist/                       lokales Build-Ergebnis (nicht im Repository)
docs/                       veröffentlichte Website für GitHub Pages
```
