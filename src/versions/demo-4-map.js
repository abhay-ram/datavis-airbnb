/* ==========================================================================
   Demo 4 · Indikatorenkarte
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;
  var IND = D.ind;

  var host = V.$("[data-map]");
  if (!host) return;

  var S = { ind: "pop", year: 2025, view: "choropleth" };

  function ind() { return D.indicator(S.ind); }
  function yearFor(i, want) {
    var ys = i.years || [];
    if (!ys.length) return null;
    if (ys.indexOf(want) >= 0) return want;
    var best = ys[0];
    ys.forEach(function (y) { if (Math.abs(y - want) < Math.abs(best - want)) best = y; });
    return best;
  }
  function valueOf(b) {
    var v = ind().get(b, S.year);
    return v == null ? null : v;
  }
  function fmtVal(v) { return v == null ? "–" : ind().f(v); }

  /* ---------------------------------------------------------- Grundkarte -- */
  var svg = V.el("svg", {
    cls: "chart d4-map", viewBox: V.geoBox(),
    role: "img", "aria-label": "Karte der 33 Londoner Bezirke"
  }, host);
  var gPaths = V.el("g", null, svg);
  var gBub = V.el("g", null, svg);
  var gLabels = V.el("g", null, svg);

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
      cls: "bub", "data-code": b.code, cx: b.xy[0], cy: b.xy[1], r: 0,
      fill: "var(--accent)", "fill-opacity": .8, stroke: "var(--card)", "stroke-width": 1
    }, gBub);
    labels[b.code] = V.el("text", { cls: "map-label", x: b.xy[0], y: b.xy[1], "text-anchor": "middle", "dominant-baseline": "middle" }, gLabels);
    labels[b.code].textContent = b.short.replace(" upon Thames", "").replace("Barking & Dagenham", "Barking & D.");
  });

  /* -------------------------------------------------------------- Skalen -- */
  function domain() {
    var lo = Infinity, hi = -Infinity;
    BOROUGHS.forEach(function (b) {
      var v = valueOf(b);
      if (v == null) return;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    });
    if (!isFinite(lo)) return { lo: 0, hi: 1 };
    return { lo: lo, hi: hi };
  }
  function colorFor(v, dm) {
    if (v == null) return V.isDark() ? "#1b2331" : "#eef0f4";
    if (ind().kind === "div") return divScale(dm)(v);
    var t = (v - dm.lo) / ((dm.hi - dm.lo) || 1);
    return V.ramp(V.currentRamp(), t);
  }
  var divCache = null, divKey = "";
  function divScale(dm) {
    var k = dm.lo + "|" + dm.hi;
    if (divKey !== k) { divCache = D.divergingScale(dm.lo, dm.hi); divKey = k; }
    return divCache;
  }

  /* ------------------------------------------------------------- Zeichnen - */
  function render() {
    var i = ind();
    var dm = domain();
    var bScale = V.sqrtScale(0, dm.hi || 1, 1.5, 34);

    BOROUGHS.forEach(function (b) {
      var v = valueOf(b);
      var p = paths[b.code], c = bubbles[b.code], l = labels[b.code];
      var col = colorFor(v, dm);
      if (S.view === "choropleth") {
        p.style.opacity = 1;
        p.setAttribute("fill", col);
        if (c) { c.setAttribute("r", 0); c.style.pointerEvents = "none"; }
      } else {
        p.setAttribute("fill", "var(--bg-sunken)");
        p.style.opacity = .9;
        if (c) {
          c.setAttribute("r", v == null ? 0 : bScale(Math.abs(v)));
          c.setAttribute("fill", ind().kind === "div" ? col : "var(--accent)");
        }
      }
      if (l) l.style.opacity = 0;
    });

    var top = BOROUGHS.slice().sort(function (a, b) {
      var va = valueOf(a), vb = valueOf(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    }).slice(0, S.view === "choropleth" ? 7 : 5);
    top.forEach(function (b) { if (labels[b.code]) labels[b.code].style.opacity = 1; });

    renderLegend(dm);
    renderRank(dm);
    renderCity();
    renderDetail();
    var titleEl = V.$("[data-ranktitle]");
    if (titleEl) titleEl.textContent = "Rangliste · " + i.short + (i.years.length > 1 ? " " + S.year : "");
  }

  function renderLegend(dm) {
    var sw = V.$("[data-swatches]");
    var stops = ind().kind === "div"
      ? ["#1d5c8a", "#4d94b8", "#e9f5f2", "#f7c9a4", "#ef8f4e", "#c03a2b"]
      : null;
    var n = 7;
    if (sw) {
      V.clear(sw);
      for (var k = 0; k < n; k++) {
        var t = k / (n - 1);
        var col = ind().kind === "div" ? stops[Math.min(stops.length - 1, Math.round(t * (stops.length - 1)))]
          : V.ramp(V.currentRamp(), t);
        V.el("i", { style: { background: col } }, sw);
      }
    }
    var lt = V.$("[data-legendtitle]");
    if (lt) lt.textContent = ind().label + (ind().years.length > 1 ? " · " + S.year : "");
    var lo = V.$("[data-legendmin]"), hi = V.$("[data-legendmax]");
    if (lo) lo.textContent = ind().kind === "div" ? fmt.signedPct(dm.lo) : ind().fa(dm.lo);
    if (hi) hi.textContent = ind().kind === "div" ? fmt.signedPct(dm.hi) : ind().fa(dm.hi);
  }

  function renderRank(dm) {
    var box = V.$("[data-rank]");
    if (!box) return;
    var list = BOROUGHS.slice().sort(function (a, b) {
      var va = valueOf(a), vb = valueOf(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    }).slice(0, 14);
    V.clear(box);
    list.forEach(function (b, i) {
      var v = valueOf(b);
      var pinned = focus.store.pinned.has(b.code);
      var row = V.el("button", {
        cls: "rankrow" + (pinned ? " is-pinned" : ""), type: "button",
        "data-code": b.code, "aria-pressed": pinned ? "true" : "false",
        style: { opacity: focus.any() && !focus.has(b.code) ? .4 : 1 }
      }, box);
      V.el("span", { cls: "rk", text: String(i + 1) }, row);
      V.el("span", { cls: "nm", text: b.short }, row);
      V.el("span", { cls: "vv", text: fmtVal(v) }, row);
      var bar = V.el("span", { cls: "bar" }, row);
      var t = v == null ? 0 : ind().kind === "div"
        ? Math.abs(v) / (Math.max(Math.abs(dm.lo), Math.abs(dm.hi)) || 1)
        : (v - dm.lo) / ((dm.hi - dm.lo) || 1);
      V.el("i", { style: { width: Math.max(2, t * 100) + "%", background: colorFor(v, dm) } }, bar);
      row.addEventListener("click", function () { focus.toggle(b.code); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(b.code); });
    });
  }

  function renderCity() {
    var box = V.$("[data-city]");
    if (!box) return;
    V.clear(box);
    function row(k, v) {
      var r = V.el("div", { cls: "statrow" }, box);
      V.el("span", { cls: "k", text: k }, r);
      V.el("span", { cls: "v", text: v }, r);
    }
    if (S.ind === "pop") row("Bevölkerung " + S.year, fmt.int(D.cityPop(S.year)));
    else if (S.ind === "density") row("Dichte " + S.year, fmt.int(D.cityDensity(S.year)) + " /km²");
    else if (S.ind === "medianAge") row("Medianalter " + S.year, fmt.dec(D.cityMedianAge(S.year), 1) + " Jahre");
    else if (S.ind === "earnings") row("Medianlohn " + S.year, D.cityEarnings(S.year) == null ? "–" : fmt.int(D.cityEarnings(S.year)) + " £");
    else if (S.ind === "age0") row("Anteil 0–15", fmt.dec(D.cityAgeShare("Age 0\u201315"), 1) + " %");
    else if (S.ind === "age65") row("Anteil 65+", fmt.dec(D.cityAgeShare("Age 65+"), 1) + " %");
    else if (S.ind === "nonUk") row("Nicht in UK geboren", fmt.dec(shareNonUk(), 1) + " %");
    else if (S.ind === "level4") row("Hochschulabschluss", "–");
    else if (S.ind === "noQual") row("Ohne Abschluss", "–");
    else if (S.ind === "growth") row("Wachstum " + S.year, fmt.signedPct(growthCity()));
  }
  function shareNonUk() {
    var p = 0, t = 0;
    BOROUGHS.forEach(function (b) {
      var v = D.nonUk(b), pop = D.pop(b, 2025);
      if (v != null && pop) { p += v * pop; t += pop; }
    });
    return t ? p / t : NaN;
  }
  function growthCity() {
    var a = D.cityPop(S.year - 1), b = D.cityPop(S.year);
    return a && b ? ((b - a) / a) * 100 : NaN;
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
    V.el("div", { cls: "d3-detail-meta", text: "Rang " + (D.rankOf(code, ind(), S.year) || "–") + " von 33" }, head);

    /* Mini-Verlauf über die Jahre des Indikators */
    var ys = ind().years;
    if (ys.length > 1) {
      var w = 240, h = 76, pl = 6, pr = 6, pt = 12, pb = 16;
      var mini = V.el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Verlauf" }, card);
      var lo = Infinity, hi = -Infinity;
      ys.forEach(function (y) {
        var v = ind().get(b, y);
        if (v == null) return;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      });
      if (isFinite(lo) && hi > lo) {
        var xs = function (k) { return pl + (k / (ys.length - 1)) * (w - pl - pr); };
        var yy = function (v) { return pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb); };
        var pts = [];
        ys.forEach(function (y, k) {
          var v = ind().get(b, y);
          if (v != null) pts.push([xs(k), yy(v)]);
        });
        V.el("line", { cls: "grid-line", x1: pl, x2: w - pr, y1: h - pb, y2: h - pb }, mini);
        if (pts.length > 1) {
          V.el("path", {
            d: "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L"),
            fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
          }, mini);
        }
        var idx = ys.indexOf(S.year);
        var cv = idx >= 0 ? ind().get(b, S.year) : null;
        if (cv != null) V.el("circle", { cx: xs(idx), cy: yy(cv), r: 4, fill: "var(--accent)", stroke: "var(--card)", "stroke-width": 1.5 }, mini);
        V.el("text", { x: pl, y: h - 3, "font-size": 9.5, fill: "var(--text-mute)", text: String(ys[0]) }, mini);
        V.el("text", { x: w - pr, y: h - 3, "text-anchor": "end", "font-size": 9.5, fill: "var(--text-mute)", text: String(ys[ys.length - 1]) }, mini);
      }
    }

    var kv = V.el("div", { cls: "d3-kv" }, card);
    var r1 = V.el("div", null, kv);
    V.el("span", { cls: "k", text: ind().short }, r1);
    V.el("span", { cls: "v", text: fmtVal(valueOf(b)) }, r1);
    var r2 = V.el("div", null, kv);
    V.el("span", { cls: "k", text: "Bevölkerung 2025" }, r2);
    V.el("span", { cls: "v", text: fmt.int(D.pop(b, 2025)) }, r2);
    var r3 = V.el("div", null, kv);
    V.el("span", { cls: "k", text: "Medianalter 2025" }, r3);
    V.el("span", { cls: "v", text: fmt.dec(D.medianAge(b, 2025), 1) }, r3);
    var clr = V.el("button", { cls: "btn m1-clear", type: "button", text: "Auswahl aufheben" }, card);
    clr.addEventListener("click", function () { focus.clear(); });
  }

  /* --------------------------------------------------------------- Fokus - */
  var focus = V.createFocus(host);
  function applyFocus() {
    svg.classList.toggle("has-focus", focus.any());
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code);
      paths[b.code].classList.toggle("is-hot", hot);
      paths[b.code].classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      if (bubbles[b.code]) {
        bubbles[b.code].classList.toggle("is-hot", hot);
        bubbles[b.code].setAttribute("fill-opacity", hot ? 1 : .8);
      }
    });
    renderRank(domain());
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
    var i = ind();
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + i.label + (i.years.length > 1 ? " · " + S.year : " · 2025/2021") + "</div>" +
      '<div class="tip-row"><span class="k">Wert</span><span class="v">' + fmtVal(valueOf(b)) + "</span></div>" +
      '<div class="tip-row"><span class="k">Rang</span><span class="v">' +
      (D.rankOf(code, i, S.year) || "–") + " von 33</span></div>" +
      '<div class="tip-foot">' + i.unit + "</div>";
    V.tip().show(html, x, y);
  }

  /* ------------------------------------------------------------ Bedienung - */
  var indHost = V.$("[data-inds]");
  function buildInds() {
    V.clear(indHost);
    IND.forEach(function (i) {
      var on = S.ind === i.id;
      var c = V.el("button", {
        cls: "chip", type: "button", "data-v": i.id,
        "aria-pressed": on ? "true" : "false", "title": i.unit
      }, indHost);
      V.el("span", { cls: "dot", style: { background: on ? "var(--accent)" : "var(--line-strong)" } }, c);
      c.appendChild(document.createTextNode(i.short));
      c.addEventListener("click", function () {
        if (S.ind === i.id) return;
        S.ind = i.id;
        S.year = yearFor(i, S.year);
        syncYear();
        buildInds();
        render();
      });
    });
  }
  var yearEl = V.$("[data-year]"), yearLabel = V.$("[data-yearlabel]");
  function syncYear() {
    var i = ind();
    var ys = i.years;
    yearEl.min = ys[0]; yearEl.max = ys[ys.length - 1];
    yearEl.value = S.year;
    yearEl.disabled = ys.length < 2;
    if (yearLabel) yearLabel.textContent = ys.length > 1 ? String(S.year) : String(ys[0]);
  }
  yearEl.addEventListener("input", V.debounce(function () {
    S.year = yearFor(ind(), parseInt(yearEl.value, 10));
    if (yearLabel) yearLabel.textContent = String(S.year);
    render();
  }, 60));

  V.$$('[data-seg="view"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="view"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.view = btn.getAttribute("data-v");
      render();
    });
  });
  V.$("[data-reset]").addEventListener("click", function () {
    S.ind = "pop"; S.year = 2025; S.view = "choropleth";
    V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "choropleth" ? "true" : "false"); });
    focus.clear();
    syncYear(); buildInds(); render();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    render();
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });
  V.embed.on("year", function (d) {
    if (!d.years || !d.years.length) return;
    S.year = yearFor(ind(), d.years[d.years.length - 1]);
    syncYear(); render();
  });
  V.embed.on("metric", function (d) {
    if (d.indicator) {
      for (var k = 0; k < IND.length; k++) {
        if (IND[k].id === d.indicator) {
          S.ind = d.indicator;
          S.year = yearFor(IND[k], S.year);
          syncYear(); buildInds(); render();
          return;
        }
      }
    }
  });

  /* ---------------------------------------------------------------- Start - */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("ind")) {
    for (var k = 0; k < IND.length; k++) if (IND[k].id === p("ind")) S.ind = IND[k].id;
  }
  var py = parseInt(p("year") || "", 10);
  if (!isNaN(py)) S.year = py;
  if (p("view") === "bubbles") S.view = "bubbles";
  S.year = yearFor(ind(), S.year);
  V.$$('[data-seg="view"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.view ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) focus.set(fsel);

  buildInds();
  syncYear();
  render();
  focus.hoverOff(null);
  applyFocus();

  V.embed.markReady();
  V.embed.init();
  render();

  V.embed.watch();
})();
