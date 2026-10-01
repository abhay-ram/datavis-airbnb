/* ==========================================================================
   Map 3 · Karten-Story (Scroll bzw. Player im Embed)
   Die Karte ist immer sichtbar; jeder Schritt wechselt Jahr, Messgröße,
   Darstellung und Hervorhebung.
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-stagemap]");
  var root = V.$("[data-story]");
  if (!host || !root) return;

  var YEAR_COLOR = {};
  var DOWN = "#00a699";
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function readColors() {
    YEAR_COLOR[YEARS[0]] = cssVar("--y2015", "#8fb8d8");
    YEAR_COLOR[YEARS[1]] = cssVar("--y2019", "#00a699");
    YEAR_COLOR[YEARS[2]] = cssVar("--y2026", "#fc642d");
    DOWN = cssVar("--y2019", "#00a699");
  }
  readColors();

  var svg = V.el("svg", {
    cls: "chart m3-map", viewBox: V.geoBox(),
    role: "img", "aria-label": "Karte der 33 Londoner Bezirke mit Jahresvergleich"
  }, host);
  var gPaths = V.el("g", null, svg);
  var gBub = V.el("g", null, svg);
  var gLab = V.el("g", null, svg);

  var order = BOROUGHS.slice().sort(function (a, b) {
    return (V.data.geo.areas[b.code] || 0) - (V.data.geo.areas[a.code] || 0);
  });
  var paths = {};
  order.forEach(function (b) {
    paths[b.code] = V.el("path", {
      d: V.geo.paths[b.code], cls: "bor", "data-code": b.code,
      fill: "var(--bg-sunken)", stroke: "var(--card)", "stroke-width": 1,
      "stroke-linejoin": "round", tabindex: "0", role: "button", "aria-label": b.name
    }, gPaths);
  });

  var bubbles = {}, labels = {};
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    bubbles[b.code] = V.el("circle", {
      cls: "m3-bub", cx: b.xy[0], cy: b.xy[1], r: 0,
      fill: "var(--accent)", "fill-opacity": .72, stroke: "var(--card)", "stroke-width": 1
    }, gBub);
    labels[b.code] = V.el("text", {
      cls: "m3-label", x: b.xy[0], y: b.xy[1], "text-anchor": "middle",
      "dominant-baseline": "middle"
    }, gLab);
    labels[b.code].textContent = V.shortName(b.name)
      .replace(" upon Thames", "").replace("Barking & Dagenham", "Barking & D.");
  });

  function maxAll(metric) {
    var m = 0;
    BOROUGHS.forEach(function (b) {
      YEARS.forEach(function (y) { m = Math.max(m, V.value(b, metric, y)); });
    });
    return m;
  }
  var MAX = { listings: maxAll("listings"), per1k: maxAll("per1k") };

  function fillFor(metric, v) {
    return V.ramp(V.currentRamp(), Math.sqrt(Math.max(0, v) / MAX[metric]));
  }

  function vtext(b, metric, y) {
    return metric === "per1k" ? fmt.per1k(V.per1k(b, y)) : fmt.int(V.listings(b, y));
  }

  /* ------------------------------------------------------------ stages --- */
  var OUTER = ["E09000002", "E09000004", "E09000016", "E09000029"];
  function topN(n, year, metric) {
    return BOROUGHS.slice().sort(function (a, b) {
      return V.value(b, metric, year) - V.value(a, metric, year);
    }).slice(0, n).map(function (b) { return b.code; });
  }
  var DECLINERS = BOROUGHS.filter(function (b) {
    return V.listings(b, 2026) < V.listings(b, 2019);
  }).sort(function (a, b) {
    return (V.listings(a, 2026) - V.listings(a, 2019)) - (V.listings(b, 2026) - V.listings(b, 2019));
  }).map(function (b) { return b.code; });

  var STEPS = [
    { title: "April 2015", big: "18.436", unit: "Inserate in London",
      year: 2015, metric: "listings", view: "choropleth", labels: topN(6, 2015, "listings"), focus: [] },
    { title: "Mai 2019", big: "80.767", unit: "Inserate in London",
      year: 2019, metric: "listings", view: "choropleth", labels: topN(8, 2019, "listings"), focus: [] },
    { title: "19. Juni 2026", big: "92.799", unit: "Inserate in London",
      year: 2026, metric: "listings", view: "choropleth", labels: topN(8, 2026, "listings"), focus: [] },
    { title: "Je 1.000 Einwohner:innen", big: "51,4", unit: "Westminster · Höchstwert",
      year: 2026, metric: "per1k", view: "choropleth", labels: topN(6, 2026, "per1k"),
      focus: topN(3, 2026, "per1k"), color: "year" },
    { title: "Wachstum seit 2015", big: "98×", unit: "Barking & Dagenham",
      year: 2026, metric: "listings", view: "bubbles", labels: OUTER, focus: OUTER, color: "year" },
    { title: "Rückgang seit 2019", big: "−887", unit: "Tower Hamlets",
      year: 2026, metric: "listings", view: "choropleth", labels: DECLINERS, focus: DECLINERS, color: "down" },
    { title: "19. Juni 2026", big: "92.799", unit: "Inserate in 33 Bezirken",
      year: 2026, metric: "listings", view: "choropleth", labels: topN(8, 2026, "listings"), focus: [] }
  ];

  var S = { year: YEARS[0], metric: "listings", view: "choropleth", labels: [], focus: [], color: null };
  var titleEl = V.$("[data-stagetitle]");
  var totalEl = V.$("[data-stagetotal]");
  var unitEl = V.$("[data-stageunit]");

  function paint() {
    if (S.labels === null) S.labels = [];
    var on = S.labels;
    BOROUGHS.forEach(function (b) {
      var p = paths[b.code], c = bubbles[b.code], l = labels[b.code];
      var v = V.value(b, S.metric, S.year);
      p.setAttribute("fill", S.view === "choropleth" ? fillFor(S.metric, v) : "var(--bg-sunken)");
      p.style.opacity = S.view === "choropleth" ? 1 : .92;
      if (c) {
        c.setAttribute("r", S.view === "bubbles" ? V.sqrtScale(0, MAX[S.metric], 2, 42)(v) : 0);
        c.setAttribute("fill", S.color === "down" ? DOWN : YEAR_COLOR[S.year]);
      }
      if (l) {
        var listed = on.indexOf(b.code) >= 0;
        l.style.display = listed ? "" : "none";
        l.style.opacity = listed ? 1 : 0;
      }
    });
    renderLegend();
  }

  function renderLegend() {
    var sw = V.$("[data-swatches]");
    if (sw && !sw.childNodes.length) {
      for (var i = 0; i < 7; i++) V.el("i", { style: { background: V.ramp(V.currentRamp(), i / 6) } }, sw);
    }
    var lt = V.$("[data-legendtitle]");
    if (lt) lt.textContent = (S.view === "bubbles" ? "Blase · " : "Fläche · ") +
      (S.metric === "per1k" ? "Inserate je 1.000 Einw." : "Inserate") + " · " + S.year;
    var hi = V.$("[data-legendmax]");
    if (hi) hi.textContent = S.metric === "per1k" ? fmt.per1k(MAX.per1k) : fmt.int(MAX.listings);
  }

  var storyStep = 0;
  function setStage(i) {
    var st = STEPS[i] || STEPS[0];
    storyStep = i;
    S.year = st.year; S.metric = st.metric; S.view = st.view;
    S.labels = st.labels || []; S.color = st.color || null;
    if (titleEl) titleEl.textContent = st.title;
    if (totalEl) {
      totalEl.textContent = st.big;
      totalEl.classList.remove("pop");
      void totalEl.offsetWidth;
      totalEl.classList.add("pop");
    }
    if (unitEl) unitEl.textContent = st.unit;
    paint();
    focus.set(st.focus || []);
  }

  /* ------------------------------------------------------------- focus --- */
  var focus = V.createFocus(host);
  function applyFocus() {
    svg.classList.toggle("has-focus", focus.any());
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code), pinned = focus.store.pinned.has(b.code);
      paths[b.code].classList.toggle("is-hot", hot);
      paths[b.code].classList.toggle("is-pinned", pinned);
      if (bubbles[b.code]) bubbles[b.code].classList.toggle("is-hot", hot);
      if (labels[b.code] && S.labels.indexOf(b.code) >= 0) {
        labels[b.code].style.opacity = !focus.any() || hot ? 1 : .25;
      }
    });
    if (focus.any()) {
      focus.store.codes.forEach(function (code) {
        if (labels[code]) { labels[code].style.display = ""; labels[code].style.opacity = 1; }
      });
    }
  }
  host.addEventListener("viz:focus", applyFocus);

  Object.keys(paths).forEach(function (code) {
    var p = paths[code];
    p.addEventListener("pointerenter", function (e) { focus.hoverOn(code); showTip(code, e.clientX || 0, e.clientY || 0); });
    p.addEventListener("pointermove", function (e) { showTip(code, e.clientX || 0, e.clientY || 0); });
    p.addEventListener("pointerleave", function () { focus.hoverOff(code); V.tip().hide(); });
    p.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(code); });
    p.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focus.toggle(code); }
    });
    p.addEventListener("focus", function () { focus.hoverOn(code); });
    p.addEventListener("blur", function () { focus.hoverOff(code); });
  });
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  function showTip(code, x, y) {
    var b = V.byCode[code];
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + V.meta.snapshots[String(S.year)] + " · Rang " +
      V.rankOf(code, S.metric, S.year) + " von 33</div>";
    YEARS.forEach(function (yy) {
      html += '<div class="tip-row"' + (yy === S.year ? "" : ' style="opacity:.55"') + ">" +
        '<span class="k"><i style="background:' + YEAR_COLOR[yy] + '"></i>' + yy + "</span>" +
        '<span class="v">' + vtext(b, S.metric, yy) + "</span></div>";
    });
    var g = V.growth(b, S.metric, YEARS[0], YEARS[2]);
    html += '<div class="tip-foot">2015 → 2026: <strong>' + fmt.signedPct(g.pct) + "</strong> · " +
      fmt.int(b.pop["2026"]) + " Einwohner:innen</div>";
    V.tip().show(html, x, y);
  }
  void storyStep;

  /* -------------------------------------------------------------- story -- */
  paint();

  /* Erst aufbauen, dann den Einbettungsmodus anwenden - createStory muss
     wissen, ob es in einem iframe läuft. */
  V.embed.markReady();
  V.embed.init();
  V.reveal();
  paint();

  var story = V.createStory({
    root: root,
    steps: "[data-step]",
    nav: "[data-nav]",
    onStep: function (i) { setStage(i); }
  });

  V.embed.on("step", function (d) { if (typeof d.index === "number") story.go(d.index); });
  V.embed.on("year", function (d) {
    if (d.years && d.years.length) { S.year = d.years[d.years.length - 1]; paint(); }
  });
  V.embed.on("metric", function (d) {
    if (d.metric === "listings" || d.metric === "per1k") { S.metric = d.metric; paint(); }
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors();
    DOWN = cssVar("--y2019", "#00a699");
    var sw = V.$("[data-swatches]");
    if (sw) V.clear(sw);
    paint();
  });

  V.embed.watch();
})();
