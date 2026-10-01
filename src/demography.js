/* ==========================================================================
   London · Demografie-Laufzeit
   Erweitert window.Viz um die Zugriffe auf window.LONDON_DEMOGRAPHY.
   Bewusst getrennt von den Airbnb-Daten: keine gemeinsamen Kennzahlen.
   ========================================================================== */
(function () {
  "use strict";

  var V = window.Viz;
  if (!V) return;
  var RAW = window.LONDON_DEMOGRAPHY;
  if (!RAW) return;

  var M = RAW.meta || {};
  var CITY = RAW.city || {};
  var POP_YEARS = M.years || [];
  var EARN_YEARS = M.earnYears || [];

  function b(code) { return V.byCode[code]; }

  /* ------------------------------------------------------------ Zugriffe -- */
  function pop(b, y) { return (b.pop || {})[String(y)]; }
  function density(b, y) { return (b.density || {})[String(y)]; }
  function medianAge(b, y) { return (b.medianAge || {})[String(y)]; }
  function popGrowth(b, y) { return (b.popGrowth || {})[String(y)]; }
  function ageShare(b, group) {
    var g = (b.ageGroups || {})[group];
    return g ? g.share : null;
  }
  function agePop(b, group) {
    var g = (b.ageGroups || {})[group];
    return g ? g.pop : null;
  }
  function ageAt(b, i) { return (b.ages || [])[i] || 0; }
  function cityAgeAt(i) { return (CITY.ages || [])[i] || 0; }
  function sexShare(b, s) {
    var v = (b.sex || {})[s];
    return v ? v.share : null;
  }
  function education(b, cat) {
    var v = (b.education || {})[cat];
    return v ? v.share : null;
  }
  function educationPop(b, cat) {
    var v = (b.education || {})[cat];
    return v ? v.people : null;
  }
  function origin(b, g) {
    var v = (b.origin || {})[g];
    return v ? v.share : null;
  }
  function originPop(b, g) {
    var v = (b.origin || {})[g];
    return v ? v.people : null;
  }
  function nonUk(b) {
    var v = (b.originIndicators || {})["Non-UK-born"];
    return v ? v.share : null;
  }
  function ukBorn(b) {
    var v = (b.originIndicators || {})["UK-born"];
    return v ? v.share : null;
  }
  function earnings(b, y) {
    var v = (b.earnings || {})[String(y)];
    return v && v.value != null ? v.value : null;
  }
  function earningsStatus(b, y) {
    var v = (b.earnings || {})[String(y)];
    return v ? v.status : null;
  }

  /* ------------------------------------------------------------ Indikatoren */
  /* Jeder Indikator kennt seine eigenen Jahre und seine Farbrichtung. */
  var IND = [
    { id: "pop", label: "Bev\u00f6lkerung", short: "Bev\u00f6lkerung",
      unit: "Personen", years: POP_YEARS, kind: "seq",
      get: pop, f: V.fmt.int, fa: V.fmt.compact, decimals: 0 },
    { id: "growth", label: "Bev\u00f6lkerungswachstum", short: "Wachstum",
      unit: "% gegen\u00fcber dem Vorjahr", years: POP_YEARS, kind: "div",
      get: popGrowth, f: function (v) { return V.fmt.signedPct(v); },
      fa: function (v) { return V.fmt.dec(v, 1) + " %"; }, decimals: 1 },
    { id: "density", label: "Bev\u00f6lkerungsdichte", short: "Dichte",
      unit: "Personen je km\u00b2", years: POP_YEARS, kind: "seq",
      get: density, f: V.fmt.int, fa: V.fmt.compact, decimals: 0 },
    { id: "medianAge", label: "Medianalter", short: "Medianalter",
      unit: "Jahre", years: POP_YEARS, kind: "seq",
      get: medianAge, f: function (v) { return V.fmt.dec(v, 1) + " Jahre"; },
      fa: function (v) { return V.fmt.dec(v, 0); }, decimals: 1 },
    { id: "age0", label: "Anteil 0\u201315 Jahre", short: "0\u201315 Jahre",
      unit: "% der Bev\u00f6lkerung 2025", years: [2025], kind: "seq",
      get: function (x) { return ageShare(x, "Age 0\u201315"); },
      f: function (v) { return V.fmt.dec(v, 1) + " %"; },
      fa: function (v) { return V.fmt.dec(v, 0) + " %"; }, decimals: 1 },
    { id: "age65", label: "Anteil 65+", short: "65+",
      unit: "% der Bev\u00f6lkerung 2025", years: [2025], kind: "seq",
      get: function (x) { return ageShare(x, "Age 65+"); },
      f: function (v) { return V.fmt.dec(v, 1) + " %"; },
      fa: function (v) { return V.fmt.dec(v, 0) + " %"; }, decimals: 1 },
    { id: "noQual", label: "Ohne Berufsabschluss", short: "Ohne Abschluss",
      unit: "% der Bev\u00f6lkerung ab 16 (2021)", years: [2021], kind: "seq",
      get: function (x) { return education(x, "No qualifications"); },
      f: function (v) { return V.fmt.dec(v, 1) + " %"; },
      fa: function (v) { return V.fmt.dec(v, 0) + " %"; }, decimals: 1 },
    { id: "level4", label: "Hochschulabschluss", short: "Level 4+",
      unit: "% der Bev\u00f6lkerung ab 16 (2021)", years: [2021], kind: "seq",
      get: function (x) { return education(x, "Level 4+"); },
      f: function (v) { return V.fmt.dec(v, 1) + " %"; },
      fa: function (v) { return V.fmt.dec(v, 0) + " %"; }, decimals: 1 },
    { id: "nonUk", label: "Nicht in UK geboren", short: "Nicht in UK geboren",
      unit: "% der Bev\u00f6lkerung (2021)", years: [2021], kind: "seq",
      get: nonUk, f: function (v) { return V.fmt.dec(v, 1) + " %"; },
      fa: function (v) { return V.fmt.dec(v, 0) + " %"; }, decimals: 1 },
    { id: "earnings", label: "Medianlohn", short: "Medianlohn",
      unit: "\u00a3 pro Woche (ASHE)", years: EARN_YEARS, kind: "seq",
      get: earnings, f: function (v) { return V.fmt.int(v) + " \u00a3"; },
      fa: function (v) { return V.fmt.int(v) + " \u00a3"; }, decimals: 0 },
  ];

  function indicator(id) {
    for (var i = 0; i < IND.length; i++) if (IND[i].id === id) return IND[i];
    return IND[0];
  }

  function range(ind, year) {
    var lo = Infinity, hi = -Infinity;
    V.boroughs.forEach(function (x) {
      var v = ind.get(x, year);
      if (v == null || !isFinite(v)) return;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    });
    if (!isFinite(lo)) return { lo: 0, hi: 1, max: 1, min: 0 };
    return { lo: lo, hi: hi, min: Math.min(0, lo), max: Math.max(hi, Math.abs(lo)) };
  }

  function rankOf(code, ind, year, dir) {
    var list = V.boroughs.slice().sort(function (a, b2) {
      var va = ind.get(a, year), vb = ind.get(b2, year);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (vb - va) * (dir === "asc" ? -1 : 1);
    });
    for (var i = 0; i < list.length; i++) if (list[i].code === code) return i + 1;
    return null;
  }

  /* Gewichtete Londoner Werte für Vergleiche -------------------------------- */
  function cityPop(y) { return (CITY.pop || {})[String(y)] || 0; }
  function cityDensity(y) {
    var pop = cityPop(y);
    var area = 0;
    V.boroughs.forEach(function (x) {
      var popB = pop_(x, y);
      var d = density(x, y);
      if (popB && d) area += popB / d;
    });
    return area ? Math.round(pop / area) : null;
  }
  function pop_(x, y) { return (x.pop || {})[String(y)]; }
  function cityMedianAge(y) { return (CITY.medianAge || {})[String(y)] || null; }
  function cityAgeShare(group) { return (CITY.ageGroupShare || {})[group] || null; }
  function cityEarnings(y) {
    var vals = V.boroughs.map(function (x) { return earnings(x, y); }).filter(function (v) { return v != null; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length);
  }

  /* ------------------------------------------------------- Erziehungshelfer */
  function isDark() { return V.isDark(); }
  function divergingScale(lo, hi) {
    /* Rot = Rückgang, Blau/Teal = Zunahme, Mitte neutral. */
    var neg = isDark() ? ["#0e1a2b", "#17415c", "#1f7a86", "#2fb39a"]
                       : ["#1d5c8a", "#4d94b8", "#a8d5cf", "#e9f5f2"];
    var pos = isDark() ? ["#3a2a1e", "#7a4626", "#c9752f", "#ffb066"]
                       : ["#fbeee6", "#f7c9a4", "#ef8f4e", "#c03a2b"];
    return function (v) {
      if (v == null || !isFinite(v)) return isDark() ? "#1b2331" : "#eef0f4";
      var m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
      var t = Math.min(1, Math.abs(v) / m);
      var stops = v < 0 ? neg : pos;
      var r = V.ramp(stops, t);
      return r;
    };
  }

  V.demo = {
    raw: RAW, meta: M, city: CITY,
    popYears: POP_YEARS, earnYears: EARN_YEARS,
    ind: IND, indicator: indicator, range: range, rankOf: rankOf,
    pop: pop, density: density, medianAge: medianAge, popGrowth: popGrowth,
    ageShare: ageShare, agePop: agePop, ageAt: ageAt, cityAgeAt: cityAgeAt,
    sexShare: sexShare, education: education, educationPop: educationPop,
    origin: origin, originPop: originPop, nonUk: nonUk, ukBorn: ukBorn,
    earnings: earnings, earningsStatus: earningsStatus,
    cityPop: cityPop, cityDensity: cityDensity, cityMedianAge: cityMedianAge,
    cityAgeShare: cityAgeShare, cityEarnings: cityEarnings,
    divergingScale: divergingScale,
    ageGroups: M.ageGroups || [], ageLabels: M.ageLabels || {},
    educationOrder: M.educationOrder || [],
    originOrder: M.originOrder || []
  };
})();
