/**
 * dsh-article-studio — Host half.
 *
 * Article pipeline storage + formatter/publisher bridge + preview routes.
 * Everything lives under ARTICLE_STUDIO_HOME (default D:\others\article\studio).
 */
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
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

/** Groups that exist even before any article joins them. */
function knownGroups() {
  const fromSettings = (readSettings().groups || []).map((name) => String(name).trim()).filter(Boolean);
  const fromArticles = listArticles().map((a) => String(a.group || "").trim()).filter(Boolean);
  return [...new Set([...fromSettings, ...fromArticles])].sort();
}

function rememberGroup(name) {
  const value = String(name || "").trim();
  if (!value) return;
  const settings = readSettings();
  const groups = new Set([...(settings.groups || []), value]);
  settings.groups = [...groups];
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

function createGroup({ name }) {
  const value = String(name || "").trim();
  if (!value) throw new Error("分组名不能为空");
  rememberGroup(value);
  return { ok: true, groups: knownGroups() };
}

function writeGroups(groups) {
  const settings = readSettings();
  settings.groups = [...new Set(groups.map((name) => String(name).trim()).filter(Boolean))].sort();
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

/** Rename a group everywhere: the settings catalogue and every article in it. */
function renameGroup({ from, to }) {
  const source = String(from || "").trim();
  const target = String(to || "").trim();
  if (!source || !target) throw new Error("分组名不能为空");
  writeGroups(knownGroups().map((name) => (name === source ? target : name)));
  for (const meta of listArticles()) {
    if (String(meta.group || "").trim() !== source) continue;
    const full = load(meta.id);
    full.group = target;
    full.history = full.history || [];
    full.history.push({ at: now(), action: "group:rename", by: "user", note: source + " → " + target });
    save(full);
  }
  return { ok: true, groups: knownGroups() };
}

/** Remove a group; its articles fall back to 未分组. */
function deleteGroup({ name }) {
  const source = String(name || "").trim();
  if (!source) throw new Error("分组名不能为空");
  writeGroups(knownGroups().filter((entry) => entry !== source));
  for (const meta of listArticles()) {
    if (String(meta.group || "").trim() !== source) continue;
    const full = load(meta.id);
    full.group = "";
    full.history = full.history || [];
    full.history.push({ at: now(), action: "group:delete", by: "user", note: source + " → 未分组" });
    save(full);
  }
  return { ok: true, groups: knownGroups() };
}

function create({ title, theme, group }) {
  const clean = String(title || "").trim() || "未命名";
  let id = slug(clean), n = 2;
  while (existsSync(articleDir(id))) id = `${slug(clean)}-${n++}`;
  mkdirSync(join(articleDir(id), "images"), { recursive: true });
  mkdirSync(join(articleDir(id), "out"), { recursive: true });
  const meta = {
    id, title: clean, createdAt: now(), updatedAt: now(),
    theme: theme || readSettings().defaultTheme || "newspaper", cover: "", draftVersion: 0,
    group: String(group || "").trim(),
    stages: Object.fromEntries(STAGES.map((s) => [s, { status: "todo", updatedAt: now(), note: "" }])),
    history: [],
    publish: { status: "todo", mediaId: "", message: "" }
  };
  if (meta.group) rememberGroup(meta.group);
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

/**
 * Sections under `# 核心产品` that never mention a picture. Every named product
 * should carry its own image, so the formatter reports the headings that don't.
 */
function imageWarnings(id) {
  const lines = draftOf(id).split(/\r?\n/);
  const warnings = [];
  let inProducts = false;
  let heading = null;
  let sawImage = false;
  let hadChild = false;
  const flush = () => {
    // A heading that only groups deeper headings is a container, not a product.
    if (inProducts && heading && !sawImage && !hadChild) warnings.push(heading);
    heading = null;
    sawImage = false;
    hadChild = false;
  };
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      flush();
      inProducts = /核心产品/.test(line);
      continue;
    }
    if (!inProducts) continue;
    if (/^#{2,3}\s+/.test(line)) {
      if (heading !== null) hadChild = true;
      flush();
      heading = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (/!\[[^\]]*\]\([^)]+\)/.test(line)) sawImage = true;
  }
  flush();
  return warnings;
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
    },
    vision: {
      baseUrl: (settings.vision || {}).baseUrl || "",
      model: (settings.vision || {}).model || "",
      apiKey: (settings.vision || {}).apiKey ? "******" : ""
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
  if (body.vision) {
    const current = next.vision || {};
    next.vision = {
      baseUrl: String(body.vision.baseUrl ?? current.baseUrl ?? "").trim(),
      model: String(body.vision.model ?? current.model ?? "").trim(),
      apiKey:
        body.vision.apiKey && body.vision.apiKey !== "******"
          ? String(body.vision.apiKey).trim()
          : current.apiKey || ""
    };
    writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
  }
  return { ok: true, ...getSettings() };
}

/** Optional OpenAI-compatible vision endpoint used to vet downloaded pictures. */
function visionConfig() {
  const saved = readSettings().vision || {};
  return { baseUrl: saved.baseUrl || "", model: saved.model || "", apiKey: saved.apiKey || "" };
}

const AI_META_HINTS = /(stable ?diffusion|midjourney|dall[·\-]?e|novelai|comfyui|automatic1111|ai ?generated|ai生成|豆包|即梦|通义万相|文心一格)/i;

/** Generation tools usually leave a fingerprint in PNG text chunks or EXIF. */
function metadataVerdict(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");
  const match = head.match(AI_META_HINTS);
  return match ? match[0] : "";
}

/**
 * Final gate before an image is accepted: metadata fingerprints first, then an
 * optional vision model that checks for generated look and topical relevance.
 */
async function vetImage(buffer, type, topic) {
  const stamp = metadataVerdict(buffer);
  if (stamp) return { ok: false, why: `元数据命中「${stamp}」` };
  const cfg = visionConfig();
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) return { ok: true, verdict: "unverified" };
  try {
    const dataUrl = `data:${type};base64,${buffer.toString("base64")}`;
    const response = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `这张图准备放进一篇关于「${topic}」的新闻里。请判断两件事：1) 是否像 AI 生成/合成图（有明显生成痕迹或生成水印）；2) 是否与这个主题相关。只回 JSON：{"ai":true|false,"relevant":true|false,"reason":"不超过20字"}`
            },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }]
      })
    });
    if (!response.ok) return { ok: true, verdict: "unverified", why: `视觉接口 HTTP ${response.status}` };
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content || "";
    const verdict = JSON.parse((text.match(/\{[\s\S]*\}/) || ["{}"])[0]);
    if (verdict.ai === true) return { ok: false, why: `视觉判定为 AI 图：${verdict.reason || ""}` };
    if (verdict.relevant === false) return { ok: false, why: `视觉判定与主题无关：${verdict.reason || ""}` };
    return { ok: true, verdict: "vision" };
  } catch (error) {
    return { ok: true, verdict: "unverified", why: String(error.message || error) };
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/** WeChat only serves the body to a real browser, so render it in a headless Edge. */
function edgeBinary() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe")
  ];
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

async function renderWithEdge(url, timeoutMs = 25000) {
  const binary = edgeBinary();
  if (!binary) throw new Error("没找到 Edge，无法渲染需要脚本的页面");
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = join(tmpdir(), `dsh-render-${Date.now()}`);
  const child = spawn(binary, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: "ignore", windowsHide: true });
  try {
    const deadline = Date.now() + timeoutMs;
    let target = null;
    while (Date.now() < deadline && !target) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((entry) => entry.type === "page");
      } catch { /* browser still starting */ }
      if (!target) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!target) throw new Error("浏览器启动超时");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("浏览器连接失败"));
    });
    let sequence = 0;
    const waiting = new Map();
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && waiting.has(message.id)) {
        waiting.get(message.id)(message);
        waiting.delete(message.id);
      }
    };
    const call = (method, params = {}) => new Promise((resolve) => {
      const id = ++sequence;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
    await call("Page.enable");
    await call("Page.navigate", { url });
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const result = await call("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true
    });
    socket.close();
    return result.result?.result?.value || "";
  } finally {
    try { child.kill(); } catch { /* already gone */ }
  }
}

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Slice out one element by id, counting nested divs so the block ends correctly. */
function blockById(html, id) {
  const marker = html.search(new RegExp(`id=["']${id}["']`));
  if (marker < 0) return "";
  const start = html.lastIndexOf("<", marker);
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tag.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.lastIndex);
  }
  return html.slice(start);
}

function htmlToText(fragment) {
  return decodeEntities(
    fragment
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|section|div|h[1-6]|li|blockquote|tr)>/gi, "\n\n")
  )
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  if (og) return decodeEntities(og[1]).trim();
  const rich = html.match(/<h1[^>]*class=["'][^"']*rich_media_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (rich) return htmlToText(rich[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? decodeEntities(title[1]).replace(/\s+/g, " ").trim() : "";
}

/** Direct image URLs from Bing image search (no key, no JS). */
// Pages whose pictures are usually real reporting rather than generated art.
const TRUSTED_HOSTS = [
  "sinaimg.cn", "sina.com.cn", "gtimg.cn", "qq.com", "163.com", "126.net", "cnstock.com",
  "xinhuanet.com", "news.cn", "thepaper.cn", "36kr.com", "jiqizhixin.com", "qbitai.com",
  "sohu.com", "zhihu.com", "bilibili.com", "ifeng.com", "stcn.com", "cs.com.cn",
  "yicai.com", "jiemian.com", "eastmoney.com", "cnbeta.com", "leiphone.com", "36dianping.com"
];
const AI_HINTS = /(aigc|ai生成|ai绘画|ai绘图|midjourney|stable[-_ ]?diffusion|dall[-_ ]?e|sdwebui|生成图|ai-art)/i;

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Pixel size from the file header, so obviously wrong crops never get in. */
function imageSize(buffer) {
  try {
    if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
    if (buffer.length > 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      const type = buffer.toString("ascii", 12, 16);
      if (type === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      if (type === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  } catch { /* unknown format */ }
  return null;
}

async function searchImages({ query, limit = 8 }) {
  const term = String(query || "").trim();
  if (!term) throw new Error("缺少关键词");
  // Exclude generated artwork at the query level as well.
  const shaped = `${term} -AI -生成`;
  const url = `https://cn.bing.com/images/search?q=${encodeURIComponent(shaped)}&form=HDRSC2&first=1`;
  const response = await fetch(url, { headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" } });
  if (!response.ok) throw new Error(`图片搜索失败：HTTP ${response.status}`);
  const html = await response.text();
  const found = [];
  const marker = 'murl&quot;:&quot;';
  let cursor = html.indexOf(marker);
  while (cursor >= 0) {
    const start = cursor + marker.length;
    const end = html.indexOf('&quot;', start);
    const image = decodeEntities(html.slice(start, end)).replace(/\\\//g, "/");
    // purl (the page the picture came from) sits a few fields later.
    const window = html.slice(end, end + 1500);
    const pageMatch = window.match(/purl&quot;:&quot;(.*?)&quot;/);
    const page = pageMatch ? decodeEntities(pageMatch[1]).replace(/\\\//g, "/") : "";
    if (/^https?:\/\//i.test(image) && /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(image)
      && !AI_HINTS.test(image) && !AI_HINTS.test(page)) {
      const host = hostOf(page) || hostOf(image);
      const trusted = TRUSTED_HOSTS.some((suffix) => host.endsWith(suffix));
      found.push({ image, page, trusted });
    }
    cursor = html.indexOf(marker, end);
  }
  // Real news pages first, everything else after; keep the order inside a group.
  found.sort((left, right) => Number(right.trusted) - Number(left.trusted));
  const urls = [];
  for (const item of found) {
    if (urls.includes(item.image)) continue;
    urls.push(item.image);
    if (urls.length >= limit) break;
  }
  return { ok: true, query: term, urls };
}

/**
 * Make sure every item has a picture. For each `####` block without an image,
 * widen the search step by step (title → keywords → brand + 机器人) and stop at
 * the first picture that survives the size/type checks.
 */
async function fillImages({ id, queries, force = false }) {
  const work = articleDir(id);
  const draftPath = join(work, "draft.md");
  let text = readFileSync(draftPath, "utf8");
  const dir = join(work, "images");
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];

  const blocks = text.split(/(?=^#### )/m);
  let added = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block.startsWith("#### ")) continue;
    if (!force && /!\[[^\]]*\]\([^)]+\)/.test(block)) continue;
    const title = block.split("\n")[0].replace(/^####\s*/, "").trim();
    const base = title.replace(/[，。：:；;、,."“”（）()《》—\-·]+/g, " ").replace(/\s+/g, " ").trim();
    const head = base.split(" ").slice(0, 3).join(" ");
    const candidates = [];
    if (Array.isArray(queries) && queries[index - 1]) candidates.push(queries[index - 1]);
    candidates.push(base, head, `${head} 机器人`);
    const tried = new Set();
    let saved = null;
    for (const query of candidates) {
      if (!query || tried.has(query)) continue;
      tried.add(query);
      let urls = [];
      try {
        urls = (await searchImages({ query, limit: 8 })).urls;
      } catch { continue; }
      for (const imageUrl of urls) {
        try {
          const response = await fetch(imageUrl, { headers: { "user-agent": UA, referer: "https://cn.bing.com/" } });
          if (!response.ok) continue;
          const type = response.headers.get("content-type") || "";
          if (!/^image\//.test(type)) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length < 25000) continue;
          const size = imageSize(buffer);
          if (size) {
            const ratio = size.width / Math.max(1, size.height);
            if (size.width < 500 || size.height < 300) continue;
            if (ratio < 0.5 || ratio > 2.4) continue;
          }
          // 最后一道关：元数据指纹 + （配置了的话）视觉模型判定
          const check = await vetImage(buffer, type, title);
          if (!check.ok) continue;
          const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
          const name = `im-${String(index).padStart(2, "0")}-${Date.now().toString(36).slice(-4)}.${ext}`;
          writeFileSync(join(dir, name), buffer);
          manifest.push({
            name, sourceUrl: imageUrl,
            pageUrl: `https://cn.bing.com/images/search?q=${encodeURIComponent(query)}`,
            query, at: now(), bytes: buffer.length, check: check.verdict || "vetoed"
          });
          saved = name;
          break;
        } catch { /* try the next candidate */ }
      }
      if (saved) break;
    }
    if (saved) {
      blocks[index] = block.trimEnd() + `\n\n![](${"images/" + saved})\n\n`;
      added += 1;
    }
  }
  text = blocks.join("");
  writeFileSync(draftPath, text, "utf8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  const meta = load(id);
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: "images:fill", by: "agent", note: `补齐 ${added} 张` });
  save(meta);
  return { ok: true, id, added, images: imagesOf(id) };
}

/** Find candidate articles through Bing's RSS endpoint (no key, no JS). */
async function searchSources({ query, limit = 8 }) {
  const term = String(query || "").trim();
  if (!term) throw new Error("缺少关键词");
  // Bing's CN RSS endpoint mis-tokenises bare Chinese word lists (「星尘智能 绳驱」
  // came back as results for 星). Quoting each token keeps every word.
  const shaped = term
    .split(/\s+/)
    .map((token) => (/^(site|filetype|after|before):/i.test(token) || /^".*"$/.test(token) ? token : `"${token}"`))
    .join(" ");
  const read = async (searchTerm) => {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(searchTerm)}&format=rss&setlang=zh-CN&mkt=zh-CN`;
    const response = await fetch(url, { headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" } });
    if (!response.ok) throw new Error(`搜索失败：HTTP ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
      const block = match[1];
      const pick = (tag) => {
        const found = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return found ? decodeEntities(found[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim() : "";
      };
      return { title: pick("title"), url: pick("link"), summary: pick("description") };
    }).filter((item) => item.url).slice(0, limit);
  };

  let items = await read(shaped);
  const tokens = term.split(/\s+/).filter((token) => !/^(site|filetype|after|before):/i.test(token));
  const relevant = items.slice(0, 3).some((item) => tokens.some((token) => item.title.includes(token)));
  // Rare words can make Bing fall back to a single character; retry with the
  // first token so the result still belongs to the subject.
  if (!relevant && tokens.length > 1) items = await read(`"${tokens[0]}"`);
  return { ok: true, query: term, items };
}

/**
 * Import a WeChat article (or any readable page) as a source: keep the text in
 * `sources/`, download its pictures into `images/`, and record the link so the
 * draft can point back at where a claim or picture came from.
 */
async function importSource({ id, url, html: pasted, file, limit = 8 }) {
  const meta = load(id);
  const pageUrl = String(url || "").trim();
  const isWechat = /mp\.weixin\.qq\.com/i.test(pageUrl);
  let html = "";
  if (pasted) {
    html = String(pasted);
  } else if (file) {
    if (!existsSync(file)) throw new Error("找不到文件：" + file);
    html = readFileSync(file, "utf8");
  } else {
    if (!pageUrl) throw new Error("缺少链接");
    try {
      const response = await fetch(pageUrl, { headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" } });
      if (response.ok) html = await response.text();
    } catch { /* fall through to the browser */ }
    // WeChat hides the body from plain HTTP clients: render it in a real browser.
    if (!/id=["']js_content["']/.test(html)) {
      html = await renderWithEdge(pageUrl);
      if (!html.trim()) throw new Error("抓不到正文：链接可能已过期，或需要微信内打开");
    }
  }
  if (!html.trim()) throw new Error("没有可解析的内容");
  const content = blockById(html, "js_content") || blockById(html, "js_article") || html;
  const text = htmlToText(content);
  const floor = pasted || file ? 40 : 120;
  if (text.length < floor) throw new Error("正文太短，可能不是文章页（或被反爬拦截）");
  const title = pageTitle(html) || pageUrl;

  const dir = articleDir(id);
  const sources = join(dir, "sources");
  mkdirSync(sources, { recursive: true });
  const slug = (title.replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 24) || "source") + "-" + Date.now().toString(36).slice(-4);
  const sourceFile = `${slug}.md`;
  const header = `<!-- source: ${pageUrl}\ntitle: ${title}\nat: ${now()} -->\n\n`;
  writeFileSync(join(sources, sourceFile), header + text + "\n", "utf8");

  const imageUrls = [];
  for (const match of content.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) {
    const candidate = match[1];
    if (!/^https?:/i.test(candidate)) continue;
    if (!/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(candidate) && !/mmbiz\.qpic\.cn/i.test(candidate)) continue;
    if (!imageUrls.includes(candidate)) imageUrls.push(candidate);
  }

  const imageDir = join(dir, "images");
  mkdirSync(imageDir, { recursive: true });
  const manifestPath = join(imageDir, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
  const saved = [];
  for (const imageUrl of imageUrls) {
    if (saved.length >= limit) break;
    try {
      const imageResponse = await fetch(imageUrl, { headers: { "user-agent": UA, referer: isWechat ? "https://mp.weixin.qq.com/" : pageUrl } });
      if (!imageResponse.ok) continue;
      const type = imageResponse.headers.get("content-type") || "";
      if (!/^image\//.test(type)) continue;
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      if (buffer.length < 15000) continue;
      const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
      const name = `src-${slug.slice(0, 16)}-${saved.length + 1}.${ext}`;
      writeFileSync(join(imageDir, name), buffer);
      manifest.push({ name, sourceUrl: imageUrl, pageUrl, at: now(), bytes: buffer.length });
      saved.push({ name, bytes: buffer.length });
    } catch { /* skip one bad image */ }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  meta.sources = Array.isArray(meta.sources) ? meta.sources : [];
  meta.sources.unshift({ url: pageUrl, title, at: now(), file: sourceFile, images: saved.length, chars: text.length });
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: "source:import", by: "user", note: `${title}（${saved.length} 张图）` });
  save(meta);
  return { ok: true, id, title, chars: text.length, file: sourceFile, images: saved, sources: meta.sources };
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
    "--output", output, "--theme", chosen, "--format", "wechat", "--no-open",
    // The WeChat article already shows the title: never repeat it as the body H1.
    "--drop-title",
    // Follow banner at both ends, drawn in HTML so it takes the article's own paper.
    "--banner"
  ], work);
  meta.theme = chosen;
  meta.stages.format.status = "done";
  meta.stages.format.note = stdout.slice(-600);
  meta.stages.format.updatedAt = now();
  save(meta);
  const warnings = imageWarnings(id);
  return { ok: true, id, theme: chosen, warnings, stdout: stdout.slice(-1200) };
}

/** Push the formatted article straight into the WeChat draft box — no rehearsal step. */
async function publish({ id }) {
  ensureConfig();
  const meta = load(id);
  const work = articleDir(id);
  // format.py writes out/<input-stem>/article.html, so publish needs that leaf.
  const best = findPreview(id);
  if (!best) throw new Error("先排版再推送：还没有 preview.html");
  const out = dirname(best);
  const args = [join(VENDOR, "publish.py"), "--dir", out, "--title", meta.title, "--theme", meta.theme || ""];
  if (meta.cover) args.push("--cover", join(work, meta.cover));
  args.push("--yes");
  const stdout = await python(args, work);
  meta.publish = { status: "done", mediaId: "", message: stdout.slice(-800), updatedAt: now() };
  meta.stages.publish.status = "done";
  meta.stages.publish.note = stdout.slice(-300);
  meta.stages.publish.updatedAt = now();
  save(meta);
  return { ok: true, id, stdout: stdout.slice(-1200) };
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
const ACTIONS = ["list", "get", "create", "update", "set", "draft", "theme", "cover", "deleteImage", "format", "publish", "themes", "capabilities", "grab", "importSource", "searchSources", "searchImages", "fillImages", "settings", "saveSettings", "groups", "createGroup", "renameGroup", "deleteGroup"];

/** Distinct groups and authors in use, offered as suggestions. */
function catalogue() {
  const authors = [...new Set(listArticles().map((m) => String(m.author || "").trim()).filter(Boolean))].sort();
  return { groups: knownGroups(), authors };
}

/** Metadata the author edits directly: title, author, group, cover. */
function updateArticle({ id, title, author, group, cover }) {
  const meta = load(id);
  if (title !== undefined && String(title).trim()) meta.title = String(title).trim();
  if (author !== undefined) meta.author = String(author).trim();
  if (group !== undefined) {
    meta.group = String(group).trim();
    if (meta.group) rememberGroup(meta.group);
  }
  if (cover !== undefined) {
    const value = String(cover).trim();
    if (value && !existsSync(join(articleDir(id), value))) throw new Error("封面文件不存在：" + value);
    meta.cover = value;
  }
  meta.history = meta.history || [];
  meta.history.push({ at: now(), action: "meta:update", by: "user", note: "标题/作者/分组/封面" });
  save(meta);
  return { ok: true, id, article: meta };
}

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
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".css": "text/css" }[ext] || "application/octet-stream";
    const data = readFileSync(target);
    res.writeHead(200, { "content-type": mime, "content-length": data.length, "cache-control": "no-store" });
    res.end(data);
    return;
  }
  const best = findPreview(decodeURIComponent(id));
  if (!best) { json(res, 404, { ok: false, error: "尚未排版" }); return; }
  let html = readFileSync(best, "utf8");
  const base = `${ROUTE}/preview/${encodeURIComponent(decodeURIComponent(id))}/${relative(out, dirname(best)).split(sep).join("/")}/`;
  const tag = `<base href="${base}">`;
  html = html.includes("<head>") ? html.replace("<head>", "<head>" + tag) : tag + html;
  // Version every local image with its mtime: a replaced picture keeps its name,
  // and without this the browser happily reuses the stale, cached bytes.
  const previewDir = dirname(best);
  html = html.replace(/(src|href)=["'](images\/[^"'?]+)["']/g, (match, attr, rel) => {
    try {
      const file = join(previewDir, rel);
      const version = existsSync(file) ? Math.round(statSync(file).mtimeMs) : Date.now();
      return `${attr}="${rel}?v=${version}"`;
    } catch { return match; }
  });
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
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
      if (action === "list") result = { ok: true, articles: listArticles(), stages: STAGES, root: ROOT, ...catalogue() };
      else if (action === "groups") result = { ok: true, groups: knownGroups() };
      else if (action === "createGroup") result = createGroup(body);
      else if (action === "renameGroup") result = renameGroup(body);
      else if (action === "deleteGroup") result = deleteGroup(body);
      else if (action === "themes") result = listThemes();
      else if (action === "capabilities") result = { ok: true, version: CAPABILITIES, actions: ACTIONS };
      else if (action === "get") {
        const meta = load(body.id);
        result = {
          ok: true, article: meta, currentStage: currentStage(meta),
          draft: draftOf(body.id), images: imagesOf(body.id),
          history: (meta.history || []).slice(-40).reverse(),
          ...catalogue()
        };
      }
      else if (action === "create") result = create(body);
      else if (action === "update") result = updateArticle(body);
      else if (action === "set") result = setStage(body);
      else if (action === "draft") result = saveDraft(body);
      else if (action === "theme") result = setTheme(body);
      else if (action === "cover") result = setCover(body);
      else if (action === "deleteImage") result = deleteImage(body);
      else if (action === "settings") result = getSettings();
      else if (action === "saveSettings") result = saveSettings(body);
      else if (action === "grab") result = await grabImages(body);
      else if (action === "importSource") result = await importSource(body);
      else if (action === "searchSources") result = await searchSources(body);
      else if (action === "searchImages") result = await searchImages(body);
      else if (action === "fillImages") result = await fillImages(body);
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
