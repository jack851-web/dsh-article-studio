window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");

var PANEL_ID = "article-studio";
var TAB_ID = "@local/dsh-article-studio/tab";
var TAB_KIND = "article-studio";
var PAGE_URL = "/dsh-article-studio/";

var hostCtx = null;
var layoutRef = null;
var sidebarRightRef = null;

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
 * The whole studio UI lives in the Host-served page; the tab is just its frame.
 * Keeping the React half this thin means clicks, state and RPC all run in one
 * plain document instead of across two rendering models.
 */
function StudioPanel() {
	return React.createElement("iframe", {
		title: "文章",
		src: PAGE_URL,
		style: { width: "100%", height: "100%", border: 0, display: "block", background: "#faf8f3" }
	});
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

	ctx.inject(["layout"], function (scoped) { layoutRef = scoped.layout; });
	ctx.inject(["sidebarRight"], function (scoped) { sidebarRightRef = scoped.sidebarRight; });

	ctx.inject(["sidebarRightTabs"], function (scoped) {
		try {
			scoped.effect(function () {
				return scoped.sidebarRightTabs.register({
					id: TAB_ID,
					kind: TAB_KIND,
					title: function () { return "文章"; }
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
					title: function () { return "文章"; },
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
						title: "在侧栏打开文章",
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
