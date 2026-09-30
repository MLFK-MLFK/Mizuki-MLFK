# 03 · 配置系统

这一块回答的是「这个站的一切可调项在哪、怎么改」。全站的配置中枢是 `src/config.ts`，它导出 18 个常量对象；类型约束在 `src/types/config.ts`，文章前置元数据的校验在 `src/content.config.ts`，一小撮跨模块共享的魔法值（分页大小、首页路径、主题常量）在 `src/constants/`。

你需要翻这一块，通常是这几种场景：改站名/头像/导航栏；开或关某个特色页面（番剧、相册、友链）；换主题色相；调整侧边栏放哪些卡片、什么顺序；改文章 frontmatter 的合法字段；或者你在别处读到 `HOME_PATH`、`PAGE_SIZE`、`siteConfig` 却不知道它定义在哪。

**最重要的一句话**：`src/config.ts` 只覆盖「站点级、构建期决定」的配置。壁纸图片在 `public/assets/`，翻译文案在 `src/i18n/languages/`，umami 统计在 `astro.config.mjs`，路由重定向也在 `astro.config.mjs`——只改 `config.ts` 会漏。

---

## 一、配置从哪来、到哪去

```
src/config.ts（真源，18 个 export）
      │  构建期被 import
      ├──> src/utils/widget-manager.ts ──> SidebarColumn.astro        （侧栏渲染）
      ├──> src/layouts/Layout.astro ──> HeadTags.astro / ConfigCarrier.astro （CSS 变量、SEO）
      ├──> src/utils/grid-layout-utils.ts ──> MainGridLayout.astro   （栅格、banner）
      ├──> 各 src/pages/*.astro                                      （featurePages 守卫、分页大小）
      ├──> scripts/compress-fonts.js                                 （构建期正则解析，非 import）
      └──> src/scripts/swup-manager.ts                               （运行期！widgetConfigs 进客户端 bundle）
```

配置的主体是构建期（Astro frontmatter / SSR）被读走、渲染成静态 HTML 的；另一条通道是 `define:vars` 把少数值内联成浏览器脚本变量（例如 `themeColor.hue`、`toc.depth`）。但要注意：`src/scripts/swup-manager.ts:6` 直接 `import { widgetConfigs } from "../config"`，这个模块由 `Layout.astro:322-325` 的客户端 `<script>` 加载，因此**整份 `config.ts` 会被打进客户端 bundle 并在浏览器里执行**（`swup-manager.ts:44` 就用了 `document`）。「配置只在构建期被读」这个说法并不成立，第九节展开。

---

## 二、`src/config.ts` 逐块拆解

文件共 701 行，18 个 `export const`，按定义顺序是：`siteConfig`、`fullscreenWallpaperConfig`、`navBarConfig`、`profileConfig`、`licenseConfig`、`permalinkConfig`、`expressiveCodeConfig`、`commentConfig`、`shareConfig`、`announcementConfig`、`musicPlayerConfig`、`footerConfig`、`sidebarLayoutConfig`、`sakuraConfig`、`pioConfig`、`relatedPostsConfig`、`randomPostsConfig`、`widgetConfigs`。

顶部有两个私有常量，其它所有配置都引用它们：

| 常量 | 值 | 位置 |
| --- | --- | --- |
| `SITE_LANG` | `"zh_CN"` | `src/config.ts:24` |
| `SITE_TIMEZONE` | `8` | `src/config.ts:25` |

`src/config.ts:21` 有一句注释「移除i18n导入以避免循环依赖」——所以这个文件**不**导入 `i18n`，导航项名字用的是 `LinkPreset` 枚举（在 `Navbar.astro` 里才翻译成文案）。

### 1. `siteConfig`（`src/config.ts:26-244`）

站点主配置，字段最多。按注释分块：

| 字段 | 当前值 | 位置 | 作用 |
| --- | --- | --- | --- |
| `title` / `subtitle` | `"mkの后花园"` 各一 | `src/config.ts:27-28` | 站点标题；`Layout.astro:95-104` 用它拼 `<title>` |
| `siteURL` | `https://mlfk.pages.dev/` | `src/config.ts:29` | 站点 URL，以斜杠结尾；`astro.config.mjs:39` 读它当 `site` |
| `siteStartDate` | `"2026-4-20"` | `src/config.ts:30` | 运行天数，`SiteStats.astro:22` 读 |
| `timeZone` | `8` | `src/config.ts:32` | 时区偏移，`src/utils/timeFormat.ts:17` 用它格式化相对时间 |
| `lang` | `"zh_CN"` | `src/config.ts:34` | 站点语言，喂给 i18n |
| `themeColor` | `{ hue: 345, fixed: false }` | `src/config.ts:36-39` | 主题色相；`fixed:true` 会藏掉色相选择按钮 |
| `featurePages` | 见下 | `src/config.ts:42-51` | 8 个特色页面开关 |
| `navbarTitle` | `{ mode:"text-icon", text, icon, logo }` | `src/config.ts:54-63` | 导航栏标题形态 |
| `pageScaling` | `{ enable:true, targetWidth:2000 }` | `src/config.ts:66-69` | 宽屏自动缩放 |
| `bangumi` / `bilibili` / `anime` | 见下 | `src/config.ts:71-91` | 番剧数据源 |
| `postListLayout` | `{ defaultMode:"list", allowSwitch:true, categoryBar:{enable:true} }` | `src/config.ts:94-104` | 文章列表布局 |
| `tagStyle` | `{ useNewStyle:false }` | `src/config.ts:107-110` | 标签新旧样式 |
| `wallpaperMode` | `{ defaultMode:"banner", showModeSwitchOnMobile:"desktop" }` | `src/config.ts:113-122` | 壁纸模式 |
| `banner` | 见下 | `src/config.ts:124-193` | 顶部横幅 |
| `toc` | `{ enable:true, mobileTop:true, desktopSidebar:true, floating:true, depth:2, useJapaneseBadge:true }` | `src/config.ts:194-201` | 目录系统 |
| `showCoverInContent` | `true` | `src/config.ts:202` | 文章页是否显示封面 |
| `generateOgImages` | `false` | `src/config.ts:203` | 生成 OG 图（构建慢） |
| `favicon` | `[]`（空） | `src/config.ts:204-211` | 留空则用 `constants/icon.ts` 的默认图标 |
| `font` | 见下 | `src/config.ts:214-232` | 字体 |
| `showLastModified` | `true` | `src/config.ts:233` | 「上次编辑」卡片 |
| `pageProgressBar` | `{ enable:true, height:3, duration:6000 }` | `src/config.ts:234-238` | 顶部进度条 |
| `thirdPartyAnalytics` | `{ enable:false, clarityId:"" }` | `src/config.ts:240-243` | Microsoft Clarity |

漏说一个字段：`siteConfig.keywords`（类型在 `src/types/config.ts:13`）虽然当前 `config.ts` 里没写，但 `HeadTags.astro:42` 会读它，并在 `HeadTags.astro:53-54` 生成 `<meta name="keywords">`（只有非空才输出）。

`favicon` 为空时，`HeadTags.astro:45-46` 走兜底：`siteConfig.favicon.length > 0 ? siteConfig.favicon : defaultFavicons`。

`featurePages`（`src/config.ts:42-51`）当前取值：

```
anime:false  diary:false  friends:true  projects:false
skills:false timeline:false albums:true  devices:false
```

它**不是**靠删文件生效。每个页面顶部有守卫，关掉时返回静态跳转，例如 `src/pages/diary.astro:12-14`：

```ts
if (!siteConfig.featurePages.diary) {
	return Astro.redirect("/404/");
}
```

`output:"static"` 下这会生成一个空壳（约 291 字节）跳 `/404/`，所以「文件在不在」查不出开关状态——这一点在 `src/components/features/landing/nav-links.ts:29-31` 有明确记录。

`banner`（`src/config.ts:124-193`）字段很多，逐个列：

| 子字段 | 值 | 位置 |
| --- | --- | --- |
| `src.desktop` / `src.mobile` | 各 4 张 `/assets/...-banner/N.webp` | `src/config.ts:126-139` |
| `position` | `"center"` | `src/config.ts:141` |
| `carousel` | `{ enable:true, interval:3 }`（秒） | `src/config.ts:143-146` |
| `waves` | `{ enable:true, performanceMode:false, mobileDisable:false }` | `src/config.ts:148-152` |
| `imageApi` | `{ enable:false, url:"http://domain.com/api_v2.php?format=text&count=4" }` | `src/config.ts:155-158` |
| `homeText` | `enable:true, title:"<mkの后花园>"`, `subtitle:[5 句日文]`, `typewriter:true` | `src/config.ts:163-181` |
| `credit` | `{ enable:false, text:"Describe", url:"" }` | `src/config.ts:183-188` |
| `navbar.transparentMode` | `"semifull"` | `src/config.ts:190-192` |

`imageApi` 的 URL 要求返回 **text** 格式（每行一个图片链接），注释里给了项目地址（`src/config.ts:159-161`）。启用后 `getBannerImages()` 会在**构建期** `fetch` 这个地址（`src/utils/grid-layout-utils.ts:206-218`）——构建机必须能访问外网。

`font`（`src/config.ts:214-232`）分 `asciiFont`（优先）和 `cjkFont`（回退）：

- `asciiFont` = `ZenMaruGothic-Medium`，`localFonts:["ZenMaruGothic-Medium.ttf"]`，`enableCompress:true`
- `cjkFont` = `萝莉体 第二版`，`localFonts:["loli.ttf"]`，`enableCompress:true`

注释明确两条坑（`src/config.ts:215-216`）：自定义字体还要在 `src/styles/main.css` 里引入；子集压缩**仅支持 TTF**，且只有在生产构建才看得到效果。字体物理文件必须放在 `public/assets/font/` 下——`scripts/compress-fonts.js:1094` 的报错信息把这条路径写死了（`Expected path: public/assets/font/${fontFile}`）。`Layout.astro:125-158` 把它拼成 `font-family` 内联样式，`scripts/compress-fonts.js` 在构建期做子集。

### 2. `fullscreenWallpaperConfig`（`src/config.ts:245-268`）

独立的顶层导出，**不**在 `siteConfig` 里。字段：`src`（同 banner 的 desktop/mobile）、`position:"center"`、`carousel:{enable:true,interval:5}`、`zIndex:-1`、`opacity:0.8`、`blur:1`。由 `MainGridLayout.astro:110` 传给 `<FullscreenWallpaper>`。注意它的轮播间隔是 5 秒，和 banner 的 3 秒不同。

### 3. `navBarConfig`（`src/config.ts:270-362`）

```ts
export const navBarConfig: NavBarConfig = { links: [ ... ] };
```

`links` 混用两种元素：`LinkPreset` 枚举值（`LinkPreset.Home`、`LinkPreset.Archive`），或手写的 `NavBarLink` 对象（`{ name, url, icon, children }`）。当前结构：

- `LinkPreset.Home`、`LinkPreset.Archive`
- 「链接」→ `url:"/links/"`，子项 GitHub / Bilibili（`external:true`）
- 「关于我」→ `url:"/content/"`，子项「相册」`/albums/`
- 「关于」→ `url:"/content/"`，子项「关于」`/about/`、「引用与鸣谢」`/friends/`
- 「友链」→ `url:"#"`（子项全被注释掉了）

`LinkPreset` 枚举定义在 `src/types/config.ts:205-216`，各预设的 `name`/`url`/`icon` 在 `src/constants/link-presets.ts:7-60`。解析发生在 `Navbar.astro:32-39`：`typeof item === "number"` 就走 `LinkPresets[item]`。

> **指向不存在页面的父项并不会变成死链。** `src/config.ts:277` 的 `/links/`、`src/config.ts:296` 与 `:324` 的 `/content/` 在 `src/pages/` 下都不存在（目录里既没有 `content.astro` 也没有 `links.astro`），但桌面端 `DropdownMenu.astro:41-62`、移动端 `NavMenuPanel.astro:60-81` 对「带 `children` 的父项」一律渲染成 `<button>`（没有 `href`），只有无 `children` 的项才落成 `<a>`（`DropdownMenu.astro:100-123`、`NavMenuPanel.astro:113-142`）。所以这些 URL 不会作为链接出现在导航栏上；它们只影响起始页的 `getQuickLinks()`——那里会被 `isReachablePage()` 过滤掉（`nav-links.ts:52-64`）。

### 4. `profileConfig`（`src/config.ts:364-384`）

`avatar:"assets/images/av.png"`、`name:"MLFK"`、`bio:"红瞳白毛小萝莉"`、`typewriter:{enable:true,speed:80}`、`links:[Bilibili, GitHub]`。

关键约定（`src/config.ts:365`）：`avatar` **不**以 `/` 开头时相对 `src/`；以 `/` 开头时相对 `public/`。

### 5. 其余顶层导出

| 导出 | 关键值 | 位置 | 消费点 |
| --- | --- | --- | --- |
| `licenseConfig` | `enable:true`, `name:"CC BY-NC-SA 4.0"` | `src/config.ts:386-390` | 文章页 `License.astro` |
| `permalinkConfig` | `enable:false`, `format:"%postname%"` | `src/config.ts:393-418` | `src/utils/permalink-utils.ts` |
| `expressiveCodeConfig` | `theme:"github-dark"`, `hideDuringThemeTransition:true` | `src/config.ts:420-426` | 只有 `ConfigCarrier.astro:9` 用 `hideDuringThemeTransition` |
| `commentConfig` | `enable:false`, `system:"twikoo"` | `src/config.ts:428-449` | `src/components/comment/index.astro:4` import，`:23-26`、`:35` 读取 |
| `shareConfig` | `enable:true` | `src/config.ts:451-453` | `ShareCard` |
| `announcementConfig` | 无 `enable`；`title:""`, `content`, `closable:false`, `link.enable:false` | `src/config.ts:455-465` | 公告组件 |
| `musicPlayerConfig` | `enable:true`, `floatingEntryMode:"fab"`, `mode:"local"`, `server:"netease"` | `src/config.ts:467-478` | `MusicPlayer.svelte` |
| `footerConfig` | `enable:false`, `customHtml:""` | `src/config.ts:480-486` | `Footer.astro` |
| `relatedPostsConfig` | `enable:true`, `maxCount:5` | `src/config.ts:676-679` | `src/pages/posts/[...slug].astro:103-104`、`:368-376` |
| `randomPostsConfig` | `enable:true`, `maxCount:5` | `src/config.ts:682-685` | `src/pages/posts/[...slug].astro:368-376` |
| `widgetConfigs` | 10 个子配置的聚合对象 | `src/config.ts:688-699` | `src/scripts/swup-manager.ts:6` |

要点：

- `announcementConfig` **没有** `enable` 字段——是否显示由侧栏 `components` 数组决定（类型注释 `src/types/config.ts:336` 明说「enable 属性已移除，现在通过sidebarLayoutConfig统一控制」）。这是新人最常踩的一个点：在 `announcementConfig` 里找开关找不到。
- `expressiveCodeConfig.theme` 是**不生效的字段**。全仓 grep 只有 `ConfigCarrier.astro:9` 用了 `hideDuringThemeTransition`，代码高亮主题实际由 `astro.config.mjs:110` 的 `expressiveCode({ themes: ["github-light","github-dark"] })` 决定。改 `config.ts:423` 的 `theme` 没有任何效果。
- `relatedPostsConfig` 的消费点不在 `getRelatedPosts` 里。`content-utils.ts:216-218` 的 `getRelatedPosts(currentPost, maxCount = 5)` 只接收参数，不 import 配置；真正判断开关并传 `maxCount` 的是页面 `posts/[...slug].astro:103-104`。

### 6. `widgetConfigs`：唯一被前端脚本 import 的出口（`src/config.ts:688-699`）

```ts
export const widgetConfigs = {
	profile: profileConfig,
	announcement: announcementConfig,
	music: musicPlayerConfig,
	layout: sidebarLayoutConfig,
	sakura: sakuraConfig,
	fullscreenWallpaper: fullscreenWallpaperConfig,
	pio: pioConfig,
	share: shareConfig,
	relatedPosts: relatedPostsConfig,
	randomPosts: randomPostsConfig,
} as const;
```

它是配置进运行期的入口：`src/scripts/swup-manager.ts:6` import 它，`:100-102` 的 `setupSakura()` 把它交给 `setupSakuraOnDOMReady(widgetConfigs)`，`sakura-effect.ts:20-32` 再读 `widgetConfigs.sakura` 决定要不要初始化樱花特效（`:21`）。新增「需要在浏览器里读」的运行时配置时，记得加进这个聚合对象。

### 7. `sidebarLayoutConfig`（`src/config.ts:493-620`）

侧栏是本块最绕的一块，四组字段：

| 组 | 作用 | 位置 |
| --- | --- | --- |
| `properties: WidgetComponentConfig[]` | 每个组件的「属性」：`type`、`position`（`"top"`/`"sticky"`）、`class`、`animationDelay`、`responsive` | `src/config.ts:495-583` |
| `components: { left, right, drawer }` | 三处位置各自放哪些组件、什么顺序 | `src/config.ts:586-596` |
| `defaultAnimation` | `enable:true`, `baseDelay:0`, `increment:50` | `src/config.ts:599-606` |
| `responsive.breakpoints` | `mobile:768`, `tablet:1280`, `desktop:1280` | `src/config.ts:608-619` |

`properties` 里定义了 8 个组件：`profile`、`announcement`、`music-sidebar`、`categories`、`tags`、`card-toc`、`site-stats`、`calendar`。`components` 把其中一部分分配出去：

```
left:   [profile, announcement, tags, card-toc]
right:  [site-stats, calendar, categories, music-sidebar]
drawer: [profile, announcement, music-sidebar, categories, tags]
```

**顺序由 `components` 数组决定，不由 `properties` 决定**——`properties` 只提供元数据。若某个类型出现在 `components` 但不在 `properties`，`getComponentsByPosition()` 会兜底返回 `{ type, position:"top" }`（`src/utils/widget-manager.ts:81-84`），只有 top 位置、无动画类；注意这个兜底仅在请求位置恰好是 `"top"` 时触发（`:82` 的 `&& position === "top"`），请求 sticky 时该组件会被 `:85` 的 `null` 过滤掉。

`position` 语义（注释在 `src/config.ts:491`）：`"top"` 固定顶部，`"sticky"` 粘性可滚。移动端强制走 `drawer`；平板端右侧**直接丢弃**——`widget-manager.ts:61-68`：请求 right 时 `return []`，请求 left 时只有在 `components.left` 为空的情况下才改用 right，本项目 left 非空，所以平板端只有左栏内容。

---

## 三、`src/types/config.ts`：类型系统能帮你抓什么

这个文件是配置的「契约」。`src/config.ts` 里每个导出都标注了对应接口类型（如 `export const siteConfig: SiteConfig = {...}`），所以 `npx astro check` / `tsc` 能在构建前抓错。

主要接口：

| 接口 | 位置 | 说明 |
| --- | --- | --- |
| `SiteConfig` | `src/types/config.ts:9-197` | 主配置，字段最多 |
| `Favicon` | `src/types/config.ts:199-203` | `src` / `theme?` / `sizes?` |
| `LinkPreset`（enum） | `src/types/config.ts:205-216` | Home=0 … Timeline=9 |
| `NavBarLink` / `NavBarConfig` | `src/types/config.ts:218-228` | `children?: (NavBarLink \| LinkPreset)[]` |
| `ProfileConfig` | `src/types/config.ts:230-243` | |
| `LicenseConfig` | `src/types/config.ts:245-249` | |
| `PermalinkConfig` | `src/types/config.ts:252-275` | |
| `CommentConfig` / `GiscusConfig` / `TwikooConfig` | `src/types/config.ts:279-305` | |
| `LIGHT_DARK_MODE` / `WALLPAPER_MODE` | `src/types/config.ts:307-312` | 从 constants 派生的联合类型 |
| `BlogPostData` | `src/types/config.ts:314-328` | |
| `ExpressiveCodeConfig` | `src/types/config.ts:330-333` | |
| `AnnouncementConfig` | `src/types/config.ts:335-348` | 无 `enable` |
| `MusicPlayerConfig` / `FooterConfig` | `src/types/config.ts:350-365` | |
| `WidgetComponentType` | `src/types/config.ts:368-380` | 12 个合法组件名 |
| `WidgetComponentConfig` | `src/types/config.ts:382-393` | |
| `SidebarLayoutConfig` | `src/types/config.ts:395-414` | |
| `SakuraConfig` / `FullscreenWallpaperConfig` / `PioConfig` | `src/types/config.ts:416-485` | |
| `ShareConfig` / `RelatedPostsConfig` / `RandomPostsConfig` | `src/types/config.ts:490-508` | |
| `PageProgressBarConfig` / `ThirdPartyAnalyticsConfig` | `src/types/config.ts:513-525` | |

类型系统帮你抓的几类错：

1. **联合类型限值**。`timeZone` 是一个从 `-12` 到 `12` 的字面量联合（`src/types/config.ts:16-41`），写 `13` 直接报错。`lang` 是 10 个语言码的联合（`src/types/config.ts:43-53`），写 `"zh"` 报错。`themeColor.hue` 只是 `number`，不校验 0-360——范围是**运行时**在滑杆上限制的（`DisplaySettings.svelte:20-24`）。
2. **拼写枚举**。`postListLayout.defaultMode` 是 `"list" | "grid"`（`src/types/config.ts:74`），`wallpaperMode.defaultMode` 是 `"banner" | "fullscreen" | "none"`（`src/types/config.ts:137`），写错字符串立刻被抓。
3. **组件名白名单**。`components.left/right/drawer` 是 `WidgetComponentType[]`（`src/types/config.ts:397-401`），写一个不存在的组件名报错。
4. **`Record<LinkPreset, NavBarLink>` 的完备性**。`src/constants/link-presets.ts:7` 用 `Record<LinkPreset, NavBarLink>`，少写任何一个枚举成员都会编译失败。

要注意：类型里的**可选性**和 `config.ts` 的实际填写并不总一致。例如 `navbarTitle?`、`pageScaling?`、`banner.credit.url?` 在类型里是可选（`src/types/config.ts:82,90,177`），但模板里可能直接访问（`MainGridLayout.astro:154` 在 `hasBannerCredit` 为真时直接 `href={siteConfig.banner.credit.url}`，而守卫只看 `enable`，不看 `url`）。改这些可选字段时留意调用点有没有做空值保护。

---

## 四、`src/content.config.ts`：Astro 6 content layer

这是 Astro 6 的 content layer 配置，决定「`src/content/` 下的 Markdown 前置元数据怎样才算合法」。全文只有 51 行（`src/content.config.ts:1-51`）。

```ts
const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({ ... }),
});
```

用的是 `glob` loader（`import { glob } from "astro/loaders"`，`src/content.config.ts:1`）和 `zod` 校验（`import { z } from "astro/zod"`，`src/content.config.ts:2`）。

两个集合：

| 集合 | loader base | schema | 位置 |
| --- | --- | --- | --- |
| `posts` | `./src/content/posts`，匹配 `**/*.{md,mdx}` | 完整的文章 schema | `src/content.config.ts:5-42` |
| `spec` | `./src/content/spec`，匹配 `**/*.{md,mdx}` | `z.object({})`——不校验任何字段 | `src/content.config.ts:43-46` |

`posts` 的每个 frontmatter 字段（`src/content.config.ts:7-41`）：

| 字段 | 类型 | 必填？ | 默认 |
| --- | --- | --- | --- |
| `title` | `string` | **必填** | — |
| `published` | `date` | **必填** | — |
| `updated` | `date` | 可选 | — |
| `draft` | `boolean` | 可选 | `false` |
| `description` | `string` | 可选 | `""` |
| `image` | `string` | 可选 | `""` |
| `tags` | `string[]` | 可选 | `[]` |
| `category` | `string \| null` | 可选 | `""` |
| `lang` | `string` | 可选 | `""` |
| `pinned` | `boolean` | 可选 | `false` |
| `comment` | `boolean` | 可选 | `true` |
| `priority` | `number` | 可选 | （无默认） |
| `author` / `sourceLink` / `licenseName` / `licenseUrl` | `string` | 可选 | `""` |
| `encrypted` | `boolean` | 可选 | `false` |
| `password` / `passwordHint` | `string` | 可选 | `""` |
| `alias` | `string` | 可选 | — |
| `permalink` | `string` | 可选 | — |
| `prevTitle` / `prevSlug` / `nextTitle` / `nextSlug` | `string` | 可选（有 default） | `""` |

只有 `title` 和 `published` 是真必填。写错字段名 / 漏 `title` / `published` 写成字符串，都会在 `astro build` 时被 zod 拦下并报出文件路径。

最后四个 `prev*` / `next*` 注释写着 `/* For internal use */`（`src/content.config.ts:36`）——它们其实是构建期由 `content-utils.ts:48-55` 回填上一篇/下一篇的，作者在 frontmatter 里不该写。

`spec` 集合的 schema 是空对象，所以 `src/content/spec/about.md`、`friends.md` 可以自由写 frontmatter；它们通过 `getEntry("spec","about")` 取用（`src/pages/about.astro:11`、`src/pages/friends.astro:20`）。

集合的消费方式（`getCollection("posts")` / `getCollection("spec")`）集中在 `src/utils/content-utils.ts`。草稿过滤是**按环境**的：

```ts
return import.meta.env.PROD ? data.draft !== true : true;
```

（`src/utils/content-utils.ts:10`、`:86`、`:115`、`:221`）——生产构建才滤掉 `draft`，开发时草稿可见。

排序规则（`src/utils/content-utils.ts:13-41`）容易被误读，实际是：

1. 置顶优先：`pinned` 的排在不置顶的前面（`:15-20`）。
2. `priority` **只在两篇都置顶时才比较**（`:23-35`），升序（数值小在前）；非置顶文章之间完全忽略 `priority`，给它设值也不会往前排。
3. 其余按发布日期降序（`:38-40`）。

---

## 五、`src/constants/`

三个文件，各管一摊。

### 1. `constants.ts`（`src/constants/constants.ts:1-39`）

| 常量 | 值 | 位置 |
| --- | --- | --- |
| `PAGE_SIZE` | `8` | `src/constants/constants.ts:1` |
| `HOME_PATH` | `"/home/"` | `src/constants/constants.ts:14` |
| `LIGHT_MODE` / `DARK_MODE` | `"light"` / `"dark"` | `src/constants/constants.ts:16-17` |
| `DEFAULT_THEME` | `DARK_MODE`（即默认夜间） | `src/constants/constants.ts:20` |
| `BANNER_HEIGHT` / `BANNER_HEIGHT_EXTEND` / `BANNER_HEIGHT_HOME` | `35` / `30` / `65` | `src/constants/constants.ts:23-25` |
| `MAIN_PANEL_OVERLAPS_BANNER_HEIGHT` | `3.5`（rem） | `src/constants/constants.ts:28` |
| `PAGE_WIDTH` | `90`（rem） | `src/constants/constants.ts:31` |
| `UNCATEGORIZED` | `"uncategorized"` | `src/constants/constants.ts:34` |
| `WALLPAPER_BANNER` / `_FULLSCREEN` / `_NONE` | `"banner"` / `"fullscreen"` / `"none"` | `src/constants/constants.ts:37-39` |

`PAGE_SIZE` 只在一处用：`src/pages/home/[...page].astro:9` 导入、`:27` 传给 `paginate(allBlogPosts, { pageSize: PAGE_SIZE })`。

`DEFAULT_THEME = DARK_MODE`（`src/constants/constants.ts:18-20`）是**全站唯一的默认主题真源**，消费点是 `HeadTags.astro:114`（首帧脚本）、`setting-utils.ts:152`（`getStoredTheme()`）、`ThemeSwitch.svelte:10`、`src/scripts/core/swup-config.ts:101`。想改默认亮色，改这一处。

### 2. `icon.ts`（`src/constants/icon.ts:3-14`）

只导出一个 `defaultFavicons: Favicon[]`，含两条（light/dark）指向 `/favicon/favicon.ico`。当 `siteConfig.favicon` 为空数组时被采用（`HeadTags.astro:45-46`）。

### 3. `link-presets.ts`（`src/constants/link-presets.ts:7-60`）

导出 `LinkPresets: Record<LinkPreset, NavBarLink>`，把 `LinkPreset` 枚举映射成具体的 `{ name, url, icon }`。`name` 来自 `i18n(I18nKey.xxx)`（`src/constants/link-presets.ts:9` 等），`url` 大多是硬编码路径。

**Home 项特殊**：`url: HOME_PATH`（`src/constants/link-presets.ts:12`），即 `/home/` 而非站点根 `/`。注释解释了原因（`src/constants/link-presets.ts:10-11`）：站内点「首页」不该重播 5 秒开屏。

### 为什么有 `HOME_PATH` 这个常量

站点根 `/` 让给了**起始页**（开屏动画 + 「进入」按钮，`src/pages/index.astro`），原来的分页文章列表搬到了 `/home/`（`src/pages/home/[...page].astro`）。于是「这是不是首页」的语义整个错位了——凡是判断首页的地方都必须用 `HOME_PATH`，写死的 `"/"` 现在指的是起始页。

`src/constants/constants.ts:3-13` 的长注释把这件事讲得很清楚。`HOME_PATH` 的引用点（本次 grep 实测）：

| 文件:行 | 用途 |
| --- | --- |
| `src/constants/link-presets.ts:12` | Home 预设的 url |
| `src/layouts/Layout.astro:42` | `isHomePage`，控制 `lg:is-home` 类 |
| `src/layouts/MainGridLayout.astro:54` | `isHomePage`，控制 banner 高度补偿 |
| `src/components/organisms/navigation/Navbar.astro:30,57` | 判断首页、logo 的 href |
| `src/scripts/core/swup-hooks.ts:134` | swup 换页时判断首页 |
| `src/components/organisms/navigation/Search.svelte:25,33` | 搜索结果里的首页链接 |
| `src/components/features/toc/hooks/useMobileTOC.ts:134-135` | 移动端 TOC 判断首页（含 `/home/\d+/` 分页） |
| `src/utils/navigation-utils.ts:256` | 判定路径是否首页（两种斜杠写法都认） |
| `src/components/control/BackToHome.astro:12`、`src/pages/404.astro:53` | 返回首页按钮 |
| `src/components/features/posts/CategoryBar.astro:12` | 分类栏的首页链接 |
| `src/components/features/landing/nav-links.ts:91`、`LandingHero.astro:29`、`LandingBento.astro:93` | 起始页的「进入」按钮、快捷入口与文章链接 |

改首页位置时，这一处常量会让上面这些点一起跟着走。

---

## 六、两条完整消费链路

### 链路 A：`themeColor.hue` → CSS 变量 → 界面配色

1. **真源**：`siteConfig.themeColor.hue = 345`（`src/config.ts:37`）。
2. **构建期取值**：`Layout.astro:46` 读出 `const configHue = siteConfig.themeColor.hue;`。
3. **两处落地**：
   - `Layout.astro:188-193` 用 `<style define:vars={{ configHue, "page-width": ... }}>` 把它变成 CSS 变量声明的一部分；
   - `ConfigCarrier.astro:8` 把它写进 DOM：`data-hue={siteConfig.themeColor.hue}`。
4. **运行期首帧**：`HeadTags.astro:136-137` 的内联脚本 `const hue = localStorage.getItem("hue") || configHue; document.documentElement.style.setProperty("--hue", hue);`——用户上次拖滑杆存的值优先于配置默认值。
5. **映射到颜色**：`src/styles/variables.styl:26` 起，所有主题色都由 `--hue` 派生，例如：

```
--primary: oklch(0.70 0.14 var(--hue))  oklch(0.75 0.14 var(--hue))
--page-bg: oklch(0.95 0.01 var(--hue))  oklch(0.16 0.014 var(--hue))
```

`oklch(L C H)` 的第三位就是色相，直接吃 `var(--hue)`。冒号后两个值分别是亮/暗模式（由 `variables.styl:16-23` 的 `define(vars)` 混入分发）。
6. **用户改色**：`DisplaySettings.svelte:20-27` 的滑杆调用 `setHue()`（`src/utils/setting-utils.ts:26-33`），写 `localStorage.hue` 并 `r.style.setProperty("--hue", ...)`，所有 `var(--hue)` 的颜色实时更新。重置值来自 `getDefaultHue()`（`src/utils/setting-utils.ts:11-19`），它读的正是 `#config-carrier` 的 `data-hue`——**构成一个从配置到界面的闭环**。
7. **隐藏入口**：`themeColor.fixed === true` 时，`Navbar.astro:102` 的 `{!siteConfig.themeColor.fixed && (...)}` 不渲染这个设置面板。

### 链路 B：`sidebarLayoutConfig` → 侧栏渲染

1. **真源**：`sidebarLayoutConfig`（`src/config.ts:493-620`）。
2. **构建期实例化**：`WidgetManager` 构造时默认吃这个配置（`src/utils/widget-manager.ts:32`），并导出单例 `widgetManager`（`src/utils/widget-manager.ts:267`）。
3. **计算是否存在侧栏**：`MainGridLayout.astro:74` 调 `calculateGridLayout({ siteConfig, widgetManager })`（`src/utils/grid-layout-utils.ts:86-195`），产出 `gridCols` / `sidebarClass` / `rightSidebarClass` / `mainContentClass` 与 `hasXxxComponents` 布尔值。栅格列宽在此硬编码为 `17.5rem`（`src/utils/grid-layout-utils.ts:123-127`）。
4. **取组件列表**：`SideBar.astro` / `RightSideBar.astro` 渲染 `<SidebarColumn>`；`SidebarColumn.astro:61-80` 对每个设备/位置调 `widgetManager.getComponentsByPosition(position, side, deviceType)`。
   - `getComponentsByPosition()`（`src/utils/widget-manager.ts:49-88`）里，`mobile` 会被强制改成 `"drawer"`（`:57-59`）；`tablet` 时右侧直接返回空、且只有在左栏为空时才把右栏内容改用左栏（`:61-68`，本项目左栏非空，右栏内容不会出现在平板端）。
   - 它按 `components[activeSidebar]` 的**顺序**遍历，再从 `properties` 找对应元数据；找不到时兜底 `{ type, position:"top" }`（`:81-84`）。
5. **映射到真实组件**：`SidebarColumn.astro:44-55` 的 `componentMap` 把字符串 `type` 映射到 import 进来的 `.astro` / `.svelte` 组件；`renderComponent()`（`:82-95`）用 `buildComponentProps()` 组装 props 后渲染。
6. **动画/样式**：`getAnimationDelay()`（`src/utils/widget-manager.ts:95-108`）优先用组件自带的 `animationDelay`，否则按 `defaultAnimation.baseDelay + index * increment`；`getComponentClass()`（`:115-144`）处理 `responsive.hidden` 的断点类名。
7. **运行期显隐**：`SideBar.astro` 的内联脚本用断点和 `shouldShowSidebar()` 动态设置 `--sidebar-<device>-display`，并在 swup 换页后重算。

一句话：**改 `components.left/right/drawer` 的数组内容与顺序**就能控制侧栏；改 `properties[].position` 控制 top/sticky。

---

## 七、i18n、banner/壁纸，以及不在 `config.ts` 里的配置

### i18n（`src/i18n/`）

三个文件：

- `src/i18n/i18nKey.ts:1` — `enum I18nKey`，键名即字符串（如 `home = "home"`），共 345 行。
- `src/i18n/languages/{en,zh_CN,zh_TW,ja}.ts` — 每种语言一个 `Translation` 对象，键是 `I18nKey`（`src/i18n/languages/zh_CN.ts:4-5`）。
- `src/i18n/translation.ts:12-24` — `map` 把语言码映射到字典；`i18n(key)` 读 `siteConfig.lang` 后查表（`:27-29`）。

**为什么类型系统有用**：`Translation = Record<I18nKey, string>`（`src/i18n/translation.ts:8`），少写一个键、或多写一个不存在的键，编译报错。

**你要改文案**：去 `src/i18n/languages/zh_CN.ts`（以及其它语言），**不是** `config.ts`。`siteConfig.lang` 只选语言。

### banner / 壁纸

- banner 图片配置在 `siteConfig.banner.src`（`src/config.ts:126-139`），指向的物理文件在 `public/assets/desktop-banner/` 和 `public/assets/mobile-banner/`。
- 全屏壁纸是**独立**的顶层 `fullscreenWallpaperConfig`（`src/config.ts:245-268`），别去 `siteConfig` 里找。
- 两者共用同一批图片路径，但轮播间隔不同（banner 3 秒 / 全屏 5 秒）。

### 其它不在 `config.ts` 的配置

- **umami 统计**：在 `astro.config.mjs:55-59` 的 `oddmisc({ umami: { shareUrl: false } })`，`src/config.ts:701` 结尾有注释说明。
- **站点级路由设定**：`astro.config.mjs:39-43` 用 `siteConfig.siteURL` 设 `site`，`base:"/"`、`trailingSlash:"always"`、`output:"static"`；`:45-52` 的 `redirects` 把旧起始页地址 `/start` 静态跳回 `/`。改路由/首页位置时必看这几行。
- **Markdown 渲染管线**（rehype/remark 插件）：`astro.config.mjs:164-220`；代码高亮主题在 `astro.config.mjs:109-155`。
- **`.env`**：`BILI_SESSDATA` 等凭证（见 `src/config.ts:83-84` 注释），以及内容同步用的 `ENABLE_CONTENT_SYNC` / `CONTENT_REPO_URL` / `CONTENT_DIR`（`scripts/sync-content.js:15-17`）。这些变量由 `scripts/load-env.js:10-29` 手工解析 `.env` 注入 `process.env`（`sync-content.js:5,11` 调用）。默认值：同步默认启用（`ENABLE_CONTENT_SYNC !== "false"`），`CONTENT_DIR` 默认 `<仓库根>/content`；若内容目录不存在且设了 `CONTENT_REPO_URL`，脚本会 `git clone` 它（`scripts/sync-content.js:32-54`），否则回退本地内容。

---

## 八、分层与构建期 / 运行期的分界

1. **分层**：`config.ts`（真源）→ `types/config.ts`（契约）→ `utils/*`（计算）→ `layouts/*`（布局）→ `pages/*`（路由）。
2. **构建期读配置**：frontmatter 里所有 `import { siteConfig } from "@/config"`，以及 `scripts/compress-fonts.js` 对 `config.ts` 的**正则解析**（见下）。
3. **运行期需要配置的地方**，目前有两条通道：
   - `define:vars` 把值内联成脚本变量。例子：`ConfigCarrier.astro:15-33` 把 `toc.enable/depth/useJapaneseBadge` 塞进 `window.siteConfig.toc`；`HeadTags.astro:105-111` 把 `DEFAULT_THEME`、`configHue`、`pageScaling` 内联。
   - **客户端脚本直接 import `config.ts`**：`src/scripts/swup-manager.ts:6` 引入 `widgetConfigs`，这个模块经 `Layout.astro:322-325` 打进浏览器 bundle 执行。所以配置的绝大多数值其实都随 bundle 到了运行期，只是没人用。
4. **`scripts/compress-fonts.js` 是构建期正则解析 `src/config.ts` 的**，它**不 import**，而是 `fs.readFileSync` + 正则匹配：`:12-19` 读 `SITE_LANG` 与 `font:` 块（`:19` 的正则要求 `font` 块以 `\n\t\},` 结束），`:47-48` 读 `localFonts`，`:358-359` 与 `:485-486` 分别用正则读 `featurePages` 判断番剧页是否启用。所以**改动 `config.ts` 的缩进或注释结构可能让正则失配**——「配置格式即接口」。

---

## 九、本项目特有约定与坑

1. **`predev`/`prebuild` 钩子会 git commit**：`package.json:8-9` 的 `predev`/`prebuild` 跑 `scripts/sync-content.js`，该脚本结尾执行 `git add .` + `git commit`（`scripts/sync-content.js:157-162`）。所以本地别用 `npm run build` / `npm run dev`。
2. **绕开钩子的代价**：`package.json:16` 的 `build` 实际链是 `node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js`。直接用 `npx astro build` 会跳过番剧数据更新、pagefind 搜索索引与字体子集后处理。
3. **只允许 pnpm 安装**：`package.json:24` 的 `preinstall: "npx only-allow pnpm"`。
4. **`/` 不是首页**：首页文章列表在 `/home/`（`HOME_PATH`），`/` 是起始页。
5. **`featurePages` 关掉 ≠ 404**：是生成一个跳 `/404/` 的空壳（`src/pages/diary.astro:12-14`、`nav-links.ts:29-31`）。
6. **`announcementConfig` 没有 `enable`**：公告显不显示由 `sidebarLayoutConfig.components` 决定。
7. **`components` 数组才决定顺序**，`properties` 只给元数据；两者不一致时兜底 `position:"top"`。
8. **`avatar` 的前导斜杠决定相对谁**：有 `/` 相对 `public/`，没有相对 `src/`（`src/config.ts:365`）。
9. **默认主题是夜间**：`DEFAULT_THEME = DARK_MODE`（`src/constants/constants.ts:20`），不是「跟随系统」。
10. **hue 是运行时可变的**：`localStorage.hue` 会覆盖 `config.ts` 的默认值（`HeadTags.astro:136`）；改配置后如果浏览器里存过旧值，看不到效果。
11. **改 `config.ts` 的格式可能弄坏构建**：`compress-fonts.js` 靠正则而非 import 读取它。
12. **`expressiveCodeConfig.theme` 不生效**，代码高亮主题在 `astro.config.mjs:110`。
13. **壁纸 / banner / umami / i18n 不都在 `config.ts`**，见第七节；导航栏渲染链路见第二节第 3 点（父项渲成 button）。

---

## 十、反直觉的点

- **`announcementConfig` 没有 `enable`**：公告显不显示由 `sidebarLayoutConfig.components` 决定（`src/types/config.ts:336`）。
- **导航里「关于我」「关于」指向的 `/content/`、「链接」指向的 `/links/` 都不存在**，但因为它们都带 `children`，渲染出来是 `<button>` 而不是 `<a>`，不会成为死链；只有起始页快捷入口会被 `isReachablePage()` 剔除。
- **类型里的 `credit.url?` 是可选的，但守卫只看 `credit.enable`**：`MainGridLayout.astro:152-154` 在 `hasBannerCredit`（等于 `credit.enable`）为真时直接 `href={siteConfig.banner.credit.url}`。当前 `enable:false`、`url:""` 所以没暴露；一旦开启 credit 却不填 url，会得到一个空 `href`。
- **配置注释与实际值有时打架**：`sakuraConfig.enable = true` 但注释写「默认关闭樱花特效」（`src/config.ts:623`）；`pioConfig.enable = true` 但注释写「禁用看板娘以提升性能」（`src/config.ts:651`）；`pageProgressBar.duration = 6000` 但类型注释写「默认 8000ms」（`src/config.ts:237` vs `src/types/config.ts:516`），而 `Layout.astro:233` 的兜底 `?? 8000` 又是一处 8000。以代码为准。
- **排序里 `priority` 只对置顶文章生效**（`src/utils/content-utils.ts:23-35`），非置顶文章之间不比较 priority。
- **平板端右栏是被丢弃、不是合并**：`widget-manager.ts:61-68` 只有在左栏为空时才会把右栏拿来用。

---

## 十一、openQuestions

以下都是读代码时发现的「注释/类型/代码不一致」，留待确认：

1. **`permalink` 到底支不支持斜杠**：`src/types/config.ts:272` 写「注意：不支持斜杠 "/"，所有生成的链接都在根目录下」，但 `src/config.ts:415` 写「支持使用斜杠 "/" 构建嵌套路径」并给了 `"%year%/%monthnum%/%day%/%postname%"` 的例子。实现侧 `generatePermalinkSlug()`（`src/utils/permalink-utils.ts:62-119`）只是做字符串替换、`getPermalinkPath()` 返回 `/${slug}/`（`:136-141`），路由是 `[...permalink]` rest 参数——斜杠应该可行。推测 `types/config.ts` 的注释过期。
2. **`lang` 联合类型与 i18n 字典不匹配**：`src/types/config.ts:43-53` 允许 `ko/es/th/vi/tr/id`，但 `src/i18n/translation.ts:12-21` 的 `map` 只有 8 个键——`en`、`en_us`、`en_gb`、`en_au`、`zh_cn`、`zh_tw`、`ja`、`ja_jp`（多出的四个是别名，都指向 `en` 或 `ja` 字典）。选 ko/es/th/vi/tr/id 会静默回退到英语（`translation.ts:24` 的 `map[lang.toLowerCase()] || defaultTranslation`），不报错。
3. **`banner.credit.url` 可选却直接使用**：见第十节第三条，开启 credit 而不填 url 会得到空 `href`。
4. **默认主题注释与运行时分支**：`src/constants/constants.ts:18` 注释说「从未选择过主题的访客默认使用夜间模式」，与 `DEFAULT_THEME = DARK_MODE` 一致；但 `setting-utils.ts:49-52` 的 `applyThemeToDocument` 在 `default` 分支用的是 `currentIsDark`（保持现状）。需要确认两处行为在所有调用路径上是否始终一致。
5. **`SiteStats.astro:22` 的兜底日期**：`siteConfig.siteStartDate || "2025-01-01"`，而 `config.ts:30` 填的是 `"2026-4-20"`；兜底值与实际值跨年，若哪天清空该字段，运行天数会突变。

---

## 相关文件

- `src/config.ts` — 全站配置真源，18 个顶层导出；本块的主对象。
- `src/types/config.ts` — 所有配置接口与 `LinkPreset` 枚举，配置的类型契约。
- `src/content.config.ts` — Astro 6 content layer，定义 `posts` / `spec` 两个集合与 frontmatter schema。
- `src/constants/constants.ts` — `PAGE_SIZE`、`HOME_PATH`、`DEFAULT_THEME`、banner/页面尺寸等跨模块常量。
- `src/constants/icon.ts` — 默认 favicon 列表。
- `src/constants/link-presets.ts` — `LinkPreset` 枚举到导航链接的映射表。
- `src/i18n/i18nKey.ts` — 所有可翻译文案的键枚举。
- `src/i18n/translation.ts` — 语言码到字典的映射与 `i18n()` 函数。
- `src/i18n/languages/*.ts` — 四份语言字典（en / zh_CN / zh_TW / ja）。
- `src/utils/setting-utils.ts` — 主题色相、明暗主题、壁纸模式的读写（localStorage + CSS 变量）。
- `src/utils/widget-manager.ts` — 侧栏组件管理器，`sidebarLayoutConfig` 的消费核心。
- `src/utils/widget-renderer.ts` — 组装侧栏组件的 props（`buildComponentProps`）。
- `src/utils/grid-layout-utils.ts` — 依据侧栏存在性算栅格、取 banner 图、算主面板位置。
- `src/utils/content-utils.ts` — `posts` 集合的读取、排序、标签/分类/相关文章计算。
- `src/utils/permalink-utils.ts` — `permalinkConfig` 的占位符替换实现。
- `src/utils/timeFormat.ts` — 用 `siteConfig.timeZone` 格式化相对时间。
- `src/layouts/Layout.astro` — 读 `siteConfig` 拼 head、字体、进度条、挂载 swup 客户端脚本。
- `src/layouts/partials/HeadTags.astro` — SEO meta、keywords、favicon、首帧 `--hue` 与自动缩放脚本。
- `src/layouts/partials/AnalyticsScripts.astro` — `thirdPartyAnalytics`（Clarity）与 GTM 的延迟加载。
- `src/layouts/MainGridLayout.astro` — 栅格/banner/侧栏的装配处。
- `src/components/misc/ConfigCarrier.astro` — 把 hue、TOC 与代码块过渡配置暴露给运行期脚本。
- `src/components/layout/SidebarColumn.astro` — 侧栏组件的实际渲染器（type → 组件映射）。
- `src/components/features/settings/DisplaySettings.svelte` — 主题色相滑杆，写回 `--hue`。
- `src/components/organisms/navigation/Navbar.astro` — 消费 `navBarConfig`、`navbarTitle`、`themeColor.fixed`。
- `src/components/organisms/navigation/DropdownMenu.astro` / `NavMenuPanel.astro` — 桌面/移动导航渲染，父项有 children 时渲成按钮。
- `src/components/features/landing/nav-links.ts` — 起始页从 `navBarConfig` + `featurePages` 推导快捷入口，并过滤不可达页面。
- `src/styles/variables.styl` — `--hue` 派生出的全部 CSS 变量。
- `src/pages/home/[...page].astro` — 消费 `PAGE_SIZE` 与 `postListLayout.categoryBar`。
- `src/pages/posts/[...slug].astro` — 消费 `relatedPostsConfig` / `randomPostsConfig` / `commentConfig` 等。
- `src/pages/about.astro` / `src/pages/friends.astro` — 消费 `spec` 集合。
- `src/pages/diary.astro` — 展示 `featurePages` 守卫的写法。
- `src/scripts/swup-manager.ts` — 运行期直接 import `widgetConfigs` 的客户端入口。
- `scripts/compress-fonts.js` — 构建期正则读取 `config.ts` 的字体/语言/featurePages 配置。
- `scripts/sync-content.js` — predev/prebuild 钩子调用的内容同步脚本（会 git commit）。
- `scripts/load-env.js` — 手工解析 `.env` 注入 `process.env`。
- `astro.config.mjs` — `siteURL`、redirects、umami、swup、Markdown 管线；部分配置不在 `config.ts`。
- `package.json` — 定义 `predev`/`prebuild` 钩子与 `check`、`build` 等脚本。
