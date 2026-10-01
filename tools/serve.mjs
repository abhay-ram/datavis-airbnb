/* ==========================================================================
   Mini-Devserver für die gebauten Embeds.
     node tools/serve.mjs [port]
   Liefert dist/ unter http://127.0.0.1:<port>/ aus, ohne Abhängigkeiten.
   ========================================================================== */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DIST = path.join(ROOT, "dist");
const PORT = parseInt(process.argv[2] || process.env.PORT || "4173", 10);
const HOST = "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "content-type": type || "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

function indexPage() {
  const files = fs.existsSync(DIST)
    ? fs.readdirSync(DIST).filter((f) => f.endsWith(".html")).sort()
    : [];
  const items = files.map((f) => {
    const title = f === "index.html" ? "Übersicht & Einbettungscodes" : f;
    return `<li><a href="/${f}"><b>${title}</b></a> <a class="raw" href="/${f}?embed=1">?embed=1</a></li>`;
  }).join("\n");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dev-Server · London Airbnb</title>
<style>
 body{margin:0;padding:40px 28px;background:#0c1017;color:#f2f5fa;
      font:15px/1.6 "Inter","Segoe UI",system-ui,sans-serif}
 h1{font-size:26px;letter-spacing:-.03em;margin:0 0 6px}
 p.sub{color:#a9b4c7;margin:0 0 26px;max-width:70ch}
 ul{list-style:none;padding:0;margin:0;display:grid;gap:8px;max-width:820px}
 li{background:#131a26;border:1px solid #232c3c;border-radius:12px;padding:12px 16px;
    display:flex;align-items:center;gap:12px}
 li b{font-weight:600}
 a{color:#ff9095;text-decoration:none;flex:1}
 a:hover{text-decoration:underline}
 a.raw{flex:0 0 auto;font-size:12px;color:#7b879c}
 a.raw:hover{color:#a9b4c7}
 code{background:#1b2331;padding:2px 6px;border-radius:6px;font-size:13px}
 .note{margin-top:28px;color:#7b879c;font-size:13px;max-width:70ch}
</style></head><body>
<h1>London Airbnb · Dev-Server</h1>
<p class="sub">Alle gebauten Varianten liegen als eigenständige HTML-Datei in <code>dist/</code>.
Jede Datei läuft ohne Server, ohne CDN und ohne Build-Schritt.</p>
<ul>${items}</ul>
<p class="note">Hinweis: <code>?embed=1</code> ist der Modus für den iframe-Einbau –
kompaktere Abstände, Player-Navigation bei den Scroll-Stories.
Weitere Parameter: <code>?theme=light|dark</code>, <code>?metric=per1k</code>,
<code>?year=2019</code>, <code>?focus=E09000007</code>.</p>
</body></html>`;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "bad request");
  }
  if (urlPath === "/" || urlPath === "") {
    return send(res, 200, indexPage(), TYPES[".html"]);
  }
  const rel = urlPath.replace(/^\/+/, "");
  const target = path.join(DIST, rel);
  if (!target.startsWith(DIST)) return send(res, 403, "forbidden");
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      return send(res, 404, `nicht gefunden: ${rel}\n\nTipp: zuerst "python tools/build.py" ausführen.`);
    }
    const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": st.size,
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} ist belegt. Anderen Port wählen: node tools/serve.mjs 4174`);
  } else {
    console.error("Serverfehler:", e.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`London-Airbnb-Vorschau läuft:  http://${HOST}:${PORT}/`);
  console.log(`Übersicht:                     http://${HOST}:${PORT}/index.html`);
  console.log(`Dateien aus:                   ${DIST}`);
});
