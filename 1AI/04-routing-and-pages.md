# 04 · 路由与页面

这一块回答一个问题：**一个 URL 到底对应磁盘上的哪个文件、又是怎么算出来的**。Astro 是「文件即路由」，但本项目在默认规则之外叠了三层东西：`astro.config.mjs` 里的全局路由开关、以 `src/pages/home/[...page].astro` 为代表的分页路由、以及 `permalink` 机制带来的「一篇文章有两个 URL」的兼容设计。

读者最常带着这些问题来：改导航链接、加一个静态页、调分页大小、给某篇文章换 URL、搞不清为什么 `/` 是开屏动画而不是文章列表、发现 `/content/` 点进去 404、或者访问一个不存在的地址时到底发生了什么。下面按「先通用规则、再具体页面、最后速查」的顺序展开。

---

## 1. 文件即路由：两套 URL 来源

### 1.1 `src/pages/` 的映射规则

Astro 把 `src/pages/` 下的文件按固定规则映射成 URL，与文件名一一对应：

| 磁盘文件 | 产出 URL | 说明 |
| --- | --- | --- |
| `src/pages/about.astro` | `/about/` | 单文件页（`trailingSlash:"always"` 补尾斜杠） |
| `src/pages/foo/index.astro` | `/foo/` | 目录形式的同名页，与上一行等价 |
| `src/pages/home/[...page].astro` | `/home/`、`/home/2/`… | `[...rest]` 是通配，捕获整个尾部，配合 `getStaticPaths` 生成多条 |
| `src/pages/albums/[id]/index.astro` | `/albums/<id>/` | `[id]` 是单段动态参数，具体值由 `getStaticPaths` 给出 |
| `src/pages/og/[...slug].png.ts` | `/og/<slug>.png` | 扩展名 `.png` 保留在 URL 里，用于生成图片 |

几条通用规则：

- **目录层级等于 URL 层级**。想换列表的 URL，换个目录就够了（见 §4）。
- **凡带 `[` 的路由都必须导出 `getStaticPaths()`**，否则 `output:"static"` 下不会产出任何页面。本项目的动态路由：`src/pages/home/[...page].astro:23`、`src/pages/posts/[...slug].astro:35`、`src/pages/[...permalink].astro:40`、`src/pages/albums/[id]/index.astro:16`、`src/pages/og/[...slug].png.ts:24`。
- 个别动态页还写了 `export const prerender = true`（`src/pages/og/[...slug].png.ts:22`、`src/pages/devices.astro:12`、`src/pages/friends.astro:13`）。在 `output:"static"` 下所有页面默认就是预渲染的，这个声明是冗余的，写不写都行。

加一个普通静态页：在 `src/pages/` 下建 `<名字>.astro`（或 `<名字>/index.astro`），它会自动出现在 `/名字/`；如果它要受 `featurePages` 开关控制，参照 §10 的写法在 frontmatter 顶部加守卫。

`src/components/features/landing/nav-links.ts:56-63` 的 `isReachablePage()` 正是按「`<slug>.astro` 或 `<slug>/index.astro` 是否存在」来判断一个站内链接真不真能打开，可以当作这条映射规则的旁证。

### 1.2 `public/` 是第二套 URL 来源

`public/` 下的文件**不经过 `src/pages/`**，构建时被原样复制到站点根，按相对路径直接访问：

| 磁盘路径 | 产出 URL |
| --- | --- |
| `public/test.mp4` | `/test.mp4` |
| `public/images/albums/...` | `/images/albums/...` |
| `public/pio/...` | `/pio/...` |
| `public/js/...` | `/js/...` |

`public/` 放「不需要任何处理、原样提供」的东西（视频、静态图片库、看板娘资源、手写脚本）；需要 schema 校验、需要被组件 import 的内容放 `src/`。

**同名冲突时是 `public/` 赢**：如果某个生成页面的输出路径在 `public/` 里已存在同名文件，Astro 会**跳过**那个生成页面并打一条 build 警告（`node_modules/astro/dist/core/build/generate.js:369-382` 的 `checkPublicConflict`，警告文案是 `Skipping ... because a file with the same name exists in the public folder`）。也就是说 `public/about/index.html` 会被原样发出，而 `src/pages/about.astro` 生成的版本被丢弃。这种冲突很难排查，加页面时避开和 `public/` 重名。

---

## 2. 全局路由设定：`astro.config.mjs`

`astro.config.mjs:38-52` 是路由总开关：

| 配置 | 值 | 位置 | 后果 |
| --- | --- | --- | --- |
| `site` | `siteConfig.siteURL`（当前 `https://mlfk.pages.dev/`） | `astro.config.mjs:39` | RSS、sitemap、OG 图、`Astro.site` 全靠它；域名变了改 `src/config.ts:29` |
| `base` | `"/"` | `astro.config.mjs:40` | 部署在子路径时才需要改；它会被 `url()` 拼进每个站内链接（见下） |
| `trailingSlash` | `"always"` | `astro.config.mjs:41` | 所有内部链接**必须**带尾斜杠 |
| `output` | `"static"` | `astro.config.mjs:43` | 纯静态，无 SSR；`Astro.redirect` 退化成 meta refresh 页（见 §10） |
| `redirects` | `{ "/start": "/" }` | `astro.config.mjs:45-52` | 老书签兜底 |

### `trailingSlash: "always"` 的连锁反应

它决定了：

- 站内所有链接写成 `/home/`、`/about/`，不能写 `/about`。
- `Astro.paginate` 生成的 URL 也带尾斜杠：`/home/`、`/home/2/`（`src/pages/home/[...page].astro:27`）。
- `url()`（`src/utils/url-utils.ts:101-103`）只是 `joinUrl("", BASE_URL, path)`，**不做补斜杠**。传进去的 path 必须自带尾斜杠，例如 `url(HOME_PATH)` 里 `HOME_PATH` 本身就写成 `"/home/"`（`src/constants/constants.ts:14`）。
- `pathsEqual()`（`src/utils/url-utils.ts:16-20`）会把首尾斜杠都剥掉、再**统一转小写**后比较，所以判断「是不是首页」时不依赖尾斜杠的写法，这是刻意的冗余。

### `redirects` 里 `/start` → `/` 的来龙去脉

`astro.config.mjs:45-49` 的注释：起始页**原先**的路径是 `/start/`，后来顶掉了根路径，文章列表退到 `/home/`。老书签和浏览器历史里还存着 `/start/`，所以给它一条静态跳转。两个细节：

- **只写不带斜杠的键 `"/start"`**。按注释（`astro.config.mjs:48-49`）的说法，`trailingSlash:"always"` 会把 `"/start/"` 归一成同一路由，两个键都写会让 router 报 `defined in both`。
- `output:"static"` 下 Astro 生成的是一个只含 meta refresh 的 `/start/index.html`。实测产物 `dist/start/index.html` 内容是 `content="0;url=/"`，即**立即**跳转（对照 §10 里 featurePages 空壳是 2 秒）。

---

## 3. 站点根是起始页，文章列表在 `/home/`

### 谁是谁

| URL | 文件 | 内容 |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | 起始页：开屏动画 + 「进入」按钮 + 7 张卡片 + 页脚 |
| `/home/`、`/home/2/`… | `src/pages/home/[...page].astro` | 分页文章列表（原来的首页） |

`src/pages/index.astro:12-34` 的注释就是设计说明：起始页占了根路径，原来的首页（分页文章列表）挪到 `src/pages/home/[...page].astro`。两者**没有互相 import**，唯一的耦合是「进入」按钮和一些链接都指向 `HOME_PATH`。

起始页从 `src/pages/index.astro:80-84` 调 `initLanding()`，逻辑在 `src/scripts/landing/index.ts`、样式在 `src/styles/landing/landing.css`。它**不走 `MainGridLayout`**：`src/pages/index.astro:47` 直接用 `<Layout>`，其默认 slot 里的 `<main id="swup-container">`（`src/pages/index.astro:65`）最终是 `<body>` 的直接子元素（`src/layouts/Layout.astro:235` 的 `<slot />`）。内容页的 `<main>` 则埋在 `MainGridLayout` 的 `#main-grid` 里，两边外壳对不上 —— 这正是下面 swup 要特殊处理的原因。

### `HOME_PATH` 约定：为什么到处都指 `/home/` 而不是 `/`

`src/constants/constants.ts:3-14` 把约定写成了常量并附了原因：**站内点「首页」不该重播 5 秒开屏**，所以「首页 = 文章列表 = `/home/`」，根路径是起始页、语义完全变了。注释原话：凡是判断「这是不是首页」的地方都必须用这个常量，别再写 `"/"`。

引用点一览（改 `HOME_PATH` 一处，这些地方一起跟着走）：

| 文件 | 行 | 用途 |
| --- | --- | --- |
| `src/constants/link-presets.ts` | `:10-12` | 导航栏「首页」项 `LinkPreset.Home` 的 url |
| `src/components/organisms/navigation/Navbar.astro` | `:30`、`:57` | 判断当前是否首页（决定横幅高度）、logo 链接 |
| `src/layouts/Layout.astro` | `:42` | `isHomePage`，用于 `lg:is-home` 高度补偿 |
| `src/layouts/MainGridLayout.astro` | `:54` | 同上 |
| `src/scripts/core/swup-hooks.ts` | `:134` | swup 换页时重置 body class / 横幅状态 |
| `src/components/features/toc/hooks/useMobileTOC.ts` | `:131-136` | 首页及 `/home/2/` 等分页也算首页（正则 `^/home/\d+/?$`） |
| `src/components/control/BackToHome.astro` | `:12` | 右下角「返回首页」浮动按钮的目标与显隐判定 |
| `src/components/features/landing/nav-links.ts` | `:91` | 起始页快捷入口要**排掉** `/home/`（上方大按钮已干这事） |
| `src/pages/404.astro` | `:52-53` | 404 页的「返回首页」按钮 |

`src/components/control/BackToHome.astro:8-11` 补充了原因：如果这里写 `"/"`，显隐判定是「`path !== homePath` 就显示」，那站在 `/home/` 上按钮也不会藏，点一下还会被送去起始页。

### 起始页不参与 swup 换页

`astro.config.mjs:98-103` 给 swup 配了 `ignore`，两条回调：精确命中 `/`、以及当前文档或点击元素落在 `#lp-root` 内。原因是起始页的 `<main>` 外壳和内容页对不上，一旦被 swup 替换 `<main>`，会出现「导航条残留」或「栅格外壳丢失」，只能刷新恢复（`astro.config.mjs:71-97`）。注释特别说明：`ignore` 里**不能**写字符串 `"/"`，因为字符串项走 `url.startsWith(ignore)`，会忽略全站，所以必须用回调精确比对（`astro.config.mjs:84-86`）。

---

## 4. 分页：`home/[...page].astro` + `Astro.paginate`

### 生成侧

`src/pages/home/[...page].astro:23-28`：

```ts
export const getStaticPaths = (async ({ paginate }) => {
  const allBlogPosts = await getSortedPosts();
  initPostIdMap(allBlogPosts);
  return paginate(allBlogPosts, { pageSize: PAGE_SIZE });
}) satisfies GetStaticPaths;
```

- `PAGE_SIZE = 8`（`src/constants/constants.ts:1`）。Astro 默认是 10，这里是 8。
- 顺序由 `getSortedPosts()` 决定：先置顶（`pinned`，再按 `priority` 数值小的在前），否则按 `published` 降序（`src/utils/content-utils.ts:13-41`）。
- **草稿只在生产被过滤**：`src/utils/content-utils.ts:9-11` 是 `import.meta.env.PROD ? data.draft !== true : true`，所以 `npx astro build` 时草稿不进列表，dev 时会。
- 路由前缀由目录决定，换目录等于换列表 URL（`src/pages/home/[...page].astro:14-19` 的注释）。
- 当前 `src/content/posts/` 下有 4 篇文章（`VRCTool/index.md`、`guide/index.md`、`video.md`、`video_ZB/index.md`，`draft` 均为 `false`），4 ≤ 8，所以产物里只有 `dist/home/index.html`，没有 `/home/2/`。

### `Page.url` 的形状

`Astro.paginate` 传下来的 props 是 `{ page: Page }`，结构见 `node_modules/astro/dist/types/public/common.d.ts:45-73`：

| 字段 | 含义 |
| --- | --- |
| `current` | 当前页 URL |
| `prev` / `next` | 上一页 / 下一页 URL，没有则是 `undefined` |
| `first` | **仅当当前不是第一页时**才有值（`node_modules/astro/dist/types/public/common.d.ts:68`） |
| `last` | 仅当当前不是最后一页时才有值 |
| `currentPage` / `lastPage` / `size` / `total` | 页码元数据（`size` 默认 10，`node_modules/astro/dist/types/public/common.d.ts:57`） |

### 消费侧：`Pagination.astro` 为什么用 `first ?? current`

`src/components/control/Pagination.astro:74`：

```ts
const listBase = page.url.first ?? page.url.current;
```

页码链接不能再写死前缀。注释（`Pagination.astro:63-73`）讲了历史：以前写死 `"/"` 和 `/${p}/`，只因列表恰好长在根路径上；列表挪到 `/home/` 后写死会把第 2 页指到 `/2/`，起始页没了、列表也没了。改用 `first ?? current` 反推是：站在第一页时 `first` 是 `undefined`，此时 `current` 本身就是列表首页；站在第 2 页时 `first` 是 `/home/`、`current` 是 `/home/2/`。`getPageUrl`（`:76-81`）据此把「第 1 页」映射回 `listBase`，其余拼成 `${listBase}${p}/`。

`prev` / `next` 直接当 `href` 用（`Pagination.astro:89`、`:134`）。

---

## 5. 文章详情：两套路由 + `permalink`

### 两个入口文件

| 文件 | 负责的 URL 形态 | 何时生成 |
| --- | --- | --- |
| `src/pages/posts/[...slug].astro` | `/posts/<slug>/` | 每篇文章都生成（兼容旧链接） |
| `src/pages/[...permalink].astro` | `/<permalink>/`（站根下任意层级） | 仅当文章有自定义 `permalink` **或**全局 `permalinkConfig.enable` 打开时 |

### `posts/[...slug].astro` 的 `getStaticPaths`

`src/pages/posts/[...slug].astro:35-96` 的逻辑顺序：

1. `getSortedPosts()` 拿全部文章，`initPostIdMap()` 初始化序号映射（`:36-39`）。
2. 对每篇：`defaultSlug = removeFileExtension(entry.id)`，**无条件** push 一条 `/posts/<defaultSlug>/` —— 三个分支（`:52-59`、`:63-68`、`:69-92`）都包含这一步。注释（`:50-53`）说得很直白：即便文章有自定义 permalink，也仍要在 `/posts/` 下留默认路径，为了兼容旧链接。
3. 只有在**全局 permalink 未启用**的 `else` 分支里（`:69-92`），才**额外**为有 `alias` 的文章 push `/posts/<alias>/`（`:78-91`），并会剥掉开头的 `posts/` 前缀避免重复。另外两个分支没有这一步 —— 三个分支产出的路径集合并不相同。

### `[...permalink].astro` 的 `getStaticPaths`

`src/pages/[...permalink].astro:51-72`：自定义 `permalink` 优先，其次全局模板 `generatePermalinkSlug()`；两者都没有就跳过（不生成根路径路由）。

### 解析顺序（`getPostUrl`）

链接生成统一走 `src/utils/url-utils.ts:44-66` 的 `getPostUrl()`：

1. `post.data.permalink` → `/<slug>/`（`:46-51`）
2. `permalinkConfig.enable` → `generatePermalinkSlug()` → `/<slug>/`（`:53-57`）
3. `post.data.alias` → `/posts/<alias>/`（`:59-62`）
4. 兜底 → `/posts/<id>/`（`:64-65`）

注意第 3 步：**alias 仍在 `/posts/` 下，permalink 在站根下**，语义不同，别混。schema 里两个字段定义在 `src/content.config.ts:31`（`alias`）和 `:34`（`permalink`）。

### 全局 permalink 模板

`src/config.ts:393-418`。`enable: false`（`:394`），模板 `format: "%postname%"`（`:417`）。支持的占位符在 `:395-416` 有完整注释（`%year%`、`%post_id%`、`%postname%`、`%raw_postname%`、`%category%` 等），并允许用 `/` 拼嵌套路径。

`generatePermalinkSlug()`（`src/utils/permalink-utils.ts:62-119`）实现替换。两个占位符值得记：

- `%post_id%` 走 `getPostNumericId()`（`:113`），序号来自 `postIdMap`：按 `published` **升序**，最早的文章 id = 1（`:22-30`）。
- `%raw_postname%` 用 `filePath` 取原始文件名保留大小写（`:86-93`）；`%postname%` 用 `entry.id`（已被小写化，见下）。

### 反直觉：文章 `id` 是被小写化的 slug

磁盘上是 `src/content/posts/VRCTool/index.md`、`video_ZB/index.md`，但 `entry.id` 是 `vrctool`、`video_zb`。原因是 `src/content.config.ts:6` 用的 glob loader 默认以 slug 作 id：`node_modules/astro/dist/content/loaders/glob.js:9-27` 的 `generateIdDefault` 返回 slug，而 slug 由 `node_modules/astro/dist/content/utils.js:272` 对路径的**每一段**调用 `githubSlug()` 得到，它会把大写变小写、空格变连字符，再去掉结尾的 `/index`。产物印证：`dist/posts/video_zb/`、`dist/posts/vrctool/`，sitemap 里也是小写。

所以：

- 别以为目录名 `VRCTool` 会变成 URL 里的 `VRCTool`。
- `removeFileExtension(entry.id)`（`src/utils/url-utils.ts:12-14`）对当前 loader 产出的 id 基本是空操作（id 已无扩展名），它主要是防御性写法。
- 想要固定、可读的 URL，用 `permalink`（或 `alias`）显式指定。

这套小写化**只作用于 content collection 的条目**。`/albums/[id]/` 的 id 来自 `scanAlbums()` 扫描目录名（`src/utils/album-scanner.ts:96` 的 `id: folderName`），**保留原始大小写** —— `dist/sitemap-0.xml` 里写的是 `/albums/VRChat/`。两者恰好相反，别把文章的小写化推广到全站。

### 加密文章的渲染差异

同一篇加密文章，两套路由的客户端解密实现不同：

- `src/pages/posts/[...slug].astro:290-305` 用 `Encryptor`（服务端把密码交给组件）。
- `src/pages/[...permalink].astro:86-92` 在构建期用 CryptoJS 把正文（前缀 `MIZUKI-VERIFY:`）加密成密文，再交给 `PasswordProtection` 客户端解密。

两处都只判断 `entry.data.encrypted && entry.data.password`。

---

## 6. 构建期 JSON 接口：`src/pages/api/`

`dist/api/` 下有 `allPostMeta.json`、`calendar-data.json` 两个静态文件。因为 `output:"static"`，这些「接口」是**构建期预渲染成 JSON 的静态资源**，运行期没有服务端逻辑。

| 文件 | 输出 | 内容 |
| --- | --- | --- |
| `src/pages/api/allPostMeta.json.ts:3` | `/api/allPostMeta.json` | 每篇 `{id,title,description,published(时间戳),category,password(布尔)}`，按发布时间降序（`:6-16`） |
| `src/pages/api/calendar-data.json.ts:3` | `/api/calendar-data.json` | 每篇 `{id,title,date:"YYYY-MM-DD"}`（`:6-17`） |

**谁在什么时候请求**：

- `calendar-data.json` 由侧栏日历组件在客户端 `fetch("/api/calendar-data.json")`，见 `src/components/widgets/calendar/Calendar.svelte:117`。
- `allPostMeta.json` 在 `src/`、`public/`、`scripts/` 里 grep 不到任何消费者。它当前是一个**没有站内调用方的接口**，可能给外部脚本或历史遗留用（见 §12）。

---

## 7. 构建期图片路由：`src/pages/og/[...slug].png.ts`

给每篇文章生成 1200×630 的社交分享图，用 `satori` 把 JSX 对象渲染成 SVG，再用 `sharp` 转 PNG。

- `export const prerender = true`（`src/pages/og/[...slug].png.ts:22`），构建期生成（在 `output:"static"` 下本就如此，见 §1）。
- `getStaticPaths`（`:24-40`）先看 `siteConfig.generateOgImages`，**关闭时直接返回 `[]`**（`:25-27`），一张也不生成。当前 `src/config.ts:203` 是 `false`，所以产物里**根本没有 `dist/og/` 目录**（不是空目录）。
- 字体**从 Google Fonts 在线拉取**：`fetchNotoSansSCFonts()`（`:44-104`）请求 `family=Noto+Sans+SC:wght@400;700&display=swap`（`:50-51`），从 CSS 里正则抠出 400/700 两个 woff2 的 URL 再下载。失败只 `console.warn` 并降级为无字体（`:99-103`）—— **离线构建时 OG 图中的中文会缺字**。
- 图片资源从磁盘读：头像 `fs.readFileSync("./src/" + profileConfig.avatar)`（`:116`）、站点图标 `./public` 下的 favicon（`:119-124`），都转成 base64 data URL 塞进模板。
- 输出响应带 `Cache-Control: public, max-age=31536000, immutable`（`:352`）。

谁引用它：`src/layouts/Layout.astro:106-109` 在 `generateOgImages && postSlug` 时拼出 `/og/<postSlug>.png`，经 `src/layouts/partials/HeadTags.astro:64` 写入 `<meta property="og:image">`。这里 `postSlug` 传的是 `entry.id`（`src/pages/posts/[...slug].astro:195`、`src/pages/[...permalink].astro:118`），与 og 路由用小写 id 生成的 slug 一致。

---

## 8. 其余静态页

| URL | 文件 | 数据来源 / 行为 |
| --- | --- | --- |
| `/about/` | `src/pages/about.astro:11` | 读 `spec` 集合的 `about`，`getEntry` 不到就 `throw`（`:13-15`）；底部挂评论 |
| `/archive/` | `src/pages/archive.astro:11` | `getSortedPostsList()` 后交给 `ArchivePanel`，`client:only="svelte"`（`:49`） |
| `/albums/` | `src/pages/albums.astro:17` | `scanAlbums()` 扫相册数据；受 `featurePages.albums` 开关控制（`:13-15`） |
| `/albums/[id]/` | `src/pages/albums/[id]/index.astro:16-22` | `getStaticPaths` 由 `scanAlbums()` 产出；`:30-32` 对缺失相册再跳一次 404 |
| `/anime/` | `src/pages/anime.astro:18-19` | 数据来自 `src/data/anime.ts`；受 `featurePages.anime` 控制 |
| `/diary/` | `src/pages/diary.astro:12-13` | 数据来自 `src/data/diary.ts`；受开关控制 |
| `/devices/` | `src/pages/devices.astro:13-14` | 数据来自 `src/data/devices.ts`；受开关控制 |
| `/friends/` | `src/pages/friends.astro:16-17` | `getEntry("spec","friends")` + `src/data/friends.ts`；受开关控制 |
| `/projects/` | `src/pages/projects.astro:14-15` | 数据来自 `src/data/projects.ts`；受开关控制 |
| `/skills/` | `src/pages/skills.astro:13-14` | 数据来自 `src/data/skills.ts`；受开关控制 |
| `/timeline/` | `src/pages/timeline.astro:13-14` | 数据来自 `src/data/timeline.ts`；受开关控制 |
| `/rss/` | `src/pages/rss.astro:5` | 订阅说明页，渲染 `<FeedInfo type="rss" />`，列出最近 6 篇（`src/components/widgets/feed/FeedInfo.astro:15`） |
| `/atom/` | `src/pages/atom.astro:5` | 同上，`type="atom"` |
| `/rss.xml` | `src/pages/rss.xml.ts:22` | 真正的 RSS XML，`@astrojs/rss`，过滤掉加密文章；正文内嵌图片的处理见下 |
| `/atom.xml` | `src/pages/atom.xml.ts:22` | 同上，Atom 格式 |
| `/zyj/` | `src/pages/zyj/index.astro` | 「查 IP 属地」小工具页，客户端依次请求多个**外部第三方 API**（`:203` api.ip.sb、`:223` api.vore.top、`:243` api.ipapi.is、`:262` ipapi.co）；离线或不稳定时停在加载态 |
| `/sitemap-index.xml` | 由 `@astrojs/sitemap` 集成生成 | `astro.config.mjs:159` 的 `sitemap()`；被 `robots.txt` 引用 |

`featurePages` 开关表在 `src/config.ts:42-51`（当前 `anime/diary/projects/skills/timeline/devices` 都是 `false`，`friends/albums` 是 `true`）。**关掉不等于文件消失**：页面照常构建，只是一个跳 `/404/` 的空壳（见 §10）。

**feed 里的图片怎么处理**：`src/pages/rss.xml.ts:95-113`（`atom.xml.ts:103-121` 同构）把正文里的 `<img>` 重写为绝对 URL —— 相对路径图片经 `getImage` 优化后 `setAttribute("src", new URL(optimizedImg.src, context.site).href)`（`:99-103`，指向构建产物 `_astro/` 里的优化图）；以 `/` 开头的 public 图片 `setAttribute("src", new URL(src, context.site).href)`（`:110-113`）。全文没有任何 base64 / `data:` 拼接，**不会**把图片内联成 data URL。

---

## 9. `robots.txt` 与 sitemap

`src/pages/robots.txt.ts:3-10` 是一段写死的字符串：

```
User-agent: *
Disallow: /
Allow: /$
Allow: /posts/

Sitemap: <site>/sitemap-index.xml
```

这是一个**默认拒绝**策略：先 `Disallow: /` 全禁，再放行两处。`Allow: /$` 里的 `$` 在 robots 标准中表示匹配结尾，所以它只放行**站点根 `/` 本身**，不是放行整个站；`Allow: /posts/` 放行文章详情。也就是说 `/about/`、`/home/`、`/archive/` 这些对爬虫是被拒的。Sitemap 行用 `import.meta.env.SITE`（即 `site`，`astro.config.mjs:39`）拼绝对地址。产物 `dist/robots.txt` 已生成为上述内容。

**sitemap 与 robots 不一致的坑**：`@astrojs/sitemap` 会收录**所有**产出的页面，包括被 `featurePages` 关掉的空壳。实测 `dist/sitemap-0.xml` 里含 `/anime/`、`/diary/`、`/devices/`、`/projects/`、`/skills/`、`/timeline/` —— 这些点进去都会跳 `/404/`。这与 `src/config.ts:41` 注释「关闭未使用的页面有助于提升 SEO」的意图相矛盾：页面确实会被 sitemap 提交给搜索引擎，只是随后 404 掉。要真正清理，得给 `sitemap()` 集成加过滤（当前 `astro.config.mjs:159` 是无参调用）。

---

## 10. `404.astro`、功能页空壳与「访问不存在 URL 时发生了什么」

### 404 页

- `src/pages/404.astro` 是 Astro 的特殊约定页，构建成 `dist/404.html`（注意是 `404.html`，**不是** `404/index.html`）。
- 页面里的「返回首页」指向 `url(HOME_PATH)`（`:52-53`），注释（`:50-51`）解释：指根路径要等 5 秒开屏，迷路了不该再罚一次。

### 功能页空壳

- 所有受 `featurePages` 控制的页面在开关为 `false` 时，frontmatter 顶部直接 `return Astro.redirect("/404/")`，例如 `src/pages/projects.astro:14-15`、`src/pages/diary.astro:12-13`。
- 在 `output:"static"` 下，`Astro.redirect` **不会**产生 HTTP 302，而是生成一个 meta refresh 页。实测 `dist/projects/index.html` 只有 `<meta http-equiv="refresh" content="2;url=/404/">`（约 291 字节，`src/components/features/landing/nav-links.ts:30-31` 的注释也引用了这个体积）。
- **坑**：跳转目标是 `/404/`（带尾斜杠的目录形式），而实际产物是 `dist/404.html`，并不存在 `dist/404/index.html`。能否打开取决于托管商 —— Cloudflare Pages 会把未匹配请求回落到 `404.html`，所以在本站能工作；换托管商要复核。

`src/components/features/landing/nav-links.ts:33-42` 的 `FEATURE_PAGE_FLAG` 映射表就是为这种「文件在、内容是跳 404 的空壳」的情况准备的：起始页判断链接是否**真能打开**时，光看 `src/pages` 下有没有文件不够，还要查开关（`nav-links.ts:52-63`）。

### 访问一个不存在的 URL 时

`output:"static"` 不为任意 URL 生成路由，构建产物里只有那些确定的 HTML 文件。运行时链路是：

1. 请求先被 CDN/托管商处理，静态资源（`public/` 的副本、`_astro/` 下的构建产物）能直接命中就直接返回。
2. 命中不了任何文件时，没有服务器端逻辑可跑 —— 只能指望托管商把请求回落到 `dist/404.html`（Cloudflare Pages 的默认行为就是如此，这也是上一条 `/404/` 能打开的原因）。
3. 项目**没有** `public/_redirects`（`dist/` 下也没有），所以 `/start`、featurePages 空壳的跳转都只是页面内的 meta refresh，不是服务器 302。`public/_headers`（会被复制为 `dist/_headers`）只设置缓存与 CORS 头，不参与路由。

换了托管商（或本地用静态文件服务器 / `astro preview`）访问未知路径时，404 的呈现就可能和线上不同，需自行验证回落配置。

---

## 11. 新人最容易踩的点（速查）

1. **`/` 不是文章列表**，是开屏动画。文章列表在 `/home/`。任何「首页」判断都用 `HOME_PATH`（`src/constants/constants.ts:14`）。
2. **`/content/` 不存在**。`src/config.ts:296`（「关于我」）和 `:324`（「关于」）两个导航项的 `url` 都写着 `/content/`，但 `src/pages/` 下没有对应文件，点进去 404。起始页的快捷入口因此会跳过它们（`nav-links.ts:44-63`）。注意这层过滤**只作用于起始页的快捷入口卡片**（`LandingBento.astro:62`、`:73`），导航栏本体不经过 `nav-links.ts` —— `Navbar.astro:32-39` 直接把 `navBarConfig.links` 交给 `DropdownMenu`（`:92-94`）和 `NavMenuPanel`（`:122`），所以导航栏里的坏链接不会被自动清理，得回 `src/config.ts` 手动改。
3. **文章 id 被小写化**（`VRCTool` → `vrctool`），URL 里看不到原始大小写；但 `/albums/<id>/` 保留原始大小写（`/albums/VRChat/`）。
4. **`[...permalink].astro` 是站根下的通吃路由**。一旦启用 permalink，某篇文章的 permalink 若叫 `about`、`home`、`start`，就会和静态页/其他路由撞车，Astro 构建报 `defined in both`。当前 `permalinkConfig.enable` 是 `false` 且没有文章设 `permalink`，所以该路由生成 0 条路径、暂时无冲突。
5. **`alias` 在 `/posts/` 下，`permalink` 在站根下**，别混（`src/utils/url-utils.ts:46-62`）。
6. **所有内部链接带尾斜杠**（`trailingSlash:"always"`）；`url()` 不补斜杠。
7. **分页大小是 8，不是 Astro 默认的 10**（`src/constants/constants.ts:1`）。
8. **`allPostMeta.json` 没有站内消费者**。
9. **`dist/og/` 默认不存在**（不是空目录），因为 `generateOgImages: false`（`src/config.ts:203`）；想本地生成要注意它会联网拉 Google Fonts，且构建很慢。
10. **`Astro.redirect` 在静态构建下是 meta refresh**，不是真跳转，且连目录式 `/404/` 这种目标都要看托管商脸色。
11. **加页面时**：普通页放 `src/pages/<名字>.astro`；动态页必须导出 `getStaticPaths()`；`public/` 里放原样提供的静态资源，别和 `src/pages/` 重名（重名时 `public/` 会顶掉生成页面）。

---

## 12. 待确认（源码与注释/预期不一致处）

- `src/pages/api/allPostMeta.json.ts` 全仓找不到调用方，无法确定它是否仍有用途（外部工具？历史遗留？）。
- 导航项 `/content/`（`src/config.ts:296`、`:324`）指向不存在的页面，是配置错误还是待新建的页面，未知。
- featurePages 空壳页跳转目标 `/404/` 在 `output:"static"` 下不存在实体目录，仅靠托管商回落；换部署环境需验证。
- `src/config.ts:41` 注释建议「关闭页面后记得在 navbarConfig 中移除对应链接」，但当前 `navBarConfig`（`src/config.ts:270-362`）里绝大部分已关闭页面的链接是**注释掉**而非删除，而导航栏又没有可达性过滤（见 §11.2），所以展示状态与注释不完全同步。

---

## 相关文件

- `astro.config.mjs` — 全局路由设定：`site` / `base` / `trailingSlash` / `output` / `redirects`，以及 swup 对起始页的 ignore 规则、sitemap 集成。
- `src/pages/index.astro` — 起始页（站点根 `/`），开屏动画 + 「进入」按钮，唯一不用 MainGridLayout 的页面。
- `src/pages/home/[...page].astro` — 分页文章列表，`Astro.paginate` 的调用点。
- `src/pages/posts/[...slug].astro` — `/posts/<slug>/` 详情路由，保留所有文章的默认路径。
- `src/pages/[...permalink].astro` — 站根下的 permalink 详情路由，处理自定义/全局 permalink。
- `src/pages/404.astro` — 404 页，构建成 `dist/404.html`，按钮指向 `HOME_PATH`。
- `src/pages/robots.txt.ts` — robots.txt 生成，默认全禁再放行根与 `/posts/`。
- `src/pages/rss.astro` / `src/pages/atom.astro` — 订阅说明页，渲染 `FeedInfo`。
- `src/pages/rss.xml.ts` / `src/pages/atom.xml.ts` — 真正的 RSS / Atom feed，含正文图片绝对化处理。
- `src/pages/api/allPostMeta.json.ts` / `src/pages/api/calendar-data.json.ts` — 构建期预渲染的 JSON 接口。
- `src/pages/og/[...slug].png.ts` — 构建期用 satori + sharp 生成每篇文章的分享图。
- `src/pages/about.astro` / `archive.astro` / `albums.astro` / `albums/[id]/index.astro` / `anime.astro` / `diary.astro` / `devices.astro` / `friends.astro` / `projects.astro` / `skills.astro` / `timeline.astro` / `zyj/index.astro` — 各静态功能页。
- `src/constants/constants.ts` — `HOME_PATH`、`PAGE_SIZE` 等路由相关常量。
- `src/constants/link-presets.ts` — 导航栏预设项，`Home` 指向 `HOME_PATH`。
- `src/components/control/Pagination.astro` — 分页组件，从 `page.url` 反推列表首页。
- `src/components/control/BackToHome.astro` — 「返回首页」按钮，目标与显隐均基于 `HOME_PATH`。
- `src/components/features/landing/nav-links.ts` — 起始页快捷入口推导，含 featurePages / 文件存在性过滤。
- `src/components/organisms/navigation/Navbar.astro` — 导航栏，直接用 `navBarConfig.links`，不做可达性过滤。
- `src/utils/permalink-utils.ts` — permalink 生成、文章序号映射、自定义 permalink 判定。
- `src/utils/post-url.ts` — `buildPostPaths()`，`/posts/` 路由的备用构造器（当前页面未直接使用）。
- `src/utils/url-utils.ts` — `url()`、`getPostUrl()`、`removeFileExtension()`、`pathsEqual()` 等 URL 工具。
- `src/utils/content-utils.ts` — `getSortedPosts()`，决定列表与分页顺序。
- `src/utils/album-scanner.ts` — 相册目录扫描，`/albums/<id>/` 的 id 来源（保留大小写）。
- `src/content.config.ts` — 文章集合 schema，`alias` / `permalink` 字段定义，glob loader 配置。
- `src/config.ts` — `featurePages` 开关、`navBarConfig`、`permalinkConfig`、`generateOgImages`、`siteURL`。
- `src/layouts/Layout.astro` — `isHomePage` 判定与 OG 图 URL 拼接。
- `public/` — 第二套 URL 来源（视频、图片库、看板娘资源、手写脚本），按站点根路径原样提供。
- `public/_headers` — 缓存与 CORS 响应头（复制为 `dist/_headers`），不参与路由。
