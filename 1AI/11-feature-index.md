# 11 · 功能模块索引

这一块是「站上看到的每个功能，代码到底在哪」的对照表。拿到一个需求时先来这里定位，再去读具体实现，能省掉大半 `grep` 的时间。

它不解释每个功能的实现细节（那是各模块自己的文档的事），只回答三件事：这个功能的入口文件是谁、关键实现散在哪些目录、它依赖 `src/config.ts` 里的哪个配置块。

读之前有两个前提最好已经知道：组件按 `src/components/` 下的顶层分层摆放（见 `02-directory-map.md`），以及站点根 `/` 是起始页、文章列表在 `/home/`（见下文的 `HOME_PATH` 约定）。如果你只想知道「改 X 去哪改」，直接看第一节的总表；想知道「为什么这么绕」，看第四节「反直觉的地方」。

---

## 一、功能总表

下表按功能列出入口与实现位置。路径全部相对仓库根目录。约定是「入口 = 页面壳或组件出口，关键实现 = 真正的逻辑所在」。配置项一栏只写 `src/config.ts` 里的顶层键名，点开对应说明可回到 `03-config.md`。

| 功能 | 一句话 | 入口文件 | 关键实现 | 依赖配置 |
| --- | --- | --- | --- | --- |
| 全文搜索 | 构建后由 Pagefind 建索引，前端按需加载 | `src/components/organisms/navigation/Search.svelte` | `src/components/organisms/navigation/Navbar.astro`、`pagefind.yml` | 无（构建脚本里） |
| 评论区 | Giscus / Twikoo 二选一，按路径挂载 | `src/components/comment/index.astro` | `src/components/comment/Giscus.astro`、`src/components/comment/Twikoo.astro` | `commentConfig` |
| 起始页 / 开屏动画 | 站点根 `/`，四色套印开屏，点「进入」跳 `/home/` | `src/pages/index.astro` | `src/components/features/landing/`、`src/scripts/landing/index.ts`、`src/styles/landing/landing.css` | `banner.homeText`、`profileConfig`、`announcementConfig` |
| 文章目录 TOC | 桌面侧栏 / 移动端面板 / 浮动三套 | `src/components/features/toc/` | `src/components/widgets/toc/TOC.astro`（废弃包装器）、`src/components/widgets/card-toc/`（侧栏卡片版） | `toc` |
| 归档页 | 按年分组、标签与分类筛选 | `src/pages/archive.astro` | `src/components/features/archive/ArchivePanel.svelte` | `postListLayout.categoryBar` |
| 分类与标签 | 分类导航条 + 侧栏两个小组件 | `src/components/features/posts/CategoryBar.astro` | `src/components/widgets/categories/`、`src/components/widgets/tags/` | `postListLayout`、`sidebarLayoutConfig`、`tagStyle` |
| 侧栏装配 | 把配置变成侧栏组件的那条链 | `src/components/widgets/sidebar/SideBar.astro` | `src/components/layout/SidebarColumn.astro`、`src/components/widgets/common/WidgetLayout.astro` | `sidebarLayoutConfig` |
| 音乐播放器 | 全屏播放器 + FAB 悬浮入口 | `src/components/widgets/music-player/MusicPlayer.svelte` | `src/stores/musicPlayerStore`、`src/components/widgets/music-player/` | `musicPlayerConfig` |
| 侧栏音乐 | 侧边栏内的迷你播放器 | `src/components/widgets/music-sidebar/SidebarMusicClient.svelte` | `src/components/widgets/music-sidebar/` | `musicPlayerConfig`、`sidebarLayoutConfig` |
| 日历 | 按发布日期高亮，点某天看当天文章 | `src/components/widgets/calendar/Calendar.svelte` | `src/components/widgets/calendar/`、`src/pages/api/calendar-data.json.ts` | `sidebarLayoutConfig` |
| 公告 | 侧栏公告条，可关可带链接 | `src/components/widgets/announcement/Announcement.astro` | 同文件内联脚本 | `announcementConfig` |
| 站点统计 | 文章数 / 分类数 / 标签数 / 字数 / 运行天数 | `src/components/widgets/site-stats/SiteStats.astro` | 同文件内联脚本 | `siteStartDate` |
| 个人资料卡 | 头像 + 昵称 + 打字机简介 + 社交图标 | `src/components/widgets/profile/Profile.astro` | 同目录 | `profileConfig` |
| 相册与照片 | 扫描 `public/images/albums/`，Fancybox 灯箱 | `src/pages/albums.astro` | `src/components/features/albums/`、`src/utils/album-scanner.ts`、`src/scripts/handlers/fancybox-handler.ts` | `featurePages.albums` |
| 追番页 | Bangumi / Bilibili / 本地三种数据源 | `src/pages/anime.astro` | `src/components/features/anime/`、`src/utils/anime-data.ts` | `anime`、`bangumi`、`bilibili`、`featurePages.anime` |
| B 站观看进度 | 拉 B 站追番列表，需要账号凭证 | `scripts/update-bilibili.mjs` | `scripts/load-env.js` | `bilibili` + 环境变量 `BILI_SESSDATA` |
| 日记 / 动态 | 碎碎念时间线，带标签筛选 | `src/pages/diary.astro` | `src/components/features/diary/MomentCard.astro`、`src/data/diary.ts` | `featurePages.diary` |
| 友链 | 打乱顺序的友链卡片 + 搜索 | `src/pages/friends.astro` | `src/components/features/friends/FriendCard.astro`、`src/data/friends.ts` | `featurePages.friends` |
| 项目 / 技能 / 时间线 | 三张筛选式数据页 | `src/pages/projects.astro`、`src/pages/skills.astro`、`src/pages/timeline.astro` | `src/components/features/projects/`、`src/components/features/skills/`、`src/components/features/timeline/`、`src/data/` 同名文件 | 对应 `featurePages.*` |
| 设备页 | 按品牌切换的设备卡片 | `src/pages/devices.astro` | `src/components/features/devices/DeviceCard.astro`、`src/data/devices.ts` | `featurePages.devices` |
| 关于页 | 渲染 content collection 里的 `spec/about` | `src/pages/about.astro` | 同文件（`getEntry("spec", "about")`） | 无 |
| 文章加密 | `crypto-js` AES 加密正文，前端解密 | `src/components/features/auth/Encryptor.astro` | `PasswordProtection.astro`、`PasswordModal.svelte`、`src/components/features/auth/utils/decryption.ts` | 文章 frontmatter 的 `password` |
| 相关文章 / 随机文章 | 文章底部的两组推荐 | `src/components/features/posts/RelatedPosts.astro`、`RandomPosts.astro` | `getRelatedPosts`（`src/utils/content-utils.ts`） | `relatedPostsConfig`、`randomPostsConfig` |
| permalink 自定义链接 | 全局或单篇自定义文章 URL | `src/pages/[...permalink].astro` | `src/utils/permalink-utils.ts` | `permalinkConfig` |
| 分享海报 | 生成文章分享长图（Canvas） | `src/components/misc/SharePoster.svelte` | `src/components/misc/poster/`、`src/utils/poster-image.ts` | `shareConfig` |
| 文章分享卡片 | 文章底部「分享到社交平台」卡 | `src/components/features/posts/ShareCard.astro` | 同目录 | `shareConfig` |
| 看板娘 Pio | Live2D 模型，可拖拽、可交互 | `src/components/features/pio/Pio.svelte` | `public/pio/`（`static/pio.js`、`static/l2d.js`、`models/`） | `pioConfig` |
| 樱花特效 | 全屏飘落樱花（Canvas） | `src/scripts/effects/sakura-effect.ts` | `src/utils/sakura-manager.ts` | `sakuraConfig` |
| 壁纸与布局切换 | Banner / 全屏壁纸 / 无壁纸，列表 / 网格 | `src/components/control/LayoutSwitch.svelte` | `src/components/features/settings/WallpaperSwitch.svelte`、`src/components/misc/FullscreenWallpaper.astro` | `wallpaperMode`、`fullscreenWallpaperConfig`、`postListLayout` |
| 深浅色与显示设置 | 明暗主题 + 主题色相调节 | `src/components/control/ThemeSwitch.svelte` | `src/components/features/settings/DisplaySettings.svelte`、`src/utils/setting-utils` | `themeColor`、`DEFAULT_THEME` |
| 阅读进度条与浮动控件 | 顶部加载条 + 右下角一组 FAB | `src/components/control/PageProgressBar/` | `src/components/control/FloatingControls.astro`、`BackToTop.astro`、`BackToHome.astro` | `pageProgressBar`、`toc.floating`、`musicPlayerConfig` |
| 滚动与面板增强 | KaTeX 横向滚动、点外关面板、灯箱 | `src/scripts/handlers/scroll-handler.ts` | `panel-handler.ts`、`fancybox-handler.ts`、`back-to-top-handler.ts` | 无（由 swup 管理器驱动） |
| RSS / Atom | 两种订阅源 + 两个介绍页 | `src/pages/rss.xml.ts`、`src/pages/atom.xml.ts` | `src/pages/rss.astro`、`src/pages/atom.astro`、`src/components/widgets/feed/FeedInfo.astro` | `siteURL`、`profileConfig` |
| Sitemap | 由集成在构建时生成 | 无独立文件 | `@astrojs/sitemap`（`astro.config.mjs:1` 导入，`astro.config.mjs:159` 启用） | 无 |
| robots.txt | 输出抓取规则与 sitemap 地址 | `src/pages/robots.txt.ts` | 同文件 | `siteURL`（经 `import.meta.env.SITE`） |
| 文章元数据 API | 输出全部文章的标题、分类、密码标记；**当前无站内调用方**（全仓 grep `allPostMeta` 只命中它自己和文档） | `src/pages/api/allPostMeta.json.ts` | 同文件 | 无 |
| OG 图生成 | 用 satori + sharp 生成分享图 | `src/pages/og/[...slug].png.ts` | 同文件 | `generateOgImages` |

---

## 二、读之前要知道的五个约定

这些约定几乎每个功能都会踩到，先说清楚，后面逐条不再重复。

### 1. 组件按顶层九层摆放，多数 feature 目录带 barrel

`src/components/` 下的**顶层目录共 9 个**：`atoms`、`comment`、`common`、`control`、`features`、`layout`、`misc`、`organisms`、`widgets`。注意 `molecules` 不是顶层分层 —— 它只存在于 `src/components/widgets/music-player/molecules` 这一处，是音乐播放器内部的子层。

多数 feature 目录有一个 `index.ts` 作为 barrel，例如 `src/components/features/albums/index.ts:1-3` 同时导出 `AlbumCard`、`PhotoCard` 和类型。页面里写 `import { AlbumCard } from "@components/features/albums"` 就是走 barrel。

Svelte 组件是个例外：`src/components/features/toc/index.ts:5` 的注释明确写「Svelte 组件（MobileTOC）请从原始位置导入」，因为 `.ts` barrel 只重导 Astro 组件。所以你会看到导航条直接按原始路径 import `MobileTOC.svelte`。

### 2. 构建期与运行期是两套代码，别混

同一个功能常常拆成「构建期算好数据」+「运行期补动画」两半：

- `.astro` 的 frontmatter 在构建期跑（可以用 `node:fs`、`await getCollection`）。`src/components/features/landing/nav-links.ts` 直接 `import { existsSync } from "node:fs"`，但它只在构建期被 `LandingBento.astro` 引用，不会进客户端 bundle。
- `src/scripts/` 下的东西大多是运行期（浏览器）脚本，由 swup 管理器统一初始化；`src/utils/` 里则混着两用工具。
- 起始页的时钟问候、数字滚动、指针光效全在 `src/scripts/landing/index.ts` 里，构建期只输出静态 HTML。

判断一个模块能不能在客户端用，看它 import 里有没有 `node:fs` / `node:path` / `astro:content`。

### 3. `HOME_PATH`：首页是 `/home/` 不是 `/`

这是全站最重要的约定：

- `src/constants/constants.ts:14` 定义 `export const HOME_PATH = "/home/";`，注释里写死了「凡是判断这是不是首页的地方都必须用这个常量」。
- `src/constants/link-presets.ts:12` 的 `LinkPreset.Home` 指向 `HOME_PATH`，不再是 `/`。
- 起始页占据根路径 `/`（`src/pages/index.astro:13-20` 的注释），文章列表挪到 `src/pages/home/[...page].astro`，翻页是 `/home/2/`。
- 已有实例：`src/scripts/core/swup-hooks.ts:134`、`src/components/features/toc/hooks/useMobileTOC.ts:134-135`、`src/components/features/posts/CategoryBar.astro:150-153`。用 `grep` 搜 `src` 下的 `=== "/"` / `== "/"` 字面比较，零命中 —— 确实没有残留写死 `/` 的首页判断。
- **看板娘 Pio 是唯一例外**：`public/pio/static/pio.js` 不走构建，拿不到 `HOME_PATH`，只能手抄一份常量，见 `public/pio/static/pio.js:169` 的 `var homePath = "/home/";`，注释里还留了「那边改了记得回来同步」的警告。
- 老书签 `/start/` 由 `astro.config.mjs` 的 `redirects` 兜住。

### 4. 特色页面由 `featurePages` 统一开关，关掉也照样构建

`src/config.ts:42-51` 的 `featurePages` 控制番剧、日记、友链、项目、技能、时间线、相册、设备八个页面。**当前取值只有 `friends: true` 和 `albums: true`，其余六个（`anime` / `diary` / `projects` / `skills` / `timeline` / `devices`）全是 `false`。** 也就是说站上真的活的特色页只有友链和相册，其余按代码路径存在但不会对外开放。

关掉的页面**不会变成 404**，而是照常构建成一个只跳 `/404/` 的空壳（`src/components/features/landing/nav-links.ts:29-32` 的注释实测过 `/projects/index.html` 只有 291 字节）。所以判断「某个页面到底开没开」必须看这个开关，不能看文件存不存在。

各页面的检查写法统一为：

```astro
if (!siteConfig.featurePages.albums) {
    return Astro.redirect("/404/");
}
```

见 `src/pages/albums.astro`、`src/pages/anime.astro:18-20`、`src/pages/diary.astro`。`nav-links.ts:52-64` 的 `isReachablePage` 专门做了「开关 + 文件」双重检查，用来挡掉导航里指向空气的链接。

### 5. 侧栏不是写死的，是一条装配链

侧栏放什么、放哪一侧、什么顺序，全由 `src/config.ts:493` 的 `sidebarLayoutConfig` 决定。渲染链是：

```
src/components/widgets/sidebar/SideBar.astro   （外层壳，决定左右两列）
      └─ src/components/layout/SidebarColumn.astro   （type → 组件 的映射表）
            └─ src/components/widgets/common/WidgetLayout.astro  （每个小卡的统一外壳）
```

`SidebarColumn.astro:44-55` 的 `componentMap` 把配置里的 `type` 字符串换成真正的组件；`WidgetLayout.astro:19-45` 给每张卡套上 `card-base` 外壳、标题栏与折叠逻辑（自定义元素 `<widget-layout>` 实现展开/收起）。想加一个侧栏组件，改的是 `componentMap` 和 `sidebarLayoutConfig`，不是 `SideBar.astro` 本体。

---

## 三、功能逐条

### 3.1 内容浏览

#### 全文搜索

基于 Pagefind 的纯静态搜索，构建后才有索引，**开发环境搜不出东西**。

- 索引用 `pagefind.yml` 配置，排除 `span.katex`、`[data-pagefind-ignore]`、`#search-panel` 等。
- 正文容器 `src/components/misc/Markdown.astro:12` 上打了 `data-pagefind-body`，这是被索引的边界。
- 加载器在 `src/components/organisms/navigation/Navbar.astro:284-313`：只有 `import.meta.env.PROD` 时才注入脚本，先 `HEAD` 探一下 `/pagefind/pagefind.js` 存在与否，成功则 `import` 并设置 `excerptLength: 20`，失败则把 `window.pagefind` 替换成一个返回空结果的桩，避免 UI 报错。
- 查询逻辑在 `src/components/organisms/navigation/Search.svelte:128-149`，并监听 `pagefindready` / `pagefindloaderror` 两个自定义事件。
- 开发环境走 `fakeResult`（`Search.svelte:23-40`），提示「搜索在 dev 下不能用」。

#### 评论区

支持 Giscus（GitHub Discussions）和 Twikoo（自建后端）两种，二选一。

- 统一入口 `src/components/comment/index.astro`：根据 `commentConfig.system` 决定 `commentService`，再渲染 `<Twikoo>` 或 `<Giscus>`（`index.astro:22-29` 选服务，`:34-41` 渲染）。路径默认取 `/posts/<slug>`，也可由调用方传 `path`。
- 单篇文章可以用 frontmatter 的 `comment` 字段关闭评论（`index.astro:31` 的 `commentEnabled`）。
- 开关与参数在 `src/config.ts:428` 的 `commentConfig`。当前 `enable: false`（`config.ts:429`），所以整站不显示评论区。
- 两个组件都用 `is:inline` + `define:vars` 注入配置，并靠 IntersectionObserver 在进入视口前 200px 才真正加载第三方脚本（`Giscus.astro:19`、`Twikoo.astro:23`）。
- Twikoo 脚本走本地路径 `/assets/js/twikoo.all.min.js`，不是 CDN。

#### 文章目录 TOC

三套 UI，共用同一批工具：

- **桌面侧栏**：`src/components/features/toc/SidebarTOC.astro`，在 `src/layouts/MainGridLayout.astro:279` 使用，受 `toc.desktopSidebar` 控制。
- **移动端面板**：`src/components/features/toc/MobileTOC.svelte`，在 `Navbar.astro` 使用，受 `toc.mobileTop` 控制；它还能在文章列表页充当「文章目录」（`hooks/useMobileTOC.ts` 里的 `checkIsHomePage`）。
- **浮动按钮**：`src/components/features/toc/FloatingTOC.astro`，在 `src/components/control/FloatingControls.astro:30` 使用，受 `toc.floating` 控制。
- **两个包装器目录**：`src/components/widgets/toc/TOC.astro` 已在 `:5` 标注 `@deprecated`，`:23` 只是转发到 `SidebarTOC`；真正被渲染的是 `MainGridLayout.astro:279` 和 `SidebarColumn.astro:49` 直接引入的 `SidebarTOC`。`src/components/widgets/card-toc/CardTOC.astro` 是侧栏里带外框的卡片版，内部用 `src/utils/tocManager` 管理。
- 公共算法在 `src/components/features/toc/utils/`：`toc-utils.ts`、`toc-calculator.ts`、`japanese-katakana.ts`（把 1、2、3 换成 あ、い、う）。hooks 在 `src/components/features/toc/hooks/`（`useTocNavigation`、`useTocHighlight`、`useTocScroll`、`useFloatingTOC`）。
- 配置在 `src/config.ts:194` 的 `toc`：`enable`、`mobileTop`、`desktopSidebar`、`floating`、`depth`、`useJapaneseBadge`。注意**只有三个值会被带到运行期**：`src/components/misc/ConfigCarrier.astro:17-29` 的 `define:vars` 只注入 `tocEnable` / `tocDepth` / `tocUseJapaneseBadge`，写进 `window.siteConfig.toc` 的也只有这三项。`mobileTop` / `desktopSidebar` / `floating` 是构建期模板条件（Navbar / MainGridLayout / FloatingControls 直接读 `siteConfig`），不会出现在 `window.siteConfig.toc` 里。

#### 归档页

- 页面壳 `src/pages/archive.astro`，在构建期把文章、标签、分类去重后传给 `ArchivePanel`（`archive.astro:2` 导入，`:45-50` 使用）。
- 交互全在 `src/components/features/archive/ArchivePanel.svelte`：从 URL 查询参数读 `tag` / `category` / `uncategorized`（`ArchivePanel.svelte:10-13`），按年份分组展示。
- 页面用 `client:only="svelte"` 挂载（`archive.astro:49`），意味着它在服务端不渲染，SEO 上只留空容器。

#### 分类与标签

- **分类导航条**：`src/components/features/posts/CategoryBar.astro`。它只在自己识别出的「首页 / 首页分页 / 归档页」显示（`CategoryBar.astro:164-169`），高亮当前分类并自动横向滚动到可见位置。首页路径从 `data-home-path` 读取，值来自 `HOME_PATH`（`CategoryBar.astro:150-153`）。
- **侧栏分类组件**：`src/components/widgets/categories/Categories.astro`，数据来自 `getCategoryList()`；数量超过阈值自动折叠，阈值取 `sidebarLayoutConfig` 里 `type: "categories"` 那项的 `responsive.collapseThreshold`（配置在 `config.ts:535`，值为 5）。
- **侧栏标签组件**：`src/components/widgets/tags/Tags.astro`，同构，阈值默认 20（`config.ts:550`）。
- 标签样式新旧二选一由 `src/config.ts:107` 的 `tagStyle.useNewStyle` 控制。

#### 关于页

- `src/pages/about.astro`，内容不是写死在 `.astro` 里，而是 `getEntry("spec", "about")` 从 content collection 取、再 `render` 成组件（`about.astro:11-19`）。找不到条目会直接抛错。
- 用 `PageHeader` + `Markdown` 包裹正文，底部挂 `<Comment path="/about/" />`（`about.astro:33-42`）。
- 导航里「关于」指向它（`src/constants/link-presets.ts:16-19` 的 `LinkPreset.About`，`url: "/about/"`）。

### 3.2 侧栏与装配

装配链见第二节约定 5。下面按组件逐条。

#### 音乐播放器（全屏 / FAB）

- 主组件 `src/components/widgets/music-player/MusicPlayer.svelte`。它在 `src/layouts/Layout.astro:238` 被**无条件**以 `client:idle` 渲染；决定界面上出不出现的是组件内部的 `shouldRenderFloatingUi = showFloatingPlayer && musicPlayerConfig.enable`（`MusicPlayer.svelte:22-23`），模板在 `:201` 的 `{#if shouldRenderFloatingUi}` 里包住整套悬浮 UI。
- 状态在 `src/stores/musicPlayerStore`，组件订阅它；子模块分层为 `atoms/`、`molecules/`、`organisms/`、`hooks/`。
- 悬浮入口有两种模式：`floatingEntryMode: "fab"` 时收进 `FloatingControls` 的 FAB 组（`FabMusicPanel.svelte` + `src/components/control/MusicFabButton.svelte`），`"default"` 时是独立悬浮播放器。
- 来源模式 `musicPlayerConfig.mode`：`"local"` 用本地歌单 `LOCAL_PLAYLIST`，定义在 `src/components/widgets/music-player/constants.ts:7-32`（3 首，注意**不是** `src/constants/constants.ts`）；`"meting"` 走 Meting API。配置在 `src/config.ts:467`。
- 键盘交互：进度条与音量条各自处理 `Enter` / 空格 / 方向键，并在 `<svelte:window on:keydown>` 上挂了音量键（`MusicPlayer.svelte:199`）。

#### 侧栏音乐（迷你播放器）

- 组件 `src/components/widgets/music-sidebar/SidebarMusicClient.svelte`，通过 `client:only="svelte"` 挂载。
- 它和全屏播放器共享同一个 `musicPlayerStore`（`SidebarMusicClient.svelte:5`）；`FabMusicPanel` 复用了这里的 `SidebarCover` / `SidebarControls` 等子组件。
- 状态同步靠 `window` 上的自定义事件 `music-sidebar:state`（`SidebarMusicClient.svelte:24-26` 注册，`:28-35` 注销）。

#### 日历

- 外层 `src/components/widgets/calendar/Calendar.astro`，内层 `client:visible` 挂载的 `Calendar.svelte`；外框带 `hidden md:block`，**移动端不显示**（`Calendar.astro:46`）。
- 子组件在 `components/`：`CalendarGrid`、`CalendarHeader`、`MonthPicker`、`YearPicker`、`PostList`、`SelectionPanel`。算法在 `utils/calendarUtils.ts` 与 `hooks/useCalendar.ts`。
- 数据来源是接口 `src/pages/api/calendar-data.json.ts`，它把所有文章的发布日期整理成 JSON。

#### 公告

- `src/components/widgets/announcement/Announcement.astro`。组件**不检查** `enable`，是否显示完全由 `sidebarLayoutConfig.components` 决定。
- 可选的关闭按钮把状态写进 `localStorage` 的 `announcementClosed`。
- 文案与链接在 `src/config.ts:455` 的 `announcementConfig`。

#### 站点统计

- `src/components/widgets/site-stats/SiteStats.astro`。构建期统计文章数、分类数、标签数、总字数；总字数的 CJK 正则刻意与 `remark-content.mjs` 保持一致。
- 「运行天数」与「距上次更新」是动态值，由文件末尾的内联脚本每小时后重算（`SiteStats.astro:156-199`）。运行天数的起点是 `siteConfig.siteStartDate`（`config.ts:30`）。

#### 个人资料卡

- `src/components/widgets/profile/Profile.astro`，头像、昵称、打字机简介、社交图标，数据全来自 `src/config.ts:364` 的 `profileConfig`。
- 它是唯一一个**不套 `WidgetLayout`** 的侧栏组件，自己写死 `card-base` 外壳（`Profile.astro:11`）。

### 3.3 数据页面

这几页的结构高度同质：页面负责构建期取数与生成筛选标签，`features/` 下的卡片组件负责展示，`src/data/` 下的文件是数据源，筛选交互由 `public/js/filter-tabs-handler.js` 承担（页面里用 `<script is:inline src="/js/filter-tabs-handler.js">` 引入，见 `albums.astro:50`）。

#### 相册与照片

- 页面 `src/pages/albums.astro`。数据由 `src/utils/album-scanner.ts` 扫描 `public/images/albums/` 得到：每个子文件夹是一个相册，必须有 `info.json`，缺失就跳过；支持 `mode: "external"` 的外链模式。
- 详情页在 `src/pages/albums/[id]/index.astro`。
- 卡片组件 `src/components/features/albums/AlbumCard.astro`、`PhotoCard.astro`。照片用 `data-fancybox` 标灯箱组（`PhotoCard.astro:9`）。
- **灯箱是 Fancybox**（`@fancyapps/ui`），不是 PhotoSwipe。初始化在 `src/scripts/handlers/fancybox-handler.ts`，按需 `import("@fancyapps/ui")`，选择器定义在 `src/scripts/core/swup-config.ts:239-249`。仓库里没有 PhotoSwipe 依赖。

#### 追番页

- 页面 `src/pages/anime.astro`，用 `siteConfig.anime.mode` 在三种数据源间切换（`anime.astro:28-30`）：
  - `"local"`：读 `src/data/anime.ts`；
  - `"bangumi"`：读 `src/data/bangumi-data.json`；
  - `"bilibili"`：读 `src/data/bilibili-data.json`。
- 当前 `src/config.ts:90` 的 `anime.mode` 是 `"local"`；`bangumi-data.json` 与 `bilibili-data.json` 目前并不存在于 `src/data/`，由抓取脚本生成。
- 数据读取与归一化在 `src/utils/anime-data.ts`（`loadAnimeData`、`getAnimeList`、`getStatusMap`）。
- 卡片与筛选在 `src/components/features/anime/`：`AnimeCard`、`AnimeFilters`、`AnimeGrid`、`AnimeSortBar`。首屏只渲染 24 条，其余进 `#anime-lazy-store`，靠 IntersectionObserver 分批搬运。
- 数据抓取脚本：`scripts/update-anime.mjs` 是调度器，它读 `src/config.ts` 里的 `anime.mode` 正则匹配出模式，再 `spawn` 对应的 `update-bangumi.mjs` 或 `update-bilibili.mjs`。
- `scripts/update-bangumi.mjs` 从 `https://api.bgm.tv` 拉数据，输出到 `src/data/bangumi-data.json`。

#### B 站观看进度

- `scripts/update-bilibili.mjs`，从 `https://api.bilibili.com/x/space/bangumi/follow/list` 拉取，状态映射 `1=planned / 2=watching / 3=completed`，输出 `src/data/bilibili-data.json`。
- 需要账号凭证 `BILI_SESSDATA`，从环境变量读取（`update-bilibili.mjs:66`），拼进请求头 `cookie`（`update-bilibili.mjs:135`）。本地放 `.env`，CI 放 GitHub Secrets，说明写在 `src/config.ts:82-86`。
- 脚本先调 `loadEnv()` 手动加载 `.env`，因为 Node 原生不读 `.env`。

#### 日记 / 动态

- 页面 `src/pages/diary.astro`，数据来自 `src/data/diary.ts` 的 `getDiaryList()`（按时间倒序，可传 limit）与 `getAllTags()`。
- 卡片 `src/components/features/diary/MomentCard.astro`，带图片、位置、心情、标签。

#### 友链

- 页面 `src/pages/friends.astro`。数据来自 `src/data/friends.ts`，用 `getShuffledFriendsList()` 打乱顺序（`friends.astro:27`）。
- 卡片 `src/components/features/friends/FriendCard.astro`（注意：friends 目录**没有** barrel `index.ts`，页面直接按路径 import）。
- 页面还附了一段说明内容，取自 content collection 里的 `spec/friends`。

#### 项目 / 技能 / 时间线

三张页面同构，都是「FilterTabs + 卡片网格」：

- `src/pages/projects.astro`，数据 `src/data/projects.ts`，卡片 `src/components/features/projects/ProjectCard.astro`；分类的中文名与图标用 `switch` 硬编码。
- `src/pages/skills.astro`，数据 `src/data/skills.ts`，卡片 `src/components/features/skills/SkillCard.astro`。
- `src/pages/timeline.astro`，数据 `src/data/timeline.ts`，类型固定为 `education / work / project / achievement`，卡片 `src/components/features/timeline/TimelineCard.astro`。
- 另有一批同系列但**当前没有被任何页面引用**的组件目录，共六个：`features/featured-projects/`、`features/projects-category/`、`features/stats/`、`features/stats-grid/`、`features/tech-stack/`、`features/section-title/`。其中 `stats` 会被 `src/components/index.ts:10` 的全局 barrel 顺带重导出，但同样没有页面用它。`features/page-header/` 不在此列 —— 它正被 7 个页面使用（`about.astro`、`albums.astro`、`anime.astro`、`friends.astro`、`projects.astro`、`skills.astro`、`timeline.astro`）。

#### 设备页

- 页面 `src/pages/devices.astro`，数据 `src/data/devices.ts`。数据结构是「品牌 → 设备数组」的字典。
- 卡片 `src/components/features/devices/DeviceCard.astro`。品牌过滤是页面内联脚本，不是统一过滤器。

### 3.4 文章增强与 URL

#### 文章加密

用的是 `crypto-js` 的 AES，**加密在构建期、解密在浏览器**：

- `src/components/features/auth/Encryptor.astro`：在构建期把 slot 内容前面拼上 `"MIZUKI-VERIFY:"`，再 `CryptoJS.AES.encrypt(..., String(password))`，然后交给 `PasswordProtection`。
- `src/components/features/auth/PasswordProtection.astro` 渲染一个隐藏的 `#decrypted-content` 容器和密码弹窗，解密成功后把内容填回去。
- 解密工具 `src/components/features/auth/utils/decryption.ts`：动态加载 `/assets/js/crypto-js.min.js`（`decryption.ts:22`），`decryptContent` 在 `:41` 起，`MIZUKI-VERIFY:` 前缀在 `:23` 定义、在 `:57-62` 用来校验密码是否正确；成功后 `executeDecryptedScripts` 重新执行内联脚本并刷新 TOC / Fancybox / Mermaid。
- 密码按页存在 `sessionStorage`，键名 `page-password-<pathname>`。
- 同一套解密逻辑在 `password-utils.ts` 里有一份**重复实现**（它导出的 `decryptContent` 返回 `string | null`，而 `decryption.ts` 的返回 `DecryptResult`），这是历史遗留。
- 加密文章在 RSS / Atom 里被过滤掉了（`rss.xml.ts:28-30`、`atom.xml.ts:27-29`）。

#### 相关文章 / 随机文章

- 配置在 `src/config.ts:676` 的 `relatedPostsConfig`（`enable: true`, `maxCount: 5`）与 `src/config.ts:682` 的 `randomPostsConfig`（同值）。
- 用在文章页：`src/pages/posts/[...slug].astro:103-104` 在构建期 `getRelatedPosts(entry, maxCount)` 算相关文章，`:368-376` 在两组都关掉时不渲染，否则分别渲染 `RelatedPosts` / `RandomPosts`。
- 两个组件在 `src/components/features/posts/RelatedPosts.astro` 与 `RandomPosts.astro`。

#### permalink 自定义链接

- 全局开关 `src/config.ts:393` 的 `permalinkConfig`，当前 `enable: false`（用文件名当 URL）；`format` 支持 `%year%`、`%postname%`、`%post_id%` 等占位符，可带斜杠构嵌套路径。
- 单篇文章还可以在 frontmatter 里写自定义 `permalink`，走同一套逻辑。
- 页面入口 `src/pages/[...permalink].astro`，注释里说明「全局 permalink 启用时所有文章链接在根目录下生成，自定义 permalink 也在根目录下」。
- 工具在 `src/utils/permalink-utils.ts`：`initPostIdMap`、`generatePermalinkSlug`、`hasCustomPermalink`、`getPermalinkPath` 等。改文章 URL 规则时这是唯一入口。

#### 分享海报

- `src/components/misc/SharePoster.svelte`：用 Canvas 手绘分享长图。常量 `SCALE = 2`、`WIDTH = 425 * SCALE`，配色按明暗主题各写一套。
- 绘制原语在 `src/components/misc/poster/PosterCanvas.ts` 与 `theme-utils.ts`，辅助函数在 `src/components/misc/utils/poster-renderer`。
- `src/utils/poster-image.ts` 是**构建期**工具：把封面图（含远程 URL）转成 base64 或构建后的资源路径，好塞进海报。

#### 文章分享卡片

- `src/components/features/posts/ShareCard.astro`，出现在文章底部，内嵌 `SharePoster`。作者默认取 `profileConfig.name`。
- 开关是 `src/config.ts:451` 的 `shareConfig.enable`。

### 3.5 氛围与外观

#### 看板娘 Pio

- Svelte 外壳 `src/components/features/pio/Pio.svelte`，在 `src/layouts/Layout.astro:241` 以 `client:visible` 加载；对应的样式用 `media="print" onload="this.media='all'"` 异步加载。
- 它本身只是壳，真正的实现是 `public/pio/static/pio.js`（基于 Live2D 的 `Paul_Pio`）与 `public/pio/static/l2d.js`。`Pio.svelte:66-83` 在浏览器空闲时（`requestIdleCallback`，超时 5000ms）依次加载这两个脚本，然后 `new Paul_Pio(options)`。
- 模型文件在 `public/pio/models/pio/model.json`（默认路径见 `config.ts:652`）。
- 配置 `src/config.ts:650` 的 `pioConfig`：`enable`、`models`、`position`、`mode`（`"draggable"` 可拖拽）、`hiddenOnMobile`、`dialog`。
- **`public/pio/static/pio.js:169` 里的「返回首页」硬编码了 `/home/`**，这是 `HOME_PATH` 约定唯一无法从 `src/` 自动同步的地方。

#### 樱花特效

- 运行期入口 `src/scripts/effects/sakura-effect.ts` 的 `SakuraEffectHandler`，实际绘制在 `src/utils/sakura-manager.ts`（`Sakura` 类 + `initSakura`）。
- 由 swup 管理器在启动时调用：`src/scripts/swup-manager.ts:101` → `setupSakuraOnDOMReady(widgetConfigs)`，其中 `widgetConfigs` 来自 `src/config.ts:688`。
- 用一个全局标志 `window.sakuraInitialized` 防重复初始化。
- 配置 `src/config.ts:622` 的 `sakuraConfig`。注意注释里写「默认关闭」，但实际 `enable: true`（`config.ts:623`）——以代码为准。

#### 壁纸与布局切换

三样东西常被混为一谈：

- **布局模式**（列表 / 网格）：`src/components/control/LayoutSwitch.svelte`，切换时向 `window` 派发 `layoutChange` 自定义事件，并同时写 `sessionStorage` 与 `localStorage` 的 `postListLayout`。默认值在 `src/config.ts:97` 的 `postListLayout.defaultMode`（当前 `"list"`）。
- **壁纸模式**（Banner / 全屏 / 无）：`src/components/features/settings/WallpaperSwitch.svelte`，常量在 `src/constants/constants.ts:37-39`，默认值在 `src/config.ts:115` 的 `wallpaperMode.defaultMode`（当前 `"banner"`）。
- **全屏壁纸本体**：`src/components/misc/FullscreenWallpaper.astro`，在 `MainGridLayout.astro:110` 使用，配置是 `src/config.ts:245` 的 `fullscreenWallpaperConfig`（zIndex、opacity、blur、carousel）。它支持从 `banner.imageApi` 拉远程图片。

#### 深浅色与显示设置

- **明暗主题**：`src/components/control/ThemeSwitch.svelte`。素材是 `LIGHT_MODE` / `DARK_MODE` 两个常量，默认值 `DEFAULT_THEME = DARK_MODE`（`constants.ts:16-20`），读写封装在 `src/utils/setting-utils`（`getStoredTheme` / `setTheme`）。
- **显示设置面板**（主题色相滑块）：`src/components/features/settings/DisplaySettings.svelte`，读写 `getHue` / `setHue` / `getDefaultHue`。默认色相来自 `siteConfig.themeColor.hue`（`config.ts:36-39`）。
- **根字号缩放陷阱（会影响上面所有尺寸）**：`src/layouts/partials/HeadTags.astro:147-186` 在运行期动态改 `document.documentElement.style.fontSize`，规则是：
  - 宽度 ≥ 2000px：比例 1，不缩放；
  - 1700–2000px：线性从 85% 到 100%；
  - 1281–1700px：恒为 85%（`scale` 下限被钳在 0.85）；
  - ≤ 1280px，或触屏设备、或竖屏：`fontSize` 直接清空，不缩放。

  也就是说，在 1281–1700px 这个常见窗口宽度下，**全站所有以 rem 为单位的字号与间距都会缩到 85%**。调主题色、间距、组件大小时，如果你只在某个特定宽度看到「差一截」，先怀疑这条缩放，而不是去改组件本身。上限由 `src/config.ts` 的 `pageScaling.targetWidth`（2000）与硬编码的 0.85 下限共同决定。

### 3.6 浮动控件与运行期增强

#### 阅读进度条与浮动控件

- **顶部进度条**：`src/components/control/PageProgressBar/PageProgressBar.astro`，在 `Layout.astro:230-234` 使用，配置 `src/config.ts:234` 的 `pageProgressBar`。它挂 swup 的 `visit:start` / `visit:end` 钩子切换状态类。
- **浮动控件组**：`src/components/control/FloatingControls.astro`，右下角一列 FAB，依次是音乐（仅 `floatingEntryMode === "fab"`）、浮动 TOC、返回首页、返回顶部。
- **返回顶部**：`src/components/control/BackToTop.astro`，超过 200px 才显示。
- **返回首页**：`src/components/control/BackToHome.astro`，跳 `HOME_PATH`，显隐判定是「当前路径 !== `/home/` 就显示」；在起始页 `/` 上也会显示（因为 `/` !== `/home/`），点它会整页跳走（Swup 忽略起始页链接，见 `astro.config.mjs` 的 `ignore`）。

#### 滚动与面板增强（handlers/）

这四个处理器都由 `src/scripts/swup-manager.ts` 统一在启动 / 换页时调用：

- `src/scripts/handlers/scroll-handler.ts`：给 KaTeX 公式外包一层可横向滚动的容器，并提供 `throttle` 节流静态方法。
- `src/scripts/handlers/panel-handler.ts`：管理「点面板外部关闭」，硬编码了五个面板 id：`display-setting`、`nav-menu-panel`、`search-panel`、`mobile-toc-panel`、`wallpaper-mode-panel`（`panel-handler.ts:19-40`）。加新面板要来这里登记。
- `src/scripts/handlers/fancybox-handler.ts`：按需加载 Fancybox 并绑定图片选择器，换页时清理。
- `src/scripts/handlers/back-to-top-handler.ts`：返回顶部按钮的显隐与滚动监听。
- **键盘快捷键没有全站统一实现**，只有局部：Fancybox 的键盘映射在 `src/scripts/core/swup-config.ts:221-230`（Esc 关闭、PgUp/PgDn 与方向键翻图），音乐播放器的进度条/音量条各自处理按键，起始页有滚轮 / 按键跳过开屏（见 3.7 节说明，点击不再跳过）。`src/components/widgets/music-player/hooks/useKeyboardShortcuts.ts` 文件名有误导性，实际只提供 `registerInteractionHandler` / `formatTime` / `getAssetPath` 三个工具，不处理快捷键。

#### 开屏动画的跳过逻辑（最近改动，容易踩）

- 跳过只保留**滚轮**与**按键**两条路径：`src/scripts/landing/index.ts:540-541` 只注册 `wheel` 与 `keydown`（Tab 放行给键盘用户看焦点环）。`pointerdown` 那条被有意去掉了。另有一条 `INTRO_MAX_MS` 超时兜底（`index.ts:536`），属于自动结束，不是主动跳过。
- 光删监听不够：`.lp-splash` 的指针事件被改成 `pointer-events: auto`（`src/styles/landing/landing.css:1457`），否则点击会穿透到帘子底下**早已渲染好**的「进入」按钮和卡片上，当场跳走。`landing.css:1466-1468` 挂了两条 0.01s 的空动画，其中 `lp-splash-guard`（`:1471-1473`）在片尾起点把 `pointer-events` 拨回 `none`，交还指针。去掉点击跳过与挡住指针是**一体**的改动。

### 3.7 输出与元数据

#### RSS / Atom

- 生成端点：`src/pages/rss.xml.ts`（`@astrojs/rss`）与 `src/pages/atom.xml.ts`（手写 XML 字符串）。两者都先 `getSortedPosts()`，过滤掉加密文章（`rss.xml.ts:28-30` 过滤 `!post.data.encrypted`；`atom.xml.ts:27-29` 额外过滤草稿 `post.data.draft !== true`）。
- 正文字段会被 MarkdownIt 渲染成 HTML，图片相对路径经 `node-html-parser` 改写为构建后的绝对地址，最后用 `sanitize-html` 清洗。
- 两个介绍页 `src/pages/rss.astro` / `atom.astro`，都只渲染 `src/components/widgets/feed/FeedInfo.astro`。
- `Layout.astro` 在 `<head>` 里声明了 `application/rss+xml` 的 alternation 链接。

#### Sitemap

由 `@astrojs/sitemap` 集成在构建时生成 —— `astro.config.mjs:1` 导入，`astro.config.mjs:159` 启用，产物是 `sitemap-index.xml`。没有手写代码。

#### robots.txt

`src/pages/robots.txt.ts` 输出纯文本。当前策略是**先全禁再放行**：`Disallow: /`，只 `Allow: /$` 和 `Allow: /posts/`（`robots.txt.ts:4-7`）。这里要注意：按本站约定 `/` 是**起始页**而不是首页，所以 `/$` 放行的是站点根（起始页），真正的文章列表 `/home/` 反而不在放行名单里。Sitemap 地址由 `import.meta.env.SITE` 拼出（`robots.txt.ts:9`）。

#### 文章元数据 API

`src/pages/api/allPostMeta.json.ts` 把所有文章的 `id`、`title`、`description`、`published` 时间戳、`category` 和密码标记 `password`（布尔）整理成 JSON，按发布时间降序。同为 `src/pages/api/` 下的另一个端点是 `calendar-data.json.ts`，供日历组件用。

#### OG 图生成

`src/pages/og/[...slug].png.ts`，用 `satori` 把 JSX 结构渲染成 SVG，再用 `sharp` 转 PNG。整段受 `src/config.ts:203` 的 `generateOgImages` 控制（当前 `false`），关闭时 `getStaticPaths` 返回空数组、不做任何渲染（`[...slug].png.ts:24-27`）。它还会在运行时从 Google Fonts 拉 Noto Sans SC 字体并缓存 —— 本地调试时作者建议别开，渲染很慢。

---

## 四、反直觉的地方（新人最容易踩）

1. **「首页」不是 `/`**。全站判断首页用 `HOME_PATH`（`/home/`）。写死 `"/"` 会把起始页当成文章列表。已有实现都改完了，但 `public/pio/static/pio.js:169` 是手抄的例外。
2. **起始页的内容早就渲染好了，只是被帘子盖住**。开屏遮罩 `.lp-splash` 现在是 `pointer-events: auto`（`landing.css:1457`），并在片尾起点用一条 0.01s 的 `lp-splash-guard` 动画把指针交还（`landing.css:1471-1473`）。去掉点击跳过和挡住指针是**一体**的改动：只删监听不挡指针，盲点会穿透到已渲染的「进入」按钮或卡片，当场跳走。
3. **开发环境搜索永远搜不出东西**。Pagefind 索引是构建后才有的，dev 下 `Search.svelte:23-40` 走 `fakeResult`。加载器的开关是 `import.meta.env.PROD`（`Navbar.astro:283`）。
4. **`featurePages` 关掉的页面仍然构建**，产出的是只跳 `/404/` 的空壳。当前只有 `friends`、`albums` 开着，别以为项目/技能/时间线/番剧/日记/设备是活的。`nav-links.ts:52-64` 的 `isReachablePage` 就是为此写的双重检查。
5. **音乐播放器有两套 UI、一个 store**。全屏播放器（`widgets/music-player`）和侧栏迷你播放器（`widgets/music-sidebar`）共享 `musicPlayerStore`，靠 `music-sidebar:state` 事件同步。改状态逻辑要改 store，不是改某一套 UI。
6. **音乐播放器在 `Layout.astro:238` 是无条件渲染的**。真正决定界面上出不出现的是组件内部的 `shouldRenderFloatingUi = showFloatingPlayer && musicPlayerConfig.enable`（`MusicPlayer.svelte:22-23`），不是 Layout 里的 `enable` 判断。
7. **侧栏组件由配置驱动，目录里有没有文件不代表会不会显示**。`sidebarLayoutConfig.properties` 定位置与动画，`components.left/right/drawer` 定实际摆放；`SideBar` → `SidebarColumn` → `WidgetLayout` 是一条链。
8. **`widget-manager.ts` 里那份组件映射表是死代码**。`src/utils/widget-manager.ts:11-23` 的 `WIDGET_COMPONENT_MAP` 看着和 `SidebarColumn.astro:44-55` 的 `componentMap` 很像，但两者内容并不一致（前者有 `pio` / `custom` 无 `music-sidebar`，后者反过来），且 `WIDGET_COMPONENT_MAP` 唯一的消费者 `getComponentPath`（`widget-manager.ts:184`）在整个 `src` 下**没有任何调用点**。真正驱动渲染的只有 `SidebarColumn.astro` 的 `componentMap`，改组件路径只需改这一处。
9. **`ArchivePanel` 是 `client:only`**，服务端不渲染；同理 `MobileTOC`、`Search`、各开关都是 `client:only="svelte"`。SEO 相关的正文不在这里。
10. **`widgets/toc/TOC.astro` 是废弃包装器**，真正的实现已经搬到 `features/toc/`。实际被引用的是 `MainGridLayout.astro:279` 与 `SidebarColumn.astro:49` 直接引入的 `SidebarTOC`，不要再顺着 `widgets/toc` 去改实现。
11. **加密文章的正文在构建期就被 AES 加密**，浏览器里解密；`MIZUKI-VERIFY:` 前缀是密码校验的锚点。解密后要手动重跑 TOC / Fancybox / Mermaid，因为它们在构建期已经初始化过一次。
12. **`useKeyboardShortcuts.ts` 名不副实**：它不处理键盘快捷键，只提供媒体交互辅助函数（`registerInteractionHandler` 等）。
13. **根字号缩放会连带影响所有 rem 尺寸**。`src/layouts/partials/HeadTags.astro:147-186` 在 1281–1700px 把 `fontSize` 钳在 85%，1700–2000px 线性放大到 100%。在常见窗口宽度下看到的「尺寸对不上」，先查这里。

---

## 五、未找到实现 / 存疑

- **全站级键盘快捷键**：未找到实现。只有 Fancybox、音乐播放器、起始页三处局部快捷键。
- **PhotoSwipe 灯箱**：未找到实现。相册/文章图片统一用 Fancybox（`@fancyapps/ui`）。
- **`src/pages/zyj/index.astro`**：存在（标题「你的IP属地」）但 `src` 下没有任何引用，导航与文档也未见收录，用途不明。要清理前建议先 `grep zyj` 全文确认无引用（本仓库 `src` 下确无）再决定去留。
- **`features/` 下 `featured-projects`、`projects-category`、`stats`、`stats-grid`、`tech-stack`、`section-title`** 六个目录目前没有页面引用，疑似历史遗留。
- **注释与代码不一致**：`sakuraConfig.enable` 的注释写「默认关闭」但代码是 `true`；这类情况一律以代码为准。

---

## 相关文件

- `src/config.ts` —— 全站配置中枢，上面每个功能依赖的键都在这里（`commentConfig`、`toc`、`musicPlayerConfig`、`pioConfig`、`sakuraConfig`、`featurePages`、`sidebarLayoutConfig`、`relatedPostsConfig`、`randomPostsConfig`、`permalinkConfig` 等）。
- `src/constants/constants.ts` —— `HOME_PATH`、`PAGE_SIZE`、主题与壁纸模式常量。
- `src/constants/link-presets.ts` —— 导航预设，`Home` 指向 `HOME_PATH`。
- `src/pages/index.astro` —— 起始页，开屏 + 「进入」按钮。
- `src/components/features/landing/` —— 起始页三区域组件与 `nav-links.ts` 快捷入口推导。
- `src/scripts/landing/index.ts` —— 起始页全部运行期逻辑（开屏跳过、时钟、打字机、指针光效、数字滚动）。
- `src/styles/landing/landing.css` —— 起始页与开屏动画的全部样式（含指针遮挡与 guard 动画）。
- `src/pages/home/[...page].astro` —— 文章列表（原首页），分页 `/home/2/`。
- `src/pages/about.astro` —— 关于页，内容取自 content collection 的 `spec/about`。
- `src/components/comment/` —— 评论区（`index.astro` 入口 + Giscus / Twikoo）。
- `src/components/features/toc/` —— TOC 三套 UI、hooks 与算法。
- `src/components/widgets/toc/`、`src/components/widgets/card-toc/` —— TOC 包装器（废弃）与侧栏卡片版。
- `src/components/features/archive/ArchivePanel.svelte` —— 归档页交互。
- `src/components/features/posts/CategoryBar.astro` —— 分类导航条。
- `src/components/widgets/categories/`、`src/components/widgets/tags/` —— 侧栏分类与标签。
- `src/components/widgets/sidebar/SideBar.astro`、`src/components/layout/SidebarColumn.astro`、`src/components/widgets/common/WidgetLayout.astro` —— 侧栏装配链的三个环节。
- `src/components/widgets/music-player/`、`src/components/widgets/music-sidebar/` —— 两套音乐播放器。
- `src/stores/musicPlayerStore` —— 音乐播放器的共享状态。
- `src/components/widgets/calendar/` —— 日历组件与算法。
- `src/components/widgets/announcement/`、`site-stats/`、`profile/` —— 三个侧栏信息组件。
- `src/components/features/albums/`、`src/utils/album-scanner.ts`、`src/pages/albums.astro` —— 相册扫描与展示。
- `src/components/features/anime/`、`src/utils/anime-data.ts`、`src/pages/anime.astro` —— 追番页。
- `scripts/update-anime.mjs`、`scripts/update-bangumi.mjs`、`scripts/update-bilibili.mjs` —— 追番数据抓取。
- `src/data/` —— 日记、友链、项目、技能、时间线、设备、番剧的结构化数据源。
- `src/components/features/auth/` —— 文章加密（`Encryptor`、`PasswordProtection`、`PasswordModal`、`utils/decryption.ts`）。
- `src/components/features/posts/RelatedPosts.astro`、`RandomPosts.astro` —— 相关文章与随机文章。
- `src/pages/[...permalink].astro`、`src/utils/permalink-utils.ts` —— permalink 自定义链接。
- `src/components/misc/SharePoster.svelte`、`src/components/misc/poster/`、`src/utils/poster-image.ts` —— 分享海报。
- `src/components/features/posts/ShareCard.astro` —— 文章分享卡片。
- `src/components/features/pio/`、`public/pio/` —— 看板娘外壳与 Live2D 资源。
- `src/scripts/effects/sakura-effect.ts`、`src/utils/sakura-manager.ts` —— 樱花特效。
- `src/components/control/LayoutSwitch.svelte`、`src/components/features/settings/WallpaperSwitch.svelte`、`src/components/misc/FullscreenWallpaper.astro` —— 布局与壁纸切换。
- `src/components/control/ThemeSwitch.svelte`、`src/components/features/settings/DisplaySettings.svelte` —— 明暗与色相设置。
- `src/layouts/partials/HeadTags.astro` —— `<head>` 标签与根字号自适应缩放。
- `src/components/control/PageProgressBar/`、`FloatingControls.astro`、`BackToTop.astro`、`BackToHome.astro` —— 进度条与浮动控件。
- `src/scripts/handlers/` —— 滚动、面板、灯箱、返回顶部四个处理器。
- `src/components/organisms/navigation/Search.svelte`、`Navbar.astro`、`pagefind.yml` —— 全文搜索。
- `src/pages/rss.xml.ts`、`atom.xml.ts`、`rss.astro`、`atom.astro`、`src/components/widgets/feed/FeedInfo.astro` —— 订阅输出。
- `src/pages/robots.txt.ts`、`src/pages/og/[...slug].png.ts`、`src/pages/api/allPostMeta.json.ts`、`src/pages/api/calendar-data.json.ts` —— robots、OG 图与两个数据端点。
- `src/layouts/Layout.astro`、`src/layouts/MainGridLayout.astro` —— 把上述多数组件装配起来的地方。
