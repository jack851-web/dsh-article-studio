window.__ModuleLoader__.load({ id: "dsh-article-studio", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var React = require("react");
var STYLE_ID = "dsh-article-studio-style";
var CSS = [
	".ast-openbtn{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:transparent;color:inherit;",
	"border-radius:6px;padding:3px 9px;font:inherit;font-size:12px;cursor:pointer}",
	".ast-openbtn:hover{background:rgba(128,128,128,.1)}"
].join("\n");

function ensureStyle(doc) {
	if (!doc) return;
	var tag = doc.getElementById(STYLE_ID);
	if (!tag) { tag = doc.createElement("style"); tag.id = STYLE_ID; doc.head.appendChild(tag); }
	if (tag.textContent !== CSS) tag.textContent = CSS;
}

var inject = ["slots"];
var name = "dsh-article-studio";

/**
 * The studio page is a small local web app served by the Host. Opening it in
 * the built-in "browser" sidebar tab puts it next to the Files/PDF tabs while
 * the chat keeps its space — no custom tab type required.
 */
function apply(ctx) {
	if (typeof document !== "undefined") ensureStyle(document);

	ctx.inject(["sidebarRight"], function (scoped) {
		function openTab() {
			try {
				scoped.sidebarRight.openTab("browser", {
					params: { url: String(window.location.origin) + "/dsh-article-studio/" }
				});
				return true;
			} catch (error) {
				console.warn("[article-studio] openTab failed", error);
				return false;
			}
		}

		ctx.inject(["slots"], function (slotScope) {
			try {
				var OpenButton = function () {
					return React.createElement("button", {
						className: "ast-openbtn",
						title: "在右侧栏打开文章流水线",
						onClick: openTab
					}, "文章");
				};
				slotScope.slots.inject("conversation.session.header.utilities", function () {
					return slotScope.slots.register(
						{ name: "conversation.session.header.utilities", id: "article-studio-open" },
						OpenButton
					);
				});
			} catch (error) {
				console.warn("[article-studio] header button failed", error);
			}
		});

		// One automatic open per page load so the tab is discoverable.
		setTimeout(openTab, 1500);
	});
}

module.exports = { name: name, inject: inject, apply: apply };
return module.exports;
}});
