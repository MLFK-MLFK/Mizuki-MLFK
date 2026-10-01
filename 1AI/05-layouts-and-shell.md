# 05 · 布局与页面外壳

这一块讲「每张页面外面包的同一层壳」：`<html>` 头、主题首帧脚本、导航条、横幅、左右侧栏、页脚、浮动按钮，以及它们如何被 Swup 在换页时保留或替换。你在两种情况下需要翻它：一是要改「全站都会看到」的东西（导航项、横幅高度、断点行为、标题规则），二是新写一个页面时决定该套哪一层 layout。最大的坑不在某个组件内部，而在「构建期算出来的类名」和「运行期 JS 改的类名」两套逻辑并存——改一处忘另一处，就会出现首次加载正常、换页后错乱的现象。另外，站点根 `/` 已经被起始页占用，真正的「首页」是 `/home/`，这一点贯穿全篇。

## 一句话总览

两层 layout 是嵌套关系，不是二选一：

```
Layout.astro          ← 所有页面（含起始页）都走
  └ MainGridLayout    ← 内容页再包一层：导航条 + 横幅 + 侧栏 + 主栏 + 页脚
      └ <slot />      ← 各页面自己的正文
```

`src/pages/index.astro:47`（起始页）只套 `Layout`；其余 16 个页面文件（`src/pages/home/[...page].astro:36`、`src/pages/posts/[...slug].astro:189`、`src/pages/about.astro:21`、`src/pages/404.astro:11` 等）都套 `MainGridLayout`。

## Layout.astro：最外层

`src/layouts/Layout.astro` 是所有 HTML 文档的骨架，负责 head、全局脚本挂载和几个常驻组件。

| 位置 | 职责 |
| --- | --- |
| `src/layouts/Layout.astro:161-166` | `<html>`：`bg-[var(--page-bg)] text-[14px] md:text-[16px]`，挂 `data-overlayscrollbars-initialize` |
| `src/layouts/Layout.astro:170-173` | `<AnalyticsScripts>`：第三方分析脚本，放最前 |
| `src/layouts/Layout.astro:175-182` | `<HeadTags>`：SEO meta、OG、Twitter、favicon、主题防闪烁内联脚本 |
| `src/layouts/Layout.astro:185` | `<slot name="head" />`：页面自定义 head 内容的出口 |
| `src/layouts/Layout.astro:187-193` | 全局 CSS 变量：`configHue`、`page-width: 90rem`（来自 `PAGE_WIDTH`，`src/constants/constants.ts:31`） |
| `src/layouts/Layout.astro:195-202` | Pio 看板娘样式：`media="print" onload="this.media='all'"` 非阻塞加载 |
| `src/layouts/Layout.astro:204-209` | RSS alternate link，指向 `${Astro.site}rss.xml` |
| `src/layouts/Layout.astro:211-218` | `<body>`：`min-h-screen`；`lg:is-home`、`enable-banner` 两个类由 `isHomePage`、`enableBanner` 注入；字体族内联 |
| `src/layouts/Layout.astro:219-225` | `<noscript>` 里的 GTM iframe，给禁用 JS 的访客兜底 |
| `src/layouts/Layout.astro:227` | `top-gradient-highlight` 顶部高光，只在导航透明模式为 `full` / `semifull` 时渲染 |
| `src/layouts/Layout.astro:229` | `<ConfigCarrier />`：把 TOC 配置挂到 `window.siteConfig`（`src/components/misc/ConfigCarrier.astro:15-33`） |
| `src/layouts/Layout.astro:230-234` | `PageProgressBar`：挂在 swup 的 `visit:start` / `visit:end` 上（`src/components/control/PageProgressBar/PageProgressBar.astro:29-49`） |
| `src/layouts/Layout.astro:235` | `<slot />`：页面正文 |
| `src/layouts/Layout.astro:238` | `MusicPlayer client:idle`：常驻，UI 由 `showFloatingPlayer` 控制 |
| `src/layouts/Layout.astro:241` | `Pio client:visible`：进视口才加载 |
| `src/layouts/Layout.astro:244` | `#page-height-extend`：换页时撑高 300vh，防滚动动画跳跃 |
| `src/layouts/Layout.astro:248-317` | 全局样式：banner 高度补偿、水波纹动画、`navbar-hidden` 工具类 |
| `src/layouts/Layout.astro:319-336` | 三个 `<script>`：swup 管理器、代码块折叠、主题优化器 |

### title 拼接规则

`src/layouts/Layout.astro:94-104` 分三条分支：

| 条件 | 输出 |
| --- | --- |
| 传了 prop `title` | `` `${title} - ${siteConfig.title}` ``（`:96`） |
| 没传 `title`，且 `siteConfig.subtitle` 存在且不等于 `siteConfig.title` | `` `${siteConfig.title} - ${siteConfig.subtitle}` ``（`:98`） |
| 以上都不满足 | 只输出 `siteConfig.title`（`:103`） |

注意第二条用的是 `siteConfig.title` 与 `siteConfig.subtitle`，不是 prop `title`——能走到这条分支就说明 prop `title` 本来就是空的。当前配置里 `title` 和 `subtitle` 都是「mkの后花园」，所以第三条分支才存在：首页（不传 `title`）走的是只输出 `siteConfig.title` 这一条（`src/pages/index.astro:40-47`）。

### isHomePage 比的是 /home/ 不是 /

`src/layouts/Layout.astro:42` 与 `src/layouts/MainGridLayout.astro:54` 都是：

```js
const isHomePage = pathsEqual(Astro.url.pathname, HOME_PATH);
```

`HOME_PATH` = `"/home/"`（`src/constants/constants.ts:14`）。`pathsEqual` 去掉首尾斜杠并转小写（`src/utils/url-utils.ts:16-20`），所以 `/home`、`/home/`、`/HOME/` 都算首页。站点根 `/` 现在是起始页，`lg:is-home` 不会加在它身上。

凡是判断「是不是首页」的地方都得用 `HOME_PATH`，写死的 `"/"` 现在指起始页，语义完全变了。涉及：Layout（body 的 `lg:is-home`）、MainGridLayout（横幅高度与文字覆盖）、Navbar（logo 与 `data-is-home`）、swup 钩子、返回首页按钮。`src/constants/constants.ts:3-13` 的注释专门警告了这一点。

### 脚本注入顺序与 SPA 生命周期

Astro 事件与 swup 钩子的对应关系由 `@swup/astro` 建立（`node_modules/.pnpm/@swup+astro@1.8.0/node_modules/@swup/astro/dist/script.js:132-134`）：

| Astro 事件 | 对应 swup 钩子 | 触发时机 |
| --- | --- | --- |
| `astro:before-swap` | `hooks.before('content:replace')` | 旧 DOM 尚未被替换 |
| `astro:after-swap` | `hooks.on('content:replace')` | DOM 刚被替换 |
| `astro:page-load` | `hooks.on('page:view')` | 页面视图就绪、滚动归位之后 |

分工因此很清晰：**`astro:before-swap` 回收上一页的副作用，`astro:page-load` 初始化新页面的行为**，`astro:after-swap` 用在「DOM 已换、但页面还没 view」的窗口。

`Layout.astro` 自己**不注册**这三个事件，它只在 `:319-326` 调用 `initSwupManager()` 提供入口，事件由页面／组件级脚本消费。

### 外壳里的零碎细节

- **OverlayScrollbars 属性没有人负责初始化**。`data-overlayscrollbars-initialize` 同时挂在 `<html>`（`src/layouts/Layout.astro:165`）与 `<body>`（`:217`）上，但全仓（排除 `node_modules`）搜不到任何 `overlayscrollbars` 的 import；它只出现在 `astro.config.mjs:230` 的 `optimizeDeps.include` 里。当前滚动仍是浏览器原生滚动，返回顶部阈值直接读 `window.pageYOffset`（`src/components/control/BackToTop.astro:34-38`）。这条属性目前是遗留物，别指望它接管滚动条。
- **dev 与 prod 的外壳行为不同**。swup 的 `updateHead` 在生产为 `true`、开发为 `false`（`astro.config.mjs:68`），并且 `HeadTags.astro:190-202` 在 dev 下把 `window.swup.options.updateHead` 强制关掉，避免换页时反复替换 `<head>` 样式导致偶发丢样式。结果是本地跑和线上跑的表现并不一致，本地验证通过不等于线上一致。

## MainGridLayout.astro：内容页栅格

`src/layouts/MainGridLayout.astro:92` 用 `<Layout>` 把整块内容包起来，`:294` 收尾。服务端先算四样东西，再拼类名：

| 计算 | 位置 | 结果 |
| --- | --- | --- |
| banner 图（含图片 API 拉取） | `:39` → `getBannerImages` | `{ desktop, mobile }`（`src/utils/grid-layout-utils.ts:200-240`） |
| 主内容区 top | `:59-62` → `getMainPanelTop` | banner 模式 `${BANNER_HEIGHT}vh`（即 `35vh`），否则 `5.5rem`（`src/utils/grid-layout-utils.ts:261-266`） |
| 栅格类名 | `:65-77` → `calculateGridLayout` | `gridCols` / 侧栏类 / 主栏类 / 三段响应式布尔 |
| 半透明 | `:83-86` | 只有 `fullscreen` 模式为 true（`src/utils/grid-layout-utils.ts:245-249`） |

### isHomePage 在这里控制什么

- 横幅高度与位移：`lg:is-home` 那一整套 CSS（`src/layouts/Layout.astro:259-283`）让首页横幅更高、主栅格下移 `banner-height-extend`。起始页虽然也走 `Layout`，但它没有 Banner，这套补偿对它无意义（`src/layouts/Layout.astro:40-41` 注释）。
- 文字覆盖层：`showTextOverlay={isHomePage && banner.homeText.enable}`（`src/layouts/MainGridLayout.astro:134-135`）。
- 移动端横幅显隐：非首页加 `mobile-hide-banner`（`:56`）。

### 结构要点（都是运行期会动的 id/类）

- `#top-row` 包 `#navbar-wrapper`（sticky），外层 `pointer-events-none`、内层 `pointer-events-auto` 的配对是为了不挡住点击（`src/layouts/MainGridLayout.astro:117-128`）。
- `#main-grid` 是 swup 动画作用域（`src/scripts/core/swup-config.ts:19`），带 `data-layout-mode`，`GridScripts` 会改它。
- `<main id="swup-container">` 里套 `#content-wrapper`（`src/layouts/MainGridLayout.astro:213-230`）；`swup-config.ts:16` 把 `#content-wrapper` 当作内容容器选择器。
- 侧栏：左 `SideBar`、右 `RightSideBar`，都包进 `.contents` 以免破坏栅格（`src/layouts/MainGridLayout.astro:190-211`）。
- `FloatingControls` 挂在栅格容器内、`pointer-events-auto` 层里（`:239`）。
- 桌面 TOC 是栅格外的一块：`#toc-wrapper` 定位在右侧、`2xl:block`，banner 模式加 `toc-hide`（`:254-286`）。不启用时也要保留一个空的 `#toc-container`，否则 swup 找不到目标（`:288-293`）。
- `FullscreenWallpaper` 与 `IconifyLoader` 都始终渲染（`:110`、`:113`），但两者性质完全不同：**只有 FullscreenWallpaper 是可切换显隐的可视层**（`GridScripts` 里改 `display`，选择器 `[data-fullscreen-wallpaper]`）；**IconifyLoader 没有任何可切换的元素**，它干的是往 `<head>` 注入 iconify-icon 脚本（`src/components/misc/IconifyLoader.astro:106-108`）并按需预加载图标（`:204`）。别去给 IconifyLoader 找一个并不存在的显隐逻辑。

## layouts/partials 三件套

### HeadTags.astro

- SEO/OG/Twitter/favicon（`src/layouts/partials/HeadTags.astro:49-93`）。favicon 为空时回退 `defaultFavicons`（`:45-46`）。
- **主题防闪烁内联脚本**（`:101-133`）：`is:inline` 保证进首帧，从 localStorage 读 `theme` 决定 `<html>` 的 `dark` 类，并把 Expressive Code 的 `data-theme` 设成 `github-dark` / `github-light`。默认主题真源是 `DEFAULT_THEME`（`src/constants/constants.ts:20`，当前为 `dark`）；`swup-config.ts:98-101` 注释强调必须共用同一个默认值，否则首屏暗色、一导航被改回浅色。
- 同步设置 `--hue`（`:136-137`）、`--banner-height-extend`（`:140-145`，向下取 4 的倍数避免文字模糊）。
- **根字号自动缩放**（`:147-186`），见下。
- Dev 模式关闭 swup 的 `updateHead`（`:190-202`）。

### 根字号缩放：只对非触摸、横屏生效

逻辑在 `src/layouts/partials/HeadTags.astro:148-174`：

```js
const isTabletLike = isTouch || window.innerWidth <= 1280;
if (isTabletLike || isPortrait) {
	document.documentElement.style.fontSize = "";
	return;
}
const targetWidth = pageScaling.targetWidth || 2000;
const currentWidth = document.documentElement.clientWidth;
let scale = currentWidth / targetWidth;
if (scale > 1) scale = 1;
if (scale < 0.85) scale = 0.85;
document.documentElement.style.fontSize = `${scale * 100}%`;
```

关键判定是 `isTabletLike || isPortrait`（`:159-163`）：

- `isTouch` = `pointer:coarse` 或 `hover:none` 或 `'ontouchstart' in window`；
- `isPortrait` = `orientation: portrait`。

**所以触摸设备在任意宽度、以及竖屏状态，都会被清空内联 `font-size`，不参与缩放**。宽度用的是 `document.documentElement.clientWidth`（`:165`），不是 `innerWidth`。当前配置 `targetWidth: 2000`、`enable: true`（`src/config.ts:66-69`），对「非触摸 + 横屏」的窗口代入后：

| 视口宽度 | 根字号 |
| --- | --- |
| ≤ 1280px | 走 `isTabletLike`，清空内联值，回落到 `<html>` 的 `text-[14px] md:text-[16px]` |
| 1281–1700px | **固定 85%**（`width/2000` 全部小于 0.85，被下限截住） |
| 1700–2000px | `width/2000`，在 85%–100% 之间线性 |
| ≥ 2000px | 100% |

**为什么必须写清楚**：项目里所有 `rem` 都会跟着缩。凡是把 Tailwind 的 `clamp()` 上限、`max-w`、`min-h` 用 rem 写死的地方，在 1281–1700px 区间实际渲染只有标称值的 85%。新加用 rem 表达的尺寸上限时，要么按 85% 的心理预期核对，要么改用别的单位。反之 `vw`/`vh`/`px` 不受影响——起始页竖向尺寸全用 `min(Xvw, Yvh)`，其源注释给出的理由是「窗口变矮时自动等比收缩，而不是溢出」（`src/pages/index.astro:24-27`）；顺带不受根字号缩放影响是副作用，不是那套写法的主因。

### GridScripts.astro：body 类名的状态机

`src/layouts/partials/GridScripts.astro:45-51` 的 `readStoredWallpaperMode()` 负责读档并做回落；`:54-140` 在首次渲染前就把壁纸模式落到 body 上，避免闪烁；`:143-249` 的 `applyWallpaperMode()` 在运行期切换模式。它管理这些类和若干内联样式：

| 模式 | body 上的类 | banner | 全屏壁纸 | TOC |
| --- | --- | --- | --- | --- |
| `banner` | `enable-banner`（移除 `wallpaper-transparent`、`no-banner-mode`） | 显示 | 隐藏 | 滚到 banner 顶部内才加 `toc-hide` |
| `fullscreen` | `wallpaper-transparent` + `no-banner-mode` | 隐藏 | 显示 | 始终显示 |
| `banner` + 首页滚动折叠 | 上面 banner 那套**再加** `banner-scroll-collapsed` | 淡出（`opacity:0`） | 显示 | 同 banner |

模式只有 `banner` / `fullscreen` 两种（曾经的 `"none"`「无壁纸」已删除）。模式来源是 `localStorage.wallpaperMode`，**认不出的值一律回落到 `siteConfig.wallpaperMode.defaultMode`** —— 老访客浏览器里残留的 `"none"` 就是走这条路，不会漏到 switch 里变成哪个分支都不匹配。切换入口是 Navbar 里的 `WallpaperSwitch`（`src/components/organisms/navigation/Navbar.astro:115`），它派发 `wallpaper-mode-change` 自定义事件（`src/utils/setting-utils.ts:165-171`），`GridScripts.astro:328-333` 监听并立即重应用。`fullscreen` 下 navbar 被强制设成 `data-dynamic-transparent="semi"`（`:234-238`），`banner` 下恢复成 config 里的 `banner.navbar.transparentMode`（`:191-205`）。

### 首页滚动联动（`banner-scroll-collapsed`）

在 `/home/` 且当前模式为 `banner` 时，向下滚过 `wallpaperMode.scrollAutoSwitch.thresholdVh`（默认视口高度的 40%）就切到「类全屏」态，滚回顶部自动还原（`GridScripts.astro:251-333`，CSS 在 `src/styles/banner.css:46-58`）。

三点必须知道：

- **它只切一个 body 类，不调 `applyWallpaperMode()` 换模式。** 原因是重排：`#banner-wrapper` 是 `absolute`、`[data-fullscreen-wallpaper]` 是 `fixed`，两者都不占文档流，所以只改可见性不引起任何重排。而真去切模式会把主内容区从 `top:35vh` 挪到 `5.5rem`（`banner.css` 里 `body.no-banner-mode` 那条 `!important`），用户滚到一半时切过去，眼前内容会整体跳一屏。
- **迟滞。** 进入阈值 = `thresholdVh`，退出阈值 = `max(24px, 4vh)`，中间留大段缓冲。两个阈值贴在一起的话，滚动惯性会在边界反复触发，横幅一闪一闪。
- **只在用户选的是 banner 时生效。** 手动选了全屏的人本来就在全屏态，滚动不该再抢控制权；手动切模式时 `wallpaper-mode-change` 监听器会先把折叠态清掉再重算（`:328-333`）。

注意这里有**两套同类逻辑**：服务端 `calculateGridLayout` 产出初始类名，运行期 GridScripts 再改 `data-layout-mode` 和 `right-sidebar-container` 的类，并在 `content:replace`（`:359-421`）和 `swup:page:view`（`:442-470`）里重新应用。新增布局状态时两边都要改。

`no-banner-mode` 是加在 body 上的运行期类（全屏模式），别和 `banner-scroll-collapsed` 混为一谈：后者是首页滚动联动的折叠态，但它**特意也顺带挂上了 `wallpaper-transparent`**——卡片半透明、导航条转毛玻璃靠的就是那个现成的类，直接复用，不必新写样式。历史上还有个 `no-banner-layout` 服务端类，随 `"none"` 模式一起删掉了。

### AnalyticsScripts.astro

GTM 与 Clarity 都延迟到「用户首次交互」或 10 秒超时才加载（`src/layouts/partials/AnalyticsScripts.astro:81-114`）。`window.analyticsLoaded` 做幂等锁。

## 外壳零件

### Banner.astro（`src/components/layout/Banner.astro`）

- 多图且 `carousel.enable` 走 Ken Burns + crossfade 轮播（`:51-65` 计算间隔／淡入／动画时长，`:229-594` 内联脚本），否则单图。轮播脚本带 `data-swup-ignore-script`，由自己的清理函数 `window.__bannerCarouselCleanup` 管生命周期（`:578-591`）。
- 文字覆盖层、水波纹、图片署名。水波纹是四条 `<use>` 做视差。
- `id="banner-wrapper"` / `id="banner"` / `.banner-text-overlay` 都是 swup 钩子依赖的选择器（`src/scripts/core/swup-config.ts:30-32`）。
- **banner 高度与移动端隐藏的真源是 `src/styles/banner.css`**，不是 Layout.astro。改横幅高度、各断点尺寸要来这里：主内容顶部的 `35vh`（`banner.css:100`）、小于 480px 与 768–1279px 两档的 70vh（`:151`、`:263`）、`no-banner-mode` 的 `5.5rem`（`:63-64`）、首页滚动折叠态（`:46-58`）。历史上还有个服务端类 `.no-banner-layout`，随 `"none"` 模式一并删除，别再去找它。

### SidebarColumn / RightSideBar / SideBar

`SidebarColumn.astro` 是左右两侧共用的渲染器：靠 `componentMap` 把 widget 类型映射到组件（`src/components/layout/SidebarColumn.astro:44-55`），未知类型直接 `return null` 跳过（`:82-95`）；每个位置（top/sticky）× 设备（mobile/tablet/desktop）各拉一次组件列表。右栏是它的薄封装，固定 `showMobile=false / showTablet=false / showDesktop=true`（`src/components/layout/RightSideBar.astro:20-22`）；左栏 `SideBar.astro` 三个都 true（`src/components/widgets/sidebar/SideBar.astro:42-44`）。左侧栏设备显隐靠 CSS 变量 `--sidebar-{device}-display`（`SideBar.astro:47-65`）配合运行期 `SidebarManager` 类（`SideBar.astro:82-176`）。

注意 `src/components/layout/index.ts:1` 只导出了 `RightSideBar`，`SidebarColumn` / `Banner` 必须直接按路径引。

### Navbar.astro（`src/components/organisms/navigation/Navbar.astro`）

- logo 链接指向 `url(HOME_PATH)`（`:57`），注释解释了原因：首页是文章列表 `/home/`，指回根路径只会把用户送进起始页再等一次开屏（`:28-30`）。
- `data-is-home={isHomePage}` 供滚动检测（`:54`、`:231`）：非首页强制 `scrolled`，首页按 50px 阈值切换（`:234-249`）。
- 导航项通过 `LinkPresets` 把数字预设展开成对象（`:32-39`）。
- `window.initSemifullScrollDetection` 暴露到全局，供 swup 换页后重挂（`:274`）。
- 主题切换与设置面板都在这里（`:102-123`），不在 FloatingControls。生产环境另外注册 Pagefind 搜索加载器（`:284-313`）。

### Footer.astro

真实路径是 `src/components/organisms/footer/Footer.astro`（不在 `components/layout/`）。构建期用 Node `fs` 读 `footerConfig.customHtml`，为空才回退读 `src/FooterConfig.html`（`:2`、`:14-15`、`:19-24`）。改完必须重新构建才生效。

限定一句：它是**外壳组件里**唯一的构建期文件读取。整个仓库不止这一处——起始页的 `src/components/features/landing/nav-links.ts:1` 也 `import { existsSync } from "node:fs"`，并在 `:60-63` 探测页面文件是否存在（被 `LandingBento.astro:13` 引用）；`src/utils/anime-data.ts`、`src/utils/album-scanner.ts`、`src/pages/og/[...slug].png.ts` 同样在构建期读盘。

### FloatingControls.astro（`src/components/control/FloatingControls.astro`）

固定右下角的浮动按钮组，**实际只有四类**：音乐 FAB（按配置）、悬浮 TOC、返回首页、返回顶部（`:17-40`，四个 `data-control-key` 分别为 `music` / `toc` / `home` / `top`）。主题切换与设置面板不在这里。

- 用 `MutationObserver` 观察各按钮的 class 变化来重算堆叠（`:248-332`）。
- 可见数量变化时动态改 `--fab-group-bottom`（`:281-301`），音乐面板展开时整体锁定显隐（`:334-402`）。
- 在 `DOMContentLoaded` 与 `astro:page-load` 都初始化（`:419-426`）。

## Swup 换页：手动补偿样式与状态

因为 `astro.config.mjs:69` 设了 `updateBodyClass: false`，swup 换页后 body/导航/横幅的类不会自动更新，全靠 `src/scripts/core/swup-hooks.ts` 手动同步。这是换页后 `lg:is-home`、banner 文字、navbar 状态仍然正确的关键：

| 钩子 | 位置 | 做的事 |
| --- | --- | --- |
| `visit:start` | `swup-hooks.ts:127-146` | 按目标 URL 算 `isHomePage`，依次 `handleBodyClass`（`:254-263`）、`handleBannerTextVisibility`（`:268-279`）、`handleNavbarState`（`:284-302`）、`handleMobileBannerVisibility`（`:307-334`），并扩展页面高度、隐藏 TOC |
| `page:view` | `:152-169` | 再次 `extendPageHeight`、`scrollTo` 归零、`syncThemeState`（`:386-420`）、`dispatchPageLoadedEvent` |
| `visit:end` | `:175-185` | 延迟收起高度扩展并显示 TOC |
| `content:replace` | `:106-121` | 初始化 fancybox / KaTeX / 滚动条，重挂 TOC 与 semifull 滚动检测 |

`dispatchPageLoadedEvent`（`:426-445`）只在页面里存在 `#tcomment` 或 `#giscus-container` 时才派发 `mizuki:page:loaded`，评论组件监听它来重载自身。

`extendPageHeight`（`:339-360`）只对 `enable-banner` 的页面生效——fullscreen/none 模式内容常不足一屏，强行扩展会让滚动条在过渡期间闪现、引发左右抖动。

## 响应式决策

### grid-layout-utils.ts（真正在用的那套）

`calculateGridLayout`（`src/utils/grid-layout-utils.ts:86-195`）纯服务端计算：

- 侧栏存在性由 widget 配置决定（`getSidebarPresence`，`:58-81`）。手机看 drawer，平板/桌面看 left/right。
- 桌面列宽三选一：双侧 `17.5rem_1fr_17.5rem`、仅左 `17.5rem_1fr`、仅右 `1fr_17.5rem`，都没有则兜底 `lg:grid-cols-1`（`:121-128`）。
- 平板端右侧栏被强制关掉（`tabletShowRightSidebar = false`，`:112`，注释说明「右移左了」）。
- `grid` 布局模式会初始隐藏右栏（`initialRightSidebarHidden`，`:116-118`）。

### responsive-sidebar.ts（定义了但没被接线）

`src/utils/responsive-sidebar.ts` 提供了 `initSidebarManager`（`:61`）和 `getRightSidebarDisplayConfig`（`:113`），但全仓搜索不到任何 import。当前生效的是 `SideBar.astro` 内联的 `SidebarManager` 类（`src/components/widgets/sidebar/SideBar.astro:82-176`）和 `src/scripts/right-sidebar-layout.js`。读这个文件时不要以为改它就能改行为——它目前是死代码。

## 新写一个页面：该套哪个 layout

判断规则只有一条：

| 页面类型 | 用哪个 | 理由 |
| --- | --- | --- |
| 站点根 `/`（整屏、无导航/横幅的页） | `Layout` | 只需要 `<html>` 头和全局脚本，不要栅格 |
| 任何「内容页」（有导航条、横幅、侧栏、页脚） | `MainGridLayout` | 栅格外壳由它提供 |

新增内容页的最小骨架（照 `src/pages/zyj/index.astro:1-11` 与 `src/pages/posts/[...slug].astro:189-197` 抄）：

```astro
---
import MainGridLayout from "@layouts/MainGridLayout.astro";
const title = "页面标题";
---

<MainGridLayout title={title} description="可选描述">
  <div class="card-base z-10 px-9 py-6 relative w-full">
    正文
  </div>
</MainGridLayout>
```

要点：`title` 会走 `title - 站点名` 拼接；文章类页面再加 `setOGTypeArticle`、`postSlug`、`headings`（有 TOC 时）和 `slot="head"` 的 JSON-LD。若页面自己要接右侧边栏布局管理器，见 `src/pages/about.astro:23-25`。

## 反直觉清单（新人最容易踩）

1. **首页是 `/home/` 不是 `/`**。`/` 是起始页，且被 swup `ignore` 掉（`astro.config.mjs:98-103`）。任何「是否首页」判断写 `"/"` 都是错的。
2. **1281–1700px 根字号缩成 85%**（限非触摸、横屏），所有 rem 尺寸跟着缩（`src/layouts/partials/HeadTags.astro:159-173`）。
3. **swup 只替换 `<main>`**（`astro.config.mjs:63`）。导航条、横幅、侧栏能跨页保留；但起始页的裸 `<main>` 与内容页的嵌套 `<main>` 外壳对不上，只能用整页加载隔离。
4. **`#toc-container` 不启用 TOC 时也要留一个空 `<div>`**，否则 swup 找不到目标（`src/layouts/MainGridLayout.astro:288-293`）。
5. **同一状态有两套实现**：服务端 `calculateGridLayout` 与运行期 `GridScripts` / `SidebarManager` / `right-sidebar-layout.js`。改布局记得两边都看。
6. **`responsive-sidebar.ts` 是死代码**，改它不生效。
7. **Footer 在 `organisms/footer/` 下**，不在 `components/layout/`；且它会读文件系统。
8. **起始页竖向尺寸全用 `min(Xvw, Yvh)`**，原因写在 `src/pages/index.astro:24-27`：三块恒等于一屏，窗口变矮要等比收缩而不是溢出。
9. **评论组件不在 Layout 里**，是页面自己引入的（如 `src/pages/about.astro:40`），swup 换页后由 `mizuki:page:loaded` 事件触发重载（`src/scripts/core/swup-hooks.ts:426-445`）。
10. **OverlayScrollbars 属性没有初始化器**，`data-overlayscrollbars-initialize` 目前是遗留物。

## 本项目特有约定

- **分层**：`layouts/`（页面外壳）→ `components/layout/`（可复用零件）→ `components/organisms/`（导航/页脚等大块）→ `components/control/`（按钮类）→ `components/widgets/`（侧栏小组件）。`@components` / `@layouts` 是路径别名。
- **barrel 导出只覆盖一部分**：`components/layout/index.ts` 仅导出 `RightSideBar`；`organisms/navigation/index.ts` 导出 4 个 + types；`organisms/footer/index.ts` 导出 `Footer`。不要假设每个目录都有 barrel。
- **构建期 vs 运行期**：能在服务端算的类名就服务端算（`grid-layout-utils.ts`），但凡是「用户上次选的模式」只能运行期内联脚本改，于是必然有两套并行逻辑。
- **生命周期钩子**：swup 换页用 `astro:before-swap` 回收、`astro:page-load` 初始化；自定义事件另有 `wallpaper-mode-change`、`swup:page:view`、`mizuki:page:loaded`、`swup:contentReplaced`。`BackToHome` 同时监听 `astro:page-load` 与 `swup:contentReplaced`（`src/components/control/BackToHome.astro:51-55`），只记一个事件会漏掉 swup 换页这条路径。
- **选择器是契约**：`swup-config.ts:14-46` 里的 id/类名被多处 JS 依赖，改 HTML 结构前先查它。
- **URL 路由约定**：`base: "/"`、`trailingSlash: "always"`（`astro.config.mjs:40-41`），所以所有 URL 都带尾斜杠；`/start` 有一条静态 redirect 到 `/`（`astro.config.mjs:50-52`），兜住起始页搬迁前的旧书签。

## 相关文件

- `src/layouts/Layout.astro` —— 最外层 HTML 壳，负责 head、首帧主题、全局脚本、Pio/播放器挂载。
- `src/layouts/MainGridLayout.astro` —— 内容页栅格外壳，导航条/横幅/侧栏/主栏/页脚/TOC。
- `src/layouts/partials/HeadTags.astro` —— SEO meta、主题防闪烁脚本、根字号自动缩放。
- `src/layouts/partials/GridScripts.astro` —— 壁纸模式与文章列表布局的运行期应用/切换。
- `src/layouts/partials/AnalyticsScripts.astro` —— GTM/Clarity 交互后延迟加载。
- `src/components/layout/Banner.astro` —— 横幅：轮播/单图、文字覆盖、水波纹。
- `src/components/layout/SidebarColumn.astro` —— 左右侧栏共用渲染器，按设备×位置拉 widget。
- `src/components/layout/RightSideBar.astro` —— 右侧栏封装（仅桌面）。
- `src/components/widgets/sidebar/SideBar.astro` —— 左侧栏封装 + 设备显隐管理。
- `src/components/organisms/navigation/Navbar.astro` —— 导航条，logo 指向 `/home/`。
- `src/components/organisms/footer/Footer.astro` —— 页脚，构建期读 `src/FooterConfig.html`。
- `src/components/control/FloatingControls.astro` —— 右下角浮动按钮组（音乐/TOC/回首页/回顶部）。
- `src/components/control/BackToHome.astro` —— 返回首页按钮，判定与跳转都用 `HOME_PATH`。
- `src/components/control/BackToTop.astro` —— 返回顶部按钮，滚动超过 200px 才显。
- `src/components/misc/ConfigCarrier.astro` —— 把 TOC 等运行期配置挂到 `window.siteConfig`。
- `src/components/misc/IconifyLoader.astro` —— 往 head 注入 iconify-icon 脚本并预加载图标。
- `src/utils/grid-layout-utils.ts` —— 服务端栅格/透明度/主栏位置计算。
- `src/utils/responsive-sidebar.ts` —— 通用响应式侧栏管理器（当前未被引用）。
- `src/utils/url-utils.ts` —— `pathsEqual` / `url`，`isHomePage` 判定依赖它。
- `src/constants/constants.ts` —— `HOME_PATH`、`PAGE_WIDTH`、banner 高度、默认主题等真源。
- `src/scripts/swup-manager.ts` / `src/scripts/core/swup-hooks.ts` / `src/scripts/core/swup-config.ts` —— SPA 换页管理器、钩子与选择器契约。
- `src/styles/banner.css` —— banner 高度、移动端隐藏、各断点尺寸的真源。
- `astro.config.mjs` —— swup 集成配置（`containers:["main"]`、起始页 ignore 规则、redirects）。
