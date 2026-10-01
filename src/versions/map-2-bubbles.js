/* ==========================================================================
   Map 2 · Blasenkarte + Kleine Vielfache
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var S = { metric: "listings", year: YEARS[YEARS.length - 1], labels: "top" };

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

  function maxAll(metric) {
    var m = 0;
    BOROUGHS.forEach(function (b) {
      YEARS.forEach(function (y) { m = Math.max(m, V.value(b, metric, y)); });
    });
    return m;
  }
  var MAX = { listings: maxAll("listings"), per1k: maxAll("per1k") };
  var R_MAX = 40;   /* in viewBox-Einheiten, bezogen auf 1000 Breite */

  function radius(v) { return V.sqrtScale(0, MAX[S.metric], 0.8, R_MAX)(v); }
  function vtext(b, metric, y) {
    return metric === "per1k" ? fmt.per1k(V.per1k(b, y)) : fmt.int(V.listings(b, y));
  }

  /* ------------------------------------------------------- Hauptkarte ---- */
  var svg = V.el("svg", {
    cls: "chart m2-map", viewBox: V.geoBox(),
    role: "img", "aria-label": "Blasenkarte der Airbnb-Inserate in London"
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

  var bubbles = {}, labels = {}, leaders = {};
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    bubbles[b.code] = V.el("circle", {
      cls: "bub", "data-code": b.code, cx: b.xy[0], cy: b.xy[1], r: 0,
      fill: "var(--accent)", "fill-opacity": .8, stroke: "var(--card)", "stroke-width": 1,
      style: { cursor: "pointer" }
    }, gBub);
    leaders[b.code] = V.el("line", {
      cls: "m2-leader", x1: b.xy[0], y1: b.xy[1], x2: b.xy[0], y2: b.xy[1],
      stroke: "var(--line-strong)", "stroke-width": 1
    }, gLab);
    labels[b.code] = V.el("text", {
      cls: "m2-label halo", x: b.xy[0], y: b.xy[1], "text-anchor": "middle",
      "dominant-baseline": "middle"
    }, gLab);
    labels[b.code].textContent = shortLabel(b.name);
  });

  function shortLabel(n) {
    return V.shortName(n)
      .replace(" upon Thames", "")
      .replace("Barking & Dagenham", "Barking & D.");
  }

  function labelSet() {
    if (S.labels === "none") return [];
    if (S.labels === "all") return BOROUGHS.map(function (b) { return b.code; });
    return BOROUGHS.slice().sort(function (a, b) {
      return V.value(b, S.metric, S.year) - V.value(a, S.metric, S.year);
    }).slice(0, 8).map(function (b) { return b.code; });
  }

  function render(animate) {
    BOROUGHS.forEach(function (b) {
      var c = bubbles[b.code];
      if (!c) return;
      c.setAttribute("r", radius(V.value(b, S.metric, S.year)));
      c.setAttribute("fill", YEAR_COLOR[S.year]);
    });
    var mt = V.$("[data-maptitle]");
    if (mt) mt.textContent = (S.metric === "per1k" ? "Inserate je 1.000 Einw." : "Inserate") + " · " + S.year;
    renderSizeLegend();
    renderMulti();
    renderDetail();
    applyFocus();
  }

  function renderSizeLegend() {
    var max = MAX[S.metric];
    var marks = [max / 100, max / 10, max];
    var names = ["lo", "mid", "hi"];
    var dots = V.$$("[data-size-dot]");
    names.forEach(function (n, i) {
      var v = marks[i];
      var d = V.$('[data-size-dot="' + n + '"]');
      var t = V.$("[data-size-" + n + "]");
      if (t) t.textContent = S.metric === "per1k" ? fmt.per1k(v) : fmt.compact(v);
      if (d) {
        var px = Math.max(5, radius(v) * 0.62);
        d.style.width = px + "px";
        d.style.height = px + "px";
      }
    });
    void dots;
  }

  /* ----------------------------------------------- kleine Vielfache ----- */
  var multiBuilt = false;
  var minis = {};
  function renderMulti() {
    var box = V.$("[data-multi]");
    if (!box) return;
    if (!multiBuilt) {
      V.clear(box);
      YEARS.forEach(function (y) {
        var card = V.el("div", { cls: "m2-mini", "data-year": String(y), role: "button", tabindex: "0", "aria-label": "Jahr " + y }, box);
        var head = V.el("div", { cls: "m2-mini-head" }, card);
        V.el("span", { cls: "m2-mini-year", style: { color: YEAR_COLOR[y] }, text: fmt.year(y) }, head);
        V.el("span", { cls: "m2-mini-total", text: fmt.int(V.totals[y]) }, head);
        var ms = V.el("svg", { viewBox: V.geoBox(), role: "img", "aria-label": "Blasenkarte " + y }, card);
        var gp = V.el("g", null, ms), gb = V.el("g", null, ms);
        var bp = {}, bb = {};
        BOROUGHS.forEach(function (b) {
          bp[b.code] = V.el("path", {
            d: V.geo.paths[b.code], cls: "bor", "data-code": b.code,
            fill: "var(--bg-sunken)", stroke: "var(--card)", "stroke-width": .8,
            "stroke-linejoin": "round"
          }, gp);
          if (!b.xy) return;
          bb[b.code] = V.el("circle", {
            cls: "bub", "data-code": b.code, cx: b.xy[0], cy: b.xy[1], r: 0,
            fill: YEAR_COLOR[y], "fill-opacity": .8, stroke: "var(--card)", "stroke-width": .8
          }, gb);
        });
        var sub = V.el("div", { cls: "m2-mini-sub" }, card);
        minis[y] = { card: card, svg: ms, paths: bp, bubbles: bb, sub: sub };

        card.addEventListener("click", function () {
          S.year = y;
          updateYearSeg();
          render(true);
        });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.year = y; updateYearSeg(); render(true); }
        });
        card.addEventListener("pointerenter", function () { minis[y].card.classList.add("is-hover"); });
        card.addEventListener("pointerleave", function () { minis[y].card.classList.remove("is-hover"); });
        ms.addEventListener("pointerenter", function (e) { hoverFromMini(e); });
        ms.addEventListener("pointermove", function (e) { hoverFromMini(e); });
        ms.addEventListener("pointerleave", function () { focus.hoverOff(null); V.tip().hide(); });
        ms.addEventListener("click", function (e) {
          var c = codeFrom(e);
          if (c) { e.stopPropagation(); focus.toggle(c); }
        });
      });
      multiBuilt = true;
    }

    YEARS.forEach(function (y) {
      var m = minis[y];
      if (!m) return;
      m.card.classList.toggle("is-on", S.year === y);
      m.bubbles && Object.keys(m.bubbles).forEach(function (code) {
        m.bubbles[code].setAttribute("r", radius(V.value(V.byCode[code], S.metric, y)));
        m.bubbles[code].setAttribute("fill", YEAR_COLOR[y]);
      });
      var g = V.growth(V.byCode["E09000033"], S.metric, YEARS[0], y);
      m.sub.textContent = y === YEARS[0]
        ? "Ausgangsniveau"
        : (S.metric === "listings"
          ? fmt.signedPct(((V.totals[y] / V.totals[YEARS[0]]) - 1) * 100) + " gegenüber 2015"
          : "Westminster " + fmt.per1k(V.per1k(V.byCode["E09000033"], y)));
      void g;
    });
  }

  function codeFrom(e) {
    var n = e.target;
    while (n && n !== document) {
      if (n.getAttribute && n.getAttribute("data-code")) return n.getAttribute("data-code");
      n = n.parentNode;
    }
    return null;
  }
  function hoverFromMini(e) {
    var c = codeFrom(e);
    if (!c) return;
    focus.hoverOn(c);
    showTip(c, e.clientX || 0, e.clientY || 0);
  }

  /* ----------------------------------------------------------- focus ----- */
  var focus = V.createFocus(host);
  /* Die Schwerpunkte der Innenstadtbezirke liegen dicht beieinander – Labels
     würden übereinander liegen. Deshalb: radial nach aussen schieben,
     vertikal entzerren und mit einer dünnen Linie zum Punkt zurückführen. */
  var CX = V.data.geo.width / 2, CY = V.data.geo.height / 2;
  function applyLabels() {
    var on = labelSet();
    var items = [];
    on.forEach(function (code) {
      var b = V.byCode[code];
      if (!b || !b.xy) return;
      items.push({ code: code, b: b, x: b.xy[0], y: b.xy[1] });
    });
    items.forEach(function (it) {
      var dx = it.x - CX, dy = it.y - CY;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var push = radius(V.value(it.b, S.metric, S.year)) + 22;
      it.lx = it.x + (dx / d) * push;
      it.ly = it.y + (dy / d) * push;
      it.left = dx < 0;
      it.ux = dx / d; it.uy = dy / d;
    });
    items.sort(function (a, b) { return a.ly - b.ly; });
    for (var i = 1; i < items.length; i++) {
      if (items[i].ly - items[i - 1].ly < 12.5) items[i].ly = items[i - 1].ly + 12.5;
    }

    var shown = {};
    items.forEach(function (it) { shown[it.code] = it; });
    BOROUGHS.forEach(function (b) {
      var l = labels[b.code], ld = leaders[b.code];
      if (!l) return;
      var it = shown[b.code];
      var listed = !!it && (!focus.any() || focus.has(b.code));
      l.style.display = listed ? "" : "none";
      ld.style.display = listed ? "" : "none";
      if (!listed) return;
      l.style.opacity = !focus.any() || focus.has(b.code) ? 1 : .3;
      l.setAttribute("x", it.lx);
      l.setAttribute("y", it.ly);
      l.setAttribute("text-anchor", it.left ? "end" : "start");
      var r = radius(V.value(b, S.metric, S.year));
      ld.setAttribute("x1", it.x + it.ux * (r + 1));
      ld.setAttribute("y1", it.y + it.uy * (r + 1));
      ld.setAttribute("x2", it.lx + (it.left ? 3 : -3));
      ld.setAttribute("y2", it.ly);
      ld.style.opacity = .7;
    });
  }
  function applyFocus() {
    [svg].concat(Object.keys(minis).map(function (y) { return minis[y].svg; })).forEach(function (s) {
      if (s) s.classList.toggle("has-focus", focus.any());
    });
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code), pinned = focus.store.pinned.has(b.code);
      if (bubbles[b.code]) {
        bubbles[b.code].classList.toggle("is-hot", hot);
        bubbles[b.code].classList.toggle("is-pinned", pinned);
      }
      Object.keys(minis).forEach(function (y) {
        var c = minis[y].bubbles[b.code];
        if (c) { c.classList.toggle("is-hot", hot); c.classList.toggle("is-pinned", pinned); }
      });
    });
    applyLabels();
    renderDetail();
  }
  host.addEventListener("viz:focus", applyFocus);
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  Object.keys(bubbles).forEach(function (code) {
    var c = bubbles[code];
    c.addEventListener("pointerenter", function (e) { focus.hoverOn(code); showTip(code, e.clientX || 0, e.clientY || 0); });
    c.addEventListener("pointermove", function (e) { showTip(code, e.clientX || 0, e.clientY || 0); });
    c.addEventListener("pointerleave", function () { focus.hoverOff(code); V.tip().hide(); });
    c.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(code); });
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

  function showTip(code, x, y) {
    var b = V.byCode[code];
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + fmt.year(S.year) + " · " + vtext(b, S.metric, S.year) + "</div>";
    YEARS.forEach(function (yy) {
      html += '<div class="tip-row"' + (yy === S.year ? "" : ' style="opacity:.55"') + ">" +
        '<span class="k"><i style="background:' + YEAR_COLOR[yy] + '"></i>' + yy + "</span>" +
        '<span class="v">' + vtext(b, S.metric, yy) + "</span></div>";
    });
    var g = V.growth(b, S.metric, YEARS[0], YEARS[YEARS.length - 1]);
    html += '<div class="tip-foot">2015 → 2026: <strong>' + fmt.signedPct(g.pct) + "</strong></div>";
    V.tip().show(html, x, y);
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
    var head = V.el("div", { cls: "m2-detail-head" }, card);
    V.el("div", { cls: "m2-detail-name", text: b.name }, head);
    V.el("div", { cls: "m2-detail-meta", text: "Rang " + V.rankOf(code, S.metric, S.year) }, head);
    var kv = V.el("div", { cls: "m2-kv" }, card);
    YEARS.forEach(function (yy) {
      var r = V.el("div", null, kv);
      var k = V.el("span", { cls: "k" }, r);
      V.el("i", { style: { background: YEAR_COLOR[yy] } }, k);
      k.appendChild(document.createTextNode(V.meta.snapshots[String(yy)]));
      V.el("span", { cls: "v", text: vtext(b, S.metric, yy) }, r);
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

  /* -------------------------------------------------------- controls ----- */
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

  V.$$('[data-seg="metric"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="metric"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.metric = btn.getAttribute("data-v");
      render(true);
    });
  });
  V.$$('[data-seg="labels"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="labels"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.labels = btn.getAttribute("data-v");
      render(true);
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "listings"; S.labels = "top"; S.year = YEARS[YEARS.length - 1];
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "listings" ? "true" : "false"); });
    V.$$('[data-seg="labels"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "top" ? "true" : "false"); });
    focus.clear();
    updateYearSeg(); render(true);
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors();
    Object.keys(minis).forEach(function (y) {
      minis[y].card.querySelector(".m2-mini-year").style.color = YEAR_COLOR[y];
      Object.keys(minis[y].bubbles).forEach(function (code) {
        minis[y].bubbles[code].setAttribute("fill", YEAR_COLOR[y]);
      });
    });
    updateYearSeg(); render(false);
  });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
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

  /* ------------------------------------------------------------ init ----- */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("metric") === "per1k") S.metric = "per1k";
  if (["top", "all", "none"].indexOf(p("labels")) >= 0) S.labels = p("labels");
  var py = parseInt(p("year") || "", 10);
  if (YEARS.indexOf(py) >= 0) S.year = py;
  V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
  V.$$('[data-seg="labels"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.labels ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildYearSeg();
  render(false);

  V.embed.markReady();
  V.embed.init();
  render(false);

  V.embed.watch();
})();
