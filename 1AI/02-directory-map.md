# 02 · 目录地图

这一块是一张「东西在哪」的地图，翻代码之前先看这一页能省掉大量 `ls` 和 `find`。

之所以单独成篇：这个仓库的目录名一半靠约定、一半靠历史，只看名字猜不准 —— `src/scripts` 和 `src/utils` 都像「工具」，实际一个跑在浏览器、一个主要跑在构建期；`content/` 也不是 `src/content` 的同义词，而是被 `.gitignore` 忽略的另一个 Git 仓库克隆。

读者在以下几个场景需要翻它：新写一个组件不知道放哪一层、想找某条 URL 对应哪个文件、想知道某个目录是不是生成物可以忽略、或者照 `docs/rule/` 的目录树找文件却找不到。全篇的行号都指向当前工作区实际的源码位置。

---

## 一、开跑之前：两个会静默提交改动的钩子

这个仓库有 npm 生命周期钩子会在你毫不知情时改动 Git 历史，先记住再动手：

- `package.json:8` 的 `predev` 与 `package.json:9` 的 `prebuild` 都会执行 `node scripts/sync-content.js`。该脚本结尾在 `scripts/sync-content.js:157-161` 执行 `git add .` 加 `git commit -m "chore(content): sync …"`，会把工作区**所有**改动一并提交。
- 因此不要运行 `npm run dev`、`npm run build`、`pnpm dev`、`pnpm build`、`pnpm start`。需要类型检查或构建时绕过 npm 脚本直接调用：`npx astro check`、`npx astro build`。
- 想确认某个 npm 脚本到底做什么，读 `package.json` 与 `scripts/` 下的源文件，不要跑它。

生成物判定速记：**`dist/`、`.astro/`、`node_modules/`、`content/` 一律不用读**；`content/` 尤其危险，它是另一份完整仓库的快照。

---

## 二、仓库根目录

`Z:/AAA/Web/Mizuki-MLFK` 下逐项展开：

| 目录 / 文件 | 职责 | 备注 |
| --- | --- | --- |
| `src/` | 全部源代码（页面、组件、样式、工具） | 唯一手改的代码目录 |
| `public/` | 原样拷贝到站点根的静态文件 | `public/pio/`（看板娘模型）、`public/assets/`、`public/js/`（页面级脚本）、`public/images/`、`public/favicon/` |
| `scripts/` | 构建/运维用的 Node 脚本 | 详见第三节 |
| `docs/` | 项目自带文档 | `docs/rule/` 是开发规范；`docs/editor/`、`docs/image/` 是素材；根级还有内容分离与部署说明 |
| `content/` | **独立模式下的内容仓库克隆** | 一个完整的 Git 仓库（内含自己的 `.git`），被 `.gitignore:23` 忽略 |
| `dist/` | **生成物，可忽略** | `npx astro build` 的产物，`.gitignore:2` |
| `.astro/` | **生成物，可忽略** | Astro 生成的类型，`.gitignore:5` |
| `node_modules/` | **生成物，可忽略** | `.gitignore:10` |
| `demo/` `plans/` | **可忽略** | 被 `.gitignore:6-7` 忽略，本地不存在也不影响构建 |
| `.github/` | GitHub Actions 与 Issue/PR 模板 | `workflows/` 下 4 个：`CI.yml`、`build.yml`、`deploy.yml`、`lint.yml` |
| `.vscode/` `.devin/` | 编辑器与 AI 助手配置 | 不影响构建 |
| `1AI/` | 本系列笔记的落点目录 | 不在任何构建流程里 |
| `astro.config.mjs` | Astro 主配置 | `defineConfig` 从 `astro.config.mjs:38` 开始 |
| `tsconfig.json` | TS 配置与路径别名 | 别名见 `tsconfig.json:17-25` |
| `src/config.ts` | **站点内容配置的单一真源**（标题、导航、开关…） | `featurePages` 在 `src/config.ts:42` |
| `_frontmatter.json` | 文章 frontmatter 的 schema 提示 | 编辑器用，非运行时 |
| `package.json` | 依赖与脚本 | `packageManager` 锁死 pnpm |
| `pagefind.yml` | Pagefind 搜索索引的排除选择器 | 构建期产物落进 `dist/` |
| `pnpm-workspace.yaml` | pnpm 依赖构建白名单 | 只放行了 `@parcel/watcher`、`esbuild`、`sharp`、`swup`、`ttf2woff2` |
| `svelte.config.js` | Svelte 预处理配置 | `vitePreprocess({ script: true })` |
| `postcss.config.mjs` | PostCSS 插件 | `postcss-import`、`postcss-nesting` |
| `eslint.config.js` / `.prettierrc` / `.prettierignore` | Lint 与格式化配置 | `format`、`lint` 脚本读它们 |
| `vercel.json` | Vercel 部署与安全响应头 | `buildCommand` 是 `pnpm build` |
| `.npmrc` | npm/pnpm 行为 | 仅 `manage-package-manager-versions = true` |
| `.env` / `.env.example` | 环境变量 | 内容同步、IndexNow、Bilibili 凭据，见第三节 |
| `LICENSE` / `LICENSE.MIT` | 许可证 | —— |
| `README.md` 及 `.zh` `.ja` `.tw` 版本 | 项目说明 | 多语言各一份 |
| `.gitignore` | 忽略规则 | 生成物与内容仓库都在里面 |

---

## 三、`scripts/` 与构建流水线

`scripts/` 里是构建与运维脚本，`package.json` 的 scripts 段调它们：

| 脚本 | 用途 | 触发方式 |
| --- | --- | --- |
| `scripts/sync-content.js` | 同步内容仓库、并静默提交主仓库 | `predev`/`prebuild` 钩子，见第一节 |
| `scripts/init-content-repo.js` | 初始化内容分离模式（问答式克隆内容仓库、写 `.env`） | `package.json:7` 的 `init-content` |
| `scripts/update-anime.mjs` | 拉取番剧数据 | `build` 链首 |
| `scripts/update-bangumi.mjs` / `scripts/update-bilibili.mjs` | 拉取 Bangumi / B站观看进度 | `update-bangumi` / `update-bilibili` |
| `scripts/compress-fonts.js` | 字体子集化（fontmin） | `build` 链尾 |
| `scripts/convert-images.js` | 图片格式转换 | 手动 |
| `scripts/new-post.js` | 新建文章脚手架 | `new-post` |
| `scripts/indexnow-submit.js` | 向 IndexNow 提交 URL 更新 | `submit` |
| `scripts/load-env.js` | 读取 `.env` 的公共工具 | 被上面若干脚本 import |

构建链在 `package.json:16`：

```
node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

也就是「先更新番剧数据 → Astro 构建 → Pagefind 为 `dist/` 建搜索索引 → 压缩字体」。`pagefind.yml` 控制索引时要排除的选择器（`.katex`、`[data-pagefind-ignore]`、搜索面板本身等）。

内容分离模式的配套：来源是 `content/`（一个独立 Git 仓库的克隆，被 `.gitignore:23` 忽略），开关在 `.env` 的 `ENABLE_CONTENT_SYNC`、`CONTENT_REPO_URL`、`CONTENT_DIR`，说明文档是 `docs/CONTENT_REPOSITORY.md`、`docs/CONTENT_SEPARATION.md`、`docs/MIGRATION_GUIDE.md`。**不启用内容分离时站点读的是 `src/content/`**；启用后很多脚本从 `content/` 取文章。

---

## 四、`src/` 一览

`src/` 下每个子目录的职责，以及「它跑在哪个阶段」：

| 目录 | 一句话职责 | 阶段 |
| --- | --- | --- |
| `src/pages/` | 路由：文件名即 URL | 构建期（SSG） |
| `src/layouts/` | 页面骨架：`Layout.astro`（全站外壳）、`MainGridLayout.astro`（内容+侧栏栅格）、`partials/`（`HeadTags`、`AnalyticsScripts`、`GridScripts`） | 构建期 |
| `src/components/` | 组件库，体量最大（259 个文件） | 见第五节 |
| `src/assets/` | 会被 Astro 处理的源图片（`src/assets/images/`） | 构建期 |
| `src/constants/` | 常量：`constants.ts`（`HOME_PATH`、`PAGE_SIZE`…）、`icon.ts`、`link-presets.ts` | 构建期 + 运行期 |
| `src/content/` | **Astro 内容集合**：`posts/`（文章 Markdown）、`spec/`（about、friends） | 构建期 |
| `src/data/` | 手写静态数据：`friends.ts`、`projects.ts`、`skills.ts`、`devices.ts`、`diary.ts`、`timeline.ts`、`anime.ts` | 构建期 |
| `src/i18n/` | 国际化：`i18nKey.ts`、`translation.ts`、`languages/{zh_CN,zh_TW,en,ja}.ts` | 构建期 + 运行期 |
| `src/plugins/` | 自定义 remark/rehype 插件与 expressive-code 扩展 | 构建期 |
| `src/scripts/` | **浏览器运行时**脚本（swup、特效、交互 handler、起始页逻辑） | 运行期 |
| `src/stores/` | Svelte store，目前只有 `musicPlayerStore.ts` | 运行期 |
| `src/styles/` | 全局 CSS：`main.css`、`toc.css`、`anime.css`、`landing/landing.css`、`variables.styl`、`markdown-extend.styl` 等 | 构建期打包 |
| `src/types/` | 类型：`config.ts`（配置类型总表）、`album.ts`、`crypto-js.d.ts` | 编译期 |
| `src/utils/` | 工具函数，**构建期与运行期混用**，24 个文件 | 混合，见第七节 |

注意：**没有 `src/features/`**，虽然有 `src/components/features/`。找功能组件别在 `src/` 顶层找。

`src/` 根还有 5 个非目录文件，别漏看 `FooterConfig.html`：

| 文件 | 作用 |
| --- | --- |
| `src/config.ts` | 站点配置真源 |
| `src/content.config.ts` | 内容集合 schema |
| `src/global.d.ts` / `src/env.d.ts` | 类型声明 |
| `src/FooterConfig.html` | 页脚配置片段（非路由页面） |

### 4.1 `src/content/` 与 `src/data/`

- 集合定义在 `src/content.config.ts`：`posts` 用 glob 收 `src/content/posts/**/*.{md,mdx}`（`src/content.config.ts:6`），`spec` 收 `src/content/spec/**`（`src/content.config.ts:44`），schema 在 `src/content.config.ts:7-41` 定义（含 `permalink`、`alias`、加密字段）。
- `src/content/posts/` 下**还有子目录**：`VRCTool/index.md`、`guide/index.md`（含图片）、`video_ZB/index.md`，以及根级的 `video.md`。文章 id 会带目录前缀，直接影响 slug 与 permalink 推导。
- `src/content/spec/` 只有 `about.md` 与 `friends.md`。
- `src/data/` 是手写数据；`bangumi-data.json`、`bilibili-data.json` 是脚本生成的，被 `.gitignore:49,52` 忽略。

### 4.2 `src/plugins/` 里到底有哪些插件

`astro.config.mjs:164-220` 注册了它们：

| 文件 | 作用 |
| --- | --- |
| `src/plugins/remark-content.mjs` | 计算字数/阅读时长等 frontmatter |
| `src/plugins/remark-fix-github-admonitions.js` | 修正 GitHub 风格告示块 |
| `src/plugins/remark-directive-rehype.js` | 解析 `directive` 语法 |
| `src/plugins/remark-mermaid.js` | Mermaid 预处理 |
| `src/plugins/rehype-component-admonition.mjs` | 渲染 note/tip/warning 等告示组件 |
| `src/plugins/rehype-component-github-card.mjs` | 渲染 GitHub 仓库卡片 |
| `src/plugins/rehype-wrap-table.mjs` | 给表格套滚动容器 |
| `src/plugins/rehype-image-width.mjs` | 处理图片宽度 |
| `src/plugins/rehype-mermaid.mjs` | Mermaid 转 HTML |
| `src/plugins/mermaid-render-script.js` | 随页面下发的 Mermaid 渲染脚本 |
| `src/plugins/expressive-code/custom-copy-button.ts` | 代码块复制按钮 |
| `src/plugins/expressive-code/language-badge.ts` | 代码块语言角标 |

---

## 五、`src/components/` 分层

这是项目体量最大的地方，259 个文件（含各层 `index.ts`）。分层与文件数：

| 层 | 文件数 | 定位 |
| --- | --- | --- |
| `atoms/` | 34 | 通用原子件，不可再分 |
| `comment/` | 4 | 评论（Giscus / Twikoo），**挂在根层**而非 features |
| `common/` | 1 | 只剩 `FloatingButton.astro`，几乎空壳 |
| `control/` | 14 | 浮动控件：回顶、主题/布局切换、分页、进度条、音乐悬浮按钮 |
| `features/` | 106 | 按业务域切分的功能块 |
| `layout/` | 4 | 布局零件：`Banner`、`RightSideBar`、`SidebarColumn` |
| `misc/` | 14 | 跨页面杂项：`Markdown`、`License`、`FullscreenWallpaper`、海报渲染 |
| `organisms/` | 8 | `navigation/`（Navbar、Search、下拉菜单）与 `footer/` |
| `widgets/` | 73 | 侧栏与独立小部件，含重型子模块 |

### 5.1 atoms —— 通用原子件

每个组件一个目录，多数目录内含 `Xxx.astro|svelte` + `index.ts`（barrel），**但不是每个都有 `types.ts`**：`src/components/atoms/filter-tabs/` 只有 `FilterTabs.astro` 与 `index.ts`；`src/components/atoms/Icon/` 除三件套外还多一个 `LocalIcon.svelte`。

目录名两种风格并存（历史原因）：

- PascalCase：`Badge/`、`Button/`、`Chip/`、`Icon/`、`Image/`、`Link/`、`Loader/`
- kebab-case：`custom-scrollbar/`、`filter-tabs/`、`tag-chip/`、`typewriter-text/`

`src/components/atoms/index.ts` 用 `export *` 重导出这 11 个子目录。

### 5.2 control —— 浮动控件

`control/` 在规范文档里没有独立成层，但代码里确实是一层。放的是「跨页面悬浮/全局交互」的控件：`BackToTop.astro`、`BackToHome.astro`、`FloatingControls.astro`（聚合容器）、`FloatingTOC.astro`、`ThemeSwitch.svelte`、`LayoutSwitch.svelte`、`Pagination.astro`、`PageProgressBar/`（自带 `page-progress-bar.css`）、`ButtonLink.astro`、`ButtonTag.astro`、`MusicFabButton.svelte`。

判断标准是「这不是某条业务的数据展示，而是一个全局可点的浮层控件」。项目注释反复强调这些控件要「常驻」：`src/scripts/core/swup-config.ts:22-27` 的 `persistElements` 把 `#navbar-wrapper`、`#sidebar`、`.music-player`、`#pio-container` 列为 swup 换页时不重建的元素，浮动控件同理。

### 5.3 features —— 按业务域切分

`features/` 下每个子目录 = 一个业务域：

`albums`、`anime`、`archive`、`auth`、`devices`、`diary`、`featured-projects`、`friends`、`landing`、`page-header`、`pio`、`posts`、`projects`、`projects-category`、`section-title`、`settings`、`skills`、`stats`、`stats-grid`、`tech-stack`、`timeline`、`toc`

几个值得单独记住的：

- `posts/` 是最大的业务域，内部再分层：`atoms/`（`Category`、`PublishedDate`、`ReadingTime`、`WordCount`、`EncryptedBadge`）+ 卡片/列表/元信息/导航/相关文章。它的 `index.ts` 是具名重导出，见 `src/components/features/posts/index.ts:1`。
- `toc/` 是唯一带 `hooks/` 的 feature：`hooks/`（`useFloatingTOC`、`useMobileTOC`、`useTocHighlight`、`useTocNavigation`、`useTocScroll`）+ `utils/` + `components/`。它的 barrel 注释明确写了「Svelte 组件请从原始位置导入」，见 `src/components/features/toc/index.ts:5`。
- `auth/` 含 `utils/`（`decryption.ts`、`password-utils.ts`、`validation.ts`）与 `types/`。
- `landing/` 是起始页专用（`LandingHero`、`LandingBento`、`LandingSplash`、`LandingScene`、`LandingFooter`、`nav-links.ts`），**没有 `index.ts` barrel**，且 `nav-links.ts` 依赖 `node:fs`，只能构建期跑（`src/components/features/landing/nav-links.ts:1`）。

### 5.4 widgets —— 侧栏与独立小部件

13 个子目录：`announcement`、`calendar`、`card-toc`、`categories`、`common`、`feed`、`music-player`、`music-sidebar`、`profile`、`sidebar`、`site-stats`、`tags`、`toc`。

四个重型子模块：

- `widgets/music-player/`（27 文件）：`atoms/`（10 个 Svelte：`CoverImage`、`ModeButton`、`NextButton`、`PlayButton`、`PlaylistItem`、`PrevButton`、`ProgressBar`、`TrackInfo`、`VolumeButton`、`VolumeSlider`）+ `molecules/`（4 个：`PlayerControls`、`ProgressControl`、`TrackDisplay`、`VolumeControl`）+ `organisms/`（`MiniPlayer`、`PlayerBar`、`Playlist`）+ `hooks/`（5 个）+ `constants.ts`。**这里是全仓库唯一真的按 atoms/molecules/organisms 三层拆开的地方**。
- `widgets/calendar/`（14 文件）：`components/`（6 个 Svelte）+ `hooks/` + `utils/` + `types/`。
- `widgets/music-sidebar/`（11 文件）：`components/` 6 个文件 —— `SidebarControls`、`SidebarCover`、`SidebarPlaylist`、`SidebarProgress`、`SidebarTrackInfo`，以及第 6 个不叫 `Sidebar*` 的 `TrackListItem.svelte`；另有 `hooks/`。
- `widgets/common/`（4 文件）：`WidgetLayout.astro`、`WidgetHeader.svelte`、`AccordionDrawer.svelte`、`index.ts` —— 所有侧栏 widget 的公共外壳。

侧栏 widget 的接入有专门规范：`docs/rule/06-sidebar-widget-dev.md` 要求三步缺一不可 —— 声明 `WidgetComponentType`、配置 `sidebarLayoutConfig`、在组件映射表注册。映射表在 `src/utils/widget-manager.ts:11`。

### 5.5 misc —— 跨页面杂项

`Markdown.astro`、`License.astro`、`FullscreenWallpaper.astro` 之外，还有 `AnimationTest.astro`、`ConfigCarrier.astro`、`Icon.astro`、`IconifyLoader.astro`、`ListContainer.astro`、`ListDivider.astro`、`SharePoster.svelte`。海报渲染另有两个子目录：`poster/`（`PosterCanvas.ts`、`theme-utils.ts`）与 `utils/`（`poster-renderer.ts`）。

### 5.6 各层职责一句话

- `layout/`：只负责排版结构 —— `Banner.astro`、`RightSideBar.astro`、`SidebarColumn.astro`。
- `comment/`：`Giscus.astro`、`Twikoo.astro`、`index.astro`（包装器）、`index.ts`。
- `organisms/`：全站级「有机体」——`navigation/`（`Navbar`、`Search.svelte`、`DropdownMenu`、`NavMenuPanel`、`types.ts`）与 `footer/`。

### 5.7 「我新写一个 X，放哪层？」

| 我要写的东西 | 放哪 | 理由 |
| --- | --- | --- |
| 纯 UI 基础件（按钮/徽章/图标/图片/链接/加载器） | `atoms/<Name>/` | 无业务逻辑、可跨页面复用，带 `index.ts` |
| 某个业务域的数据展示块（文章卡、相册卡、技能卡、TOC 项） | `features/<域>/` | 与具体业务数据绑定 |
| 全局浮层控件（回顶、主题切换、阅读进度） | `control/` | 跨页面、常驻、可交互 |
| 侧栏里的一个小部件（简介、分类、标签、日历） | `widgets/<名>/` | 受 `sidebarLayoutConfig` 调度 |
| 布局骨架零件（Banner、侧栏列、右侧栏容器） | `layout/` | 只负责排版结构 |
| 跨页面通用容器/渲染器（Markdown、License、壁纸） | `misc/` | 不属于任何业务域 |
| 导航栏 / 页脚 | `organisms/navigation|footer/` | 全站级有机体 |
| 评论组件 | `comment/` | 目前独立在根层 |

规范文档 `docs/rule/05-atom-component-usage.md` 给出的分层是 `atoms → features → organisms → widgets → misc`，**以它为准**；它没有提 `control/`、`layout/`、`common/`、`comment/` 四层，但代码里它们确实存在。

### 5.8 规范文档与实际代码的偏差

`docs/rule/03-file-organization-architecture.md` 的目录树已经和代码脱节，照它找文件会扑空：

- 文档在 `docs/rule/03-file-organization-architecture.md:49,75,98,301` 反复画 `molecules/` 层，但 `src/components/` 下**根本没有 `molecules` 目录**；`docs/rule/01-component-architecture.md` 同样大量使用 `molecules`。
- 文档把 `comment/` 画在 `features/` 下，实际在 `src/components/comment/`。
- 文档并非完全没提 `control/` 与 `common/`：`docs/rule/03-file-organization-architecture.md:131,383` 列了 `common/`，`:354,1026` 有 `controls/` 模板，`:1226` 甚至有 `mv src/components/control src/components/molecules/` 的迁移脚本 —— 它主张把 control 迁进 molecules，而代码里并没有迁。真正完全没被提及的只有 `src/components/layout/`。

结论：找文件以本文与实际代码为准，`docs/rule/` 只作规范意图参考。

---

## 六、`src/pages/` 路由表

`output: "static"`（`astro.config.mjs:43`）、`trailingSlash: "always"`（`astro.config.mjs:41`），所有页面在构建期预渲染。文件名 → URL：

| 文件 | URL | 说明 |
| --- | --- | --- |
| `index.astro` | `/` | **起始页**（开屏动画 + 「进入」按钮），不是文章列表 |
| `home/[...page].astro` | `/home/`、`/home/2/`… | **文章分页列表**，用 `paginate()`（`src/pages/home/[...page].astro:27`） |
| `posts/[...slug].astro` | `/posts/<slug>/` | 文章详情（默认路径） |
| `[...permalink].astro` | `/<permalink>/` | 根级 permalink 文章，见第七节 |
| `albums.astro` | `/albums/` | 相册列表 |
| `albums/[id]/index.astro` | `/albums/<id>/` | 相册详情，`getStaticPaths` 来自 `scanAlbums()` |
| `anime.astro` | `/anime/` | 番剧页（`featurePages.anime=false` 时跳转 404，`src/pages/anime.astro:18-20`） |
| `archive.astro` | `/archive/` | 归档 |
| `diary.astro` | `/diary/` | 日记 |
| `friends.astro` | `/friends/` | 友链 |
| `projects.astro` | `/projects/` | 项目 |
| `skills.astro` | `/skills/` | 技能 |
| `timeline.astro` | `/timeline/` | 时间线 |
| `devices.astro` | `/devices/` | 设备 |
| `about.astro` | `/about/` | 关于，内容来自 `spec` 集合 |
| `atom.astro` | `/atom/` | Atom 订阅说明页 |
| `rss.astro` | `/rss/` | RSS 订阅说明页 |
| `zyj/index.astro` | `/zyj/` | 彩蛋页：通过 IP 显示归属地 |
| `404.astro` | 404 页 | 特殊：不限路由 |
| `api/allPostMeta.json.ts` | `/api/allPostMeta.json` | 全部文章元数据 JSON |
| `api/calendar-data.json.ts` | `/api/calendar-data.json` | 日历组件用的文章日期 JSON |
| `og/[...slug].png.ts` | `/og/<slug>.png` | 动态 OG 图，用 satori + sharp 生成 |
| `rss.xml.ts` | `/rss.xml` | RSS feed |
| `atom.xml.ts` | `/atom.xml` | Atom feed |
| `robots.txt.ts` | `/robots.txt` | robots |

几个容易踩的点：

- **`index.astro` 与 `home/[...page].astro` 分工**：`/` 现在是起始页，文章列表挪到 `/home/`。判断「是否首页」必须用 `HOME_PATH` 常量（`src/constants/constants.ts:14`），`src/constants/constants.ts:10-12` 的注释明确警告「写死的 `"/"` 现在指的是起始页，语义完全变了」。`astro.config.mjs:50-52` 给老书签 `/start` 留了一条静态 redirect。
- **`featurePages` 开关关掉页面不会变成 404**，而是照常构建成一个 `meta refresh` 跳 `/404/` 的空壳（URL 仍返回 200）。仓库自己的注释写明了这点：`src/components/features/landing/nav-links.ts:29-31`「被 featurePages 关掉的页面**不会**变成 404……实测 /projects/index.html 只有 291 字节」。所以「页面文件存在 ≠ 能访问」，要查开关 `src/config.ts:42`。
- **`pages/api/` 的 JSON 接口**：静态模式下同样预渲染成静态 `.json` 文件，不是运行时接口（`src/pages/api/allPostMeta.json.ts:3`）。
- **`pages/og/`**：`src/pages/og/[...slug].png.ts:22` 设了 `export const prerender = true`，`getStaticPaths` 遍历所有非草稿文章；`siteConfig.generateOgImages` 关掉时返回空数组（`src/pages/og/[...slug].png.ts:24-30`）。

---

## 七、permalink 机制（`[...permalink].astro`）

一篇文章的 URL 可能有两套：

1. **默认路径**：`/posts/<slug>/`，由 `posts/[...slug].astro` 提供，`slug` 是去掉扩展名的文件路径。
2. **根级 permalink**：由根目录的 catch-all `[...permalink].astro` 提供，来源两种 —— 文章 frontmatter 里的 `permalink:`（优先级最高），或全局开关 `permalinkConfig.enable` 打开后按 `format` 模板生成。

关键实现：

- `src/utils/permalink-utils.ts:14` 的 `initPostIdMap()` 把所有传入的文章按发布时间**升序**编号（最早 = 1），供 `%post_id%` 占位符使用（替换发生在 `src/utils/permalink-utils.ts:113`）。它是**有缓存的模块级单例**（`postIdMap` 变量，判空在 `src/utils/permalink-utils.ts:17-19`）。函数本身不过滤草稿，靠调用方传入非草稿集合。
- 调用方共 6 处：`home/[...page].astro`（:26，经首页分页）、`posts/[...slug].astro`（:39）、`[...permalink].astro`（:44）、`rss.xml.ts`（:33）、`atom.xml.ts`（:32），以及构建期工具内部 `src/utils/content-utils.ts:68`（`getSortedPosts` 的包装）与 `src/utils/post-url.ts:8`。**OG 图不调用它** —— `src/pages/og/[...slug].png.ts` 只用 `removeFileExtension(post.id)` 生成 slug，与 `%post_id%` 无关。
- `src/utils/permalink-utils.ts:62` 的 `generatePermalinkSlug()` 按「自定义 permalink → 全局模板 → alias → 文件名」的优先级生成 slug。
- 为了兼容旧链接，即便启用了 permalink，`src/pages/posts/[...slug].astro:52-75` 的每条分支仍会**额外**保留默认 `/posts/<slug>/` 路径（`:64` 注释即为此意）。所以同一篇文章可能同时有两个可访问 URL。

`permalinkConfig` 定义在 `src/config.ts:393`，默认 `enable: false`（`src/config.ts:394`），当前 `format` 是 `"%postname%"`。

---

## 八、`src/scripts` 与 `src/utils` 的分工

两者都像「工具函数」，但边界清晰：

| | `src/scripts/` | `src/utils/` |
| --- | --- | --- |
| 运行阶段 | **浏览器运行时** | **构建期为主，少量运行期** |
| 文件数 | 16（含子目录） | 24（顶层 23 + `types/widget.ts`） |
| 典型代表 | `swup-manager.ts`、`core/swup-hooks.ts`、`effects/sakura-effect.ts`、`landing/index.ts` | `content-utils.ts`、`permalink-utils.ts`、`url-utils.ts`、`widget-manager.ts` |

`src/scripts/` 的子目录分工：

- `core/`：`swup-config.ts`（选择器、持久化元素、动画/主题常量）、`swup-hooks.ts`（生命周期钩子）。
- `effects/`：`sakura-effect.ts`（樱花）、`transition-effect.ts`（过渡）。
- `handlers/`：`back-to-top-handler.ts`、`fancybox-handler.ts`、`panel-handler.ts`、`scroll-handler.ts`。
- `landing/`：起始页客户端运行时。
- 顶层还有 `swup-manager.ts`（总入口）、`anime-filter-handler.ts`、`anime-layout-handler.ts`、`post-lastmodified.ts`、`code-collapse.js`、`right-sidebar-layout.js`、`theme-optimizer.js`。

判断依据是**能不能 import `astro:content` / `node:*`**：

- `src/utils/` 里恰好 4 个文件依赖 `astro:content`：`content-utils.ts`（`src/utils/content-utils.ts:5`）、`url-utils.ts`、`post-url.ts`、`permalink-utils.ts` —— 这些**只能在构建期用**，进了浏览器 bundle 会炸。
- `src/utils/` 里也有纯浏览器工具：`navigation-utils.ts`（用 `window`）、`tocManager.ts`、`sakura-manager.ts`、`panel-manager.ts`、`setting-utils.ts` 都直接操作 `window`/`document`。

所以 `src/utils` 是**混合层**，使用前要看它 import 了什么。反过来 `src/scripts/` 会反向依赖 `src/utils` 里的浏览器侧工具 —— 例如 `src/scripts/swup-manager.ts:7` 引 `navigation-utils` 的 `initLinkPreloading`，`src/scripts/core/swup-hooks.ts:7` 引 `url-utils` 的 `pathsEqual`，`src/scripts/effects/sakura-effect.ts:7` 引 `sakura-manager`。

`src/scripts/core/swup-config.ts` 是 swup 配置真源之一，注意它在 `src/scripts/core/swup-config.ts:6` `import { DEFAULT_THEME } from "@constants/constants"`，同时在 `src/scripts/core/swup-config.ts:9-11` 又定义了一遍 banner 高度常量，而 `src/constants/constants.ts:22-25` 也有一份 —— 两处重复。

---

## 九、命名约定与 barrel

### 目录 / 文件命名

- **组件文件本身一律 PascalCase**：`Button.astro`、`MusicPlayer.svelte`、`PostCard.astro`。
- **组件目录名两种风格并存**（历史原因）：
  - `atoms/` 下新旧混用：`Badge/`（Pascal）对 `custom-scrollbar/`（kebab）。
  - `features/`、`widgets/` 的子域**全部 kebab-case**：`page-header`、`music-player`、`card-toc`。
  - 规范文档 `docs/rule/03-file-organization-architecture.md` 只规定了文件用 PascalCase，没有约束目录大小写。
- **工具文件**用 `[功能]-utils.ts`，**类型文件**用 `[主题].ts`。

### barrel（`index.ts`）的作用

每个组件目录有一个 `index.ts`，把该目录的组件与类型统一重导出，调用方因此可以写 `import { PostCard } from "@components/features/posts"` 而非全路径。两种写法都能在代码里看到：

```ts
// src/components/features/posts/index.ts:1-2
export { default as LastModified } from "./LastModified.astro";
export { default as PostCard } from "./PostCard.astro";
```

顶层 `src/components/index.ts` 再做一次聚合：`export * from "./atoms"`（`src/components/index.ts:2`）、只挑出 8 个 feature（`src/components/index.ts:5-12`）、organisms（`:15-16`）、11 个 widget（`:19-30`，文件共 30 行）。注意它**并未聚合全部 features** —— albums/anime/archive/auth 等没有导出。

barrel 不追求全覆盖，两点要记住：

- `features/landing/` 压根没有 `index.ts`。
- `src/components/features/toc/index.ts:5` 明确注释「Svelte 组件（MobileTOC）请从原始位置导入」，只重导出 Astro 组件（`:9-15`）；但它**并非只导出组件** —— `:18-25` 还导出类型，`:28` 起还导出工具函数与 hooks。

---

## 十、反直觉点清单

新人最容易踩的：

1. **`/` 不是文章列表**。`/` 是起始页，文章列表在 `/home/`；判断首页用 `HOME_PATH`（`src/constants/constants.ts:14`）。
2. **`content/` 是另一个 Git 仓库**，不是 `src/content/` 的简写。它被 `.gitignore:23` 忽略，是内容分离模式下拉下来的整站克隆。
3. **`src/content/` 才是文章源**，集合定义在 `src/content.config.ts`：`posts` 收 `src/content/posts/**` 的 md/mdx，`spec` 收 `src/content/spec/**`（about、friends）。
4. **`src/utils` 不全是运行时工具**，4 个文件依赖 `astro:content`，浏览器里用不了。
5. **一篇文章可能有两个 URL**（`/posts/<slug>/` 与根级 permalink），见第七节。
6. **`featurePages` 关掉页面不是 404，而是跳 `/404/` 的空壳**，页面文件存在 ≠ 能访问，见第六节。
7. **`docs/rule/` 的目录树与代码不符**：文档里的 `molecules/` 层在 `src/components/` 下不存在；`comment/` 的位置、`control/`/`layout/` 的存在都与文档对不上，见 5.8。
8. **`widgets/` 里 `pio` 的映射路径是坏的**：`src/utils/widget-manager.ts:19` 写的是 `"../components/widget/Pio.astro"`，但仓库里没有 `src/components/widget/` 目录（只有 `widgets/`），实际 Pio 在 `src/components/features/pio/Pio.svelte`，由 `src/layouts/Layout.astro:4` 引用。这条属于潜伏配置：`getComponentPath()`（`src/utils/widget-manager.ts:184-185`）在整个 `src/` 内没有任何调用点，所以不会当场崩溃。
9. **起始页相关文件正处于未提交状态**：`src/pages/index.astro`、`src/pages/home/`、`src/components/features/landing/`、`src/scripts/landing/`、`src/styles/landing/` 都是新增未跟踪文件；旧的 `src/pages/[...page].astro` 已被删除。
10. **`src/pages/zyj/`** 是个人彩蛋页（IP 归属地），不属于任何规范分层。

---

## 相关文件

- `src/components/index.ts` —— 顶层组件 barrel，聚合 atoms、8 个 feature、organisms 与 11 个 widget。
- `src/components/atoms/index.ts` —— atoms 层 barrel，11 个子组件目录的重导出。
- `src/components/features/toc/index.ts` —— 最复杂的 barrel 示例，注明 Svelte 组件需从原始路径导入。
- `src/components/features/posts/index.ts` —— posts 业务域的具名重导出示例。
- `src/components/features/landing/nav-links.ts` —— 起始页快捷入口来源，从 `navBarConfig` 推导，依赖 `node:fs`；注释解释了「关掉的页面是空壳而非 404」。
- `src/components/widgets/sidebar/SideBar.astro` —— 左/侧栏渲染入口，调用 `widgetManager`。
- `src/utils/widget-manager.ts` —— 侧栏组件映射表与管理器（`WIDGET_COMPONENT_MAP` 在 `:11`，pio 坏路径在 `:19`）。
- `src/utils/widget-renderer.ts` —— 侧栏组件渲染与 props 组装。
- `src/utils/permalink-utils.ts` —— permalink 生成与文章序号映射缓存。
- `src/utils/content-utils.ts` —— 构建期文章读取/排序入口，依赖 `astro:content`。
- `src/utils/url-utils.ts` —— URL 拼接与 slug 处理，构建期。
- `src/scripts/swup-manager.ts` —— 浏览器端 swup 页面过渡总入口。
- `src/scripts/core/swup-config.ts` —— swup 选择器、持久化元素与动画/主题常量。
- `src/scripts/landing/index.ts` —— 起始页客户端运行时（指针光效、开屏跳过等）。
- `src/pages/index.astro` —— 起始页（`/`），含布局与版块说明注释。
- `src/pages/home/[...page].astro` —— 文章分页列表（`/home/`），`paginate` 入口。
- `src/pages/posts/[...slug].astro` —— 文章详情默认路径与 alias 处理。
- `src/pages/[...permalink].astro` —— 根级 permalink 文章路由。
- `src/pages/og/[...slug].png.ts` —— 动态 OG 图生成（satori + sharp）。
- `src/pages/api/allPostMeta.json.ts` / `src/pages/api/calendar-data.json.ts` —— 两个预渲染的 JSON 接口。
- `src/content.config.ts` —— Astro 内容集合 schema（`posts` / `spec`）。
- `src/constants/constants.ts` —— `HOME_PATH` 等全局常量（含「别写 `/`」的警告注释）。
- `src/config.ts` —— 站点配置真源，`featurePages` 在 `:42`、`permalinkConfig` 在 `:393`。
- `astro.config.mjs` —— Astro 配置，`defineConfig` 在 `:38`、`output/trailingSlash/redirects` 在 `:41-52`、插件注册在 `:164-220`。
- `tsconfig.json` —— 路径别名定义（`@components/*` 等）在 `:17-25`。
- `package.json` —— 依赖、npm 脚本与危险钩子（`predev`/`prebuild` 在 `:8-9`）。
- `scripts/sync-content.js` —— 内容同步脚本，结尾的 `git add .` + `git commit` 在 `:157-161`。
- `scripts/init-content-repo.js` —— 内容分离模式初始化脚本。
- `pagefind.yml` —— 搜索索引排除选择器。
- `.env.example` —— 内容同步、IndexNow、Bilibili 等环境变量样例。
- `.gitignore` —— 标注 `dist/`、`.astro/`、`node_modules/`、`/content/` 等忽略项。
- `docs/rule/03-file-organization-architecture.md` —— 官方目录树规范（已与实际脱节）。
- `docs/rule/05-atom-component-usage.md` —— 更贴合现状的分层使用规范。
- `docs/rule/06-sidebar-widget-dev.md` —— 侧栏 widget 接入三步规范。
- `docs/CONTENT_REPOSITORY.md` / `docs/CONTENT_SEPARATION.md` / `docs/MIGRATION_GUIDE.md` —— 内容分离模式说明。
