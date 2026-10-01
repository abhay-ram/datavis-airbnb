/* ==========================================================================
   Demo 2 · Altersstruktur
   Altersprofil eines Bezirks im Vergleich zu Greater London
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;
  var AGES = 91;

  var host = V.$("[data-profile]");
  if (!host) return;

  var METRICS = [
    { id: "age0", label: "Anteil 0\u201315",
      get: function (b) { return D.ageShare(b, "Age 0\u201315"); },
      city: function () { return D.cityAgeShare("Age 0\u201315"); },
      f: function (v) { return fmt.dec(v, 1) + " %"; } },
    { id: "age16", label: "Anteil 16\u201364",
      get: function (b) { return D.ageShare(b, "Age 16\u201364"); },
      city: function () { return D.cityAgeShare("Age 16\u201364"); },
      f: function (v) { return fmt.dec(v, 1) + " %"; } },
    { id: "age65", label: "Anteil 65+",
      get: function (b) { return D.ageShare(b, "Age 65+"); },
      city: function () { return D.cityAgeShare("Age 65+"); },
      f: function (v) { return fmt.dec(v, 1) + " %"; } },
    { id: "medianAge", label: "Medianalter",
      get: function (b) { return D.medianAge(b, 2025); },
      city: function () { return D.cityMedianAge(2025); },
      f: function (v) { return fmt.dec(v, 1) + " Jahre"; } }
  ];
  function metric() {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].id === S.metric) return METRICS[i];
    return METRICS[0];
  }

  var S = { metric: "medianAge", cmp: "city", sel: null, hover: null, pinned: {}, q: "" };

  function selCode() { return S.hover || S.sel; }
  function sel() { return V.byCode[selCode()] || BOROUGHS[0]; }
  function groupColors() {
    return V.isDark() ? ["#7ba6d6", "#2fd0c0", "#ff7a45"] : ["#8fb8d8", "#00a699", "#fc642d"];
  }

  var TOTALS = {};
  BOROUGHS.forEach(function (b) {
    var t = 0;
    for (var i = 0; i < AGES; i++) t += D.ageAt(b, i);
    TOTALS[b.code] = t || 1;
  });
  var CITY_TOTAL = (function () {
    var t = 0;
    for (var i = 0; i < AGES; i++) t += D.cityAgeAt(i);
    return t || 1;
  })();
  function shareB(b, i) { return (D.ageAt(b, i) / TOTALS[b.code]) * 100; }
  function shareCity(i) { return (D.cityAgeAt(i) / CITY_TOTAL) * 100; }

  /* ------------------------------------------------------------- Zeichnen - */
  var svg = V.el("svg", { cls: "chart d2-chart", role: "img", "aria-label": "Altersprofil nach Jahrgängen" }, host);
  var gBars = V.el("g", null, svg);
  var gLine = V.el("g", null, svg);
  var gAxis = V.el("g", null, svg);
  var gHit = V.el("g", null, svg);

  var W = 800, H = 340, PL = 46, PR = 14, PT = 16, PB = 40;
  var xS = null, yS = null, barW = 6;

  var bars = [], hits = [];
  for (var i = 0; i < AGES; i++) {
    bars.push(V.el("rect", { cls: "d2-bar", x: 0, y: 0, width: 0, height: 0, rx: 1.5, fill: "var(--accent)", "fill-opacity": .85 }, gBars));
    (function (idx) {
      var r = V.el("rect", { cls: "d2-agebg", x: 0, y: 0, width: 0, height: 0 }, gHit);
      r.addEventListener("pointerenter", function (e) { lit(idx); moveTip(idx, e); });
      r.addEventListener("pointermove", function (e) { moveTip(idx, e); });
      r.addEventListener("pointerleave", function () { unlit(); V.tip().hide(); });
      hits.push(r);
    })(i);
  }
  var cityPath = V.el("path", { cls: "d2-cityline", fill: "none", stroke: "var(--text-mute)", "stroke-width": 1.8, "stroke-linejoin": "round", opacity: .85 }, gLine);
  var mkLine = V.el("line", { cls: "d2-marker", y1: 0, y2: 0 }, gAxis);
  var tweenRef = null;

  function render(animate) {
    var b = sel();
    W = Math.max(320, host.clientWidth || 800);
    var narrow = W < 560;
    PL = narrow ? 34 : 46;
    PR = narrow ? 10 : 14;
    PB = narrow ? 34 : 40;
    H = Math.round(Math.max(220, Math.min(380, W * 0.42)));
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.height = H + "px";

    var plotW = W - PL - PR;
    barW = Math.max(2, plotW / AGES - 1.2);
    xS = function (k) { return PL + (k * plotW) / AGES; };

    var maxV = 0;
    for (var k = 0; k < AGES; k++) {
      maxV = Math.max(maxV, shareB(b, k));
      if (S.cmp === "city") maxV = Math.max(maxV, shareCity(k));
    }
    maxV = maxV * 1.12 || 1;
    yS = V.linear(0, maxV, H - PB, PT);

    animate = animate && !V.reduced;
    var from = bars.map(function (r) { return parseFloat(r.getAttribute("height")) || 0; });

    function paint(p) {
      for (var k2 = 0; k2 < AGES; k2++) {
        var target = H - PB - yS(shareB(b, k2));
        var h = from[k2] + (target - from[k2]) * p;
        bars[k2].setAttribute("x", xS(k2).toFixed(2));
        bars[k2].setAttribute("y", (H - PB - h).toFixed(2));
        bars[k2].setAttribute("width", barW.toFixed(2));
        bars[k2].setAttribute("height", Math.max(0, h).toFixed(2));
      }
      if (S.cmp === "city") {
        cityPath.style.display = "";
        var pts = [];
        for (var k3 = 0; k3 < AGES; k3++) {
          pts.push((xS(k3) + barW / 2).toFixed(1) + " " + yS(shareCity(k3)).toFixed(1));
        }
        cityPath.setAttribute("d", "M" + pts.join("L"));
      } else {
        cityPath.style.display = "none";
      }
    }

    if (tweenRef) { tweenRef.cancel(); tweenRef = null; }
    if (animate) tweenRef = V.tween({ dur: 620, ease: V.ease.out, onUpdate: paint });
    else paint(1);

    drawAxis(narrow);
    layoutHits();
    unlit();
    renderGroups(b);
    renderSex(b);
    var t = V.$("[data-btitle]");
    if (t) t.textContent = b.name;
    var sub = V.$("[data-bsub]");
    if (sub) {
      sub.textContent = "Altersprofil 2025 · " + fmt.int(TOTALS[b.code]) + " Einwohner:innen" +
        (S.cmp === "city" ? " · Linie: Greater London" : "");
    }
    var lg = V.$("[data-lg-b]");
    if (lg) lg.textContent = b.short;
  }

  function drawAxis(narrow) {
    V.clear(gAxis);
    var maxV = yS.domain[1];
    V.niceTicks(maxV, 4).forEach(function (t) {
      var y = yS(t);
      if (y < PT - 4) return;
      V.el("line", { cls: t === 0 ? "zero-line" : "grid-line", x1: PL, x2: W - PR, y1: y, y2: y }, gAxis);
      V.el("text", { cls: "axis-label", x: PL - 6, y: y, "text-anchor": "end", "dominant-baseline": "middle", text: fmt.dec(t, t < 1 ? 1 : 0) + " %" }, gAxis);
    });
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(function (a) {
      if (narrow && a % 20 !== 0 && a !== 90) return;
      V.el("text", { cls: "axis-label", x: xS(a) + barW / 2, y: H - PB + 15, "text-anchor": "middle", text: String(a) }, gAxis);
    });
    V.el("text", { cls: "axis-label", x: W - PR, y: H - 6, "text-anchor": "end", text: "Alter in Jahren" }, gAxis);
  }

  function layoutHits() {
    for (var k = 0; k < AGES; k++) {
      hits[k].setAttribute("x", xS(k).toFixed(2));
      hits[k].setAttribute("y", PT);
      hits[k].setAttribute("width", Math.max(barW, 4).toFixed(2));
      hits[k].setAttribute("height", Math.max(10, H - PB - PT));
    }
  }

  function lit(idx) {
    bars.forEach(function (r, k) { r.setAttribute("fill-opacity", k === idx ? 1 : .5); });
    mkLine.setAttribute("x1", xS(idx) + barW / 2);
    mkLine.setAttribute("x2", xS(idx) + barW / 2);
    mkLine.setAttribute("y1", PT);
    mkLine.setAttribute("y2", H - PB);
    mkLine.classList.add("is-on");
  }
  function unlit() {
    bars.forEach(function (r) { r.setAttribute("fill-opacity", .85); });
    mkLine.classList.remove("is-on");
  }
  function moveTip(idx, e) {
    var b = sel();
    var label = idx === 90 ? "90 Jahre und älter" : idx + " Jahre";
    var html = '<div class="tip-title">' + label + "</div>" +
      '<div class="tip-meta">Anteil an der Bevölkerung 2025</div>' +
      '<div class="tip-row"><span class="k"><i style="background:var(--accent)"></i>' +
      escapeHtml(b.short) + '</span><span class="v">' + fmt.dec(shareB(b, idx), 2) + " %</span></div>" +
      '<div class="tip-row"><span class="k"><i style="background:var(--text-mute)"></i>Greater London</span>' +
      '<span class="v">' + fmt.dec(shareCity(idx), 2) + " %</span></div>" +
      '<div class="tip-foot">' + fmt.int(D.ageAt(b, idx)) + " Personen im Bezirk</div>";
    V.tip().show(html, e.clientX || 0, e.clientY || 0);
  }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function renderGroups(b) {
    var box = V.$("[data-groups]");
    if (!box) return;
    V.clear(box);
    D.ageGroups.forEach(function (g) {
      var share = D.ageShare(b, g);
      var city = D.cityAgeShare(g);
      var d = V.el("div", { cls: "d2-group" }, box);
      V.el("b", { text: share == null ? "–" : fmt.dec(share, 1) + " %" }, d);
      V.el("span", { text: D.ageLabels[g] || g }, d);
      V.el("i", { text: city == null ? "" : "London " + fmt.dec(city, 1) + " %" }, d);
    });
  }

  function renderSex(b) {
    var box = V.$("[data-sex]");
    if (!box) return;
    V.clear(box);
    var f = D.sexShare(b, "Female"), m = D.sexShare(b, "Male");
    if (f == null || m == null) { V.el("p", { cls: "d3-hint", text: "Keine Angabe." }, box); return; }
    var wrap = V.el("div", { cls: "d2-sex" }, box);
    var bar = V.el("div", { cls: "d2-sexbar" }, wrap);
    var fEl = V.el("div", { style: { width: f + "%", background: V.isDark() ? "#c96aa8" : "#b8558f" } }, bar);
    fEl.textContent = fmt.dec(f, 1) + " %";
    var mEl = V.el("div", { style: { width: m + "%", background: V.isDark() ? "#4d8fc9" : "#3d6fa8" } }, bar);
    mEl.textContent = fmt.dec(m, 1) + " %";
    var lg = V.el("div", { cls: "d2-sexlegend" }, wrap);
    V.el("span", { text: b.short + ": Frauen" }, lg);
    V.el("span", { text: "Männer" }, lg);
  }

  /* --------------------------------------------------------------- Liste - */
  var listHost = V.$("[data-list]");
  function renderList() {
    if (!listHost) return;
    var M = metric();
    var sorted = BOROUGHS.slice().sort(function (a, b) {
      var va = M.get(a), vb = M.get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
    var q = S.q.trim().toLowerCase();
    var vis = sorted.filter(function (b) { return !q || b.name.toLowerCase().indexOf(q) >= 0; });
    V.clear(listHost);
    if (!vis.length) { V.el("div", { cls: "d1-empty", text: "Kein Bezirk gefunden." }, listHost); return; }

    var colors = groupColors();
    vis.forEach(function (b) {
      var isSel = S.sel === b.code;
      var isPinned = !!S.pinned[b.code];
      var row = V.el("button", {
        cls: "d2-item mark" + (isSel ? " is-on" : "") + (isPinned ? " is-pinned" : ""),
        type: "button", role: "listitem", "data-code": b.code, tabindex: "0",
        "aria-pressed": isPinned ? "true" : "false", "aria-label": b.name
      }, listHost);
      V.el("span", { cls: "nm", text: b.short }, row);
      var mini = V.el("span", { cls: "d2-mini" }, row);
      D.ageGroups.forEach(function (g, i) {
        V.el("i", { style: { width: (D.ageShare(b, g) || 0) + "%", background: colors[i] } }, mini);
      });
      var v = M.get(b);
      V.el("span", { cls: "vv", text: v == null ? "–" : M.f(v) }, row);

      row.addEventListener("click", function (e) {
        e.stopPropagation();
        S.pinned[b.code] = !S.pinned[b.code];
        S.sel = b.code;
        render(true); renderList();
      });
      row.addEventListener("pointerenter", function (e) {
        S.hover = b.code;
        row.classList.add("is-hot");
        render(true);
        showBoroughTip(b.code, e.clientX || 0, e.clientY || 0);
      });
      row.addEventListener("pointermove", function (e) { showBoroughTip(b.code, e.clientX || 0, e.clientY || 0); });
      row.addEventListener("pointerleave", function () {
        S.hover = null;
        row.classList.remove("is-hot");
        V.tip().hide();
        render(true);
      });
    });
  }

  function showBoroughTip(code, x, y) {
    var b = V.byCode[code];
    var M = metric();
    var v = M.get(b), c = M.city();
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">' + M.label + " · 2025</div>" +
      '<div class="tip-row"><span class="k">' + escapeHtml(b.short) + '</span><span class="v">' +
      (v == null ? "–" : M.f(v)) + "</span></div>" +
      '<div class="tip-row"><span class="k">Greater London</span><span class="v">' +
      (c == null ? "–" : M.f(c)) + "</span></div>";
    if (v != null && c != null) {
      html += '<div class="tip-foot">' + (v > c ? "über" : "unter") + " dem Londoner Wert (" +
        fmt.dec(v - c, 1) + (M.id === "medianAge" ? " Jahre" : " Punkte") + ")</div>";
    }
    V.tip().show(html, x, y);
  }

  /* ------------------------------------------------------------ Bedienung - */
  V.$$('[data-seg="metric"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="metric"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.metric = btn.getAttribute("data-v");
      render(false);
      renderList();
    });
  });
  V.$$('[data-seg="cmp"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="cmp"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.cmp = btn.getAttribute("data-v");
      render(true);
    });
  });
  V.$("[data-q]").addEventListener("input", V.debounce(function (e) {
    S.q = e.target.value;
    renderList();
  }, 120));
  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "medianAge"; S.cmp = "city"; S.q = ""; S.pinned = {}; S.hover = null;
    S.sel = "E09000033";
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "medianAge" ? "true" : "false"); });
    V.$$('[data-seg="cmp"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "city" ? "true" : "false"); });
    V.$("[data-q]").value = "";
    render(false);
    renderList();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    render(false);
    renderList();
  });
  V.embed.on("focus", function (d) {
    if (d.codes && d.codes.length) {
      S.sel = d.codes[d.codes.length - 1];
      render(true); renderList();
    }
  });
  V.embed.on("metric", function (d) {
    for (var i = 0; i < METRICS.length; i++) {
      if (METRICS[i].id === d.metric) {
        S.metric = d.metric;
        V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === d.metric ? "true" : "false"); });
        render(false); renderList();
        return;
      }
    }
  });

  /* ---------------------------------------------------------------- Start - */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("metric")) {
    for (var i = 0; i < METRICS.length; i++) if (METRICS[i].id === p("metric")) S.metric = METRICS[i].id;
  }
  if (p("cmp") === "none" || p("cmp") === "city") S.cmp = p("cmp");
  var f = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  S.sel = f.length ? f[f.length - 1] : "E09000033";
  if (!V.byCode[S.sel]) S.sel = BOROUGHS[0].code;
  if (p("q")) { S.q = p("q"); V.$("[data-q]").value = p("q"); }
  V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
  V.$$('[data-seg="cmp"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.cmp ? "true" : "false"); });

  render(false);
  renderList();

  V.embed.markReady();
  V.embed.init();
  render(false);

  var rerender = V.debounce(function () { render(false); }, 150);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(host); } catch (e) {} }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();

