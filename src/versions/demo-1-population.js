/* ==========================================================================
   Demo 1 · Bevölkerungsentwicklung
   X-Achse = Jahr (2011–2025), Y-Achse = die 33 Bezirke
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;
  var ALL_YEARS = D.popYears;

  var host = V.$("[data-chart]");
  if (!host) return;
  host.classList.add("d1-chart");

  /* ---------------------------------------------------------- Zustand ---- */
  var METRICS = [
    { id: "pop", label: "Bevölkerung", short: "Bevölkerung", unit: "Personen",
      get: D.pop, fmt: fmt.int, axis: fmt.compact, dec: 0,
      note: "Mid-Year Population Estimates des ONS." },
    { id: "density", label: "Dichte", short: "Dichte", unit: "Personen je km²",
      get: D.density, fmt: fmt.int, axis: fmt.compact, dec: 0,
      note: "Einwohner:innen je Quadratkilometer." },
    { id: "medianAge", label: "Medianalter", short: "Medianalter", unit: "Jahre",
      get: D.medianAge, fmt: function (v) { return fmt.dec(v, 1); },
      axis: function (v) { return fmt.dec(v, 0); }, dec: 1,
      note: "Medianalter der Bevölkerung in Jahren." }
  ];
  function metric() {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].id === S.metric) return METRICS[i];
    return METRICS[0];
  }

  var S = {
    metric: "pop", mode: "rank", topN: 0, q: "",
    from: ALL_YEARS[0], to: ALL_YEARS[ALL_YEARS.length - 1]
  };

  function years() {
    return ALL_YEARS.filter(function (y) { return y >= S.from && y <= S.to; });
  }
  function val(b, y) { return metric().get(b, y); }
  function vtext(b, y) {
    var v = val(b, y);
    if (v == null) return "–";
    return S.metric === "medianAge" ? fmt.dec(v, 1) : fmt.int(v);
  }

  /* -------------------------------------------------------- Zeichenfläche - */
  var svg = V.el("svg", {
    cls: "chart d1-chart", role: "img",
    "aria-label": "Liniendiagramm der Bevölkerungsentwicklung in 33 Londoner Bezirken"
  }, host);
  var defs = V.el("defs", null, svg);
  var gGrid = V.el("g", null, svg);
  var gMarks = V.el("g", null, svg);
  var gAxes = V.el("g", null, svg);

  var LANE = 24, geom = {};
  var marks = {}, rows = [];

  function measure(n) {
    var w = Math.max(320, host.clientWidth || 900);
    var narrow = w < 640;
    geom.w = w;
    geom.padLeft = narrow ? 100 : w < 900 ? 126 : 150;
    geom.padRight = narrow ? 60 : 84;
    geom.padTop = 44;
    geom.padBottom = 30;
    geom.plotW = Math.max(120, w - geom.padLeft - geom.padRight);
    geom.lane = LANE;
    geom.h = S.mode === "rank"
      ? geom.padTop + Math.max(1, n) * LANE + geom.padBottom
      : Math.max(280, geom.padTop + Math.max(1, n) * (narrow ? 15 : 19) + geom.padBottom);
    svg.setAttribute("viewBox", "0 0 " + geom.w + " " + geom.h);
    svg.setAttribute("width", geom.w);
    svg.setAttribute("height", geom.h);
    svg.style.height = geom.h + "px";
  }

  /* ------------------------------------------------------------ Auswahl -- */
  function order() {
    var last = years()[years().length - 1];
    return BOROUGHS.slice().sort(function (a, b) {
      var va = val(a, last), vb = val(b, last);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
  }
  function localRank(y) {
    var sorted = rows.slice().sort(function (a, b) {
      var va = val(a, y), vb = val(b, y);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
    var m = {};
    sorted.forEach(function (b, i) { m[b.code] = i; });
    return m;
  }
  function baseYear() { return years()[0]; }

  var yScale = null, ticks = [];
  function computeScale() {
    var ys = years();
    var lo = Infinity, hi = -Infinity;
    rows.forEach(function (b) {
      ys.forEach(function (y) {
        var v = val(b, y);
        if (v == null) return;
        if (S.mode === "index") {
          var base = val(b, baseYear());
          if (!base) return;
          v = (v / base) * 100;
        }
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      });
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    var pad = (hi - lo) * 0.08 || 1;
    ticks = V.niceTicks(hi + pad, 5);
    var top = ticks[ticks.length - 1] || 1;
    var bottom = S.mode === "index" ? Math.min(90, Math.floor(lo - pad)) : 0;
    if (bottom < 0) bottom = 0;
    yScale = V.linear(bottom, top, geom.h - geom.padBottom, geom.padTop);
    geom.yMin = bottom; geom.yMax = top;
  }
  function valueAt(b, y) {
    var v = val(b, y);
    if (v == null) return null;
    if (S.mode === "index") {
      var base = val(b, baseYear());
      if (!base) return null;
      return (v / base) * 100;
    }
    return v;
  }

  function xAt(i, n) {
    if (n <= 1) return geom.padLeft + geom.plotW / 2;
    return geom.padLeft + (geom.plotW * i) / (n - 1);
  }

  /* -------------------------------------------------------------- Aufbau - */
  function build() {
    BOROUGHS.forEach(function (b) {
      var g = V.el("g", { cls: "d1-mark mark", "data-code": b.code, tabindex: "0", role: "button", "aria-label": b.name }, gMarks);
      var mk = { g: g, code: b.code, cur: {}, dots: {} };
      mk.leader = V.el("line", { cls: "d1-leader", stroke: "var(--line-strong)", "stroke-width": 1 }, g);
      mk.path = V.el("path", { cls: "d1-line", stroke: "var(--accent)" }, g);
      mk.hit = V.el("path", { cls: "mark-hit", fill: "none", stroke: "transparent", "stroke-width": 14, style: { cursor: "pointer" } }, g);
      mk.name = V.el("text", { cls: "mark-name", "text-anchor": "end", "dominant-baseline": "middle" }, g);
      mk.name.textContent = b.short;
      mk.val = V.el("text", { cls: "d1-val mark-value", "text-anchor": "start", "dominant-baseline": "middle" }, g);
      marks[b.code] = mk;

      var cd = b.code;
      g.addEventListener("pointerenter", function (e) { focus.hoverOn(cd); showTip(cd, e.clientX || 0, e.clientY || 0); });
      g.addEventListener("pointermove", function (e) { showTip(cd, e.clientX || 0, e.clientY || 0); });
      g.addEventListener("pointerleave", function () { focus.hoverOff(cd); V.tip().hide(); });
      g.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(cd); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focus.toggle(cd); }
      });
      g.addEventListener("focus", function () { focus.hoverOn(cd); });
      g.addEventListener("blur", function () { focus.hoverOff(cd); });
      g.style.cursor = "pointer";
    });
  }

  function segColors() {
    return V.isDark()
      ? ["#7ba6d6", "#2fd0c0", "#ff7a45"]
      : ["#8fb8d8", "#00a699", "#fc642d"];
  }
  function buildGradient(n) {
    V.clear(defs);
    var stops = segColors();
    var g = V.el("linearGradient", {
      id: "d1flow", gradientUnits: "userSpaceOnUse",
      x1: geom.padLeft, y1: 0, x2: geom.padLeft + geom.plotW, y2: 0
    }, defs);
    stops.forEach(function (c, i) {
      V.el("stop", { offset: (i / (stops.length - 1) * 100) + "%", "stop-color": c }, g);
    });
    var el = V.$(".d1-grad");
    if (el) el.style.background = "linear-gradient(90deg," + stops.join(",") + ")";
    void n;
  }

  function drawYearAxis() {
    V.clear(gAxes);
    var ys = years();
    var step = ys.length > 10 ? 3 : ys.length > 6 ? 2 : 1;
    ys.forEach(function (y, i) {
      var x = xAt(i, ys.length);
      var major = (y - ys[0]) % step === 0 || i === ys.length - 1;
      V.el("line", {
        cls: "grid-line", x1: x, x2: x, y1: geom.padTop - 6,
        y2: geom.h - geom.padBottom + 4, "stroke-dasharray": "1 4", opacity: major ? .8 : .35
      }, gAxes);
      if (!major) return;
      V.el("line", { cls: "zero-line", x1: x, x2: x, y1: geom.padTop - 6, y2: geom.padTop - 2 }, gAxes);
      V.el("text", { cls: "axis-year", x: x, y: geom.padTop - 12, "text-anchor": "middle", text: String(y) }, gAxes);
    });
  }

  function drawGrid() {
    V.clear(gGrid);
    if (S.mode === "rank") return;
    ticks.forEach(function (t) {
      var y = yScale(t);
      if (y < geom.padTop - 6) return;
      V.el("line", { cls: t === 0 ? "zero-line" : "grid-line", x1: geom.padLeft, x2: geom.padLeft + geom.plotW, y1: y, y2: y }, gGrid);
      V.el("text", {
        cls: "mark-value", x: geom.padLeft - 9, y: y, "text-anchor": "end",
        "dominant-baseline": "middle", fill: "var(--text-mute)",
        text: S.mode === "index" ? t + " %" : metric().axis(t)
      }, gGrid);
    });
  }

  /* ------------------------------------------------------------- Zeichnen */
  var tweenRef = null;
  function apply(animate) {
    var ys = years();
    rows = order();
    if (S.topN) rows = rows.slice(0, S.topN);
    var shown = {};
    rows.forEach(function (b) { shown[b.code] = true; });
    BOROUGHS.forEach(function (b) { marks[b.code].g.style.display = shown[b.code] ? "" : "none"; });

    measure(rows.length);
    computeScale();
    buildGradient(ys.length);
    drawYearAxis();
    drawGrid();

    var targets = {};
    if (S.mode === "rank") {
      ys.forEach(function (y) {
        var lr = localRank(y);
        rows.forEach(function (b) {
          if (!targets[b.code]) targets[b.code] = {};
          targets[b.code][y] = geom.padTop + (lr[b.code] + 0.5) * LANE;
        });
      });
    } else {
      rows.forEach(function (b) {
        targets[b.code] = {};
        ys.forEach(function (y) {
          var v = valueAt(b, y);
          targets[b.code][y] = v == null ? null : yScale(v);
        });
      });
    }

    var from = {}, to = {};
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      if (!mk.cur || !Object.keys(mk.cur).length) {
        mk.cur = {};
        ys.forEach(function (y) { mk.cur[y] = targets[b.code] ? (targets[b.code][y] == null ? null : targets[b.code][y]) : null; });
      }
      from[b.code] = JSON.parse(JSON.stringify(mk.cur));
      to[b.code] = targets[b.code] || {};
    });

    function paint(p) {
      var last = ys[ys.length - 1];
      rows.forEach(function (b) {
        var mk = marks[b.code];
        var f = from[b.code], t = to[b.code];
        var pts = [];
        mk.cur = {};
        ys.forEach(function (y, i) {
          var a = f[y], z = t[y];
          var v;
          if (z == null) { v = (p >= 1 ? null : a); }
          else if (a == null) { v = p >= 1 ? z : null; }
          else { v = a + (z - a) * p; }
          mk.cur[y] = v;
          if (v != null) pts.push([xAt(i, ys.length), v]);
        });
        var d = pts.length ? "M" + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L") : "";
        mk.path.setAttribute("d", d);
        mk.hit.setAttribute("d", d);

        var lv = mk.cur[last];
        mk.name.setAttribute("x", geom.padLeft - 12);
        mk.name.setAttribute("y", lv == null ? -99 : lv);
        mk.val.setAttribute("x", geom.padLeft + geom.plotW + 10);
        mk.val.setAttribute("y", lv == null ? -99 : lv);
        mk.val.textContent = lv == null ? "–" : label(b, last);
        mk.val.style.opacity = lv == null ? 0 : 1;
        mk.name.style.opacity = lv == null ? 0 : 1;
      });
    }

    if (tweenRef) { tweenRef.cancel(); tweenRef = null; }
    if (!animate || V.reduced) { paint(1); }
    else tweenRef = V.tween({ dur: 700, ease: V.ease.inOut, onUpdate: paint });

    renderList();
    cityNote();
  }

  function label(b, y) {
    var v = val(b, y);
    if (v == null) return "–";
    if (S.mode === "index") {
      var base = val(b, baseYear());
      if (!base) return "–";
      return fmt.dec((v / base) * 100, 0) + " %";
    }
    return vtext(b, y);
  }

  /* ------------------------------------------------------------- Tooltip - */
  function showTip(code, x, y) {
    var b = V.byCode[code];
    var ys = years();
    var first = ys[0], last = ys[ys.length - 1];
    var v0 = val(b, first), v1 = val(b, last);
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + metric().label + " · " + first + " bis " + last + "</div>";
    [first, last].forEach(function (yy, i) {
      html += '<div class="tip-row"><span class="k">' +
        (i === 0 ? "Anfang" : "Ende") + " " + yy + '</span><span class="v">' +
        vtext(b, yy) + "</span></div>";
    });
    if (v0 && v1) {
      var pct = ((v1 - v0) / v0) * 100;
      html += '<div class="tip-foot">Veränderung: <strong>' + fmt.signedPct(pct) + "</strong> (" +
        fmt.factor(v1 / v0) + ")</div>";
    }
    V.tip().show(html, x, y);
  }

  /* --------------------------------------------------------------- Liste - */
  var listHost = V.$("[data-list]");
  function renderList() {
    if (!listHost) return;
    var ys = years();
    var last = ys[ys.length - 1];
    var q = S.q.trim().toLowerCase();
    var vis = rows.filter(function (b) { return !q || b.name.toLowerCase().indexOf(q) >= 0; });
    var rankMap = {};
    rows.slice().sort(function (a, b) {
      var va = val(a, last), vb = val(b, last);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    }).forEach(function (b, i) { rankMap[b.code] = i + 1; });

    V.clear(listHost);
    if (!vis.length) { V.el("div", { cls: "d1-empty", text: "Kein Bezirk gefunden." }, listHost); return; }
    vis.forEach(function (b) {
      var pinned = focus.store.pinned.has(b.code);
      var row = V.el("button", {
        cls: "d1-item" + (pinned ? " is-pinned" : ""), type: "button", role: "listitem",
        "aria-pressed": pinned ? "true" : "false",
        style: { opacity: focus.any() && !focus.has(b.code) ? .42 : 1 }
      }, listHost);
      V.el("span", { cls: "swatch", style: { background: pinColor(b) } }, row);
      V.el("span", { cls: "nm", text: b.short }, row);
      var right = V.el("span", {}, row);
      right.style.textAlign = "right";
      V.el("div", { cls: "vv", text: vtext(b, last) }, right);
      V.el("div", { cls: "rk", text: "#" + rankMap[b.code] }, right);
      row.addEventListener("click", function () { focus.toggle(b.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(b.code); });
    });
  }
  function pinColor(b) {
    return V.isDark() ? "#ff7a45" : "#fc642d";
  }

  function cityNote() {
    var el = V.$("[data-citynote]");
    if (!el) return;
    var ys = years();
    var a = ys[0], z = ys[ys.length - 1];
    var pa = D.cityPop(a), pz = D.cityPop(z);
    if (!pa || !pz) { el.textContent = ""; return; }
    var pct = ((pz - pa) / pa) * 100;
    el.innerHTML = "London gesamt: <b>" + fmt.int(pa) + "</b> (" + a + ") → <b>" +
      fmt.int(pz) + "</b> (" + z + ") = <b>" + fmt.signedPct(pct) + "</b>.";
  }

  /* ---------------------------------------------------------------- Fokus - */
  var focus = V.createFocus(host);
  host.addEventListener("viz:focus", function () {
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      var hot = focus.has(b.code);
      mk.g.classList.toggle("is-hot", hot);
      mk.g.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      mk.path.setAttribute("stroke-width", hot ? 3 : 1.7);
      mk.path.setAttribute("stroke", hot ? pinColor(b) : "url(#d1flow)");
      mk.path.style.opacity = hot ? 1 : .95;
    });
    renderList();
  });
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  /* ------------------------------------------------------------ Bedienung - */
  var metricSeg = V.$('[data-seg="metric"]');
  function buildMetricSeg() {
    V.clear(metricSeg);
    METRICS.forEach(function (m) {
      var btn = V.el("button", { type: "button", "data-v": m.id, "aria-pressed": S.metric === m.id ? "true" : "false" }, metricSeg);
      btn.textContent = m.short;
      btn.addEventListener("click", function () {
        if (S.metric === m.id) return;
        S.metric = m.id;
        V.$$("button", metricSeg).forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
        apply(true);
      });
    });
  }

  V.$$('[data-seg="mode"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="mode"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.mode = btn.getAttribute("data-v");
      apply(true);
    });
  });
  V.$$('[data-seg="topn"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="topn"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.topN = parseInt(btn.getAttribute("data-v"), 10) || 0;
      apply(true);
    });
  });

  var fromEl = V.$("[data-from]"), toEl = V.$("[data-to]");
  function rangeChanged() {
    var a = parseInt(fromEl.value, 10), b = parseInt(toEl.value, 10);
    if (a > b) { if (this === fromEl) b = a; else a = b; }
    if (b - a < 1) { if (this === fromEl) b = Math.min(ALL_YEARS[ALL_YEARS.length - 1], a + 1); else a = Math.max(ALL_YEARS[0], b - 1); }
    fromEl.value = a; toEl.value = b;
    S.from = a; S.to = b;
    V.$("[data-rangetext]").textContent = a + " – " + b;
    V.$("[data-rangenote]").textContent = (b - a) + " Jahre";
    apply(true);
  }
  fromEl.addEventListener("input", rangeChanged);
  toEl.addEventListener("input", rangeChanged);

  V.$("[data-q]").addEventListener("input", V.debounce(function (e) {
    S.q = e.target.value;
    renderList();
  }, 120));

  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "pop"; S.mode = "rank"; S.topN = 0; S.q = "";
    S.from = ALL_YEARS[0]; S.to = ALL_YEARS[ALL_YEARS.length - 1];
    fromEl.value = S.from; toEl.value = S.to;
    V.$("[data-rangetext]").textContent = S.from + " – " + S.to;
    V.$("[data-rangenote]").textContent = (S.to - S.from) + " Jahre";
    V.$("[data-q]").value = "";
    V.$$('[data-seg="mode"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "rank" ? "true" : "false"); });
    V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "0" ? "true" : "false"); });
    focus.clear();
    buildMetricSeg();
    apply(true);
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    buildGradient(years().length);
    focus.set(Array.from(focus.store.pinned));
    apply(false);
  });

  /* ---------------------------------------------------------------- Start - */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("metric")) {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].id === p("metric")) S.metric = METRICS[i].id;
  }
  if (["rank", "value", "index"].indexOf(p("mode")) >= 0) S.mode = p("mode");
  var tn = parseInt(p("topn") || "", 10);
  if (tn === 10 || tn === 20) S.topN = tn;
  var pf = parseInt(p("from") || "", 10), pt = parseInt(p("to") || "", 10);
  if (ALL_YEARS.indexOf(pf) >= 0) S.from = pf;
  if (ALL_YEARS.indexOf(pt) >= 0) S.to = pt;
  if (S.from > S.to) { var t0 = S.from; S.from = S.to; S.to = t0; }
  fromEl.value = S.from; toEl.value = S.to;
  V.$("[data-rangetext]").textContent = S.from + " – " + S.to;
  V.$("[data-rangenote]").textContent = (S.to - S.from) + " Jahre";
  V.$$('[data-seg="mode"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.mode ? "true" : "false"); });
  V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === String(S.topN) ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildMetricSeg();
  build();
  apply(false);
  focus.hoverOff(null);

  V.embed.markReady();
  V.embed.init();
  apply(false);
  V.embed.watch();

  var rerender = V.debounce(function () { apply(false); }, 150);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(host); } catch (e) {} }
  window.addEventListener("resize", rerender);
})();
