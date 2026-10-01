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
| Airbnb | `London_Airbnb_Datawrapper_Ready_FINAL.xlsx` | `tools/prepare_data.py` | `src/generated/data.js` | `dist/1…6-*.html` |
| Demografie | `London_Demographie_Datawrapper_Ready_FINAL_demograhie.xlsx` | `tools/prepare_demography.py` | `src/generated/demography.js` | *(in Arbeit, siehe unten)* |

Die Bezirksgrenzen (`tools/cache/london_boroughs.geojson`, ONS) sind reine Geografie und
werden von beiden Datensätzen gemeinsam genutzt – sie enthalten keine Fachdaten.

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

## 7 · Offen: Datensatz 2 (Demografie)

Vorbereitet, aber bewusst **noch nicht gebaut**:

* `tools/prepare_demography.py` – liest alle Blätter des Demografie-Workbooks und
  schreibt `src/generated/demography.js` (33 Bezirke, Bevölkerung 2011–2025,
  Altersprofil in Einzeljahren, Geschlecht, Bildung 2021, Geburtsland 2021,
  Medianlohn 2002–2024).
* `src/demography.js` – Laufzeit mit Zugriffsfunktionen und Indikator-Definitionen
  (`V.demo`). Wird derzeit von keiner Variante eingebunden und stört den Betrieb nicht.

Geplant ist ein paralleler Satz aus drei Diagrammen und drei Karten, mit derselben
Mechanik und Gestaltung wie der Airbnb-Satz. Die Registrierung in `tools/build.py`
erfolgt erst, wenn die Varianten existieren.
