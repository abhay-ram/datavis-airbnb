/* ==========================================================================
   Demo 3 · Bildung, Herkunft, Medianlohn
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  var D = V.demo;
  var fmt = V.fmt;
  var BOROUGHS = V.boroughs;

  var host = V.$("[data-chart]");
  if (!host) return;
  host.classList.add("d3-chart");

  var EDU_SHORT = {
    "No qualifications": "Ohne Abschluss",
    "Level 1 / entry level": "Level 1",
    "Level 2": "Level 2",
    "Apprenticeship": "Ausbildung",
    "Level 3": "Level 3",
    "Level 4+": "Level 4+",
    "Other qualifications": "Sonstige"
  };
  var ORIGIN_SHORT = {
    "UK-born": "UK",
    "EU-born": "EU",
    "Rest of Europe-born": "\u00dcbriges Europa",
    "Africa-born": "Afrika",
    "Middle East & Asia-born": "Nahost & Asien",
    "Americas & Caribbean-born": "Amerika & Karibik",
    "Oceania-born": "Ozeanien",
    "Other": "Sonstige"
  };

  var FAMILIES = {
    education: {
      label: "H\u00f6chster Bildungsabschluss",
      title: "Bildung 2021",
      order: D.educationOrder,
      name: function (c) { return EDU_SHORT[c] || c; },
      share: D.education,
      people: D.educationPop,
      unit: "der Bev\u00f6lkerung ab 16",
      defaultSort: "Level 4+",
      read: "Bildung ist der deutlichste soziale Gradient der Stadt: Zwischen dem h\u00f6chsten " +
            "und dem niedrigsten Anteil an Hochschulabschl\u00fcssen liegen mehr als 40 Prozentpunkte."
    },
    origin: {
      label: "Geburtsland",
      title: "Herkunft 2021",
      order: D.originOrder,
      name: function (c) { return ORIGIN_SHORT[c] || c; },
      share: D.origin,
      people: D.originPop,
      unit: "der Bev\u00f6lkerung",
      defaultSort: "EU-born",
      read: "Die Herkunft folgt der Migrationsgeschichte: innenstadtnah leben deutlich mehr " +
            "im Ausland geborene Menschen als am Stadtrand."
    },
    earnings: {
      label: "Median-Bruttowochenverdienst",
      title: "Medianlohn",
      read: "Der Medianlohn ist der Verdienst der mittleren Vollzeitstelle \u2013 kein " +
            "Haushaltseinkommen. Die Schere zwischen den Bezirken bleibt \u00fcber zwei " +
            "Jahrzehnte erstaunlich stabil."
    }
  };

  var S = { family: "earnings", sort: null, year: 2024, topN: 0, sel: null, hover: null, pinned: {} };

  function family() { return FAMILIES[S.family]; }

  function palette(keys) {
    var dark = V.isDark();
    var base = ["#4a90c4", "#3fae9e", "#8bbf6a", "#e0b356", "#e08a4e", "#cc5a5a", "#9b6ba8", "#8792a6"];
    return keys.map(function (_, i) { return dark ? base[i % base.length] : base[i % base.length]; });
  }

  function currentKeys() {
    if (S.family === "origin") return D.originOrder.slice();
    return FAMILIES.education.order.slice();
  }
  function shareOf(b, key) {
    return S.family === "origin" ? D.origin(b, key) : D.education(b, key);
  }
  function peopleOf(b, key) {
    return S.family === "origin" ? D.originPop(b, key) : D.educationPop(b, key);
  }

  /* ------------------------------------------------------------- Zeichnen - */
  var svg = V.el("svg", { cls: "chart d3-chart", role: "img", "aria-label": "Strukturmerkmale der Londoner Bezirke" }, host);
  var gRows = V.el("g", null, svg);
  var gAxis = V.el("g", null, svg);

  var ROW = 22, BAR = 13, PADT = 8, PADB = 30;
  var W = 800, H = 800, labelW = 150, plotW = 500, valW = 66, sparkW = 76;
  var rows = {}, order = [];

  function measure() {
    W = Math.max(320, host.clientWidth || 800);
    var narrow = W < 640;
    labelW = narrow ? 96 : 148;
    valW = narrow ? 50 : 66;
    sparkW = S.family === "earnings" ? (narrow ? 0 : 76) : 0;
    plotW = Math.max(80, W - labelW - valW - sparkW - 14);
    H = PADT + BOROUGHS.length * ROW + PADB;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.height = H + "px";
  }

  function build() {
    BOROUGHS.forEach(function (b) {
      var g = V.el("g", { cls: "d3-row mark", "data-code": b.code, tabindex: "0", role: "button", "aria-label": b.name }, gRows);
      var mk = { g: g, code: b.code, segs: [], b: b };
      mk.name = V.el("text", { cls: "d3-name", x: labelW - 10, y: 0, "text-anchor": "end", "dominant-baseline": "middle" }, g);
      mk.name.textContent = b.short;
      mk.bar = V.el("g", null, g);
      mk.spark = V.el("path", { cls: "d3-spark", stroke: "var(--text-mute)" }, g);
      mk.sparkdot = V.el("circle", { cls: "d3-sparkdot", r: 2.6, fill: "var(--accent)", opacity: 0 }, g);
      mk.val = V.el("text", { cls: "d3-val", x: W - 6, y: 0, "text-anchor": "end", "dominant-baseline": "middle" }, g);
      rows[b.code] = mk;

      var cd = b.code;
      g.addEventListener("pointerenter", function (e) { S.hover = cd; focus.hoverOn(cd); showTip(cd, e.clientX || 0, e.clientY || 0); });
      g.addEventListener("pointermove", function (e) { showTip(cd, e.clientX || 0, e.clientY || 0); });
      g.addEventListener("pointerleave", function () { S.hover = null; focus.hoverOff(cd); V.tip().hide(); });
      g.addEventListener("click", function (e) {
        e.stopPropagation();
        S.pinned[cd] = !S.pinned[cd];
        S.sel = cd;
        focus.set(Object.keys(S.pinned).filter(function (k) { return S.pinned[k]; }));
        renderDetail();
      });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.sel = cd; renderDetail(); }
      });
      g.addEventListener("focus", function () { focus.hoverOn(cd); S.sel = cd; renderDetail(); });
      g.addEventListener("blur", function () { focus.hoverOff(cd); });
    });
  }

  function sortKeys() {
    if (S.family === "earnings") return null;
    var keys = currentKeys();
    return keys;
  }

  function computeOrder() {
    var list = BOROUGHS.slice();
    if (S.family === "earnings") {
      list.sort(function (a, b) {
        var va = D.earnings(a, S.year), vb = D.earnings(b, S.year);
        if (va == null) return 1;
        if (vb == null) return -1;
        return vb - va;
      });
    } else {
      var key = S.sort;
      list.sort(function (a, b) {
        var va = shareOf(a, key), vb = shareOf(b, key);
        if (va == null) return 1;
        if (vb == null) return -1;
        return vb - va;
      });
    }
    if (S.topN) list = list.slice(0, S.topN);
    return list;
  }

  function render() {
    measure();
    var keys = sortKeys();
    var colors = keys ? palette(keys) : [];
    order = computeOrder();
    var earnMax = 0;
    if (S.family === "earnings") {
      BOROUGHS.forEach(function (x) {
        D.earnYears.forEach(function (yy) { earnMax = Math.max(earnMax, D.earnings(x, yy) || 0); });
      });
    }
    var shown = {};
    order.forEach(function (b) { shown[b.code] = true; });
    BOROUGHS.forEach(function (b) {
      rows[b.code].g.style.display = shown[b.code] ? "" : "none";
      rows[b.code].g.setAttribute("transform", "");
    });

    /* Balken neu aufbauen: Segmentzahl h\u00e4ngt vom Merkmal ab */
    order.forEach(function (b, i) {
      var mk = rows[b.code];
      var y = PADT + i * ROW + (ROW - BAR) / 2;
      mk.g.setAttribute("transform", "translate(0," + y + ")");
      mk.name.setAttribute("x", labelW - 10);
      mk.name.setAttribute("y", BAR / 2);
      mk.val.setAttribute("x", W - 4);
      mk.val.setAttribute("y", BAR / 2);
      V.clear(mk.bar);

      if (S.family === "earnings") {
        var v = D.earnings(b, S.year);
        var w = v == null ? 0 : Math.max(1, (v / earnMax) * plotW);
        mk.bar.appendChild(V.el("rect", {
          cls: "d3-bar grow-x", x: labelW, y: 0, width: w, height: BAR, rx: 2.5,
          fill: "var(--accent)", "fill-opacity": .9,
          style: { animationDelay: Math.min(400, i * 14) + "ms" }
        }));
        mk.val.textContent = v == null ? "\u2013" : fmt.int(v) + " \u00a3";
        /* Sparkline 2002\u20132024 */
        if (sparkW > 0) {
          var sx = labelW + plotW + 12, sw = sparkW - 22, sh = BAR;
          var vals = D.earnYears.map(function (yy) { return D.earnings(b, yy); });
          var lo = Infinity, hi = -Infinity;
          vals.forEach(function (q) { if (q != null) { lo = Math.min(lo, q); hi = Math.max(hi, q); } });
          if (isFinite(lo) && isFinite(hi) && hi > lo) {
            var pts = [];
            vals.forEach(function (q, k) {
              if (q == null) return;
              pts.push([sx + (k / (vals.length - 1)) * sw, sh - ((q - lo) / (hi - lo)) * sh]);
            });
            if (pts.length > 1) {
              mk.spark.setAttribute("d", "M" + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L"));
              mk.spark.style.display = "";
              var idx = D.earnYears.indexOf(S.year);
              var q2 = vals[idx];
              if (q2 != null) {
                mk.sparkdot.setAttribute("cx", (sx + (idx / (vals.length - 1)) * sw).toFixed(1));
                mk.sparkdot.setAttribute("cy", (sh - ((q2 - lo) / (hi - lo)) * sh).toFixed(1));
                mk.sparkdot.setAttribute("opacity", 1);
              } else mk.sparkdot.setAttribute("opacity", 0);
            } else { mk.spark.style.display = "none"; mk.sparkdot.setAttribute("opacity", 0); }
          } else { mk.spark.style.display = "none"; mk.sparkdot.setAttribute("opacity", 0); }
        } else {
          mk.spark.style.display = "none";
          mk.sparkdot.setAttribute("opacity", 0);
        }
      } else {
        var x = labelW;
        var key = S.sort;
        keys.forEach(function (k, ki) {
          var sh = shareOf(b, k) || 0;
          var w2 = (sh / 100) * plotW;
          if (w2 <= 0) return;
          var seg = V.el("rect", {
            cls: "d3-seg grow-x", x: x, y: 0, width: Math.max(0.5, w2), height: BAR,
            fill: colors[ki], "fill-opacity": k === key ? 1 : .82,
            style: { animationDelay: Math.min(400, i * 14 + ki * 8) + "ms" }
          }, mk.bar);
          var cd = b.code, kk = k;
          seg.addEventListener("pointerenter", function (e) {
            focus.hoverOn(cd);
            showSegTip(cd, kk, e.clientX || 0, e.clientY || 0);
          });
          seg.addEventListener("pointermove", function (e) { showSegTip(cd, kk, e.clientX || 0, e.clientY || 0); });
          seg.addEventListener("pointerleave", function () { V.tip().hide(); });
          x += w2;
        });
        var sv = shareOf(b, key);
        mk.val.textContent = sv == null ? "\u2013" : fmt.dec(sv, 1) + " %";
        mk.spark.style.display = "none";
        mk.sparkdot.setAttribute("opacity", 0);
      }
    });

    drawAxis(keys, colors);
    renderLegend(keys, colors);
    renderDetail();
    var t = V.$("[data-title]");
    if (t) t.textContent = family().title + (S.family === "earnings" ? " " + S.year : "");
    var note = V.$("[data-note]");
    if (note) {
      note.textContent = S.family === "earnings"
        ? "Median-Bruttowochenverdienst der Vollzeitbesch\u00e4ftigten, " + S.year +
          ". Die kleine Linie rechts zeigt den Verlauf seit 2002 auf eigener Skala."
        : "Anteile an der Bev\u00f6lkerung " + family().unit + ", Census 2021. " +
          "Sortiert nach \u201e" + family().name(S.sort) + "\u201c.";
    }
    var read = V.$("[data-read]");
    if (read) read.textContent = family().read;
    var earnGroup = V.$("[data-earnings-only]");
    if (earnGroup) earnGroup.hidden = S.family !== "earnings";
  }

  function drawAxis(keys, colors) {
    V.clear(gAxis);
    var y = H - PADB + 15;
    if (S.family === "earnings") {
      V.el("text", { cls: "axis-label", x: labelW, y: y, text: "\u00a3 pro Woche (Median, Vollzeit)" }, gAxis);
    } else {
      [0, 25, 50, 75, 100].forEach(function (t) {
        var x = labelW + (t / 100) * plotW;
        V.el("line", { cls: "grid-line", x1: x, x2: x, y1: PADT, y2: y - 9 }, gAxis);
        V.el("text", { cls: "axis-label", x: x, y: y, "text-anchor": "middle", text: t + " %" }, gAxis);
      });
    }
    void keys; void colors;
  }

  var legendHost = V.$("[data-legend]");
  function renderLegend(keys, colors) {
    if (!legendHost) return;
    V.clear(legendHost);
    if (S.family === "earnings") {
      var s = V.el("span", { cls: "d3-chip", "aria-pressed": "true" }, legendHost);
      V.el("i", { style: { background: "var(--accent)" } }, s);
      s.appendChild(document.createTextNode("Medianlohn " + S.year));
      return;
    }
    keys.forEach(function (k, i) {
      var on = S.sort === k;
      var chip = V.el("button", {
        cls: "d3-chip", type: "button", "aria-pressed": on ? "true" : "false",
        "data-sort": k
      }, legendHost);
      V.el("i", { style: { background: colors[i] } }, chip);
      chip.appendChild(document.createTextNode(family().name(k)));
      chip.addEventListener("click", function () {
        S.sort = k;
        render();
      });
    });
  }

  function segTipHtml(code, key) {
    var b = V.byCode[code];
    var sh = shareOf(b, key), p = peopleOf(b, key);
    return '<div class="tip-title">' + escape(b.name) + "</div>" +
      '<div class="tip-meta">' + family().label + " \u00b7 " + family().name(key) + "</div>" +
      '<div class="tip-row"><span class="k">Anteil</span><span class="v">' +
      (sh == null ? "\u2013" : fmt.dec(sh, 1) + " %") + "</span></div>" +
      '<div class="tip-row"><span class="k">Personen</span><span class="v">' +
      (p == null ? "\u2013" : fmt.int(p)) + "</span></div>";
  }
  function showSegTip(code, key, x, y) {
    V.tip().show(segTipHtml(code, key), x, y);
  }
  function escape(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function showTip(code, x, y) {
    var b = V.byCode[code];
    var html;
    if (S.family === "earnings") {
      var v = D.earnings(b, S.year);
      var first = null, last = null;
      D.earnYears.forEach(function (yy) {
        var q = D.earnings(b, yy);
        if (q != null) { if (first == null) first = q; last = q; }
      });
      html = '<div class="tip-title">' + escape(b.name) + "</div>" +
        '<div class="tip-meta">Medianlohn ' + S.year + "</div>" +
        '<div class="tip-row"><span class="k">' + S.year + '</span><span class="v">' +
        (v == null ? "nicht ver\u00f6ffentlicht" : fmt.int(v) + " \u00a3") + "</span></div>";
      if (first && last) {
        html += '<div class="tip-foot">2002 \u2192 2024: <strong>' +
          fmt.signedPct(((last - first) / first) * 100) + "</strong></div>";
      }
    } else {
      var key = S.sort;
      html = segTipHtml(code, key);
      var rank = 1;
      order.forEach(function (o, i) { if (o.code === code) rank = i + 1; });
      html += '<div class="tip-foot">Rang ' + rank + " von " + order.length + "</div>";
    }
    V.tip().show(html, x, y);
  }

  /* --------------------------------------------------------------- Detail - */
  function renderDetail() {
    var card = V.$("[data-detail]");
    var wrap = V.$("[data-detailcard]");
    if (!card || !wrap) return;
    var pinned = Object.keys(S.pinned).filter(function (k) { return S.pinned[k]; });
    var code = pinned.length ? pinned[pinned.length - 1] : (S.sel || null);
    if (!code) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var b = V.byCode[code];
    V.clear(card);
    var head = V.el("div", { cls: "d3-detail-head" }, card);
    V.el("div", { cls: "d3-detail-name", text: b.short }, head);
    V.el("div", { cls: "d3-detail-meta", text: pinned.length ? "fixiert" : "zuletzt" }, head);

    var kv = V.el("div", { cls: "d3-kv" }, card);
    if (S.family === "earnings") {
      [S.year, 2024, 2010, 2002].filter(function (v, i, a) { return a.indexOf(v) === i; })
        .forEach(function (yy) {
          var r = V.el("div", null, kv);
          V.el("span", { cls: "k", text: "Medianlohn " + yy }, r);
          var val = D.earnings(b, yy);
          V.el("span", { cls: "v", text: val == null ? "n. v." : fmt.int(val) + " \u00a3" }, r);
        });
    } else {
      var keys = currentKeys();
      var colors = palette(keys);
      keys.forEach(function (k, i) {
        var r = V.el("div", null, kv);
        var kk = V.el("span", { cls: "k" }, r);
        V.el("i", { style: { background: colors[i] } }, kk);
        kk.appendChild(document.createTextNode(family().name(k)));
        var sh = shareOf(b, k);
        V.el("span", { cls: "v", text: sh == null ? "\u2013" : fmt.dec(sh, 1) + " %" }, r);
      });
    }
  }

  /* ---------------------------------------------------------------- Fokus - */
  var focus = V.createFocus(host);
  host.addEventListener("viz:focus", function () {
    BOROUGHS.forEach(function (b) {
      var mk = rows[b.code];
      var hot = focus.has(b.code);
      mk.g.classList.toggle("is-hot", hot);
      mk.g.classList.toggle("is-pinned", !!S.pinned[b.code]);
    });
  });
  host.addEventListener("click", function (e) {
    if (e.target === svg) {
      S.pinned = {};
      focus.clear();
      renderDetail();
    }
  });

  /* ------------------------------------------------------------ Bedienung - */
  V.$$('[data-seg="family"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="family"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.family = btn.getAttribute("data-v");
      S.sort = S.family === "education" ? FAMILIES.education.defaultSort : FAMILIES.origin.defaultSort;
      render();
    });
  });
  V.$$('[data-seg="topn"] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      V.$$('[data-seg="topn"] button').forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      S.topN = parseInt(btn.getAttribute("data-v"), 10) || 0;
      render();
    });
  });
  var yearEl = V.$("[data-year]");
  yearEl.addEventListener("input", V.debounce(function () {
    S.year = parseInt(yearEl.value, 10);
    V.$("[data-yearlabel]").textContent = String(S.year);
    render();
  }, 60));

  V.$("[data-reset]").addEventListener("click", function () {
    S.family = "earnings"; S.year = 2024; S.topN = 0; S.pinned = {}; S.sel = null;
    S.sort = FAMILIES.education.defaultSort;
    yearEl.value = 2024;
    V.$("[data-yearlabel]").textContent = "2024";
    V.$$('[data-seg="family"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "earnings" ? "true" : "false"); });
    V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === "0" ? "true" : "false"); });
    focus.clear();
    render();
  });

  document.addEventListener("viz:theme", function () {
    if (!V.embed.isReady()) return;
    render();
  });
  V.embed.on("focus", function (d) {
    if (!d.codes || !d.codes.length) return;
    S.pinned = {};
    d.codes.forEach(function (c) { S.pinned[c] = true; });
    S.sel = d.codes[d.codes.length - 1];
    focus.set(d.codes);
    renderDetail();
  });

  /* ---------------------------------------------------------------- Start - */
  V.reveal();
  var p = V.embed.param.bind(V.embed);
  if (p("family") && FAMILIES[p("family")]) S.family = p("family");
  S.sort = S.family === "origin" ? FAMILIES.origin.defaultSort : FAMILIES.education.defaultSort;
  var py = parseInt(p("year") || "", 10);
  if (D.earnYears.indexOf(py) >= 0) S.year = py;
  var tn = parseInt(p("topn") || "", 10);
  if (tn === 15) S.topN = 15;
  yearEl.value = S.year;
  V.$("[data-yearlabel]").textContent = String(S.year);
  V.$$('[data-seg="family"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === S.family ? "true" : "false"); });
  V.$$('[data-seg="topn"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === String(S.topN) ? "true" : "false"); });
  var fsel = (p("focus") || "").split(",").filter(function (c) { return V.byCode[c]; });
  if (fsel.length) {
    fsel.forEach(function (c) { S.pinned[c] = true; });
    S.sel = fsel[fsel.length - 1];
    focus.set(fsel);
  }

  build();
  render();

  V.embed.markReady();
  V.embed.init();
  render();

  var rerender = V.debounce(function () { render(); }, 150);
  if ("ResizeObserver" in window) { try { new ResizeObserver(rerender).observe(host); } catch (e) {} }
  window.addEventListener("resize", rerender);
  V.embed.watch();
})();

