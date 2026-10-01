import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
const html = fs.readFileSync("../dist/2-slope-und-balken.html", "utf8");
const vc = new VirtualConsole(); vc.on("jsdomError", e => console.log("ERR", e.message));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
  url: "https://x.test/2.html?theme=light",
  beforeParse(w){
    w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(t){this.cb([{isIntersecting:true,target:t}],this);} unobserve(){} disconnect(){} };
    w.matchMedia = q => ({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    const p = w.SVGElement.prototype;
    p.getTotalLength=()=>640; p.getBBox=()=>({x:0,y:0,width:100,height:20});
    Object.defineProperty(w.HTMLElement.prototype,"clientWidth",{get(){return 960;},configurable:true});
    Object.defineProperty(w.HTMLElement.prototype,"offsetWidth",{get(){return 960;},configurable:true});
  }});
await new Promise(r => setTimeout(r, 900));
const d = dom.window.document;
const svg = d.querySelector("svg.c2-bars");
console.log("viewBox:", svg.getAttribute("viewBox"));
const rows = [...d.querySelectorAll(".c2-bar-row")].slice(0,3);
for (const r of rows) {
  const f = r.querySelector(".c2-bar-fill"), t = r.querySelector(".c2-bar-track"),
        lab = r.querySelector(".c2-bar-label"), v = r.querySelector(".c2-bar-value"),
        dl = r.querySelector(".c2-bar-delta");
  console.log(JSON.stringify({
    code: r.getAttribute("data-code"), tf: r.getAttribute("transform"),
    track: [t.getAttribute("x"), t.getAttribute("width")],
    fill: [f.getAttribute("x"), f.getAttribute("width"), f.getAttribute("fill")],
    label: [lab.getAttribute("x"), lab.textContent],
    val: [v.getAttribute("x"), v.textContent],
    delta: [dl.getAttribute("x"), dl.textContent]
  }));
}
