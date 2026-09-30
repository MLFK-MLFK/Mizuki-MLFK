# 01 · 技术栈与架构总览

这一块是给新人看的第一张地图：站点由哪些技术拼成、一次页面请求从浏览器到 `dist/` 再回到浏览器走过了哪些环节、哪些东西在构建期算好、哪些只能运行时做。

读完它，你应该能回答三个问题：改一个页面要动哪几层文件；「静态站点」和「无刷新换页」为什么不冲突；为什么很多地方写的「首页」不是 `/`。

后续读 02（目录结构）、03（配置系统）、04（路由与页面）时，本文的分层图和构建/运行边界是前提。

## 1. 技术栈清单

版本直接取自 `package.json`：

| 依赖 | `package.json` 版本 | 角色 |
| --- | --- | --- |
| `astro` | `6.1.2`（精确锁定，无 `^`） | 站点框架、静态构建（`package.json:45`） |
| `@astrojs/svelte` | `8.0.4`（精确锁定） | Svelte 集成（`package.json:32`） |
| `svelte` | `^5.55.4` | 交互岛屿（Svelte 5 runes，`package.json:74`） |
| `tailwindcss` | `^4.2.2` | 原子化 CSS（`package.json:75`） |
| `@tailwindcss/vite` | `^4.2.2` | Tailwind v4 的 Vite 插件（`package.json:44`） |
| `stylus` | `^0.64.0` | `src/styles/*.styl` 预处理器（`package.json:73`） |
| `typescript` | `^5.9.3` | 类型检查（`package.json:76`） |
| `pagefind` | `^1.5.2` | 构建后生成的全文搜索索引（`package.json:58`） |
| `@swup/astro` | `^1.8.0` | 无刷新换页（`package.json:42`） |
| `astro-expressive-code` | `^0.41.7` | 代码块渲染（`package.json:46`） |
| `astro-icon` | `^1.1.5` | 图标（构建期组件 + 运行期 Iconify 兜底，`package.json:47`） |

配套：`@astrojs/mdx ^5.0.3`、`@astrojs/rss ^4.0.18`、`@astrojs/sitemap ^3.7.2`、`@sentry/astro ^10.49.0`、`@spotlightjs/astro ^3.2.6`、`oddmisc ^1.1.6`（`package.json:29`、`package.json:30`、`package.json:31`、`package.json:40`、`package.json:41`、`package.json:56`）。

### 包管理器被强制为 pnpm

不要用 `npm install` 或 `yarn`。三道锁：

- `package.json:24` 的 `preinstall` 是 `npx only-allow pnpm`，用 npm 装依赖会直接报错退出。
- `package.json:111` 声明了 `"packageManager": "pnpm@10.33.0"`。
- 根目录 `.npmrc` 写的是 `manage-package-manager-versions = true`。

### Tailwind v4：没有 JS 配置，令牌写在 CSS 里

仓库根目录**没有** `tailwind.config.js` / `tailwind.config.ts`。Tailwind v4 改成 CSS-first：

- 通过 Vite 插件挂载：`astro.config.mjs:221-222` 的 `vite.plugins` 里调用 `tailwindcss()`。
- 入口是 `src/styles/main.css:1` 的 `@import "tailwindcss";`。
- 主题令牌写在同一文件的 `@theme` 块里，块从 `src/styles/main.css:21` 开始，第一条令牌 `--font-sans` 在 `:22`，断点 `--breakpoint-md/lg/xl` 在 `:24-26`。
- 暗色变体用自定义 variant：`src/styles/main.css:18` 的 `@custom-variant dark (&:where(.dark, .dark *));`。这解释了为什么全站暗色靠 `<html class="dark">` 一处切换。

所以改断点或主题色，去 `src/styles/main.css`，不是去改 JS 配置。

## 2. 硬约束：不要跑 npm/pnpm 的 dev 与 build

`package.json:8` 与 `package.json:9` 的 `predev` / `prebuild` 都是 `node scripts/sync-content.js || true`，而该脚本结尾会 `git add .` 再 `git commit`（`scripts/sync-content.js:157-162`）。也就是说 `pnpm dev` 会静默提交你工作区里的所有改动。

需要检查或构建时改用 `npx astro check` / `npx astro build`——它们不经过 `pre*` 钩子。注意真正的 `build` 脚本比 `astro build` 多三步（`package.json:16`）：

```
node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

`npx astro build` 不会跑 `update-anime.mjs`、pagefind 索引和字体压缩。

### npm 脚本矩阵

除了 dev/build，常用的入口还有（都定义在 `package.json:5-26`）：

| 脚本 | 命令 | 用途 |
| --- | --- | --- |
| `check` | `astro check` | 类型 + 模板检查（`package.json:12`） |
| `type-check` | `tsc --noEmit --isolatedDeclarations` | 纯 TS 类型检查（`package.json:20`） |
| `lint` | `eslint ./src --fix` | 代码风格（`package.json:23`） |
| `format` | `prettier --write ./src` | 格式化（`package.json:22`） |
| `preview` | `astro preview` | 预览已构建产物（`package.json:18`） |
| `new-post` | `node scripts/new-post.js` | 新建文章（`package.json:21`） |
| `compress-fonts` | `node scripts/compress-fonts.js` | 字体子集化（`package.json:25`） |
| `update-anime` / `update-bangumi` / `update-bilibili` | `node scripts/update-*.mjs` | 抓取番剧/观看进度数据（`package.json:13-15`） |
| `astro` | `astro` | CLI 透传（`package.json:19`）；`dev` 在 `package.json:10`、`start` 在 `package.json:11` |

## 3. 内容与代码分离：机制、以及当前为何未生效

这是「改内容动哪一层」的前提，比技术栈本身更容易被误解。

项目内置了一套「文章与代码分离」的机制，入口是 `scripts/sync-content.js` 加 `.env`：

- 环境变量由 `scripts/load-env.js:10-29` 从 `.env` 手工解析进 `process.env`：`ENABLE_CONTENT_SYNC`（默认启用）、`CONTENT_REPO_URL`、`CONTENT_DIR`（默认 `./content`，`/content/` 已被 `.gitignore:25` 忽略，三者的读取见 `scripts/sync-content.js:15-17`）。
- 脚本会把内容仓库里的四个目录接到主仓库的四个位置（`scripts/sync-content.js:96-101`）：

  | 内容仓库内 | 主仓库内 |
  | --- | --- |
  | `posts` | `src/content/posts` |
  | `spec` | `src/content/spec` |
  | `data` | `src/data` |
  | `images` | `public/images` |

  优先建 junction 符号链接，Windows 无权限时退化为复制（`scripts/sync-content.js:130-137`）。
- 关掉 `ENABLE_CONTENT_SYNC`，或内容目录缺失且无 `CONTENT_REPO_URL` 时，脚本提前 `process.exit(0)`，退回本地内容，也不会触发 git 提交（`scripts/sync-content.js:22-42`）。

**当前这个工作区的真实情况：机制已配置，但没有真正接线。** `content/` 确实是独立的 git 克隆，但它的 origin 是代码仓库本身（`.env:19` 把 `CONTENT_REPO_URL` 指向了主仓库），内容实际放在 `content/src/content/posts`、`content/public/images` 这类路径下；而脚本要找的是 `content/posts`、`content/images` 这样的顶层目录。两者对不上，四个映射全部命中「跳过不存在的源目录」（`scripts/sync-content.js:107-110`）。结果是：今天构建读取的是主仓库里本地、已被 git 跟踪的 `src/content/posts`、`src/content/spec`、`src/data`、`public/images`，分离并未生效。

因此改文章前先确认走的是哪条路：同步真生效时改 `content/` 那个独立仓库；未生效时（当前如此）改 `src/content/posts` 即可。直接改 `src/content/posts` 在同步生效后会被备份成 `.backup` 并重建链接（`scripts/sync-content.js:112-122`）。

文章集合本身用 Astro 的 Content Layer 定义在 `src/content.config.ts`（不是旧版的 `src/content/config.ts`）：`posts` 用 `glob` loader 扫 `src/content/posts/**/*.{md,mdx}`，schema 在 `src/content.config.ts:5-42`；`spec` 在 `:43-46`。schema 决定了 frontmatter 里能写哪些字段（`title`、`published`、`draft`、`tags`、`encrypted`、`permalink` 等）。

## 4. 渲染模型：静态产物 + Swup 无刷新换页，为什么能共存

两件看似矛盾的事：

1. `output: "static"`（`astro.config.mjs:43`）——构建后是纯静态 HTML/CSS/JS，没有服务端运行时（`astro.config.mjs` 全程没有 import 任何 adapter）。
2. 站内跳转像 SPA——点导航不整页刷新。

共存的关键在于「首屏」和「后续导航」是两条路：

- **首屏**：浏览器请求的是 `dist/` 里预先渲染好的静态 HTML（例如 `dist/index.html`），所有内容在构建期就已就位，能直接解析、能 SEO。
- **后续导航**：`@swup/astro` 注册在客户端（`astro.config.mjs:60-107`），点击站内链接时 `preventDefault`，用 `fetch` 取目标页 HTML，然后只替换配置里指定的容器：`containers: ["main"]`（`astro.config.mjs:63`）。导航栏、横幅、侧栏都在 `<main>` 之外，因此天然保留、不重渲染。

被替换的 `<main>` 在内容页里是 MainGridLayout 的 `<main id="swup-container">`（`src/layouts/MainGridLayout.astro:213-215`）；侧栏在它之前（`src/layouts/MainGridLayout.astro:190-211`），导航和 Banner 更靠前（`src/layouts/MainGridLayout.astro:117-136`）。

### 起始页必须排除在 Swup 之外

这是全项目最容易踩的坑之一。起始页 `src/pages/index.astro` 不用 `MainGridLayout`，它的 `<main id="swup-container">` 是 `<body>` 的直接子元素（`src/pages/index.astro:65`，`Layout.astro:235` 的 `<slot />` 是 body 直接子级）。两边外壳结构对不上，互相换 `<main>` 都会导致外壳丢失。于是 `astro.config.mjs:98-103` 用回调式 `ignore` 精确拦掉：

```js
ignore: [
	(_url) => _url === "/",
	(_url, { el }) =>
		!!document.getElementById("lp-root") ||
		!!el?.closest("#lp-root"),
],
```

之所以用回调而不是字符串，是因为字符串项走 `url.startsWith(ignore)`，写 `"/"` 等于忽略全站（`astro.config.mjs:84-86` 的注释）。第二条回调覆盖面比看上去大：既拦「起始页内部的所有链接」，也拦「从起始页出发的一切跳转」——Pio 看板娘之类组件走的是 `window.swup.navigate()`，不经过链接点击，拿不到 `el`，只能靠「当前文档还在起始页」这一事实拦住（`astro.config.mjs:88-97`）。

Swup 处理点击时会问 `ignoreVisit`，但**历史前进/后退不问**（它只看 `skipPopStateHandling`，而该选项没有被 `@swup/astro` 透传给 swup 实例）。所以 `src/scripts/swup-manager.ts:280-288` 额外挂了一个 `popstate` 兜底：一旦历史导航涉及起始页就 `window.location.reload()`。判定同时看目标 pathname 和当前文档的 `#lp-root`，且路径用的是精确正则 `/^\/$/`（`src/scripts/swup-manager.ts:269`）——换成 `startsWith("/")` 会把全站前进后退都退化成整页刷新（注释 `src/scripts/swup-manager.ts:265-268`）。

## 5. 岛屿架构：哪些是 `.astro`、哪些是 `.svelte`

实查：`src/` 下有 **119 个 `.astro`**、**50 个 `.svelte`**。

- **`.astro` 组件**：构建期渲染成 HTML，默认零客户端 JS。布局外壳、文章正文、页脚、导航结构、大部分侧栏卡片都是 `.astro`。
- **`.svelte` 组件**：需要在浏览器里跑状态的岛屿，必须被一个 `client:*` 指令挂载才会水合。集中在音乐播放器（`src/components/widgets/music-player/` 约 20 个）、日历（`src/components/widgets/calendar/`）、主题/布局切换、搜索、移动端 TOC、Pio。

`client:*` 指令的实际挂载点（实查清单）：

| 指令 | 组件 | 位置 |
| --- | --- | --- |
| `client:idle` | MusicPlayer、MusicFabButton | `src/layouts/Layout.astro:238`、`src/components/control/FloatingControls.astro:23` |
| `client:visible` | Pio 看板娘、Calendar、ShareCard | `src/layouts/Layout.astro:241`、`src/components/widgets/calendar/Calendar.astro:49`、`src/components/features/posts/ShareCard.astro:66` |
| `client:load` | PasswordModal | `src/components/features/auth/PasswordProtection.astro:23` |
| `client:only="svelte"` | Search、MobileTOC、LayoutSwitch、WallpaperSwitch、ThemeSwitch、DisplaySettings、ArchivePanel、侧栏音乐 | `src/components/organisms/navigation/Navbar.astro:98`、`:101`、`:107`、`:115`、`:117`、`:123`；`src/pages/archive.astro:49`；`src/components/widgets/music-sidebar/MusicSidebarWidget.astro:18` |

**反直觉**：客户端指令本身不写在 `src/config.ts` 里。`config.ts` 控制的是「这个岛屿还要不要渲染」这类布尔开关，指令写在组件被使用的 JSX 位置。例如：

- `pioConfig.enable` 为真才渲染 `<Pio client:visible />`（`src/layouts/Layout.astro:241`，开关 `src/config.ts:651`）。
- `commentConfig.enable` 为假则整块评论区不渲染（渲染门 `src/components/comment/index.astro:35`，开关 `src/config.ts:429`）；`:31` 的 `commentEnabled` 只是「单篇文章 `comment` 字段」的开关，与总开关无关。
- MusicPlayer 组件无条件 `client:idle` 挂载，是否显示悬浮 UI 由 `showFloatingPlayer` 控制（`src/config.ts:469`）。

想关掉某个交互组件，改 `config.ts` 的开关，而不是去找指令。

## 6. 一次页面请求的完整链路

以访问 `https://<site>/home/` 为例：

1. **请求 → 静态 HTML**。CDN/静态托管直接返回构建好的 `dist/home/index.html`（`output: "static"`，`astro.config.mjs:43`）。
2. **首屏防闪烁**。`Layout.astro:176-182` 在 `<head>` 挂 `HeadTags`，其中 `src/layouts/partials/HeadTags.astro:102-187` 是一段 `is:inline` 脚本，在首帧之前完成：
   - 从 `localStorage` 读主题，直接给 `<html>` 加/去 `dark`（`src/layouts/partials/HeadTags.astro:114-125`）；
   - 读 `hue` 写入 `--hue`（`:136-137`）；
   - 按视口算 `--banner-height-extend` 并取 4 的倍数以免文字模糊（`:139-145`）；
   - 跑自动缩放：宽屏下按 `targetWidth` 缩放根字号，下限 0.85（`:147-186`）。
   必须是 `is:inline`：普通 Astro `<script>` 会被打成 `defer`，赶不上首帧，遮罩/主题会先闪一下（同款原因见 `src/pages/index.astro:57-62`）。
3. **Layout 挂载外围**。`src/layouts/Layout.astro:229` 放 `<ConfigCarrier />`，`:230` 挂进度条，`:235` 是页面内容 `<slot />`，`:238`/`:241` 挂 MusicPlayer 与 Pio。
4. **内容页外壳**。内容页用 `MainGridLayout` 包在 `Layout` 里，产出 `#main-grid`、`#banner-wrapper`、`#swup-container` 等结构，并注入 `GridScripts`（`src/layouts/MainGridLayout.astro:100-107`）。
5. **注册 Swup**。`src/layouts/Layout.astro:319-326` 的普通 Astro `<script>`（会被打包成外部模块脚本，不是内联）import `initSwupManager()`。它构造 `SwupManager`、应用过渡配置、初始化面板/樱花/返回顶部/预加载（`src/scripts/swup-manager.ts:57-84`），然后注册钩子（`src/scripts/swup-manager.ts:107-149`）。
6. **后续点击走生命周期**。真正注册的钩子在 `src/scripts/core/swup-hooks.ts:72-81`：
   - `link:click`（`:88`）——清内容延迟、按需藏 navbar；
   - `visit:start`（`:128`）——清理上一页 Fancybox、切 body class、隐藏 TOC、撑高页面；
   - `content:replace`（`:107`）——重新初始化 Fancybox、KaTeX、滚动条、TOC、semifull 滚动检测；
   - `page:view`（`:153`）——滚到顶部、同步主题、派发 `mizuki:page:loaded` 事件；
   - `visit:end`（`:176`）——延迟恢复高度、显示 TOC。

`Layout.astro` 另外还挂了两个全局运行时脚本：代码块折叠 `src/scripts/code-collapse.js`（`src/layouts/Layout.astro:329-331`）与主题性能优化 `src/scripts/theme-optimizer.js`（`src/layouts/Layout.astro:334-336`）。它们和 swup 一样，是「构建期打包、运行期执行」的副作用。

### 生命周期有两套，别混

业务代码主要监听 Swup 自己的事件 `window.swup.hooks.on(...)`。同时 `@swup/astro` 把它桥接成 Astro 事件：

```js
swup.hooks.before('content:replace', () => dispatch('astro:before-swap'));
swup.hooks.on('content:replace',     () => dispatch('astro:after-swap'));
swup.hooks.on('page:view',           () => dispatch('astro:page-load'));
```

所以你会看到两套风格并存：核心管理器用 `swup.hooks.on`（`src/scripts/core/swup-hooks.ts:88`），而不少组件用 `document.addEventListener("astro:page-load", ...)`（如 `src/components/control/BackToHome.astro:51`、`src/scripts/landing/index.ts:600`、`src/plugins/mermaid-render-script.js:429`）。写新组件时，任选一套都能在无刷新换页后触发，但**别在两套里重复注册同一件事**，否则会跑两遍。

## 7. 构建期与运行期的边界

| 在构建期算好（进 `dist/` 静态产物） | 只能运行时做（浏览器里） |
| --- | --- |
| 分页：`paginate()` 生成 `/home/`、`/home/2/`…（`src/pages/home/[...page].astro:23-28`） | Swup 无刷新换页、过渡动画（`src/scripts/swup-manager.ts:57-84`） |
| 文章正文与目录树：`render(entry)` 产出 `Content` 与 `headings`（`src/pages/posts/[...slug].astro:99`） | 主题/色相从 `localStorage` 读取（`src/layouts/partials/HeadTags.astro:114`、`:136`） |
| OG 图：`prerender = true` + `getStaticPaths`，用 satori+sharp 出 PNG（`src/pages/og/[...slug].png.ts:22`、`:24-40`） | Fancybox 灯箱、KaTeX 复检、滚动条初始化（`src/scripts/core/swup-hooks.ts:111-113`） |
| 站点地图、RSS、Atom、robots、JSON 接口：构建期生成静态文件（`src/pages/rss.xml.ts`、`src/pages/atom.xml.ts`、`src/pages/robots.txt.ts`、`src/pages/api/allPostMeta.json.ts`、`src/pages/api/calendar-data.json.ts`） | 评论（Twikoo/Giscus 在 `swup.hooks.on("content:replace")` 后加载） |
| 搜索索引：**`astro build` 之后的独立一步** `pagefind --site dist`（`package.json:16`），配置 `pagefind.yml` | Pagefind 前端查询：仅生产环境加载 `/pagefind/pagefind.js`（`src/components/organisms/navigation/Navbar.astro:284-285`） |
| 图标：`.astro` 里用的 `astro-icon` 图标在构建期内联 | Iconify 运行期兜底：`IconifyLoader` 注入 `code.iconify.design` 的 `iconify-icon` web component（`src/components/misc/IconifyLoader.astro:106-108`），该组件运行期再去 `api.iconify.design` 取缺失图标（预连接见 `src/layouts/partials/HeadTags.astro:99`） |

**容易看错的一点**：`src/pages/api/*.json.ts`、`rss.xml.ts`、`atom.xml.ts` 看起来像服务端接口，但在 `output: "static"` 下它们会在构建期执行并输出成静态 `.json` / `.xml` 文件，没有运行时服务端。

其他构建期生成的路由还包括：`src/pages/[...permalink].astro`（承载全局/自定义 permalink 的文章页）、`src/pages/404.astro`、`archive.astro`、`timeline.astro` 等页面。

## 8. Markdown 渲染管线

「文章里能写什么」由 `astro.config.mjs:164-219` 的 remark/rehype 插件链决定，这是内容能力的来源。

- **remark（解析期）**：`remarkMath`（`$...$` 数学）、`remarkContent`、`remarkFixGithubAdmonitions`、`remarkDirective`、`remarkSectionize`、`parseDirectiveNode`、`remarkMermaid`（`astro.config.mjs:165-173`）。
- **rehype（AST 转换期）**：`rehypeKatex`（数学渲染）、`rehypeExternalLinks`（外链加 `target="_blank"` 与 `rel`，`astro.config.mjs:176-182`）、`rehypeSlug`、`rehypeWrapTable`、`rehypeMermaid`、`rehypeComponents`、`rehypeAutolinkHeadings`、`rehypeImageWidth`（`:174-219`）。
- **`rehypeComponents` 注入的自定义组件**（`astro.config.mjs:186-199`）：`github`（GitHub 卡片）、`note` / `tip` / `important` / `caution` / `warning`（五种提示块）。文章里写 `:::note` 之类指令，走的就是这条链。

代码块则由 `astro-expressive-code` 负责，配了四个插件（`astro.config.mjs:109-116`）：`pluginCollapsibleSections`（可折叠区块）、`pluginLineNumbers`（行号）、`pluginLanguageBadge`（语言角标）、`pluginCustomCopyButton`（自定义复制按钮），主题绑定 `github-light` / `github-dark`（`astro.config.mjs:110`），随明暗切换（thememapping 在 `src/scripts/core/swup-config.ts:103-105`）。

## 9. 分层约定与依赖方向

```
src/pages/      路由：每个文件 = 一条 URL；用 getStaticPaths 决定实例
src/layouts/    外壳：Layout（head/body 级）→ MainGridLayout（栅格外壳）→ partials/
src/components/ 视图：atoms / widgets / features / organisms / control / comment ...
src/utils/      纯逻辑：content-utils、url-utils、permalink-utils、navigation-utils ...
src/scripts/    浏览器运行时：swup-manager 及 core / handlers / effects / landing
src/config.ts   唯一数据源：站点、导航、侧栏、第三方开关
src/constants/  常量：HOME_PATH、PAGE_SIZE、DEFAULT_THEME ...
src/types/      类型定义
```

依赖方向是单向的：`pages → layouts → components → utils/scripts → config/constants`。`config.ts` 只导出数据，不 import 任何组件，避免环依赖（`src/config.ts:21` 有「移除 i18n 导入以避免循环依赖」的注释）。

导入别名定义在 `tsconfig.json:17-25`：`@components/*`、`@assets/*`、`@constants/*`、`@utils/*`、`@i18n/*`、`@layouts/*`、`@/*`。类型检查较严：`strictNullChecks: true`（`tsconfig.json:9`）、`moduleResolution: "bundler"`（`tsconfig.json:5`）。

**barrel 导出约定**：组件目录普遍带 `index.ts`（`src/components/` 下实查 53 个）。文章页把一组组件合并成一行导入，例如 `import { LastModified, PostMeta, PostNavigation, ... } from "@components/features/posts";`（`src/pages/posts/[...slug].astro:5-12`），对应 `src/components/features/posts/index.ts`。新增同族组件时补进对应 `index.ts`，别让调用方深挖路径。

**命名约定**：布局/外壳用 `*.astro` 由 Layout 组合；交互状态用 `*.svelte`；运行时逻辑放 `src/scripts/` 并在模块顶层注册副作用、在换页时回收（参考 `src/scripts/landing/index.ts:576-600` 的 `initLanding` + `astro:before-swap` 清理 + `astro:page-load` 重挂模式）。

## 10. 主要第三方集成（一句话一个）

- **Pagefind 全文搜索**：构建后 CLI 生成索引，生产环境前端加载 `/pagefind/pagefind.js` 做本地检索（`package.json:16`、`src/components/organisms/navigation/Navbar.astro:284-285`、`pagefind.yml`）。
- **Swup 换页**：`@swup/astro` 替换 `main` 容器实现无刷新导航，起始页被 `ignore` 排除（`astro.config.mjs:60-107`）。
- **Sentry + Spotlight 错误上报**：作为 Astro 集成加入，无额外配置代码（`astro.config.mjs:161-162`）。
- **oddmisc（Umami 统计）**：Astro 集成，`shareUrl: false`（`astro.config.mjs:55-59`）。另有 GTM/Clarity 走 `AnalyticsScripts`，监听 `scroll/mousemove/keydown/touchstart/click`，首次交互或 10 秒后加载（`src/layouts/partials/AnalyticsScripts.astro:80-113`）。
- **Twikoo / Giscus 评论**：二选一，由 `commentConfig.system` 决定；当前总开关关闭（`src/config.ts:428-449`，渲染门 `src/components/comment/index.astro:35`）。
- **Pio Live2D 看板娘**：`client:visible` 按需水合，模型在 `public/pio/`（`src/config.ts:650-673`、`src/layouts/Layout.astro:241`）。

## 11. 部署与 CI

`.github/workflows/` 下有四个工作流，注意它们盯的分支并不一致：

| 文件 | 触发分支 | 做什么 |
| --- | --- | --- |
| `CI.yml` | `master` | `pnpm astro check` + `pnpm build`（`ENABLE_CONTENT_SYNC: false`） |
| `lint.yml` | `master` | ESLint 出 JSON 报告 + `astro check` 类型检查 |
| `build.yml` | `main` | `astro check` + `astro build` |
| `deploy.yml` | `main` | `pnpm run build` 后用 `JamesIves/github-pages-deploy-action` 推 `dist/` 到 `pages` 分支 |

本仓库当前默认分支是 `master`。以下几点是已知的、上手前应当知道的坑：

- `deploy.yml:8` 的 `repository_dispatch:` 被错误地缩进到 `branches:` 底下，这段 YAML 本身是坏的，GitHub 无法按预期解析内容更新触发。
- `deploy.yml`（`deploy.yml:7`）与 `build.yml`（`build.yml:5`、`:7`）都盯着 `main`，而远端没有这个分支；真正跑 CI 的是 `CI.yml` / `lint.yml` 的 `master`。
- 部署产物落在 `pages` 分支（`deploy.yml:52`），不是默认分支。

## 12. 新人最容易踩的反直觉点

1. **「首页」≠ `/`**。站点根 `/` 是起始页（开屏动画 + 进入按钮），文章列表退到 `/home/`。判首页必须用 `HOME_PATH`（`src/constants/constants.ts:14`），写死 `"/"` 语义已变。消费点见 `src/layouts/Layout.astro:42`、`src/layouts/MainGridLayout.astro:54`、`src/utils/navigation-utils.ts:254-257`。
2. **根路径起始页不做 Swup**，任何「点向 `/` 或从 `/` 出发」的跳转都靠 `ignore` 回调 + `popstate` reload 兜底（上文第 4 节）。
3. **默认主题是暗色**，且真源只有一处 `DEFAULT_THEME`（`src/constants/constants.ts:20`）。首帧脚本与 swup 换页同步都从它取值（`src/scripts/core/swup-config.ts:101`），改别处会「首屏暗、一导航变亮」。
4. **Tailwind 没有 JS 配置**，改断点/主题色要去 `src/styles/main.css` 的 `@theme`。
5. **`npx astro build` 不跑 pagefind 和字体压缩**，正式构建必须走 `package.json:16` 的 `build`；但该脚本的前置钩子会 git 提交（见第 2 节）。
6. **包管理器只能是 pnpm**，`npm install` 会被 `preinstall` 拦下（见第 1 节）。
7. **`/start` 重定向只写在 `redirects` 里、且只写不带斜杠的键**（`astro.config.mjs:50-52`）。因为 `trailingSlash: "always"`（`astro.config.mjs:41`）会把 `/start/` 归一成同一路由，两条都写会报「defined in both」（注释 `astro.config.mjs:45-49`）。
8. **自动缩放会影响所有 rem**：1281–1700px 区间根字号被压到 85%（`src/layouts/partials/HeadTags.astro:147-186`），用 `clamp()` 算尺寸时上限会与预期不符。
9. **两套生命周期事件并存**（Swup hooks vs `astro:*`，见第 6 节），同一件事别注册两遍。
10. **内容与代码分离已配置但当前未生效**：构建实际读取主仓库本地、已跟踪的 `src/content/posts` 等目录；`content/` 那个独立克隆因为目录结构与脚本预期对不上，四个映射全被跳过（见第 3 节）。改文章前先确认同步是否真的生效。

## 相关文件

- `package.json` — 依赖清单与脚本矩阵；版本号、pnpm 强制、pre* 钩子的来源。
- `.npmrc` — 声明包管理器版本管理，配合 `preinstall` 锁死 pnpm。
- `astro.config.mjs` — Astro 与全部集成的配置；`output`、`swup.ignore`、`redirects`、markdown 插件流水线都在这里。
- `.env` / `scripts/load-env.js` — 内容分离相关的环境变量与加载逻辑。
- `scripts/sync-content.js` — `predev`/`prebuild` 钩子脚本，负责内容同步（含 git 提交，勿盲跑）。
- `src/content.config.ts` — Content Layer 集合定义（posts / spec 的 loader 与 schema）。
- `src/config.ts` — 站点、导航、侧栏、第三方开关的唯一数据源。
- `src/constants/constants.ts` — `HOME_PATH`、`PAGE_SIZE`、`DEFAULT_THEME`、Banner 高度等常量。
- `tsconfig.json` — 路径别名与类型检查选项。
- `src/layouts/Layout.astro` — 最外层 HTML 外壳，挂载 HeadTags / ConfigCarrier / Swup 管理器 / 代码块折叠与性能优化脚本。
- `src/layouts/MainGridLayout.astro` — 内容页栅格外壳，产出 `#main-grid` 与 `<main id="swup-container">`。
- `src/layouts/partials/HeadTags.astro` — head 内联首屏脚本（主题、色相、banner 高度、页面缩放）与 Iconify preconnect。
- `src/layouts/partials/AnalyticsScripts.astro` — GTM / Clarity 交互后延迟加载。
- `src/components/misc/ConfigCarrier.astro` — 把 TOC 配置（enable/depth/useJapaneseBadge）挂到 `window.siteConfig.toc`。
- `src/components/misc/IconifyLoader.astro` — 运行期注入 `iconify-icon` web component，兜底构建期未内联的图标。
- `src/components/comment/index.astro` — 评论区渲染门（`commentConfig.enable && commentEnabled && path`）。
- `src/components/organisms/navigation/Navbar.astro` — 导航与全部 `client:only` 交互入口；生产环境内联 Pagefind 加载器。
- `src/scripts/swup-manager.ts` — Swup 管理器入口与起始页历史导航兜底。
- `src/scripts/core/swup-config.ts` — Swup 选择器、过渡动画、主题/滚动/性能配置常量。
- `src/scripts/core/swup-hooks.ts` — 全部 Swup 生命周期钩子的注册点。
- `src/scripts/landing/index.ts` — 起始页运行时逻辑与「init + 回收」模式。
- `src/scripts/code-collapse.js` / `src/scripts/theme-optimizer.js` — Layout 挂载的另两个全局运行时脚本。
- `src/pages/index.astro` — 起始页路由（占用根路径）。
- `src/pages/home/[...page].astro` — 分页文章列表（真正的「首页」）。
- `src/pages/posts/[...slug].astro` — 文章页；`render(entry)` 产出正文与目录。
- `src/pages/[...permalink].astro` — 全局/自定义 permalink 的文章页路由。
- `src/pages/og/[...slug].png.ts` — 构建期 OG 图生成（satori + sharp）。
- `src/pages/rss.xml.ts` / `src/pages/atom.xml.ts` / `src/pages/api/*.json.ts` — 构建期生成的静态接口文件。
- `src/styles/main.css` — Tailwind v4 入口、`@theme` 令牌与 dark variant。
- `pagefind.yml` — 搜索索引排除选择器。
- `.github/workflows/` — CI / lint / build / deploy 四个工作流（注意分支与 `deploy.yml` 的已知问题）。
