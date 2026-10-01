/* ==========================================================================
   Demo 5 · Karte des Wandels
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-map]");
  if (!host) return;

  var PERIODS = [
    { id: "11-25", from: 2011, to: 2025, label: "2011 → 2025" },
    { id: "19-25", from: 2019, to: 2025, label: "2019 → 2025" },
    { id: "11-19", from: 2011, to: 2019, label: "2011 → 2019" }
  ];
  var MULTI = [2011, 2018, 2025];

  var S = { view: "change", period: "11-25", bub: "pop", stockYear: 2025 };

  function period() {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].id === S.period) return PERIODS[i];
    return PERIODS[0];
  }
  function changeOf(b) {
    var p = period();
    var a = D.pop(b, p.from), z = D.pop(b, p.to);
    if (!a || !z) return null;
    return ((z - a) / a) * 100;
  }
  function stockOf(b) { return D.pop(b, S.stockYear); }
  function valOf(b) { return S.view === "change" ? changeOf(b) : stockOf(b); }

  /* ---------------------------------------------------------- Grundkarte -- */
  var svg = V.el("svg", { cls: "chart d5-map", viewBox: V.geoBox(), role: "img", "aria-label": "Karte des Bevölkerungswandels" }, host);
  var gPaths = V.el("g", null, svg);
  var gBub = V.el("g", null, svg);
  var gLabels = V.el("g", null, svg);

  var order = BOROUGHS.slice().sort(function (a, b) {
    return (V.data.geo.areas[b.code] || 0) - (V.data.geo.areas[a.code] || 0);
  });
  var paths = {}, bubbles = {}, labels = {};
  order.forEach(function (b) {
    paths[b.code] = V.el("path", {
      d: V.geo.paths[b.code], cls: "bor", "data-code": b.code,
      fill: "var(--bg-sunken)", stroke: "var(--card)", "stroke-width": 1,
      "stroke-linejoin": "round", tabindex: "0", role: "button", "aria-label": b.name
    }, gPaths);
  });
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    bubbles[b.code] = V.el("circle", {
      cls: "bub", "data-code": b.code, cx: b.xy[0], cy: b.xy[1], r: 0,
      fill: "var(--text)", "fill-opacity": .16, stroke: "var(--card)", "stroke-width": 1
    }, gBub);
    labels[b.code] = V.el("text", {
      cls: "map-label", x: b.xy[0], y: b.xy[1], "text-anchor": "middle", "dominant-baseline": "middle"
    }, gLabels);
    labels[b.code].textContent = b.short.replace(" upon Thames", "").replace("Barking & Dagenham", "Barking & D.");
  });

  function extremes() {
    var lo = 0, hi = 0;
    BOROUGHS.forEach(function (b) {
      var v = changeOf(b);
      if (v == null) return;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    });
    return { lo: lo, hi: hi };
  }
  var divCache = null, divKey = "";
  function divScale(lo, hi) {
    if (divKey !== lo + "|" + hi) { divCache = D.divergingScale(lo, hi); divKey = lo + "|" + hi; }
    return divCache;
  }
  function popDomain() {
    var lo = Infinity, hi = -Infinity;
    BOROUGHS.forEach(function (b) {
      MULTI.forEach(function (y) {
        var v = D.pop(b, y);
        if (v == null) return;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      });
      var s = stockOf(b);
      if (s != null) { lo = Math.min(lo, s); hi = Math.max(hi, s); }
    });
    if (!isFinite(lo)) return { lo: 0, hi: 1 };
    return { lo: 0, hi: hi };
  }

  function render() {
    var ex = extremes();
    var pd = popDomain();
    var pScale = V.sqrtScale(0, pd.hi, 1.5, 30);
    var bScale = V.sqrtScale(0, pd.hi, 1.5, 30);

    BOROUGHS.forEach(function (b) {
      var v = valOf(b);
      var p = paths[b.code], c = bubbles[b.code];
      if (S.view === "change") {
        p.setAttribute("fill", v == null ? "var(--bg-sunken)" : divScale(ex.lo, ex.hi)(v));
      } else {
        p.setAttribute("fill", v == null ? "var(--bg-sunken)" : V.ramp(V.currentRamp(), Math.sqrt(v / (pd.hi || 1))));
      }
      if (c) {
        if (S.bub === "pop") {
          var pop = D.pop(b, S.view === "change" ? period().to : S.stockYear);
          c.setAttribute("r", pop == null ? 0 : bScale(pop));
        } else {
          c.setAttribute("r", 0);
        }
        c.style.pointerEvents = S.bub === "pop" ? "auto" : "none";
      }
      if (labels[b.code]) labels[b.code].style.opacity = 0;
    });
    void pScale;

    /* Labels nur für die auffälligsten Bezirke, sonst wird die Karte unlesbar */
    var top = BOROUGHS.slice().sort(function (a, b) {
      var va = valOf(a), vb = valOf(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return S.view === "change" ? Math.abs(vb) - Math.abs(va) : vb - va;
    }).slice(0, 6);
    top.forEach(function (b) {
      if (labels[b.code]) {
        labels[b.code].style.opacity = 1;
        labels[b.code].setAttribute("x", b.xy[0]);
        labels[b.code].setAttribute("y", b.xy[1]);
      }
    });

    renderLegend(ex, pd);
    renderRank();
    renderMulti();
    renderCity();
    renderDetail();
    var t = V.$("[data-maptitle]");
    if (t) t.textContent = S.view === "change" ? "Veränderung " + period().label : "Bevölkerung " + S.stockYear;
    var pg = V.$("[data-period-group]");
    if (pg) pg.hidden = S.view !== "change";
    var lt = V.$("[data-listtitle]");
    if (lt) lt.textContent = S.view === "change" ? "Größte Veränderung" : "Größte Bezirke";
  }

  function renderLegend(ex, pd) {
    var sw = V.$("[data-swatches]");
    if (sw) {
      V.clear(sw);
      var stops = ["#1d5c8a", "#4d94b8", "#a8d5cf", "#eef0f4", "#f7c9a4", "#ef8f4e", "#c03a2b"];
      if (S.view === "change") {
        stops.forEach(function (c) { V.el("i", { style: { background: c } }, sw); });
      } else {
        for (var k = 0; k < 7; k++) V.el("i", { style: { background: V.ramp(V.currentRamp(), k / 6) } }, sw);
      }
    }
    var lt = V.$("[data-legendtitle]");
    if (lt) lt.textContent = S.view === "change" ? "Veränderung in %" : "Bevölkerung";
    var lo = V.$("[data-legendmin]"), hi = V.$("[data-legendmax]");
    if (lo) lo.textContent = S.view === "change" ? fmt.signedPct(ex.lo) : "0";
    if (hi) hi.textContent = S.view === "change" ? fmt.signedPct(ex.hi) : fmt.compact(pd.hi);
    var sc = V.$("[data-scale]");
    if (sc) {
      if (S.view === "change") {
        var p = period();
        var a = D.cityPop(p.from), z = D.cityPop(p.to);
        sc.innerHTML = "London: <b>" + fmt.int(a) + "</b> → <b>" + fmt.int(z) + "</b> (" +
          fmt.signedPct(((z - a) / a) * 100) + ")";
      } else {
        sc.innerHTML = "Blasenfläche = Bevölkerung";
      }
    }
  }

  function renderRank() {
    var box = V.$("[data-rank]");
    if (!box) return;
    var list;
    if (S.view === "change") {
      list = BOROUGHS.slice().sort(function (a, b) {
        var va = changeOf(a), vb = changeOf(b);
        if (va == null) return 1;
        if (vb == null) return -1;
        return vb - va;
      });
      list = list.slice(0, 7).concat(list.slice(-6).reverse());
    } else {
      list = BOROUGHS.slice().sort(function (a, b) { return (stockOf(b) || 0) - (stockOf(a) || 0); }).slice(0, 12);
    }
    var ex = extremes();
    V.clear(box);
    list.forEach(function (b, i) {
      if (S.view === "change" && i === 7) {
        V.el("div", { cls: "ranklist-gap", text: "\u22ee" }, box);
        return;
      }
      var v = valOf(b);
      var pinned = focus.store.pinned.has(b.code);
      var row = V.el("button", {
        cls: "rankrow" + (pinned ? " is-pinned" : ""), type: "button",
        "data-code": b.code, "aria-pressed": pinned ? "true" : "false",
        style: { opacity: focus.any() && !focus.has(b.code) ? .4 : 1 }
      }, box);
      V.el("span", { cls: "rk", text: String(i + 1) }, row);
      V.el("span", { cls: "nm", text: b.short }, row);
      V.el("span", {
        cls: "vv",
        text: v == null ? "\u2013" : (S.view === "change" ? fmt.signedPct(v) : fmt.compact(v)),
        style: S.view === "change" ? { color: v < 0 ? (V.isDark() ? "#7fb3d8" : "#1d5c8a") : (V.isDark() ? "#ff9d6b" : "#c03a2b") } : null
      }, row);
      var bar = V.el("span", { cls: "bar" }, row);
      var t = S.view === "change"
        ? Math.abs(v || 0) / (Math.max(Math.abs(ex.lo), Math.abs(ex.hi)) || 1)
        : (v || 0) / (popDomain().hi || 1);
      V.el("i", {
        style: {
          width: Math.max(2, t * 100) + "%",
          background: S.view === "change" ? divScale(ex.lo, ex.hi)(v) : V.ramp(V.currentRamp(), Math.sqrt(t))
        }
      }, bar);
      row.addEventListener("click", function () { focus.toggle(b.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(b.code); });
    });
  }

  /* ----------------------------------------------------- Kleine Vielfache */
  var multiBuilt = false, minis = {}, multiSel = 2025;
  function renderMulti() {
    var box = V.$("[data-multi]");
    if (!box) return;
    var pd = popDomain();
    if (!multiBuilt) {
      V.clear(box);
      MULTI.forEach(function (y) {
        var card = V.el("div", { cls: "d5-mini", "data-year": String(y), role: "button", tabindex: "0", "aria-label": "Jahr " + y }, box);
        var head = V.el("div", { cls: "d5-mini-head" }, card);
        V.el("span", { cls: "d5-mini-year", text: String(y) }, head);
        V.el("span", { cls: "d5-mini-total", text: fmt.compact(D.cityPop(y)) }, head);
        var ms = V.el("svg", { viewBox: V.geoBox(), role: "img", "aria-label": "Bevölkerung " + y }, card);
        var gp = V.el("g", null, ms);
        var bp = {};
        order.forEach(function (b) {
          bp[b.code] = V.el("path", {
            d: V.geo.paths[b.code], cls: "bor", "data-code": b.code,
            fill: "var(--bg-sunken)", stroke: "var(--card)", "stroke-width": .8, "stroke-linejoin": "round"
          }, gp);
        });
        minis[y] = { svg: ms, paths: bp, card: card, sub: V.el("div", { cls: "d5-mini-sub" }, card) };
        card.addEventListener("click", function () {
          multiSel = y;
          if (S.view === "stock") S.stockYear = y;
          else { S.period = y === 2025 ? "19-25" : "11-19"; }
          render();
        });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
        });
      });
      multiBuilt = true;
    }
    MULTI.forEach(function (y) {
      var m = minis[y];
      m.card.classList.toggle("is-on", S.view === "change" ? period().to === y : S.stockYear === y);
      order.forEach(function (b) {
        var pop = D.pop(b, y);
        m.paths[b.code].setAttribute("fill",
          pop == null ? "var(--bg-sunken)" : V.ramp(V.currentRamp(), Math.sqrt(pop / (pd.hi || 1))));
      });
      var prev = MULTI[MULTI.indexOf(y) - 1];
      m.sub.textContent = prev == null ? "Ausgangsjahr"
        : fmt.signedPct(((D.cityPop(y) - D.cityPop(prev)) / D.cityPop(prev)) * 100) + " gegenüber " + prev;
    });
  }

  function renderCity() {
    var box = V.$("[data-city]");
    if (!box) return;
    var p = period();
    var a = D.cityPop(p.from), z = D.cityPop(p.to);
    V.clear(box);
    function row(k, v) {
      var r = V.el("div", { cls: "statrow" }, box);
      V.el("span", { cls: "k", text: k }, r);
      V.el("span", { cls: "v", text: v }, r);
    }
    if (S.view === "change") {
      row("Bevölkerung " + p.from, fmt.int(a));
      row("Bevölkerung " + p.to, fmt.int(z));
      row("Veränderung", fmt.signedInt(z - a) + " (" + fmt.signedPct(((z - a) / a) * 100) + ")");
    } else {
      row("Bevölkerung " + S.stockYear, fmt.int(D.cityPop(S.stockYear)));
      row("Dichte " + S.stockYear, fmt.int(D.cityDensity(S.stockYear)) + " /km²");
    }
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
    var head = V.el("div", { cls: "d3-detail-head" }, card);
    V.el("div", { cls: "d3-detail-name", text: b.name }, head);

    var w = 240, h = 78, pl = 6, pr = 6, pt = 12, pb = 16;
    var mini = V.el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Bevölkerungsverlauf" }, card);
    var ys = D.popYears;
    var lo = Infinity, hi = -Infinity;
    ys.forEach(function (y) {
      var v = D.pop(b, y);
      if (v == null) return;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    });
    if (isFinite(lo) && hi > lo) {
      var xs = function (k) { return pl + (k / (ys.length - 1)) * (w - pl - pr); };
      var yy = function (v) { return pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb); };
      var pts = [];
      ys.forEach(function (y, k) {
        var v = D.pop(b, y);
        if (v != null) pts.push([xs(k), yy(v)]);
      });
      V.el("line", { cls: "grid-line", x1: pl, x2: w - pr, y1: h - pb, y2: h - pb }, mini);
      V.el("path", {
        d: "M" + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L"),
        fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round"
      }, mini);
      V.el("text", { x: pl, y: h - 3, "font-size": 9.5, fill: "var(--text-mute)", text: "2011" }, mini);
      V.el("text", { x: w - pr, y: h - 3, "text-anchor": "end", "font-size": 9.5, fill: "var(--text-mute)", text: "2025" }, mini);
    }

    var kv = V.el("div", { cls: "d3-kv" }, card);
    function row(k, v) {
      var r = V.el("div", null, kv);
      V.el("span", { cls: "k", text: k }, r);
      V.el("span", { cls: "v", text: v }, r);
    }
    row("Bevölkerung 2011", fmt.int(D.pop(b, 2011)));
    row("Bevölkerung 2025", fmt.int(D.pop(b, 2025)));
    row("Veränderung", fmt.signedPct(changeOf(b)));
    row("Dichte 2025", fmt.int(D.density(b, 2025)) + " /km²");
    row("Medianalter 2025", fmt.dec(D.medianAge(b, 2025), 1));
    var clr = V.el("button", { cls: "btn m1-clear", type: "button", text: "Auswahl aufheben" }, card);
    clr.addEventListener("click", function () { focus.clear(); });
  }

  /* --------------------------------------------------------------- Fokus - */
  var focus = V.createFocus(host);
  function applyFocus() {
    var any = focus.any();
    svg.classList.toggle("has-focus", any);
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code);
      paths[b.code].classList.toggle("is-hot", hot);
      paths[b.code].classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      if (bubbles[b.code]) bubbles[b.code].classList.toggle("is-hot", hot);
      Object.keys(minis).forEach(function (y) {
        var mp = minis[y].paths[b.code];
        if (mp) mp.classList.toggle("is-hot", hot);
      });
    });
    Object.keys(minis).forEach(function (y) { minis[y].svg.classList.toggle("has-focus", any); });
    renderRank();
    renderDetail();
  }
  host.addEventListener("viz:focus", applyFocus);
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

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
    var p = period();
    var ch = changeOf(b);
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + p.label + "</div>" +
      '<div class="tip-row"><span class="k">' + p.from + '</span><span class="v">' + fmt.int(D.pop(b, p.from)) + "</span></div>" +
      '<div class="tip-row"><span class="k">' + p.to + '</span><span class="v">' + fmt.int(D.pop(b, p.to)) + "</span></div>" +
      '<div class="tip-row"><span class="k">Veränderung</span><span class="v">' + fmt.signedPct(ch) + "</span></div>" +
      '<div class="tip-foot">Dichte 2025: ' + fmt.int(D.density(b, 2025)) + " /km²</div>";
    V.tip().show(html, x, y);
  }

  /* ------------------------------------------------------------ Bedienung - */
  var perSeg = V.$('[data-seg="period"]');
  function buildPeriods() {
    V.clear(perSeg);
    PERIODS.forEach(function (p) {
      var btn = V.el("button", { type: "button", "data-v": p.id, "aria-pressed": S.period === p.id ? "true" : "false" }, perSeg);
      btn.textContent = p.label;
      btn.addEventListener("click", function () {
        S.period = p.id;
        V.$$("button", perSeg).forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
        render();
      });
    });
  }
  V.$$('[data-seg="view"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="view"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.view = btn.getAttribute("data-v");
      render();
    });
  });
  V.$$('[data-seg="bub"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="bub"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.bub = btn.getAttribute("data-v");
      render();
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    S.view = "change"; S.period = "11-25"; S.bub = "pop"; S.stockYear = 2025;
    V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "change" ? "true" : "false"); });
    V.$$('[data-seg="bub"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "pop" ? "true" : "false"); });
    focus.clear();
    buildPeriods(); render();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    render();
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
    S.stockYear = d.years[d.years.length - 1];
    render();
  });

  /* ---------------------------------------------------------------- Start - */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("view") === "stock" || p("view") === "change") S.view = p("view");
  if (p("period")) {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].id === p("period")) S.period = PERIODS[i].id;
  }
  if (p("bub") === "off") S.bub = "off";
  var py = parseInt(p("year") || "", 10);
  if (D.popYears.indexOf(py) >= 0) S.stockYear = py;
  V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.view ? "true" : "false"); });
  V.$$('[data-seg="bub"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.bub ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildPeriods();
  render();
  focus.hoverOff(null);
  applyFocus();

  V.embed.markReady();
  V.embed.init();
  render();

  V.embed.watch();
})();
