/**
 * dsh-article-studio — Host half.
 *
 * Article pipeline storage + formatter/publisher bridge + preview routes.
 * Everything lives under ARTICLE_STUDIO_HOME (default D:\others\article\studio).
 */
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = "D:\\others\\article\\studio";
const VENDOR = join(HERE, "..", "vendor", "xiaohu", "scripts");
const VENDOR_CONFIG = join(HERE, "..", "vendor", "xiaohu", "config.json");
const ROUTE = "/dsh-article-studio";
const STAGES = ["brief", "outline", "draft", "images", "format", "review", "publish"];

/** User settings live outside the repo so credentials never ship with the plugin. */
const SETTINGS_PATH = join(process.env.USERPROFILE || "", ".dsh", "article-studio", "settings.json");

function readSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch { /* fall through */ }
  return {};
}

let ROOT = process.env.ARTICLE_STUDIO_HOME || readSettings().root || DEFAULT_ROOT;

export const name = "dsh-article-studio";
export const inject = ["webServer"];

/* ------------------------------------------------------------------ utils */

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function slug(text) {
  const keep = [];
  for (const ch of String(text || "").trim()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) keep.push(ch);
    else if (/\s/.test(ch)) keep.push("-");
  }
  return keep.join("").replace(/-+/g, "-").replace(/^-|-$/g, "") || "article";
}

function articleDir(id) { return join(ROOT, id); }
function metaPath(id) { return join(articleDir(id), "article.json"); }

function load(id) {
  const path = metaPath(id);
  if (!existsSync(path)) throw new Error("article not found: " + id);
  return JSON.parse(readFileSync(path, "utf8"));
}

function save(meta) {
  meta.updatedAt = now();
  const path = metaPath(meta.id);
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(meta, null, 2), "utf8");
  renameSync(tmp, path);
}

function listArticles() {
  if (!existsSync(ROOT)) return [];
  const out = [];
  for (const name of readdirSync(ROOT)) {
    const path = join(ROOT, name, "article.json");
    if (!existsSync(path)) continue;
    try { out.push(JSON.parse(readFileSync(path, "utf8"))); } catch { /* skip broken */ }
  }
  out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return out;
}

function currentStage(meta) {
  for (const stage of STAGES) if ((meta.stages?.[stage]?.status) !== "done") return stage;
  return "publish";
}

function json(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

async function readJson(req, limit = 4 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function run(file, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...opts }, (error, stdout, stderr) => {
      if (error) {
        // Scripts often explain the failure on stdout and exit non-zero.
        const detail = String(stderr || stdout || error.message || "").trim().slice(-900);
        reject(new Error(detail || "command failed"));
        return;
      }
      resolvePromise(String(stdout || "").trim());
    });
  });
}

async function python(args, cwd) {
  const env = { ...process.env, PYTHONIOENCODING: "utf-8" };
  const candidates = [["python", args], ["py", ["-3", ...args]], ["D:\\ProgramData\\anaconda3\\python.exe", args]];
  let last;
  for (const [exe, argv] of candidates) {
    try { return await run(exe, argv, { cwd, env }); } catch (e) {
      last = e;
      // Only a missing interpreter falls through; a real script failure is the answer.
      if (!/ENOENT/.test(String(e && e.message))) throw e;
    }
  }
  throw last || new Error("python not available");
}

/* ---------------------------------------------------------------- actions */

function create({ title, theme }) {
  const clean = String(title || "").trim() || "未命名";
  let id = slug(clean), n = 2;
  while (existsSync(articleDir(id))) id = `${slug(clean)}-${n++}`;
  mkdirSync(join(articleDir(id), "images"), { recursive: true });
  mkdirSync(join(articleDir(id), "out"), { recursive: true });
  const meta = {
    id, title: clean, createdAt: now(), updatedAt: now(),
    theme: theme || readSettings().defaultTheme || "newspaper", cover: "", draftVersion: 0,
    stages: Object.fromEntries(STAGES.map((s) => [s, { status: "todo", updatedAt: now(), note: "" }])),
    history: [],
    publish: { status: "todo", dryRun: null, mediaId: "", message: "" }
  };
  save(meta);
  return { ok: true, id, dir: articleDir(id) };
}

function setStage({ id, stage, status, note, theme, markdown }) {
  const meta = load(id);
  if (stage && !STAGES.includes(stage)) throw new Error("unknown stage: " + stage);
  if (stage) {
    const info = meta.stages[stage];
    if (status) info.status = status;
    if (note !== undefined) info.note = String(note);
    info.updatedAt = now();
  }
  if (theme) meta.theme = theme;
  if (markdown !== undefined) {
    writeFileSync(join(articleDir(id), "draft.md"), String(markdown), "utf8");
    meta.stages.draft.status = "done";
    meta.draftVersion = (meta.draftVersion || 0) + 1;
    meta.stages.draft.updatedAt = now();
  }
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: stage ? `set:${stage}` : "update", by: "user", note: note || "" });
  save(meta);
  return { ok: true, id, stage, status: status || null };
}

// The vendored formatter reads its config from the skill root. Keep the real
// credentials out of the repository: reuse the user's config, else the example.
function ensureConfig() {
  const target = join(HERE, "..", "vendor", "xiaohu", "config.json");
  if (existsSync(target)) return;
  const user = join(process.env.USERPROFILE || "", ".dsh", "article-studio", "config.json");
  const example = join(HERE, "..", "vendor", "xiaohu", "config.example.json");
  if (existsSync(user)) copyFileSync(user, target);
  else if (existsSync(example)) copyFileSync(example, target);
}

/** Every article ships with pictures: count files on disk and references in the draft. */
function imageRefs(id) {
  const text = draftOf(id);
  return (text.match(/!\[[^\]]*\]\(([^)]+)\)/g) || []).length;
}

function imageCount(id) {
  return Math.max(imagesOf(id).length, imageRefs(id));
}

const minImages = () => {
  const value = Number(readSettings().minImages);
  return Number.isFinite(value) && value >= 0 ? value : 3;
};

/** What the settings panel shows: paths, the picture floor, and masked credentials. */
function getSettings() {
  const settings = readSettings();
  let wechat = {};
  try { wechat = JSON.parse(readFileSync(VENDOR_CONFIG, "utf8")).wechat || {}; } catch { /* none yet */ }
  return {
    ok: true,
    root: ROOT,
    minImages: minImages(),
    defaultTheme: settings.defaultTheme || "newspaper",
    settingsPath: SETTINGS_PATH,
    configPath: VENDOR_CONFIG,
    wechat: {
      app_id: wechat.app_id || "",
      app_secret: wechat.app_secret ? "******" : "",
      author: wechat.author || ""
    }
  };
}

function saveSettings(body) {
  const current = readSettings();
  const next = { ...current };
  if (body.root) next.root = String(body.root).trim();
  if (body.minImages !== undefined) next.minImages = Math.max(0, Number(body.minImages) || 0);
  if (body.defaultTheme) next.defaultTheme = String(body.defaultTheme);
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  if (next.root) {
    ROOT = next.root;
    mkdirSync(ROOT, { recursive: true });
  }
  if (body.wechat) {
    ensureConfig();
    const config = JSON.parse(readFileSync(VENDOR_CONFIG, "utf8"));
    config.wechat = config.wechat || {};
    if (body.wechat.app_id !== undefined) config.wechat.app_id = String(body.wechat.app_id).trim();
    if (body.wechat.app_secret !== undefined && body.wechat.app_secret !== "******") {
      config.wechat.app_secret = String(body.wechat.app_secret).trim();
    }
    if (body.wechat.author !== undefined) config.wechat.author = String(body.wechat.author).trim();
    if (body.defaultTheme) config.settings = { ...(config.settings || {}), default_theme: String(body.defaultTheme) };
    writeFileSync(VENDOR_CONFIG, JSON.stringify(config, null, 2), "utf8");
  }
  return { ok: true, ...getSettings() };
}

/**
 * Pull candidate images from a page: og:image plus every <img> source, filtered
 * to real image types, deduplicated, and saved with a manifest that keeps the
 * source URL so the article can prove where a picture came from.
 */
async function grabImages({ id, url, limit = 8 }) {
  const meta = load(id);
  const pageUrl = String(url || meta.sourceUrl || "").trim();
  if (!pageUrl) throw new Error("缺少抓取地址：先给文章填 sourceUrl");
  const response = await fetch(pageUrl, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" }
  });
  if (!response.ok) throw new Error(`抓取失败：HTTP ${response.status}`);
  const html = await response.text();
  const base = new URL(pageUrl);
  const raw = [];
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) raw.push(og[1]);
  for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi)) raw.push(match[1]);

  const urls = [];
  for (const candidate of raw) {
    try {
      const absolute = new URL(candidate, base).href;
      if (!/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(absolute)) continue;
      if (!urls.includes(absolute)) urls.push(absolute);
    } catch { /* skip malformed */ }
  }

  const dir = join(articleDir(id), "images");
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
  const saved = [];
  for (const imageUrl of urls) {
    if (saved.length >= limit) break;
    try {
      const imageResponse = await fetch(imageUrl, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36", referer: pageUrl }
      });
      if (!imageResponse.ok) continue;
      const type = imageResponse.headers.get("content-type") || "";
      if (!/^image\//.test(type)) continue;
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      if (buffer.length < 20000) continue;
      const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
      const name = `${String(manifest.length + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-5)}.${ext}`;
      writeFileSync(join(dir, name), buffer);
      manifest.push({ name, sourceUrl: imageUrl, pageUrl, at: now(), bytes: buffer.length });
      saved.push({ name, bytes: buffer.length });
    } catch { /* skip one bad image */ }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  meta.sourceUrl = pageUrl;
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: "images:grab", by: "agent", note: `${saved.length} 张，来自 ${pageUrl}` });
  save(meta);
  return { ok: true, id, saved: saved.length, images: imagesOf(id), pageUrl };
}

async function format({ id, theme }) {
  ensureConfig();
  if (imageCount(id) < minImages()) {
    throw new Error(`配图不足：至少 ${minImages()} 张，当前 ${imageCount(id)} 张。先用「抓官网配图」把图存进 images/ 并写进正文。`);
  }
  const meta = load(id);
  const work = articleDir(id);
  if (!existsSync(join(work, "draft.md"))) throw new Error("draft.md missing");
  const chosen = theme || meta.theme || "newspaper";
  const output = join(work, "out");
  // `out/` is generated; clearing it prevents stale images from a previous run
  // shadowing a replaced source picture of the same name.
  rmSync(output, { recursive: true, force: true });
  const stdout = await python([
    join(VENDOR, "format.py"), "--input", join(work, "draft.md"),
    "--output", output, "--theme", chosen, "--format", "wechat", "--no-open"
  ], work);
  meta.theme = chosen;
  meta.stages.format.status = "done";
  meta.stages.format.note = stdout.slice(-600);
  meta.stages.format.updatedAt = now();
  save(meta);
  return { ok: true, id, theme: chosen, stdout: stdout.slice(-1200) };
}

async function publish({ id, dryRun }) {
  ensureConfig();
  const meta = load(id);
  const work = articleDir(id);
  // format.py writes out/<input-stem>/article.html, so publish needs that leaf.
  const best = findPreview(id);
  if (!best) throw new Error("run format first");
  const out = dirname(best);
  const args = [join(VENDOR, "publish.py"), "--dir", out, "--title", meta.title, "--theme", meta.theme || ""];
  if (meta.cover) args.push("--cover", join(work, meta.cover));
  args.push(dryRun ? "--dry-run" : "--yes");
  const stdout = await python(args, work);
  meta.publish = { status: "done", dryRun: !!dryRun, mediaId: "", message: stdout.slice(-800), updatedAt: now() };
  meta.stages.publish.status = "done";
  meta.stages.publish.note = stdout.slice(-300);
  meta.stages.publish.updatedAt = now();
  save(meta);
  return { ok: true, id, dryRun: !!dryRun, stdout: stdout.slice(-1200) };
}

/* ---------------------------------------------------------------- preview */

function findPreview(id) {
  const out = join(ROOT, id, "out");
  if (!existsSync(out)) return null;
  let best = null;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "preview.html") {
        if (!best || statSync(full).mtimeMs > statSync(best).mtimeMs) best = full;
      }
    }
  };
  walk(out);
  return best;
}

const CAPABILITIES = "2026-11-03.3";
const ACTIONS = ["list", "get", "create", "set", "draft", "theme", "cover", "deleteImage", "format", "publish", "themes", "capabilities", "grab", "settings", "saveSettings"];

/** The vendored skill's own theme catalogue: id, display name, description. */
function listThemes() {
  const dir = join(HERE, "..", "vendor", "xiaohu", "themes");
  if (!existsSync(dir)) return { ok: true, themes: [] };
  const themes = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const id = file.replace(/\.json$/, "");
      let name = id;
      let description = "";
      try {
        const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
        if (data.name) name = String(data.name);
        if (data.description) description = String(data.description);
      } catch { /* keep the id */ }
      return { id, name, description };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  return { ok: true, themes };
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

function imagesOf(id) {
  const dir = join(articleDir(id), "images");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => IMAGE_EXT.test(name)).sort().map((name) => ({ name }));
}

function draftOf(id) {
  const path = join(articleDir(id), "draft.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function saveDraft({ id, markdown }) {
  const meta = load(id);
  writeFileSync(join(articleDir(id), "draft.md"), String(markdown ?? ""), "utf8");
  meta.draftVersion = (meta.draftVersion || 0) + 1;
  meta.stages.draft.status = "done";
  meta.stages.draft.updatedAt = now();
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: "draft:save", by: "user", note: `${String(markdown ?? "").length} chars` });
  save(meta);
  return { ok: true, id, draftVersion: meta.draftVersion };
}

function setTheme({ id, theme }) {
  const meta = load(id);
  if (!theme) throw new Error("theme required");
  meta.theme = String(theme);
  save(meta);
  return { ok: true, id, theme: meta.theme };
}

function setCover({ id, name }) {
  const meta = load(id);
  const path = join(articleDir(id), "images", String(name));
  if (!existsSync(path)) throw new Error("image not found: " + name);
  meta.cover = "images/" + name;
  save(meta);
  return { ok: true, id, cover: meta.cover };
}

function deleteImage({ id, name }) {
  const path = resolve(articleDir(id), "images", String(name));
  const root = resolve(articleDir(id), "images");
  if (!path.startsWith(root + sep)) throw new Error("bad path");
  if (existsSync(path)) unlinkSync(path);
  return { ok: true, id, name };
}

function serveAsset(req, res, rest) {
  const [id, ...tail] = rest.split("/");
  const root = resolve(articleDir(decodeURIComponent(id)));
  const target = resolve(root, tail.map(decodeURIComponent).join("/"));
  if (!target.startsWith(root + sep) || !existsSync(target)) { json(res, 404, { ok: false }); return; }
  const ext = target.slice(target.lastIndexOf(".")).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";
  const data = readFileSync(target);
  res.writeHead(200, { "content-type": mime, "content-length": data.length, "cache-control": "no-store" });
  res.end(data);
}

function servePreview(req, res, rest) {
  const [id, ...tail] = rest.split("/");
  const out = resolve(ROOT, decodeURIComponent(id), "out");
  if (tail.length && tail.join("/")) {
    const target = resolve(out, tail.map(decodeURIComponent).join("/"));
    if (!target.startsWith(out + sep)) { json(res, 404, { ok: false }); return; }
    if (!existsSync(target)) { json(res, 404, { ok: false }); return; }
    const ext = target.slice(target.lastIndexOf(".")).toLowerCase();
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".css": "text/css" }[ext] || "application/octet-stream";
    const data = readFileSync(target);
    res.writeHead(200, { "content-type": mime, "content-length": data.length });
    res.end(data);
    return;
  }
  const best = findPreview(decodeURIComponent(id));
  if (!best) { json(res, 404, { ok: false, error: "尚未排版" }); return; }
  let html = readFileSync(best, "utf8");
  const base = `${ROUTE}/preview/${encodeURIComponent(decodeURIComponent(id))}/${relative(out, dirname(best)).split(sep).join("/")}/`;
  const tag = `<base href="${base}">`;
  html = html.includes("<head>") ? html.replace("<head>", "<head>" + tag) : tag + html;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

/* ---------------------------------------------------------------- routes */

async function handle(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;

  if (path === ROUTE + "/") {
    const file = join(HERE, "panel.html");
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(data);
    return;
  }

  if (path.startsWith(ROUTE + "/preview/")) {
    servePreview(req, res, path.slice((ROUTE + "/preview/").length));
    return;
  }

  if (path.startsWith(ROUTE + "/asset/")) {
    serveAsset(req, res, path.slice((ROUTE + "/asset/").length));
    return;
  }

  if (path === ROUTE + "/rpc") {
    if (req.method !== "POST") { json(res, 405, { ok: false, error: "POST only" }); return; }
    let body;
    try { body = await readJson(req); } catch (e) { json(res, 400, { ok: false, error: String(e.message || e) }); return; }
    try {
      const action = body.action;
      let result;
      if (action === "list") result = { ok: true, articles: listArticles(), stages: STAGES, root: ROOT };
      else if (action === "themes") result = listThemes();
      else if (action === "capabilities") result = { ok: true, version: CAPABILITIES, actions: ACTIONS };
      else if (action === "get") {
        const meta = load(body.id);
        result = {
          ok: true, article: meta, currentStage: currentStage(meta),
          draft: draftOf(body.id), images: imagesOf(body.id),
          history: (meta.history || []).slice(-40).reverse()
        };
      }
      else if (action === "create") result = create(body);
      else if (action === "set") result = setStage(body);
      else if (action === "draft") result = saveDraft(body);
      else if (action === "theme") result = setTheme(body);
      else if (action === "cover") result = setCover(body);
      else if (action === "deleteImage") result = deleteImage(body);
      else if (action === "settings") result = getSettings();
      else if (action === "saveSettings") result = saveSettings(body);
      else if (action === "grab") result = await grabImages(body);
      else if (action === "format") result = await format(body);
      else if (action === "publish") result = await publish(body);
      else result = { ok: false, error: "unknown action" };
      json(res, 200, result);
    } catch (error) {
      json(res, 200, { ok: false, error: String((error && error.message) || error) });
    }
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
}

export { handle as routeHandler };

export function apply(ctx) {
  ctx.inject(["webServer"], (scoped) => {
    scoped.effect(() => {
      // Prefix routes are matched as `pathname === path || pathname.startsWith(path + "/")`,
      // so registering with a trailing slash only ever matches that one exact path.
      const dispose = scoped.webServer.register({
        kind: "prefix",
        path: ROUTE,
        handler: handle
      });
      return () => dispose();
    }, "dsh-article-studio: routes");
  });
}
