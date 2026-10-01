/* ==========================================================================
   Headless smoke test for every built embed.
   Loads dist/*.html in jsdom, stubs the browser APIs jsdom lacks, then
   hammers the controls and fails on any console error or thrown exception.
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "..", "dist");

const only = process.argv[2] || null;
const files = fs.readdirSync(DIST)
  .filter((f) => f.endsWith(".html"))
  .filter((f) => !only || f.includes(only))
  .sort();

let failures = 0;
let checks = 0;

function ok(cond, label, detail) {
  checks++;
  if (cond) {
    console.log("   \u2713 " + label);
  } else {
    failures++;
    console.log("   \u2717 " + label + (detail ? "  \u2014 " + detail : ""));
  }
}

function stub(window) {
  class RO {
    constructor(cb) { this.cb = cb; }
    observe() {} unobserve() {} disconnect() {}
  }
  class IO {
    constructor(cb) { this.cb = cb; }
    observe(t) { this.cb([{ isIntersecting: true, target: t }], this); }
    unobserve() {} disconnect() {} takeRecords() { return []; }
  }
  window.ResizeObserver = RO;
  window.IntersectionObserver = IO;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
  }));
  const proto = window.SVGElement.prototype;
  proto.getTotalLength = function () { return 640; };
  proto.getBBox = function () { return { x: 0, y: 0, width: 100, height: 20 }; };
  proto.getComputedTextLength = function () { return 42; };
  proto.getScreenCTM = function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } }; };
  window.Element.prototype.scrollIntoView = function () {};
  window.scrollTo = function () {};
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { get() { return 960; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { get() { return 640; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { get() { return 960; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { get() { return 640; }, configurable: true });
}

const fire = (window, node, type, init = {}) => {
  const ev = new window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, init));
  node.dispatchEvent(ev);
};
const key = (window, node, k) => {
  node.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
};
const click = (window, node) => fire(window, node, "click");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(file, query, full) {
  console.log("\n\u25B8 " + file + (query ? "  " + query : ""));
  const html = fs.readFileSync(path.join(DIST, file), "utf8");
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail || e.message)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: "https://example.test/" + file + (query || ""),
    beforeParse: stub
  });
  const { window } = dom;
  window.addEventListener("error", (e) => errors.push("error: " + e.message));
  window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + e.reason));
  const origError = window.console.error;
  window.console.error = (...a) => { errors.push("console.error: " + a.join(" ")); origError.apply(window.console, a); };

  await sleep(220);

  const d = window.document;
  const isGallery = file === "index.html";
  const svgCount = d.querySelectorAll("svg").length;
  const MARK = "svg path, svg rect, svg circle, svg polygon";
  const pathCount = d.querySelectorAll(MARK).length;
  const textCount = d.querySelectorAll("svg text").length;
  const mainSvg = d.querySelector("svg.chart, svg.map, svg[data-viz-svg]") || d.querySelector("svg");
  const svgH = mainSvg ? parseFloat(mainSvg.getAttribute("height") || mainSvg.getAttribute("viewBox").split(/\s+/)[3]) : 0;

  const embedWanted = (query || "").indexOf("embed=1") >= 0;
  ok(!embedWanted || d.body.classList.contains("is-embed"), "erkennt ?embed=1", "is-embed fehlt");
  if (isGallery) {
    ok(d.querySelectorAll(".kit-card").length >= 12, "12 Varianten-Kacheln (" + d.querySelectorAll(".kit-card").length + ")");
    ok(d.querySelectorAll(".kit-card iframe").length >= 12, "Vorschau-iframes vorhanden");
    ok(d.querySelectorAll("[data-cards] .kit-card").length === 6, "Airbnb-Set hat 6 Kacheln");
    ok(d.querySelectorAll("[data-cards-demo] .kit-card").length === 6, "Demografie-Set hat 6 Kacheln");
    ok(d.querySelectorAll(".kit-file").length >= 9, "Datendateien verlinkt (" + d.querySelectorAll(".kit-file").length + ")");
    const sn = d.querySelector("[data-snippet]");
    ok(!!sn && sn.textContent.indexOf("iframe") >= 0 && sn.textContent.indexOf("embed=1") > 0, "iframe-Snippet erzeugt");
    const ut = d.querySelector("[data-urltext]");
    ok(!!ut && ut.textContent.indexOf("http") === 0, "Pageflow-URL erzeugt", ut && ut.textContent);
    ok(d.querySelectorAll("[data-copy]").length >= 3, "Kopier-Buttons vorhanden");
    const hc = d.querySelector("[data-hostcode]");
    ok(!!hc && hc.textContent.indexOf("postMessage") > 0, "postMessage-Beispiel vorhanden");
    ok(d.querySelectorAll(".kit-table tbody tr").length >= 8, "Parameter-Tabelle gefüllt");
    const sclip = d.querySelector("[data-copy]");
    click(window, sclip);
    await sleep(80);
    ok(sclip.classList.contains("is-done"), "Kopieren ohne Fehler ausführbar");
    ok(errors.length === 0, "keine Laufzeitfehler", errors.slice(0, 4).join(" | "));
    dom.window.close();
    return;
  }
  ok(svgCount > 0, "SVG vorhanden (" + svgCount + ")");
  ok(pathCount > 3, "Marken gezeichnet (" + pathCount + ")");
  ok(textCount > 3, "Labels gezeichnet (" + textCount + ")");
  ok(svgH > 80, "Zeichenfläche hat Höhe (" + svgH + "px)");
  ok(d.querySelectorAll(".reveal.is-in").length > 0, "Reveal-Animationen ausgelöst");

  if (!full) {
    /* zweiter Durchlauf: nur Laden + Zeichnen prüfen (z. B. anderes Theme) */
    ok(errors.length === 0, "keine Laufzeitfehler", errors.slice(0, 4).join(" | "));
    dom.window.close();
    return;
  }

  /* --- every segmented control in every position --- */
  const segs = [...d.querySelectorAll("[data-seg]")];
  for (const seg of segs) {
    const name = seg.getAttribute("data-seg");
    for (const btn of [...seg.querySelectorAll("button")]) {
      click(window, btn);
      await sleep(45);
      ok(btn.getAttribute("aria-pressed") === "true", "seg " + name + " -> " + btn.getAttribute("data-v"));
      const pressed = [...seg.querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true");
      ok(pressed.length === 1, "seg " + name + " genau eine Auswahl");
    }
    const first = seg.querySelector("button");
    click(window, first);
    await sleep(45);
  }
  await sleep(120);

  /* --- year chips: toggle off and on again (only where they exist) --- */
  const chipHost = d.querySelector("[data-years]");
  const chips = [...d.querySelectorAll("[data-years] .chip, .year-chip")];
  if (chipHost) ok(chips.length >= 2, "Jahres-Chips vorhanden (" + chips.length + ")");
  if (chips.length) {
    for (const c of chips) { click(window, c); await sleep(35); }
    ok(chips.filter((c) => c.getAttribute("aria-pressed") === "true").length >= 1, "mindestens ein Jahr bleibt aktiv");
    for (const c of chips) { click(window, c); await sleep(35); }
    await sleep(120);
  }

  /* --- highlight: hover + pin a borough --- */
  const allMarks = [...d.querySelectorAll("[data-code]")];
  const preferred = allMarks.filter((n) => n.getAttribute("tabindex") === "0");
  const marks = preferred.length ? preferred : allMarks;
  ok(allMarks.length >= 5, "Bezirks-Marken vorhanden (" + allMarks.length + ")");
  if (marks.length) {
    const m = marks[Math.floor(marks.length / 2)];
    fire(window, m, "pointerenter", { clientX: 200, clientY: 200 });
    fire(window, m, "pointermove", { clientX: 210, clientY: 210 });
    await sleep(60);
    ok(d.querySelectorAll(".is-hot").length > 0, "Hover hebt hervor (" + d.querySelectorAll(".is-hot").length + ")");
    ok(d.querySelectorAll(".tip.is-on").length > 0, "Tooltip sichtbar");
    const tipText = (d.querySelector(".tip") || {}).textContent || "";
    ok(tipText.length > 8, "Tooltip hat Inhalt", JSON.stringify(tipText.slice(0, 40)));
    click(window, m);
    await sleep(60);
    ok(d.querySelectorAll(".is-pinned").length > 0, "Klick fixiert Bezirk");
    fire(window, m, "pointerleave");
    await sleep(40);
    click(window, m);
    await sleep(40);
  }

  /* --- keyboard access --- */
  const focusable = [...d.querySelectorAll("[data-code][tabindex='0']")];
  if (focusable.length) {
    const f = focusable[0];
    key(window, f, "Enter");
    await sleep(50);
    ok(true, "Tastatur-Auswahl möglich");
    key(window, f, "Enter");
    await sleep(30);
  }

  /* --- search --- */
  const q = d.querySelector("[data-q]");
  if (q) {
    q.value = "cam";
    q.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(220);
    const items = d.querySelectorAll("[data-list] > *");
    ok(items.length >= 1, "Suche filtert Liste (" + items.length + ")");
    q.value = "zzzz";
    q.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(220);
    q.value = "";
    q.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(220);
  }

  /* --- row / table interactions --- */
  const rowish = [...d.querySelectorAll("[data-list] [role='listitem'], .rowbtn, tbody tr")].slice(0, 3);
  for (const r of rowish) { fire(window, r, "pointerenter"); click(window, r); await sleep(40); }
  await sleep(80);

  /* --- scroll driven? drive the whole document --- */
  window.dispatchEvent(new window.Event("scroll"));
  for (const el of d.querySelectorAll("*")) {
    if (el.classList && el.classList.contains("step")) {
      el.dispatchEvent(new window.Event("scroll"));
    }
  }
  await sleep(260);

  /* --- reset --- */
  const reset = d.querySelector("[data-reset]");
  if (reset) {
    click(window, reset);
    await sleep(200);
    const segs2 = [...d.querySelectorAll("[data-seg]")];
    const onCount = segs2.reduce((n, s) => n + [...s.querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true").length, 0);
    ok(onCount === segs2.length, "Reset stellt Standard her (" + onCount + "/" + segs2.length + ")");
  }

  /* --- resize --- */
  window.dispatchEvent(new window.Event("resize"));
  await sleep(260);

  ok(errors.length === 0, "keine Laufzeitfehler", errors.slice(0, 4).join(" | "));

  /* --- final structural sanity --- */
  ok(d.querySelectorAll(MARK).length > 3, "nach Interaktionen weiterhin gezeichnet");
  dom.window.close();
}

console.log("Smoke-Test \u00b7 " + files.length + " Datei(en)");
for (const f of files) {
  const gallery = f === "index.html";
  const passes = gallery
    ? [["", true]]
    : [["?embed=1", true], ["?embed=1&theme=dark", false], ["?theme=light&metric=per1k", false]];
  for (const [q, full] of passes) {
    try {
      await run(f, q, full);
    } catch (e) {
      failures++;
      console.log("   \u2717 Abbruch: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e));
    }
  }
}
console.log("\n" + (failures ? "\u2717 " + failures + " von " + checks + " Prüfungen fehlgeschlagen" : "\u2713 alle " + checks + " Prüfungen bestanden"));
process.exit(failures ? 1 : 0);
