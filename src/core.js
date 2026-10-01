/* ==========================================================================
   London Airbnb · shared runtime
   Plain ES2018, no dependencies. Exposes window.Viz
   ========================================================================== */
(function () {
  "use strict";

  var RAW = window.LONDON_AIRBNB || window.LONDON_DEMOGRAPHY || { boroughs: [], meta: {}, geo: {} };
  var YEARS = (RAW.meta.years || [2015, 2019, 2026]).slice();

  /* ------------------------------------------------------------ text ----- */
  var T = {
    metric: "Messgröße",
    metricListings: "Inserate",
    metricPer1k: "Je 1.000 Einw.",
    sort: "Sortierung",
    sortRank: "Rang",
    sortValue: "Wert",
    sortName: "A–Z",
    year: "Jahr",
    all: "Alle",
    borough: "Bezirk",
    search: "Bezirk suchen …",
    reset: "Zurücksetzen",
    highlight: "Hervorheben",
    pinned: "fixiert",
    change: "Veränderung",
    share: "Anteil an London",
    total: "London gesamt",
    of: "von",
    rank: "Rang",
    legendScale: "niedrig → hoch",
    noResult: "Kein Bezirk gefunden.",
    tipClick: "Klicken zum Fixieren · erneut klicken zum Lösen",
    source: "Quelle",
    method: "Methode",
    snapshot: "Stichtag",
    incr: "Zunahme",
    decr: "Abnahme",
    hoverHint: "Punkt antippen, um einen Bezirk hervorzuheben"
  };

  /* ------------------------------------------------------- formatting ---- */
  var nfInt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfCompact = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });

  var fmt = {
    int: function (v) { return v == null || isNaN(v) ? "–" : nfInt.format(v); },
    dec: function (v, d) {
      if (v == null || isNaN(v)) return "–";
      if (d === 2) return nf2.format(v);
      return nf1.format(v);
    },
    per1k: function (v) { return v == null || isNaN(v) ? "–" : (v < 10 ? nf2.format(v) : nf1.format(v)); },
    compact: function (v) { return v == null || isNaN(v) ? "–" : nfCompact.format(v); },
    pct: function (v, d) {
      if (v == null || isNaN(v) || !isFinite(v)) return "–";
      return (d === 0 ? nfInt.format(v) : nf1.format(v)) + " %";
    },
    signedInt: function (v) { return v == null || isNaN(v) ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "±") + nfInt.format(Math.abs(v)); },
    signedPct: function (v) {
      if (v == null || isNaN(v) || !isFinite(v)) return "–";
      return (v > 0 ? "+" : v < 0 ? "−" : "±") + nf1.format(Math.abs(v)) + " %";
    },
    factor: function (v) {
      if (v == null || isNaN(v) || !isFinite(v)) return "–";
      return (v >= 10 ? nfInt.format(v) : nf1.format(v)) + "×";
    },
    year: function (y) { return String(y); }
  };

  /* ------------------------------------------------------------ data ----- */
  var boroughs = (RAW.boroughs || []).slice().sort(function (a, b) {
    return a.name.localeCompare(b.name, "en");
  });
  var byCode = {};
  boroughs.forEach(function (b) { byCode[b.code] = b; });

  function listings(b, y) { return b.listings ? b.listings[String(y)] : null; }
  function per1k(b, y) { return b.per1k ? b.per1k[String(y)] : null; }
  function value(b, metric, y) { return metric === "per1k" ? per1k(b, y) : listings(b, y); }
  function metricLabel(metric) { return metric === "per1k" ? T.metricPer1k : T.metricListings; }

  var totals = {};
  YEARS.forEach(function (y) {
    totals[y] = boroughs.reduce(function (s, b) { return s + (listings(b, y) || 0); }, 0);
  });
  function maxOf(fn) {
    var m = 0;
    boroughs.forEach(function (b) {
      YEARS.forEach(function (y) {
        var v = fn(b, y);
        if (v != null && isFinite(v)) m = Math.max(m, v);
      });
    });
    return m;
  }
  var maxListings = maxOf(listings);
  var maxPer1k = maxOf(per1k);

  function ranks(metric, year) {
    var order = boroughs.slice().sort(function (a, b) {
      return (value(b, metric, year) || 0) - (value(a, metric, year) || 0);
    });
    var out = {};
    order.forEach(function (b, i) { out[b.code] = i + 1; });
    return out;
  }
  function rankOf(code, metric, year) { return rankMap(year, metric)[code]; }
  var rankCache = {};
  function rankMap(year, metric) {
    var k = metric + year;
    if (!rankCache[k]) rankCache[k] = ranks(metric, year);
    return rankCache[k];
  }
  function growth(b, metric, from, to) {
    var a = value(b, metric, from), z = value(b, metric, to);
    if (!a || a === 0) return { abs: (z || 0) - (a || 0), pct: Infinity, factor: Infinity };
    return { abs: z - a, pct: ((z - a) / a) * 100, factor: z / a };
  }
  function domain(metric) { return metric === "per1k" ? maxPer1k : maxListings; }

  /* ----------------------------------------------------------- color ----- */
  function hex2rgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," +
      Math.round(A[1] + (B[1] - A[1]) * t) + "," +
      Math.round(A[2] + (B[2] - A[2]) * t) + ")";
  }
  function rampAt(stops, t) {
    t = Math.max(0, Math.min(1, t));
    var n = stops.length - 1;
    var i = Math.min(n - 1, Math.floor(t * n));
    return mix(stops[i], stops[i + 1], t * n - i);
  }

  var RAMPS = {
    light: ["#fff3ee", "#ffd9c8", "#ffb99b", "#fd9068", "#fc642d", "#dd3b34", "#a51e40"],
    dark: ["#20304a", "#1f5a6e", "#118d8c", "#39b58c", "#f0b45e", "#fc642d", "#ff5a5f"],
    teal: ["#eaf7f6", "#b6e3df", "#72ccc3", "#22b0a3", "#00a699", "#0b7d78", "#0a5b59"],
    years: { "2015": "#8fb8d8", "2019": "#00a699", "2026": "#fc642d" },
    seq: ["#eef3f9", "#cfdff0", "#a6c4e2", "#79a4d2", "#4d81bd", "#2f60a0", "#1d4380"]
  };

  /* -------------------------------------------------------- animation ---- */
  var ease = {
    linear: function (t) { return t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    spring: function (t) { return 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); }
  };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Tween mit Sicherheitsnetz: requestAnimationFrame kann in gedrosselten
     Tabs oder in headless-Umgebungen aussetzen. Ein Timer stellt in jedem
     Fall den Endzustand her, und der Endwert wird genau einmal gesetzt. */
  function tween(opts) {
    var dur = reduced ? 1 : (opts.dur == null ? 600 : opts.dur);
    var delay = reduced ? 0 : (opts.delay || 0);
    var fn = opts.ease || ease.out;
    var from = opts.from == null ? 0 : opts.from;
    var to = opts.to == null ? 1 : opts.to;
    var raf = null, guard = null, start = null, finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      if (guard) clearTimeout(guard);
      if (opts.onUpdate) opts.onUpdate(to, 1);
      if (opts.onDone) opts.onDone();
    }
    function step(now) {
      if (finished) return;
      if (start === null) start = now;
      var t = dur <= 1 ? 1 : Math.min(1, (now - start) / dur);
      if (t >= 1) { finish(); return; }
      if (opts.onUpdate) opts.onUpdate(from + (to - from) * fn(t), t);
      raf = requestAnimationFrame(step);
    }
    function kick() {
      guard = setTimeout(finish, dur + 520);
      raf = requestAnimationFrame(step);
    }
    if (delay) setTimeout(kick, delay); else kick();

    return {
      cancel: function () {
        finished = true;
        if (raf) cancelAnimationFrame(raf);
        if (guard) clearTimeout(guard);
      }
    };
  }

  /* ----------------------------------------------------------- focus ----- */
  function createFocus(root, codes) {
    var pinned = new Set();
    var hover = null;
    var store = { codes: new Set(), pinned: pinned, hover: null };

    function emit() {
      store.codes = new Set();
      pinned.forEach(function (c) { store.codes.add(c); });
      if (hover) store.codes.add(hover);
      store.hover = hover;
      if (root) {
        root.classList.toggle("has-focus", store.codes.size > 0);
        root.dispatchEvent(new CustomEvent("viz:focus", {
          detail: { codes: store.codes, hover: hover, pinned: Array.from(pinned) },
          bubbles: true
        }));
      }
    }
    return {
      store: store,
      has: function (c) { return store.codes.has(c); },
      isOnly: function (c) { return store.codes.size === 1 && store.codes.has(c); },
      any: function () { return store.codes.size > 0; },
      hoverOn: function (c) { if (hover !== c) { hover = c; emit(); } },
      hoverOff: function (c) { if (c == null || hover === c) { hover = null; emit(); } },
      toggle: function (c) { if (pinned.has(c)) pinned.delete(c); else pinned.add(c); emit(); },
      pin: function (c) { pinned.add(c); emit(); },
      unpin: function (c) { pinned.delete(c); emit(); },
      clear: function () { pinned.clear(); hover = null; emit(); },
      set: function (list) { pinned = new Set(list || []); store.pinned = pinned; emit(); }
    };
  }

  /* --------------------------------------------------------- tooltip ----- */
  var tipEl = null;
  function tip() {
    if (tipEl) return tipEl;
    var el = document.createElement("div");
    el.className = "tip";
    el.setAttribute("role", "tooltip");
    document.body.appendChild(el);
    var cur = { x: 0, y: 0, on: false };

    function place() {
      var pad = 12;
      var w = el.offsetWidth, h = el.offsetHeight;
      var x = cur.x + 16, y = cur.y - h - 14;
      if (x + w + pad > window.innerWidth) x = cur.x - w - 16;
      if (x < pad) x = pad;
      if (y < pad) y = cur.y + 20;
      if (y + h + pad > window.innerHeight) y = window.innerHeight - h - pad;
      el.style.left = Math.round(x) + "px";
      el.style.top = Math.round(y) + "px";
    }
    tipEl = {
      el: el,
      show: function (html, x, y) {
        el.innerHTML = html;
        cur.x = x; cur.y = y;
        if (!cur.on) { el.classList.add("is-on"); cur.on = true; }
        place();
      },
      move: function (x, y) { cur.x = x; cur.y = y; if (cur.on) place(); },
      hide: function () { if (cur.on) { el.classList.remove("is-on"); cur.on = false; } }
    };
    return tipEl;
  }

  /* ---------------------------------------------------------- reveal ----- */
  var io = null;
  function reveal(scope) {
    var nodes = (scope || document).querySelectorAll(".reveal:not(.is-in)");
    if (!nodes.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add("is-in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    }
    Array.prototype.forEach.call(nodes, function (n) { io.observe(n); });
  }

  /* -------------------------------------------------------------- dom ---- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var svg = /^(svg|g|path|rect|circle|line|text|tspan|defs|clipPath|linearGradient|stop|polyline|polygon|ellipse|use|filter|feDropShadow|mask|title|foreignObject)$/.test(tag);
    var n = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "cls") n.setAttribute("class", v);
      else if (k === "style" && typeof v === "object") { for (var s in v) n.style[s] = v[s]; }
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------------ embed ---- */
  var embed = (function () {
    var params = new URLSearchParams(location.search);
    var state = {
      active: params.get("embed") === "1" || params.get("embed") === "true",
      theme: params.get("theme"),
      metric: params.get("metric"),
      years: params.get("years"),
      focus: params.get("focus"),
      id: params.get("id") || ""
    };
    var handlers = {};

    function say(type, payload) {
      if (window.parent === window) return;
      var msg = { source: "london-airbnb-viz", type: type, id: state.id };
      if (payload) for (var k in payload) msg[k] = payload[k];
      try { window.parent.postMessage(msg, "*"); } catch (e) { /* noop */ }
    }
    function reportHeight() {
      var h = Math.ceil(Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight
      ));
      say("height", { height: h });
    }
    window.addEventListener("message", function (ev) {
      var d = ev.data;
      if (!d || typeof d !== "object") return;
      var t = d.type;
      if (!t) return;
      if (t === "request-height") { reportHeight(); return; }
      if (t === "theme" && (d.theme === "dark" || d.theme === "light")) setTheme(d.theme);
      if (handlers[t]) handlers[t](d);
      document.dispatchEvent(new CustomEvent("viz:command", { detail: d }));
    });
    function on(type, fn) { handlers[type] = fn; }
    function setTheme(t) {
      state.theme = t;
      document.documentElement.setAttribute("data-theme", t);
      document.dispatchEvent(new CustomEvent("viz:theme", { detail: { theme: t } }));
      /* Nach dem Erstaufbau erneut melden: Versionen, die vor dem Aufbau
         lauschen, sollen denselben Zustand trotzdem erhalten. */
      state.themeApplied = true;
    }
    function init() {
      if (state.active) document.body.classList.add("is-embed");
      if (state.theme) setTheme(state.theme);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches && params.get("theme") !== "light") {
        document.documentElement.setAttribute("data-theme", "dark");
        document.documentElement.setAttribute("data-theme-auto", "1");
      }
      if (state.id) document.body.setAttribute("data-viz-id", state.id);
      document.documentElement.setAttribute("data-embed", state.active ? "1" : "0");
    }
    return {
      state: state, init: init, say: say, reportHeight: reportHeight,
      on: on, setTheme: setTheme,
      /** read any query parameter, e.g. ?mode=value&topn=10 */
      param: function (name) { return params.get(name); },
      params: params,
      /** true, sobald die Version ihren Erstaufbau abgeschlossen hat */
      markReady: function () { state.ready = true; },
      isReady: function () { return !!state.ready; },
      /** call once the viz has laid out; keeps iframes snug */
      watch: function () {
        var t = null;
        var lastPF = -1;
        /* Pageflow (and several other hosts) listen for a JSON *string*
           with context "iframe.resize". We speak that protocol as well as
           our own object protocol, so the embed fits everywhere. */
        function tellPageflow() {
          var h = document.documentElement.offsetHeight || document.body.scrollHeight;
          if (h === lastPF) return;
          lastPF = h;
          say("height", { height: h });
          if (window.parent === window) return;
          try {
            window.parent.postMessage(JSON.stringify({
              src: window.location.toString(),
              context: "iframe.resize",
              height: h
            }), "*");
          } catch (e) { /* noop */ }
        }
        function bump() { clearTimeout(t); t = setTimeout(tellPageflow, 60); }
        if ("ResizeObserver" in window) {
          try { new ResizeObserver(bump).observe(document.documentElement); } catch (e) { /* noop */ }
          try { new ResizeObserver(bump).observe(document.body); } catch (e) { /* noop */ }
        }
        window.addEventListener("resize", bump);
        window.addEventListener("load", bump);
        setTimeout(function () { say("ready", { height: document.body.scrollHeight }); bump(); }, 80);
        setTimeout(bump, 300);
        setTimeout(bump, 1400);
        setTimeout(bump, 2600);
        return bump;
      }
    };
  })();

  /* ------------------------------------------------------------ story ---- */
  /* Shared engine for the two scroll-driven stories.
     Normal mode  : the page scrolls, the stage stays sticky.
     Embed mode   : no scrolling at all — the story becomes a compact player
                    with keyboard and button navigation, which is what an
                    iframe inside Pageflow actually wants. */
  function createStory(cfg) {
    var steps = $$(cfg.steps, cfg.root);
    var root = cfg.root;
    var nav = cfg.nav ? $(cfg.nav, root) : null;
    var current = -1;
    var player = document.body.classList.contains("is-embed") ||
      embed.param("player") === "1";
    var autoplay = embed.param("autoplay") === "1" && !reduced;
    var timer = null;
    var listeners = [];

    if (nav) {
      clear(nav);
      var pb = el("div", { cls: "snav-bar" }, nav);
      el("i", null, pb);
      var row = el("div", { cls: "snav-row" }, nav);
      el("button", { cls: "snav-btn", type: "button", "data-prev": "1", "aria-label": "Vorheriger Schritt", html: "&#8249;" }, row);
      var dots = el("div", { cls: "snav-dots" }, row);
      for (var si = 0; si < steps.length; si++) {
        el("button", {
          cls: "snav-dot", type: "button", "data-go": String(si),
          "aria-label": "Schritt " + (si + 1)
        }, dots);
      }
      el("span", { cls: "snav-count", html: "<b>1</b>/" + steps.length }, row);
      el("button", { cls: "snav-btn", type: "button", "data-next": "1", "aria-label": "N\u00e4chster Schritt", html: "&#8250;" }, row);
    }

    function go(i, silent) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (i === current) return;
      var dir = i > current ? 1 : -1;
      var prev = current;
      current = i;
      steps.forEach(function (s, k) {
        s.classList.toggle("is-active", k === i);
        s.classList.toggle("is-past", k < i);
        s.setAttribute("aria-current", k === i ? "step" : "false");
      });
      root.setAttribute("data-step", String(i));
      root.style.setProperty("--progress", ((i + 1) / steps.length * 100) + "%");
      if (nav) {
        $$("[data-go]", nav).forEach(function (b) {
          var t = parseInt(b.getAttribute("data-go"), 10);
          b.classList.toggle("is-on", t === i);
          b.setAttribute("aria-current", t === i ? "true" : "false");
        });
        var cnt = $(".snav-count b", nav);
        if (cnt) cnt.textContent = String(i + 1);
        var pi = $("[data-prev]", nav), ni = $("[data-next]", nav);
        if (pi) pi.disabled = i === 0;
        if (ni) ni.disabled = i === steps.length - 1;
      }
      if (cfg.onStep) cfg.onStep(i, prev, dir);
      for (var k = 0; k < listeners.length; k++) listeners[k](i, prev, dir);
    }

    /* ---- scroll mode ---- */
    var io = null;
    function enableScroll() {
      if (!("IntersectionObserver" in window)) {
        steps.forEach(function (s, i) {
          s.addEventListener("click", function () { go(i); });
        });
        go(0);
        return;
      }
      io = new IntersectionObserver(function (entries) {
        var best = null;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        });
        if (best) {
          var i = steps.indexOf(best.target);
          if (i >= 0) go(i);
        }
      }, { rootMargin: "-42% 0px -42% 0px", threshold: [0, .25, .6, 1] });
      steps.forEach(function (s) { io.observe(s); });
      go(0);
    }

    if (player) {
      root.classList.add("story--player");
      document.documentElement.classList.add("is-player");
    } else {
      enableScroll();
    }

    /* ---- player mode navigation ---- */
    if (nav) {
      var pi = $("[data-prev]", nav), ni = $("[data-next]", nav);
      if (pi) pi.addEventListener("click", function () { stop(); go(current - 1); });
      if (ni) ni.addEventListener("click", function () { stop(); go(current + 1); });
      $$("[data-go]", nav).forEach(function (b) {
        b.addEventListener("click", function () { stop(); go(parseInt(b.getAttribute("data-go"), 10)); });
      });
      go(0);
    }

    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") { stop(); go(current + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { stop(); go(current - 1); }
      else if (e.key === "Home") { stop(); go(0); }
      else if (e.key === "End") { stop(); go(steps.length - 1); }
      else return;
      e.preventDefault();
    }
    function start() {
      document.addEventListener("keydown", onKey);
      root.setAttribute("tabindex", "0");
      if (autoplay) {
        timer = setInterval(function () {
          if (current >= steps.length - 1) { stop(); return; }
          go(current + 1);
        }, 4200);
      }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    start();

    /* swipe for touch devices in player mode */
    var tx = null;
    root.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (tx == null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 44) { stop(); go(current + (dx < 0 ? 1 : -1)); }
      tx = null;
    }, { passive: true });

    return {
      go: go, stop: stop, player: player,
      get index() { return current; },
      count: steps.length,
      on: function (fn) { listeners.push(fn); }
    };
  }

  /* ------------------------------------------------------------ scales --- */
  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (r1 - r0) * ((v - d0) / (d1 - d0 || 1)); };
    f.invert = function (p) { return d0 + (d1 - d0) * ((p - r0) / (r1 - r0 || 1)); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  function sqrtScale(d0, d1, r0, r1) {
    var f = function (v) {
      var t = (Math.sqrt(Math.max(0, v)) - Math.sqrt(d0)) / (Math.sqrt(d1) - Math.sqrt(d0) || 1);
      return r0 + (r1 - r0) * t;
    };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  function niceTicks(max, count) {
    count = count || 5;
    var step = Math.pow(10, Math.floor(Math.log10(max || 1)));
    var err = (max || 1) / step;
    var mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    step *= mult;
    var out = [];
    for (var v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* -------------------------------------------------------------- map ---- */
  /* Die Bezirksgrenzen (ONS, generalised & clipped) liegen bereits als
     SVG-Pfade in Nutzerkoordinaten vor - kein Tile-Server, kein Netz. */
  function mapPaths(group, opts) {
    opts = opts || {};
    var out = {};
    var geo = RAW.geo || { paths: {} };
    Object.keys(geo.paths).forEach(function (code) {
      out[code] = el("path", {
        d: geo.paths[code],
        cls: opts.cls || "bor",
        "data-code": code,
        fill: opts.fill || "var(--bg-sunken)",
        stroke: opts.stroke || "var(--card)",
        "stroke-width": opts.strokeWidth == null ? 1 : opts.strokeWidth,
        "stroke-linejoin": "round"
      }, group);
    });
    return out;
  }
  function geoBox() {
    var geo = RAW.geo || { width: 1000, height: 770 };
    return "0 0 " + geo.width + " " + geo.height;
  }
  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function currentRamp() { return isDark() ? RAMPS.dark : RAMPS.light; }
  function rampScale(metric, min, max, stops) {
    var s = stops || currentRamp();
    return function (v) {
      var t = (v - min) / (max - min || 1);
      return rampAt(s, t);
    };
  }

  /* ------------------------------------------------------------- misc ---- */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 120);
    };
  }
  function shortName(name) {
    return name
      .replace("Barking and Dagenham", "Barking & Dagenham")
      .replace("Hammersmith and Fulham", "Hammersmith & Fulham")
      .replace("Kensington and Chelsea", "Kensington & Chelsea")
      .replace("Kingston upon Thames", "Kingston upon Thames")
      .replace("Richmond upon Thames", "Richmond upon Thames")
      .replace("City of London", "City of London");
  }
  function pattern(length) {
    return "M" + Array.apply(null, Array(length)).map(function (_, i) {
      return (i % 2 ? "l2 0" : "l1.6 0");
    }).join("");
  }

  window.Viz = {
    data: RAW,
    meta: RAW.meta,
    geo: RAW.geo,
    boroughs: boroughs,
    byCode: byCode,
    years: YEARS,
    T: T,
    fmt: fmt,
    value: value,
    listings: listings,
    per1k: per1k,
    metricLabel: metricLabel,
    totals: totals,
    domain: domain,
    rankOf: rankOf,
    rankMap: rankMap,
    growth: growth,
    shortName: shortName,
    RAMPS: RAMPS,
    ramp: rampAt,
    mix: mix,
    ease: ease,
    tween: tween,
    reduced: reduced,
    createFocus: createFocus,
    createStory: createStory,
    tip: tip,
    reveal: reveal,
    el: el,
    clear: clear,
    mapPaths: mapPaths,
    geoBox: geoBox,
    isDark: isDark,
    currentRamp: currentRamp,
    rampScale: rampScale,
    centroid: function (code) { return (byCode[code] || {}).xy || null; },
    $: $,
    $$: $$,
    linear: linear,
    sqrtScale: sqrtScale,
    niceTicks: niceTicks,
    clamp: clamp,
    debounce: debounce,
    embed: embed,
    pattern: pattern
  };
})();
