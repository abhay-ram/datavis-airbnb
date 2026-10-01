import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
const html = fs.readFileSync("../dist/2-slope-und-balken.html", "utf8");
const vc = new VirtualConsole();
vc.on("jsdomError", e => console.log("JSDOM-ERR:", (e.detail && e.detail.stack) ? e.detail.stack.split("\n").slice(0,6).join("\n") : e.message));
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
console.log("--- all texts inside svg.c2-bars (first 12) ---");
[...svg.querySelectorAll("text")].slice(0,12).forEach(t => console.log(JSON.stringify([t.getAttribute("class"), t.getAttribute("x"), t.getAttribute("y"), t.textContent])));
console.log("--- tracks/fills for 3 rows ---");
[...d.querySelectorAll(".c2-bar-row")].slice(0,2).forEach(r => {
  console.log(r.getAttribute("data-code"), r.innerHTML.slice(0, 520).replace(/\s+/g," "));
});
