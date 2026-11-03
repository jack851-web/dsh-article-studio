window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var PANEL_ID = "article-studio";
var TAB_ID = "@local/dsh-article-studio/tab";
var TAB_KIND = "article-studio";
var RPC = "/dsh-article-studio/rpc";
var STYLE_ID = "dsh-article-studio-style";
var STAGES = [["brief","选题"],["outline","大纲"],["draft","正文"],["images","配图"],["format","排版"],["review","审校"],["publish","发布"]];

var hostCtx = null;
var layoutRef = null;
var sidebarRightRef = null;
var tabsRef = null;

var CSS = [
	".ast-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#faf8f3);color:var(--dsw-alias-label-primary,#171410);font-size:12.5px}",
	".ast-head{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
	".ast-head .t{font-weight:650}",
	".ast-head button{margin-left:auto;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;border-radius:6px;padding:3px 9px;font:inherit;cursor:pointer}",
	".ast-body{flex:1;min-height:0;overflow:auto;padding:8px 10px}",
	".ast-row{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px}",
	".ast-row:hover{background:rgba(128,128,128,.1)}",
	".ast-row .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-row .m{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;margin-top:2px}",
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
	".ast-btn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}",
	".ast-btn:hover{background:rgba(128,128,128,.08)}",
	".ast-btn.primary{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-btn[disabled]{opacity:.45;cursor:not-allowed}",
	".ast-frame{width:100%;height:380px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:8px;background:#fff}",
	".ast-empty{padding:30px 12px;text-align:center;color:var(--dsw-alias-label-secondary,#8b8377)}",
	".ast-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:rgba(20,20,20,.9);color:#fff;padding:7px 12px;border-radius:999px;font-size:12px;z-index:9999;pointer-events:none}"
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

/** Absolute-address entry file, used when the page-kind tab cannot open. */
var ENTRY_FILE = "D:/others/numtick/文章流水线.astudio";
var ENTRY_ADDRESS = "dsh-resource://file/absolute/" + ENTRY_FILE.split("/").map(function (segment) {
	return encodeURIComponent(segment).replace(/%3A/gi, ":");
}).join("/");

/** Opens (or focuses) the studio tab in the right sidebar. */
function openSidebar() {
	if (!sidebarRightRef) return { ok: false, error: "sidebarRight 未注入" };
	try {
		sidebarRightRef.openTab(TAB_KIND, {});
		probe("OK");
		return { ok: true, error: "" };
	} catch (error) {
		var tabError = String((error && error.message) || error);
		try {
			sidebarRightRef.openResource(ENTRY_ADDRESS);
			probe("OK via document");
			return { ok: true, error: "" };
		} catch (fallbackError) {
			var message = tabError + " / " + String((fallbackError && fallbackError.message) || fallbackError);
			probe("ERR " + message.slice(0, 120));
			return { ok: false, error: message };
		}
	}
}

/** Scratch channel for headless diagnosis: the window title is readable via UI Automation. */
function probe(text) {
	try { if (typeof document !== "undefined") document.title = "AST " + text; } catch (error) { /* ignore */ }
}

/** The studio panel, one column wide. */
function StudioPanel() {
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
	var errState = React.useState("");
	var rpcError = errState[0], setRpcError = errState[1];

	function notify(text) {
		setMessage(text);
		setTimeout(function () { setMessage(""); }, 2000);
	}

	function refresh() {
		return rpc({ action: "list" }).then(function (result) {
			if (!result || !result.ok) {
				setRpcError("接口错误：" + ((result && result.error) || "无响应"));
				return;
			}
			setRpcError("");
			setArticles(result.articles || []);
			setCurrent(function (prev) {
				if (!prev) return prev;
				var found = (result.articles || []).filter(function (a) { return a.id === prev.id; })[0];
				return found ? Object.assign({}, prev, found) : prev;
			});
		}).catch(function (error) {
			setRpcError("连接失败：" + String((error && error.message) || error));
		});
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
			if (result && result.ok && payload.id) select({ id: payload.id });
		}).finally(function () { setBusy(false); });
	}

	if (!current) {
		return React.createElement("div", { className: "ast-root" },
			React.createElement("div", { className: "ast-head" },
				React.createElement("span", { className: "t" }, "文章流水线"),
				React.createElement("button", { onClick: refresh }, "刷新")
			),
			React.createElement("div", { className: "ast-body" },
				articles.length === 0
					? React.createElement("div", { className: "ast-empty" },
						rpcError ? React.createElement("div", null, rpcError)
							: "还没有文章。在聊天里说「新建一篇关于 XX 的文章」，或直接在 studio 目录下建一篇。")
					: articles.map(function (article) {
						var stage = stageOf(article);
						return React.createElement("div", {
							key: article.id, className: "ast-row",
							onClick: function () { select(article); }
						},
							React.createElement("div", { className: "t" }, article.title || article.id),
							React.createElement("div", { className: "m" },
								React.createElement("span", null, labelOf(stage)),
								React.createElement("span", null, String(article.updatedAt || "").replace("T", " "))
							)
						);
					})
			),
			message ? React.createElement("div", { className: "ast-toast" }, message) : null
		);
	}

	var stage = stageOf(current);
	var rail = React.createElement("div", { className: "ast-rail" },
		STAGES.map(function (pair) {
			var status = (current.stages && current.stages[pair[0]] || {}).status || "todo";
			return React.createElement("div", {
				key: pair[0], className: "cell " + status,
				title: (current.stages && current.stages[pair[0]] || {}).note || ""
			}, pair[1]);
		})
	);

	return React.createElement("div", { className: "ast-root" },
		React.createElement("div", { className: "ast-head" },
			React.createElement("button", { className: "ast-back", onClick: function () { setCurrent(null); } }, "‹ 全部"),
			React.createElement("span", { className: "t" }, "文章流水线")
		),
		React.createElement("div", { className: "ast-body" },
			React.createElement("h1", { className: "ast-h1" }, current.title),
			React.createElement("div", { className: "ast-meta" },
				React.createElement("span", null, "当前：" + labelOf(stage)),
				React.createElement("span", null, "主题：" + (current.theme || "newspaper"))
			),
			rail,
			React.createElement("div", { className: "ast-actions" },
				React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "format", id: current.id, theme: current.theme }, "排版完成"); } }, "排版"),
				React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "set", id: current.id, stage: "review", status: "done" }, "已通过审校"); } }, "审校通过"),
				React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: true }, "演练完成"); } }, "演练"),
				React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: false }, "已推送草稿箱"); } }, "推送草稿"),
				React.createElement("button", { className: "ast-btn", onClick: function () { setTick(tick + 1); } }, "刷新")
			),
			React.createElement("iframe", {
				className: "ast-frame",
				title: "preview",
				src: "/dsh-article-studio/preview/" + encodeURIComponent(current.id) + "?t=" + tick
			})
		),
		message ? React.createElement("div", { className: "ast-toast" }, message) : null
	);
}

/**
 * Selecting a rail entry swaps the center panel by design. This bounce opens
 * the studio in the right sidebar and selects the conversation again, so the
 * chat never actually goes away.
 */
function RedirectToSidebar() {
	var stateRef = React.useState("");
	var note = stateRef[0], setNote = stateRef[1];

	React.useEffect(function () {
		// DSH renders MainPanel as `activePanelId ?? "conversation"`, so handing
		// the centre column back means selecting null. The sidebar's on-screen
		// Session only exists while the conversation owns the centre column, so
		// the tab has to open after that hand-back, not before it.
		var layout = layoutRef;
		if (!layout && hostCtx && typeof hostCtx.get === "function") {
			try { layout = hostCtx.get("layout"); } catch (error) { layout = null; }
		}
		if (!layout || typeof layout.selectPanel !== "function") {
			setNote("未找到 layout 服务，无法切回对话");
			return;
		}
		try { layout.selectPanel(null); } catch (error) {
			setNote("切回对话失败：" + String((error && error.message) || error));
			return;
		}

		var attempts = 0;
		function attemptOpen() {
			attempts += 1;
			var result = openSidebar();
			if (result.ok) return;
			if (attempts < 3) { setTimeout(attemptOpen, 250); return; }
			setNote("右侧栏未打开：" + result.error);
		}
		setTimeout(attemptOpen, 80);
	}, []);

	return note
		? React.createElement("div", {
			style: { padding: "18px", color: "#c4402b", fontSize: 12, textAlign: "center" }
		}, note)
		: null;
}

var inject = ["slots"];
var name = "dsh-article-studio";

function apply(ctx) {
	hostCtx = ctx;
	if (typeof document !== "undefined") ensureStyle(document);

	ctx.inject(["layout"], function (scoped) { layoutRef = scoped.layout; });
	ctx.inject(["sidebarRight"], function (scoped) { sidebarRightRef = scoped.sidebarRight; });

	// Custom right-sidebar tab type plus its body.
	ctx.inject(["sidebarRightTabs"], function (scoped) {
		tabsRef = scoped.sidebarRightTabs;
		try {
			scoped.effect(function () {
				return scoped.sidebarRightTabs.register({
					id: TAB_ID,
					kind: TAB_KIND,
					title: function () { return "文章流水线"; }
				});
			}, "dsh-article-studio: tab type");
		} catch (error) { console.warn("[article-studio] tab type failed", error); }
	});

	try {
		ctx.effect(function () {
			return ctx.slots.inject("sidebar.right.pane.tab", function () {
				return ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, StudioPanel);
			});
		}, "dsh-article-studio: tab body");
	} catch (error) { console.warn("[article-studio] tab body failed", error); }

	// The proven sidebar path in this build: a document tab, same as PDF.
	try {
		ctx.inject(["documentPreviews"], function (scoped) {
			scoped.effect(function () {
				return scoped.documentPreviews.register({
					id: "dsh-article-studio/document",
					extensions: ["astudio"],
					binaryExtensions: [],
					priority: "external",
					title: function () { return "文章流水线"; },
					loading: "bytes-complete",
					wrap: false
				});
			}, "dsh-article-studio: document type");
			scoped.effect(function () {
				return scoped.slots.inject("sidebar.right.tab.document", function () {
					return scoped.slots.register({ name: "sidebar.right.tab.document", key: "dsh-article-studio/document" }, StudioPanel);
				});
			}, "dsh-article-studio: document body");
		});
	} catch (error) { console.warn("[article-studio] document tab failed", error); }

	ctx.inject(["slots"], function (slotScope) {
		// Left-rail entry.
		try {
			slotScope.slots.inject("sidebar.panellist", function () {
				return slotScope.slots.register({
					name: "sidebar.panellist",
					id: PANEL_ID,
					order: 61,
					label: function () { return "文章"; }
				}, function (props) {
					var size = (props && props.size) || 18;
					return React.createElement("svg", {
						width: size, height: size, viewBox: "0 0 16 16", fill: "none",
						stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round"
					},
						React.createElement("path", { d: "M8 1.6l1.7 4.0 4.0 1.7-4.0 1.7L8 13.4l-1.7-4.4L2.3 7.3l4.0-1.7z" }),
						React.createElement("path", { d: "M12.6 11.4l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" })
					);
				});
			});
		} catch (error) { console.warn("[article-studio] panellist failed", error); }

		// DSH's MainPanel renders `activePanelId ?? "conversation"`. Registering a
		// bounce here means the rail click immediately hands the centre column
		// back to the conversation and the studio opens on the right instead.
		try {
			slotScope.slots.inject("main", function () {
				return slotScope.slots.register({ name: "main", key: PANEL_ID }, RedirectToSidebar);
			});
		} catch (error) { console.warn("[article-studio] main page failed", error); }

		// A "文章" action in the right sidebar's Files tab.
		try {
			slotScope.slots.inject("sidebar.right.tab.files.actions", function () {
				return slotScope.slots.register({
					name: "sidebar.right.tab.files.actions",
					id: "article-studio-open"
				}, function () {
					return React.createElement("button", {
						style: {
							border: "1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14))",
							background: "transparent", color: "inherit", borderRadius: 6,
							padding: "3px 9px", font: "inherit", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap"
						},
						title: "在侧栏打开文章流水线",
						onClick: openSidebar
					}, "文章");
				});
			});
		} catch (error) { console.warn("[article-studio] files action failed", error); }
	});
}

module.exports = { name: name, inject: inject, apply: apply };
return module.exports;
}});
