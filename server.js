// Plate server: serves the app and turns "what I ate" into a calorie log using Claude (your Claude plan, via Claude Code).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 8080;
const PASS = process.env.APP_PASSCODE || "";
const MODEL = process.env.CLAUDE_MODEL || "haiku";
const PUB = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json", ".js": "text/javascript" };

function passOk(given) {
  if (!PASS) return true;
  const a = Buffer.from(String(given || "")), b = Buffer.from(PASS);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", "--output-format", "json", "--model", MODEL, "--tools", ""], { env: process.env });
    let out = "", err = "";
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("timeout")); }, 90000);
    p.stdout.on("data", d => (out += d));
    p.stderr.on("data", d => (err += d));
    p.on("error", e => { clearTimeout(timer); reject(e); });
    p.on("close", () => {
      clearTimeout(timer);
      try {
        const r = JSON.parse(out);
        if (r.is_error) return reject(new Error(r.result || "claude error"));
        resolve(String(r.result || ""));
      } catch (e) { reject(new Error((err || out).slice(0, 500))); }
    });
    p.stdin.end(prompt);
  });
}

function extractJson(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error("no json");
  return JSON.parse(text.slice(s, e + 1));
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function handleLog(req, res) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 200000) return send(res, 413, { error: "too big" }); }
  if (!passOk(req.headers["x-passcode"])) return send(res, 401, { error: "passcode" });
  let data;
  try { data = JSON.parse(body); } catch { return send(res, 400, { error: "bad json" }); }
  const rules = String(data.rules || "").slice(0, 60000);
  const history = Array.isArray(data.history) ? data.history.slice(-12) : [];
  const text = String(data.text || "").slice(0, 4000);
  if (!rules || !text) return send(res, 400, { error: "missing" });
  const convo = history.map(m => (m.role === "user" ? "User: " : "Tracker: ") + String(m.content || "").slice(0, 2000)).join("\n");
  const prompt = `${rules}\n\nRecent conversation:\n${convo || "(none)"}\n\nUser's new message:\n${text}\n\nRespond with ONLY the JSON object, no other text.`;
  try {
    const out = extractJson(await askClaude(prompt));
    send(res, 200, out);
  } catch (e) {
    console.error("log failed:", e.message);
    send(res, 502, { error: "claude" });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/api/log") return handleLog(req, res).catch(() => send(res, 500, { error: "server" }));
  if (url.pathname === "/healthz") return send(res, 200, { ok: true });
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.join(PUB, path.normalize(file).replace(/^(\.\.[\/\\])+/, ""));
  if (!full.startsWith(PUB)) { res.writeHead(404); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(full)] || "application/octet-stream", "cache-control": full.endsWith(".html") ? "no-cache" : "public, max-age=86400" });
    res.end(buf);
  });
}).listen(PORT, () => console.log("Plate listening on " + PORT));
