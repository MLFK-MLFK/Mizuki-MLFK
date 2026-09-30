# 10 · 构建与部署

这一块讲的是「源码怎么变成线上那份静态站点」：本地 `pnpm build` 的四段流水线、`dist/` 里到底生成了什么、全文搜索与字体压缩这两个构建后处理步骤如何工作，以及 `.github/workflows/` 里几处**已经坏掉或永远不会触发**的配置。

读它的典型场景：改部署配置、排查「为什么线上没更新」、本地想看搜索或字体效果。有两件事要先记牢：`prebuild` 钩子会在你毫无察觉时执行 `git add . && git commit`，而且 `sync-content.js` 还会把本地目录搬走；这两个坑比构建本身更容易伤到人。

一个贯穿全篇的分界线：**构建期（Node 里跑的脚本）和运行期（浏览器里跑的代码）是两套东西**。`pagefind` 索引、字体子集、`_headers` 都是构建期产物，只有跑完整构建才会出现；`astro dev` 里全都没有。

---

## 一、全景：从源码到线上

```
源码 src/
  │  pnpm build（= 四段，见第二节）
  ▼
dist/  ← 纯静态产物（index.html / home/ / _astro/ / pagefind/ / assets/font/…）
  │  推送到部署平台
  ▼
线上
```

本站的 `siteConfig.siteURL` 是 `https://mlfk.pages.dev/`（`src/config.ts:29`）；仓库根有 `public/_headers`（`public/_headers:1`），是 Cloudflare Pages / Netlify 风格的响应头配置，构建时原样复制成 `dist/_headers`。域名 `pages.dev` 与这份 `_headers` 都指向 Cloudflare Pages，但**「线上实际跑在哪个平台、用的是什么 build command / Node 版本」无法从仓库核实** —— 仓库里没有 `wrangler.toml`、没有 `_routes.json`、也没有 `.vercel`，这些设置全在平台控制台里。排查「线上没更新」时必须登平台查，不能只看仓库。

`vercel.json` 是一份「留着但当前没在用」的配置，详见 7.2 节。

---

## 二、把源码变成 `dist`：`pnpm build` 的四段链

真正的 `build` 定义在 `package.json:16`：

```json
"build": "node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js"
```

四段用 `&&` 串联，**任何一段非零退出，后面的都不跑**。这里的 `astro` 由 pnpm 解析到本地 `node_modules/.bin/astro`，不需要 `npx`。

### 2.1 先记两个坑

**坑一：只能用 pnpm。** `package.json:24` 的 `preinstall` 是 `"npx only-allow pnpm"`。也就是说 `npm install` / `npm ci` 会在第一步被直接拦下，本项目只能用 pnpm。新人照着通用教程在部署平台或本地敲 npm 时会立刻失败。`package.json:111` 把 `packageManager` 钉在 `pnpm@10.33.0`；全文没有 `engines` 字段，Node 版本不受 package.json 约束（详见第七节各工作流的不一致）。

**坑二：`prebuild` 会执行 `sync-content.js`，它有两个破坏性副作用。** `package.json:9` 写着：

```json
"prebuild": "node scripts/sync-content.js || true"
```

pnpm/npm 在跑 `build` 前会自动先跑 `prebuild`，于是 `scripts/sync-content.js` 被触发。该脚本会做两件危险的事：

1. **自动提交工作区全部改动。** 脚本结尾 `scripts/sync-content.js:141`–`:167` 的 `try` 块先取内容仓库的分支名与短 hash，再执行 `git add .`（`:157`）和 `git commit -m "chore(content): sync ..."`（`:159`）。也就是说只要主仓库里有任何未提交改动，一次 `pnpm build` 就可能把它们**连同半成品一起提交进 git**，没有任何提示。`:165` 的 `catch` 只在「没有变化、commit 失败」时吞掉错误，挡不住提交。`|| true` 只保证同步失败不中断构建。
2. **把本地目录搬走、换成指向内容仓库的符号链接。** `scripts/sync-content.js:96`–`:137` 定义四组映射：`src/content/posts`、`src/content/spec`、`src/data`、`public/images`。对每组，若目标已存在且不是符号链接，会被改名成 `*.backup`（`:113`–`:122`），随后删除并重建为指向 `content/` 下对应目录的 junction（`:125`–`:137`；Windows 无权限时降级为复制）。这意味着你放在 `src/data`、`public/images` 里的文件会被「搬走」，下次构建后可能就不在原位了。

此外，`sync-content.js` 若 `content/` 是有效 git 仓库，还会在**内容仓库**里执行 `git stash push --include-untracked`（`:63`）、`git fetch --all --prune`（`:69`）、`git checkout <branch>` 与 `git reset --hard origin/<branch>`（`:83`–`:84`）。也就是内容仓库里的未提交改动会被 stash，本地分支会被强制重置到远端。

规避方式：

- 真实构建用 `npx astro build`（绕开 npm 脚本钩子，不会触发 `prebuild`）；
- 或者构建前确保主仓库与内容仓库都干净。

`predev`（`package.json:8`）同理，`pnpm dev` 也会触发 `sync-content.js`。

### 2.2 开关与前提

- 开关默认是**开**：`scripts/sync-content.js:15` 是 `process.env.ENABLE_CONTENT_SYNC !== "false"`，不设环境变量时为 `true`。只有显式设为 `false` 才会在 `:22`–`:28` 直接 `process.exit(0)` 跳过。
- 本仓 `.env:13` 显式写了 `ENABLE_CONTENT_SYNC=true`，而 `.env` 被 `.gitignore:21` 忽略，所以它只存在于本地。
- 上面那两个破坏性副作用只有在 (a) 开关为真且 (b) `CONTENT_DIR`（默认 `./content`）是有效 git 仓库时才会走到；若中途 `execSync` 抛错，会被 `:165` 的 `catch` 吞掉，commit 便不执行。

### 2.3 四段速查表

| 段 | 命令 | 做什么 | 失败后果 | 能否单独跑 |
|---|---|---|---|---|
| 0 | `node scripts/sync-content.js`（`prebuild` 自动） | 同步内容仓库到 `src/content` 等，末尾 `git add . && git commit`，并可能搬走本地目录 | `\|\| true` 吞掉，不中断构建；但会误提交、搬文件 | 能，`pnpm sync-content` |
| 1 | `node scripts/update-anime.mjs` | 按 `anime.mode` 转发到 bilibili/bangumi 抓取脚本 | 中断整条链 | 能 |
| 2 | `astro build` | 生成 `dist/` 静态站点 | 中断整条链 | 能，`npx astro build` |
| 3 | `pagefind --site dist` | 生成 `dist/pagefind/` 搜索索引 | 中断整条链（字体压缩不跑） | 能，需先有 `dist/` |
| 4 | `node scripts/compress-fonts.js` | fontmin 子集化字体 + 改写 `dist` 里 CSS 的字体引用 | 字体文件缺失时 `exit 1`；否则降级为警告 | 能，需先有 `dist/` |

### 2.4 第 1 段：`node scripts/update-anime.mjs`

`scripts/update-anime.mjs` 是**分发器**，不自己抓数据。它用正则从 `src/config.ts` 抠出 `anime.mode`（`:11`–`:25`，正则见 `:14`），再决定跑哪个子脚本（`:48` 的 `main()`）：

| `anime.mode` | 行为 |
|---|---|
| `"bilibili"` | spawn `scripts/update-bilibili.mjs`（`update-anime.mjs:52`–`:54`） |
| `"bangumi"` | spawn `scripts/update-bangumi.mjs`（`update-anime.mjs:55`–`:57`） |
| 其它（当前值 `"local"`） | 打印跳过，直接结束（`update-anime.mjs:59`） |

**当前是空转**：`src/config.ts:90` 的 `anime.mode` 为 `"local"`，所以这一步只打印 `Anime mode is "local", skipping data update.` 就结束。

但要注意一个非直觉的兜底：若正则匹配失败（`src/config.ts` 写法被改动等），`:21` 与 `:23` 会**默认返回 `"bangumi"`**，于是反而去联网跑抓取。所以这一步并非总是空转，构建耗时与网络可用性强相关（见 `src/config.ts:43` 的 `anime: false` 不是 `anime: {`，不会被误匹配）。

失败行为：子脚本退出码非 0 时 `runScript` 会 reject，`main().catch` 打印错误并 `process.exit(1)`（`update-anime.mjs:63`–`:67`），整条 `&&` 链断掉。

### 2.5 第 2 段：`astro build`

Asto 本体构建，读 `astro.config.mjs`，产出静态 HTML/CSS/JS/资源到 `dist/`。这是四段里唯一必跑、失败就全盘失败的一步。可单独跑：`npx astro build`。

### 2.6 第 3 段：`pagefind --site dist`

用 `pagefind` 包（`package.json:58`，版本 `^1.5.2`）扫描已生成的 `dist/`，在 `dist/pagefind/` 下产出搜索索引与运行时代码。它自动读取项目根的 `pagefind.yml`。非零退出会中断链，**第 4 段字体压缩不执行**。可单独跑，但必须先有 `dist/`：`npx pagefind --site dist`。

### 2.7 第 4 段：`node scripts/compress-fonts.js`

自写脚本，用 fontmin 做字体子集化并改写 CSS 引用（详见第五节）。也可以单独用 `pnpm compress-fonts`（`package.json:25`）跑。

失败行为分几档：字体文件不存在时收集错误、最终 `process.exit(1)`（`scripts/compress-fonts.js:1093`–`:1098`、`:1173`、`:1196`）；`dist/` 不存在则只打警告返回（`:1053`）；没有配置要压缩的字体则打警告返回（`:1042`）。**它依赖 `dist/` 已存在，不会帮你先构建。**

---

## 三、构建产物：`dist/` 长什么样

### 3.1 目录结构

`output: "static"`（`astro.config.mjs:43`），构建后大致是：

```
dist/
├── index.html            ← 起始页（站点根 /）
├── 404.html
├── home/index.html       ← 文章列表第 1 页
├── home/2/index.html …   ← 翻页
├── posts/…、archive/、about/ …   ← 各内容页
├── start/index.html      ← 老首页的静态跳转
├── atom.xml rss.xml sitemap-index.xml robots.txt
├── _headers              ← 从 public/_headers 原样复制
├── _astro/               ← Vite 打包的 JS/CSS/图片（带哈希）
├── assets/font/          ← 字体（见第五节）
├── images/、pio/、js/、favicon/ …
└── pagefind/             ← 只有跑过 pagefind 才存在（见第四节）
```

`trailingSlash: "always"`（`astro.config.mjs:41`）决定所有页面按带斜杠的目录形式生成。

### 3.2 为什么同时有 `/index.html` 和 `/home/index.html`

这是本项目特有的结构 —— 起始页「顶掉」了根路径：

- `src/pages/index.astro` 渲染到站点根 `/`，产物是 `dist/index.html`。该文件 `:13` 的注释写明「起始页 —— 现在就是站点首页 "/"」。
- 原来挂根路径的文章列表被挪到 `src/pages/home/[...page].astro`，`:23`–`:27` 的 `getStaticPaths` 用 `paginate(allBlogPosts, { pageSize: PAGE_SIZE })` 生成 `/home/`、`/home/2/`…，第 1 页产物即 `dist/home/index.html`。
- 老书签 `/start/` 由 `astro.config.mjs:50`–`:52` 的 `redirects: { "/start": "/" }` 兜住。`output:"static"` 下 Astro 不会做服务端跳转，而是生成一个只含 meta refresh 的 HTML（注释在 `astro.config.mjs:47`，实测 `dist/start/index.html` 内容为 `<meta http-equiv="refresh" content="0;url=/">`）。

### 3.3 `_astro/` 与 `vite.build` 的优化项

`_astro/` 是 Vite 默认的资源输出目录，文件名带内容哈希。`astro.config.mjs:252` 起的 `vite.build` 段逐项控制它的行为：

| 配置 | 位置 | 作用 |
|---|---|---|
| `assetsInlineLimit: 4096` | `astro.config.mjs:254` | 小于 4KB 的资源内联为 base64。**注意 4096 正是 Vite 的默认值**，写不写行为一样，并不是「故意设小」 |
| `cssCodeSplit: true` | `astro.config.mjs:256` | CSS 按页面拆分 |
| `cssMinify: "esbuild"` | `astro.config.mjs:257` | CSS 用 esbuild 压缩 |
| `inlineStylesheets: "auto"` | `astro.config.mjs:259` | 小 CSS 文件自动内联，减少请求 |
| `minify: "esbuild"` | `astro.config.mjs:261` | JS 用 esbuild 压缩 |
| `rollupOptions.onwarn` | `astro.config.mjs:262` | 屏蔽「动态导入又被静态导入」的特定警告 |

**`esbuildOptions.drop` 不生效，别指望它去掉 `console`。** `astro.config.mjs:279`–`:284` 里那段 `vite.esbuildOptions`（与 `build` 同级）看起来是「生产环境 drop 掉 `console` 与 `debugger`」，但 **Vite 7 的 `build` 配置里根本没有 `esbuildOptions` 这个键**：Vite 只认顶层的 `esbuild`（`node_modules/.pnpm/vite@7.3.2/.../config.js:6220` 的 `config$2.esbuild`）与 `optimizeDeps.esbuildOptions`（同文件 `:31446`），全仓找不到 `build.esbuildOptions` 的消费点。

实测佐证：当前生产产物 `dist/_astro/Search.UjKW9rDd.js` 里仍保留 `console.log("Pagefind status on init:", ...)`（即 `Search.svelte:159` 那条），`dist/_astro` 下多个 JS 都含 `console.log`。所以「生产构建会移除 console」这个判断是错的，**生产里 `console.log` 原样保留**。调试用的日志上线前要自己删。

`astro.config.mjs:224` 的 `optimizeDeps.include` 与 `:238` 的 `server.warmup` 都**只影响 dev server**，跟生产 `dist/` 无关。

### 3.4 当前仓库里这份 `dist/` 的异常

当前工作区的 `dist/` 是**不完整、且可能过期**的产物，读它时别把它当完整构建结果：

- **没有 `dist/pagefind/`** —— 说明某次构建只跑了 `astro build`，没跑第 3 段，线上搜索前端会走 `pagefindloaderror` 分支。
- **`dist/assets/font/` 里只有未压缩的 `.ttf`**（`ZenMaruGothic-Medium.ttf`、`loli.ttf`）—— 说明没跑第 4 段。
- **根目录躺着一个 17 MB 的 `dist/test.mp4`**（17269326 字节），会被当静态资源一起上传，明显是遗留物。
- `dist/` 里还留着 `anime/`、`diary/`、`projects/`、`skills/`、`timeline/`、`devices/` 等目录，而 `src/config.ts:43`–`:50` 的 `featurePages` 已把对应页面关掉 —— 进一步说明这份 `dist` 是旧的或来自开关改动之前。

---

## 四、Pagefind 全文搜索

### 4.1 索引生成：`pagefind.yml`

`pagefind.yml:1`–`:6` 只有一段 `exclude_selectors`，五条排除项：

| selector | 排除什么 |
|---|---|
| `span.katex` | KaTeX 渲染出的行内公式 |
| `span.katex-display` | KaTeX 的块级公式 |
| `[data-pagefind-ignore]` | 任何显式标记「不进索引」的元素 |
| `.search-panel` | 搜索面板自身（class 形式） |
| `#search-panel` | 搜索面板自身（id 形式） |

排除公式是因为 KaTeX 会产生大量不可读的符号文本，进索引只会污染搜索摘要；排除面板自身是防止「搜出来的摘要里含搜索框里的字」这种自指噪声。`[data-pagefind-ignore]` 是通用逃生口，例如标题锚点图标就带了这个属性（`astro.config.mjs:212`）。

被索引的正文由 `data-pagefind-body` 标记，出现在 `src/components/misc/Markdown.astro:12`、`src/pages/posts/[...slug].astro:239`、`src/pages/[...permalink].astro:180`。

`pagefind.yml` 里没有 `site` 键 —— 站点目录靠命令行 `--site dist` 传进去，这份配置只负责覆盖 `exclude_selectors`。

### 4.2 前端调用链

搜索不是用 Pagefind 自带 UI，而是自己写的组件，完整链路：

1. `src/components/organisms/navigation/Navbar.astro:284` 在 `import.meta.env.PROD` 时才注入一段内联脚本，定义 `window.loadPagefind`。
2. 该函数先 `fetch(scriptUrl, { method: 'HEAD' })` 探活 `/pagefind/pagefind.js`（`Navbar.astro:288`），再动态 `import`（`:293`），设 `excerptLength: 20`（`:295`–`:297`），挂到 `window.pagefind`（`:299`），并派发 `pagefindready` 事件（`:301`）。失败时挂一个空壳 `pagefind`（`:305`–`:308`）并派发 `pagefindloaderror`（`:309`）。
3. `src/components/organisms/navigation/Search.svelte` 在打开搜索框时才调 `window.loadPagefind()`（`Search.svelte:47`、`:60`），是懒加载。
4. 真正搜索在 `Search.svelte:130`：`if (import.meta.env.PROD && pagefindLoaded && window.pagefind)` 才走 `window.pagefind.search(keyword)`（`:131`）；生产环境若无索引则落到 `:137`–`:141` 的 else，返回空结果并 `console.error`。

### 4.3 关键结论：搜索索引「只在构建后」才有

这是对本地开发影响最大的一点：

- `astro dev` 里 `import.meta.env.DEV` 为真，`Search.svelte:135` 直接返回写死的 `fakeResult`（定义在 `:23`–`:40`，文案就是「Because the search cannot work in the dev environment / Try running npm build && npm preview」）。
- `Navbar.astro:284` 的 `loadPagefind` 脚本只在 `PROD` 时注入，dev 里根本没有 `window.loadPagefind`。
- `dist/pagefind/` 只有第 3 段 `pagefind --site dist` 跑过才存在。**只跑 `npx astro build` 而没有跑 pagefind 的 `dist/`，线上搜索是坏的**（前端走 `pagefindloaderror` 分支）。

所以要在本地验证搜索，必须跑完整构建（含 pagefind）再 `astro preview` 看，`astro dev` 里验证不了。

---

## 五、字体压缩：`scripts/compress-fonts.js`

### 5.1 为什么需要

`public/assets/font/` 下是两个未压缩的大文件：`ZenMaruGothic-Medium.ttf`（约 3.8 MB）和 `loli.ttf`（约 10.8 MB）。直接上线会让首屏为了中文字形而下载十几 MB。fontmin 的 `glyph` 子集化只保留「页面实际会用到的字」，能把体积砍掉一大截。

### 5.2 压哪些字体、字符集怎么定

要压缩哪些由 `src/config.ts` 的 `font` 段决定，脚本用正则从 config 文本里抠出来（`scripts/compress-fonts.js:10`–`:69` 的 `getConfig`）：

- `src/config.ts:217` 的 `asciiFont`：`localFonts: ["ZenMaruGothic-Medium.ttf"]`（`:222`），`enableCompress: true`（`:223`）。它只保留 **ASCII 字符集**（`getAsciiCharset()`，`compress-fonts.js:164`）。
- `src/config.ts:225` 的 `cjkFont`：`localFonts: ["loli.ttf"]`（`:229`），`enableCompress: true`（`:230`）。它保留 **CJK 全字符集**，由 `collectText()`（`compress-fonts.js:702`）汇总：扫 `src/data`、当前语言的 i18n 文件、内容目录，另加三类番剧/歌单文字 —— Meting 歌单（联网，`compress-fonts.js:981`）、Bangumi API（联网，`:995`）、**本地文件 `src/data/bilibili-data.json`**（`:1009`，注意这一路不是联网，见 `:386`–`:400` 的 `readFileSync`）。

只有 `enableCompress: true` 且 `localFonts` 非空才会进压缩列表（`compress-fonts.js:61`）。`src/config.ts:216` 的注释提醒：子集优化只支持 TTF，且**只在生产环境（构建后）才看得到效果，dev 里显示的是浏览器默认字体**。

联网抓取失败（Bangumi / Meting 超时或报错）都只打警告、不中断（Meting 的 catch 在 `compress-fonts.js:327`），所以离线环境这个脚本也能跑完。

### 5.3 产物在哪、怎么处理

- 输出目录固定为 `dist/assets/font/`（`compress-fonts.js:1061`）。
- `.ttf` / `.otf`：走 `Fontmin.glyph({ text, hinting: false })` + `Fontmin.ttf2woff2({ deflate: true })`，产出同名 `.woff2`（`compress-fonts.js:1116`–`:1133`，产物路径 `:1148`）。
- `.woff` / `.woff2`：已是 Web 格式，不做子集化，直接复制（`compress-fonts.js:1105`–`:1114`）。
- 字符集按字体类型二选一：`fontConfig.type === "asciiFont" ? asciiText : cjkText`（`compress-fonts.js:1082`）。
- 压缩完还有第二趟 `updateCssFontReferences()`（定义在 `compress-fonts.js:1218`，在 `:1345` 被链式调用）：把 `dist/` 里所有 CSS 中 `url("/assets/font/xxx.ttf") format("truetype")` 引用改写成 woff2（匹配与替换在 `:1279`–`:1289`）。CSS 源头的 `@font-face` 在 `src/styles/main.css:30`–`:44`（`ZenMaruGothic-Medium.ttf` 在 `:32`，`loli.ttf` 在 `:40`）。

---

## 六、环境变量来源链

构建脚本读的环境变量不来自 `.env` 自动加载，而是靠自写解析器：

- `scripts/sync-content.js:11` 调 `loadEnv()`。
- `scripts/load-env.js:10`–`:29` 手工读根目录 `.env`，按行用正则 `^([^=]+)=(.*)$` 拆分，去掉首尾引号后塞进 `process.env`。
- `.env` 被 `.gitignore:21` 忽略，仓库里不存在（CI 也没有），所以 CI / 部署平台上必须靠 workflow 的 `env:` 或平台环境变量提供。

主要变量：

| 变量 | 作用 | 本地默认 / 出处 |
|---|---|---|
| `ENABLE_CONTENT_SYNC` | 内容分离总开关 | `.env:13` 设 `true`；代码默认 `true`（`sync-content.js:15`） |
| `CONTENT_REPO_URL` | 内容仓库地址 | `.env:19` |
| `CONTENT_DIR` | 内容目录 | `.env:23`，默认 `./content` |
| `BILI_SESSDATA` | B 站凭证（抓观看进度） | `.env:54`；CI 里由 `secrets` 注入（`CI.yml:67`） |
| `INDEXNOW_KEY` / `INDEXNOW_HOST` | IndexNow 提交（见 7.3） | `.env:38`/`:40` |

---

## 七、部署

### 7.1 现在真正生效的是什么（部分未能核实）

- 站点 `siteURL` 是 `https://mlfk.pages.dev/`（`src/config.ts:29`），`pages.dev` 是 Cloudflare Pages 的域名。
- 仓库根的 `public/_headers`（`public/_headers:1`–`:30`）是 Cloudflare Pages / Netlify 的响应头格式，构建时复制为 `dist/_headers`。它给 `/_astro/*`（`:11`）、`/assets/*`（`:14`）、`/pio/*`（`:17`）、`/images/*`（`:20`）都配了一年强缓存，给 `/*.woff2`（`:23`）也配了，HTML 则是 `max-age=3600, must-revalidate`（`:26`、`:29`）。
- 远端 git 只有 `master`（`git branch -a` 的 remote 分支只有 `origin/master`；本地另有未推送的 `backup/pre-homepage-20260930`）。

**推断（未能核实）**：站点当前跑在 Cloudflare Pages 上，`_headers` 才是真正生效的响应头来源。但仓库里没有 `wrangler.toml`、`_routes.json` 或 `.vercel` 等任何平台标识，因此**无法从仓库坐实平台归属**；`README.md:153`–`:156` 同时宣称支持 Vercel / Netlify / GitHub Pages / Cloudflare Pages，更说明不能凭配置文件断定。Pages 侧用的是什么 build command、output dir、Node 版本、是否走 Git 集成，全在仓库之外，排查线上问题时必须去平台控制台看。

### 7.2 `vercel.json`（留着但当前未在用）

| 键 | 值 | 位置 | 含义 |
|---|---|---|---|
| `buildCommand` | `pnpm build` | `vercel.json:2` | 在 Vercel 上跑的就是第二节那条四段链（也会触发 `prebuild` 的提交逻辑） |
| `outputDirectory` | `dist` | `vercel.json:3` | |
| `installCommand` | `pnpm install` | `vercel.json:4` | |
| `framework` | `astro` | `vercel.json:5` | |
| `headers` `/(.*)` | 四条安全头（nosniff / DENY / XSS / referrer） | `vercel.json:8`–`:26` | 全站安全头 |
| `headers` `/_astro/(.*)` | `Cache-Control: public, max-age=31536000, immutable` | `vercel.json:29`–`:35` | 带哈希资源一年强缓存 |
| `cleanUrls` | `true` | `vercel.json:38` | 去掉 `.html` 后缀 |

它与 `_headers` 对 `/_astro/` 的长缓存策略一致，但当前生效的是 `_headers`。

### 7.3 部署后处理：`submit`

`package.json:17` 的 `submit` → `node scripts/indexnow-submit.js`，用于向搜索引擎提交 URL 更新，属于「部署完成之后」的一步。它**不在构建链里**，不会被 `pnpm build` 调用，需要单独 `pnpm submit`。同样不在构建链里的还有 `scripts/convert-images.js`（`package.json` 未挂脚本）、`scripts/new-post.js`（`:21`）、`scripts/init-content-repo.js`（`:7`）—— 别误以为构建会调它们。

---

## 八、`.github/workflows/` 四个文件的真实状态

| 文件 | 触发分支 | 状态 | 说明 |
|---|---|---|---|
| `CI.yml` | `master` | 正确 | 远端就是 master，会触发 |
| `lint.yml` | `master` | 正确 | 同上 |
| `build.yml` | `main` | **永不触发** | 远端没有 main 分支 |
| `deploy.yml` | `main` | **YAML 本身是坏的** | 连解析都过不了 |

### 8.1 `CI.yml`（监听 master，正确）

- `on.push.branches: [ master ]`（`CI.yml:5`）、`pull_request.branches: [ master ]`（`:6`）、另有 `workflow_dispatch`（`:8`）。
- 两个 job：`check` 跑 `pnpm astro check`（`CI.yml:39`），`build` 跑 `pnpm build`（`:64`）；两者都设 `ENABLE_CONTENT_SYNC: false`（`:41`、`:66`）。
- `build` job 跑 `pnpm build` 确实会触发 `prebuild`，但 CI 之所以不会误提交，**不是因为「干净检出没有改动」，而是因为 `ENABLE_CONTENT_SYNC: false`（`CI.yml:66`）让 `sync-content.js` 在 `:22`–`:28` 就 `exit(0)`，根本没走到 `:141` 的 git 块**。若哪天把这个 env 去掉，才会真正执行 `git add`/`git commit`。

### 8.2 `lint.yml`（监听 master，正确）

- `on.push/pull_request.branches: [ master ]`（`lint.yml:5`、`:6`）。
- 两个 job：`eslint`（`:18`，`pnpm lint --format=json ...`，`continue-on-error: true` 在 `:41`）与 `typecheck`（`:51`，`pnpm astro check`，`ENABLE_CONTENT_SYNC: false` 在 `:72`）。
- eslint 结果上传为 artifact（`lint.yml:45`），保留 7 天。

### 8.3 `build.yml`（监听 main，等于永不触发）

- `on.push.branches: [ main ]`（`build.yml:5`）与 `pull_request.branches: [ main ]`（`:7`），注释还写着「Adjust branches as needed」。
- 远端只有 `master`，所以这个工作流**永远不会被 push/PR 触发**（除非手动）。
- 内容上它是完整的：Node 22/23 矩阵，`check`（`build.yml:17`）与 `build`（`:48`）两个 job，action 用 commit SHA 钉版本。
- 建议方向（**不改**）：把 `main` 改成 `master`，或直接删掉它 —— 它与 `CI.yml` 的 check/build 功能高度重叠，同时监听 master 会造成重复构建。

### 8.4 `deploy.yml`（YAML 是坏的，工作流无法解析）

这是四个里最严重的一个。`on:` 段（`deploy.yml:3`–`:12`）写成了：

```yaml
on:
  push:
    branches: [ main ]
      repository_dispatch:  # 👈 添加这个
    types:
      - content-updated
  workflow_dispatch:
```

`repository_dispatch:`（`deploy.yml:8`）被缩进了 6 个空格，挂在 `branches` 底下，而 `types:`（`:9`）又退回 4 空格。用 js-yaml 4.1.1 实测直接抛错：

```
bad indentation of a mapping entry (8:7)
```

后果：**GitHub Actions 解析不了这个文件**，整个工作流在 GitHub 上是坏的（Actions 页面会报 workflow 文件无效），既不会部署，也不会触发 `repository_dispatch`。

它本想干的事（`deploy.yml:15`–`:54`）：`permissions: contents: write`（`:15`–`:16`）、装 Node 20（`:31`）、`pnpm install --no-frozen-lockfile`（`:39`）、`pnpm run build`（`:42`），然后用 `JamesIves/github-pages-deploy-action@v4`（`:50`）把 `dist/` 推到 **`pages` 分支**（`branch: pages` 在 `:52`，`clean: true` 在 `:54`）。另外它的 build 步骤里 `ENABLE_CONTENT_SYNC` 是被注释掉的（`deploy.yml:43`–`:47`），并没有设置。

建议修复方向（**不改**）：把 `repository_dispatch` 和它的 `types` 提升到与 `push`、`workflow_dispatch` 平级，即

```yaml
on:
  push:
    branches: [ master ]        # 顺带把 main 改成 master
  repository_dispatch:
    types: [ content-updated ]
  workflow_dispatch:
```

同时把 `build.yml`、`deploy.yml` 里的 `main` 统一为 `master`。

---

## 九、`docs/` 里描述的设计意图 vs 实际状态

`docs/DEPLOYMENT.md` 与 `docs/AUTO_BUILD_TRIGGER.md` 描述的是**这套工作流本该长成的样子**，与实际仓库有明确出入：

| 文档说的 | 出处 | 实际 |
|---|---|---|
| 「推送到 `main` 分支会自动部署」 | `docs/DEPLOYMENT.md:45` | 远端只有 `master`；`deploy.yml` 还因缩进坏掉，不会部署 |
| 工作流有三个：`build.yml`/`deploy.yml`/`format.yml` | `docs/DEPLOYMENT.md:123`、`:125`–`:129` | 实际是四个：`CI.yml`/`lint.yml`/`build.yml`/`deploy.yml`，**没有 `format.yml`** |
| 在 `on:` 下平级添加 `repository_dispatch:` | `docs/DEPLOYMENT.md:549`、`docs/AUTO_BUILD_TRIGGER.md:56` | `deploy.yml:8` 实际把它错误缩进进了 `branches`，成了坏 YAML |

也就是说：文档给的 YAML 片段是**正确写法**，但仓库里 `deploy.yml` 落地时缩进写错了。`docs/AUTO_BUILD_TRIGGER.md:58` 依赖的 `content-updated` 事件，配合的正是这个坏掉的文件，所以整套「内容仓库更新自动触发构建」目前是**断的**。

`docs/DEPLOYMENT.md:279`–`:289` 对 `prebuild` → `sync-content.js` 的描述本身准确（解释了 `|| true` 的作用），但**没提脚本结尾的 `git add . && git commit`，也没提它会搬走 `src/data`、`public/images`** —— 这是文档的遗漏。

---

## 十、构建期 / 运行期边界：本项目特有约定

新人最容易混淆的几处，集中列一下：

1. **构建期产物 vs 运行期代码**：`dist/pagefind/`、`dist/assets/font/*.woff2`、`dist/_headers` 都只在构建期生成；`Search.svelte`、`Navbar.astro` 里的 `loadPagefind` 是运行期代码。两者靠 `import.meta.env.PROD` / `DEV` 在编译期分流（`Navbar.astro:284`、`Search.svelte:130`、`:135`）。
2. **`console.log` 在生产构建里不会消失**：`astro.config.mjs:279` 的 `vite.esbuildOptions.drop`（与 `build` 同级）因为不是 Vite 7 认识的键，实际不生效（见 3.3）。所以 `Search.svelte:159` 这类调试点在生产产物里仍在。
3. **自写脚本靠正则读 `src/config.ts`**：`update-anime.mjs:14`、`compress-fonts.js:15`/`:19`/`:374`/`:503` 都用正则从 config 文本里抠值。改 `src/config.ts` 的写法（空格、缩进、换行）可能悄悄让正则不匹配 —— 匹配不到时它们多数会退回默认值而不是报错（其中 `update-anime.mjs:21`/`:23` 会默认成 `"bangumi"`，反而去联网抓取）。
4. **`&&` 串联意味着「前一步坏，后面全不跑」**：第 1 段 `update-anime` 退非零，`astro build` 就不跑；第 3 段 `pagefind` 失败，字体压缩也不跑。排查「构建产物缺东西」时先看链条断在哪一段。
5. **`output: "static"` 下的 redirect 实现**：`/start` 的重定向不是服务端跳转，而是构建出一个 meta refresh 的 HTML（`astro.config.mjs:47`、`:50`）。
6. **集成会改变生产产物与构建要求**：`astro.config.mjs:159`–`:162` 挂了 `sitemap()`、`mdx()`、`sentry()`、`spotlightjs()`，另有 `swup()`（`:60`）与 `expressiveCode()`（`:109`）。其中 `@sentry/astro` 在生产构建做 source map 上传通常需要 `SENTRY_AUTH_TOKEN`，`@spotlightjs/astro` 会注入运行时 overlay。这些都会改变生产产物内容/构建要求，排查产物异常时别忽略它们。

---

## 十一、版本与运行时约束

| 维度 | 现状 |
|---|---|
| 包管理器 | `pnpm@10.33.0`（`package.json:111`）；`preinstall` 强制（`package.json:24`） |
| Node 约束 | `package.json` 无 `engines` 字段，不受约束 |
| Astro | `6.1.2`（`package.json:45`） |
| Vite | 7.3.2（由 Astro 间接依赖） |
| 本地实测 Node | v24.18.0 可用 |
| CI Node 版本 | `CI.yml:28`/`:53`、`lint.yml:28`/`:61` 用 `lts/*`；`build.yml:20`/`:51` 用 22/23 矩阵；`deploy.yml:31` 却钉死 Node 20 |

各工作流 Node 版本不一致，且 `deploy.yml` 钉的 Node 20 已临近 EOL，这是排查「本地能构建、CI 不行」时的一个变量。

---

## 十二、本地验证代码的正确姿势

### 12.1 类型与语法检查

```bash
npx astro check
```

跑 Astro/TS/Svelte 的类型与语法检查，不产出 `dist/`。改完组件先跑它，最安全。

### 12.2 真实构建

```bash
npx astro build
```

**用 `npx astro build`，不要用 `pnpm build` / `npm run build`** —— 后者会先触发 `prebuild`，进而执行 `sync-content.js` 的提交与搬目录逻辑（见 2.1）。

注意 `npx astro build` 只跑第 2 段，**不会**生成 `dist/pagefind/`，也**不会**压缩字体。要验证搜索和字体，就得跑完整链；此时若想避开自动提交与搬目录，确保 `.env` 里 `ENABLE_CONTENT_SYNC=false`（或工作区干净），再手动依次执行：

```bash
node scripts/update-anime.mjs
npx astro build
npx pagefind --site dist
node scripts/compress-fonts.js
```

这条链的实际耗时与网络强相关：`astro build` 前若走 `sync-content.js`，可能 `git clone`/`fetch` 超时；`update-anime.mjs` 在 mode 正则解析失败时会去联网抓 bangumi。

### 12.3 看构建产物

```bash
npx astro preview
```

起一个本地静态服务器伺服 `dist/`。等价地，`pnpm preview` 映射到 `astro preview`（`package.json:18`），是安全的。

**要看的门道**：

- 打开搜索框能出结果 ⇒ `dist/pagefind/` 存在且前端 `loadPagefind` 成功；若报 `pagefindloaderror`，说明没有 pagefind 索引。
- 看字体是否变成 woff2 ⇒ `dist/assets/font/` 里应有 `.woff2`；若只有 `.ttf`，说明没跑第 4 段。

---

## 相关文件

- `package.json` —— 定义 `build` 四段链、`prebuild`/`predev` 钩子（会触发 git 提交与目录搬迁）、`preinstall` 的 `only-allow pnpm`、`submit`、`compress-fonts` 等全部脚本入口。
- `astro.config.mjs` —— Astro 主配置：`site`/`base`/`trailingSlash`/`output:"static"`、`/start` 重定向、集成列表（swup/sentry/spotlightjs 等），以及 `vite.build` 的资源与压缩优化项（含不生效的 `esbuildOptions`）。
- `pagefind.yml` —— Pagefind 索引的 `exclude_selectors`（排除公式、`data-pagefind-ignore`、搜索面板自身）。
- `vercel.json` —— Vercel 的构建/输出/安全头/`_astro` 长缓存/`cleanUrls` 配置；当前站点未走 Vercel。
- `public/_headers` —— Cloudflare Pages 风格响应头，构建时复制为 `dist/_headers`，是当前线上真正生效的缓存头来源。
- `.github/workflows/CI.yml` —— 监听 master 的 check+build，写法正确。
- `.github/workflows/lint.yml` —— 监听 master 的 eslint+typecheck，写法正确。
- `.github/workflows/build.yml` —— 监听 main（远端不存在，永不触发）的矩阵构建。
- `.github/workflows/deploy.yml` —— YAML 缩进损坏、无法解析；本意是构建后推 `pages` 分支。
- `scripts/update-anime.mjs` —— 按 `anime.mode` 转发到 bilibili/bangumi 抓取脚本的分发器（当前 mode=local，空转；解析失败则默认 bangumi）。
- `scripts/sync-content.js` —— 内容同步脚本：在内容仓库里 stash/fetch/checkout/reset，把 `src/data`、`public/images` 等换成符号链接，结尾 `git add . && git commit`。
- `scripts/compress-fonts.js` —— fontmin 字体子集化 + 改写 `dist` CSS 字体引用，输出到 `dist/assets/font/`。
- `scripts/load-env.js` —— 手工解析根目录 `.env` 并写入 `process.env`。
- `scripts/indexnow-submit.js` —— 部署后向搜索引擎提交 URL 的 `submit` 脚本，不在构建链里。
- `src/config.ts` —— `siteURL`（指向 pages.dev）、`font` 段（决定压缩哪些字体与字符集）、`anime.mode`、`featurePages`。
- `src/styles/main.css` —— `@font-face` 引用 `/assets/font/*.ttf`（`:30`、`:38`），是 compress-fonts 改写 CSS 时的匹配目标。
- `src/components/organisms/navigation/Navbar.astro` —— 生产环境注入 `window.loadPagefind`，负责加载 `pagefind.js` 并派发事件。
- `src/components/organisms/navigation/Search.svelte` —— 调用 `window.pagefind.search`，dev 环境返回写死的假结果。
- `src/pages/index.astro` —— 起始页，产出 `dist/index.html`。
- `src/pages/home/[...page].astro` —— 分页文章列表，第 1 页产出 `dist/home/index.html`。
- `docs/DEPLOYMENT.md` —— 部署指南，其中工作流数量与分支名和实际不符，且漏述 `sync-content.js` 的提交/搬目录副作用。
- `docs/AUTO_BUILD_TRIGGER.md` —— 内容仓库更新触发构建的快速参考，依赖坏掉的 `deploy.yml`。
