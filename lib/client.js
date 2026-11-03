window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var PANEL_ID = "article-studio";
var RPC = "/dsh-article-studio/rpc";
var STYLE_ID = "dsh-article-studio-style";
var STAGES = [["brief","选题"],["outline","大纲"],["draft","正文"],["images","配图"],["format","排版"],["review","审校"],["publish","发布"]];

var CSS = [
	".ast-page{display:flex;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#faf8f3);color:var(--dsw-alias-label-primary,#171410);font-size:13px}",
	".ast-list{width:280px;flex:none;border-right:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));display:flex;flex-direction:column;min-height:0}",
	".ast-list-head{padding:12px 12px 8px;display:flex;flex-direction:column;gap:8px}",
	".ast-list-title{font-weight:650;font-size:13px}",
	".ast-new{display:flex;gap:6px}",
	".ast-new input{flex:1;min-width:0;padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;font:inherit;outline:none}",
	".ast-new input:focus{border-color:#3b6cf6}",
	".ast-new button{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}",
	".ast-rows{flex:1;overflow:auto;padding:4px 8px 12px;min-height:0}",
	".ast-row{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px}",
	".ast-row:hover{background:rgba(128,128,128,.1)}",
	".ast-row.on{background:rgba(59,108,246,.12)}",
	".ast-row .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-row .m{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;margin-top:2px}",
	".ast-detail{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}",
	".ast-dhead{padding:14px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
	".ast-h1{font-size:17px;margin:0 0 4px;line-height:1.35}",
	".ast-meta{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11.5px;display:flex;gap:10px;flex-wrap:wrap}",
	".ast-rail{display:flex;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:8px;overflow:hidden;background:#fff;margin:12px 18px 0}",
	".ast-rail .cell{flex:1;text-align:center;padding:7px 2px;font-size:11px;color:var(--dsw-alias-label-secondary,#8b8377);border-right:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
	".ast-rail .cell:last-child{border-right:0}",
	".ast-rail .cell.done{color:#1f7a4d;font-weight:600}",
	".ast-rail .cell.doing{color:#b45309;font-weight:600}",
	".ast-rail .cell.blocked{color:#c4402b;font-weight:600}",
	".ast-actions{display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px}",
	".ast-btn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:7px;padding:6px 12px;font:inherit;cursor:pointer}",
	".ast-btn:hover{background:rgba(128,128,128,.08)}",
	".ast-btn.primary{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-btn[disabled]{opacity:.45;cursor:not-allowed}",
	".ast-body{flex:1;min-height:0;padding:0 18px 18px;display:flex;gap:14px}",
	".ast-preview{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:10px;background:#fff;overflow:hidden}",
	".ast-preview iframe{width:100%;height:100%;border:0;background:#fff}",
	".ast-side{width:300px;flex:none;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:auto}",
	".ast-card{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:10px;background:#fff;padding:10px 12px}",
	".ast-card h4{margin:0 0 6px;font-size:12px;font-weight:650}",
	".ast-card p{margin:0;color:var(--dsw-alias-label-secondary,#8b8377);font-size:11.5px;line-height:1.6}",
	".ast-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary,#8b8377);font-size:13px}",
	".ast-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(20,20,20,.9);color:#fff;padding:7px 12px;border-radius:999px;font-size:12px;z-index:9999;pointer-events:none}"
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

function labelOf(key) {
	for (var i = 0; i < STAGES.length; i += 1) if (STAGES[i][0] === key) return STAGES[i][1];
	return key;
}

function stageOf(article) {
	for (var i = 0; i < STAGES.length; i += 1) {
		if (!article.stages || (article.stages[STAGES[i][0]] || {}).status !== "done") return STAGES[i][0];
	}
	return "publish";
}

function PanelIcon(props) {
	var size = (props && props.size) || 18;
	return React.createElement("svg", {
		width: size, height: size, viewBox: "0 0 16 16", fill: "none",
		stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round"
	},
		React.createElement("path", { d: "M4 1.8h5l3 3v9.4H4z" }),
		React.createElement("path", { d: "M9 1.8v3.2h3" }),
		React.createElement("path", { d: "M5.8 5.6h1.8M5.8 8h4.4M5.8 10.4h4.4" })
	);
}

function StudioPage() {
	var listState = React.useState([]);
	var articles = listState[0], setArticles = listState[1];
	var curState = React.useState(null);
	var current = curState[0], setCurrent = curState[1];
	var busyState = React.useState(false);
	var busy = busyState[0], setBusy = busyState[1];
	var msgState = React.useState("");
	var message = msgState[0], setMessage = msgState[1];
	var tickState = React.useState(0);
	var tick = tickState[0], setTick = tickState[1];
	var titleState = React.useState("");
	var newTitle = titleState[0], setNewTitle = titleState[1];

	function notify(text) {
		setMessage(text);
		setTimeout(function () { setMessage(""); }, 2200);
	}

	function refresh() {
		return rpc({ action: "list" }).then(function (result) {
			if (!result || !result.ok) return;
			setArticles(result.articles || []);
			setCurrent(function (prev) {
				if (!prev) return prev;
				var found = (result.articles || []).filter(function (a) { return a.id === prev.id; })[0];
				return found ? Object.assign({}, prev, found) : prev;
			});
		}).catch(function () { /* ignore */ });
	}

	React.useEffect(function () {
		refresh();
		var timer = setInterval(refresh, 5000);
		return function () { clearInterval(timer); };
	}, []);

	function select(article) {
		rpc({ action: "get", id: article.id }).then(function (result) {
			if (result && result.ok) setCurrent(result.article);
			else notify("读取失败：" + ((result && result.error) || ""));
		});
	}

	function act(payload, okText) {
		setBusy(true);
		rpc(payload).then(function (result) {
			notify(result && result.ok ? okText : "失败：" + ((result && result.error) || "未知错误"));
			if (result && result.ok) {
				refresh();
				if (payload.id) select({ id: payload.id });
			}
		}).finally(function () { setBusy(false); });
	}

	function createArticle() {
		var title = newTitle.trim();
		if (!title) { notify("先写个标题"); return; }
		setBusy(true);
		rpc({ action: "create", title: title }).then(function (result) {
			if (result && result.ok) {
				notify("已新建：" + title);
				setNewTitle("");
				refresh();
				select({ id: result.id });
			} else {
				notify("新建失败：" + ((result && result.error) || ""));
			}
		}).finally(function () { setBusy(false); });
	}

	var list = React.createElement("aside", { className: "ast-list" },
		React.createElement("div", { className: "ast-list-head" },
			React.createElement("div", { className: "ast-list-title" }, "文章流水线"),
			React.createElement("div", { className: "ast-new" },
				React.createElement("input", {
					value: newTitle, placeholder: "新文章标题",
					onChange: function (e) { setNewTitle(e.target.value); },
					onKeyDown: function (e) { if (e.key === "Enter") createArticle(); }
				}),
				React.createElement("button", { onClick: createArticle }, "新建")
			)
		),
		React.createElement("div", { className: "ast-rows" },
			articles.length === 0
				? React.createElement("div", { className: "ast-card" },
					React.createElement("p", null, "还没有文章，先在上面新建一篇。"))
				: articles.map(function (article) {
					var stage = stageOf(article);
					return React.createElement("div", {
						key: article.id,
						className: "ast-row" + (current && current.id === article.id ? " on" : ""),
						onClick: function () { select(article); }
					},
						React.createElement("div", { className: "t" }, article.title || article.id),
						React.createElement("div", { className: "m" },
							React.createElement("span", null, labelOf(stage)),
							React.createElement("span", null, String(article.updatedAt || "").replace("T", " "))
						)
					);
				})
		)
	);

	if (!current) {
		return React.createElement("div", { className: "ast-page" }, list,
			React.createElement("div", { className: "ast-empty" }, "左侧选一篇文章，或新建一篇"),
			message ? React.createElement("div", { className: "ast-toast" }, message) : null);
	}

	var stage = stageOf(current);
	var rail = React.createElement("div", { className: "ast-rail" },
		STAGES.map(function (pair) {
			var status = (current.stages && current.stages[pair[0]] || {}).status || "todo";
			return React.createElement("div", {
				key: pair[0], className: "cell " + status,
				title: (current.stages && current.stages[pair[0]] || {}).note || ""
			}, pair[1] + (status === "done" ? " ✓" : ""));
		})
	);

	var detail = React.createElement("section", { className: "ast-detail" },
		React.createElement("div", { className: "ast-dhead" },
			React.createElement("h1", { className: "ast-h1" }, current.title),
			React.createElement("div", { className: "ast-meta" },
				React.createElement("span", null, "当前：" + labelOf(stage)),
				React.createElement("span", null, "主题：" + (current.theme || "newspaper")),
				React.createElement("span", null, "更新：" + String(current.updatedAt || "").replace("T", " "))
			)
		),
		rail,
		React.createElement("div", { className: "ast-actions" },
			React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "format", id: current.id, theme: current.theme }, "排版完成"); } }, "排版"),
			React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "set", id: current.id, stage: "review", status: "done" }, "已通过审校"); } }, "审校通过"),
			React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: true }, "演练完成"); } }, "演练"),
			React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: false }, "已推送草稿箱"); } }, "推送草稿"),
			React.createElement("button", { className: "ast-btn", onClick: function () { setTick(tick + 1); } }, "刷新预览")
		),
		React.createElement("div", { className: "ast-body" },
			React.createElement("div", { className: "ast-preview" },
				React.createElement("iframe", {
					title: "preview",
					src: "/dsh-article-studio/preview/" + encodeURIComponent(current.id) + "?t=" + tick
				})
			),
			React.createElement("div", { className: "ast-side" },
				React.createElement("div", { className: "ast-card" },
					React.createElement("h4", null, "下一步"),
					React.createElement("p", null,
						stage === "draft" ? "正文待完成：在聊天里说「继续写这篇」，或直接改 draft.md。"
						: stage === "format" ? "点「排版」生成校样，然后做审校。"
						: stage === "review" ? "看过校样后点「审校通过」，再推送草稿箱。"
						: stage === "publish" ? "推送草稿箱需要公众号 IP 白名单。"
						: "按阶段推进即可。")
				),
				React.createElement("div", { className: "ast-card" },
					React.createElement("h4", null, "素材"),
					React.createElement("p", null, "配图、官网取材与批量队列在 M3 交付；当前可用：排版、审校、推送草稿。")
				)
			)
		)
	);

	return React.createElement("div", { className: "ast-page" }, list, detail,
		message ? React.createElement("div", { className: "ast-toast" }, message) : null);
}

var inject = ["slots"];
var name = "dsh-article-studio";

function apply(ctx) {
	if (typeof document !== "undefined") ensureStyle(document);

	// Left rail entry (same seat as 盯盘 / 工具管理).
	try {
		ctx.slots.inject("sidebar.panellist", function () {
			return ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 61,
				label: function () { return "文章"; }
			}, PanelIcon);
		});
	} catch (error) { console.warn("[article-studio] panellist failed", error); }

	// Full main-area page keyed by the same id.
	try {
		ctx.slots.inject("main", function () {
			return ctx.slots.register({ name: "main", key: PANEL_ID }, StudioPage);
		});
	} catch (error) { console.warn("[article-studio] main page failed", error); }
}

module.exports = { name: name, inject: inject, apply: apply };
return module.exports;
}});
