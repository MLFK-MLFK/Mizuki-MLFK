# 13 · 踩坑与排查手册

这一页记录的是**从代码里读不出来、只能踩过才知道**的东西：哪些命令会咬人、哪些机制反直觉、
哪些地方当前本来就是坏的。新人按顺序读前四节，能省掉大半天。

文中每条结论都给了 `路径:行号`，争议时直接回源码对质。行号对不上说明文件改过了 ——
那也说明这一页该更新了。

---

## 一、两条命令会替你提交代码

这是本项目**最容易造成实际损失**的一条。

### 现场

```json
// package.json:8-9
"predev":  "node scripts/sync-content.js || true",
"prebuild": "node scripts/sync-content.js || true",
```

而 `scripts/sync-content.js:157-163` 的结尾是：

```js
execSync("git add .", { cwd: rootDir });
execSync(`git commit -m "chore(content): sync ${branch}@${hash}"`, { cwd: rootDir });
```

也就是说：**`pnpm dev` / `pnpm build` / `npm run dev` / `npm run build`
会在你毫无察觉的情况下，把工作区里所有未提交的改动 `git add .` 之后提交掉。**
提交信息长得像一次正常的内容同步，回头看 `git log` 很难分辨。

这段代码包在 `try/catch` 里（`scripts/sync-content.js:155-165`），失败时只打印
「没有变化，跳过提交」，所以**没有任何红色报错会提醒你**。

### 实测结论（不是推测）

pnpm 11.9.0 默认执行 `pre`/`post` 钩子 —— 用一份临时 `package.json` 实测过，
`pnpm foo` 会先跑 `prefoo`。所以「pnpm 7 以后不跑 pre 钩子了」这个说法在这里不成立，
`predev` / `prebuild` 是真会执行的。

### 安全替代命令

| 想做的事 | ❌ 别用 | ✅ 用这个 | 说明 |
| --- | --- | --- | --- |
| 开发服务器 | `pnpm dev` | `pnpm start` 或 `npx astro dev` | `start` 脚本是 `astro dev`，仓库里没有 `prestart` |
| 构建 | `pnpm build` | `npx astro build` | 跳过了 Pagefind 与字体压缩，见下 |
| 类型/语法检查 | — | `pnpm check` 或 `npx astro check` | 脚本是 `astro check`，无前置钩子 |
| 看构建产物 | `pnpm preview` | `pnpm preview` | 脚本是 `astro preview`，安全 |
| 格式化 / lint | — | `pnpm format` / `pnpm lint` | 均无前置钩子 |
| 新建文章 | — | `pnpm new-post` | 无前置钩子 |

`pnpm install` 会触发 `preinstall`（`package.json:24`）执行 `npx only-allow pnpm` ——
用 npm 或 yarn 装依赖会直接失败。这是有意的，别绕过。

### 代价：`npx astro build` 不是完整构建

`package.json` 里真正的完整构建链是：

```
pnpm build = node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

绕开钩子只用 `npx astro build` 的话，**Pagefind 搜索索引不会生成，字体也不会被压缩**。
需要完整产物时，手动串一遍：

```bash
node scripts/update-anime.mjs
npx astro build
npx pagefind --site dist
node scripts/compress-fonts.js
```

日常改代码只关心渲染结果的话，`npx astro build` 就够了 —— 但要记住本地 `dist/` 里搜不出东西。

---

## 二、内容分离机制：看着是开着的，实际在空转

`scripts/sync-content.js` 是一套**代码与内容分离**的设计：内容放在独立仓库里，
构建前把它同步进来，通过符号链接挂到 `src/content/posts`、`src/data` 等位置。

### 设计意图（文档里写的）

读 `docs/CONTENT_SEPARATION.md` 与 `docs/CONTENT_REPOSITORY.md` 能看明白完整设想。
关键几步在 `scripts/sync-content.js`：

1. 读 `.env` 的 `ENABLE_CONTENT_SYNC` / `CONTENT_REPO_URL` / `CONTENT_DIR`（第 15-17 行）；
2. 在 `content/` 目录里 `git stash` → `git fetch --all --prune` → `git checkout <branch>` →
   `git reset --hard origin/<branch>`（第 63-84 行）；
3. 把四个目录映射进项目（第 96-101 行）：

   | 内容仓库里的路径 | 项目里的落点 |
   | --- | --- |
   | `content/posts` | `src/content/posts` |
   | `content/spec` | `src/content/spec` |
   | `content/data` | `src/data` |
   | `content/images` | `public/images` |

   落点上如果已经存在真实目录，会先改名成 `.backup`（`.gitignore:24` 忽略了 `*.backup`），
   再建 Windows 目录联接（junction），失败则退化成递归复制（第 111-136 行）。

### 当前实际状态（重要）

- `.env` 里 `ENABLE_CONTENT_SYNC=true`，看起来是开着的；
- 但 `CONTENT_REPO_URL` 指向的是**代码仓库自己**（`https://github.com/MLFK-MLFK/Mizuki-MLFK.git`），
  克隆下来的 `content/` 根目录就是这份代码，里面**没有** `posts/`、`spec/`、`data/`、`images/`
  这几个顶层目录（它们在这份代码里叫 `src/content/posts` 等）；
- 于是第 103-108 行的循环对四个映射全部打印「跳过不存在的源目录」，**一个都没建**；
- `src/content/posts`、`src/data` 至今仍是普通目录，不是符号链接。

**结论：这套机制目前在空转。它唯一的实际副作用，就是第一节说的那次自动 `git add .` + `git commit`。**

如果哪天你要真正启用它，注意两件事：

1. `CONTENT_REPO_URL` 必须换成**真正的内容仓库**，并且那个仓库的根目录下要有 `posts/`、`spec/`、
   `data/`、`images/` 四个目录；
2. 第一次跑会把现有的 `src/content/posts` 等改名成 `*.backup`。确认内容已经从新仓库同步好了再删备份。

另外，`content/` 整个目录被 `.gitignore:23` 忽略，它是本机的一个克隆产物，
**不要**把它当成项目的一部分去改 —— 下次同步 `git reset --hard` 会全部抹掉。

---

## 三、起始页 `/` 与文章列表 `/home/` 的分工

这是一次近期的路由重构，是本项目最容易改错的地方。

### 改了什么

| URL | 源码 | 是什么 |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | 起始页：开屏动画 + 「进入」按钮 |
| `/home/`、`/home/2/`… | `src/pages/home/[...page].astro` | 分页文章列表（原来的首页） |
| `/start/` | `astro.config.mjs:50-52` 的 redirects | 老地址，静态 meta refresh 跳回 `/` |

### 唯一的真相来源

```ts
// src/constants/constants.ts:14
export const HOME_PATH = "/home/";
```

**凡是判断「这是不是首页」的地方，都必须用这个常量，绝不能写死 `"/"`。**
写死的 `"/"` 现在指的是起始页，语义和以前完全相反了。

现存的引用点（用 grep 核对过）：

- `src/layouts/Layout.astro:42` — `isHomePage` 判定
- `src/layouts/MainGridLayout.astro:54` — 控制横幅高度与布局类名
- `src/components/organisms/navigation/Navbar.astro:30`、`:57` — 判定 + logo 链接
- `src/scripts/core/swup-hooks.ts:134`
- `src/components/features/toc/hooks/useMobileTOC.ts:134-135`
- `src/utils/navigation-utils.ts:256`
- `src/constants/link-presets.ts:12` — 导航栏「首页」预设
- `src/components/control/BackToHome.astro:12`、`CategoryBar.astro:12`、`Search.svelte:25,33`、`404.astro:53`
- `src/components/features/landing/LandingHero.astro:29`、`LandingBento.astro:93`、`nav-links.ts:91`

### 两个已经踩过的漏网之鱼

重构时用 grep 搜 `url("/")` / `href="/"` 是搜不干净的 —— 下面两处写的是**裸字符串** `"/"`，
会在重构里被漏掉：

1. `src/components/control/BackToHome.astro` —— 浮动「返回首页」按钮。它的显隐逻辑是
   「当前路径 ≠ homePath 就显示」，`homeUrl` 若还是 `"/"`，站在 `/home/` 上按钮也不肯隐藏，
   点一下还要整页加载起始页、重播 5 秒开屏。
2. `public/pio/static/pio.js:169` —— 看板娘的「回到首页」按钮。

**教训：以后再做这类路径迁移，别只 grep 一种写法。** 至少覆盖 `"/"`、`'/'`、`url("/")`、`href="/"`、
以及 `=== "/"` / `!== "/"` 这类比较，最好把 `src/` 和 `public/` 都扫一遍。

### 为什么 `public/` 下的文件要特别小心

`public/` 里的文件**不经过构建流程**，会原样拷进 `dist/`。
所以 `public/pio/static/pio.js` 里没法 `import` `HOME_PATH`，只能手抄一份：

```js
// public/pio/static/pio.js:169
var homePath = "/home/";
```

**改 `HOME_PATH` 时，这个文件必须手动跟着改。** 建议改完 grep 一遍 `public/` 确认。

### 为什么导航不能指向 `/`

用户在站内点「首页」时，如果目标是 `/`，就会落到起始页 —— 又得等 5 秒开屏。
所以导航栏 logo、侧栏「首页」、返回首页按钮、404 页的按钮，全都指向 `/home/`。
新的站内入口也要遵守这条：**除非是有意回起始页，否则别往 `/` 上挂链接。**

---

## 四、Swup：大半「刷新一下就好了」的 bug 都出在这里

本站用 `@swup/astro` 把站内导航做成了无刷新换页。代价是一堆生命周期陷阱。

### `ignore` 的真实语义（务必读准）

`astro.config.mjs:98-103` 用了函数形式的 `ignore`。这个选项的匹配规则是：

| 写法 | 匹配方式 |
| --- | --- |
| 以 `/` 开头的字符串 | `url.startsWith(值)` —— **前缀匹配** |
| 其它字符串 | 当成 CSS 选择器，对 `el` 做匹配 |
| RegExp | `ignore.test(url)` |
| 函数 | `ignore(url, { el, event })` |
| 数组 | 任一命中即忽略 |

传给函数的 `url` 是 `pathname + search + hash`。

**最要命的一条：字符串项是前缀匹配。** 起始页占了根路径 `/` 之后，
如果按老写法在数组里放字符串 `"/"`，那就等于 `url.startsWith("/")`，
**整个站点都会被忽略，swup 彻底失效**。所以这里只能用回调做精确比对：

```js
// astro.config.mjs:99
(_url) => _url === "/",
```

另外，`data-no-swup` 属性由 swup 默认的 `ignoreVisit` 处理，不需要自己写进 `ignore`。

### `swup.navigate()` 抓不到 `el`

`astro.config.mjs:100-102` 的第二条规则是必须的：

```js
(_url, { el }) => !!document.getElementById("lp-root") || !!el?.closest("#lp-root")
```

前半段看起来多余，其实是关键：**`window.swup.navigate()` 做忽略判断时不传 `el`。**
看板娘、返回首页按钮这类程序化跳转都走这条路，只有靠「当前文档里还有 `#lp-root`」
这个事实才能把它们拦下来。少了它，在起始页上触发任何 swup 跳转都会把 `<main>`
换成一个对不上的外壳，只能刷新恢复。

### 起始页为什么必须整页加载

swup 只替换 `containers: ["main"]` 指定的 `<main>` 元素。

- 内容页的 `<main>` 深埋在 `MainGridLayout` 的 `#main-grid` 里，导航条、横幅、侧栏都在 `<main>` **之外**；
- 起始页完全不用 `MainGridLayout`，它的 `<main>` 是 `<body>` 的直接子元素。

两边的外壳结构对不上，换过去必然错位。所以起始页与内容页之间的跳转**必须走整页加载**，
这就是 `ignore` 存在的意义。

### 脚本该挂哪个事件

**这是新人最容易犯的错。**

- 挂在 `DOMContentLoaded` 上的初始化代码，**swup 换页后不会再执行**；
- 应该挂 `astro:page-load`（每次换页后触发）；
- 需要在换页**之前**清理的（解绑监听、销毁定时器）挂 `astro:before-swap`；
- 参考实现：`src/scripts/landing/index.ts` 的结尾就是
  `astro:before-swap → teardown` + `astro:page-load → initLanding` 这一对。

写新的客户端脚本时，先想清楚「这个脚本在第二次进入页面时还会不会跑」。

### 另一个静音开关

`astro.config.mjs:68` 的 `updateHead` 只在生产构建时为 `true`。
`HeadTags.astro:189-200` 里还有一段开发模式补丁：dev 下把 `window.swup.options.updateHead`
强制关掉，避免 swup 反复替换 `<head>` 里的样式标签导致偶发样式丢失。
**所以「dev 下样式偶尔错乱、build 后正常」不一定是你的 CSS 写错了。**

---

## 五、根字号会随窗口宽度缩放（rem 的隐形系数）

`src/layouts/partials/HeadTags.astro:147-186` 有一段自动缩放，由 `src/config.ts:66-69` 的
`pageScaling` 控制（当前 `enable: true`、`targetWidth: 2000`）：

```js
const isTabletLike = isTouch || window.innerWidth <= 1280;
if (isTabletLike || isPortrait) { document.documentElement.style.fontSize = ""; return; }  // 还原为 100%
const targetWidth = pageScaling.targetWidth || 2000;
let scale = document.documentElement.clientWidth / targetWidth;   // 2000 → 1
if (scale > 1) scale = 1;
if (scale < 0.85) scale = 0.85;                                   // 下限 85%
document.documentElement.style.fontSize = `${scale * 100}%`;
```

换算成实际行为（非触屏、非竖屏）：

| 浏览器宽度 | 根字号 |
| --- | --- |
| ≤ 1280px | 100%（走 early return） |
| 1280 – 1700px | **85%**（被下限卡住） |
| 1700 – 2000px | 85% → 100% 线性过渡 |
| ≥ 2000px | 100% |

**影响：** `1rem` 在 1280–1700px 区间只有 13.6px 而不是 16px。
所有用 rem 表达尺寸的地方 —— 尤其是 `clamp()` 的上限 —— 在宽屏上都会按这个系数缩水。

**排查时的用法：** 如果你在 1440px 宽的窗口里量出来某元素比预期小了 15%，
先别改 CSS，打开控制台看 `document.documentElement.style.fontSize`。
量尺寸时用开发者工具的设备模拟，把宽度设成 ≤1280 或 ≥2000 就能拿到 100% 基准。

---

## 六、路由与 URL 的零碎坑

### `trailingSlash: "always"`

`astro.config.mjs:41`。所有内部链接都要带尾斜杠，`/home/2/` 而不是 `/home/2`。
拼 URL 时用 `url()`（`src/utils/url-utils.ts`，内部走 `joinUrl`）而不是手写字符串拼接，
它会处理 `BASE_URL` 并折叠重复斜杠。

### `redirects` 只能写一个 key

```js
// astro.config.mjs:50-52
redirects: { "/start": "/" },
```

因为 `trailingSlash: "always"` 会把 `"/start"` 和 `"/start/"` 归一成同一条路由，
**两个都写会让路由直接报 "The route is defined in both"**。写不带斜杠的那个。

### `page.url.first` 在第一页是 `undefined`

`Astro.paginate` 给出的 `page.url` 是 `{ current, prev, next, first, last }`，
其中 `first` 只在**当前不是第一页**时才有值。

`src/components/control/Pagination.astro` 里正是靠这个特性反推列表首页：

```ts
const listBase = page.url.first ?? page.url.current;
```

站在第一页时 `first` 是 `undefined`，`current` 本身即列表首页 —— 一个表达式兜住两种情况。

### 分页页也属于「首页的延续」

`/home/2/` 不该被当成普通内页。`CategoryBar.astro` 和 `useMobileTOC.ts:134-135`
都用正则匹配 `^/home/\d+/?$` 来把分页页归入首页。加新的「首页判定」时别忘了这一条。

---

## 七、有两个同名的 `pathsEqual`

```
src/utils/url-utils.ts:16
src/utils/navigation-utils.ts:270
```

两个函数都叫 `pathsEqual`，语义相近但不保证完全一致。当前布局层用的是
`url-utils` 那个（`Layout.astro:13`、`MainGridLayout.astro:23`、`Navbar.astro:8`、
`swup-hooks.ts:7`），而 `navigation-utils` 里那个的引用情况不同。

**改其中一个前先 grep 清楚是谁在用。** 这是历史遗留的重复定义，不是设计。

---

## 八、样式与构建的零碎坑

### Tailwind v4 没有配置文件

样式入口是 `src/styles/main.css`，通过 `@tailwindcss/vite` 插件接入（`astro.config.mjs:7`、`:222`）。
**仓库里没有 `tailwind.config.js`**，主题变量用 CSS 里的 `@theme` 之类指令声明
（`main.css:25` 能看到 `--breakpoint-lg: 1280px` 这类定义）。
找不到配置文件是正常的，不要因此以为 Tailwind 没配好。

### 搜索索引只在构建之后存在

Pagefind 是构建后处理 `dist/` 生成索引的，配置在 `pagefind.yml`。
所以 `npx astro dev` 里**站内搜索是搜不出东西的**，这是预期行为，不是坏了。

### `public/` 下的文件不参与构建

`public/` 里的东西原样拷进 `dist/`。它们：

- 不能用 `import`、不能用路径别名、不能用 `import.meta.env`；
- **改了项目常量却忘了同步它们，会静默地指向旧地址**（见第三节的 pio.js）。

`public/pio/static/pio.js` 和 `public/` 下的 Live2D 资源都是这类。

### 起始页的样式是一份独立的表

`src/styles/landing/landing.css`（约 2000 行）只管起始页，全局样式在 `src/styles/main.css`
与 `src/styles/variables.styl`。**不要混着改** —— 起始页的时间轴用了一整套 `--lp-*` CSS 变量，
和主样式表的变量体系没有交集。

---

## 九、仓库里当前就有的破损点

这几处**不是我改坏的，是本来就坏的**，先如实记录，别当成自己的 bug 去查。

### 1. `deploy.yml` 的 YAML 是语法错误的

```yaml
# .github/workflows/deploy.yml:6-10
  push:
    branches: [ main ]
      repository_dispatch:  # 👈 添加这个
    types:
      - content-updated
```

`repository_dispatch:` 被缩进到了 `branches:` 的下一层，`types:` 又挂在错误的位置。
这份 YAML 解析不了，**这个工作流在 GitHub 上根本无法运行**。
（意图看起来是想同时监听 push 和 repository_dispatch，正确的写法是两个并列的触发器 key。）

### 2. 两个工作流盯着不存在的 `main` 分支

```
.github/workflows/CI.yml:5,7        branches: [ master ]   ✅
.github/workflows/lint.yml:5,7      branches: [ master ]   ✅
.github/workflows/build.yml:5,7     branches: [ main ]     ❌ 远端没有这个分支
.github/workflows/deploy.yml:7      branches: [ main ]     ❌
```

远端只有 `master`（`origin/HEAD -> origin/master`）。所以 `build.yml` 永远不触发。
`deploy.yml` 本来也跑不了 —— 除了分支名，YAML 本身还是坏的。

### 3. 导航栏两个入口指向不存在的页面

`src/config.ts:296` 和 `src/config.ts:324` 的下拉菜单父项 `url` 都写着 `"/content/"`，
但项目里**没有 `src/pages/content/` 这个路由**，线上会 404。

（这两项是下拉菜单的父节点，本身不该可点 —— 正确做法通常是把父项 URL 指到它第一个子项，
或者让父项不可点击。改之前先确认设计意图。）

### 4. `content/` 目录的克隆源指向代码仓库自己

见第二节。目前是空转，但它每次都会触发一次自动提交。

---

## 十、本机环境与验证手法

写在这里是因为下一个人大概率是同一台机器 / 同类环境。

### 环境约束

- **Windows + bash（Git Bash）**。路径用正斜杠，`/tmp` 存在但实际是 `%TEMP%` 的映射。
- **没有装 Python**。执行 `python` 会报 `Python was not found`（退出码 49）。
  处理 JSON 用 `node -e '...'`，本机 Node 是 v24。
- **包管理器是 pnpm 11**，`pnpm install` 里有 `only-allow pnpm` 守卫。

### 无头浏览器实测（没有 Playwright 模块）

`node_modules` 里**没有** `playwright` / `playwright-core` / `puppeteer`。
但浏览器二进制是有的，可以用 CDP 直接驱动：

- 可执行文件：`%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1208\chrome-headless-shell-win64\chrome-headless-shell.exe`
- Node 24 自带全局 `WebSocket`，不需要额外依赖。

要点（都是踩过的）：

1. 用 `--remote-debugging-port=0`，然后从 **stderr** 里解析出 `ws://...` 地址；
2. 连上后用 `Target.createTarget` + `Target.attachToTarget`（`flatten: true`）拿 `sessionId`，
   之后所有 `send` 都要带上它；
3. **`file://` 打不开构建产物** —— 目录索引解析不了。必须起一个 `node:http` 静态服务器指向 `dist/`；
4. `Input.dispatchMouseEvent` / `dispatchKeyEvent` 发的是**真实输入事件**（isTrusted），
   比在页面里 `el.click()` 可信得多，测交互一律用前者；
5. **判断一次导航是不是 swup 换页**：跳转前往 `window` 上挂个标记（如 `window.__marker = 1`），
   跳转后标记还在 = swup 无刷新；标记没了 = 整页刷新；
6. 视口尺寸用 `document.documentElement.clientWidth`，别用 `window.innerWidth`
   （两者可能不一致，本机上就差了 15px）。

### 改完之后至少要跑的验证

```bash
npx astro check     # 类型与语法，300 个文件
npx astro build     # 真实构建，确认页面数与产物
```

改了路由或链接的，还要在 `dist/` 里 grep 一遍确认没有残留的旧地址。

---

## 十一、症状 → 先查什么

| 症状 | 先看这里 |
| --- | --- |
| 跳转后页面错位，刷新就好 | 第四节的 swup 段；两边 `<main>` 结构是否对得上；脚本是不是挂错了事件 |
| 站内导航整体失效，点哪儿都整页刷 | `astro.config.mjs` 的 `ignore` 里是不是混进了字符串 `"/"`（前缀匹配会吃掉全站） |
| 起始页上点任何东西都被送去别的地方 | `.lp-splash` 的 `pointer-events`；起始页的 `ignore` 规则 |
| 某元素比设计稿小了一圈 | 第五节的根字号缩放，先看 `documentElement.style.fontSize` |
| 搜索没结果 | 第八节，Pagefind 索引只在构建后存在 |
| 站内某个「首页」链接把用户带回开屏动画 | 有没有哪里又写死了 `"/"`，应该用 `HOME_PATH` |
| 莫名多出一条 `chore(content): sync ...` 提交 | 第一节，有人跑了 `pnpm dev` / `pnpm build` |
| `public/` 里的脚本指向了旧地址 | 第三节末，`public/` 不参与构建，常量要手抄 |
| 找不到 `tailwind.config.js` | 第八节，Tailwind v4 不用它 |

---

## 相关文件

- `scripts/sync-content.js` —— 内容同步与自动提交的元凶，第 157-163 行
- `package.json` —— 第 8-9 行的 `predev` / `prebuild`，第 24 行的 `preinstall`
- `src/constants/constants.ts` —— `HOME_PATH` 与 `PAGE_SIZE`
- `astro.config.mjs` —— swup 的 `ignore`（第 98-103 行）、redirects（第 50-52 行）
- `src/layouts/partials/HeadTags.astro` —— 根字号缩放（第 147-186 行）
- `src/components/control/BackToHome.astro` —— 曾经漏网的硬编码 `"/"`
- `public/pio/static/pio.js` —— 另一个漏网之鱼，第 169 行
- `src/utils/url-utils.ts` / `src/utils/navigation-utils.ts` —— 两个同名 `pathsEqual`
- `.github/workflows/deploy.yml` —— YAML 坏掉的那个
- `src/config.ts` —— 第 296、324 行指向不存在页面的导航项
