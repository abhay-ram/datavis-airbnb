# Workflow

Wie dieses Projekt gebaut, geprüft und veröffentlicht wird.
Kurzfassung für Eilige steht in der `README.md` – hier steht der vollständige Ablauf.

---

## 0 · Überblick

```
Rohdaten (xlsx)  ──►  tools/prepare_*.py  ──►  src/generated/*.js
                                                     │
                        src/theme.css, src/core.js ──┤
                        src/versions/<id>.{html,css,js}
                                                     ▼
                                            tools/build.py  ──►  dist/*.html
                                                     │
                                            tools/publish.py ──►  docs/  ──►  GitHub Pages
                                            tools/export_data.py ──►  *.csv / *.geojson
```

Es gibt **zwei getrennte Datensätze**. Sie werden nicht vermischt:

| Datensatz | Quelldatei | Aufbereitung | Payload | Ausgabe |
|---|---|---|---|---|
| Airbnb | `London_Airbnb_Datawrapper_Ready_FINAL.xlsx` | `tools/prepare_data.py` | `src/generated/data.js` | `1…6-*.html` |
| Demografie | `London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx` | `tools/prepare_demography.py` | `src/generated/demography.js` | `d1…d6-*.html` |

Die Bezirksgrenzen (`tools/cache/london_boroughs.geojson`, ONS) sind reine Geografie und
werden von beiden Datensätzen gemeinsam genutzt – sie enthalten keine Fachdaten.

Welche Datei welche Daten bekommt, steht in `tools/build.py` je Variante:

```python
dict(id="demo-1-population", out="d1-bevoelkerung-linien.html", …,
     data=[DEMO_JS], runtime=[DEMO_RT])
```

`data` ist die eingebettete Payload (Standard: `data.js`), `runtime` eine zusätzliche
Laufzeitschicht (für die Demografie: `src/demography.js`, das `window.Viz` um `V.demo`
erweitert). `src/core.js` greift automatisch auf `window.LONDON_AIRBNB` **oder**
`window.LONDON_DEMOGRAPHY` zu.

---

## 1 · Einmalige Einrichtung

```bash
# Node-Abhängigkeiten nur für die Smoke-Tests (jsdom)
cd tools && npm install --cache .npm-cache && cd ..

# Python: keine Abhängigkeiten nötig – die xlsx-Dateien werden direkt
# über zipfile + ElementTree gelesen. Kein openpyxl, kein pandas.
```

Beim ersten Lauf lädt `prepare_data.py` die Bezirksgrenzen einmalig von der
ONS-API nach `tools/cache/`. Danach läuft alles offline.

---

## 2 · Täglicher Ablauf

```bash
# a) Daten neu aufbereiten (nach Änderungen an den xlsx-Dateien)
python tools/prepare_data.py
python tools/prepare_demography.py

# b) bauen
python tools/build.py            # -> dist/
python tools/publish.py          # -> docs/  (inkl. Datenexporte, .nojekyll)

# c) prüfen
cd tools && node smoke.mjs       # alle Varianten, alle Themes
cd tools && node smoke.mjs 3-    # nur Dateien, deren Name "3-" enthält

# d) ansehen
node tools/serve.mjs             # http://127.0.0.1:4173/
```

`publish.py` führt a) bis b) selbst aus – für die Veröffentlichung genügt also ein Befehl.

---

## 3 · Eine neue Variante anlegen

1. **Markup** `src/versions/<id>.html` – nur der Inhalt der Seite, kein `<html>`-Rahmen.
2. **Stil** `src/versions/<id>.css` (optional) – nutzt die Tokens aus `src/theme.css`.
3. **Logik** `src/versions/<id>.js` (optional) – greift auf `window.Viz` zu.
4. **Registrieren** in `tools/build.py` unter `VERSIONS`:

   ```python
   dict(id="meine-variante", out="8-meine-variante.html",
        title="…", desc="…"),
   ```

5. `python tools/build.py` – die Datei landet als eigenständiges HTML in `dist/`.

**Regeln, die jede Variante einhält**

* Keine externen Ressourcen. Schriften, Farben, Daten und Code stecken in der Datei.
* `V.embed.init()` erst **nach** dem Erstaufbau aufrufen, danach `V.embed.markReady()` –
  `?theme=` und `?embed=1` lösen ein `viz:theme`-Ereignis aus, das ein fertiges DOM braucht.
* Die Theme-Listener beginnen mit `if (!V.embed.isReady()) return;`.
* Am Ende `V.embed.watch()` – das meldet die Höhe an Pageflow und andere Hosts.
* Interaktion immer über `V.createFocus(host)`: Hover hebt hervor, Klick fixiert.
* Alles, was sich animiert, läuft über `V.tween(...)`; der Tween räumt sich selbst auf
  und stellt den Endzustand auch dann her, wenn `requestAnimationFrame` aussetzt.

---

## 4 · Veröffentlichen

Ein Befehl erledigt alles:

```bash
python tools/deploy.py "Was sich geändert hat"
```

Das baut die Website nach `docs/`, committet und pusht `main` und spiegelt `docs/`
in den Branch `gh-pages`, aus dem GitHub Pages die Seite ausliefert.

**Wie es eingerichtet ist** (bereits erledigt, nur zur Information):

* Repository: <https://github.com/abhay-ram/datavis-airbnb> (öffentlich)
* Pages-Quelle: Branch **`gh-pages`**, Ordner **`/`** – dieser Branch enthält
  denselben Inhalt wie `docs/` auf `main`, aber im Wurzelverzeichnis.
* Live-Adresse: **<https://abhay-ram.github.io/datavis-airbnb/>**

Der Branch `gh-pages` wird ausschließlich erzeugt (`git commit-tree` aus `docs/`) –
er wird nie von Hand bearbeitet. `docs/` auf `main` bleibt die lesbare Fassung,
`dist/` ist reines Build-Ergebnis und in `.gitignore`.

---

## 5 · Einbetten

**Pageflow** – iframe-Element anlegen, `…/1-linien-nach-bezirk.html?embed=1` eintragen,
*Dynamic Height* aktivieren. Die Dateien senden das `iframe.resize`-Signal selbst.
Für Datawrapper gibt es das native Element *Datawrapper chart* (URL einfügen).

**Überall sonst**

```html
<iframe src="https://abhay-ram.github.io/datavis-airbnb/4-karte-choropleth.html?embed=1"
        title="Airbnb in London – Karte" loading="lazy"
        style="width:100%;border:0;min-height:620px;display:block"></iframe>
```

**Steuerung von außen**

```js
frame.contentWindow.postMessage({ type: 'year',   years: [2026] }, '*');
frame.contentWindow.postMessage({ type: 'metric', metric: 'per1k' }, '*');
frame.contentWindow.postMessage({ type: 'focus',  codes: ['E09000033'] }, '*');
frame.contentWindow.postMessage({ type: 'step',   index: 3 }, '*');   // Stories
frame.contentWindow.postMessage({ type: 'theme',  theme: 'dark' }, '*');
```

Alle Parameter stehen in der `README.md` und im Embed-Kit (`docs/index.html`).

---

## 6 · Prüfen ohne Browser

`tools/smoke.mjs` lädt jede gebaute Datei in jsdom, ersetzt die fehlenden
Browser-APIs (`ResizeObserver`, `IntersectionObserver`, `getTotalLength`, …) und
klickt alle Bedienelemente durch: Segment-Schalter, Jahres-Chips, Hover,
Fixieren, Tastatur, Suche, Reset. Geprüft wird pro Datei in drei Durchläufen:
`?embed=1`, `?embed=1&theme=dark` und `?theme=light&metric=per1k`.

Ein Lauf gilt als bestanden, wenn **keine** Laufzeitfehler auftreten und die
Zeichenfläche danach noch gefüllt ist. Das hat schon echte Fehler gefunden:
einen Aufbau, der vor dem Datenaufbau lief, und einen Tween, der einen
späteren Neuaufbau überschrieben hat.

Screenshots zur Sichtprüfung (Chromium headless):

```bash
chrome --headless=new --disable-gpu --hide-scrollbars \
       --virtual-time-budget=6000 --window-size=1400,1000 \
       --screenshot=shots/v1.png "docs/1-linien-nach-bezirk.html?theme=light"
```

---

## 7 · Stand

Beide Datensätze sind gebaut: **zwölf Varianten** (`1`–`6` für Airbnb, `d1`–`d6` für
Demografie) plus das Embed-Kit. Sie werden getrennt aufbereitet, getrennt exportiert und
nie miteinander verknüpft.

Die Demografie-Varianten im Einzelnen:

| Datei | Inhalt |
|---|---|
| `d1-bevoelkerung-linien.html` | Bevölkerung/Dichte/Medianalter 2011–2025, X = Jahr, Y = Bezirke, Modus Rang/Wert/Index |
| `d2-altersstruktur.html` | Altersprofil in Einzeljahrgängen gegen Greater London, plus Bezirksrangliste und Geschlechterverteilung |
| `d3-bildung-herkunft-lohn.html` | 100-%-Balken für Bildung und Geburtsland, Balken plus Sparkline für den Lohn |
| `d4-karte-indikatoren.html` | Zehn Indikatoren auf der Karte, Jahresregler passt sich dem Indikator an |
| `d5-karte-wandel.html` | Divergierende Veränderungskarte plus Kleine Vielfache 2011/2018/2025 |
| `d6-scrolly-story.html` | Acht Schritte als Scroll-Story bzw. Player im Embed |

Erweitern lässt sich das nach demselben Muster: Variante anlegen, in `tools/build.py`
registrieren, `data=` auf die passende Payload setzen.
