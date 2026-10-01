/* ==========================================================================
   Chart 1 · Linien nach Bezirk
   X-Achse = Jahr (2015 · 2019 · 2026), Y-Achse = die 33 Bezirke
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var T = V.T, fmt = V.fmt;
  var YEARS = V.years;
  var BOROUGHS = V.boroughs;
  var CODE = {};
  BOROUGHS.forEach(function (b, i) { CODE[b.code] = i; });

  var S = {
    metric: "listings",
    mode: "rank",                 // rank | value | share
    topN: 0,                      // 0 = alle
    years: new Set(YEARS),
    sortYear: 2026,
    q: ""
  };

  var host = V.$("[data-chart]");
  if (!host) return;
  host.classList.add("chart");

  var svg = V.el("svg", { cls: "chart", role: "img", "aria-label": "Liniendiagramm der Airbnb-Inserate in 33 Londoner Bezirken" }, host);
  var defs = V.el("defs", null, svg);
  var gGrid = V.el("g", { cls: "c1-grid" }, svg);
  var gMarks = V.el("g", { cls: "c1-marks" }, svg);
  var gAxes = V.el("g", { cls: "c1-axes" }, svg);

  /* ------------------------------------------------------- year colors --- */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  var YCOLOR = {};
  function readColors() {
    YCOLOR[YEARS[0]] = cssVar("--y2015", "#8fb8d8");
    YCOLOR[YEARS[1]] = cssVar("--y2019", "#00a699");
    YCOLOR[YEARS[2]] = cssVar("--y2026", "#fc642d");
  }
  function buildGradient() {
    V.clear(defs);
    var g = V.el("linearGradient", {
      id: "c1flow", gradientUnits: "userSpaceOnUse",
      x1: geom.padLeft, y1: 0, x2: geom.padLeft + geom.plotW, y2: 0
    }, defs);
    V.el("stop", { offset: "0%", "stop-color": YCOLOR[YEARS[0]] }, g);
    V.el("stop", { offset: "50%", "stop-color": YCOLOR[YEARS[1]] }, g);
    V.el("stop", { offset: "100%", "stop-color": YCOLOR[YEARS[2]] }, g);
  }
  readColors();

  /* ---------------------------------------------------------- geometry --- */
  var geom = {};
  var LANE = 24;

  function computeGeom(n) {
    var w = Math.max(320, host.clientWidth || host.getBoundingClientRect().width || 900);
    var narrow = w < 640;
    geom.w = w;
    /* Gutter bleibt über alle Modi gleich breit, damit die Linien beim
       Umschalten nicht seitlich springen. */
    geom.padLeft = narrow ? 100 : w < 900 ? 126 : 150;
    geom.padRight = narrow ? 62 : 88;
    geom.padTop = 46;
    geom.padBottom = 30;
    geom.plotW = Math.max(120, w - geom.padLeft - geom.padRight);
    geom.lane = LANE;
    geom.n = n;
    geom.h = S.mode === "rank"
      ? geom.padTop + Math.max(1, n) * LANE + geom.padBottom
      : Math.max(260, geom.padTop + Math.max(1, n) * (narrow ? 15 : 19) + geom.padBottom);
    geom.xs = [geom.padLeft, geom.padLeft + geom.plotW / 2, geom.padLeft + geom.plotW];
    svg.setAttribute("viewBox", "0 0 " + geom.w + " " + geom.h);
    svg.setAttribute("width", geom.w);
    svg.setAttribute("height", geom.h);
    svg.style.height = geom.h + "px";
  }

  /* ------------------------------------------------------------- state --- */
  var marks = {};        // code -> { g, path, hit, dots[], name, val, leader, cur:[y,y,y], vis }
  var rows = [];         // geordnete Bezirke (aktuell sichtbar)
  var ticks = [];

  function lastActive() {
    var on = YEARS.filter(function (y) { return S.years.has(y); });
    return on.length ? on[on.length - 1] : S.sortYear;
  }
  function firstActive() {
    var on = YEARS.filter(function (y) { return S.years.has(y); });
    return on.length ? on[0] : S.sortYear;
  }
  function share(b, y) { return (V.listings(b, y) / V.totals[y]) * 100; }

  function displayValue(b, y) {
    if (S.mode === "share") return share(b, y);
    return V.value(b, S.metric, y);
  }
  function valueText(b, y) {
    if (S.mode === "share") return fmt.dec(share(b, y), 1) + " %";
    return S.metric === "per1k" ? fmt.per1k(V.per1k(b, y)) : fmt.int(V.listings(b, y));
  }

  function computeRows() {
    var order = S.mode === "rank"
      ? V.rankMap(S.sortYear, S.metric)
      : (function () {
          var m = {};
          BOROUGHS.slice().sort(function (a, b) {
            return displayValue(b, S.sortYear) - displayValue(a, S.sortYear);
          }).forEach(function (b, i) { m[b.code] = i + 1; });
          return m;
        })();
    rows = BOROUGHS.slice().sort(function (a, b) { return order[a.code] - order[b.code]; });
    if (S.topN) rows = rows.slice(0, S.topN);
  }

  function localRank(year) {
    var sorted = rows.slice().sort(function (a, b) {
      return V.value(b, S.metric, year) - V.value(a, S.metric, year);
    });
    var m = {};
    sorted.forEach(function (b, i) { m[b.code] = i; });
    return m;
  }

  var yScale = null;
  function computeTicks() {
    var max = 0;
    rows.forEach(function (b) {
      YEARS.forEach(function (y) { max = Math.max(max, displayValue(b, y)); });
    });
    max = max * 1.05 || 1;
    ticks = V.niceTicks(max, 5);
    var top = ticks[ticks.length - 1] || 1;
    yScale = V.linear(0, top, geom.h - geom.padBottom, geom.padTop);
    geom.yMax = top;
  }

  function targets() {
    var t = {};
    if (S.mode === "rank") {
      YEARS.forEach(function (y, i) {
        var lr = localRank(y);
        rows.forEach(function (b) {
          if (!t[b.code]) t[b.code] = [0, 0, 0];
          t[b.code][i] = geom.padTop + (lr[b.code] + 0.5) * LANE;
        });
      });
    } else {
      rows.forEach(function (b) {
        t[b.code] = YEARS.map(function (y) { return yScale(displayValue(b, y)); });
      });
    }
    return t;
  }

  /* -------------------------------------------------------------- build --- */
  function buildMarks() {
    BOROUGHS.forEach(function (b) {
      var g = V.el("g", { cls: "mark", "data-code": b.code }, gMarks);
      var mk = { g: g, code: b.code, cur: null, dots: [] };

      mk.leader = V.el("line", { cls: "c1-leader", stroke: "var(--line-strong)", "stroke-width": 1 }, g);
      mk.path = V.el("path", { cls: "c1-line", fill: "none", stroke: "url(#c1flow)", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      mk.hit = V.el("path", { cls: "mark-hit", fill: "none", stroke: "transparent", "stroke-width": 15, "stroke-linecap": "round", style: { cursor: "pointer" } }, g);

      for (var i = 0; i < YEARS.length; i++) {
        var dot = V.el("circle", { cls: "c1-dot", r: 5, cx: 0, cy: 0, fill: "var(--card)", stroke: YCOLOR[YEARS[i]], "stroke-width": 2.6 }, g);
        mk.dots.push(dot);
      }
      mk.name = V.el("text", { cls: "mark-name", "text-anchor": "end", "dominant-baseline": "middle" }, g);
      mk.name.textContent = V.shortName(b.name);
      mk.val = V.el("text", { cls: "c1-val mark-value", "text-anchor": "start", "dominant-baseline": "middle" }, g);

      var cd = b.code;
      /* Listener auf der Gruppe: pointerenter erreicht in echten Browsern
         auch die Vorfahren, dadurch reagiert die ganze Zeile. */
      mk.g.addEventListener("pointerenter", function (e) { focus.hoverOn(cd); showTip(cd, e.clientX || 0, e.clientY || 0); });
      mk.g.addEventListener("pointermove", function (e) { showTip(cd, e.clientX || 0, e.clientY || 0); });
      mk.g.addEventListener("pointerleave", function () { focus.hoverOff(cd); V.tip().hide(); });
      mk.g.addEventListener("click", function (e) { e.stopPropagation(); focus.toggle(cd); });
      mk.g.style.cursor = "pointer";

      mk.g.setAttribute("tabindex", "0");
      mk.g.setAttribute("role", "button");
      mk.g.setAttribute("aria-label", b.name);
      mk.g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focus.toggle(cd); renderList(); }
      });
      mk.g.addEventListener("focus", function () { focus.hoverOn(cd); });
      mk.g.addEventListener("blur", function () { focus.hoverOff(cd); });

      marks[b.code] = mk;
    });
  }

  function buildAxes() {
    V.clear(gAxes);
    geom.xs.forEach(function (x, i) {
      var y = YEARS[i];
      var g = V.el("g", { cls: "c1-yeartab", style: { cursor: "pointer" } }, gAxes);
      V.el("rect", {
        x: x - 34, y: 8, width: 68, height: 24, rx: 12,
        fill: S.sortYear === y ? YCOLOR[y] : "transparent",
        stroke: S.sortYear === y ? "none" : "var(--line)",
        "stroke-width": 1
      }, g);
      V.el("text", {
        cls: "axis-year", x: x, y: 24, "text-anchor": "middle",
        fill: S.sortYear === y ? "#fff" : "var(--text-soft)", text: fmt.year(y)
      }, g);
      V.el("text", {
        cls: "axis-label", x: x, y: 42, "text-anchor": "middle",
        text: fmt.int(V.totals[y]) + " gesamt"
      }, g);
      g.addEventListener("click", function () {
        S.sortYear = y;
        if (!S.years.has(y)) { S.years.add(y); renderChips(); }
        apply({ animate: true });
        renderList();
      });
      g.addEventListener("pointerenter", function () { g.style.opacity = .82; });
      g.addEventListener("pointerleave", function () { g.style.opacity = 1; });
    });
  }

  /* --------------------------------------------------------------- paint - */
  var lastLab = {};
  function paint() {
    var act = S.years;
    var lastY = lastActive();
    var li = YEARS.indexOf(lastY);

    /* --- rows visibility + targets --- */
    rows.forEach(function (b, idx) {
      var mk = marks[b.code];
      mk.vis = true;
      mk.g.style.display = "";
    });
    var shown = {};
    rows.forEach(function (b) { shown[b.code] = true; });
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      if (!shown[b.code]) { mk.g.style.display = "none"; mk.vis = false; }
    });

    /* --- grid + ticks --- */
    V.clear(gGrid);
    if (S.mode !== "rank") {
      ticks.forEach(function (t) {
        var y = yScale(t);
        if (y < geom.padTop - 6) return;
        V.el("line", { cls: t === 0 ? "zero-line" : "grid-line", x1: geom.padLeft, x2: geom.padLeft + geom.plotW, y1: y, y2: y }, gGrid);
        V.el("text", { cls: "mark-value", x: geom.padLeft - 9, y: y, "text-anchor": "end", "dominant-baseline": "middle", fill: "var(--text-mute)", text: S.mode === "share" ? fmt.dec(t, 0) + " %" : (S.metric === "per1k" ? fmt.per1k(t) : fmt.compact(t)) }, gGrid);
      });
    } else {
      YEARS.forEach(function (y, i) {
        if (!act.has(y)) return;
        V.el("line", { cls: "grid-line", x1: geom.xs[i], x2: geom.xs[i], y1: geom.padTop - 6, y2: geom.h - geom.padBottom + 4, "stroke-dasharray": "1 4", opacity: .75 }, gGrid);
      });
    }

    /* --- marks --- */
    var labels = [];
    rows.forEach(function (b) {
      var mk = marks[b.code];
      var cur = mk.cur;
      if (!cur) return;

      var pts = [];
      for (var i = 0; i < YEARS.length; i++) pts.push([geom.xs[i], cur[i]]);
      var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L");
      mk.path.setAttribute("d", d);
      mk.hit.setAttribute("d", d);

      for (var j = 0; j < YEARS.length; j++) {
        var on = act.has(YEARS[j]);
        mk.dots[j].setAttribute("cx", geom.xs[j]);
        mk.dots[j].setAttribute("cy", cur[j]);
        mk.dots[j].style.opacity = on ? 1 : 0;
        mk.dots[j].setAttribute("r", S.mode === "rank" ? 5 : 4.6);
      }

      /* line visibility: a segment needs both endpoints */
      var seg = "";
      for (var k = 0; k < YEARS.length - 1; k++) {
        seg += act.has(YEARS[k]) && act.has(YEARS[k + 1]) ? "1" : "0";
      }
      mk.path.style.opacity = seg.indexOf("1") >= 0 ? 1 : 0.0;
      mk.hit.style.opacity = seg.indexOf("1") >= 0 ? 1 : 0.001;

      var L = pts[li];
      var lx = L[0], ly = L[1];
      labels.push({ b: b, mk: mk, x: lx, y: ly, code: b.code });
    });

    /* --- de-overlap der Direktlabels (nur Wert-/Anteilsmodus) --- */
    if (S.mode !== "rank") {
      labels.sort(function (a, b) { return a.y - b.y; });
      var minGap = 13;
      for (var i = 1; i < labels.length; i++) {
        if (labels[i].y - labels[i - 1].y < minGap) labels[i].y = labels[i - 1].y + minGap;
      }
      var overflow = labels.length ? labels[labels.length - 1].y - (geom.h - geom.padBottom + 4) : 0;
      if (overflow > 0) labels.forEach(function (l) { l.y -= overflow; });
    }

    var rightX = geom.padLeft + geom.plotW + 10;
    labels.forEach(function (l) {
      var mk = l.mk, b = l.b;
      var isRank = S.mode === "rank";
      var nameY = isRank ? mk.cur[YEARS.indexOf(S.sortYear)] : l.y;
      var nameX = isRank ? geom.padLeft - 12 : l.x + 11;
      var valY = isRank ? nameY : l.y;

      mk.name.setAttribute("x", nameX);
      mk.name.setAttribute("y", nameY);
      mk.name.setAttribute("text-anchor", isRank ? "end" : "start");
      mk.val.setAttribute("x", rightX);
      mk.val.setAttribute("y", valY);
      mk.val.textContent = valueText(b, lastY);

      if (!isRank && Math.abs(mk.cur[li] - l.y) > 3) {
        mk.leader.setAttribute("x1", l.x + 3);
        mk.leader.setAttribute("y1", mk.cur[li]);
        mk.leader.setAttribute("x2", nameX - 3);
        mk.leader.setAttribute("y2", l.y);
        mk.leader.style.opacity = .8;
      } else {
        mk.leader.style.opacity = 0;
      }
    });

    /* pinch the last row: labels must stay inside the viewBox */
    var maxY = geom.h - geom.padBottom + 6;
    rows.forEach(function (b) {
      var mk = marks[b.code];
      if (!mk.cur) return;
      var ny = parseFloat(mk.name.getAttribute("y"));
      if (ny > maxY) {
        mk.name.setAttribute("y", maxY);
        if (S.mode === "rank") mk.val.setAttribute("y", maxY);
      }
    });
  }

  /* ----------------------------------------------------------- tooltip --- */
  function showTip(code, x, y) {
    var b = V.byCode[code];
    var t = V.tip();
    var active = YEARS.filter(function (yy) { return S.years.has(yy); });
    var first = firstActive(), last = lastActive();
    var g = V.growth(b, S.metric, first, last);
    var html = '<div class="tip-title">' + b.name + '</div>' +
      '<div class="tip-meta">Rang ' + V.rankOf(code, S.metric, last) + " von 33 · " +
      (S.metric === "per1k" ? "je 1.000 Einwohner:innen" : "Inserate") + "</div>";
    YEARS.forEach(function (yy) {
      var on = S.years.has(yy);
      var v = S.metric === "per1k" ? V.per1k(b, yy) : V.listings(b, yy);
      html += '<div class="tip-row"' + (on ? "" : ' style="opacity:.4"') + '>' +
        '<span class="k"><i style="background:' + YCOLOR[yy] + '"></i>' + V.meta.snapshots[String(yy)] + "</span>" +
        '<span class="v">' + (S.metric === "per1k" ? fmt.per1k(v) : fmt.int(v)) + "</span></div>";
    });
    if (active.length > 1 && isFinite(g.pct)) {
      html += '<div class="tip-foot">' + V.meta.snapshotLong[String(first)] + " → " +
        V.meta.snapshotLong[String(last)] + ": <strong>" + fmt.signedPct(g.pct) + "</strong> (" +
        fmt.factor(g.factor) + ")</div>";
    } else {
      html += '<div class="tip-foot">Anteil an London ' + fmt.year(last) + ": " +
        fmt.dec(share(b, last), 1) + " %</div>";
    }
    var bar = Math.min(100, (displayValue(b, last) / (geom.yMax || 1)) * 100);
    html += '<div class="tip-bar"><i style="width:' + Math.max(2, bar) + '%"></i></div>';
    t.show(html, x, y);
  }

  /* -------------------------------------------------------------- chips --- */
  var chipHost = V.$("[data-years]");
  var chipEls = {};
  function renderChips() {
    V.clear(chipHost);
    YEARS.forEach(function (y) {
      var on = S.years.has(y);
      var c = V.el("button", {
        cls: "chip", type: "button", "aria-pressed": on ? "true" : "false",
        "aria-label": "Jahr " + y
      }, chipHost);
      V.el("span", { cls: "dot", style: { background: YCOLOR[y] } }, c);
      c.appendChild(document.createTextNode(String(y)));
      c.addEventListener("click", function () {
        if (S.years.has(y)) {
          if (S.years.size === 1) return;   // mindestens ein Jahr bleibt aktiv
          S.years.delete(y);
          if (S.sortYear === y) S.sortYear = lastActive();
        } else {
          S.years.add(y);
        }
        renderChips();
        apply({ animate: true });
        renderList();
      });
      chipEls[y] = c;
    });
  }

  /* --------------------------------------------------------------- list --- */
  var listHost = V.$("[data-list]");
  function renderList() {
    if (!listHost) return;
    var last = lastActive();
    var q = S.q.trim().toLowerCase();
    var vis = rows.filter(function (b) { return !q || b.name.toLowerCase().indexOf(q) >= 0; });
    V.clear(listHost);
    if (!vis.length) {
      V.el("div", { cls: "c1-empty", text: T.noResult }, listHost);
      return;
    }
    var rank = V.rankMap(last, S.metric);
    vis.forEach(function (b) {
      var pinned = focus.store.pinned.has(b.code);
      var row = V.el("button", {
        cls: "c1-item" + (pinned ? " is-pinned" : ""),
        type: "button", role: "listitem",
        "aria-pressed": pinned ? "true" : "false",
        style: { opacity: focus.any() && !focus.has(b.code) ? 0.42 : 1 }
      }, listHost);
      V.el("span", { cls: "swatch", style: { background: YCOLOR[last] } }, row);
      var nm = V.el("span", { cls: "nm" }, row);
      nm.appendChild(document.createTextNode(V.shortName(b.name)));
      var right = V.el("span", {}, row);
      right.style.textAlign = "right";
      V.el("div", { cls: "vv", text: valueText(b, last) }, right);
      V.el("div", { cls: "rk", text: "#" + rank[b.code] }, right);
      row.addEventListener("click", function () { focus.toggle(b.code); renderList(); });
      row.addEventListener("pointerenter", function () { focus.hoverOn(b.code); });
      row.addEventListener("pointerleave", function () { focus.hoverOff(b.code); });
    });
  }

  /* -------------------------------------------------------------- focus --- */
  var focus = V.createFocus(host);
  host.addEventListener("viz:focus", function () {
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      var hot = focus.has(b.code);
      mk.g.classList.toggle("is-hot", hot);
      mk.g.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      mk.name.classList.toggle("is-pinned", focus.store.pinned.has(b.code));
      if (S.mode === "rank") {
        mk.path.setAttribute("stroke-width", hot ? 3.4 : 2.2);
        mk.dots.forEach(function (d) { d.setAttribute("r", (hot ? 6.2 : 5)); });
      } else {
        mk.path.setAttribute("stroke-width", hot ? 3.2 : 2);
        mk.dots.forEach(function (d) { d.setAttribute("r", (hot ? 5.8 : 4.6)); });
      }
    });
    renderList();
  });
  host.addEventListener("click", function (e) {
    if (e.target === svg || e.target === host) focus.clear();
  });

  /* ------------------------------------------------------------ renderer -- */
  var tweenRef = null;
  function apply(opts) {
    opts = opts || {};
    var animate = opts.animate !== false && !V.reduced;
    computeRows();
    computeGeom(rows.length);
    computeTicks();
    buildGradient();
    buildAxes();
    var tgt = targets();

    var fromAll = {}, toAll = {};
    BOROUGHS.forEach(function (b) {
      var mk = marks[b.code];
      if (!mk.cur) mk.cur = tgt[b.code] ? tgt[b.code].slice() : [0, 0, 0];
      fromAll[b.code] = mk.cur.slice();
      toAll[b.code] = (tgt[b.code] || fromAll[b.code]).slice();
    });

    if (tweenRef) { tweenRef.cancel(); tweenRef = null; }
    if (!animate) {
      BOROUGHS.forEach(function (b) { marks[b.code].cur = toAll[b.code].slice(); });
      paint();
      return;
    }
    tweenRef = V.tween({
      dur: opts.dur || 720, ease: V.ease.inOut,
      onUpdate: function (p) {
        BOROUGHS.forEach(function (b) {
          var f = fromAll[b.code], t = toAll[b.code];
          marks[b.code].cur = [f[0] + (t[0] - f[0]) * p, f[1] + (t[1] - f[1]) * p, f[2] + (t[2] - f[2]) * p];
        });
        paint();
      }
    });
  }

  /* ------------------------------------------------------- intro & wiring */
  function intro() {
    var order = rows.map(function (b) { return b.code; });
    order.forEach(function (code, i) {
      var mk = marks[code];
      var len = 800;
      try { len = mk.path.getTotalLength() || 800; } catch (e) { len = 800; }
      mk.path.style.strokeDasharray = len + " " + len;
      mk.path.style.strokeDashoffset = len;
      mk.path.style.animation = "none";
      mk.dots.forEach(function (d) { d.style.opacity = 0; });
      mk.name.style.opacity = 0;
      mk.val.style.opacity = 0;
      var delay = 120 + i * 22;
      setTimeout(function () {
        mk.path.style.transition = "stroke-dashoffset .8s cubic-bezier(.65,.05,.36,1)";
        mk.path.style.strokeDashoffset = 0;
      }, delay);
      setTimeout(function () {
        mk.dots.forEach(function (d) { d.style.transition = "opacity .45s"; d.style.opacity = S.years.has(YEARS[0]) ? 1 : 0; });
        mk.name.style.transition = "opacity .5s"; mk.name.style.opacity = 1;
        mk.val.style.transition = "opacity .5s"; mk.val.style.opacity = 1;
      }, delay + 380);
    });
    setTimeout(function () {
      BOROUGHS.forEach(function (b) {
        marks[b.code].path.style.transition = "";
        marks[b.code].path.style.strokeDasharray = "";
        marks[b.code].path.style.strokeDashoffset = "";
        marks[b.code].dots.forEach(function (d) { d.style.transition = ""; });
        marks[b.code].name.style.transition = "";
        marks[b.code].val.style.transition = "";
      });
      paint();
    }, 120 + rows.length * 22 + 900);
  }

  function wireSeg(sel, key, cast) {
    V.$$(sel + " button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        V.$$(sel + " button").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        S[key] = cast ? cast(btn.getAttribute("data-v")) : btn.getAttribute("data-v");
        if (key === "topN") renderList();
        apply({ animate: true });
      });
    });
  }

  V.$("[data-reset]").addEventListener("click", function () {
    S.metric = "listings"; S.mode = "rank"; S.topN = 0; S.sortYear = 2026; S.q = "";
    S.years = new Set(YEARS);
    V.$("[data-q]").value = "";
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "listings" ? "true" : "false"); });
    V.$$('[data-seg="mode"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "rank" ? "true" : "false"); });
    V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "0" ? "true" : "false"); });
    focus.clear();
    renderChips();
    apply({ animate: true });
    renderList();
  });

  V.$("[data-q]").addEventListener("input", V.debounce(function (e) {
    S.q = e.target.value;
    renderList();
  }, 120));

  wireSeg('[data-seg="metric"]', "metric");
  wireSeg('[data-seg="mode"]', "mode");
  wireSeg('[data-seg="topn"]', "topN", function (v) { return parseInt(v, 10) || 0; });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    readColors();
    BOROUGHS.forEach(function (b) {
      marks[b.code].dots.forEach(function (d, i) { d.setAttribute("stroke", YCOLOR[YEARS[i]]); });
    });
    renderChips();
    apply({ animate: false });
  });

  V.embed.on("year", function (d) {
    if (!d.years) return;
    S.years = new Set(d.years.filter(function (y) { return YEARS.indexOf(y) >= 0; }));
    if (!S.years.size) S.years = new Set(YEARS);
    S.sortYear = lastActive();
    renderChips(); apply({ animate: true }); renderList();
  });
  V.embed.on("metric", function (d) {
    if (d.metric !== "listings" && d.metric !== "per1k") return;
    S.metric = d.metric;
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === d.metric ? "true" : "false"); });
    apply({ animate: true });
  });
  V.embed.on("focus", function (d) { focus.set(d.codes || []); });

  /* ---------------------------------------------------------- deep link -- */
  /* ?metric=per1k&mode=value&topn=10&years=2019,2026&sort=2019&q=camden&focus=E09000007 */
  function readParams() {
    var p = V.embed.param.bind(V.embed);
    var m = p("metric");
    if (m === "per1k" || m === "listings") S.metric = m;
    var mo = p("mode");
    if (mo === "value" || mo === "share" || mo === "rank") S.mode = mo;
    var tn = parseInt(p("topn") || "", 10);
    if (tn === 10 || tn === 20) S.topN = tn;
    var ys = (p("years") || "").split(",").map(function (s) { return parseInt(s, 10); })
      .filter(function (y) { return YEARS.indexOf(y) >= 0; });
    if (ys.length) S.years = new Set(ys);
    var so = parseInt(p("sort") || "", 10);
    if (YEARS.indexOf(so) >= 0 && S.years.has(so)) S.sortYear = so;
    else S.sortYear = lastActive();
    var q = p("q");
    if (q) { S.q = q; V.$("[data-q]").value = q; }
    var f = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
    if (f.length) focus.set(f);
    /* Controls an den Zustand angleichen */
    V.$$('[data-seg="metric"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.metric ? "true" : "false"); });
    V.$$('[data-seg="mode"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.mode ? "true" : "false"); });
    V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === String(S.topN) ? "true" : "false"); });
  }

  readParams();

  buildMarks();
  renderChips();
  apply({ animate: false });
  renderList();
  focus.hoverOff(null);

  /* Erst aufbauen, dann den Einbettungsmodus anwenden: ?embed=1 und ?theme=
     lösen ein viz:theme-Ereignis aus, das einen fertigen Aufbau braucht. */
  V.embed.markReady();
  V.embed.init();
  V.reveal();
  apply({ animate: false });
  intro();

  var rerender = V.debounce(function () { apply({ animate: false }); }, 140);
  if ("ResizeObserver" in window) {
    try { new ResizeObserver(rerender).observe(host); } catch (e) { /* noop */ }
  }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();
