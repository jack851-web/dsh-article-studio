window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var PANEL_ID = "article-studio";
var TAB_ID = "@local/dsh-article-studio/tab";
var TAB_KIND = "article-studio";
var RPC = "/dsh-article-studio/rpc";
var STYLE_ID = "dsh-article-studio-style";
var THEMES = ["newspaper","bytedance","zen-minimal","washi-red","wechat-native","minimal"];
var DEFAULT_ROOT = "D:\\others\\article\\studio";

var hostCtx = null;
var layoutRef = null;
var sidebarRightRef = null;

var CSS = [
	".ast-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#faf8f3);color:var(--dsw-alias-label-primary,#171410);font-size:12.5px}",
	".ast-head{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
	".ast-head .t{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-head .sp{flex:1}",
	".ast-head button{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;border-radius:6px;padding:3px 9px;font:inherit;cursor:pointer}",
	".ast-back{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#8b8377);font:inherit;cursor:pointer;padding:2px 0}",
	".ast-body{flex:1;min-height:0;overflow:auto;padding:8px 10px}",
	".ast-new{display:flex;gap:6px;padding:4px 10px 10px}",
	".ast-new input{flex:1;min-width:0;padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;font:inherit;outline:none}",
	".ast-row{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px}",
	".ast-row:hover{background:rgba(128,128,128,.1)}",
	".ast-row .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-row .m{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;margin-top:2px}",
	".ast-controls{padding:10px 12px 6px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid rgba(0,0,0,.06)}",
	".ast-chips{display:flex;gap:6px;flex-wrap:wrap}",
	".ast-chip{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:999px;padding:4px 11px;font:inherit;font-size:11px;cursor:pointer}",
	".ast-chip.on{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-actions{display:flex;gap:6px;flex-wrap:wrap}",
	".ast-btn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}",
	".ast-btn:hover{background:rgba(128,128,128,.08)}",
	".ast-btn.primary{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-btn[disabled]{opacity:.45;cursor:not-allowed}",
	".ast-stage{flex:1;min-height:0;display:flex;justify-content:center;padding:10px 12px 12px;background:rgba(128,128,128,.05)}",
	".ast-phone{width:415px;max-width:100%;height:100%;border:1px solid rgba(0,0,0,.12);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.08)}",
	".ast-phone iframe{display:block;width:100%;height:100%;border:0;background:#fff}",
	".ast-empty{padding:30px 12px;text-align:center;color:var(--dsw-alias-label-secondary,#8b8377)}",
	".ast-hint{font-size:11px;color:var(--dsw-alias-label-secondary,#8b8377);line-height:1.6}",
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

var ENTRY_FILE = "D:/others/numtick/文章流水线.astudio";
var ENTRY_ADDRESS = "dsh-resource://file/absolute/" + ENTRY_FILE.split("/").map(function (segment) {
	return encodeURIComponent(segment).replace(/%3A/gi, ":");
}).join("/");

function openSidebar() {
	if (!sidebarRightRef) return { ok: false, error: "sidebarRight 未注入" };
	try {
		sidebarRightRef.openTab(TAB_KIND, {});
		return { ok: true, error: "" };
	} catch (error) {
		var tabError = String((error && error.message) || error);
		try {
			sidebarRightRef.openResource(ENTRY_ADDRESS);
			return { ok: true, error: "" };
		} catch (fallbackError) {
			return { ok: false, error: tabError + " / " + String((fallbackError && fallbackError.message) || fallbackError) };
		}
	}
}

/**
 * The panel is deliberately small: the AI owns outline, prose and images, so
 * the only choices worth a UI here are the layout style, the live proof, and
 * the push.
 */
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
	var newTitleState = React.useState("");
	var newTitle = newTitleState[0], setNewTitle = newTitleState[1];
	var rootState = React.useState(DEFAULT_ROOT);
	var rootPath = rootState[0], setRootPath = rootState[1];

	function notify(text) {
		setMessage(text);
		setTimeout(function () { setMessage(""); }, 2100);
	}

	function refreshList() {
		return rpc({ action: "list" }).then(function (result) {
			if (!result || !result.ok) { setRpcError("接口错误：" + ((result && result.error) || "无响应")); return; }
			setRpcError("");
			setArticles(result.articles || []);
			if (result.root) setRootPath(result.root);
			setCurrent(function (prev) {
				if (!prev) return prev;
				var found = (result.articles || []).filter(function (a) { return a.id === prev.id; })[0];
				return found ? Object.assign({}, prev, found) : prev;
			});
		}).catch(function (error) { setRpcError("连接失败：" + String((error && error.message) || error)); });
	}

	function open(id) {
		return rpc({ action: "get", id: id }).then(function (result) {
			if (!result || !result.ok) { notify("读取失败：" + ((result && result.error) || "")); return; }
			setCurrent(result.article);
		});
	}

	React.useEffect(function () {
		refreshList();
		var timer = setInterval(refreshList, 6000);
		return function () { clearInterval(timer); };
	}, []);

	function act(payload, okText, after) {
		setBusy(true);
		return rpc(payload).then(function (result) {
			notify(result && result.ok ? okText : "失败：" + ((result && result.error) || "未知错误"));
			if (result && result.ok) {
				refreshList();
				if (payload.id) open(payload.id);
				if (after) after();
			}
			return result;
		}).finally(function () { setBusy(false); });
	}

	function applyTheme(name) {
		if (!current) return;
		setBusy(true);
		rpc({ action: "theme", id: current.id, theme: name })
			.then(function (result) {
				if (!result || !result.ok) { notify("切换失败：" + ((result && result.error) || "")); return null; }
				return rpc({ action: "format", id: current.id, theme: name });
			})
			.then(function (result) {
				if (!result) return;
				notify(result.ok ? "已切换风格：" + name : "排版失败：" + ((result && result.error) || ""));
				if (result.ok) { setTick(tick + 1); open(current.id); }
			})
			.finally(function () { setBusy(false); });
	}

	function createArticle() {
		var title = newTitle.trim();
		if (!title) { notify("先写个标题"); return; }
		setBusy(true);
		rpc({ action: "create", title: title }).then(function (result) {
			if (result && result.ok) {
				notify("已新建：" + title);
				setNewTitle("");
				refreshList();
				open(result.id);
			} else notify("新建失败：" + ((result && result.error) || ""));
		}).finally(function () { setBusy(false); });
	}

	if (!current) {
		return React.createElement("div", { className: "ast-root" },
			React.createElement("div", { className: "ast-head" },
				React.createElement("span", { className: "t" }, "文章"),
				React.createElement("span", { className: "sp" }),
				React.createElement("button", { onClick: refreshList }, "刷新")
			),
			React.createElement("div", { className: "ast-new" },
				React.createElement("input", {
					value: newTitle, placeholder: "新文章标题",
					onChange: function (e) { setNewTitle(e.target.value); },
					onKeyDown: function (e) { if (e.key === "Enter") createArticle(); }
				}),
				React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: createArticle }, "新建")
			),
			React.createElement("div", { className: "ast-body" },
				articles.length === 0
					? React.createElement("div", { className: "ast-empty" }, rpcError || "还没有文章，先在上面新建一篇。")
					: articles.map(function (article) {
						return React.createElement("div", { key: article.id, className: "ast-row", onClick: function () { open(article.id); } },
							React.createElement("div", { className: "t" }, article.title || article.id),
							React.createElement("div", { className: "m" },
								React.createElement("span", null, String(article.updatedAt || "").replace("T", " ")),
								React.createElement("span", null, "第 " + (article.draftVersion || 0) + " 稿")
							)
						);
					})
			),
			message ? React.createElement("div", { className: "ast-toast" }, message) : null
		);
	}

	var chips = React.createElement("div", { className: "ast-chips" },
		THEMES.map(function (name) {
			return React.createElement("button", {
				key: name, className: "ast-chip" + (current.theme === name ? " on" : ""), disabled: busy,
				onClick: function () { applyTheme(name); }
			}, name);
		})
	);

	return React.createElement("div", { className: "ast-root" },
		React.createElement("div", { className: "ast-head" },
			React.createElement("button", { className: "ast-back", onClick: function () { setCurrent(null); } }, "‹ 全部"),
			React.createElement("span", { className: "t" }, current.title),
			React.createElement("span", { className: "sp" }),
			React.createElement("button", { onClick: function () { open(current.id); setTick(tick + 1); } }, "刷新")
		),
		React.createElement("div", { className: "ast-controls" },
			chips,
			React.createElement("div", { className: "ast-actions" },
				React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "format", id: current.id, theme: current.theme }, "已更新预览", function () { setTick(tick + 1); }); } }, "应用排版"),
				React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: true }, "演练完成"); } }, "演练"),
				React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: false }, "已推送草稿箱"); } }, "推送草稿")
			)
		),
		React.createElement("div", { className: "ast-stage" },
			React.createElement("div", { className: "ast-phone" },
				React.createElement("iframe", {
					title: "preview",
					src: "/dsh-article-studio/preview/" + encodeURIComponent(current.id) + "?t=" + tick
				})
			)
		),
		message ? React.createElement("div", { className: "ast-toast" }, message) : null
	);
}

function RedirectToSidebar() {
	var stateRef = React.useState("");
	var note = stateRef[0], setNote = stateRef[1];

	React.useEffect(function () {
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
		? React.createElement("div", { style: { padding: "18px", color: "#c4402b", fontSize: 12, textAlign: "center" } }, note)
		: null;
}

var inject = ["slots"];
var name = "dsh-article-studio";

function apply(ctx) {
	hostCtx = ctx;
	if (typeof document !== "undefined") ensureStyle(document);

	ctx.inject(["layout"], function (scoped) { layoutRef = scoped.layout; });
	ctx.inject(["sidebarRight"], function (scoped) { sidebarRightRef = scoped.sidebarRight; });

	ctx.inject(["sidebarRightTabs"], function (scoped) {
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

		try {
			slotScope.slots.inject("main", function () {
				return slotScope.slots.register({ name: "main", key: PANEL_ID }, RedirectToSidebar);
			});
		} catch (error) { console.warn("[article-studio] main page failed", error); }

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
