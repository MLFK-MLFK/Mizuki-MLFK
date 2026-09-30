import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import svelte, { vitePreprocess } from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { oddmisc } from "oddmisc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";

import { siteConfig } from "./src/config.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { rehypeImageWidth } from "./src/plugins/rehype-image-width.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypeWrapTable } from "./src/plugins/rehype-wrap-table.mjs";
import { remarkContent } from "./src/plugins/remark-content.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkFixGithubAdmonitions } from "./src/plugins/remark-fix-github-admonitions.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";

import sentry from "@sentry/astro";
import spotlightjs from "@spotlightjs/astro";

// https://astro.build/config
export default defineConfig({
	site: siteConfig.siteURL,
	base: "/",
	trailingSlash: "always",

	output: "static",

	// 起始页原先在 /start/，现在顶掉根路径成了首页，文章列表退到 /home/。
	// 老书签（还有浏览器里存的历史记录）指向 /start/，给它一条静态跳转。
	// output:"static" 下 Astro 会生成一个只含 meta refresh 的 /start/index.html。
	// 只写不带斜杠的那个键：trailingSlash:"always" 会把 "/start/" 归一成同一条路由，
	// 两条都写会撞车（router 直接报 "defined in both"）。
	redirects: {
		"/start": "/",
	},

	integrations: [
		oddmisc({
			umami: {
				shareUrl: false,
			},
		}),
		swup({
			theme: false,
			animationClass: "transition-swup-",
			containers: ["main"],
			smoothScrolling: false, // 禁用平滑滚动以提升性能，避免与锚点导航冲突
			cache: true,
			preload: false, // 禁用预加载以提升性能
			accessibility: true,
			updateHead: process.env.NODE_ENV === "production",
			updateBodyClass: false,
			globalInstance: true,
			// 起始页（站点根 /）不参与 swup 换页。
			//
			// swup 只按 containers:["main"] 替换 <main> 元素本身。内容页的 <main>
			// 深埋在 MainGridLayout 的 #main-grid 里，导航条 / 横幅 / 侧栏都在
			// <main> 之外；起始页则完全不用 MainGridLayout，<main> 是 <body> 的
			// 直接子元素。两边外壳对不上，于是：
			//   内容页 → 起始页   新的 <main> 落进残留的 #main-grid，导航条/横幅/侧栏还在
			//   起始页 → 内容页   <main> 落进裸 <body>，整个栅格外壳丢失
			// 两种情况都只能刷新才恢复。
			//
			// 命中 ignore 的链接 swup 不会 preventDefault（Swup.ts handleLinkClick），
			// 浏览器会直接整页加载，两个方向都回到正确的文档。
			//
			// 起始页现在就是 "/"，而字符串项走的是 url.startsWith(ignore)（见
			// @swup/astro/dist/script.js 的 shouldIgnore），写 "/" 等于忽略全站 ——
			// 所以这里只能用回调做精确比对。回调收到的是 pathname + search + hash。
			//
			// 第二条覆盖面比看上去大，但两条都必须留着：
			//   1) 精确命中根路径 —— 拦住所有「点向起始页」的链接
			//   2) 拦住起始页内部的所有链接（整块 #lp-root 都在起始页里），
			//      **以及从起始页出发的一切跳转**。后半句是关键：Pio 看板娘之类的
			//      组件走的是 window.swup.navigate()，它不经过 handleLinkClick，
			//      拿不到 el，只能靠「当前文档还在起始页」这个事实拦下来。
			//      少了它，在起始页上点任何 swup 跳转都会把 <main> 换成半截外壳。
			// 函数会被序列化后重建，只能用参数和全局变量，不能引用外层作用域 ——
			// document 是全局，所以下面这么写是安全的。
			// 另外 data-no-swup 由 swup 默认的 ignoreVisit 兜着，不需要写在这里。
			ignore: [
				(_url) => _url === "/",
				(_url, { el }) =>
					!!document.getElementById("lp-root") ||
					!!el?.closest("#lp-root"),
			],
			// 注意：resolveUrl / animateHistoryBrowsing / skipPopStateHandling
			// 不在 @swup/astro 的 Options 里，写了也不会透传给 swup 实例，
			// 需要的话得走 globalInstance 上的 window.swup.options。
		}),
		icon(),
		expressiveCode({
			themes: ["github-light", "github-dark"],
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					shellsession: { showLineNumbers: false },
					bash: { frame: "code" },
					shell: { frame: "code" },
					sh: { frame: "code" },
					zsh: { frame: "code" },
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily:
					"'JetBrains Mono Variable', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', 'Microsoft JhengHei', '微軟正黑體', 'Microsoft YaHei', '微软雅黑', 'Noto Sans HK', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', ui-monospace, monospace",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-bg)",
					editorTabBarBackground: "var(--codeblock-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-bg)",
					terminalTitlebarBorderBottomColor: "none",
				},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
			},
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		svelte({
			preprocess: vitePreprocess(),
		}),
		sitemap(),
		mdx(),
		sentry(),
		spotlightjs(),
	],
	markdown: {
		remarkPlugins: [
			remarkMath,
			remarkContent,
			remarkFixGithubAdmonitions,
			remarkDirective,
			remarkSectionize,
			parseDirectiveNode,
			remarkMermaid,
		],
		rehypePlugins: [
			rehypeKatex,
			[
				rehypeExternalLinks,
				{
					target: "_blank",
					rel: ["nofollow", "noopener", "noreferrer"],
				},
			],
			rehypeSlug,
			rehypeWrapTable,
			rehypeMermaid,
			[
				rehypeComponents,
				{
					components: {
						github: GithubCardComponent,
						note: (x, y) => AdmonitionComponent(x, y, "note"),
						tip: (x, y) => AdmonitionComponent(x, y, "tip"),
						important: (x, y) =>
							AdmonitionComponent(x, y, "important"),
						caution: (x, y) => AdmonitionComponent(x, y, "caution"),
						warning: (x, y) => AdmonitionComponent(x, y, "warning"),
					},
				},
			],
			[
				rehypeAutolinkHeadings,
				{
					behavior: "append",
					properties: {
						className: ["anchor"],
					},
					content: {
						type: "element",
						tagName: "span",
						properties: {
							className: ["anchor-icon"],
							"data-pagefind-ignore": true,
						},
						children: [{ type: "text", value: "#" }],
					},
				},
			],
			rehypeImageWidth,
		],
	},
	vite: {
		plugins: [tailwindcss()],
		// 开发环境预打包优化：将常用依赖提前编译，避免首次页面加载时 on-demand 编译导致 8s+ 的等待
		optimizeDeps: {
			include: [
				"@iconify/svelte",
				"svelte",
				"svelte/transition",
				"svelte/easing",
				"overlayscrollbars",
				"@fancyapps/ui",
				"marked",
				"sanitize-html",
				"qrcode",
			],
		},
		// 预热常用入口文件，让 Vite 在服务器启动后立即开始转换，而不是等到浏览器请求
		server: {
			warmup: {
				clientFiles: [
					"src/layouts/Layout.astro",
					"src/pages/index.astro",
					"src/pages/home/[...page].astro",
					"src/components/widgets/music-player/MusicPlayer.svelte",
					"src/components/organisms/navigation/Search.svelte",
					"src/components/control/ThemeSwitch.svelte",
					"src/components/features/settings/DisplaySettings.svelte",
					"src/scripts/swup-manager.ts",
				],
			},
		},
		build: {
			// 静态资源处理优化，防止小图片转 base64 导致 HTML 体积过大
			assetsInlineLimit: 4096,
			// CSS 代码分割
			cssCodeSplit: true,
			cssMinify: "esbuild",
			// 内联小型 CSS 文件以减少网络请求
			inlineStylesheets: "auto",
			// 生产环境移除 console 和 debugger
			minify: "esbuild",
			rollupOptions: {
				onwarn(warning, warn) {
					if (
						warning.message.includes(
							"is dynamically imported by",
						) &&
						warning.message.includes(
							"but also statically imported by",
						)
					) {
						return;
					}
					warn(warning);
				},
			},
		},
		// 生产环境移除 console.log 和 debugger
		esbuildOptions: {
			drop:
				process.env.NODE_ENV === "production"
					? ["console", "debugger"]
					: [],
		},
	},
});
