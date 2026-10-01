/* ==========================================================================
   Map 1 · Choroplethen- und Blasenkarte mit Jahresumschaltung
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var S = { metric: "listings", year: YEARS[YEARS.length - 1], view: "choropleth" };

  var host = V.$("[data-map]");
  if (!host) return;

  var YEAR_COLOR = {};
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function readColors() {
    YEAR_COLOR[YEARS[0]] = cssVar("--y2015", "#8fb8d8");
    YEAR_COLOR[YEARS[1]] = cssVar("--y2019", "#00a699");
    YEAR_COLOR[YEARS[2]] = cssVar("--y2026", "#fc642d");
  }
  readColors();

  var svg = V.el("svg", {
    cls: "chart m1-map", viewBox: V.geoBox(),
    role: "img", "aria-label": "Karte der 33 Londoner Bezirke"
  }, host);
  var gPaths = V.el("g", null, svg);
  var gBub = V.el("g", null, svg);
  var gLabels = V.el("g", null, svg);

  /* kleine Bezirke zuletzt zeichnen, damit sie anklickbar bleiben */
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

  var bubbles = {};
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    bubbles[b.code] = V.el("circle", {
      cls: "bub", "data-code": b.code, cx: b.xy[0], cy: b.xy[1], r: 0,
      fill: "var(--accent)", "fill-opacity": .78, stroke: "var(--card)", "stroke-width": 1,
      style: { cursor: "pointer" }
    }, gBub);
  });

  var labels = {};
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    labels[b.code] = V.el("text", {
      cls: "map-label", x: b.xy[0], y: b.xy[1],
      "text-anchor": "middle", "dominant-baseline": "middle",
      "paint-order": "stroke", stroke: "rgba(0,0,0,.55)", "stroke-width": 2.4,
      "stroke-linejoin": "round"
    }, gLabels);
    labels[b.code].textContent = V.shortName(b.name);
  });

  /* ------------------------------------------------------------ scales --- */
  function maxAll(metric) {
    var m = 0;
    BOROUGHS.forEach(function (b) {
      YEARS.forEach(function (y) { m = Math.max(m, V.value(b, metric, y)); });
    });
    return m;
  }
  var MAX = { listings: maxAll("listings"), per1k: maxAll("per1k") };

  function color(v) {
    /* Wurzelskala: die Werte sind extrem schief, linear wäre 2015 unsichtbar.
       Die Skala ist über alle drei Jahre fixiert, damit die Jahre vergleichbar
       bleiben. */
    var t = Math.sqrt(Math.max(0, v) / MAX[S.metric]);
    return V.ramp(V.currentRamp(), t);
  }
  function values(metric, year) {
    return BOROUGHS.map(function (b) { return V.value(b, metric, year); });
  }

  function vtext(b, metric, y) {
    return metric === "per1k" ? fmt.per1k(V.per1k(b, y)) : fmt.int(V.listings(b, y));
  }

  /* ------------------------------------------------------------- render -- */
  function render(animate) {
    var metric = S.metric, year = S.year;
    var bScale = V.sqrtScale(0, MAX[metric], 1.5, 34);

    BOROUGHS.forEach(function (b) {
      var v = V.value(b, metric, year);
      var p = paths[b.code], c = bubbles[b.code], l = labels[b.code];
      if (S.view === "choropleth") {
        p.style.opacity = 1;
        p.setAttribute("fill", color(v));
        p.style.pointerEvents = "auto";
        if (c) { c.setAttribute("r", 0); c.style.pointerEvents = "none"; }
        if (l) l.style.display = "";
      } else {
        p.setAttribute("fill", "var(--bg-sunken)");
        p.style.opacity = .9;
        if (c) {
          c.setAttribute("r", bScale(v));
          c.setAttribute("fill", YEAR_COLOR[year]);
          c.style.pointerEvents = "auto";
        }
        if (l) l.style.display = "none";
      }
      if (l) l.style.opacity = 0;
    });

    /* Labels nur für die Spitzengruppe, sonst wird die Karte unlesbar */
    var top = BOROUGHS.slice().sort(function (a, b) {
      return V.value(b, metric, year) - V.value(a, metric, year);
    }).slice(0, S.view === "choropleth" ? 8 : 5);
    top.forEach(function (b) {
      if (!labels[b.code]) return;
      labels[b.code].style.opacity = 1;
      labels[b.code].classList.remove("out");
    });

    renderLegend();
    renderRank();
    renderTotals();
    renderDetail();
  }

  function renderLegend() {
    var sw = V.$("[data-swatches]");
    if (sw && !sw.childNodes.length) {
      for (var i = 0; i < 7; i++) {
        var t = i / 6;
        V.el("i", { style: { background: V.ramp(V.currentRamp(), t) } }, sw);
      }
    } else if (sw) {
      Array.prototype.forEach.call(sw.childNodes, function (n, i) {
        n.style.background = V.ramp(V.currentRamp(), i / 6);
      });
    }
    var lt = V.$("[data-legendtitle]");
    if (lt) lt.textContent = (S.view === "choropleth" ? "Fläche" : "Blase") + " · " +
      (S.metric === "per1k" ? "Inserate je 1.000 Einw." : "Inserate") + " · " + S.year;
    var lo = V.$("[data-legendmin]"), hi = V.$("[data-legendmax]");
    if (lo) lo.textContent = "0";
    if (hi) hi.textContent = S.metric === "per1k" ? fmt.per1k(MAX.per1k) : fmt.int(MAX.listings);
  }

  function renderRank() {
    var box = V.$("[data-rank]");
    if (!box) return;
    var list = BOROUGHS.slice().sort(function (a, b) {
      return V.value(b, S.metric, S.year) - V.value(a, S.metric, S.year);
    }).slice(0, 12);
    var max = list.length ? V.value(list[0], S.metric, S.year) : 1;
    V.clear(box);
    list.forEach(function (b, i) {
      var v = V.value(b, S.metric, S.year);
      var pinned = focus.store.pinned.has(b.code);
      var row = V.el("button", {
        cls: "m1-rankrow" + (pinned ? " is-pinned" : ""), type: "button",
        "data-code": b.code, "aria-pressed": pinned ? "true" : "false",
        style: { opacity: focus.any() && !focus.has(b.code) ? .4 : 1 }
      }, box);
      V.el("span", { cls: "rk", text: String(i + 1) }, row);
      V.el("span", { cls: "nm", text: V.shortName(b.name) }, row);
      V.el("span", { cls: "vv", text: vtext(b, S.metric, S.year) }, row);
      var bar = V.el("span", { cls: "bar" }, row);
      V.el("i", { style: { width: (v / max * 100) + "%", background: color(v) } }, bar);
      row.addEventListener("click", function () { focus.toggle(b.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(b.code); });
    });
  }

  function renderTotals() {
    var box = V.$("[data-totals]");
    if (!box) return;
    V.clear(box);
    YEARS.forEach(function (y) {
      var d = V.el("div", { cls: "m1-tot" }, box);
      var l = V.el("span", { cls: "lbl" }, d);
      V.el("i", { style: { background: YEAR_COLOR[y] } }, l);
      l.appendChild(document.createTextNode(V.meta.snapshots[String(y)]));
      V.el("span", { cls: "val", text: fmt.int(V.totals[y]) }, d);
    });
  }

  function renderDetail() {
    var card = V.$("[data-detail]");
    var wrap = V.$("[data-detailcard]");
    if (!card || !wrap) return;
    var pinned = Array.from(focus.store.pinned);
    var code = pinned.length ? pinned[pinned.length - 1] : null;
    if (!code) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var b = V.byCode[code];
    V.clear(card);

    var head = V.el("div", { cls: "m1-detail-head" }, card);
    V.el("div", { cls: "m1-detail-name", text: b.name }, head);
    V.el("div", { cls: "m1-detail-meta", text: "Rang " + V.rankOf(code, S.metric, S.year) + " von 33" }, head);

    /* Mini-Verlauf */
    var w = 240, h = 74, pl = 6, pr = 6, pt = 12, pb = 16;
    var mini = V.el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Verlauf von " + b.name }, card);
    var mx = MAX[S.metric];
    var xs = [pl, pl + (w - pl - pr) / 2, w - pr];
    var ys = YEARS.map(function (y) {
      return pt + (1 - Math.sqrt(V.value(b, S.metric, y) / mx)) * (h - pt - pb);
    });
    V.el("line", { cls: "grid-line", x1: pl, x2: w - pr, y1: h - pb, y2: h - pb }, mini);
    V.el("path", {
      d: "M" + xs.map(function (x, i) { return x + " " + ys[i].toFixed(1); }).join("L"),
      fill: "none", stroke: YEAR_COLOR[YEARS[YEARS.length - 1]], "stroke-width": 2,
      "stroke-linecap": "round", "stroke-linejoin": "round"
    }, mini);
    YEARS.forEach(function (y, i) {
      V.el("circle", { cx: xs[i], cy: ys[i], r: S.year === y ? 4.4 : 3.2, fill: YEAR_COLOR[y], stroke: "var(--card)", "stroke-width": 1.5 }, mini);
      V.el("text", { x: xs[i], y: h - 3, "text-anchor": "middle", "font-size": 9.5, fill: "var(--text-mute)", text: y }, mini);
    });

    var kv = V.el("div", { cls: "m1-kv" }, card);
    YEARS.forEach(function (y) {
      var r = V.el("div", null, kv);
      V.el("span", { cls: "k", text: V.meta.snapshots[String(y)] }, r);
      V.el("span", { cls: "v", text: vtext(b, S.metric, y) }, r);
    });
    var g = V.growth(b, S.metric, YEARS[0], YEARS[YEARS.length - 1]);
    var r2 = V.el("div", null, kv);
    V.el("span", { cls: "k", text: "2015 → 2026" }, r2);
    V.el("span", { cls: "v", text: fmt.signedPct(g.pct) + " (" + fmt.factor(g.factor) + ")" }, r2);
    var r3 = V.el("div", null, kv);
    V.el("span", { cls: "k", text: "Einwohner:innen 2025" }, r3);
    V.el("span", { cls: "v", text: fmt.int(b.pop["2026"]) }, r3);

    var clr = V.el("button", { cls: "btn m1-clear", type: "button", text: "Auswahl aufheben" }, card);
    clr.addEventListener("click", function () { focus.clear(); });
  }

  /* -------------------------------------------------------------- focus -- */
  var focus = V.createFocus(host);
  function applyFocus() {
    svg.classList.toggle("has-focus", focus.any());
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code);
      var pinned = focus.store.pinned.has(b.code);
      paths[b.code].classList.toggle("is-hot", hot);
      paths[b.code].classList.toggle("is-pinned", pinned);
      if (bubbles[b.code]) {
        bubbles[b.code].classList.toggle("is-hot", hot);
        bubbles[b.code].setAttribute("fill-opacity", hot ? 1 : .78);
      }
    });
    renderRank();
    renderDetail();
  }
  host.addEventListener("viz:focus", applyFocus);
  host.addEventListener("click", function (e) {
    if (e.target === svg) focus.clear();
  });

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
  Object.keys(bubbles).forEach(function (code) {
    var c = bubbles[code];
    c.addEventListener("pointerenter", function (e) { focus.hoverOn(code); showTip(code, e.clientX || 0, e.clientY || 0); });
    c.addEventListener("pointermove", function (e) { showTip(code, e.clientX || 0, e.clientY || 0); });
    c.addEventListener("pointerleave", function () { focus.hoverOff(code); V.tip().hide(); });
    c.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(code); });
  });

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
    html += '<div class="tip-foot">' + fmt.int(b.pop["2026"]) + " Einwohner:innen (ONS 2025)</div>";
    V.tip().show(html, x, y);
  }

  /* ------------------------------------------------------------ controls - */
  var yearSeg = V.$('[data-seg="year"]');
  var yearBtns = {};
  function buildYearSeg() {
    V.clear(yearSeg);
    YEARS.forEach(function (y) {
      var btn = V.el("button", { type: "button", "data-v": String(y), "aria-pressed": "false" }, yearSeg);
      btn.textContent = String(y);
      btn.addEventListener("click", function () {
        if (S.year === y) return;
        stopPlay();
        S.year = y;
        updateYearSeg();
        render(true);
      });
      yearBtns[y] = btn;
    });
    updateYearSeg();
  }
  function updateYearSeg() {
    YEARS.forEach(function (y) {
      var b = yearBtns[y];
      if (!b) return;
      var on = S.year === y;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.style.background = on ? YEAR_COLOR[y] : "";
      b.style.color = on ? "#fff" : "";
    });
  }

  var playBtn = V.$("[data-play]");
  var playLabel = V.$("[data-playlabel]");
  var playTimer = null;
  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    if (playBtn) { playBtn.classList.remove("is-playing"); }
    if (playLabel) playLabel.textContent = "Abspielen";
  }
  if (playBtn) {
    playBtn.addEventListener("click", function () {
      if (playTimer) { stopPlay(); return; }
      playBtn.classList.add("is-playing");
      if (playLabel) playLabel.textContent = "Stoppen";
      S.year = YEARS[0];
      updateYearSeg(); render(true);
      var i = 0;
      playTimer = setInterval(function () {
        i++;
        if (i >= YEARS.length) { stopPlay(); return; }
        S.year = YEARS[i];
        updateYearSeg(); render(true);
      }, 1900);
    });
  }

  V.$$('[data-seg="metric"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="metric"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.metric = btn.getAttribute("data-v");
      render(true);
    });
  });
  V.$$('[data-seg="view"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="view"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.view = btn.getAttribute("data-v");
      render(true);
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    stopPlay();
    S.metric = "listings"; S.view = "choropleth"; S.year = YEARS[YEARS.length - 1];
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "listings" ? "true" : "false"); });
    V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "choropleth" ? "true" : "false"); });
    focus.clear();
    updateYearSeg(); render(true);
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors();
    var sw = V.$("[data-swatches]");
    if (sw) V.clear(sw);
    updateYearSeg(); render(false);
  });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
    stopPlay();
    S.year = d.years[d.years.length - 1];
    updateYearSeg(); render(true);
  });
  V.embed.on("metric", function (d) {
    if (d.metric !== "listings" && d.metric !== "per1k") return;
    S.metric = d.metric;
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === d.metric ? "true" : "false"); });
    render(true);
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  /* --------------------------------------------------------------- init -- */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("metric") === "per1k") S.metric = "per1k";
  if (p("view") === "bubbles") S.view = "bubbles";
  var py = parseInt(p("year") || "", 10);
  if (YEARS.indexOf(py) >= 0) S.year = py;
  V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
  V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.view ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildYearSeg();
  render(false);
  focus.hoverOff(null);
  applyFocus();

  V.embed.markReady();
  V.embed.init();
  render(false);

  V.embed.watch();
})();
