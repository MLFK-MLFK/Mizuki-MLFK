# 00 · 快速上手

这一块写给「今天刚拿到仓库、明天就要改代码」的人。读完它，你应该能：在本机把站点跑起来、知道改哪个文件能改到想改的东西、并且避开仓库里几个会静默提交你改动的坑。

本项目是一个基于 Astro 6 的静态博客，主题源自 Mizuki（Mizuki 又基于 Fuwari），当前这份代码是 MLFK 的个人博客 —— 改过配置、换过首页结构，不是原版直出。全文的命令与路径都按「绝对不要触发自动 git commit」这个前提写，请先读第 4 节再敲任何 npm/pnpm 命令。

---

## 1. 这个项目是什么

| 事实 | 证据 |
| --- | --- |
| 包名 `mizuki`，版本 `9.0` | `package.json:2`、`package.json:4` |
| 静态站，构建产物是纯静态 HTML | `astro.config.mjs:43`（`output: "static"`） |
| Astro 版本锁定为 `6.1.2` | `package.json:45` |
| 本站是 `LyraVoid/Mizuki` 的 fork，Mizuki 又基于 `Fuwari` | `README.md:1-8`（fork 说明）、`README.md:344`、`README.md:348`、`README.md:357`（Fuwari 渊源） |
| CI 的 workflow 名还叫 `Fuwari-yCENzh CI` | `.github/workflows/CI.yml:1` |
| 这是 MLFK 的个人博客，标题「mkの后花园」 | `src/config.ts:27` |
| 主语言 `zh_CN`，时区 UTC+8 | `src/config.ts:24-25` |

站点 URL 在 `src/config.ts:29` 配的是 `https://mlfk.pages.dev/`。仓库根目录另有一个 `content/` 目录，它其实是**整个仓库的一份克隆**（里面同样有 `package.json`、`src/` 等），文章副本在 `content/src/content/posts`，这块与内容同步机制有关，见第 7 节。

**一个必须先知道的结构改动**：站点根 `/` 现在是「起始页」（开屏动画 + 一个进入按钮），原来的分页文章列表挪到了 `/home/`。判断「是不是首页」的地方一律用常量 `HOME_PATH`，不要再写 `"/"`。

- 首页常量定义：`src/constants/constants.ts:14`（`export const HOME_PATH = "/home/";`，注释解释得很清楚）
- 起始页：`src/pages/index.astro:12-34` 的注释与实现（`<main id="swup-container">` 在 `:65-77`）
- 文章列表：`src/pages/home/[...page].astro:13-19` 的注释
- 旧的 `src/pages/[...page].astro` 已删除（`git status` 显示为 `D`）
- 老书签 `/start/` 由 `astro.config.mjs:50-52` 的 `redirects` 兜到 `/`

---

## 2. 路由是「文件即 URL」，没有集中式路由表

`src/pages/` 下的文件直接映射成 URL，新增页面就是在 `src/pages/` 里放一个 `.astro`（或 `.ts` 端点）。例如：

| 文件 | URL |
| --- | --- |
| `src/pages/index.astro` | `/`（起始页） |
| `src/pages/home/[...page].astro` | `/home/`、`/home/2/`…（分页文章列表） |
| `src/pages/archive.astro` | `/archive/` |
| `src/pages/about.astro` | `/about/` |
| `src/pages/friends.astro` | `/friends/` |
| `src/pages/rss.xml.ts`、`src/pages/atom.xml.ts` | `/rss.xml`、`/atom.xml`（数据端点） |
| `src/pages/og/[...slug].png.ts` | OpenGraph 图片端点（按文章 slug 生成） |
| `src/pages/zyj/index.astro` | `/zyj/`（仓库自带的定制路由） |

文章有两套路由并存，别搞混：

- `src/pages/posts/[...slug].astro` —— 默认的文章详情页，`getStaticPaths()` 遍历 `getSortedPosts()`（`:35-46`）为每篇文章建 `/posts/<slug>/`。
- `src/pages/[...permalink].astro` —— 处理固定链接的页面，按 `permalinkConfig`（全局）或文章 frontmatter 的 `permalink`（单篇）在根目录下生成 `<permalink>/`（`:40-75`）。

两者关系写在 `posts/[...slug].astro:50-92` 的注释里：即使文章配了自定义 permalink 或全局 permalink 开启，`/posts/<slug>/` 的默认路径**仍然会保留**以兼容旧链接，同时再由 `[...permalink].astro` 生成新路径。全局 permalink 开关在 `src/config.ts:393-416`（当前 `enable: false`，格式模板 `format: "%postname%"`）。文章的 `alias` 字段也会走 `posts/[...slug].astro:78-91` 生成别名路径。

---

## 3. 上手前提：包管理器与 Node

**只能用 pnpm，不能用 npm 或 yarn。**

- `package.json:24` 的 `preinstall` 是 `npx only-allow pnpm` —— 用 npm/yarn 装依赖会在安装前直接报错退出。
- `package.json:111` 锁定 `"packageManager": "pnpm@10.33.0"`。
- 仓库里只提交了 `pnpm-lock.yaml`；`.gitignore:34-36` 明确忽略了 `package-lock.json`、`yarn.lock`、`bun.lockb`。

Node 版本要求 `>= 22`（`README.md:12` 徽章），CI 测试矩阵用 22 与 23（`.github/workflows/build.yml:20` 的 `matrix.node`）。

首次上手：

```bash
pnpm install        # 安全，preinstall 只做包管理器校验
npx astro dev       # 安全，见第 4 节为什么不用 pnpm dev
```

开发服务器默认地址是 `http://localhost:4321`（`README.md:140`）。

---

## 4. 命令表（含危险性）

### 4.1 危险命令：`pnpm dev` / `pnpm build`（以及对应的 `npm run dev|build`）

`package.json:8-9` 定义了 `predev` 与 `prebuild`，两者都执行 `node scripts/sync-content.js || true`。而 `scripts/sync-content.js` 的**结尾会 `git add .` 加 `git commit`**：

```js
// scripts/sync-content.js:156-162
execSync("git add .", { cwd: rootDir });
execSync(
  `git commit -m "chore(content): sync ${branch}@${hash}"`,
  { cwd: rootDir },
);
```

后果：只要工作区里有任何未提交的改动（改了一半的组件、临时文件、刚写的笔记），跑一次 `pnpm dev` 或 `pnpm build` 就可能被一并提交，提交信息是 `chore(content): sync <branch>@<hash>`。`|| true` 只保证脚本失败时不阻断 dev/build，但拦不住这次提交。

### 4.2 安全替代命令

| 命令 | 作用 | 说明 |
| --- | --- | --- |
| `npx astro dev` | 启动开发服务器 | 绕过 `predev`，不触发内容同步与提交 |
| `npx astro build` | 构建到 `dist/` | 绕过 `prebuild`；但**跳过了** `pnpm build` 里的番剧更新 / pagefind / 字体压缩 |
| `npx astro check` | Astro + TS 类型检查 | 等价于 `pnpm check`（`package.json:12`），CI 用它做门禁 |
| `npx astro preview` | 本地预览 `dist/` | 需先构建出 `dist/`；`pnpm preview` 也无 pre 钩子（`package.json:18`） |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` | 无 pre 钩子（`package.json:20`） |
| `pnpm format` | Prettier 写 `./src` | 无 pre 钩子（`package.json:22`） |
| `pnpm lint` | ESLint 修 `./src` | 无 pre 钩子（`package.json:23`） |
| `pnpm new-post -- <名>` | 生成文章骨架 | 直接写 `src/content/posts/`，无 pre 钩子（`package.json:21`） |

### 4.3 `pnpm build` 到底做了什么

`package.json:16` 的链条是：

```
node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

- `scripts/update-anime.mjs`：读 `src/config.ts` 里的 `anime.mode`（`src/config.ts:89-90`，当前是 `"local"`），是 `bilibili` 就跑 `update-bilibili.mjs`，是 `bangumi` 就跑 `update-bangumi.mjs`，否则打印 `Anime mode is "<mode>", skipping data update.`。**当前 `mode: "local"`，所以这一步实际上什么都不做。**
- `pagefind --site dist`：给 `dist/` 建全文搜索索引，排除项由 `pagefind.yml:1-5` 指定（`span.katex`、`[data-pagefind-ignore]`、`.search-panel` 等）。
- `node scripts/compress-fonts.js`：读 `src/config.ts` 的字体配置，用 `fontmin` 做字体子集（`scripts/compress-fonts.js:4` 导入，真正调用在 `:1120-1133`；`:10-29` 的 `getConfig()` 只是读配置）。

因为整条链挂在一个有自动提交的 `prebuild` 后面，本地要复现完整构建，建议手工分段执行，而不是跑 `pnpm build`。

### 4.4 开发环境里「看起来坏了」的两件事

这两件事都不是 bug，是构建期与运行期的边界：

- **搜索面板在 dev 下没有结果**：搜索索引是 `pagefind --site dist` 在构建后写进 `dist/` 的（`package.json:16`），`npx astro dev` 不产出它。要试搜索得先 `npx astro build` 再 `npx astro preview`。
- **自定义字体在 dev 下不生效**：`src/config.ts:216` 的注释写明「字体子集优化功能目前仅支持 TTF 格式字体，开启后需要在生产环境才能看到效果，在 Dev 环境下显示的是浏览器默认字体」。同理，番剧 / B 站数据要先构建出 json 文件（`src/config.ts:71-74` 的 `bangumi`、`:76-87` 的 `bilibili`，数据文件被 `.gitignore:49`、`:52` 忽略）。

---

## 5. 「我要改 X，去哪改」对照表

| 我想改… | 去哪改 | 证据行 |
| --- | --- | --- |
| 站点标题 / 副标题 / URL | `src/config.ts` 的 `siteConfig.title` / `.subtitle` / `.siteURL` | `src/config.ts:27`、`src/config.ts:28`、`src/config.ts:29` |
| 主题色相（配色总开关） | `src/config.ts` 的 `themeColor.hue`（0–360） | `src/config.ts:36-38` |
| 明暗两套配色的具体色值 | `src/styles/variables.styl` 的 `define({...})` 块，所有 `var(--hue)` 由上面的 hue 驱动 | `src/styles/variables.styl:25-100` |
| 头像 | `src/config.ts` 的 `profileConfig.avatar`（相对 `src/`，以 `/` 开头则相对 `public/`） | `src/config.ts:365` |
| 昵称 / 个人简介 | `src/config.ts` 的 `profileConfig.name` / `.bio` | `src/config.ts:366-367` |
| 侧栏个人卡的社交链接 | `src/config.ts` 的 `profileConfig.links` | `src/config.ts:372-383` |
| 顶部导航栏（含多级菜单） | `src/config.ts` 的 `navBarConfig.links` | `src/config.ts:270-362` |
| 顶栏标题文字 / 图标 / Logo | `src/config.ts` 的 `navbarTitle` | `src/config.ts:54-63` |
| 写新文章 | 在 `src/content/posts/` 下加 `.md`/`.mdx`，字段照 `postsCollection` 的 schema | `src/content.config.ts:5-42` |
| 首页（起始页） | `src/pages/index.astro` | `src/pages/index.astro:1-85` |
| 文章列表页（分页首页） | `src/pages/home/[...page].astro` | `src/pages/home/[...page].astro:1-44` |
| 文章详情页 | `src/pages/posts/[...slug].astro` | `src/pages/posts/[...slug].astro:35-96` |
| 侧栏组件开关 / 顺序 / 左右栏 | `src/config.ts` 的 `sidebarLayoutConfig`，组件归属看 `.components.left/right/drawer` | `src/config.ts:493-620`、`src/config.ts:586-596` |
| 横幅（Banner）图片与轮播 | `src/config.ts` 的 `banner.src` / `.carousel` | `src/config.ts:124-146` |
| 评论系统 | `src/config.ts` 的 `commentConfig`（当前 `enable: false`） | `src/config.ts:428-449` |
| 音乐播放器 | `src/config.ts` 的 `musicPlayerConfig` | `src/config.ts:467-478` |
| 看板娘 Pio | `src/config.ts` 的 `pioConfig` | `src/config.ts:650-673` |
| 公告 | `src/config.ts` 的 `announcementConfig` | `src/config.ts:455-465` |
| 关于页正文 | `src/content/spec/about.md`（由 `src/pages/about.astro` 渲染） | `src/pages/about.astro:11-18` |
| 友链正文 | `src/content/spec/friends.md` | 与 `about.md` 同目录，见 `src/content.config.ts:43-46` |
| 特色页面开关（相册/番剧等） | `src/config.ts` 的 `featurePages` | `src/config.ts:42-51` |
| 界面上的 UI 文案（按钮、标签、提示语） | `src/i18n/i18nKey.ts` 加 key，再到 `src/i18n/languages/*.ts` 填各语言文本 | 见第 6.3 节 |

文章 frontmatter 的必填字段只有 `title` 和 `published`，其余大多有默认值；`draft`、`category`、`tags`、`image` 等见 `src/content.config.ts:7-41`。`pnpm new-post` 生成的骨架字段（`scripts/new-post.js` 末尾的模板）也能对得上。

---

## 6. 目录与分层约定

### 6.1 `src/components/` 的原子化分层

| 层 | 目录 | 定位 | 有没有 `index.ts` |
| --- | --- | --- | --- |
| 原子 | `src/components/atoms/` | Button / Badge / Icon / Image 等最小单元 | 有 |
| 功能 | `src/components/features/` | 按业务域分（posts、albums、toc、landing、pio…） | 层目录**没有**，barrel 落在子域（如 `features/posts/index.ts`） |
| 控件 | `src/components/control/` | 分页、返回顶部、主题切换等功能性控件 | 有 |
| 组织 | `src/components/organisms/` | footer、navigation | 层目录**没有**，barrel 在子域 |
| 部件 | `src/components/widgets/` | 侧栏小部件（profile、tags、categories…） | 层目录**没有**，barrel 在子域 |
| 布局 | `src/components/layout/` | Banner、SideBar | 有 |
| 其它 | `src/components/misc/`、`src/components/comment/` | 杂项、评论 | 有 |

**别以为每层都有 barrel**：实测 `atoms`、`control`、`layout`、`misc`、`comment` 有 `index.ts`；`features`、`organisms`、`widgets` 没有。顶层 `src/components/index.ts:1-30` 是直接 `export * from "./features/posts"` 这种**子域**路径，而不是 `./features`。

### 6.2 导入别名

别名在 `tsconfig.json:17-25`：`@components/*`、`@layouts/*`、`@constants/*`、`@utils/*`、`@assets/*`、`@i18n/*`，以及 `@/*` 指向 `src/*`。所以你会在同一个文件里同时看到 `@components/...` 和相对路径两种写法。

### 6.3 UI 文案的真源在 `src/i18n/`

改界面文字**不要**去组件里硬改字符串，那套是 i18n 驱动的：

- `src/i18n/i18nKey.ts` —— 所有文案 key 的枚举（`I18nKey`）。
- `src/i18n/languages/en.ts`、`ja.ts`、`zh_CN.ts`、`zh_TW.ts` —— 各语言的具体文本。
- `src/i18n/translation.ts:12-25` —— 语言码到文案表的映射（`zh_cn`、`ja`、`en_us`… 都归一到这里），`:27-30` 的 `i18n(key)` 按 `siteConfig.lang` 取文本。

加一条新文案的流程：先在 `i18nKey.ts` 加 key，再到需要的语言文件里填值，最后在组件里 `i18n(I18nKey.xxx)`。

### 6.4 `src/` 下其余关键目录

| 目录 | 用途 |
| --- | --- |
| `src/config.ts` | 全站配置真源（站点、导航、侧栏、评论、播放器、看板娘……） |
| `src/constants/` | `HOME_PATH`、`PAGE_SIZE` 等常量 |
| `src/data/` | 结构化数据（`anime.ts`、`friends.ts`、`projects.ts`、`skills.ts`、`timeline.ts`、`devices.ts`、`diary.ts`） |
| `src/stores/` | Svelte store（如 `musicPlayerStore.ts`） |
| `src/types/` | 配置类型定义（`config.ts` 里 import 的 `SiteConfig` 等） |
| `src/utils/` | 工具函数（`content-utils.ts`、`url-utils.ts`、`grid-layout-utils.ts`、`permalink-utils.ts` …） |
| `src/styles/` | Stylus / CSS（`variables.styl` 是配色变量） |
| `src/layouts/` | `Layout.astro`（外壳）、`MainGridLayout.astro`（内容页栅格） |
| `src/plugins/` | 构建期 markdown / rehype 插件 |
| `src/scripts/` | 浏览器端运行时代码（swup、主题、landing 等） |
| `src/content/` | `posts/`（文章）、`spec/`（关于页、友链正文） |

### 6.5 页面外壳：起始页不走 MainGridLayout

`Layout.astro` 是外壳（`<html>`/`<body>` 装配在 `src/layouts/Layout.astro:161-246`），`MainGridLayout.astro` 负责内容页的栅格 + 导航 + 侧栏 + Banner。起始页 `src/pages/index.astro` 只包了一层 `Layout`，**不走** `MainGridLayout`。

这正是它必须被 swup 忽略的原因：swup 只替换 `<main>`，而内容页的 `<main>` 深埋在 `#main-grid` 里、起始页的 `<main>` 是 `<body>` 直接子元素，两边外壳对不上，换页会把结构拆坏。完整原因写在 `astro.config.mjs:71-103` 的长注释里，忽略规则本体在 `:98-103`。

构建期与运行期的边界也要分清：`src/scripts/` 下是浏览器端运行时代码；`astro.config.mjs:164-220` 的 markdown 插件链与 `src/plugins/` 是构建期的；仓库根 `scripts/` 则是 Node 构建脚本，不会进站。

---

## 7. `.env` 与内容同步开关

`.env` 不是 Astro 自动加载的 —— 它由自己的解析器读取：`scripts/load-env.js:10-27` 打开根目录 `.env`，逐行按 `key=value` 解析、去掉引号，写进 `process.env`。入口在 `scripts/sync-content.js:11`（`loadEnv()`）。

关键变量（读 `.env.example`）：

| 变量 | 示例值 | 作用 | 证据 |
| --- | --- | --- | --- |
| `ENABLE_CONTENT_SYNC` | `true` | 是否启用代码/内容分离 | `.env.example:13` |
| `CONTENT_REPO_URL` | `https://github.com/MLFK-MLFK/Mizuki-MLFK.git` | 内容仓库地址 | `.env.example:19` |
| `CONTENT_DIR` | `./content` | 内容克隆到哪 | `.env.example:23` |
| `INDEXNOW_KEY` / `INDEXNOW_HOST` | — | SEO 主动提交 | `.env.example:38-40` |
| `BILI_SESSDATA` | — | 拉 B 站观看进度 | `.env.example:54` |

`.env` 本身被 `.gitignore:19` 忽略，仓库里只提交 `.env.example`；本地这两个文件目前内容完全一致。

### 7.1 默认值反直觉：不是 `"false"` 就算启用

`scripts/sync-content.js:15` 写的是：

```js
const ENABLE_CONTENT_SYNC = process.env.ENABLE_CONTENT_SYNC !== "false"; // 默认启用
```

也就是说，**只要不是字面量 `"false"`，内容同步就是开着的** —— 没有 `.env`、变量拼错、空字符串，全都算启用。只有显式 `false` 才会走 `:22-29` 的早退分支（打印提示后 `process.exit(0)`）。

### 7.2 同步逻辑（会对内容仓库做硬重置）

`scripts/sync-content.js:32-91`：

- `CONTENT_DIR` 不存在且没配 `CONTENT_REPO_URL` → 警告后用本地内容退出（`:36-42`）。
- `CONTENT_DIR` 不存在但有 URL → `git clone --depth 1`（`:44-54`）。
- `CONTENT_DIR` 已存在且有 `.git` → 先 `git stash push --include-untracked`（`:63-66`），再 `git fetch --all --prune`（`:69-72`），判 `origin/main` 或 `master`（`:75-80`），最后 `git checkout <branch>` + `git reset --hard origin/<branch>`（`:83-84`）。**这是对内容仓库的硬重置，本地未推送的改动会被吞掉。**

之后把内容仓库的 `posts` / `spec` / `data` / `images` 映射到 `src/content/posts`、`src/content/spec`、`src/data`、`public/images`（`:96-101`）。映射时若源目录不存在就跳过（`:107-110`）；若目标已存在且不是符号链接，先改名成 `*.backup` 再建符号链接（`:113-137`，Windows 无管理员权限时退化为复制）。

### 7.3 本机这份工作区的实际情况

根目录 `content/` 已存在且带 `.git`，但它是**整个仓库的克隆**（里面有 `package.json`、`astro.config.mjs`、`src/` …），文章实际在 `content/src/content/posts`，而 `content/posts`、`content/spec`、`content/data`、`content/images` **都不存在**。因此 `scripts/sync-content.js:96-101` 的四个映射在本机全部命中 `:107-110` 的「跳过不存在的源目录」分支，不会建任何符号链接。

这是配置上的一处怪异之处：`CONTENT_REPO_URL`（`.env.example:19`）指向 `Mizuki-MLFK` 自身，等于让内容仓库克隆代码仓库自己。无论哪种情况，只要同步不是 `false`，脚本最后都会落到第 4.1 节的自动提交。

---

## 8. 代码风格工具

| 工具 | 配置 | 命令 | 要点 |
| --- | --- | --- | --- |
| Prettier | `.prettierrc` | `pnpm format`（只写 `./src`） | Astro + Svelte 插件在 `.prettierrc:2`；默认 `printWidth: 80`、`tabWidth: 4`、`useTabs: true`（`.prettierrc:4-6`）；CSS 覆盖为 `printWidth: 200`、两空格（`.prettierrc:16-25`） |
| ESLint | `eslint.config.js`（flat config） | `pnpm lint`（`eslint ./src --fix`） | 忽略 `node_modules/**`、`dist/**`、`.astro/**`、`public/**`、`scripts/**` 等（`eslint.config.js:39-49`）；大量规则被关成 `off` 或 `warn`（`:74-92`） |
| TS 检查 | `tsconfig.json` | `pnpm type-check` | `tsc --noEmit --isolatedDeclarations`（`package.json:20`） |
| Astro 检查 | — | `npx astro check` | CI 用它做门禁 |

注意 `.prettierignore` 里有 `**/*.md`，所以 `pnpm format` 不会碰你写的 markdown。`.vscode/settings.json` 已配好保存即格式化（默认格式化器是 Prettier），`.vscode/extensions.json` 推荐安装 Prettier 与 Astro 插件。

---

## 9. 构建产物与 `.gitignore`

- 产物目录：`dist/`。`astro.config.mjs:43` 声明 `output: "static"`，构建即产出静态文件到 `dist/`；`pagefind` 再往 `dist/` 写搜索索引。
- `.gitignore:2` 忽略 `dist/`。
- 其他被忽略的关键项：`.astro/`（Astro 生成的类型，`.gitignore:5`）、`node_modules/`（`:10`）、`.env` 与 `.env.production`（`:19-20`）、整个 `/content/` 内容仓库克隆（`:23`）、`*.backup`（`:24`）、`package-lock.json`/`yarn.lock`/`bun.lockb`（`:34-36`）、`.claude` 与 `.idea`（`:38-41`）、生成的数据文件如 `src/data/bangumi-data.json`（`:49`）与 `src/data/bilibili-data.json`（`:52`）。

所以「能提交的」是源码、配置、`src/content/` 里的文章与 `public/` 资源；「不该提交的」是构建产物、依赖、密钥环境变量和独立内容仓库。

---

## 10. 部署与 CI 的现状（有坑，别照抄）

仓库里有四个 workflow，分支与版本对不上，新人照它们部署会踩坑：

| 文件 | 触发分支 | 问题 |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | `main` | **YAML 本身是坏的**：`repository_dispatch:` 被缩进到 `branches:` 底下（`deploy.yml:7-10`），语法错误；`node-version` 写死 `"20"`（`:31`），与 README 要求的 `>=22`、CI 矩阵的 22/23 都不一致 |
| `.github/workflows/build.yml` | `main`（`:5-7`） | 盯的是 `main`，但本仓库默认分支是 `master` |
| `.github/workflows/CI.yml` | `master`（`:5-7`） | 这是与当前分支一致的那个 |
| `.github/workflows/lint.yml` | `master` | 与当前分支一致 |

也就是说，`deploy.yml` 和 `build.yml` 都盯着远端不存在的 `main` 分支，而真正会在推送时跑起来的是 `CI.yml` / `lint.yml`。要在 GitHub 上部署，得先把这些 workflow 的分支名与 YAML 修好。

---

## 11. 新人最容易踩的反直觉点

1. **`pnpm dev` / `pnpm build` 会自己提交代码**（`package.json:8-9` + `scripts/sync-content.js:156-162`）。改代码时请用 `npx astro dev`。
2. **`/` 不是文章列表，`/home/` 才是**（`src/constants/constants.ts:14`）。任何「是不是首页」的判断都要用 `HOME_PATH`，写死 `"/"` 现在指起始页。
3. **`ENABLE_CONTENT_SYNC` 缺省即启用**（`scripts/sync-content.js:15`）。想关必须显式写 `false`。
4. **`npx astro build` ≠ `pnpm build`**：前者跳过了番剧数据更新、pagefind 搜索索引和字体子集（`package.json:16`）。
5. **dev 下搜索没结果、字体也不对**是正常的：搜索索引与字体子集都只在构建产物里生效（第 4.4 节）。
6. **根目录 `content/` 是另一个 git 仓库且是整仓克隆**（`.gitignore:23`），同步脚本会对它 `git reset --hard`（`scripts/sync-content.js:84`）。
7. **导航栏里有指向不存在页面的链接**：`/content/`（`src/config.ts:296`、`src/config.ts:324`）本站没有对应路由。
8. **侧栏组件受 `sidebarLayoutConfig.components` 控制**，不是每个组件自己的开关（`src/config.ts:586-596`）。
9. **看板娘 / 樱花的注释与值相反**：`src/config.ts:651` 注释写「禁用看板娘以提升性能」，值是 `enable: true`；`src/config.ts:623` 注释写「默认关闭樱花特效」，值也是 `enable: true`。以代码为准。（音乐播放器 `src/config.ts:468` 的注释与值是一致的 `true`，不存在这个矛盾。）

---

## 相关文件

- `package.json` — 脚本、依赖、包管理器锁定，危险性命令的源头。
- `scripts/sync-content.js` — `predev`/`prebuild` 调用的内容同步脚本，结尾会 `git add .` 加 `git commit`。
- `scripts/load-env.js` — 手写的 `.env` 解析器，只处理根目录 `.env`。
- `.env.example` — 环境变量清单与说明，`ENABLE_CONTENT_SYNC` 等默认值在此。
- `.gitignore` — 构建产物、依赖、`.env`、`/content/` 的忽略规则。
- `.prettierrc` — Prettier 配置，含 Astro/Svelte 插件与 CSS 覆盖。
- `.prettierignore` — Prettier 忽略清单（含所有 markdown）。
- `eslint.config.js` — ESLint flat config，忽略 `scripts/**` 等。
- `tsconfig.json` — 路径别名（`@components/*`、`@layouts/*` …）。
- `astro.config.mjs` — Astro 集成与构建配置，含 `/start` 重定向与 swup 的起始页屏蔽逻辑。
- `src/pages/index.astro` — 起始页，占站点根 `/`。
- `src/pages/home/[...page].astro` — 分页文章列表，站点首页 `/home/`。
- `src/pages/posts/[...slug].astro` — 文章详情路由（默认 `/posts/<slug>/`）。
- `src/pages/[...permalink].astro` — 固定链接路由（全局或自定义 permalink）。
- `src/config.ts` — 全站配置真源：站点信息、导航、侧栏、横幅、评论、播放器、看板娘等。
- `src/constants/constants.ts` — `HOME_PATH`、`PAGE_SIZE`、分页与布局常量。
- `src/content.config.ts` — `posts` 与 `spec` 两个内容集合的 schema。
- `src/content/posts/` — 文章目录（写新文章的地方）。
- `src/content/spec/` — 关于页、友链页正文。
- `src/i18n/i18nKey.ts`、`src/i18n/translation.ts` — UI 文案的 key 与取值入口。
- `src/styles/variables.styl` — 明暗两套 CSS 变量与 `--hue` 的消费处。
- `src/layouts/Layout.astro` — 全站外壳与 head/body 装配。
- `src/layouts/MainGridLayout.astro` — 内容页的栅格、导航、侧栏、Banner 布局。
- `scripts/update-anime.mjs` — `pnpm build` 第一步，按 `anime.mode` 分发数据抓取。
- `scripts/compress-fonts.js` — 用 fontmin 做字体子集化。
- `pagefind.yml` — pagefind 搜索索引的排除选择器。
- `src/components/index.ts` — 组件 barrel 导出，展示分层结构。
