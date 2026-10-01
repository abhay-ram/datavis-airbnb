/* ==========================================================================
   Embed-Kit · Karten, Snippets, Kopier-Buttons
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;

  var VARIANTS = [
    { file: "1-linien-nach-bezirk.html", kind: "chart", tag: "Linien",
      title: "Linien nach Bezirk",
      desc: "Die gesuchte Variante: X-Achse Jahr, Y-Achse alle 33 Bezirke. Umschaltbar zwischen Rang, Wert und Anteil, mit Jahresfilter, Suche und fixierbaren Bezirken." },
    { file: "2-slope-und-balken.html", kind: "chart", tag: "Balken + Slope",
      title: "Rangliste & Verläufe",
      desc: "Balken wandern beim Jahreswechsel an ihren neuen Platz; daneben der Verlauf jedes Bezirks über alle drei Stichtage und die größten Bewegungen." },
    { file: "3-scrolly-story-linien.html", kind: "chart", tag: "Story · Balken",
      title: "Scroll-Story in Diagrammen",
      desc: "Sieben Schritte als Pageflow-artige Geschichte: Balken wachsen, sortieren sich neu und heben einzelne Bezirke hervor. Im Embed läuft sie als Player." },
    { file: "4-karte-choropleth.html", kind: "map", tag: "Karte",
      title: "Choroplethenkarte",
      desc: "Echte ONS-Bezirksgrenzen, eingefärbt nach Angebot. Jahresumschaltung, Zeitachse zum Abspielen, wahlweise Flächen oder Blasen." },
    { file: "5-karte-bubbles.html", kind: "map", tag: "Karte",
      title: "Blasenkarte & Vielfache",
      desc: "Proportionale Blasen im Bezirkszentrum plus drei synchronisierte Mini-Karten – eine je Stichtag, auf gemeinsamer Größenskala." },
    { file: "6-scrolly-story-karte.html", kind: "map", tag: "Story · Karte",
      title: "Scroll-Story auf der Karte",
      desc: "Sieben Schritte über die Karte: Konzentration, Wachstum, Pro-Kopf-Dichte, der Stadtrand und die drei Bezirke mit Rückgang." }
  ];

  var FILES = [
    { n: "airbnb-london-long.csv", t: "csv", s: "16,6 KB", set: "Airbnb",
      d: "Bereinigte Langfassung: eine Zeile je Bezirk × Stichtag, mit Einwohnerzahlen und Koordinaten. Basis für Tableau und für Datawrapper-Symbolkarten." },
    { n: "airbnb-london-wide.csv", t: "csv", s: "3,7 KB", set: "Airbnb",
      d: "Ein Bezirk pro Zeile, die drei Stichtage als Spalten plus absolute und prozentuale Veränderungen. Ideal für Datawrapper-Linien- und Balkendiagramme." },
    { n: "airbnb-london-map.csv", t: "csv", s: "3,6 KB", set: "Airbnb",
      d: "Auf den Kartenschlüssel reduziert: Area Code, Bezirk, Jahr, Inserate und Inserate je 1.000 – zum Verbinden mit dem GeoJSON." },
    { n: "demografie-bevoelkerung-lang.csv", t: "csv", s: "44,6 KB", set: "Demografie",
      d: "Bevölkerung, Dichte und Medianalter je Bezirk und Jahr, 2011–2025 (495 Zeilen)." },
    { n: "demografie-bezirksprofil.csv", t: "csv", s: "4,2 KB", set: "Demografie",
      d: "Ein Bezirk pro Zeile: Bevölkerung, Dichte, Medianalter, Alters- und Geschlechteranteile, Bildung, Herkunft und Medianlohn." },
    { n: "demografie-altersstruktur.csv", t: "csv", s: "125 KB", set: "Demografie",
      d: "Altersstruktur in Einzeljahren (0–90+) je Bezirk für 2025 – die Basis des Altersprofils." },
    { n: "demografie-lohn-lang.csv", t: "csv", s: "48,6 KB", set: "Demografie",
      d: "Median-Bruttowochenverdienst je Bezirk und Jahr, 2002–2024, inklusive der nicht veröffentlichten Werte." },
    { n: "london-boroughs.geojson", t: "geo", s: "126 KB", set: "Geometrie",
      d: "ONS-Bezirksgrenzen in WGS84, alle Ringe als MultiPolygon. Für Datawrapper-Custom-Maps und als Tableau-Spatial-File. Gilt für beide Datensätze." },
    { n: "london-boroughs-lite.geojson", t: "geo", s: "32 KB", set: "Geometrie",
      d: "Dieselben Grenzen, auf rund 180 m vereinfacht – für kleine Karten und schnelle Ladezeiten." }
  ];

  /* ------------------------------------------------------------ cards ---- */
  var frames = [];
  var DEMO = [
    { file: "d1-bevoelkerung-linien.html", kind: "chart", tag: "Linien",
      title: "Bevölkerungsentwicklung",
      desc: "X-Achse Jahr 2011–2025, Y-Achse alle 33 Bezirke – als Rang, Wert oder Index. Mit Zeitraum-Regler, Suche und fixierbaren Bezirken." },
    { file: "d2-altersstruktur.html", kind: "chart", tag: "Altersprofil",
      title: "Altersstruktur",
      desc: "Jeder Jahrgang von 0 bis 90+ als Anteil an der Bevölkerung, für einen gewählten Bezirk im Vergleich zu ganz London." },
    { file: "d3-bildung-herkunft-lohn.html", kind: "chart", tag: "Balken",
      title: "Bildung, Herkunft, Lohn",
      desc: "Auf 100 Prozent normierte Balken je Bezirk – umschaltbar zwischen Bildungsabschluss, Geburtsland und der Lohnentwicklung seit 2002." },
    { file: "d4-karte-indikatoren.html", kind: "map", tag: "Karte",
      title: "Indikatorenkarte",
      desc: "Zehn Merkmale auf echten ONS-Grenzen, mit Jahresregler, Flächen- oder Blasendarstellung und Verlauf im Detailfeld." },
    { file: "d5-karte-wandel.html", kind: "map", tag: "Karte",
      title: "Karte des Wandels",
      desc: "Bevölkerungsveränderung als divergierende Karte – um null zentriert – plus drei Kleine Vielfache für 2011, 2018 und 2025." },
    { file: "d6-scrolly-story.html", kind: "map", tag: "Story · Karte",
      title: "Demografie-Story",
      desc: "Acht Schritte von der Bevölkerungszahl über Alter und Bildung bis zum Lohn. Im Embed läuft sie als Player mit Tastatursteuerung." }
  ];

  function renderCards(grid, list) {
    if (!grid) return;
    list.forEach(function (v, i) {
      var card = V.el("article", { cls: "kit-card reveal", "data-delay": String(Math.min(4, i)) }, grid);
      var head = V.el("div", { cls: "kit-card-head" }, card);
      V.el("span", {
        cls: "kit-card-tag" + (v.kind === "map" ? " t-map" : ""),
        text: (v.kind === "map" ? "Karte" : "Diagramm") + " · " + v.tag
      }, head);
      V.el("h3", { cls: "kit-card-title", text: v.title }, head);
      V.el("p", { cls: "kit-card-desc", text: v.desc }, head);

      var prev = V.el("div", { cls: "kit-card-preview" }, card);
      var ifr = V.el("iframe", {
        src: v.file + "?embed=1&theme=light",
        title: "Vorschau: " + v.title,
        loading: "lazy", scrolling: "no", tabindex: "-1", "aria-hidden": "true"
      }, prev);
      frames.push({ iframe: ifr, box: prev });

      var foot = V.el("div", { cls: "kit-card-foot" }, card);
      V.el("a", { cls: "kit-link kit-link--primary", href: v.file, target: "_blank", rel: "noopener", text: "Öffnen" }, foot);
      V.el("a", { cls: "kit-link", href: v.file + "?embed=1", target: "_blank", rel: "noopener", text: "?embed=1" }, foot);
      var cp = V.el("button", { cls: "kit-link", type: "button", text: "Snippet kopieren" }, foot);
      V.el("span", { cls: "kit-hint", text: v.file }, foot);
      cp.addEventListener("click", function () {
        copyText(snippet(v.file, v.title), cp, "Snippet kopieren");
      });
      prev.addEventListener("click", function () {
        window.open(v.file + "?embed=1", "_blank", "noopener");
      });
    });
  }

  renderCards(V.$("[data-cards]"), VARIANTS);
  renderCards(V.$("[data-cards-demo]"), DEMO);

  /* Vorschauen massstabsgetreu in die Kachel einpassen */
  var PREVIEW_H = 250;
  function fitPreviews() {
    var narrow = window.innerWidth < 720;
    var h = narrow ? 200 : PREVIEW_H;
    frames.forEach(function (f) {
      var w = f.box.clientWidth || 420;
      var s = w / 1000;
      f.iframe.style.transform = "scale(" + s.toFixed(4) + ")";
      f.iframe.style.height = Math.round(h / s) + "px";
      f.box.style.height = h + "px";
    });
  }
  fitPreviews();
  setTimeout(fitPreviews, 60);
  setTimeout(fitPreviews, 600);

  /* Vorschauen nach dem Laden freischalten, damit man direkt klicken kann */
  setTimeout(function () {
    frames.forEach(function (f) { f.box.classList.add("is-live"); });
  }, 1200);

  var grid = V.$("[data-cards]");
  var refit = V.debounce(fitPreviews, 140);
  if ("ResizeObserver" in window && grid) {
    try { new ResizeObserver(refit).observe(grid); } catch (e) { /* noop */ }
  }
  window.addEventListener("resize", refit);

  /* ------------------------------------------------------------ files ---- */
  var filesHost = V.$("[data-files]");
  if (filesHost) {
    FILES.forEach(function (f) {
      var a = V.el("a", { cls: "kit-file", href: "data/" + f.n, download: f.n, target: "_blank", rel: "noopener" }, filesHost);
      V.el("span", { cls: "ico " + f.t, text: f.t === "csv" ? "CSV" : "GEO" }, a);
      var mid = V.el("span", null, a);
      V.el("div", { cls: "nm" }, mid).appendChild(document.createTextNode(f.n));
      V.el("div", { cls: "ds" }, mid).appendChild(document.createTextNode(
        (f.set ? f.set + " · " : "") + f.d));
      V.el("span", { cls: "sz", text: f.s }, a);
    });
  }

  /* --------------------------------------------------------- snippets ---- */
  var LOCAL = window.location.protocol === "file:";
  function base() {
    var loc = window.location;
    if (LOCAL) return "https://IHRE-DOMAIN.de/";
    return loc.origin + loc.pathname.replace(/index\.html$/, "").replace(/\/$/, "/");
  }
  function snippet(file, title) {
    return [
      '<iframe',
      '  src="' + base() + file + '?embed=1"',
      '  title="' + title + '"',
      '  loading="lazy"',
      '  style="width:100%;border:0;min-height:620px;display:block"',
      '  allowfullscreen></iframe>'
    ].join("\n");
  }

  var urlText = V.$("[data-urltext]");
  if (urlText) urlText.textContent = base() + "1-linien-nach-bezirk.html?embed=1";
  var snip = V.$("[data-snippet]");
  if (snip) snip.textContent = snippet("1-linien-nach-bezirk.html", "Airbnb in London – Linien nach Bezirk");

  /* Lokal geöffnet lässt sich keine echte Adresse ableiten - dann deutlich
     darauf hinweisen, dass der Platzhalter ersetzt werden muss. */
  if (LOCAL) {
    var note = V.el("p", { cls: "kit-p kit-p--muted" });
    note.innerHTML = "Diese Seite wurde direkt aus einer Datei geöffnet. Sobald der Ordner " +
      "<code>dist/</code> auf einem Webspace oder bei GitHub Pages liegt, steht hier " +
      "automatisch die echte Adresse. Bis dahin im Code <code>IHRE-DOMAIN.de</code> ersetzen.";
    var host = V.$("[data-urlbox]");
    if (host && host.parentNode) host.parentNode.insertBefore(note, host.nextSibling);
    var s2 = V.$("[data-snippet]");
    if (s2 && s2.parentNode && s2.parentNode.parentNode) {
      var n2 = V.el("p", { cls: "kit-p kit-p--muted", text: "Platzhalter IHRE-DOMAIN.de durch die eigene Adresse ersetzen." });
      s2.parentNode.parentNode.insertBefore(n2, s2.parentNode.nextSibling);
    }
  }

  /* ------------------------------------------------------------ copy ----- */
  function mark(btn, label) {
    if (!btn) return;
    var old = label || btn.textContent;
    btn.classList.add("is-done");
    btn.textContent = "Kopiert";
    setTimeout(function () { btn.classList.remove("is-done"); btn.textContent = old; }, 1600);
  }
  function copyText(text, btn, label) {
    var done = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        done = true;
      }
    } catch (e) { done = false; }
    if (!done) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        done = document.execCommand && document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e2) { done = false; }
    }
    mark(btn, label);
  }

  V.$$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.parentNode;
      var pre = box ? box.querySelector("pre") : null;
      copyText(pre ? pre.textContent : "", btn);
    });
  });

  /* ------------------------------------------------------- live filter --- */
  V.embed.init();
  V.reveal();
})();
