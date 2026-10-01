/* ==========================================================================
   Chart 2 · Ranglisten-Balken + Slope-Verlauf
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var S = { metric: "listings", year: YEARS[YEARS.length - 1], sort: "value" };

  var barHost = V.$("[data-bars]");
  var slopeHost = V.$("[data-slope]");
  var moversHost = V.$("[data-movers]");
  var barTitle = V.$("[data-bartitle]");
  if (!barHost) return;

  var YEAR_COLOR = {};
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function readColors() {
    YEAR_COLOR[YEARS[0]] = cssVar("--y2015", "#8fb8d8");
    YEAR_COLOR[YEARS[1]] = cssVar("--y2019", "#00a699");
    YEAR_COLOR[YEARS[2]] = cssVar("--y2026", "#fc642d");
  }
  readColors();

  function varColor(name, fallback) { return cssVar(name, fallback); }
  var UP = "#fc642d", DOWN = "#00a699";
  function readSemantic() {
    UP = varColor("--y2026", "#fc642d");
    DOWN = varColor("--y2019", "#00a699");
  }
  readSemantic();

  function prevYear(y) {
    var i = YEARS.indexOf(y);
    return i > 0 ? YEARS[i - 1] : null;
  }

  /* ======================================================= bar panel ===== */
  var ROW = 22, BAR = 13, HEAD = 26, PADB = 30;
  var svg = V.el("svg", { cls: "chart c2-bars", role: "img", "aria-label": "Balkendiagramm der Airbnb-Inserate nach Bezirk" }, barHost);
  var gRows = V.el("g", null, svg);
  var gHead = V.el("g", null, svg);
  var gAxis = V.el("g", null, svg);
  var bars = {};
  var W = 900, labelW = 150, plotW = 700, H = 800;

  function measure() {
    W = Math.max(320, barHost.clientWidth || 900);
    var narrow = W < 620;
    labelW = narrow ? 104 : 152;
    plotW = Math.max(80, W - labelW - (narrow ? 74 : 92));
    H = HEAD + BOROUGHS.length * ROW + PADB;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.height = H + "px";
  }

  function buildBars() {
    BOROUGHS.forEach(function (b) {
      var g = V.el("g", { cls: "c2-bar-row mark", "data-code": b.code, tabindex: "0", role: "button", "aria-label": b.name }, gRows);
      var track = V.el("rect", { cls: "c2-bar-track", x: labelW, y: 0, height: BAR, rx: 3 }, g);
      var fill = V.el("rect", { cls: "c2-bar-fill", x: labelW, y: 0, height: BAR, rx: 3 }, g);
      var hit = V.el("rect", { cls: "c2-bar-hit", x: 0, y: 0, width: W, height: ROW }, g);
      var label = V.el("text", { cls: "c2-bar-label", x: labelW - 11, y: 0, "text-anchor": "end", "dominant-baseline": "middle" }, g);
      label.textContent = V.shortName(b.name);
      var value = V.el("text", { cls: "c2-bar-value", x: 0, y: 0, "dominant-baseline": "middle" }, g);
      var delta = V.el("text", { cls: "c2-bar-delta", x: W - 10, y: 0, "text-anchor": "end", "dominant-baseline": "middle" }, g);
      bars[b.code] = { g: g, track: track, fill: fill, hit: hit, label: label, value: value, delta: delta, cy: 0, cw: 0, ty: 0, tw: 0, b: b };

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
    });
  }

  function orderList() {
    var list = BOROUGHS.slice();
    if (S.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name, "en"); });
    else if (S.sort === "value") list.sort(function (a, b) {
      return V.value(b, S.metric, S.year) - V.value(a, S.metric, S.year) || a.name.localeCompare(b.name, "en");
    });
    else list.sort(function (a, b) {
      return V.growth(b, S.metric, YEARS[0], YEARS[YEARS.length - 1]).abs -
        V.growth(a, S.metric, YEARS[0], YEARS[YEARS.length - 1]).abs;
    });
    return list;
  }

  function vtext(b, y) {
    return S.metric === "per1k" ? fmt.per1k(V.per1k(b, y)) : fmt.int(V.listings(b, y));
  }

  function layoutBars(animate) {
    measure();
    var order = orderList();
    var max = V.domain(S.metric);
    var prev = prevYear(S.year);
    var from = {}, to = {};

    order.forEach(function (b, i) {
      var mk = bars[b.code];
      var v = V.value(b, S.metric, S.year);
      from[b.code] = { y: mk.cy, w: mk.cw };
      to[b.code] = { y: HEAD + i * ROW + (ROW - BAR) / 2, w: Math.max(2, (v / max) * plotW) };
      mk.idx = i + 1;
      mk.v = v;
      mk.prev = prev;
    });

    function paintNow(p) {
      order.forEach(function (b) {
        var mk = bars[b.code];
        var f = from[b.code], t = to[b.code];
        mk.cy = f.y + (t.y - f.y) * p;
        mk.cw = f.w + (t.w - f.w) * p;
        mk.g.setAttribute("transform", "translate(0," + mk.cy.toFixed(2) + ")");
        mk.hit.setAttribute("width", W);
        mk.track.setAttribute("x", labelW);
        mk.track.setAttribute("width", plotW);
        mk.fill.setAttribute("width", mk.cw.toFixed(2));
        mk.fill.setAttribute("fill", YEAR_COLOR[S.year]);
        mk.fill.setAttribute("opacity", .92);
        mk.label.setAttribute("x", labelW - 11);
        var vx = Math.min(labelW + mk.cw + 8, W - (mk.prev ? 96 : 62));
        mk.value.setAttribute("x", vx);
        mk.value.textContent = p >= 1 ? vtext(b, S.year) : fmt.compact(f.w > 0 ? (f.w / plotW) * max : 0);
        if (mk.prev) {
          var g = V.growth(b, S.metric, mk.prev, S.year);
          mk.delta.setAttribute("x", W - 10);
          mk.delta.textContent = (g.abs > 0 ? "+" : g.abs < 0 ? "−" : "±") + fmt.compact(Math.abs(g.abs));
          mk.delta.setAttribute("fill", g.abs > 0 ? UP : g.abs < 0 ? DOWN : "var(--text-mute)");
          mk.delta.style.opacity = 1;
        } else {
          mk.delta.textContent = "";
          mk.delta.style.opacity = 0;
        }
      });
    }

    if (!animate || V.reduced) {
      /* Ein noch laufender Tween darf einen direkten Neuaufbau nicht
         nachträglich überschreiben. */
      if (tweenRef) { tweenRef.cancel(); tweenRef = null; }
      paintNow(1);
    } else {
      if (tweenRef) tweenRef.cancel();
      tweenRef = V.tween({ dur: 780, ease: V.ease.inOut, onUpdate: paintNow });
    }
    drawHead(prev);
    drawAxis(max);
  }
  var tweenRef = null;

  function drawHead(prev) {
    V.clear(gHead);
    var y = HEAD - 9;
    V.el("text", { cls: "c2-bar-label", x: 0, y: y, "dominant-baseline": "middle", "font-size": 10, "letter-spacing": ".06em", text: "BEZIRK", fill: "var(--text-mute)" }, gHead);
    V.el("text", { cls: "c2-bar-label", x: W - 10, y: y, "text-anchor": "end", "dominant-baseline": "middle", "font-size": 10, "letter-spacing": ".06em", fill: "var(--text-mute)", text: prev ? "Δ ZU " + prev : "Δ" }, gHead);
    V.el("line", { cls: "grid-line", x1: 0, x2: W, y1: HEAD - 1, y2: HEAD - 1 }, gHead);
  }

  function drawAxis(max) {
    V.clear(gAxis);
    var y = HEAD + BOROUGHS.length * ROW + 14;
    var ticks = V.niceTicks(max, 5);
    ticks.forEach(function (t) {
      var x = labelW + (t / max) * plotW;
      if (x > labelW + plotW + 2) return;
      V.el("line", { cls: "grid-line", x1: x, x2: x, y1: HEAD, y2: y - 8, opacity: .8 }, gAxis);
      V.el("text", { cls: "axis-label", x: x, y: y, "text-anchor": "middle", text: S.metric === "per1k" ? fmt.per1k(t) : fmt.compact(t) }, gAxis);
    });
    V.el("text", { cls: "axis-label", x: 0, y: y, text: S.metric === "per1k" ? "Inserate je 1.000 Einwohner:innen" : "Inserate" }, gAxis);
  }

  /* ====================================================== slope panel ==== */
  var SW = 268, SH = 320;
  var ssvg = V.el("svg", { cls: "chart c2-slope-panel", role: "img", "aria-label": "Verlauf der Airbnb-Zahlen über drei Stichtage" }, slopeHost);
  var sLines = V.el("g", null, ssvg);
  var sAxis = V.el("g", null, ssvg);
  var sMarks = {};
  var padL = 40, padR = 54, padT = 24, padB = 22;

  function buildSlope() {
    V.clear(sAxis);
    ssvg.setAttribute("viewBox", "0 0 " + SW + " " + SH);
    ssvg.setAttribute("width", "100%");
    ssvg.style.height = "auto";

    var max = V.domain(S.metric) * 1.02;
    /* Wurzel-Skala: die Daten sind stark rechtsschief, linear bliebe
       die untere Hälfte der Bezirke unlesbar. */
    var vScale = V.sqrtScale(0, max, SH - padB, padT);
    var xs = [padL, padL + (SW - padL - padR) / 2, SW - padR];
    var ticks = [0, max * 0.15, max * 0.4, max * 0.72];

    ticks.forEach(function (t, i) {
      var y = vScale(t);
      if (y < padT - 4) return;
      V.el("line", { cls: "grid-line", x1: padL, x2: SW - padR, y1: y, y2: y, opacity: .7 }, sAxis);
      V.el("text", {
        cls: "c2-slope-sub", x: padL - 7, y: y, "text-anchor": "end", "dominant-baseline": "middle",
        text: S.metric === "per1k" ? fmt.per1k(t) : fmt.compact(t)
      }, sAxis);
    });
    YEARS.forEach(function (y, i) {
      V.el("text", { cls: "c2-slope-year", x: xs[i], y: 13, "text-anchor": "middle", fill: YEAR_COLOR[y], text: fmt.year(y) }, sAxis);
    });

    BOROUGHS.forEach(function (b) {
      var vals = YEARS.map(function (y) { return vScale(V.value(b, S.metric, y)); });
      var d = "M" + vals.map(function (v, i) { return xs[i].toFixed(1) + " " + v.toFixed(1); }).join("L");
      var line = V.el("path", { cls: "c2-slope-line mark", "data-code": b.code, d: d, stroke: "var(--line-strong)", opacity: .55 }, sLines);
      var dots = YEARS.map(function (y, i) {
        return V.el("circle", { cls: "c2-slope-dot mark", "data-code": b.code, cx: xs[i], cy: vals[i], r: 2.6, fill: YEAR_COLOR[y] }, sLines);
      });
      sMarks[b.code] = { line: line, dots: dots, vals: vals, end: vals[vals.length - 1] };
    });

    /* direkte Labels für die drei größten Bezirke des aktiven Jahres */
    var top = BOROUGHS.slice().sort(function (a, b) {
      return V.value(b, S.metric, S.year) - V.value(a, S.metric, S.year);
    }).slice(0, 3);
    top.forEach(function (b) {
      var t = V.el("text", {
        cls: "c2-slope-sub", x: SW - padR + 6, y: Math.max(padT + 4, sMarks[b.code].end),
        "dominant-baseline": "middle", fill: "var(--text-soft)", "font-size": 10, text: V.shortName(b.name)
      }, sAxis);
      t.style.fontWeight = 600;
    });
  }

  /* ====================================================== movers ========= */
  function renderMovers() {
    if (!moversHost) return;
    var first = YEARS[0], last = YEARS[YEARS.length - 1];
    var list = BOROUGHS.map(function (b) {
      return { b: b, g: V.growth(b, S.metric, first, last) };
    }).sort(function (a, b) { return b.g.abs - a.g.abs; }).slice(0, 8);

    V.clear(moversHost);
    list.forEach(function (o) {
      var up = o.g.abs >= 0;
      var pinned = focus.store.pinned.has(o.b.code);
      var row = V.el("button", {
        cls: "c2-mover" + (pinned ? " is-pinned" : ""), type: "button",
        "data-code": o.b.code,
        style: { opacity: focus.any() && !focus.has(o.b.code) ? .45 : 1 }
      }, moversHost);
      V.el("span", { cls: "nm", text: V.shortName(o.b.name) }, row);
      V.el("span", {
        cls: "pc", text: fmt.signedPct(o.g.pct), style: { color: up ? UP : DOWN }
      }, row);
      V.el("span", { cls: "ab", text: fmt.signedInt(o.g.abs) }, row);
      row.addEventListener("click", function () { focus.toggle(o.b.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(o.b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(o.b.code); });
    });
  }

  /* ====================================================== tooltip ======== */
  function showTip(code, x, y) {
    var b = V.byCode[code];
    var t = V.tip();
    var g = V.growth(b, S.metric, YEARS[0], YEARS[YEARS.length - 1]);
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">Rang ' + V.rankOf(code, S.metric, S.year) + " von 33 im Jahr " + S.year + "</div>";
    YEARS.forEach(function (yy) {
      html += '<div class="tip-row">' +
        '<span class="k"><i style="background:' + YEAR_COLOR[yy] + '"></i>' + V.meta.snapshots[String(yy)] + "</span>" +
        '<span class="v">' + vtext(b, yy) + "</span></div>";
    });
    html += '<div class="tip-foot">2015 → 2026: <strong>' + fmt.signedPct(g.pct) + "</strong> (" +
      fmt.factor(g.factor) + ") · Anteil " + fmt.year(S.year) + ": " +
      fmt.dec((V.listings(b, S.year) / V.totals[S.year]) * 100, 1) + " %</div>";
    t.show(html, x, y);
  }

  /* ====================================================== controls ======= */
  var focus = V.createFocus(barHost);
  barHost.classList.add("c2-bars");
  barHost.addEventListener("viz:focus", function () {
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code);
      var mk = bars[b.code];
      mk.g.classList.toggle("is-hot", hot);
      mk.g.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      mk.label.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      var sm = sMarks[b.code];
      if (sm) {
        sm.line.classList.toggle("is-hot", hot);
        sm.line.setAttribute("stroke", hot ? YEAR_COLOR[YEARS[YEARS.length - 1]] : "var(--line-strong)");
        sm.line.style.opacity = focus.any() && !hot ? 0.12 : 0.55;
        sm.dots.forEach(function (d) { d.classList.toggle("is-hot", hot); });
      }
    });
    renderMovers();
  });
  barHost.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  var yearSeg = V.$('[data-seg="year"]');
  var yearBtns = {};
  function buildYearSeg() {
    V.clear(yearSeg);
    YEARS.forEach(function (y) {
      var btn = V.el("button", { type: "button", "data-v": String(y), "aria-pressed": "false" }, yearSeg);
      btn.textContent = String(y);
      btn.addEventListener("click", function () {
        if (S.year === y) return;
        S.year = y;
        updateYearSeg();
        if (barTitle) barTitle.textContent = "Rangliste " + y;
        layoutBars(true);
        buildSlopeAll();
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
  function buildSlopeAll() {
    V.clear(sLines);
    buildSlope();
  }

  /* Der Verlauf ist ebenfalls interaktiv: Zeile unter dem Zeiger wird
     hervorgehoben, ein Klick fixiert sie. */
  function slopeCode(e) {
    var n = e.target;
    while (n && n !== sLines) {
      if (n.getAttribute && n.getAttribute("data-code")) return n.getAttribute("data-code");
      n = n.parentNode;
    }
    return null;
  }
  sLines.addEventListener("pointerenter", function (e) {
    var c = slopeCode(e);
    if (c) { focus.hoverOn(c); showTip(c, e.clientX || 0, e.clientY || 0); }
  });
  sLines.addEventListener("pointermove", function (e) {
    var c = slopeCode(e);
    if (c) showTip(c, e.clientX || 0, e.clientY || 0);
  });
  sLines.addEventListener("pointerleave", function () { focus.hoverOff(null); V.tip().hide(); });
  sLines.addEventListener("click", function (e) {
    var c = slopeCode(e);
    if (c) { e.stopPropagation(); focus.toggle(c); }
  });
  sLines.style.cursor = "pointer";

  V.$$('[data-seg="metric"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="metric"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.metric = btn.getAttribute("data-v");
      layoutBars(true);
      buildSlopeAll();
    });
  });
  V.$$('[data-seg="sort"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="sort"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.sort = btn.getAttribute("data-v");
      layoutBars(true);
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "listings"; S.sort = "value"; S.year = YEARS[YEARS.length - 1];
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "listings" ? "true" : "false"); });
    V.$$('[data-seg="sort"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "value" ? "true" : "false"); });
    focus.clear();
    updateYearSeg();
    if (barTitle) barTitle.textContent = "Rangliste " + S.year;
    layoutBars(true);
    buildSlopeAll();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors(); readSemantic();
    updateYearSeg(); layoutBars(false); buildSlopeAll();
  });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
    S.year = d.years[d.years.length - 1];
    updateYearSeg();
    if (barTitle) barTitle.textContent = "Rangliste " + S.year;
    layoutBars(true); buildSlopeAll();
  });
  V.embed.on("metric", function (d) {
    if (d.metric !== "listings" && d.metric !== "per1k") return;
    S.metric = d.metric;
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === d.metric ? "true" : "false"); });
    layoutBars(true); buildSlopeAll();
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  /* ====================================================== init =========== */
  V.reveal();

  var p = V.embed.param.bind(V.embed);
  if (p("metric") === "per1k") S.metric = "per1k";
  if (["value", "name", "growth"].indexOf(p("sort")) >= 0) S.sort = p("sort");
  var py = parseInt(p("year") || "", 10);
  if (YEARS.indexOf(py) >= 0) S.year = py;
  V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
  V.$$('[data-seg="sort"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.sort ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  measure();
  buildBars();
  buildSlope();
  buildYearSeg();
  if (barTitle) barTitle.textContent = "Rangliste " + S.year;
  /* Startzustand: Balken sitzen schon am Platz und wachsen nur in die Breite */
  orderList().forEach(function (b, i) {
    var mk = bars[b.code];
    mk.cy = HEAD + i * ROW + (ROW - BAR) / 2;
    mk.cw = 0;
  });
  layoutBars(true);
  renderMovers();
  focus.hoverOff(null);

  V.embed.markReady();
  V.embed.init();
  layoutBars(false);
  buildSlopeAll();

  var rerender = V.debounce(function () { layoutBars(false); buildSlopeAll(); }, 150);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(barHost); } catch (e) {} }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();
