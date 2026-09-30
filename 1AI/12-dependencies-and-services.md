# 12 · 外部依赖与第三方服务

这一块回答「这个站依赖了哪些外部东西、各自负责什么、失效了会怎样」。遇到「线上某个数字/图标/评论不显示」「构建卡住或报错」「做安全评估时该盯哪些密钥」这类问题，先翻它。

本项目是纯静态站（`output: "static"` 在 `astro.config.mjs:43`），因此外部依赖天然分成两类：**构建期**在 Node 里跑，失败直接影响产出；**运行期**在访客浏览器里跑，失败通常只是单点降级。下文每一条都会标明它属于哪边。

一个贯穿全文的前提：几乎所有「第三方服务」在本仓库里**当前都是关闭或半关闭状态**（统计关、评论关、番剧数据本地化）。默认真正在线的只有 Google Tag Manager、内容仓库同步和几个 CDN。配置项写了却没生效的地方会逐个点明——这是新人最容易照配置名去排查、却在代码里找不到开关的坑。

---

## 1. 构建期与运行期总览

| 阶段 | 谁在跑 | 典型成员 | 挂了的表现 |
| --- | --- | --- | --- |
| 构建期 | 本机 / CI 的 Node | `sharp`、`satori`、`pagefind`、`fontmin`（经 `compress-fonts.js`）、`markdown-it`/`sanitize-html`（RSS）、`crypto-js`（文章加密）、`astro-icon`，以及 `sync-content.js` 的 git 网络操作 | 构建报错或产出缺内容；`pnpm build` 直接失败 |
| 运行期 | 访客浏览器 | `@iconify/svelte`、`iconify-icon` 组件、`@fancyapps/ui`、`qrcode`、`swup`、Giscus / Twikoo / Meting 的 CDN 请求 | 单点功能降级（图标出不来、评论区空白、海报生成失败），页面其余部分照常 |

### 1.1 正式构建链是四段

`package.json:16` 的 `build` 脚本串了四段：

```
node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

`astro build` 只是第二段。**只跑 `npx astro build` 不会生成 Pagefind 索引，也不会做字体子集压缩**。当前 `dist/assets/font/` 里只有 `ZenMaruGothic-Medium.ttf` 与 `loli.ttf` 两个原文件、没有 `.woff2`，正是因为产出只经过了第二段。

### 1.2 构建期真实的网络依赖有两个，不止番剧

这是最容易被漏掉的一点。

1. **内容仓库同步**。`predev`（`package.json:8`）与 `prebuild`（`package.json:9`）会先跑 `node scripts/sync-content.js`。`.env:13` 的 `ENABLE_CONTENT_SYNC=true` 让脚本默认开启（`scripts/sync-content.js:15` 的判定是「不等于 false 即启用」），`.env:19` 的 `CONTENT_REPO_URL` 指向 GitHub。脚本在 `scripts/sync-content.js:46` 执行 `git clone --depth 1`，目录已存在时改走 `:69` 的 `git fetch --all` + `:83-84` 的 `git checkout` / `git reset --hard`。所以**即使 `anime.mode` 是 `local`，`pnpm build` 的构建期也会发起外部网络请求**——没有网络或 GitHub 不可达时，这里就是卡住点。
2. **番剧数据更新**（条件触发）。`build` 链第一段的 `update-anime.mjs` 会读 `anime.mode`（`src/config.ts:90`，当前 `"local"`），非 `bilibili`/`bangumi` 时直接跳过（`scripts/update-anime.mjs:52-60`），此时不发请求。改成对应 mode 后才会打 `api.bilibili.com` / `api.bgm.tv`。

> 注意 `sync-content.js` 的结尾还有副作用：`:157` 的 `git add .` 加 `:159-162` 的 `git commit`。它不是单纯的拉取脚本，会在无提示的情况下把工作区改动提交。这既是「别直接跑 `pnpm dev` / `pnpm build`」的原因，也是排查「构建完莫名其妙多一个 commit」的答案。

---

## 2. 运行时依赖分类表

下表版本取自 `package.json` 的声明范围（非锁文件实解析值）。「拿掉会怎样」指移除该依赖后最直接的后果。

### 2.1 Astro 生态

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `astro` | `6.1.2` | 全站框架 | 整个项目不成立 |
| `@astrojs/svelte` | `8.0.4` | Svelte 岛屿（音乐播放器、搜索、主题切换等） | 所有 `.svelte` 组件无法编译，构建失败 |
| `@astrojs/mdx` | `^5.0.3` | 允许 `.mdx` 文章 | 用 `.mdx` 写的文章构建失败 |
| `@astrojs/rss` | `^4.0.18` | `src/pages/rss.xml.ts:3` 生成 RSS | `/rss.xml` 路由报错 |
| `@astrojs/sitemap` | `^3.7.2` | `astro.config.mjs:159` 集成，产出 `dist/sitemap-0.xml` | 没有 sitemap；IndexNow 提交脚本失去数据源 |
| `@astrojs/check` | `^0.9.8` | `pnpm check` 的类型/模板校验 | `astro check` 不可用 |

### 2.2 UI

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `svelte` | `^5.55.4` | 所有交互岛屿的运行时 | Svelte 组件全废 |
| `@iconify/svelte` | `^5.2.1` | `.svelte` 里的图标，如 `src/components/organisms/navigation/Search.svelte:4` | Svelte 岛屿里的图标全部消失 |
| `@fancyapps/ui` | `^6.1.13` | `src/scripts/handlers/fancybox-handler.ts:63` 动态 import，做图片灯箱 | 点击图片不再弹大图（降级） |
| `overlayscrollbars` | `^2.15.1` | 无 JS import；但被 `astro.config.mjs:230` 的 `optimizeDeps.include` 引用，且 `src/styles/scrollbar.css:3` 用 `.os-scrollbar` 系列类为其生成的 DOM 写样式 | **不是「只有属性」那么简单**：删包后 dev 预打包会解析失败，`scrollbar.css` 成死样式。当前应表述为「引用了但没有任何地方初始化」 |

### 2.3 样式

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `tailwindcss` + `@tailwindcss/vite` | `^4.2.2` | `astro.config.mjs` 的 Vite 插件；`src/styles/main.css:1` 的 `@import "tailwindcss"` | 全站样式失效 |
| `@tailwindcss/typography` | `^0.5.19` | `src/styles/main.css:16` 的 `@plugin`，文章正文排版 | 正文排版退化 |
| `stylus` | `^0.64.0` | `src/styles/variables.styl`、`markdown-extend.styl`（被 `Encryptor.astro` 等 import） | `.styl` 文件无法编译 |

> Tailwind v4 **没有 `tailwind.config.js`**：主题 token 直接写在 `src/styles/main.css:21` 的 `@theme {}` 里（`:20` 是「Migrate from v3 config」注释）。这是 v4 与 v3 的差异，详见姊妹篇 `07-styling.md`。

### 2.4 内容与 Markdown

这些几乎全是 `astro.config.mjs:164` 起的 `markdown.remarkPlugins` / `rehypePlugins` 数组成员，或 `src/plugins/` 下自写插件的底层工具。

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `remark-math` + `rehype-katex` + `katex` | `^6.0.0` / `^7.0.1` / `^0.16.45` | 数学公式渲染 | `$...$` 公式不再渲染。CSS 侧 `.katex*` 样式在 `src/scripts/handlers/scroll-handler.ts:18` 另有依赖 |
| `remark-directive` | `^3.0.1` | `astro.config.mjs:17` 导入，`:::note` 之类指令语法 | 指令语法失效。**注意**：真正解析指令节点的是本地文件 `src/plugins/remark-directive-rehype.js`（`astro.config.mjs:30` 导入其 `parseDirectiveNode`），npm 包 `remark-directive-rehype` 本身未被引用 |
| `remark-sectionize` | `^2.1.0` | 把段落包成 `<section>`，供 TOC 锚点 | 标题锚点行为异常 |
| `rehype-slug` / `rehype-autolink-headings` | `^6.0.0` / `^7.1.0` | 标题 id 与「#」锚点；`astro.config.mjs:212` 给锚点加 `data-pagefind-ignore`，避免被搜索索引（该 properties 块在 `:204-214`） | 目录跳转失效 |
| `rehype-external-links` | `^3.0.0` | `astro.config.mjs:177-181` 给外链加 `target="_blank"` 与 `rel="nofollow noopener noreferrer"` | 外链安全属性丢失 |
| `rehype-components` | `^0.3.0` | `astro.config.mjs:187-199` 把 `::github`、`::note` 等换成 Astro 组件 | 卡片/提示组件不渲染 |
| `markdown-it` + `node-html-parser` + `sanitize-html` | `^14.1.1` / `^7.1.0` / `^2.17.3` | RSS/Atom 生成提要正文 | 提要生成报错 |
| `hastscript` | `^9.0.1` | `src/plugins/rehype-*.mjs` 里构造 hast 节点（`h()`） | 自写 rehype 插件全部报错 |
| `unist-util-visit` | `^5.1.0` | 上述插件遍历 AST | 同上 |

> 自定义插件（`rehype-mermaid`、`rehype-image-width`、`rehype-wrap-table`、`rehype-component-*`、`remark-content` 等）在 `src/plugins/` 里，由 `astro.config.mjs:22-32` 逐个导入。要改渲染管线，先看 `astro.config.mjs:164` 起的 `markdown` 块，再看 `src/plugins/`。

### 2.5 代码高亮

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `astro-expressive-code` | `^0.41.7` | `astro.config.mjs:109` 的 `expressiveCode()` | 无代码高亮 |
| `@expressive-code/core` | `^0.41.7` | `src/plugins/expressive-code/custom-copy-button.ts:1`、`language-badge.ts:4` 的 `definePlugin` | 自写的复制按钮/语言角标插件编译失败 |
| `@expressive-code/plugin-collapsible-sections` | `^0.41.7` | `astro.config.mjs:112` 插件列表 | 长代码块折叠失效 |
| `@expressive-code/plugin-line-numbers` | `^0.41.7` | `astro.config.mjs:113` | 行号失效 |

代码块字体走 `expressiveCode.styleOverrides.codeFontFamily`（`astro.config.mjs:132-133`），首选 `"JetBrains Mono Variable"`——见第 4 节。

### 2.6 构建与图像

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `sharp` | `^0.34.5` | `src/pages/og/[...slug].png.ts:7` 把 satori 产出的 SVG 转 PNG；`scripts/convert-images.js:1` 把图片转 WebP | OG 图构建失败、图片转换脚本报错。它是原生模块，见第 8 节 postinstall 白名单 |
| `satori` | `^0.26.0` | `src/pages/og/[...slug].png.ts:6` 用 JSX 生成 OG 图 SVG | 同上 |
| `pagefind` | `^1.5.2` | 构建第三段 `pagefind --site dist`；前端在 `src/components/organisms/navigation/Navbar.astro:284` 起按 `/pagefind/pagefind.js` 加载 | 站内搜索失效（`Search.svelte:23` 有假数据兜底） |
| `fontmin`（devDep） | `^1.1.1` | `scripts/compress-fonts.js:4` 做字体子集化 | `compress-fonts.js` 崩溃，构建第四段失败 |

### 2.7 工具库

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `dayjs` | `^1.11.20` | `src/components/features/posts/LastModified.astro:5` 格式化「上次编辑」 | 构建/渲染报错 |
| `reading-time` | `^1.5.0` | `src/plugins/remark-content.mjs:1`，给文章算阅读时长 | 构建报错 |
| `qrcode` | `^1.5.4` | `src/components/misc/SharePoster.svelte:97` 动态 import，生成分享海报二维码 | 海报生成失败（客户端降级） |
| `crypto-js` | `^4.2.0` | `src/pages/[...permalink].astro:32`、`src/components/features/auth/Encryptor.astro:7` 做文章密码加密 | 加密文章功能报错 |
| `axios` | `^1.15.0` | 仅 `scripts/update-bilibili.mjs:4`（构建期脚本） | `pnpm update-bilibili` 失败 |
| `glob`（devDep） | `^13.0.6` | `scripts/convert-images.js:2` | 图片转换脚本失败 |
| `oddmisc` | `^1.1.6` | `astro.config.mjs:55-59` 的 `oddmisc()` 集成，注入 Umami 统计运行时 | 见 3.4 |

### 2.8 可观测与路由

| 包 | 声明版本 | 用在哪 | 拿掉会怎样 |
| --- | --- | --- | --- |
| `@sentry/astro` | `^10.49.0` | `astro.config.mjs:161` 的 `sentry()` | 见 3.2 |
| `@spotlightjs/astro` | `^3.2.6` | `astro.config.mjs:162` 的 `spotlightjs()` | 见 3.3 |
| `@swup/astro` | `^1.8.0` | `astro.config.mjs:60` 的无刷新换页 | 全站变普通整页跳转；`src/scripts/` 下大量 `swup:*` 生命周期代码变死代码 |

### 2.9 声明了却没在源码里用到的包

这些包在 `package.json` 有声明，但全仓库（含 `src/plugins`、`scripts`）找不到 import。分两种程度：

| 包 | 声明位置 | 现状 |
| --- | --- | --- |
| `@rollup/plugin-yaml` | `package.json:88` | 完全未被引用，`astro.config.mjs` 里也没有配置 |
| `@fontsource/roboto` | `package.json:38` | 完全未被引用；`--font-sans`（`src/styles/main.css:22`）里虽列了 `"Roboto"`，但没有加载字体文件，实际回退到系统字体 |
| `remark-directive-rehype` | `package.json:67` | 未被引用；真正干活的是本地插件 `src/plugins/remark-directive-rehype.js` |
| `marked` | `package.json:54` | 无 import，但被 `astro.config.mjs:232` 的 `optimizeDeps.include` 引用——**删除前需同步删掉该条目**，否则 dev 预打包解析失败 |
| `overlayscrollbars` | `package.json:57` | 无 import，但被 `astro.config.mjs:230` 的 `optimizeDeps.include` 与 `src/styles/scrollbar.css:3` 引用 |

---

## 3. 第三方服务逐个说明

### 3.1 内容仓库同步（构建期，默认开启）

- **接入点**：`package.json:8`（`predev`）、`package.json:9`（`prebuild`）→ `scripts/sync-content.js`。
- **开关**：`.env:13` 的 `ENABLE_CONTENT_SYNC=true`；脚本按「不等 false 即启用」判定（`scripts/sync-content.js:15`）。关闭后走本地内容，不联网。
- **网络行为**：目录不存在时 `git clone --depth 1 <CONTENT_REPO_URL> ./content`（`scripts/sync-content.js:46`）；已存在则 `git fetch --all --prune`（`:69`）后 `git checkout` + `git reset --hard origin/<branch>`（`:83-84`）。分支优先 `main`、取不到退回 `master`（`:75-80`）。
- **目录映射**：把内容仓库的 `posts`/`spec`/`data`/`images` 通过符号链接（Windows 无权限时退化为复制）接到 `src/content/posts`、`src/content/spec`、`src/data`、`public/images`（`scripts/sync-content.js:96-137`）。
- **副作用（重要）**：脚本结尾执行 `git add .`（`:157`）与 `git commit`（`:159-162`）。CI 里通过 `ENABLE_CONTENT_SYNC: false` 关掉（`.github/workflows/CI.yml:41`、`:66`），所以本地手动跑 `pnpm dev` / `pnpm build` 才会触发。
- **挂了**：克隆失败 `process.exit(1)`（`:53`），构建中止；fetch 失败只 `console.warn` 不中断（`:88`）。

### 3.2 Sentry（错误上报）

- **接入点**：`astro.config.mjs:161` 调用 `sentry()`，**没有传任何参数**（没有 `dsn`，也没有 `sourceMapsUploadOptions`）。
- **DSN 从哪来**：`@sentry/astro` 在没显式给 `dsn` 时会生成 `dsn: import.meta.env.PUBLIC_SENTRY_DSN`（`node_modules/@sentry/astro/build/esm/integration/snippets.js:38`）。
- **本仓库现状**：`.env` / `.env.example` 里都**没有** `PUBLIC_SENTRY_DSN`（两者只含 `ENABLE_CONTENT_SYNC`、`CONTENT_REPO_URL`、`CONTENT_DIR`、`INDEXNOW_KEY`、`INDEXNOW_HOST`、`BILI_SESSDATA` 六个键），仓库里也没有 `sentry.client.config.*` / `sentry.server.config.*` 文件。
- **结果**：构建照常通过，`Sentry.init` 收到 `undefined` 的 DSN，SDK 变成空操作——不上报、也不抛错。**缺 DSN 不是构建失败，是「静默没生效」**，排查时不要往构建日志里找。
- **要真的启用**：设置 `PUBLIC_SENTRY_DSN`，或改成 `sentry({ dsn: "..." })`。若要上传 source map，还需 `SENTRY_AUTH_TOKEN` 与 `sourceMapsUploadOptions`（当前都没开）。
- **挂了**：服务端不可达时客户端 SDK 静默重试/丢弃，不影响渲染。

### 3.3 Spotlight（开发期调试）

- **接入点**：`astro.config.mjs:162` 的 `spotlightjs()`。
- **只在 dev 生效**：`@spotlightjs/astro` 的 `astro:config:setup` 里判断 `command === "dev"` 才注入服务端片段、加 Vite 插件与开发工具栏（`node_modules/@spotlightjs/astro/src/index.ts:25`）。`astro build` 走不进这个分支，等价于 no-op。
- **顺序要求**：README 要求 `sentry()` 排在 `spotlightjs()` 之前，`astro.config.mjs:161-162` 满足。
- **别混淆**：项目里另有 `data-lp-spotlight` 之类的命名，那是起始页卡片的高光跟随鼠标效果，**和 Spotlight 调试器无关**。

### 3.4 oddmisc 的 Umami 统计

- **接入点**：`astro.config.mjs:55-59`：

  ```js
  oddmisc({
      umami: { shareUrl: false },
  }),
  ```

- **`shareUrl: false` 的含义**：它是 oddmisc 的「跳过集成」开关（`node_modules/oddmisc/dist/astro/index.js:8` 的 `if (!shareUrl) return`；类型见 `node_modules/oddmisc/dist/astro/index.d.ts`：`shareUrl: string | false`），为假就不注入任何脚本。
- **后果**：页面里**不会**注入 Umami 运行时，`window.oddmisc` 始终不存在。于是两处统计容器永远隐藏：
  - 侧栏「站点统计」：`src/components/widgets/profile/Profile.astro:129` 起，拿不到 `window.oddmisc` 时给容器加 `hidden`；
  - 文章页「浏览量」：`src/components/features/posts/PostMeta.astro:119` 起，同样直接 `classList.add('hidden')`。
- **要启用**：把 `shareUrl` 改成 Umami 实例的分享地址，形如 `https://umami.example.com/share/abc123`。只改 `astro.config.mjs`——`src/config.ts:701` 的注释也说明统计配置已从 `config.ts` 移走。
- **挂了**：分享接口不可达时 `getSiteStats()` 抛错，组件 catch 后隐藏数字，页面其余部分正常。

### 3.5 IndexNow（向搜索引擎提交 URL）

- **接入点**：`scripts/indexnow-submit.js`，由 `pnpm submit`（`package.json:17`）手动触发，**不在 `build` 链里**。
- **数据源**：读构建产物 `dist/sitemap-0.xml`；文件不存在会直接 `process.exit(1)` 并提示先构建。所以它必须在一次成功构建之后运行。
- **密钥/环境变量**：`INDEXNOW_KEY`、`INDEXNOW_HOST`（`scripts/indexnow-submit.js:47-49`）。缺失时打印错误并 `return`（`:51-57`，不是崩溃）。key 验证文件约定放在 `https://{host}/{key}.txt`（`:49`）。
- **提交目标**：`https://api.indexnow.org/IndexNow`（`scripts/indexnow-submit.js:66`），一次最多 10000 个 URL（`:40`）；提交前会按 `INDEXNOW_HOST` 过滤 sitemap URL，所以 host 必须和 `siteConfig.siteURL`（`src/config.ts:29`，当前 `https://mlfk.pages.dev/`）的域名一致。
- **本仓库现状**：`.env` 当前与 `.env.example` 一样是占位值（`asdf1213456` / `your.example.com`），并未填入真实密钥，所以 IndexNow 实际不可用。
- **挂了**：手动跑，失败只影响提交那一次，不影响站点。

### 3.6 B 站 / Bangumi / 番剧数据

番剧页当前是**本地数据**，整条网络链路默认不触发。

- **总开关**：`src/config.ts:90` 的 `anime.mode` 当前是 `"local"`。
- **调度脚本**：`scripts/update-anime.mjs:52-60` 读 `anime.mode`，`bilibili` → `update-bilibili.mjs`，`bangumi` → `update-bangumi.mjs`，其它值跳过。`build` 链第一段就是它，所以 `mode: "local"` 下番剧这条链路不发请求（但见 1.2 的内容仓库同步，构建期仍有别的网络请求）。
- **Bangumi**：`scripts/update-bangumi.mjs:5` 的 `API_BASE = "https://api.bgm.tv"`，读 `bangumi.userId`（`src/config.ts:72`，当前是占位值 `your-bangumi-id`），产出 `src/data/bangumi-data.json`（`:12`）。
- **Bilibili**：`scripts/update-bilibili.mjs:9` 的 `API_BASE = "https://api.bilibili.com/x/space/bangumi/follow/list"`，读 `bilibili.vmid`（`src/config.ts:77`，当前是真实 UID `308857431`），产出 `src/data/bilibili-data.json`（`:17`）。
  - **密钥**：观看进度需要 `SESSDATA`。脚本从环境变量 `BILI_SESSDATA` 读取（`scripts/update-bilibili.mjs:66`），并放进请求 cookie（`:135`）。`src/config.ts:85` 的注释明确要求**只走 `.env` 或 GitHub Secret，绝不硬编码**，并附了凭证泄露后的吊销步骤。CI 的 build job 通过 `secrets.BILI_SESSDATA` 注入（`.github/workflows/CI.yml:67`）。
- **两处 `.json` 都被 `.gitignore`**（`.gitignore:51`、`:54`），当前也不存在。缺文件时 `loadAnimeData` 只 `console.warn` 并返回空数组（`src/utils/anime-data.ts:49-50`），不报错。
- **dev 下的额外规则（易误读）**：`src/utils/anime-data.ts:82-93` 给 `bilibili` 和 `bangumi` 都写死了 `fetchOnDev: undefined`，`:109` 的 `currentConfig.fetchOnDev ?? false` 恒为 false，所以 **dev 下两种 json 数据一律跳过加载**。`src/config.ts:73` / `:78` 里那两个 `fetchOnDev` 从未被 `src` 读取，是死配置——即便把 `mode` 改成 `bilibili`，也不会因为它触发 dev 拉取。
- **挂了**：`mode: "local"` 下 B 站/Bangumi 全挂也不影响构建与番剧页——页面读 `src/data/anime.ts` 的硬编码列表。

### 3.7 Twikoo 与 Giscus（评论后端）

评论总开关是关的：`src/config.ts:429` 的 `commentConfig.enable = false`，`src/components/comment/index.astro:21` 据此决定是否渲染整块。

| 系统 | 部署位置 / 接入点 | 现状与风险 |
| --- | --- | --- |
| Twikoo | `src/config.ts:432` 的 `envId: "https://twikoo.vercel.app"` | 这是 Twikoo 的**公共演示部署**，不是本项目实例。前端脚本却从本地加载 `/assets/js/twikoo.all.min.js`（`src/components/comment/Twikoo.astro:22`）。若直接开 `enable` 而不改 `envId`，评论会写到别人的演示后端 |
| Giscus | `src/config.ts:435-448` | `repo`/`repoId`/`categoryId` 全是 `your-*` 占位（`:436-439`）。前端脚本从 `https://giscus.app/client.js` 加载（`src/components/comment/Giscus.astro:49`），需要真实 GitHub 仓库开启 Discussions 才能工作 |

- 换评论系统的开关是 `commentConfig.system`（`"twikoo" | "giscus"`，`src/config.ts:430`）。
- **挂了**：两者都是纯客户端组件，后端不可达时评论区空白，正文照常。

### 3.8 Google Tag Manager 与 Microsoft Clarity

- **GTM**：**默认启用**。`src/layouts/partials/AnalyticsScripts.astro:22` 的 `gtmId` 默认硬编码为 `GTM-KRX3XGVH`，`Layout.astro:171-173` 调用时只传 `thirdPartyAnalytics`、不传 `gtmId`，所以该 ID 生效；`Layout.astro:221` 的 `<noscript>` iframe 里也硬编码了同一个 ID（两处要一起改）。
- **加载策略**：`AnalyticsScripts.astro:81-113` 用「用户交互后（scroll/click/...）或 10 秒超时」再注入 GTM/Clarity（`:109-113`），目的是不拖累首屏指标。
- **Clarity**：由 `siteConfig.thirdPartyAnalytics`（`src/config.ts:240-243`）控制，当前 `enable: false`，不加载；加载地址在 `AnalyticsScripts.astro:73`。
- **挂了**：两者都是纯前端脚本，CDN 不可达只是统计缺失。

### 3.9 其余运行期外链

| 服务 | 接入点 | 用途 / 挂了会怎样 |
| --- | --- | --- |
| Iconify CDN `code.iconify.design` | `src/components/misc/IconifyLoader.astro:108`、`src/utils/icon-loader.ts:103` | 加载 `iconify-icon` Web Component。挂了用该组件的图标显示 fallback（见第 6 节） |
| Iconify API `api.iconify.design` | `src/layouts/partials/HeadTags.astro:99` 预连接；`@iconify/svelte` 运行时按需拉图标数据（`Search.svelte:4`） | `.svelte` 图标靠它。挂了 Svelte 岛屿里的图标空白 |
| Google Fonts `fonts.googleapis.com` | `src/pages/og/[...slug].png.ts:51`（构建期拉 Noto Sans SC） | **仅当 `siteConfig.generateOgImages` 为真**（`src/config.ts:203`，当前 `false`）才执行；否则 `getStaticPaths` 返回空（`:24-26`） |
| `images.weserv.nl` 图片代理 | `src/components/misc/utils/poster-renderer.ts:43` | 分享海报里跨域封面图加载失败时的兜底代理。挂了海报里封面可能空白 |
| Meting API | `src/config.ts:472-473` 的 `meting_api`（当前 `https://meting.mysqil.com/...`）；兜底常量 `https://www.bilibili.uno/api?...`（`src/components/widgets/music-player/constants.ts:44`） | 音乐播放器歌单源。当前 `musicPlayerConfig.mode = "local"`（`src/config.ts:471`），用本地播放列表，`fetch(apiUrl)`（`src/components/widgets/music-player/hooks/usePlaylist.ts:140`）不触发 |
| Giscus `giscus.app` | `src/components/comment/Giscus.astro:49` | 见 3.7 |

---

## 4. 端点与密钥速查表

排查外部问题时先按这张表定位，不必逐节翻。

### 4.1 外部端点

| 端点 | 出处 | 阶段 / 状态 |
| --- | --- | --- |
| `www.googletagmanager.com/gtm.js` | `src/layouts/partials/AnalyticsScripts.astro:59` | 运行期，默认开启 |
| `www.googletagmanager.com/ns.html` | `src/layouts/Layout.astro:221` | 运行期，noscript 兜底 |
| `www.clarity.ms/tag/` | `src/layouts/partials/AnalyticsScripts.astro:73` | 运行期，默认关闭 |
| `code.iconify.design` | `src/components/misc/IconifyLoader.astro:108`、`src/utils/icon-loader.ts:103` | 运行期，按需 |
| `api.iconify.design` | `src/layouts/partials/HeadTags.astro:99`、`Search.svelte:4` | 运行期，按需 |
| `fonts.googleapis.com` | `src/pages/og/[...slug].png.ts:51` | 构建期，仅 `generateOgImages` 开 |
| `images.weserv.nl` | `src/components/misc/utils/poster-renderer.ts:43` | 运行期，海报兜底 |
| `api.bgm.tv` | `scripts/update-bangumi.mjs:5`、`scripts/compress-fonts.js:521` | 构建期，仅 `mode=bangumi` |
| `api.bilibili.com` | `scripts/update-bilibili.mjs:9` | 构建期，仅 `mode=bilibili` |
| `meting.mysqil.com` | `src/config.ts:472-473` | 运行期，仅 `mode=meting` |
| `www.bilibili.uno/api` | `src/components/widgets/music-player/constants.ts:44` | 运行期兜底 |
| `api.indexnow.org/IndexNow` | `scripts/indexnow-submit.js:66` | 手动脚本 |
| `twikoo.vercel.app` | `src/config.ts:432` | 运行期，评论默认关 |
| `giscus.app/client.js` | `src/components/comment/Giscus.astro:49` | 运行期，评论默认关 |
| `github.com/MLFK-MLFK/Mizuki-MLFK.git` | `.env:19`（`CONTENT_REPO_URL`） | 构建期，默认开启（见 3.1） |

### 4.2 密钥与凭证暴露面

| 名称 | 位置 | 现状 / 处理 |
| --- | --- | --- |
| `PUBLIC_SENTRY_DSN` | `@sentry/astro` 自动读（`node_modules/@sentry/astro/build/esm/integration/snippets.js:38`） | 当前未设置 → Sentry 静默空转。要让 Sentry 真正工作才需配置 |
| `SENTRY_AUTH_TOKEN` | 仅 source map 上传需要 | 当前未使用 |
| `BILI_SESSDATA` | `scripts/update-bilibili.mjs:66`；CI 用 `secrets.BILI_SESSDATA`（`.github/workflows/CI.yml:67`） | 账号凭证，只允许走 `.env` / GitHub Secret，绝不硬编码（`src/config.ts:85`）。仅 `mode=bilibili` 构建时用到 |
| `INDEXNOW_KEY` / `INDEXNOW_HOST` | `scripts/indexnow-submit.js:47-49` | 仅手动 `pnpm submit` 时用 |
| Giscus `repoId` / `categoryId` | `src/config.ts:437-439` | 前端公开值，非密钥，但必须与真实 GitHub Discussions 对应 |
| `CONTENT_REPO_URL` | `.env:19` | 内容仓库地址；若含私有仓库 token 需特别留意 |

---

## 5. 字体来源

字体分三套并存，各管一段，互不覆盖：

| 字体 | 来源 | 加载方式 | 作用域 |
| --- | --- | --- | --- |
| JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono` | `src/components/misc/Markdown.astro:3` 直接 `import`，由 Vite 打包成 `dist/_astro/jetbrains-mono-*.woff2`（拉丁/西里尔/希腊等子集） | 代码块/等宽文本（`expressiveCode` 的 `codeFontFamily` 首选它，`astro.config.mjs:132-133`） |
| Roboto | `@fontsource/roboto` | **未发现任何 import**（全仓库只有 `Markdown.astro:3` 引了 jetbrains） | `src/styles/main.css:22` 的 `--font-sans` 把它列在首位，但没加载文件，实际回退到下一项（见 2.9） |
| 站体自定义字体 | 本地 TTF：`public/assets/font/ZenMaruGothic-Medium.ttf`、`loli.ttf` | `src/styles/main.css:30-44` 的 `@font-face` 指向 `/assets/font/*.ttf`；字体栈在 `src/layouts/Layout.astro:128-158` 由 `siteConfig.font` 拼出 | 全站正文（ASCII 字体优先，CJK 字体回退） |

**子集压缩**：`scripts/compress-fonts.js` 读 `src/config.ts` 的 `font` 配置（`:214-232`），把 `public/assets/font/` 下的 TTF 按「站内出现过的字符集」用 fontmin 子集化并转 woff2，输出到 `dist/assets/font/`，再回写 `dist/` 里的 CSS，把 `url(...ttf)` 换成 `url(...woff2)`。ASCII 字体只保留 ASCII 子集，CJK 字体保留全站文本集合。找不到配置里声明的字体文件会收集错误并在结尾 `process.exit(1)`。

**换字体的操作方式**：

1. 把 TTF 放进 `public/assets/font/`；
2. 在 `src/styles/main.css` 加对应的 `@font-face`（`src/config.ts:215` 的注释明确这一点：自定义字体必须在 `main.css` 里引入）；
3. 改 `src/config.ts` 的 `asciiFont` / `cjkFont`（`fontFamily`、`localFonts`、`enableCompress`）；
4. 跑完整 `pnpm build`——子集化只在生产构建第四段发生，`astro dev` 里看到的是浏览器默认字体（`src/config.ts:216` 注释也这么说）。

> 子集化目前**只支持 TTF**（`compress-fonts.js` 对 `.woff2/.woff` 只做复制、不压缩）。`HeadTags.astro:95-96` 特意不再预加载字体，避免构建前 404。

---

## 6. 图标体系

本项目的图标有**两条独立管线**，理解这个才不会「装错包、改了不生效」。

### 6.1 构建期：astro-icon（`.astro` 文件）

- `astro.config.mjs:108` 的 `icon()`（`astro-icon` `^1.1.5`），组件从 `astro-icon/components` 导入，用 `name` 属性。
- 图标数据来自 `devDependencies` 里的 `@iconify-json/*`（`package.json:82-87`）：`fa7-brands`、`fa7-regular`、`fa7-solid`、`material-symbols`、`mdi`、`simple-icons`。astro-icon 把它们编译成内联 SVG。
- **加新图标集**：`pnpm add -D @iconify-json/<set>` 即可被自动识别，不需要改 `astro.config.mjs`（`icon()` 没传 `include` 白名单）。用**已装图标集里没有的图标名**时，构建期就找不到。
- **加单个本地 SVG**：放在 `src/icons/`（astro-icon 约定）。

### 6.2 运行期：iconify-icon Web Component / @iconify/svelte

- `.svelte` 文件用 `@iconify/svelte`（`icon` 属性），如 `src/components/organisms/navigation/Search.svelte:4`。它内部走 `loadIcons`，即**运行时向 Iconify 拉数据**，不依赖上面那些 `@iconify-json` 包。
- 需要 loading/fallback 的 `.astro` 场景用自定义组件 `src/components/atoms/Icon/Icon.astro`，它渲染原生 `<iconify-icon>`（`:40`），由 `code.iconify.design` 加载的 Web Component 提供渲染。向后兼容包装器是 `src/components/misc/Icon.astro`（已标 `@deprecated`，新代码从 `@components/atoms/Icon` 导入）。
- 加载器有**两份**实现，功能重叠：`src/components/misc/IconifyLoader.astro`（挂在 `src/layouts/MainGridLayout.astro:113`，只覆盖用 MainGridLayout 的内容页）和 `src/utils/icon-loader.ts`（单例工具类）。起始页 `/` 用 `Layout` 而非 `MainGridLayout`，所以起始页**不加载** IconifyLoader（它的卡片图标是内联 SVG）。
- 规范文档在 `docs/rule/07-icon-usage-specification.md`：三种用法的对照表、`name` 与 `icon` 的差异根因、尺寸对照表、决策流程图、常见错误。**新代码按它选用法，不要混用。**

---

## 7. 许可证与合规

仓库里同时存在三份「许可证」性质不同的东西：

| 文件 / 配置 | 内容 | 覆盖对象 |
| --- | --- | --- |
| `LICENSE` | Apache License 2.0 | **本项目的代码**（`README.md:16` 徽章、`:340` 都指向它） |
| `LICENSE.MIT` | MIT，`Copyright (c) 2023 saicaca` | 上游模板 **Fuwari**。`README.md:344` 说明本项目基于 Fuwari（MIT），并按规定保留原始版权与许可声明 |
| `licenseConfig`（`src/config.ts:386-390`） | `CC BY-NC-SA 4.0`，`enable` 为 `true` | **文章内容**的默认授权，由 `License.astro` 组件渲染 |

- `src/components/misc/License.astro` 是文章页底部的授权卡片：显示标题、链接、作者（默认取 `profileConfig.name`）、发布日期与许可名。调用点在 `src/pages/posts/[...slug].astro:332` 与 `src/pages/[...permalink].astro:240`，仅当 `licenseConfig.enable` 为真时渲染。
- 每篇文章可在 frontmatter 里覆盖 `licenseName` / `sourceLink` / `author`（组件 props）。
- 页面页脚另有一处第三方署名：主题链接指向 `https://github.com/LyraVoid/Mizuki`（`src/components/organisms/footer/Footer.astro:80`、`src/components/features/landing/LandingFooter.astro:48`），以及 ICP 备案外链 `icp.gov.moe`（`Footer.astro:88`）。

---

## 8. 部署与托管

站点是纯静态产物（`output: "static"`，`astro.config.mjs:43`），托管链路有三条并存的配置，实际用哪条要自己确认。

| 链路 | 配置文件 | 要点 |
| --- | --- | --- |
| Vercel | `vercel.json` | `buildCommand: "pnpm build"`（`:2`）、`outputDirectory: "dist"`（`:3`）、`installCommand: "pnpm install"`（`:4`）、`framework: "astro"`（`:5`）。`:6-26` 定义了一组安全响应头（`X-Content-Type-Options`、`X-Frame-Options: DENY`、`X-XSS-Protection`、`Referrer-Policy`），`:28-36` 给 `/_astro/*` 加一年期不可变缓存，`:38` 开 `cleanUrls`。注意它跑的是完整 `pnpm build`，会触发 `prebuild` 的内容同步 |
| Cloudflare Pages | `src/config.ts:29` 的 `siteURL: "https://mlfk.pages.dev/"` | 站点 `site`（`astro.config.mjs:39`）用的就是它。IndexNow 的 host 过滤必须与这个域名一致（见 3.5） |
| GitHub Pages | `.github/workflows/deploy.yml` | 用 `JamesIves/github-pages-deploy-action@v4`（`:50`）把 `dist` 推到 `pages` 分支。**但该 workflow 的 YAML 已损坏**：`repository_dispatch:` 被错误缩进到 `branches:` 底下（`:8`），且监听远端并不存在的 `main` 分支（`:7`，仓库当前分支是 `master`）。当前不会正常触发 |

> 安全响应头只在 Vercel 的 `vercel.json` 里声明；若实际托管在 Cloudflare Pages 或 GitHub Pages，这些头不会自动生效，需要在对应平台另配。

---

## 9. 供应链、CI 与构建环境

### 9.1 包管理器与依赖更新

| 机制 | 位置 | 含义 |
| --- | --- | --- |
| 包管理器锁定 | `package.json:111` 的 `"packageManager": "pnpm@10.33.0"` + `package.json:24` 的 `preinstall: npx only-allow pnpm` | 用 npm/yarn 安装会被 preinstall 拦下，强制 pnpm |
| `manage-package-manager-versions = true` | `.npmrc:1` | Corepack 按 `packageManager` 字段自动切到指定 pnpm 版本，避免各人版本漂移 |
| postinstall 白名单 | `pnpm-workspace.yaml:1-6` 的 `onlyBuiltDependencies`：`@parcel/watcher`、`esbuild`、`sharp`、`swup`、`ttf2woff2` | pnpm 默认不执行依赖的构建脚本；这里显式放行这五个需要原生/二进制构建的包。**往 dependencies 加新的原生模块时，若它靠 postinstall 下载二进制，必须加进这份名单**，否则装完不可用 |
| Dependabot 策略 | `.github/dependabot.yml` | npm 生态、月更；`patch-updates` 与 `minor-updates` 分组（分支名分隔符 `-`）；`ignore` 掉所有 semver-major（`:20-22`），即大版本升级必须手动做 |

### 9.2 Node.js 版本没有统一约束

`package.json` 里**没有 `engines` 字段**，各处 Node 版本由 CI 各自指定，且互不一致：

| 位置 | 版本 |
| --- | --- |
| `.github/workflows/CI.yml:28`、`:53` 及 `lint.yml:28`、`:61` | `lts/*` |
| `.github/workflows/build.yml:20`、`:51` | 矩阵 `[22, 23]` |
| `.github/workflows/deploy.yml:31` | 固定 `"20"` |

新人本地用什么版本没有硬性约束；CI 上三套不同版本跑同一份代码，是排查「本地能构建、CI 不能」时需要先对齐的变量。

### 9.3 四个 GitHub Actions 工作流

| 文件 | 触发分支 | 内容 | 现状 |
| --- | --- | --- | --- |
| `.github/workflows/CI.yml` | `master`（`:5`、`:7`） | `check` job 跑 `pnpm astro check`（`:39`）、`build` job 跑 `pnpm build`（`:64`），均设 `ENABLE_CONTENT_SYNC: false`（`:41`、`:66`），build 注入 `secrets.BILI_SESSDATA`（`:67`） | 有效，是当前主 CI |
| `.github/workflows/lint.yml` | `master`（`:5`、`:7`） | `eslint` job 跑 `pnpm lint` 并把结果传 artifact（`:40`、`:45`），`typecheck` job 跑 `pnpm astro check`（`:70`） | 有效 |
| `.github/workflows/build.yml` | `main`（`:5`、`:7`） | 矩阵 Node 22/23 跑 `astro check` 与 `astro build` | **不会触发**，分支对不上 |
| `.github/workflows/deploy.yml` | 本意 `main` + `repository_dispatch` | 构建后推 `pages` 分支 | **YAML 损坏**（`:8` 缩进错误），且分支不存在 |

> 注意：`CI.yml` / `build.yml` 的 `build` 命令在 `ENABLE_CONTENT_SYNC: false` 下不联网拉内容；但 `deploy.yml:42` 跑的是 `pnpm run build`，仍会触发 `prebuild`。修复 deploy.yml 时要把内容同步的开关一并考虑。

### 9.4 Pagefind 搜索索引配置

`pagefind.yml:1-6` 用 `exclude_selectors` 排除以下内容，决定搜索索引收录什么：

```yaml
exclude_selectors:
  - "span.katex"
  - "span.katex-display"
  - "[data-pagefind-ignore]"
  - ".search-panel"
  - "#search-panel"
```

意思是不把数学公式、带 `data-pagefind-ignore` 的元素（如 `astro.config.mjs:212` 给标题锚点加的标记）、以及搜索面板自身抓进索引。改搜索关键词命中范围时，先看这个文件，再看 `Navbar.astro:284` 的加载逻辑。

---

## 10. 反直觉清单（新人最容易踩）

1. **构建期真的会联网**：`prebuild` 的 `sync-content.js` 在默认配置下会 `git clone` / `git fetch` 内容仓库，并可能 `git add .` + `git commit`（`scripts/sync-content.js:157-162`）。这是「构建卡住」和「莫名多一个 commit」的共同源头。
2. **统计关着**：`astro.config.mjs:57` 的 `shareUrl: false` 让 `window.oddmisc` 永远不存在，侧栏/文章的浏览数据容器永远 `hidden`。看到统计代码在却不出数，先查这里，别去查网络请求。
3. **Sentry 是「静默空转」而非报错**：没有 `PUBLIC_SENTRY_DSN` 时构建成功、SDK 无操作。别在生产日志里找 Sentry 的错误。
4. **Spotlight 只在 dev**：`@spotlightjs/astro` 的 dev 分支判断（`node_modules/@spotlightjs/astro/src/index.ts:25`），构建期等于没装。项目里 `data-lp-spotlight` 是 CSS 效果，与它无关。
5. **`@fontsource/roboto` 装了但没引用**：找不到该包的任何 import，`dist/` 里也没有 Roboto 字体文件；`--font-sans` 里的 `"Roboto"` 实际不生效（回退回系统字体）。同类还有 `@rollup/plugin-yaml`、`remark-directive-rehype`。
6. **`marked` / `overlayscrollbars` 没有 import，但不能直接删**：二者都被 `astro.config.mjs:230`、`:232` 的 `optimizeDeps.include` 引用，`overlayscrollbars` 还被 `scrollbar.css:3` 引用。删除前要同步清掉这些引用。
7. **构建链第一段的番剧更新默认不联网**：`anime.mode` 是 `"local"`（`src/config.ts:90`），`update-anime.mjs` 直接跳过 B 站/Bangumi。想验证番剧链路，得先改 mode。
8. **评论默认关闭，且两个后端的默认地址都不能直接用**：Twikoo 指向公共演示 `twikoo.vercel.app`（`src/config.ts:432`），Giscus 全是 `your-*` 占位（`:436-439`）。
9. **默认在线的第三方不止一个**：统计类只有 GTM 默认在线，但 Iconify（`code.iconify.design` / `api.iconify.design`）也在默认在线之列——`.svelte` 岛屿和 `<iconify-icon>` 都会联网。说「唯一默认在线」时指的是统计类。
10. **图标分两套**：`.astro` 走构建期内联（吃 `@iconify-json/*`），`.svelte` 走运行时 CDN（吃 Iconify API）。装包只影响前者，后者离线会空图标。
11. **`compress-fonts.js` 必须在 `astro build` 之后**：它读的是 `dist/`，不是 `src/`；单独跑只会在没有 `dist/` 时提示先构建。
12. **`.env` 里只有那六个键**：`ENABLE_CONTENT_SYNC`、`CONTENT_REPO_URL`、`CONTENT_DIR`、`INDEXNOW_KEY`、`INDEXNOW_HOST`、`BILI_SESSDATA`。其余服务（Sentry 的 `PUBLIC_SENTRY_DSN`、Umami）各走各的入口，别指望在 `.env` 里找。`.env` 被 `.gitignore:21` 忽略，`.env.example` 给的是占位值。
13. **`content/` 是另一个 Git 仓库的克隆**：被 `.gitignore:25` 忽略，由 `prebuild` 的 `sync-content.js` 拉取。见第 1 条。

---

## 相关文件

- `package.json` —— 全部依赖声明与构建脚本；`build` 四段链在 `:16`，`prebuild` 在 `:9`。
- `astro.config.mjs` —— 集成清单：oddmisc/Swup/icon/expressive-code/Svelte/sitemap/mdx/Sentry/Spotlight，`optimizeDeps` 白名单。
- `src/config.ts` —— 站点配置中枢；本块相关的有 `siteURL`（`:29`）、`bangumi`（`:71`）、`bilibili`（`:76`）、`anime`（`:89`）、`generateOgImages`（`:203`）、`font`（`:214`）、`thirdPartyAnalytics`（`:240`）、`licenseConfig`（`:386`）、`commentConfig`（`:428`）、`musicPlayerConfig`（`:467`）。
- `src/utils/anime-data.ts` —— 番剧数据源选择与加载（local / json），dev 下写死的 `fetchOnDev` 逻辑（`:82-93`、`:109`）。
- `scripts/update-anime.mjs` —— 番剧数据更新的调度器，按 `anime.mode` 决定跑哪个子脚本（`:52-60`）。
- `scripts/update-bangumi.mjs` —— 调 `api.bgm.tv` 拉 Bangumi 收藏，产出 `src/data/bangumi-data.json`。
- `scripts/update-bilibili.mjs` —— 调 B 站 API 拉追番，需 `BILI_SESSDATA`，产出 `src/data/bilibili-data.json`。
- `scripts/sync-content.js` —— 内容仓库克隆/同步器，结尾带 `git add` + `git commit`。
- `scripts/indexnow-submit.js` —— 读 `dist/sitemap-0.xml` 向 IndexNow 提交 URL，需 `INDEXNOW_KEY`/`INDEXNOW_HOST`。
- `scripts/compress-fonts.js` —— 字体子集化并回写 `dist/` CSS；也会在 `mode=bangumi` 时拉 Bangumi 文本。
- `scripts/convert-images.js` —— 用 `sharp` 把 `public/` 下图片转 WebP（非 `build` 链成员）。
- `scripts/load-env.js` —— 极简 `.env` 解析器，被上述多个脚本复用。
- `src/layouts/partials/AnalyticsScripts.astro` —— GTM / Clarity 的延迟加载与默认 GTM ID。
- `src/layouts/partials/HeadTags.astro` —— favicon、Iconify 预连接、字体注释。
- `src/layouts/Layout.astro` —— 字体栈拼装（`:128-158`）、OverlayScrollbars 属性、GTM noscript。
- `src/layouts/MainGridLayout.astro` —— 挂载全局 `IconifyLoader`（`:113`）。
- `src/components/misc/IconifyLoader.astro` / `src/utils/icon-loader.ts` —— 两份 Iconify 加载器实现。
- `src/components/atoms/Icon/Icon.astro` / `src/components/misc/Icon.astro` —— 自定义图标组件与其兼容包装器。
- `src/components/comment/` —— `index.astro` 的评论总闸、`Twikoo.astro`、`Giscus.astro`。
- `src/components/misc/License.astro` —— 文章底部授权卡片。
- `src/styles/main.css` —— Tailwind v4 主题（`@plugin` 在 `:16`、`@theme` 在 `:21`）、`@font-face`、`--font-sans`。
- `src/styles/scrollbar.css` —— `.os-scrollbar` 系列样式，OverlayScrollbars 的 CSS 侧依赖。
- `src/components/misc/Markdown.astro` —— 唯一引入 `@fontsource-variable/jetbrains-mono` 的地方（`:3`）。
- `src/pages/og/[...slug].png.ts` —— satori + sharp 生成 OG 图，构建期拉 Google Fonts。
- `src/components/misc/utils/poster-renderer.ts` / `src/components/misc/SharePoster.svelte` —— 分享海报、`qrcode`、`images.weserv.nl` 代理。
- `src/components/widgets/music-player/` —— Meting / 本地歌单逻辑与兜底 API 常量。
- `src/data/anime.ts` —— 番剧页的本地硬编码列表，`anime.mode: "local"` 时读它。
- `vercel.json` —— Vercel 构建命令、输出目录与安全响应头。
- `pagefind.yml` —— Pagefind 搜索索引的排除选择器。
- `.npmrc`、`pnpm-workspace.yaml`、`.github/dependabot.yml` —— 包管理器与依赖更新策略。
- `.github/workflows/` —— `CI.yml`、`lint.yml`（有效）、`build.yml`、`deploy.yml`（分支对不上 / YAML 损坏）。
- `LICENSE`、`LICENSE.MIT`、`README.md` —— Apache-2.0 与上游 Fuwari 的 MIT 声明。
- `docs/rule/07-icon-usage-specification.md` —— 图标使用规范（三种用法、尺寸表、决策流程）。
