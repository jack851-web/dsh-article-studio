#!/usr/bin/env python3
"""公众号排版推送服务

给画廊模式加「推送到公众号」按钮：浏览器选主题 → 点推送 → 后端串接 format.py + publish.py
用法: python3 server.py --dir <文章输出目录> [--port 8765]
"""
import argparse
import base64
import http.server
import json
import re
import socketserver
import subprocess
import sys
import webbrowser
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
with open(SKILL_DIR / "config.json", encoding="utf-8") as f:
    CONFIG = json.load(f)

DEFAULT_PORT = 8765

# ── 注入到 gallery.html 的 JS ──
INJECT_JS = r"""
<script>
(function() {
    if (window.__publishInjected) return;
    window.__publishInjected = true;

    // ── 推送到公众号按钮 ──
    var toolbarRight = document.querySelector('.toolbar-right') || (function() {
        var tb = document.querySelector('.toolbar');
        var d = document.createElement('div');
        d.className = 'toolbar-right';
        tb.appendChild(d);
        return d;
    })();

    var btn = document.createElement('button');
    btn.id = 'publishBtn';
    btn.textContent = '推送到公众号';
    btn.style.cssText = 'padding:8px 16px;background:#07c160;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-left:8px;';
    btn.onclick = openModal;

    var status = document.createElement('span');
    status.id = 'publishStatus';
    status.style.cssText = 'font-size:13px;color:#86868b;margin-left:8px;';

    toolbarRight.appendChild(btn);
    toolbarRight.appendChild(status);

    // 加载状态
        status.textContent = '加载中...';
        fetch('/api/state', { signal: AbortSignal.timeout(10000) }).then(function(r) { return r.json(); }).then(function(s) {
            status.textContent = s.title ? ('文章: ' + s.title + (s.has_article ? ' (已渲染)' : ' (待渲染)')) : '未检测到文章';
        }).catch(function(e) {
            status.textContent = '✗ 状态加载失败: ' + e.message + '（请确认 server 还在跑）';
        });

    function openModal() {
        if (document.getElementById('publishModal')) return;
        var overlay = document.createElement('div');
        overlay.id = 'publishModal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
        overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:92%;">' +
            '<h2 style="margin:0 0 16px;font-size:18px;">推送到公众号草稿箱</h2>' +
            '<div style="margin-bottom:14px;"><label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">当前主题</label>' +
            '<div id="mTheme" style="font-size:15px;font-weight:600;">加载中...</div></div>' +
            '<div style="margin-bottom:14px;"><label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">封面图</label>' +
            '<select id="mCover" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;"></select>' +
            '<div style="margin-top:6px;font-size:12px;color:#999;">或上传本地图片：<input type="file" id="mUpload" accept="image/*" style="font-size:12px;"></div></div>' +
            '<div id="mResult" style="margin-bottom:12px;display:none;padding:10px;border-radius:4px;font-size:13px;line-height:1.6;"></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
            '<button id="mCancel" style="padding:8px 16px;background:#f0f0f0;border:none;border-radius:4px;cursor:pointer;font-size:14px;">取消</button>' +
            '<button id="mConfirm" style="padding:8px 16px;background:#07c160;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;">确认推送</button></div></div>';
        document.body.appendChild(overlay);
        document.getElementById('mCancel').onclick = function() { overlay.remove(); };
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        fetch('/api/state', { signal: AbortSignal.timeout(10000) }).then(function(r) { return r.json(); }).then(function(s) {
            // 优先用画廊里用户实际选中的主题
            var theme = (typeof window.selectedTheme !== 'undefined' && window.selectedTheme) || s.active_theme;
            document.getElementById('mTheme').textContent = theme;
            var sel = document.getElementById('mCover');
            sel.innerHTML = '';
            (s.covers || []).forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.path;
                opt.textContent = c.name + ' (' + c.size + ')' + (c.is_default ? ' ★' : '');
                if (c.is_default) opt.selected = true;
                sel.appendChild(opt);
            });
            if (sel.options.length === 0) {
                sel.innerHTML = '<option value="">（无封面，请先上传）</option>';
            }
        }).catch(function(e) {
            document.getElementById('mTheme').textContent = '加载失败';
            var sel = document.getElementById('mCover');
            sel.innerHTML = '<option value="">加载失败: ' + e.message + '</option>';
        });

        document.getElementById('mUpload').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function() {
                fetch('/api/upload-cover', { method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: file.name, data: reader.result }) }).then(function(r) { return r.json(); }).then(function(d) {
                    if (d.error) { alert('上传失败: ' + d.error); return; }
                    var sel = document.getElementById('mCover');
                    var opt = document.createElement('option');
                    opt.value = d.path; opt.textContent = d.name + ' (' + d.size + ' ★刚上传)'; opt.selected = true;
                    sel.insertBefore(opt, sel.firstChild);
                });
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('mConfirm').onclick = function() {
            var confirmBtn = this;
            confirmBtn.disabled = true; confirmBtn.textContent = '推送中...';
            var sel = document.getElementById('mCover');
            // 实时读 window.selectedTheme（用户可能在模态框打开后切了主题）
            var theme = (typeof window.selectedTheme !== 'undefined' && window.selectedTheme) || (document.getElementById('mTheme').textContent || 'newspaper');
            // 同步显示
            document.getElementById('mTheme').textContent = theme;
            var cover = sel.value;
            var result = document.getElementById('mResult');
            result.style.display = 'block';
            result.style.background = '#f0f9f0';
            result.style.color = '#666';
            result.textContent = '正在上传图片并推送（约 10-30 秒）...';
            fetch('/api/publish', { method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ theme: theme, cover: cover }) }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.error) {
                    result.style.background = '#fee'; result.style.color = '#c00';
                    result.innerHTML = '✗ 错误: ' + d.error;
                    confirmBtn.disabled = false; confirmBtn.textContent = '确认推送';
                } else {
                    result.style.background = '#efe'; result.style.color = '#060';
                    result.innerHTML = '✓ 推送成功！<br>草稿 media_id: <code style="font-size:11px;background:#f0f0f0;padding:2px 4px;border-radius:3px;">' + d.media_id + '</code><br>去公众号后台 → 草稿箱 查看和发布。';
                    confirmBtn.textContent = '完成';
                }
            }).catch(function(e) {
                result.style.background = '#fee'; result.style.color = '#c00';
                result.textContent = '✗ 网络错误: ' + e.message;
                confirmBtn.disabled = false; confirmBtn.textContent = '确认推送';
            });
        };
    }
})();
</script>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    article_dir: Path = None  # 由 main() 注入
    input_md: Path = None      # 由 main() 注入；推送重排时直接用此源 md，避免误用旧 structured.md

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.article_dir), **kwargs)

    # ── 路由 ──
    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.path = "/gallery.html"
            return super().do_GET()
        if self.path == "/api/state":
            return self._send_json(self.get_state())
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/publish":
            return self._handle_publish()
        if self.path == "/api/upload-cover":
            return self._handle_upload_cover()
        return self._send_json({"error": "not found"}, 404)

    # ── /api/state ──
    def get_state(self):
        article_path = self.article_dir / "article.html"
        gallery_path = self.article_dir / "gallery.html"

        title = None
        for p in (article_path, gallery_path):
            if p.exists():
                m = re.search(r"<h1[^>]*>(.*?)</h1>", p.read_text(encoding="utf-8"), re.DOTALL)
                if m:
                    title = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                    break

        active_theme = CONFIG["settings"]["default_theme"]
        if gallery_path.exists():
            m = re.search(r"var selectedTheme = '([^']+)'", gallery_path.read_text(encoding="utf-8"))
            if m:
                active_theme = m.group(1)

        covers = []
        # 顶层 cover-* 文件优先
        for f in sorted(self.article_dir.iterdir()):
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".gif") and f.name.lower().startswith("cover"):
                covers.append({"name": f.name, "path": f.name,
                               "size": f"{f.stat().st_size // 1024}KB", "is_default": True})
        # images/ 下
        image_dir = self.article_dir / "images"
        if image_dir.exists():
            for f in sorted(image_dir.iterdir()):
                if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".gif"):
                    covers.append({"name": f.name, "path": f"images/{f.name}",
                                   "size": f"{f.stat().st_size // 1024}KB", "is_default": False})

        return {
            "title": title,
            "article_dir": str(self.article_dir),
            "active_theme": active_theme,
            "has_article": article_path.exists(),
            "has_gallery": gallery_path.exists(),
            "covers": covers,
        }

    # ── /api/publish ──
    def _handle_publish(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            params = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception as e:
            return self._send_json({"error": f"请求解析失败: {e}"}, 400)

        theme = params.get("theme") or CONFIG["settings"]["default_theme"]
        cover = params.get("cover", "")

        md_path = self.input_md if self.input_md and self.input_md.exists() else self._find_input_md()
        if not md_path:
            return self._send_json({"error": "未找到输入 Markdown 文件，无法重排版"}, 400)

        # 1) 重排版
        r = subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "format.py"),
             "--input", str(md_path), "--theme", theme, "--no-open"],
            capture_output=True, text=True, timeout=180,
        )
        if r.returncode != 0:
            return self._send_json({"error": f"format.py 失败: {r.stderr.strip()[:500]}"}, 500)

        # 2) 推送
        cmd = [sys.executable, str(SCRIPT_DIR / "publish.py"),
               "--dir", str(self.article_dir), "--yes"]
        if cover:
            cover_path = self.article_dir / cover
            if cover_path.exists():
                cmd.extend(["--cover", str(cover_path)])

        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            return self._send_json({"error": "publish.py 超时（300s）"}, 500)

        output = r.stdout + r.stderr
        m = re.search(r"草稿 media_id:\s*(\S+)", output)
        if m:
            return self._send_json({"media_id": m.group(1)})

        m = re.search(r"(错误[：:].*?)$", output, re.MULTILINE)
        err = m.group(1) if m else output.strip()[-500:]
        return self._send_json({"error": err}, 500)

    # ── /api/upload-cover ──
    def _handle_upload_cover(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception as e:
            return self._send_json({"error": f"请求解析失败: {e}"}, 400)

        b64 = data.get("data", "")
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        try:
            raw = base64.b64decode(b64)
        except Exception as e:
            return self._send_json({"error": f"base64 解析失败: {e}"}, 400)

        ext = Path(data.get("name", "cover.jpg")).suffix.lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".gif"):
            return self._send_json({"error": "仅支持 jpg/png/gif"}, 400)
        if len(raw) > 20 * 1024 * 1024:
            return self._send_json({"error": "文件超过 20MB"}, 400)

        name = f"cover-uploaded{ext}"
        save_path = self.article_dir / name
        save_path.write_bytes(raw)
        return self._send_json({
            "name": name, "path": name,
            "size": f"{len(raw) // 1024}KB",
        })

    def _find_input_md(self):
        # 优先：article_dir 同名的 .md（去 -structured 后缀）
        stem = re.sub(r"-(公众号|小红书|微博)$", "", self.article_dir.name)
        candidates = [
            self.article_dir.parent / f"{stem}.md",
            self.article_dir.parent / f"{stem}-structured.md",
            self.article_dir / "article.md",
        ]
        for c in candidates:
            if c.exists() and c.suffix == ".md":
                return c
        # fallback: 父目录下最新 .md
        mds = sorted(self.article_dir.parent.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True)
        return mds[0] if mds else None

    def _send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[server] {self.address_string()} - {fmt % args}\n")


def inject_to_gallery(article_dir: Path):
    """在 gallery.html 的 </body> 前注入推送按钮 JS"""
    gallery = article_dir / "gallery.html"
    if not gallery.exists():
        return
    text = gallery.read_text(encoding="utf-8")
    if "__publishInjected" in text:
        return
    if "</body>" not in text:
        return
    text = text.replace("</body>", INJECT_JS + "\n</body>")
    gallery.write_text(text, encoding="utf-8")
    print(f"[inject] 已在 {gallery.name} 注入推送按钮")


def main():
    parser = argparse.ArgumentParser(description="公众号排版推送服务（HTTP）")
    parser.add_argument("--dir", "-d", required=True, help="format.py 输出的文章目录")
    parser.add_argument("--input", "-i", help="源 Markdown 路径（推送时直接重排此文件，避免误用旧 structured.md）")
    parser.add_argument("--port", "-p", type=int, default=DEFAULT_PORT, help=f"端口（默认 {DEFAULT_PORT}）")
    parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    article_dir = Path(args.dir).resolve()
    if not article_dir.exists():
        print(f"错误: 目录不存在 - {article_dir}")
        sys.exit(1)
    if not (article_dir / "gallery.html").exists():
        print(f"警告: {article_dir} 下没有 gallery.html，请先用 --gallery 模式跑过 format.py")

    input_md = Path(args.input).resolve() if args.input else None
    if input_md and not input_md.exists():
        print(f"警告: --input 指定的源 md 不存在 - {input_md}，回退到自动查找")
        input_md = None

    inject_to_gallery(article_dir)
    Handler.article_dir = article_dir
    Handler.input_md = input_md

    url = f"http://localhost:{args.port}"
    print(f"服务已启动: {url}")
    print(f"服务目录: {article_dir}")
    print("按 Ctrl+C 停止")

    socketserver.TCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), Handler) as httpd:
        if not args.no_open:
            try:
                webbrowser.open(url)
            except Exception:
                pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")


if __name__ == "__main__":
    main()
