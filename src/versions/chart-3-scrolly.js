/* ==========================================================================
   Chart 3 · Scroll-Story (Balken, die die Geschichte erzählen)
   Der Stage-Chart ist zugleich interaktiv: Hover hebt hervor, Klick fixiert.
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-stagechart]");
  var root = V.$("[data-story]");
  if (!host || !root) return;

  var ROW = 15, BAR = 9, PADT = 6, PADB = 22;
  var W = 760, H = 560, labelW = 132, plotW = 560, valW = 54;

  var svg = V.el("svg", { cls: "chart c3-chart", role: "img", "aria-label": "Balkendiagramm aller 33 Londoner Bezirke" }, host);
  var gAxis = V.el("g", null, svg);
  var gRows = V.el("g", null, svg);
  host.classList.add("c3-chart");

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

  function measure() {
    W = Math.max(300, host.clientWidth || 760);
    var narrow = W < 560;
    labelW = narrow ? 88 : Math.min(140, Math.round(W * 0.19));
    valW = narrow ? 42 : 56;
    plotW = Math.max(60, W - labelW - valW);
    H = PADT + BOROUGHS.length * ROW + PADB;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.height = H + "px";
  }

  var rows = {};
  function build() {
    BOROUGHS.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "en"); })
      .forEach(function (b) {
        var g = V.el("g", { cls: "c3-row mark", "data-code": b.code, tabindex: "0", role: "button", "aria-label": b.name }, gRows);
        var track = V.el("rect", { cls: "c3-track", x: labelW, y: 0, width: plotW, height: BAR, rx: 2.5 }, g);
        var fill = V.el("rect", { cls: "c3-bar", x: labelW, y: 0, width: 0, height: BAR }, g);
        var hit = V.el("rect", { cls: "mark-hit", x: 0, y: 0, width: W, height: ROW }, g);
        var name = V.el("text", { cls: "c3-name", x: labelW - 8, y: 0, "text-anchor": "end", "dominant-baseline": "middle" }, g);
        name.textContent = V.shortName(b.name);
        var val = V.el("text", { cls: "c3-val", x: W - valW + 4, y: 0, "dominant-baseline": "middle" }, g);
        rows[b.code] = { g: g, track: track, fill: fill, hit: hit, name: name, val: val, cw: 0, tw: 0, b: b };

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

  var S = { metric: "listings", year: 2026, sort: "value" };

  function orderFor() {
    var list = BOROUGHS.slice();
    if (S.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name, "en"); });
    else list.sort(function (a, b) {
      return V.value(b, S.metric, S.year) - V.value(a, S.metric, S.year) || a.name.localeCompare(b.name, "en");
    });
    return list;
  }

  var tweenRef = null;
  function layout(animate) {
    measure();
    var order = orderFor();
    var max = V.domain(S.metric);
    var from = {}, to = {};
    order.forEach(function (b, i) {
      var mk = rows[b.code];
      from[b.code] = mk.cw;
      to[b.code] = Math.max(1.5, (V.value(b, S.metric, S.year) / max) * plotW);
      mk.y = PADT + i * ROW + (ROW - BAR) / 2;
    });
    function paint(p) {
      order.forEach(function (b) {
        var mk = rows[b.code];
        mk.cw = from[b.code] + (to[b.code] - from[b.code]) * p;
        mk.g.setAttribute("transform", "translate(0," + mk.y + ")");
        mk.fill.setAttribute("width", mk.cw.toFixed(2));
        mk.fill.setAttribute("fill", YEAR_COLOR[S.year]);
        mk.track.setAttribute("x", labelW);
        mk.track.setAttribute("width", plotW);
        mk.hit.setAttribute("width", W);
        mk.val.setAttribute("x", W - valW + 4);
        mk.val.textContent = S.metric === "per1k"
          ? fmt.per1k(V.per1k(mk.b, S.year))
          : fmt.int(V.listings(mk.b, S.year));
        mk.name.setAttribute("x", labelW - 8);
      });
    }
    if (!animate || V.reduced) {
      if (tweenRef) { tweenRef.cancel(); tweenRef = null; }
      paint(1);
    } else {
      if (tweenRef) tweenRef.cancel();
      tweenRef = V.tween({ dur: 760, ease: V.ease.inOut, onUpdate: paint });
    }
    V.clear(gAxis);
    var y = H - PADB + 14;
    V.niceTicks(max, 5).forEach(function (t) {
      var x = labelW + (t / max) * plotW;
      V.el("line", { cls: "grid-line", x1: x, x2: x, y1: PADT, y2: y - 9, opacity: .8 }, gAxis);
      V.el("text", {
        cls: "axis-label", x: x, y: y, "text-anchor": "middle",
        text: S.metric === "per1k" ? fmt.per1k(t) : fmt.compact(t)
      }, gAxis);
    });
  }

  /* ------------------------------------------------------------- focus --- */
  var focus = V.createFocus(host);
  host.addEventListener("viz:focus", function () {
    BOROUGHS.forEach(function (b) {
      var mk = rows[b.code];
      var hot = focus.has(b.code);
      mk.g.classList.toggle("is-hot", hot);
      mk.g.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      mk.name.classList.toggle("is-hot", hot);
      mk.name.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      var pinned = focus.store.pinned.has(b.code);
      mk.fill.setAttribute("fill", pinned && storyStep === 5 ? DOWN : YEAR_COLOR[S.year]);
      mk.fill.setAttribute("opacity", hot ? 1 : .92);
    });
  });
  host.addEventListener("click", function (e) { if (e.target === svg) focus.clear(); });

  function showTip(code, x, y) {
    var b = V.byCode[code];
    var html = '<div class="tip-title">' + b.name + "</div>" +
      '<div class="tip-meta">Rang ' + V.rankOf(code, S.metric, S.year) + " von 33 · " + S.year + "</div>";
    YEARS.forEach(function (yy) {
      html += '<div class="tip-row"><span class="k"><i style="background:' + YEAR_COLOR[yy] + '"></i>' +
        V.meta.snapshots[String(yy)] + "</span><span class=\"v\">" +
        (S.metric === "per1k" ? fmt.per1k(V.per1k(b, yy)) : fmt.int(V.listings(b, yy))) + "</span></div>";
    });
    var g = V.growth(b, S.metric, YEARS[0], YEARS[2]);
    html += '<div class="tip-foot">2015 → 2026: <strong>' + fmt.signedPct(g.pct) + "</strong></div>";
    V.tip().show(html, x, y);
  }

  /* ------------------------------------------------------------- stages -- */
  var OUTER = ["E09000002", "E09000004", "E09000016", "E09000029"];      // Barking, Bexley, Havering, Sutton
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
    { label: "April 2015", big: "18.436", unit: "Inserate in London", year: 2015, metric: "listings", focus: [] },
    { label: "Mai 2019", big: "80.767", unit: "Inserate in London", year: 2019, metric: "listings", focus: [] },
    { label: "19. Juni 2026", big: "92.799", unit: "Inserate in London", year: 2026, metric: "listings", focus: [] },
    { label: "Wachstum seit 2015", big: "98×", unit: "Barking & Dagenham", year: 2026, metric: "listings", focus: OUTER, color: "year" },
    { label: "Konzentration 2026", big: "38,8 %", unit: "Anteil der fünf größten Bezirke", year: 2026, metric: "listings", focus: topN(5, 2026, "listings"), color: "year" },
    { label: "Rückgang seit 2019", big: "−887", unit: "Tower Hamlets", year: 2026, metric: "listings", focus: DECLINERS, color: "down" },
    { label: "Je 1.000 Einwohner:innen", big: "51,4", unit: "Westminster · Höchstwert", year: 2026, metric: "per1k", focus: topN(3, 2026, "per1k"), color: "year" },
    { label: "19. Juni 2026", big: "92.799", unit: "Inserate in 33 Bezirken", year: 2026, metric: "listings", focus: [] }
  ];

  var titleEl = V.$("[data-stagetitle]");
  var totalEl = V.$("[data-stagetotal]");
  var unitEl = V.$("[data-stageunit]");
  var storyStep = -1;

  function setStage(i) {
    var st = STEPS[i] || STEPS[0];
    storyStep = i;
    S.year = st.year;
    S.metric = st.metric;
    if (titleEl) titleEl.textContent = st.label;
    if (totalEl) {
      totalEl.textContent = st.big;
      totalEl.classList.remove("pop");
      void totalEl.offsetWidth;
      totalEl.classList.add("pop");
    }
    if (unitEl) unitEl.textContent = st.unit;
    focus.set(st.focus || []);
    layout(true);
  }

  /* -------------------------------------------------------------- story -- */
  measure();
  build();
  layout(false);

  /* Erst aufbauen, dann den Einbettungsmodus anwenden - createStory muss
     wissen, ob es ein iframe ist. */
  V.embed.markReady();
  V.embed.init();
  V.reveal();
  layout(false);

  var story = V.createStory({
    root: root,
    steps: "[data-step]",
    nav: "[data-nav]",
    onStep: function (i) { setStage(i); }
  });

  V.embed.on("step", function (d) {
    if (typeof d.index === "number") story.go(d.index);
  });
  V.embed.on("metric", function (d) {
    if (d.metric === "per1k" || d.metric === "listings") {
      S.metric = d.metric; layout(true);
    }
  });
  V.embed.on("year", function (d) {
    if (d.years && d.years.length) { S.year = d.years[d.years.length - 1]; layout(true); }
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors(); layout(false);
  });

  var rerender = V.debounce(function () { layout(false); }, 160);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(host); } catch (e) {} }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();
