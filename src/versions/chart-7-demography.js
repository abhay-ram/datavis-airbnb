/* ==========================================================================
   Chart 7 · Streudiagramm Airbnb-Dichte × Demografie
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-scatter]");
  if (!host) return;

  var YEAR_COLOR = {};
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function readColors() {
    YEAR_COLOR[YEARS[0]] = cssVar("--y2015", "#8fb8d8");
    YEAR_COLOR[YEARS[1]] = cssVar("--y2019", "#00a699");
    YEAR_COLOR[YEARS[2]] = cssVar("--y2026", "#fc642d");
  }
  readColors();

  function demo(b) { return b.demo || {}; }
  function pc(v) { return v == null ? null : v * 100; }

  var XM = [
    { id: "density", label: "Bevölkerungs-\ndichte", short: "Dichte",
      unit: "Personen je km²", get: function (b) { return demo(b).density; },
      f: function (v) { return fmt.int(v); }, fa: function (v) { return fmt.compact(v); } },
    { id: "medianAge", label: "Median-\nalter", short: "Medianalter",
      unit: "Jahre", get: function (b) { return demo(b).medianAge; },
      f: function (v) { return fmt.dec(v, 1); }, fa: function (v) { return fmt.dec(v, 0); } },
    { id: "pop2025", label: "Einwohner:innen", short: "Bevölkerung",
      unit: "Personen (2025)", get: function (b) { return demo(b).pop2025; },
      f: function (v) { return fmt.int(v); }, fa: function (v) { return fmt.compact(v); } },
    { id: "noQual", label: "Ohne Berufs-\nabschluss", short: "Ohne Abschluss",
      unit: "% der Bevölkerung ab 16", get: function (b) { return pc(demo(b).noQual); },
      f: function (v) { return fmt.dec(v, 1) + " %"; }, fa: function (v) { return fmt.dec(v, 0) + " %"; } },
    { id: "level4", label: "Hochschul-\nabschluss", short: "Hochschulabschluss",
      unit: "% der Bevölkerung ab 16", get: function (b) { return pc(demo(b).level4); },
      f: function (v) { return fmt.dec(v, 1) + " %"; }, fa: function (v) { return fmt.dec(v, 0) + " %"; } },
    { id: "nonUkBorn", label: "Nicht in UK\ngeboren", short: "Nicht in UK geboren",
      unit: "% der Bevölkerung", get: function (b) { return pc(demo(b).nonUkBorn); },
      f: function (v) { return fmt.dec(v, 1) + " %"; }, fa: function (v) { return fmt.dec(v, 0) + " %"; } },
    { id: "earnings", label: "Median-\nlohn", short: "Medianlohn",
      unit: "£ pro Woche (2024)", get: function (b) { return demo(b).earnings; },
      f: function (v) { return fmt.int(v) + " £"; }, fa: function (v) { return fmt.int(v) + " £"; } }
  ];

  var S = { year: YEARS[YEARS.length - 1], metric: "per1k", x: "density" };

  function xi() {
    for (var i = 0; i < XM.length; i++) if (XM[i].id === S.x) return XM[i];
    return XM[0];
  }
  function yv(b) { return V.value(b, S.metric, S.year); }
  function yLabel() {
    return S.metric === "per1k" ? "Inserate je 1.000 Einwohner:innen"
      : "Inserate (" + S.year + ")";
  }

  /* ---------------------------------------------------------- Geometrie -- */
  var svg = V.el("svg", { cls: "chart c7-scatter", role: "img", "aria-label": "Streudiagramm Airbnb und Demografie" }, host);
  var gAxis = V.el("g", null, svg);
  var gGuide = V.el("g", null, svg);
  var gTrend = V.el("g", null, svg);
  var gPts = V.el("g", null, svg);
  var gLab = V.el("g", null, svg);

  var W = 760, H = 500, PL = 62, PR = 16, PT = 16, PB = 52;
  var xS = null, yS = null, rMax = 20;

  var marks = {};
  BOROUGHS.forEach(function (b) {
    var g = V.el("g", { cls: "c7-ptwrap mark", "data-code": b.code, tabindex: "0", role: "button", "aria-label": b.name }, gPts);
    var c = V.el("circle", { cls: "c7-pt", r: 0, cx: 0, cy: 0, fill: "var(--accent)", "fill-opacity": .72, stroke: "var(--card)", "stroke-width": 1.4 }, g);
    marks[b.code] = { g: g, c: c, b: b, x: null, y: null };

    g.addEventListener("pointerenter", function (e) { focus.hoverOn(b.code); showTip(b.code, e.clientX || 0, e.clientY || 0); });
    g.addEventListener("pointermove", function (e) { showTip(b.code, e.clientX || 0, e.clientY || 0); });
    g.addEventListener("pointerleave", function () { focus.hoverOff(b.code); V.tip().hide(); });
    g.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(b.code); });
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focus.toggle(b.code); }
    });
    g.addEventListener("focus", function () { focus.hoverOn(b.code); });
    g.addEventListener("blur", function () { focus.hoverOff(b.code); });
  });

  var labels = {}, leaders = {};
  BOROUGHS.forEach(function (b) {
    leaders[b.code] = V.el("line", { cls: "c7-leader", x1: 0, y1: 0, x2: 0, y2: 0 }, gLab);
    labels[b.code] = V.el("text", { cls: "c7-plabel halo", x: 0, y: 0, "text-anchor": "start", "dominant-baseline": "middle" }, gLab);
    labels[b.code].textContent = V.shortName(b.name).replace(" upon Thames", "").replace("Barking & Dagenham", "Barking & D.");
  });

  function measure() {
    W = Math.max(320, host.clientWidth || 760);
    var narrow = W < 560;
    PL = narrow ? 48 : 62;
    PR = narrow ? 12 : 16;
    PB = narrow ? 44 : 52;
    H = Math.round(Math.max(300, Math.min(560, W * 0.66)));
    rMax = narrow ? 15 : 20;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.height = H + "px";
  }

  /* -------------------------------------------------------------- Statistik */
  function pearson(pts) {
    var n = pts.length;
    if (n < 3) return { r: NaN, a: NaN, b: NaN };
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += pts[i].x; my += pts[i].y; }
    mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < n; i++) {
      var dx = pts[i].x - mx, dy = pts[i].y - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    var r = sxy / Math.sqrt((sxx * syy) || 1);
    return { r: r, a: sxy / (sxx || 1), b: my - (sxy / (sxx || 1)) * mx, mx: mx, my: my };
  }
  function median(arr) {
    var a = arr.slice().sort(function (p, q) { return p - q; });
    if (!a.length) return 0;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ---------------------------------------------------------------- render */
  var stat = { r: NaN, n: 0, pts: [] };
  function render() {
    measure();
    var X = xi();
    var pts = [];
    BOROUGHS.forEach(function (b) {
      var x = X.get(b), y = yv(b);
      if (x == null || y == null) return;
      pts.push({ b: b, x: x, y: y, code: b.code });
    });
    var xMax = 0, yMax = 0;
    pts.forEach(function (p) { xMax = Math.max(xMax, p.x); yMax = Math.max(yMax, p.y); });
    xMax = xMax * 1.06 || 1;
    yMax = yMax * 1.1 || 1;

    xS = V.linear(0, xMax, PL, W - PR);
    yS = V.linear(0, yMax, H - PB, PT);
    var rScale = V.sqrtScale(0, V.domain(S.metric), 2.5, rMax);

    stat = pearson(pts);
    stat.n = pts.length;
    stat.pts = pts;

    /* Punkte */
    var shown = {};
    pts.forEach(function (p) {
      shown[p.code] = p;
      var mk = marks[p.code];
      mk.x = xS(p.x);
      mk.y = yS(p.y);
      mk.c.setAttribute("cx", mk.x.toFixed(1));
      mk.c.setAttribute("cy", mk.y.toFixed(1));
      mk.c.setAttribute("r", rScale(V.value(p.b, S.metric, S.year)).toFixed(1));
      mk.c.setAttribute("fill", YEAR_COLOR[S.year]);
      mk.g.style.display = "";
    });
    BOROUGHS.forEach(function (b) {
      if (!shown[b.code]) { marks[b.code].g.style.display = "none"; }
    });

    drawAxes(X, xMax, yMax);
    drawGuides(pts);
    drawTrend(pts, xMax);

    /* Ausreißer-Liste: größter Abstand von der Trendlinie */
    renderOutliers(pts);
    var rEl = V.$("[data-r]");
    if (rEl) rEl.textContent = isFinite(stat.r) ? (stat.r > 0 ? "+" : "−") + fmt.dec(Math.abs(stat.r), 2) : "–";
    var r2El = V.$("[data-r2]");
    if (r2El) r2El.textContent = isFinite(stat.r) ? fmt.dec(stat.r * stat.r, 2) : "–";
    var nEl = V.$("[data-n]");
    if (nEl) nEl.textContent = String(stat.n);
    var ct = V.$("[data-charttitle]");
    if (ct) ct.textContent = yLabel() + " nach " + X.short;
    var note = V.$("[data-note]");
    if (note) {
      note.textContent = isFinite(stat.r)
        ? "X: " + X.short + " (" + X.unit + ") · Y: " + yLabel() +
          ". " + stat.n + " Bezirke" +
          (stat.n < BOROUGHS.length ? ", " + (BOROUGHS.length - stat.n) + " ohne veröffentlichten Wert." : ".")
        : "";
    }
    applyFocus();
    layoutLabels();
  }

  function drawAxes(X, xMax, yMax) {
    V.clear(gAxis);
    var yT = V.niceTicks(yMax, 5);
    yT.forEach(function (t) {
      var y = yS(t);
      if (y < PT - 4) return;
      V.el("line", { cls: "grid-line", x1: PL, x2: W - PR, y1: y, y2: y }, gAxis);
      V.el("text", { cls: "axis-label", x: PL - 8, y: y, "text-anchor": "end", "dominant-baseline": "middle", text: fmt.compact(t) }, gAxis);
    });
    var xT = V.niceTicks(xMax, 5);
    xT.forEach(function (t) {
      var x = xS(t);
      if (x > W - PR + 2) return;
      V.el("line", { cls: "grid-line", x1: x, x2: x, y1: PT, y2: H - PB }, gAxis);
      V.el("text", { cls: "axis-label", x: x, y: H - PB + 15, "text-anchor": "middle", text: X.fa(t) }, gAxis);
    });
    V.el("text", { cls: "c7-axis-title", x: PL, y: PT - 3, text: yLabel() }, gAxis);
    V.el("text", {
      cls: "c7-axis-title", x: W - PR, y: H - 8, "text-anchor": "end",
      text: X.label.replace("\n", " ") + (X.unit ? "  ·  " + X.unit : "")
    }, gAxis);
  }

  function drawGuides(pts) {
    V.clear(gGuide);
    if (!pts.length) return;
    var mx = median(pts.map(function (p) { return p.x; }));
    var my = median(pts.map(function (p) { return p.y; }));
    V.el("line", { cls: "c7-guide", x1: xS(mx), x2: xS(mx), y1: PT, y2: H - PB }, gGuide);
    V.el("line", { cls: "c7-guide", x1: PL, x2: W - PR, y1: yS(my), y2: yS(my) }, gGuide);
  }

  function drawTrend(pts, xMax) {
    V.clear(gTrend);
    if (!isFinite(stat.a) || pts.length < 3) return;
    var x0 = 0, x1 = xMax;
    var y0 = stat.a * x0 + stat.b, y1 = stat.a * x1 + stat.b;
    V.el("line", {
      cls: "c7-trend",
      x1: xS(x0), y1: yS(Math.max(0, Math.min(y0, yS.domain[1]))),
      x2: xS(x1), y2: yS(Math.max(0, Math.min(y1, yS.domain[1])))
    }, gTrend);
  }

  /* Labels: die sechs höchsten Werte plus fixierte Bezirke, vertikal entzerrt */
  function layoutLabels() {
    var wanted = {};
    stat.pts.slice().sort(function (a, b) { return b.y - a.y; }).slice(0, 6)
      .forEach(function (p) { wanted[p.code] = true; });
    focus.store.codes.forEach(function (c) { if (marks[c] && marks[c].x != null) wanted[c] = true; });

    var items = stat.pts.filter(function (p) { return wanted[p.code]; })
      .map(function (p) { return { code: p.code, x: marks[p.code].x, y: marks[p.code].y, ly: marks[p.code].y }; });
    items.sort(function (a, b) { return a.ly - b.ly; });
    for (var i = 1; i < items.length; i++) {
      if (items[i].ly - items[i - 1].ly < 13) items[i].ly = items[i - 1].ly + 13;
    }
    var shown = {};
    items.forEach(function (it) { shown[it.code] = it; });

    BOROUGHS.forEach(function (b) {
      var l = labels[b.code], ld = leaders[b.code];
      var mk = marks[b.code];
      if (!mk || mk.x == null) { l.style.display = "none"; ld.style.display = "none"; return; }
      var it = shown[b.code];
      if (!it) { l.style.display = "none"; ld.style.display = "none"; return; }
      var right = it.x < W - PR - 90;
      l.style.display = ""; ld.style.display = "";
      var lx = right ? it.x + rMaxOf(b) + 6 : it.x - rMaxOf(b) - 6;
      l.setAttribute("x", lx);
      l.setAttribute("y", it.ly);
      l.setAttribute("text-anchor", right ? "start" : "end");
      ld.setAttribute("x1", it.x);
      ld.setAttribute("y1", it.y);
      ld.setAttribute("x2", lx + (right ? -3 : 3));
      ld.setAttribute("y2", it.ly);
      ld.style.opacity = Math.abs(it.ly - it.y) > 3 ? .8 : 0;
    });
  }
  function rMaxOf(b) {
    return Math.max(4, parseFloat(marks[b.code].c.getAttribute("r")) || 4);
  }

  /* ---------------------------------------------------------------- focus */
  var focus = V.createFocus(host);
  function applyFocus() {
    svg.classList.toggle("has-focus", focus.any());
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      if (!mk) return;
      var hot = focus.has(b.code);
      mk.g.classList.toggle("is-hot", hot);
      mk.c.classList.toggle("is-hot", hot);
      mk.c.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      mk.c.setAttribute("fill-opacity", hot ? 1 : .72);
    });
    renderDetail();
  }
  host.addEventListener("viz:focus", function () { applyFocus(); layoutLabels(); });
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  function showTip(code, x, y) {
    var X = xi(), b = V.byCode[code], d = demo(b);
    var yVal = S.metric === "per1k" ? V.per1k(b, S.year) : V.listings(b, S.year);
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">Rang ' + V.rankOf(code, S.metric, S.year) + " von 33 · " + S.year + "</div>";
    html += '<div class="tip-row"><span class="k">' + X.short + '</span><span class="v">' +
      X.f(X.get(b)) + "</span></div>";
    html += '<div class="tip-row"><span class="k">' +
      (S.metric === "per1k" ? "Je 1.000 Einw." : "Inserate") + '</span><span class="v">' +
      (S.metric === "per1k" ? fmt.per1k(yVal) : fmt.int(yVal)) + "</span></div>";
    html += '<div class="tip-foot">' + fmt.int(V.listings(b, S.year)) + " Inserate · " +
      fmt.int(d.pop2025) + " Einwohner:innen</div>";
    V.tip().show(html, x, y);
  }

  function renderOutliers(pts) {
    var box = V.$("[data-outliers]");
    if (!box) return;
    V.clear(box);
    if (!isFinite(stat.a) || pts.length < 3) {
      V.el("div", { cls: "c1-empty", text: "Zu wenige Werte." }, box);
      return;
    }
    var list = pts.map(function (p) {
      var pred = stat.a * p.x + stat.b;
      return { p: p, dv: p.y - pred };
    }).sort(function (a, b) { return Math.abs(b.dv) - Math.abs(a.dv); }).slice(0, 6);

    list.forEach(function (o) {
      var pinned = focus.store.pinned.has(o.p.code);
      var over = o.dv > 0;
      var row = V.el("button", {
        cls: "c7-item" + (pinned ? " is-pinned" : ""), type: "button", "data-code": o.p.code
      }, box);
      V.el("span", { cls: "nm", text: V.shortName(o.p.b.name) }, row);
      V.el("span", {
        cls: "dv",
        text: (over ? "+" : "−") + fmt.dec(Math.abs(o.dv), 1)
      }, row);
      V.el("span", {
        cls: "sg",
        style: { color: over ? YEAR_COLOR[YEARS[2]] : YEAR_COLOR[YEARS[1]] },
        text: over ? "über" : "unter"
      }, row);
      row.addEventListener("click", function () { focus.toggle(o.p.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(o.p.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(o.p.code); });
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
    var b = V.byCode[code], d = demo(b), X = xi();
    V.clear(card);
    var head = V.el("div", { cls: "c7-detail-head" }, card);
    V.el("div", { cls: "c7-detail-name", text: V.shortName(b.name) }, head);
    V.el("div", { cls: "c7-detail-meta", text: "Rang " + V.rankOf(code, S.metric, S.year) + " von 33" }, head);
    var kv = V.el("div", { cls: "c7-kv" }, card);
    function row(k, v) {
      var r = V.el("div", null, kv);
      V.el("span", { cls: "k", text: k }, r);
      V.el("span", { cls: "v", text: v }, r);
    }
    row(X.short, X.f(X.get(b)));
    row("Je 1.000 Einw. " + S.year, fmt.per1k(V.per1k(b, S.year)));
    row("Inserate " + S.year, fmt.int(V.listings(b, S.year)));
    V.el("div", { cls: "sec", text: "Demografie" }, kv);
    row("Einwohner:innen 2025", fmt.int(d.pop2025));
    row("Dichte", fmt.int(d.density) + " /km²");
    row("Medianalter", fmt.dec(d.medianAge, 1));
    row("Ohne Abschluss", fmt.dec(pc(d.noQual), 1) + " %");
    row("Nicht in UK geboren", fmt.dec(pc(d.nonUkBorn), 1) + " %");
    if (d.earnings) row("Medianlohn", fmt.int(d.earnings) + " £/Woche");
    var clr = V.el("button", { cls: "btn m1-clear", type: "button", text: "Auswahl aufheben" }, card);
    clr.addEventListener("click", function () { focus.clear(); });
  }

  /* ------------------------------------------------------------- Steuerung */
  var yearSeg = V.$('[data-seg="year"]'), yearBtns = {};
  function buildYearSeg() {
    V.clear(yearSeg);
    YEARS.forEach(function (y) {
      var btn = V.el("button", { type: "button", "data-v": String(y), "aria-pressed": "false" }, yearSeg);
      btn.textContent = String(y);
      btn.addEventListener("click", function () {
        if (S.year === y) return;
        S.year = y; updateYearSeg(); render();
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

  var xSeg = V.$('[data-seg="x"]'), xBtns = {};
  function buildXSeg() {
    V.clear(xSeg);
    XM.forEach(function (m) {
      var btn = V.el("button", { type: "button", "data-v": m.id, "aria-pressed": "false" }, xSeg);
      btn.textContent = m.short;
      btn.addEventListener("click", function () {
        if (S.x === m.id) return;
        S.x = m.id; updateXSeg(); render();
      });
      xBtns[m.id] = btn;
    });
    updateXSeg();
  }
  function updateXSeg() {
    XM.forEach(function (m) {
      if (xBtns[m.id]) xBtns[m.id].setAttribute("aria-pressed", S.x === m.id ? "true" : "false");
    });
  }

  V.$$('[data-seg="metric"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="metric"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.metric = btn.getAttribute("data-v");
      render();
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "per1k"; S.x = "density"; S.year = YEARS[YEARS.length - 1];
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "per1k" ? "true" : "false"); });
    focus.clear();
    buildYearSeg(); buildXSeg(); render();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors(); updateYearSeg(); render();
  });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
    S.year = d.years[d.years.length - 1];
    updateYearSeg(); render();
  });
  V.embed.on("metric", function (d) {
    if (d.metric !== "listings" && d.metric !== "per1k") return;
    S.metric = d.metric;
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === d.metric ? "true" : "false"); });
    render();
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  /* ------------------------------------------------------------------ init */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("metric") === "listings") S.metric = "listings";
  if (p("x")) {
    for (var i = 0; i < XM.length; i++) if (XM[i].id === p("x")) S.x = XM[i].id;
  }
  var py = parseInt(p("year") || "", 10);
  if (YEARS.indexOf(py) >= 0) S.year = py;
  V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildYearSeg();
  buildXSeg();
  render();

  V.embed.markReady();
  V.embed.init();
  render();

  var rerender = V.debounce(function () { render(); }, 150);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(host); } catch (e) {} }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();
