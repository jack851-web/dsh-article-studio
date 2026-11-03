window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var TAB_ID = "@local/dsh-article-studio";
var TAB_KIND = "article-studio";
var ADDRESS = "dsh-resource://article-studio/home";
var RPC = "/dsh-article-studio/rpc";
var STYLE_ID = "dsh-article-studio-style";
var STAGES = [["brief","选题"],["outline","大纲"],["draft","正文"],["images","配图"],["format","排版"],["review","审校"],["publish","发布"]];

var CSS = [
	".ast-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#faf8f3);color:var(--dsw-alias-label-primary,#171410);font-size:12.5px}",
	".ast-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
	".ast-title{font-weight:650}",
	".ast-head button{margin-left:auto;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:transparent;color:inherit;border-radius:6px;padding:3px 9px;font:inherit;cursor:pointer}",
	".ast-body{flex:1;overflow:auto;min-height:0;padding:8px 10px}",
	".ast-row{padding:9px 10px;border-radius:8px;cursor:pointer;display:flex;gap:8px;align-items:center}",
	".ast-row:hover{background:rgba(128,128,128,.1)}",
	".ast-row .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-row .m{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;margin-top:2px}",
	".ast-pill{flex:none;padding:2px 8px;border-radius:999px;font-size:10.5px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));color:var(--dsw-alias-label-secondary,#8b8377)}",
	".ast-pill.doing{color:#b45309;border-color:#e7c9a8}",
	".ast-pill.done{color:#1f7a4d;border-color:#bcdcc9}",
	".ast-back{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#8b8377);font:inherit;cursor:pointer;padding:2px 0;margin-bottom:6px}",
	".ast-h1{font-size:15px;margin:0 0 4px;line-height:1.35}",
	".ast-meta{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}",
	".ast-rail{display:flex;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:7px;overflow:hidden;background:#fff;margin-bottom:10px}",
	".ast-rail .cell{flex:1;text-align:center;padding:5px 2px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#8b8377);border-right:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
	".ast-rail .cell:last-child{border-right:0}",
	".ast-rail .cell.done{color:#1f7a4d;font-weight:600}",
	".ast-rail .cell.doing{color:#b45309;font-weight:600}",
	".ast-rail .cell.blocked{color:#c4402b;font-weight:600}",
	".ast-actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}",
	".ast-btn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:#fff;color:inherit;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}",
	".ast-btn:hover{background:rgba(128,128,128,.08)}",
	".ast-btn.primary{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-btn[disabled]{opacity:.45;cursor:not-allowed}",
	".ast-frame{width:100%;height:420px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:8px;background:#fff}",
	".ast-empty{padding:30px 12px;text-align:center;color:var(--dsw-alias-label-secondary,#8b8377)}",
	".ast-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:rgba(20,20,20,.9);color:#fff;padding:7px 12px;border-radius:999px;font-size:12px;z-index:9999;pointer-events:none}",
	".ast-launch{position:fixed;right:16px;bottom:78px;z-index:40;border:1px solid rgba(128,128,128,.35);background:rgba(255,255,255,.95);color:#171410;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.16)}"
].join("\n");

function ensureStyle(doc) {
	if (!doc) return;
	var tag = doc.getElementById(STYLE_ID);
	if (!tag) { tag = doc.createElement("style"); tag.id = STYLE_ID; doc.head.appendChild(tag); }
	if (tag.textContent !== CSS) tag.textContent = CSS;
}

function rpc(payload) {
	return fetch(RPC, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload)
	}).then(function (res) { return res.json().catch(function () { return { ok: false, error: "bad response" }; }); });
}

function stageLabel(key) {
	for (var i = 0; i < STAGES.length; i += 1) if (STAGES[i][0] === key) return STAGES[i][1];
	return key;
}

function currentStage(article) {
	for (var i = 0; i < STAGES.length; i += 1) {
		if (!article.stages || (article.stages[STAGES[i][0]] || {}).status !== "done") return STAGES[i][0];
	}
	return "publish";
}

function StudioTab() {
	var listState = React.useState([]);
	var articles = listState[0], setArticles = listState[1];
	var curState = React.useState(null);
	var current = curState[0], setCurrent = curState[1];
	var busyState = React.useState(false);
	var busy = busyState[0], setBusy = busyState[1];
	var toastState = React.useState("");
	var message = toastState[0], setMessage = toastState[1];
	var frameState = React.useState(0);
	var frameTick = frameState[0], setFrameTick = frameState[1];

	function refresh() {
		return rpc({ action: "list" }).then(function (result) {
			if (result && result.ok) setArticles(result.articles || []);
		}).catch(function () { /* ignore */ });
	}

	React.useEffect(function () {
		refresh();
		var timer = setInterval(refresh, 5000);
		return function () { clearInterval(timer); };
	}, []);

	function notify(text) {
		setMessage(text);
		setTimeout(function () { setMessage(""); }, 1800);
	}

	function act(payload, okText) {
		setBusy(true);
		return rpc(payload).then(function (result) {
			notify(result && result.ok ? okText : "失败：" + ((result && result.error) || "未知错误"));
			if (result && result.ok) { refresh(); if (current) setCurrent(Object.assign({}, current, { stages: current.stages })); }
			return result;
		}).finally(function () { setBusy(false); });
	}

	function open(article) {
		rpc({ action: "get", id: article.id }).then(function (result) {
			if (result && result.ok) setCurrent(result.article);
		});
	}

	function openInDemo() {
		window.open(ADDRESS, "_self");
	}

	if (current) {
		var stage = currentStage(current);
		var rail = React.createElement("div", { className: "ast-rail" },
			STAGES.map(function (pair) {
				var status = (current.stages[pair[0]] || {}).status || "todo";
				return React.createElement("div", { key: pair[0], className: "cell " + status, title: (current.stages[pair[0]] || {}).note || "" }, pair[1]);
			})
		);
		var previewUrl = "/dsh-article-studio/preview/" + encodeURIComponent(current.id) + "?t=" + frameTick;
		return React.createElement("div", { className: "ast-root" },
			React.createElement("div", { className: "ast-head" },
				React.createElement("button", { className: "ast-back", onClick: function () { setCurrent(null); } }, "‹ 全部文章"),
				React.createElement("span", { className: "ast-title" }, "文章流水线")
			),
			React.createElement("div", { className: "ast-body" },
				React.createElement("h1", { className: "ast-h1" }, current.title),
				React.createElement("div", { className: "ast-meta" },
					React.createElement("span", null, "当前：" + stageLabel(stage)),
					React.createElement("span", null, "主题：" + (current.theme || "newspaper")),
					React.createElement("span", null, "更新：" + String(current.updatedAt || "").replace("T", " "))
				),
				rail,
				React.createElement("div", { className: "ast-actions" },
					React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "format", id: current.id, theme: current.theme }, "排版完成").then(function () { setFrameTick(frameTick + 1); }); } }, "排版"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "set", id: current.id, stage: "review", status: "done" }, "已通过审校"); } }, "审校通过"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: true }, "演练完成"); } }, "演练"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: false }, "已推送草稿箱"); } }, "推送草稿"),
					React.createElement("button", { className: "ast-btn", onClick: function () { setFrameTick(frameTick + 1); } }, "刷新预览")
				),
				React.createElement("iframe", { className: "ast-frame", src: previewUrl, title: "preview" }),
				message ? React.createElement("div", { className: "ast-toast" }, message) : null
			)
		);
	}

	return React.createElement("div", { className: "ast-root" },
		React.createElement("div", { className: "ast-head" },
			React.createElement("span", { className: "ast-title" }, "文章流水线"),
			React.createElement("button", { onClick: refresh }, "刷新")
		),
		React.createElement("div", { className: "ast-body" },
			articles.length === 0
				? React.createElement("div", { className: "ast-empty" }, "还没有文章。在聊天里说「新建一篇关于 XX 的文章」即可开始。")
				: articles.map(function (article) {
					var stage = currentStage(article);
					var status = (article.stages && article.stages[stage] || {}).status || "todo";
					return React.createElement("div", { key: article.id, className: "ast-row", onClick: function () { open(article); } },
						React.createElement("div", { style: { flex: 1, minWidth: 0 } },
							React.createElement("div", { className: "t" }, article.title || article.id),
							React.createElement("div", { className: "m" },
								React.createElement("span", null, stageLabel(stage)),
								React.createElement("span", null, String(article.updatedAt || "").replace("T", " "))
							)
						),
						React.createElement("span", { className: "ast-pill " + status }, status === "done" ? "完成" : status === "doing" ? "进行中" : "待办")
					);
				})
		),
		message ? React.createElement("div", { className: "ast-toast" }, message) : null
	);
}

var inject = ["slots"];
var name = "dsh-article-studio";

function apply(ctx) {
	if (typeof document !== "undefined") ensureStyle(document);

	// Tab type + keyed body. Wrapped so an API mismatch degrades instead of
	// failing the whole web boot.
	try {
		ctx.effect(function () {
			return ctx.sidebarRightTabs.register({
				id: TAB_ID,
				kind: TAB_KIND,
				multiple: false,
				priority: "builtin",
				patterns: ["dsh-resource://article-studio/**"],
				canOpen: function (address) { return String(address).indexOf("dsh-resource://article-studio/") === 0; },
				title: function () { return "文章流水线"; }
			});
		}, "dsh-article-studio: tab type");
	} catch (error) { console.warn("[article-studio] tab type failed", error); }

	try {
		ctx.effect(function () {
			return ctx.slots.inject("sidebar.right.pane.tab", function () {
				return ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, StudioTab);
			});
		}, "dsh-article-studio: tab body");
	} catch (error) { console.warn("[article-studio] tab body failed", error); }

	// Floating launcher: the only way to open the tab without a command seat.
	try {
		function Launcher() {
			return React.createElement("button", {
				className: "ast-launch",
				title: "打开文章流水线",
				onClick: function () {
					try { ctx.sidebarRight.openResource(ADDRESS); } catch (error) { console.warn("[article-studio] open failed", error); }
				}
			}, "文章");
		}
		ctx.effect(function () {
			return ctx.slots.inject("shell.overlay", function () {
				return ctx.slots.register({ name: "shell.overlay", id: "article-studio-launcher" }, Launcher);
			});
		}, "dsh-article-studio: launcher");
	} catch (error) { console.warn("[article-studio] launcher failed", error); }
}

module.exports = { name: name, inject: inject, apply: apply };
return module.exports;
}});
