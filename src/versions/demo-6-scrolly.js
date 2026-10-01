/* ==========================================================================
   Demo 6 · Demografie-Story
   Sticky Karte, Schritte steuern Merkmal, Jahr und Hervorhebung.
   Im Embed wird daraus der Player (siehe V.createStory).
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-stagemap]");
  var root = V.$("[data-story]");
  if (!host || !root) return;

  function code(name) {
    for (var i = 0; i < BOROUGHS.length; i++) if (BOROUGHS[i].name === name) return BOROUGHS[i].code;
    return null;
  }

  /* ---------------------------------------------------------- Grundkarte -- */
  var svg = V.el("svg", { cls: "chart m6-map", viewBox: V.geoBox(), role: "img", "aria-label": "Karte der 33 Londoner Bezirke" }, host);
  var gPaths = V.el("g", null, svg);
  var gLab = V.el("g", null, svg);

  var order = BOROUGHS.slice().sort(function (a, b) {
    return (V.data.geo.areas[b.code] || 0) - (V.data.geo.areas[a.code] || 0);
  });
  var paths = {}, labels = {};
  order.forEach(function (b) {
    paths[b.code] = V.el("path", {
      d: V.geo.paths[b.code], cls: "bor", "data-code": b.code,
      fill: "var(--bg-sunken)", stroke: "var(--card)", "stroke-width": 1,
      "stroke-linejoin": "round", tabindex: "0", role: "button", "aria-label": b.name
    }, gPaths);
  });
  BOROUGHS.forEach(function (b) {
    if (!b.xy) return;
    labels[b.code] = V.el("text", { cls: "m6-label", x: b.xy[0], y: b.xy[1], "text-anchor": "middle", "dominant-baseline": "middle" }, gLab);
    labels[b.code].textContent = b.short.replace(" upon Thames", "").replace("Barking & Dagenham", "Barking & D.");
  });

  /* ------------------------------------------------------------- Zustand -- */
  var S = { metric: "pop", year: 2011, mode: "seq", labels: [], focus: [] };

  function metricDef() {
    var M = {
      pop: { get: D.pop, unit: "Einwohner:innen",
        f: fmt.int, fa: fmt.compact,
        /* Wurzel-Skala ab null: die Bezirke unterscheiden sich um den Faktor 26,
           linear wäre der Großteil der Karte ununterscheidbar. */
        t: function (v, lo, hi) { return Math.sqrt(Math.max(0, v) / (hi || 1)); } },
      change: { get: null, unit: "% Veränderung 2011 → 2025",
        f: function (v) { return v == null ? "–" : fmt.signedPct(v); }, fa: function (v) { return fmt.signedPct(v); } },
      medianAge: { get: D.medianAge, unit: "Jahre",
        f: function (v) { return v == null ? "–" : fmt.dec(v, 1) + " Jahre"; },
        fa: function (v) { return fmt.dec(v, 0); },
        t: function (v, lo, hi) { return (v - lo) / ((hi - lo) || 1); } },
      level4: { get: function (b) { return D.education(b, "Level 4+"); }, unit: "% mit Hochschulabschluss (2021)",
        f: function (v) { return v == null ? "–" : fmt.dec(v, 1) + " %"; }, fa: function (v) { return fmt.dec(v, 0) + " %"; },
        t: function (v, lo, hi) { return (v - lo) / ((hi - lo) || 1); } },
      nonUk: { get: D.nonUk, unit: "% im Ausland geboren (2021)",
        f: function (v) { return v == null ? "–" : fmt.dec(v, 1) + " %"; }, fa: function (v) { return fmt.dec(v, 0) + " %"; },
        t: function (v, lo, hi) { return (v - lo) / ((hi - lo) || 1); } },
      earnings: { get: function (b) { return D.earnings(b, 2024); }, unit: "£ Medianlohn pro Woche (2024)",
        f: function (v) { return v == null ? "nicht veröffentlicht" : fmt.int(v) + " £"; },
        fa: function (v) { return fmt.int(v) + " £"; },
        t: function (v, lo, hi) { return (v - lo) / ((hi - lo) || 1); } }
    };
    return M[S.metric] || M.pop;
  }
  function changeOf(b) {
    var a = D.pop(b, 2011), z = D.pop(b, 2025);
    if (!a || !z) return null;
    return ((z - a) / a) * 100;
  }
  function valueOf(b) {
    if (S.metric === "change") return changeOf(b);
    return metricDef().get(b, S.year);
  }

  var divCache = null, divKey = "";
  function divScale(lo, hi) {
    if (divKey !== lo + "|" + hi) { divCache = D.divergingScale(lo, hi); divKey = lo + "|" + hi; }
    return divCache;
  }

  function paint() {
    var M = metricDef();
    var lo = Infinity, hi = -Infinity;
    BOROUGHS.forEach(function (b) {
      var v = valueOf(b);
      if (v == null) return;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (S.mode === "div") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }

    BOROUGHS.forEach(function (b) {
      var v = valueOf(b);
      var p = paths[b.code];
      var col;
      if (v == null) col = V.isDark() ? "#1b2331" : "#eef0f4";
      else if (S.mode === "div") col = divScale(lo, hi)(v);
      else col = V.ramp(V.currentRamp(), M.t ? M.t(v, lo, hi) : 0);
      p.setAttribute("fill", col);
      if (labels[b.code]) labels[b.code].style.opacity = 0;
    });
    S.labels.forEach(function (c) {
      if (labels[c]) labels[c].style.opacity = 1;
    });

    renderLegend(lo, hi);
  }

  function renderLegend(lo, hi) {
    var sw = V.$("[data-swatches]");
    if (sw) {
      V.clear(sw);
      if (S.mode === "div") {
        ["#1d5c8a", "#4d94b8", "#a8d5cf", "#eef0f4", "#f7c9a4", "#ef8f4e", "#c03a2b"]
          .forEach(function (c) { V.el("i", { style: { background: c } }, sw); });
      } else {
        for (var k = 0; k < 7; k++) V.el("i", { style: { background: V.ramp(V.currentRamp(), k / 6) } }, sw);
      }
    }
    var lt = V.$("[data-legendtitle]");
    if (lt) lt.textContent = S.mode === "div" ? "Veränderung 2011 → 2025" : metricDef().unit;
    var loEl = V.$("[data-legendmin]"), hiEl = V.$("[data-legendmax]");
    if (loEl) loEl.textContent = S.mode === "div" ? fmt.signedPct(lo) : (S.metric === "pop" ? "0" : metricDef().fa(lo));
    if (hiEl) hiEl.textContent = S.mode === "div" ? fmt.signedPct(hi) : metricDef().fa(hi);
  }

  /* -------------------------------------------------------------- Schritte */
  var STEPS = [
    { title: "2011", big: "8.204.407", unit: "Einwohner:innen in Greater London",
      metric: "pop", mode: "seq", year: 2011, focus: [],
      labels: ["E09000008", "E09000003", "E09000011", "E09000031"] },
    { title: "2025", big: "9.122.909", unit: "Einwohner:innen in Greater London",
      metric: "pop", mode: "seq", year: 2025, focus: [],
      labels: ["E09000008", "E09000003", "E09000011", "E09000031"] },
    { title: "Veränderung 2011 → 2025", big: "+11,2 %", unit: "Greater London gesamt",
      metric: "change", mode: "div", year: 2025,
      focus: ["E09000001", "E09000030", "E09000002"],
      labels: ["E09000001", "E09000030", "E09000002"] },
    { title: "Rückgang 2011 → 2025", big: "−7,9 %", unit: "Kensington & Chelsea",
      metric: "change", mode: "div", year: 2025,
      focus: ["E09000020", "E09000033", "E09000007"],
      labels: ["E09000020", "E09000033", "E09000007"] },
    { title: "Medianalter 2025", big: "30,8 Jahre", unit: "Tower Hamlets · jüngster Bezirk",
      metric: "medianAge", mode: "seq", year: 2025,
      focus: ["E09000030", "E09000027"],
      labels: ["E09000030", "E09000027"] },
    { title: "Hochschulabschluss 2021", big: "74,2 %", unit: "City of London · Höchstwert",
      metric: "level4", mode: "seq", year: 2021,
      focus: ["E09000001", "E09000016"],
      labels: ["E09000001", "E09000016"] },
    { title: "Im Ausland geboren 2021", big: "56,1 %", unit: "Brent · Höchstwert",
      metric: "nonUk", mode: "seq", year: 2021,
      focus: ["E09000005", "E09000016"],
      labels: ["E09000005", "E09000016"] },
    { title: "Medianlohn 2024", big: "843 £", unit: "Wandsworth · Höchstwert",
      metric: "earnings", mode: "seq", year: 2024,
      focus: ["E09000032", "E09000002"],
      labels: ["E09000032", "E09000002"] }
  ];

  var titleEl = V.$("[data-stagetitle]");
  var totalEl = V.$("[data-stagetotal]");
  var unitEl = V.$("[data-stageunit]");
  var focus = V.createFocus(host);
  var storyStep = 0;

  function setStage(i) {
    var st = STEPS[i] || STEPS[0];
    storyStep = i;
    S.metric = st.metric;
    S.mode = st.mode;
    S.year = st.year;
    S.labels = st.labels || [];
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

  /* --------------------------------------------------------------- Fokus - */
  function applyFocus() {
    svg.classList.toggle("has-focus", focus.any());
    BOROUGHS.forEach(function (b) {
      var hot = focus.has(b.code);
      paths[b.code].classList.toggle("is-hot", hot);
      paths[b.code].classList.toggle("is-pinned", focus.store.pinned.has(b.code));
    });
    if (focus.any()) {
      focus.store.codes.forEach(function (c) {
        if (labels[c]) labels[c].style.opacity = 1;
      });
    }
  }
  host.addEventListener("viz:focus", applyFocus);
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  Object.keys(paths).forEach(function (c) {
    var p = paths[c];
    p.addEventListener("pointerenter", function (e) { focus.hoverOn(c); showTip(c, e.clientX || 0, e.clientY || 0); });
    p.addEventListener("pointermove", function (e) { showTip(c, e.clientX || 0, e.clientY || 0); });
    p.addEventListener("pointerleave", function () { focus.hoverOff(c); V.tip().hide(); });
    p.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(c); });
    p.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focus.toggle(c); }
    });
    p.addEventListener("focus", function () { focus.hoverOn(c); });
    p.addEventListener("blur", function () { focus.hoverOff(c); });
  });

  function showTip(c, x, y) {
    var b = V.byCode[c];
    var ch = changeOf(b);
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">Bevölkerung ' + S.year + "</div>" +
      '<div class="tip-row"><span class="k">2011</span><span class="v">' + fmt.int(D.pop(b, 2011)) + "</span></div>" +
      '<div class="tip-row"><span class="k">2025</span><span class="v">' + fmt.int(D.pop(b, 2025)) + "</span></div>" +
      '<div class="tip-row"><span class="k">Veränderung</span><span class="v">' + fmt.signedPct(ch) + "</span></div>" +
      '<div class="tip-foot">Medianalter 2025: ' + fmt.dec(D.medianAge(b, 2025), 1) +
      " · Hochschulabschluss: " + fmt.dec(D.education(b, "Level 4+"), 1) + " %</div>";
    V.tip().show(html, x, y);
  }
  void code;

  /* ---------------------------------------------------------------- Story - */
  V.reveal();
  paint();

  var story = V.createStory({
    root: root,
    steps: "[data-step]",
    nav: "[data-nav]",
    onStep: function (i) { setStage(i); }
  });

  V.embed.on("step", function (d) { if (typeof d.index === "number") story.go(d.index); });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    paint();
  });

  V.embed.markReady();
  V.embed.init();
  paint();
  void storyStep;

  V.embed.watch();
})();
