window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var PANEL_ID = "article-studio";
var TAB_ID = "@local/dsh-article-studio/tab";
var TAB_KIND = "article-studio";
var RPC = "/dsh-article-studio/rpc";
var STYLE_ID = "dsh-article-studio-style";
var STAGES = [["brief","选题"],["outline","大纲"],["draft","正文"],["images","配图"],["format","排版"],["review","审校"],["publish","发布"]];
var THEMES = ["newspaper","bytedance","zen-minimal","washi-red","wechat-native","minimal"];
var DEFAULT_ROOT = "D:\\others\\article\\studio";

var hostCtx = null;
var layoutRef = null;
var sidebarRightRef = null;
var tabsRef = null;

var CSS = [
	".ast-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#faf8f3);color:var(--dsw-alias-label-primary,#171410);font-size:12.5px}",
	".ast-head{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
	".ast-head .t{font-weight:650}",
	".ast-head button{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;border-radius:6px;padding:3px 9px;font:inherit;cursor:pointer}",
	".ast-head .sp{flex:1}",
	".ast-back{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#8b8377);font:inherit;cursor:pointer;padding:2px 0}",
	".ast-body{flex:1;min-height:0;overflow:auto;padding:8px 10px}",
	".ast-wrap{flex:1;min-height:0;display:flex;flex-wrap:wrap}",
	".ast-main{flex:1 1 340px;min-width:0;min-height:0;overflow:auto;padding:10px 12px}",
	".ast-side2{flex:0 0 447px;min-height:0;display:flex;flex-direction:column;padding:10px;background:rgba(128,128,128,.05);border-left:1px solid rgba(0,0,0,.08)}",
	".ast-phone{flex:1;min-height:220px;width:415px;max-width:100%;margin:0 auto;border:1px solid rgba(0,0,0,.12);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.08)}",
	".ast-phone iframe{display:block;width:100%;height:100%;border:0;background:#fff}",
	".ast-row{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px}",
	".ast-row:hover{background:rgba(128,128,128,.1)}",
	".ast-row .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-row .m{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;margin-top:2px}",
	".ast-new{display:flex;gap:6px;padding:4px 10px 10px}",
	".ast-new input{flex:1;min-width:0;padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;font:inherit;outline:none}",
	".ast-h1{font-size:15px;margin:0 0 4px;line-height:1.35}",
	".ast-meta{color:var(--dsw-alias-label-secondary,#8b8377);font-size:11px;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}",
	".ast-sec{font-size:11px;font-weight:650;color:var(--dsw-alias-label-secondary,#8b8377);margin:12px 0 6px;letter-spacing:.02em}",
	".ast-rail{display:flex;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:7px;overflow:hidden;background:#fff;margin-bottom:10px}",
	".ast-rail .cell{flex:1;text-align:center;padding:5px 2px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#8b8377);border-right:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));border:0;background:transparent;font:inherit;cursor:pointer;padding:6px 2px}",
	".ast-rail .cell:last-child{border-right:0}",
	".ast-rail .cell.done{color:#1f7a4d;font-weight:600;background:rgba(31,122,77,.08)}",
	".ast-rail .cell.doing{color:#b45309;font-weight:600}",
	".ast-rail .cell.blocked{color:#c4402b;font-weight:600}",
	".ast-actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}",
	".ast-btn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}",
	".ast-btn:hover{background:rgba(128,128,128,.08)}",
	".ast-btn.primary{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-btn[disabled]{opacity:.45;cursor:not-allowed}",
	".ast-btn.sm{padding:3px 7px;font-size:11px}",
	".ast-chips{display:flex;gap:6px;flex-wrap:wrap}",
	".ast-chip{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:#fff;color:inherit;border-radius:999px;padding:3px 10px;font:inherit;font-size:11px;cursor:pointer}",
	".ast-chip.on{background:#171410;border-color:#171410;color:#faf8f3}",
	".ast-field textarea{width:100%;min-height:170px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));border-radius:8px;background:#fff;color:inherit;font:12.5px/1.7 ui-monospace,Consolas,monospace;resize:vertical;outline:none}",
	".ast-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}",
	".ast-img{border:1px solid rgba(0,0,0,.1);border-radius:8px;overflow:hidden;background:#fff}",
	".ast-img img{display:block;width:100%;height:68px;object-fit:cover;background:#eee}",
	".ast-img .cap{font-size:10px;color:var(--dsw-alias-label-secondary,#8b8377);padding:3px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ast-img .ops{display:flex;gap:2px;padding:0 5px 5px}",
	".ast-img .ops button{border:0;background:transparent;color:#3b6cf6;font:inherit;font-size:10px;cursor:pointer;padding:1px 2px}",
	".ast-img.cover{outline:2px solid #1f7a4d;outline-offset:-2px}",
	".ast-hist{font-size:11px;color:var(--dsw-alias-label-secondary,#8b8377)}",
	".ast-hist div{padding:3px 0;border-bottom:1px dashed rgba(0,0,0,.06)}",
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

function copyText(text) {
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return true; }
	} catch (error) { /* fall through */ }
	try {
		var area = document.createElement("textarea");
		area.value = text;
		document.body.appendChild(area);
		area.select();
		document.execCommand("copy");
		area.remove();
		return true;
	} catch (error) { return false; }
}

function StudioPanel() {
	var listState = React.useState([]);
	var articles = listState[0], setArticles = listState[1];
	var curState = React.useState(null);
	var current = curState[0], setCurrent = curState[1];
	var detailState = React.useState({ draft: "", images: [], history: [] });
	var detail = detailState[0], setDetail = detailState[1];
	var draftState = React.useState("");
	var draftText = draftState[0], setDraftText = draftState[1];
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
		}).catch(function (error) { setRpcError("连接失败：" + String((error && error.message) || error)); });
	}

	function open(id) {
		return rpc({ action: "get", id: id }).then(function (result) {
			if (!result || !result.ok) { notify("读取失败：" + ((result && result.error) || "")); return; }
			setCurrent(result.article);
			setDetail({ draft: result.draft || "", images: result.images || [], history: result.history || [] });
			setDraftText(result.draft || "");
		});
	}

	React.useEffect(function () {
		refreshList();
		var timer = setInterval(refreshList, 6000);
		return function () { clearInterval(timer); };
	}, []);

	function act(payload, okText) {
		setBusy(true);
		return rpc(payload).then(function (result) {
			notify(result && result.ok ? okText : "失败：" + ((result && result.error) || "未知错误"));
			if (result && result.ok) {
				refreshList();
				if (payload.id) open(payload.id);
			}
			return result;
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
				refreshList();
				open(result.id);
			} else notify("新建失败：" + ((result && result.error) || ""));
		}).finally(function () { setBusy(false); });
	}

	function writePrompt() {
		return "请为文章《" + (current && current.title || "") + "》写正文，直接写入 " + rootPath + "\\" + (current && current.id || "") + "\\draft.md（公众号风格，约 1200 字，标题不含营销腔）。写完后我会在右侧面板点刷新。";
	}

	if (!current) {
		return React.createElement("div", { className: "ast-root" },
			React.createElement("div", { className: "ast-head" },
				React.createElement("span", { className: "t" }, "文章流水线"),
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
						var stage = stageOf(article);
						return React.createElement("div", { key: article.id, className: "ast-row", onClick: function () { open(article.id); } },
							React.createElement("div", { className: "t" }, article.title || article.id),
							React.createElement("div", { className: "m" },
								React.createElement("span", null, labelOf(stage)),
								React.createElement("span", null, String(article.updatedAt || "").replace("T", " ")),
								React.createElement("span", null, "第 " + (article.draftVersion || 0) + " 稿")
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
			return React.createElement("button", {
				key: pair[0], className: "cell " + status,
				title: "点击切换完成 / 未完成",
				onClick: function () {
					var next = status === "done" ? "todo" : "done";
					act({ action: "set", id: current.id, stage: pair[0], status: next }, labelOf(pair[0]) + (next === "done" ? " 已完成" : " 已取消"));
				}
			}, pair[1] + (status === "done" ? " ✓" : ""));
		})
	);

	var themeChips = React.createElement("div", { className: "ast-chips" },
		THEMES.map(function (name) {
			return React.createElement("button", {
				key: name, className: "ast-chip" + (current.theme === name ? " on" : ""),
				onClick: function () { act({ action: "theme", id: current.id, theme: name }, "主题 → " + name); }
			}, name);
		})
	);

	var images = (detail.images || []).map(function (image) {
		var url = "/dsh-article-studio/asset/" + encodeURIComponent(current.id) + "/images/" + encodeURIComponent(image.name);
		var isCover = current.cover === "images/" + image.name;
		return React.createElement("div", { key: image.name, className: "ast-img" + (isCover ? " cover" : "") },
			React.createElement("img", { src: url, alt: image.name }),
			React.createElement("div", { className: "cap", title: image.name }, image.name),
			React.createElement("div", { className: "ops" },
				React.createElement("button", { onClick: function () { act({ action: "cover", id: current.id, name: image.name }, "封面已设置"); } }, isCover ? "封面" : "设封面"),
				React.createElement("button", { onClick: function () { act({ action: "deleteImage", id: current.id, name: image.name }, "已移除 " + image.name); } }, "删除")
			)
		);
	});

	var history = (detail.history || []).slice(0, 12).map(function (entry, index) {
		return React.createElement("div", { key: index },
			String(entry.at || "").replace("T", " ") + " · " + String(entry.action || "") + (entry.note ? " · " + entry.note : "")
		);
	});

	return React.createElement("div", { className: "ast-root" },
		React.createElement("div", { className: "ast-head" },
			React.createElement("button", { className: "ast-back", onClick: function () { setCurrent(null); } }, "‹ 全部"),
			React.createElement("span", { className: "t" }, "文章流水线"),
			React.createElement("span", { className: "sp" }),
			React.createElement("button", { onClick: function () { open(current.id); setTick(tick + 1); } }, "刷新")
		),
		React.createElement("div", { className: "ast-wrap" },
			React.createElement("div", { className: "ast-main" },
				React.createElement("h1", { className: "ast-h1" }, current.title),
				React.createElement("div", { className: "ast-meta" },
					React.createElement("span", null, "当前：" + labelOf(stage)),
					React.createElement("span", null, "第 " + (current.draftVersion || 0) + " 稿"),
					React.createElement("span", null, "主题：" + (current.theme || "newspaper"))
				),
				rail,
				React.createElement("div", { className: "ast-sec" }, "排版主题"),
				themeChips,
				React.createElement("div", { className: "ast-actions", style: { marginTop: 8 } },
					React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "format", id: current.id, theme: current.theme }, "排版完成").then(function () { setTick(tick + 1); }); } }, "排版"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "set", id: current.id, stage: "review", status: "done" }, "已通过审校"); } }, "审校通过"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: true }, "演练完成"); } }, "演练"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { act({ action: "publish", id: current.id, dryRun: false }, "已推送草稿箱"); } }, "推送草稿")
				),
				React.createElement("div", { className: "ast-sec" }, "正文 · " + (detail.draft || "").length + " 字"),
				React.createElement("div", { className: "ast-field" },
					React.createElement("textarea", {
						value: draftText,
						placeholder: "在这里写，或点下方「复制写作提示」让聊天里的 AI 代写",
						onChange: function (e) { setDraftText(e.target.value); }
					})
				),
				React.createElement("div", { className: "ast-actions", style: { marginTop: 6 } },
					React.createElement("button", { className: "ast-btn primary", disabled: busy, onClick: function () { act({ action: "draft", id: current.id, markdown: draftText }, "正文已保存"); } }, "保存正文"),
					React.createElement("button", { className: "ast-btn", disabled: busy, onClick: function () { copyText(writePrompt()) ? notify("写作提示已复制，粘贴到聊天即可") : notify("复制失败，请手动复制"); } }, "复制写作提示")
				),
				React.createElement("div", { className: "ast-sec" }, "配图 · " + (detail.images || []).length + " 张"),
				images.length
					? React.createElement("div", { className: "ast-imgs" }, images)
					: React.createElement("div", { className: "ast-hint" }, "还没有配图。把图片放进 " + rootPath + "\\" + current.id + "\\images 后点刷新；或在聊天里让 AI 去找图。"),
				React.createElement("div", { className: "ast-sec" }, "记录"),
				React.createElement("div", { className: "ast-hist" }, history.length ? history : "暂无记录"),
				rpcError ? React.createElement("div", { className: "ast-hint", style: { color: "#c4402b" } }, rpcError) : null
			),
			React.createElement("div", { className: "ast-side2" },
				React.createElement("div", { className: "ast-phone" },
					React.createElement("iframe", {
						title: "preview",
						src: "/dsh-article-studio/preview/" + encodeURIComponent(current.id) + "?t=" + tick
					})
				)
			)
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
