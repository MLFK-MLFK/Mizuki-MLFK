# 09 · 内容与数据

这一块回答三个问题：文章与特殊页从哪来、怎么写、怎么被渲染；`src/data/` 下的结构化数据长什么样、谁在消费；以及本项目特有的「代码 / 内容分离」机制实际怎么运作。它是上手时最先要碰的部分——写第一篇文、改一条友链、加一个项目，全都落在这里。读完你应该能独立新增一篇 Markdown 文章、用主题自带的扩展语法排版、在不动代码的前提下改数据，并且知道 `pnpm dev` 之前 `predev` 钩子会先做什么。

---

## 1. 内容集合（Content Collections）

集合定义集中在 `src/content.config.ts`，只有两个：`posts` 和 `spec`。

| 集合 | loader | 物理目录 | schema |
|---|---|---|---|
| `posts` | `glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" })` | `src/content/posts/` | 完整字段校验 |
| `spec` | `glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" })` | `src/content/spec/` | `z.object({})`，**不校验任何字段** |

`posts` 集合对象定义在 `src/content.config.ts:5`，loader 在 `src/content.config.ts:6`；`spec` 集合对象在 `src/content.config.ts:43`，loader 在 `src/content.config.ts:44`，空 schema 在 `src/content.config.ts:45`。`spec` 的 schema 是空的，意味着 `about.md`、`friends.md` 的 frontmatter 写错也不会报错。

---

## 2. posts 的 frontmatter 字段

下表是对 `src/content.config.ts:7`–`src/content.config.ts:41` 的逐字段整理。**必填**只有两个；其余都有默认值或可选。

| 字段 | 类型 | 必填 | 默认 / 说明 | 代码位置 |
|---|---|---|---|---|
| `title` | `string` | **是** | 无默认，缺失即构建报错 | `src/content.config.ts:8` |
| `published` | `date` | **是** | 无默认；YAML 里写 `2026-10-01` 会被转成 Date | `src/content.config.ts:9` |
| `updated` | `date` | 否 | 无；配合「最后修改」显示 | `src/content.config.ts:10` |
| `draft` | `boolean` | 否 | `false` | `src/content.config.ts:11` |
| `description` | `string` | 否 | `""` | `src/content.config.ts:12` |
| `image` | `string` | 否 | `""`；**封面字段就是它，不是 `cover`** | `src/content.config.ts:13` |
| `tags` | `string[]` | 否 | `[]` | `src/content.config.ts:14` |
| `category` | `string \| null` | 否 | `""` | `src/content.config.ts:15` |
| `lang` | `string` | 否 | `""`；留空则回退站点语言 | `src/content.config.ts:16` |
| `pinned` | `boolean` | 否 | `false`；置顶 | `src/content.config.ts:17` |
| `comment` | `boolean` | 否 | `true`；文章级评论区开关 | `src/content.config.ts:18` |
| `priority` | `number` | 否 | 无；**仅在 `pinned: true` 时参与排序**，越小越靠前 | `src/content.config.ts:19` |
| `author` | `string` | 否 | `""` | `src/content.config.ts:20` |
| `sourceLink` | `string` | 否 | `""`；转载出处 | `src/content.config.ts:21` |
| `licenseName` | `string` | 否 | `""` | `src/content.config.ts:22` |
| `licenseUrl` | `string` | 否 | `""` | `src/content.config.ts:23` |
| `encrypted` | `boolean` | 否 | `false`；加密总开关 | `src/content.config.ts:26` |
| `password` | `string` | 否 | `""`；与 `encrypted` **同时为真**才加密 | `src/content.config.ts:27` |
| `passwordHint` | `string` | 否 | `""`；密码提示 | `src/content.config.ts:28` |
| `alias` | `string` | 否 | 无；额外生成的旧链接别名 | `src/content.config.ts:31` |
| `permalink` | `string` | 否 | 无；自定义固定链接，优先级高于 `alias` | `src/content.config.ts:34` |
| `prevTitle` / `prevSlug` | `string` | 否 | `""`；**内部用**，由代码写回，别手填 | `src/content.config.ts:37`–`38` |
| `nextTitle` / `nextSlug` | `string` | 否 | `""`；同上 | `src/content.config.ts:39`–`40` |

最小可用 frontmatter 只需两个必填字段：

```yaml
---
title: 我的第一篇文章
published: 2026-10-01
---
```

### 2.1 高级字段的实际行为

- **`draft`**：只在生产构建（`import.meta.env.PROD`）时过滤，开发环境下草稿**照样显示**。四处过滤点写法相同：`import.meta.env.PROD ? data.draft !== true : true`（`src/utils/content-utils.ts:10`、`:86`、`:115`、`:221`）。
- **`pinned` + `priority`**：排序逻辑在 `src/utils/content-utils.ts:14`–`:35`。先按置顶状态排；priority 比较整块被 `if (a.data.pinned && b.data.pinned)` 包住（`src/utils/content-utils.ts:23`），所以 `priority` 对**非置顶**文章完全无效。两篇都置顶时，都定义了 priority 才按数值比，只有一方定义则定义方靠前，都没定义则回落到发布日期。
- **`encrypted` + `password`**：加密判定是 `entry.data.encrypted && entry.data.password`（`src/pages/posts/[...slug].astro:168`）。两条渲染路径不同：
  - `/posts/` 下用 `Encryptor.astro`，服务端把渲染后的 HTML 用 `CryptoJS.AES.encrypt("MIZUKI-VERIFY:" + html, String(password))` 加密（`src/components/features/auth/Encryptor.astro:20`–`:24`）；
  - 根路径 permalink 页用 `PasswordProtection.astro`，加密的是 `entry.body`，前缀同样是 `MIZUKI-VERIFY:`（`src/pages/[...permalink].astro:84`、`:87`）。浏览器端解密后也用同一前缀校验（`src/components/features/auth/PasswordProtection.astro:128`）。
  - 相关文章推荐**排除设置了 `password` 的文章**（`src/utils/content-utils.ts:225`–`:227`，条件是 `!p.data.password`）——注意它只看 `password` 字段，不看 `encrypted`。
- **`comment`**：传给评论组件的文章级开关，`const commentEnabled = post ? (post.data.comment ?? true) : true;`（`src/components/comment/index.astro:31`）。
- **`category`**：可为 `null`。归档页在传给 Svelte 前显式做了 `null → undefined` 转换（`src/pages/archive.astro:16`–`:22`）。
- **`tags` / `category`**：分别驱动标签云与分类栏的计数（`src/utils/content-utils.ts:84`、`:113`）。
- **`published` / `updated`**：`updated` 参与「最后修改时间」显示，回退值是 `published`（`src/pages/posts/[...slug].astro:354`）。
- **`image`**：见 §3.2。

---

## 3. 文章目录结构、id 与图片约定

`src/content/posts/` 当前有**四个顶层条目**：

| 路径 | 形式 |
|---|---|
| `src/content/posts/guide/index.md` + `guide/1.jpg` | 子目录 + `index.md`，图片与文章同目录 |
| `src/content/posts/video.md` | 单文件 |
| `src/content/posts/video_ZB/index.md` | 子目录 + `index.md` |
| `src/content/posts/VRCTool/index.md` | 子目录 + `index.md` |

约定：

- 简单文章直接放 `posts/xxx.md`；
- 带图片的文章建同名目录，正文叫 `index.md`，图片放一起，正文里用 `./图片名` 引用（`src/content/posts/guide/index.md` 的 `image: "./1.jpg"` 就是这种写法）；
- loader 用 `**/*.{md,mdx}` 递归匹配，嵌套多少层都能被扫到。

**id 的生成**：glob loader 下 `entry.id` 是相对 `base` 的去扩展名路径，例如 `guide/index.md` → `guide/index`。URL 由 `getPostUrl` 决定（`src/utils/url-utils.ts:44`），默认是 `/posts/<id 去扩展名>/`（`src/utils/url-utils.ts:27`–`:31`）。带自定义 `permalink` 或在全局 permalink 开启时，链接会改到根路径，见 §8。

### 3.1 用脚本新增文章

`package.json:21` 定义 `new-post` → `node scripts/new-post.js`。脚本行为（`scripts/new-post.js`）：

1. 取命令行第一个参数作为文件名（`scripts/new-post.js:23`）；
2. 无 `.md`/`.mdx` 后缀自动补 `.md`（`scripts/new-post.js:26`–`:29`）；
3. 目标目录硬编码为 **相对当前工作目录** 的 `./src/content/posts/`（`scripts/new-post.js:31`），所以必须在仓库根目录执行；
4. 文件已存在则报错退出（`scripts/new-post.js:34`–`:37`）；
5. 用 `path.dirname` 自动建多级子目录（`scripts/new-post.js:40`–`:43`），`pnpm new-post -- foo/bar` 会得到 `src/content/posts/foo/bar.md`；
6. 写入固定模板（`scripts/new-post.js:45`–`:55`），字段为 `title / published / description / image / tags / category / draft / lang`，**没有** `pinned`、`comment`、`encrypted`。

```yaml
---
title: my-post
published: 2026-10-01
description: ''
image: ''
tags: []
category: ''
draft: false
lang: ''
---
```

注意模板里 `title: ${args[0]}` 直接拿原始参数（`scripts/new-post.js:46`），参数带子目录时标题会变成 `foo/bar`，需要手改。

### 3.2 图片资源的完整约定

`image` 字段（以及正文里的图片）支持三种来源：

- **相对文章目录**：如 `./1.jpg`，图片和 `index.md` 放同一目录。用到该图的 `Image.astro` / 海报生成会拿 `getFileDirFromPath(entry.filePath)` 拼出真实路径；
- **`/public` 绝对路径**：以 `/` 开头，直接按 public 下的路径引用；
- **远程 URL**：以 `http(s)` 或 `data:` 开头。

`ShareCard` 组装分享海报时会区别处理（`src/pages/posts/[...slug].astro:107`–`:141`）：相对路径的本地图经 `import.meta.glob` 拿到 `ImageMetadata` 再取 `.src`，远程图 `fetch` 成 base64 data URL。`banner` 直接吃 `entry.data.image`（`src/pages/posts/[...slug].astro:190`）。站点级开关 `showCoverInContent` 控制文章页是否显示封面（`src/config.ts:202`）。

### 3.3 Front Matter CMS 的编辑器 schema

根目录 `_frontmatter.json` 给 Front Matter CMS 编辑器插件用。它登记的文章目录是 `src/content/posts`（`_frontmatter.json:6`–`:11`），字段集比真实 schema 窄，且有一处名字不一致：**它把语言字段叫 `language`（`_frontmatter.json:65`–`:68`），而 Astro schema 叫 `lang`**（`src/content.config.ts:16`）。用编辑器写出来的 `language` 不会被 schema 校验拦住（`lang` 有默认空串），但也不会生效。它同样没有 `pinned` / `encrypted` / `permalink` / prev-next 等字段。

---

## 4. Markdown 渲染管线与扩展语法

这是「怎么写、怎么被渲染」的核心。插件链集中在 `astro.config.mjs:164`–`:220`，代码块高亮由 `astro-expressive-code` 提供（`astro.config.mjs:109`）。

### 4.1 remark（Markdown AST）阶段

| 插件 | 作用 | 位置 |
|---|---|---|
| `remarkMath` | 解析 `$...$` / `$$...$$` 数学公式（后续 `rehypeKatex` 渲染） | `astro.config.mjs:166` |
| `remarkContent` | 自写。算摘录、字数、阅读时间，注入 `frontmatter` | `astro.config.mjs:167` |
| `remarkFixGithubAdmonitions` | 自写。把 GitHub 风格 `> [!NOTE]` 引用块转成 directive | `astro.config.mjs:168` |
| `remarkDirective` | 启用 `:::` 指令语法 | `astro.config.mjs:169` |
| `remarkSectionize` | 按标题切分 section | `astro.config.mjs:170` |
| `parseDirectiveNode` | 自写。把 directive 节点转成 hName/hProperties | `astro.config.mjs:171` |
| `remarkMermaid` | 自写。把 ` ```mermaid ` 代码块转成 `mermaid-container` | `astro.config.mjs:172` |

### 4.2 rehype（HTML AST）阶段

| 插件 | 作用 | 位置 |
|---|---|---|
| `rehypeKatex` | 渲染数学公式 | `astro.config.mjs:175` |
| `rehypeExternalLinks` | 外链加 `target="_blank"` 和 `rel="nofollow noopener noreferrer"` | `astro.config.mjs:177`–`:182` |
| `rehypeSlug` + `rehypeAutolinkHeadings` | 给标题加 id 和 `#` 锚点链接 | `astro.config.mjs:183`、`:200`–`:217` |
| `rehypeWrapTable` | 表格外包一层 `.table-wrapper` | `astro.config.mjs:184` |
| `rehypeMermaid` | mermaid 图运行时渲染相关 | `astro.config.mjs:185` |
| `rehypeComponents` | 按名字映射到组件：`github`、`note`、`tip`、`important`、`caution`、`warning` | `astro.config.mjs:186`–`:199` |
| `rehypeImageWidth` | 从 alt 里的 `w-N%` 提取宽度并包成 `<figure>` | `astro.config.mjs:218` |

### 4.3 作者可用的扩展语法

| 语法 | 效果 | 来源 |
|---|---|---|
| `:::note … :::` | 提示框（还有 `tip`/`important`/`caution`/`warning`），标题可自定义：`:::note[自定义标题]` | `src/plugins/rehype-component-admonition.mjs:13`–`:33`，config 映射 `astro.config.mjs:191`–`:196` |
| `> [!NOTE]` … | GitHub 风格的引用式提示，会被转成上面的 directive | `src/plugins/remark-fix-github-admonitions.js:4`–`:9` |
| `::github{repo="owner/repo"}` | GitHub 仓库卡片，前端调 api.github.com 填数据 | `src/plugins/rehype-component-github-card.mjs:12`–`:105`，实际用例 `src/content/spec/about.md:4` |
| ` ```mermaid ` | 流程图 / 时序图等 | `src/plugins/remark-mermaid.js:3`–`:18` |
| `$...$`、`$$...$$` | 行内 / 块级数学公式（KaTeX） | `astro.config.mjs:166`、`:175` |
| `![说明 w-60%](图.png)` | 按百分比宽度居中显示，并生成 `<figure>`；带 `title` 还会生成 `<figcaption>` | `src/plugins/rehype-image-width.mjs:4`–`:56` |
| `<!--more-->` | 手动摘要分隔符：它之前的内容作为摘要 | `src/plugins/remark-content.mjs:18`、`:31`–`:49` |

**字数与阅读时间**也在 `remarkContent` 里算：跳过代码块，按 CJK 正则单独数字符，中文按 400 字/分、英文按 200 词/分估算（`src/plugins/remark-content.mjs:53`–`:84`），结果写进 `frontmatter.words` / `.minutes` / `.excerpt`，由文章页读取（`src/pages/posts/[...slug].astro:100`、`:224`、`:230`）。

**代码块**由 `astro-expressive-code` 处理（`astro.config.mjs:109`–`:155`），挂了四个插件：可折叠区块、行号、语言徽章、自定义复制按钮，其中后两个是本项目在 `src/plugins/expressive-code/` 下自写的。

---

## 5. spec 集合：about / friends 怎么被读走

`src/content/spec/` 下有两个文件：`about.md`（约 2.4KB，正文是 Mizuki 主题介绍）与 `friends.md`（**0 字节空文件**）。

读取方式统一是 `getEntry("spec", <name>)` + `render()`：

| 页面 | 取数 | 渲染 |
|---|---|---|
| `/about`（`src/pages/about.astro:11`、`:17`） | `getEntry("spec", "about")` | `render(aboutPost)` 得到 `Content`，塞进 `<Markdown>` |
| `/friends`（`src/pages/friends.astro:20`、`:26`） | `getEntry("spec", "friends")` | 同上，但正文是页面**底部**的说明区（`src/pages/friends.astro:126`–`:128`） |

两边都做了空值兜底并抛错：`src/pages/about.astro:14`、`src/pages/friends.astro:23`。

关键点：`friends.md` 是空的，友链卡片**不来自它**。卡片数据来自 `src/data/friends.ts`（`src/pages/friends.astro:27` 的 `getShuffledFriendsList()`），`friends.md` 只承担底部那段说明文字。`/friends` 还受 `siteConfig.featurePages.friends` 开关控制，关闭时 `Astro.redirect("/404/")`（`src/pages/friends.astro:16`–`:18`）。

---

## 6. 内容查询与消费链路

核心查询 / 排序层是 `src/utils/content-utils.ts`，页面与组件只调它。

### 6.1 content-utils 导出

| 函数 | 作用 | 位置 |
|---|---|---|
| `getRawSortedPosts()`（内部） | 取全部文章 + 排序：置顶 → priority → 发布日期倒序 | `src/utils/content-utils.ts:8` |
| `getSortedPosts()` | 在上者基础上**写回** `prevSlug/nextSlug/prevTitle/nextTitle` | `src/utils/content-utils.ts:45` |
| `getSortedPostsList()` | 同上但去掉 `body`、预计算 `url`，供列表组件用 | `src/utils/content-utils.ts:64` |
| `getTagList()` | 标签 + 计数 | `src/utils/content-utils.ts:84` |
| `getCategoryList()` | 分类 + 计数 + URL | `src/utils/content-utils.ts:113` |
| `getRelatedPosts()` | 相关文章评分推荐 | `src/utils/content-utils.ts:216` |

上下篇的语义是反的：`sorted[i].data.nextSlug = sorted[i-1].id`（`src/utils/content-utils.ts:49`），即「下一篇」指向列表里更靠前（更新）的那篇。这段是**就地 mutate 集合条目的 `data`**（`src/utils/content-utils.ts:48`–`:55`），属于本项目特有约定，别假设集合条目不可变。

### 6.2 链路一：首页文章列表

```
src/content/posts/*.md
  → Astro content collection（loader: glob）
  → getSortedPosts()                     src/pages/home/[...page].astro:24
  → paginate() 按 PAGE_SIZE 分页          src/pages/home/[...page].astro:27
  → PostPage.astro 遍历 page.data 渲染卡片
  → Pagination.astro 渲染页码链接
```

`/` 根路径现在让给**起始页** `src/pages/index.astro`（开屏动画 + 进入按钮），文章列表挪到 `/home/`。分页大小 `PAGE_SIZE = 8`（`src/constants/constants.ts:1`），列表路径常量 `HOME_PATH = "/home/"`（`src/constants/constants.ts:14`）；`/home/`、`/home/2/`… 这些路由由 `paginate()` 生成（`src/pages/home/[...page].astro:27`），`Pagination.astro` 只负责渲染链接。文章列表页还会 `initPostIdMap`（`src/pages/home/[...page].astro:26`），供 permalink 的 `%post_id%` 用。

### 6.3 链路二：归档页

```
src/content/posts/*.md
  → getSortedPostsList()                  src/pages/archive.astro:11
  → category null→undefined 归一化         src/pages/archive.astro:16
  → flatMap 抽出 tags / categories         src/pages/archive.astro:25、:28
  → ArchivePanel.svelte（client:only）     src/pages/archive.astro:45
```

归档页是 `client:only="svelte"` 渲染的，标签 / 分类筛选发生在浏览器端；链接由 `getTagUrl`、`getCategoryUrl` 生成，指向 `/archive/?tag=…`、`/archive/?category=…`（`src/utils/url-utils.ts:68`–`:85`）。

### 6.4 其它内容出口

`getSortedPosts` / `getSortedPostsList` 的消费点远不止上面两处，改动排序会波及所有出口：

- `/rss.xml`（`src/pages/rss.xml.ts:28`）、`/atom.xml`（`src/pages/atom.xml.ts:27`）；
- `/api/allPostMeta.json`（`src/pages/api/allPostMeta.json.ts:4`）、`/api/calendar-data.json`（`src/pages/api/calendar-data.json.ts:4`）；
- 日历、随机文章、站点统计等侧栏组件；
- `@astrojs/sitemap`（`astro.config.mjs:159`）与构建末尾的 `pagefind --site dist` 搜索索引（`package.json:16`）。

---

## 7. permalink 机制

配置在 `src/config.ts:393`：`permalinkConfig.enable`（默认 `false`，`src/config.ts:394`）与 `permalinkConfig.format`（`src/config.ts:417`）。开启后文章链接从 `/posts/<slug>/` 改到根路径 `/`，由两条路由分工：

- `/posts/[...slug].astro` 仍会为每篇文章生成默认 `/posts/<slug>/` 路径**以兼容旧链接**（`src/pages/posts/[...slug].astro:52`–`:68`）；
- 根路径 `src/pages/[...permalink].astro` 才处理带自定义 `permalink` 或全局 permalink 的文章（`src/pages/[...permalink].astro:40`–`:74`）。

`getPostUrl` 的优先级（`src/utils/url-utils.ts:44`–`:65`）：自定义 `permalink` > 全局 permalink 生成值 > `alias` > 默认 slug。自定义 `permalink` 形如 `permalink: "custom-page"` → `/custom-page/`。

`generatePermalinkSlug` 支持的占位符（`src/utils/permalink-utils.ts:97`–`:116`）：

| 占位符 | 含义 |
|---|---|
| `%year%` `%monthnum%` `%day%` | 4 位年 / 2 位月 / 2 位日 |
| `%hour%` `%minute%` `%second%` | 2 位时 / 分 / 秒 |
| `%post_id%` | 文章序号，**按发布时间升序**、最早为 1（`src/utils/permalink-utils.ts:22`–`:30`） |
| `%postname%` | 文件名 slug |
| `%raw_postname%` | 保留大小写的原始文件名 |
| `%category%` | 分类名，无分类为 `uncategorized` |

`%post_id%` 依赖 `initPostIdMap` 先建映射（`src/utils/permalink-utils.ts:14`）。它在多个入口被调用：`src/pages/home/[...page].astro:26`、`src/pages/posts/[...slug].astro:39`、`src/pages/[...permalink].astro:44`，以及 `getSortedPostsList()` 内部（`src/utils/content-utils.ts:68`）。

---

## 8. src/data/ 结构化数据

这些是**手写 TypeScript 数组**，与内容集合无关，由页面直接 import。

| 文件 | 导出 | 被谁消费 | 类型约束要点 |
|---|---|---|---|
| `src/data/projects.ts` | `projectsData`、`getProjectStats`、`getProjectsByCategory`、`getFeaturedProjects`、`getAllTechStack` | `/projects`（`src/pages/projects.astro:10`） | `category` 限定 `"web"\|"mobile"\|"desktop"\|"other"`（`src/data/projects.ts:9`）；`status` 限定 `"completed"\|"in-progress"\|"planned"`（`src/data/projects.ts:11`） |
| `src/data/skills.ts` | `skillsData` | `/skills`（`src/pages/skills.astro:9`） | `category` 五选一、`level` 四选一、`icon` 是 Iconify 名（`src/data/skills.ts:5`–`:14`） |
| `src/data/timeline.ts` | `timelineData` | `/timeline`（`src/pages/timeline.astro:9`） | 复用 `TimelineItem` 类型（`src/data/timeline.ts:1`） |
| `src/data/friends.ts` | `friendsData`、`getFriendsList`、`getShuffledFriendsList` | `/friends`（`src/pages/friends.astro:10`、`:27`） | 字段 `id/title/imgurl/desc/siteurl/tags`（`src/data/friends.ts:4`–`:11`） |
| `src/data/diary.ts` | `getDiaryList`、`getAllTags` | `/diary`（`src/pages/diary.astro:8`）、起始页 Bento（`src/components/features/landing/LandingBento.astro:6`） | `getDiaryList(limit?)` 按 `date` 倒序并按需截断（`src/data/diary.ts:26`–`:36`） |
| `src/data/devices.ts` | `devicesData` | `/devices`（`src/pages/devices.astro:5`） | `DeviceCategory` 是 `Record<string, Device[]>` 且可带「自定义」键（`src/data/devices.ts:12`–`:14`） |
| `src/data/anime.ts` | **default** `localAnimeList` | 经 `src/utils/anime-data.ts:4` 引入 | `status` 限定 `"watching"\|"completed"\|"planned"`（`src/data/anime.ts:4`） |

这些页面大多受 `siteConfig.featurePages`（`src/config.ts:42`–`:51`）控制。当前取值：`friends: true`（`src/config.ts:45`）、`albums: true`（`src/config.ts:49`），而 `anime`/`diary`/`projects`/`skills`/`timeline`/`devices` 全部为 `false`。写好数据不等于页面上线，还要去 `src/config.ts` 开开关；关闭时页面会 `redirect("/404/")`。

### 8.1 被忽略、需要本地自建的个性化文件

`.gitignore:47`–`:48` 排除了 `src/data/myself.ts` 与 `src/pages/myself.astro`。这两个文件在当前仓库里**并不存在**，`src/` 下也没有任何代码 import 它们——所以它们缺失不会影响 `npx astro check` 或构建。它们属于上游主题保留的个人数据 / 个人页占位：每个使用者自己建、自己用，不会进版本库。如果你要加「关于我」这类私人页面，可以顺着这个约定自建同名文件而不必担心被提交。

---

## 9. 番剧数据的构建期抓取

`src/config.ts:89` 是 `anime: {` 对象，`anime.mode` 在 `src/config.ts:90`，当前为 `"local"`（三选一：`"local"` / `"bangumi"` / `"bilibili"`）。

| 脚本 | 数据来源 | 环境变量 | 产物 | 是否被 .gitignore |
|---|---|---|---|---|
| `scripts/update-anime.mjs` | **调度器**：读 `src/config.ts` 的 `anime.mode` 决定跑哪个子脚本 | 无 | 无 | — |
| `scripts/update-bilibili.mjs` | `https://api.bilibili.com/x/space/bangumi/follow/list`（`scripts/update-bilibili.mjs:9`） | `BILI_SESSDATA`（`scripts/update-bilibili.mjs:66`） | `src/data/bilibili-data.json`（`scripts/update-bilibili.mjs:17`） | 是，`.gitignore:54` |
| `scripts/update-bangumi.mjs` | `https://api.bgm.tv`（`scripts/update-bangumi.mjs:5`） | 无 | `src/data/bangumi-data.json`（`scripts/update-bangumi.mjs:12`） | 是，`.gitignore:51` |

调度逻辑：`scripts/update-anime.mjs:11`–`:25` 用正则从 `src/config.ts` 文本里抠出 `anime.mode`，`:52`–`:60` 按值 spawn 子脚本；`mode === "local"` 时打印一行并跳过。两个子脚本自己也各有一道 mode 校验，不匹配就直接 return（`scripts/update-bilibili.mjs:323`–`:329`、`scripts/update-bangumi.mjs:205`–`:210`）。`BILI_SESSDATA` 用于让 B 站接口返回带 cookie 的完整观看进度，取值处 `scripts/update-bilibili.mjs:64`–`:66`，拼进请求头 `cookie: SESSDATA=…`（`scripts/update-bilibili.mjs:135`）；它的值来自 `.env:54`，由 `scripts/load-env.js` 手工解析进 `process.env`。

`package.json:16` 的 build 脚本会**先抓一次番剧数据再构建**：

```
node scripts/update-anime.mjs && astro build && pagefind --site dist && node scripts/compress-fonts.js
```

而 `pnpm dev` 不抓。运行期 `getAnimeList()` 对 JSON 模式有保护：开发环境且 `fetchOnDev` 为假时跳过读取、直接返回空数组（`src/utils/anime-data.ts:110`–`:116`）。

**这里有一个死配置需要知道**：`src/config.ts:73`（bangumi）和 `src/config.ts:78`（bilibili）都写了 `fetchOnDev`，但页面上从不读它。页码 `src/pages/anime.astro:28`–`:30` 只取 `siteConfig.anime.mode`，源码配置则来自 `getAnimeSourceConfigs()`；该函数把 bilibili / bangumi 的 `fetchOnDev` **硬编码为 `undefined`**（`src/utils/anime-data.ts:85`、`:91`），运行期再 `?? false` 兜底（`src/utils/anime-data.ts:109`）。所以 JSON 模式在 dev 下**永远**走「跳过、返回空数组」，与 `src/config.ts` 里填的 `false` / `true` 无关。要看调试数据只能先 `astro build` 生成 JSON。

> 反直觉点：`src/data/anime.ts`（手写）**不在** .gitignore 里；被忽略的是生成物 `bilibili-data.json` / `bangumi-data.json`。别把「anime 数据」一概当成生成物。

---

## 10. 评论系统与 comment 字段

评论总开关在 `src/config.ts:428`，`commentConfig.enable` 当前为 `false`（`src/config.ts:429`），系统选 `twikoo` 或 `giscus`（`src/config.ts:430`，两套配置分别在 `:431`、`:435`）。

真正的显示条件是两层与运算（`src/components/comment/index.astro:35`）：

```
commentConfig.enable && commentEnabled && path
```

其中 `commentEnabled` 是文章级开关（`src/components/comment/index.astro:31`，取自 frontmatter 的 `comment`，默认 `true`），`path` 由文章 id 或传入的 `customPath` 决定（`src/components/comment/index.astro:17`–`:19`）。也就是说：**站点级 `commentConfig.enable` 为 false 时，任何文章的 `comment: true` 都没用**；要开评论区，两层都得放行。评论组件用 `Comment path="/about/"` 这种形式也挂在 `/about`、`/friends` 上（`src/pages/about.astro:40`、`src/pages/friends.astro:141`）。

---

## 11. 内容分离机制（重点，新人极易踩）

**文档描述的是一套设计，代码跑出来的是另一套结果。**

### 11.1 脚本读什么

`scripts/sync-content.js` 开头 `loadEnv()`（`scripts/sync-content.js:11`）后读三个变量（`scripts/sync-content.js:15`–`:17`）：

- `ENABLE_CONTENT_SYNC`：`process.env.ENABLE_CONTENT_SYNC !== "false"`，即**不设置时默认启用**；
- `CONTENT_REPO_URL`：默认空串；
- `CONTENT_DIR`：默认 `rootDir/content`。

`scripts/load-env.js:10`–`:28` 是本项目**自写的 .env 解析器**（不依赖 dotenv），逐行 `KEY=VALUE`、去引号，但不剥离行内注释。当前 `.env`：`ENABLE_CONTENT_SYNC=true`（`.env:13`）、`CONTENT_REPO_URL=https://github.com/MLFK-MLFK/Mizuki-MLFK.git`（`.env:19`）、`CONTENT_DIR=./content`（`.env:23`）。

`package.json:8`–`:9` 把 `sync-content.js` 挂在 `predev` 和 `prebuild` 上（带 `|| true`，失败不阻断）。所以 **`pnpm dev` / `pnpm build` 每次都会先跑它**。

### 11.2 脚本做什么

- `ENABLE_CONTENT_SYNC` 为假 → 打印提示后 `process.exit(0)`（`scripts/sync-content.js:22`–`:29`）；
- `CONTENT_DIR` 不存在且无 `CONTENT_REPO_URL` → 打印警告后 `exit(0)`（`scripts/sync-content.js:36`–`:42`）；
- `CONTENT_DIR` 不存在但有 URL → `git clone --depth 1`（`scripts/sync-content.js:44`–`:50`）；
- 已存在且含 `.git` → 依次 `git stash push --include-untracked`（`:63`）、`git fetch --all --prune`（`:69`）、探测 `origin/main` / `origin/master`（`:75`–`:80`）、`git checkout` + `git reset --hard`（`:83`–`:84`）；
- 逐个源目录处理四个映射（`scripts/sync-content.js:96`–`:101`）：

  | 源（`content/` 下） | 目标（仓库内） |
  |---|---|
  | `posts` | `src/content/posts` |
  | `spec` | `src/content/spec` |
  | `data` | `src/data` |
  | `images` | `public/images` |

  源目录不存在 → 打印「跳过不存在的源目录」并 `continue`（`scripts/sync-content.js:107`–`:110`）；存在 → 备份非符号链接目标为 `*.backup`（`:113`–`:122`）、删旧链接（`:125`–`:127`）、建 `junction` 目录联接（`:131`–`:133`），失败则递归复制（`:135`–`:136`）；
- **结尾（`scripts/sync-content.js:141`–`:167`）无论前面是否真的复制了什么，都会在仓库根执行 `git add .`（`:157`）+ `git commit -m "chore(content): sync <branch>@<hash>"`（`:159`–`:162`）。** 没变化时 commit 失败被 catch，打印「没有变化，跳过提交」。

### 11.3 当前实际状态

仓库根存在 `content/`，但它是**代码仓库自己的克隆**——`CONTENT_REPO_URL` 就指向代码仓库本身（`.env:19`），且 `content/` 被 `.gitignore:25` 的 `/content/` 规则忽略（`git check-ignore -v content` → `.gitignore:25`）。

实测 `content/` 顶层只有 `docs/ public/ scripts/ src/` 等代码目录，映射要的四个源目录**全部不存在**（`content/src/content/posts` 是有的，但脚本找的是 `content/posts`）。后果：四个映射**全部走「跳过不存在的源目录」分支**，既不备份、不建链接、不复制。`src/content/posts`、`src/data`、`public/images` 仍是普通目录，内容分离在本地**实际没有生效**。

那 `sync-content.js` 实际起的作用就只剩结尾那段 `git add .` + `git commit`（`scripts/sync-content.js:157`–`:162`）。这正是「不要跑 `pnpm dev` / `pnpm build`」这条禁忌的来源：`predev`/`prebuild` 会调它，它会把工作区里所有改动无提示地提交。需要检查 / 构建请改用 `npx astro check`、`npx astro build`。

### 11.4 文档 vs 实际

| 文档描述 | 代码实际 |
|---|---|
| `ENABLE_CONTENT_SYNC` 未设置时默认 `false`（`docs/CONTENT_SEPARATION.md:66`） | 代码默认**启用**，只有显式为 `"false"` 才关闭（`scripts/sync-content.js:15`） |
| 支持 `USE_SUBMODULE=true` 的 submodule 模式（`docs/CONTENT_REPOSITORY.md:98`、`:108`、`:184`、`:240`） | `sync-content.js` **完全不读 `USE_SUBMODULE`**，代码里没有这个变量 |
| 提供 `pnpm run check-env` 检查环境变量（`docs/CONTENT_SEPARATION.md:370`） | `package.json` 里**没有** `check-env` 脚本 |
| 内容仓库应包含 `posts/ spec/ data/ images/`（`docs/CONTENT_REPOSITORY.md`） | 当前 `content/` 是代码仓库克隆，这四个目录都不存在 |
| 映射用「符号链接**或**复制」（设计意图） | Windows 下实际优先 junction，失败才复制（`scripts/sync-content.js:131`–`:136`）；但当前连源目录都没有，两者都没发生 |

结论：`docs/CONTENT_REPOSITORY.md`、`docs/CONTENT_SEPARATION.md` 描述的是**面向「独立内容仓库」的设计意图**，当前仓库处于「`CONTENT_REPO_URL` 误指向代码仓库、分离未生效、脚本退化成自动提交器」的实际状态。以代码为准。

---

## 12. 本项目特有约定速查

- **封面字段是 `image` 不是 `cover`**；`cover` 只出现在 anime / 结构化数据里。
- **就地下写集合条目**：`getSortedPosts()` 把上下篇写回 `data`（`src/utils/content-utils.ts:48`–`:55`），这是刻意设计而非 bug。
- **barrel 导出**：`src/components/features/posts/index.ts`、`src/components/features/auth/index.ts` 等把组件聚合成入口，页面从 `@components/features/posts` 一把 import（如 `src/pages/posts/[...slug].astro:5`–`:12`）。
- **路径别名**：`@/`、`@components/`、`@utils/`、`@i18n/`、`@layouts/`、`@constants/`、`@assets/`（`tsconfig.json:17`–`:25`），同一文件里混用相对路径与别名是常态。
- **构建期 vs 运行期**：番剧 JSON 在 `astro build` 阶段（被 `package.json:16` 抢先执行）抓取；`draft` 过滤以 `import.meta.env.PROD` 为界；JSON 模式的 `fetchOnDev` 是死配置，dev 下永远返回空。
- **PAGE_SIZE / HOME_PATH**：分页 8 篇（`src/constants/constants.ts:1`），文章列表挂 `/home/`（`src/constants/constants.ts:14`）。

---

## 相关文件

- `src/content.config.ts` — 两个内容集合（posts/spec）的 loader 与 frontmatter schema，本块的中心文件。
- `src/content/posts/` — 文章目录，含单文件与「子目录 + index.md」两种形式。
- `src/content/spec/about.md` — `/about` 的正文来源。
- `src/content/spec/friends.md` — `/friends` 底部说明（当前为空文件）。
- `src/utils/content-utils.ts` — 文章查询、排序、标签/分类统计、相关推荐的唯一入口。
- `src/utils/url-utils.ts` — 文章/标签/分类 URL 生成规则。
- `src/utils/permalink-utils.ts` — permalink 与 `%post_id%` 占位符支持。
- `src/utils/anime-data.ts` — 番剧数据加载与 local/bilibili/bangumi 模式分派。
- `src/constants/constants.ts` — `PAGE_SIZE`、`HOME_PATH` 等常量。
- `src/pages/index.astro` — 起始页，占据根路径 `/`。
- `src/pages/home/[...page].astro` — 分页文章列表（原首页，现挂 `/home/`）。
- `src/pages/archive.astro` — 归档页，`client:only` 的 Svelte 面板。
- `src/pages/posts/[...slug].astro` — 单篇文章渲染，含加密/海报/上下篇逻辑。
- `src/pages/[...permalink].astro` — 走自定义/全局 permalink 的文章渲染。
- `src/pages/about.astro`、`src/pages/friends.astro` — spec 集合的两个消费页面。
- `src/pages/rss.xml.ts`、`src/pages/atom.xml.ts` — 两个订阅出口。
- `src/pages/api/allPostMeta.json.ts`、`src/pages/api/calendar-data.json.ts` — 供前端组件用的 JSON 接口。
- `src/components/comment/index.astro` — 评论两层开关的汇合点。
- `src/components/features/auth/Encryptor.astro`、`PasswordProtection.astro` — 文章加密的服务端/客户端两半。
- `src/plugins/` — 自写的 remark/rehype 插件与 mermaid 运行时脚本，扩展语法的实现处。
- `src/data/anime.ts`、`projects.ts`、`skills.ts`、`timeline.ts`、`friends.ts`、`diary.ts`、`devices.ts` — 各页面的手写结构化数据。
- `_frontmatter.json` — Front Matter CMS 编辑器 schema（字段名与 Astro schema 有出入）。
- `scripts/new-post.js` — `pnpm new-post` 的实现，生成文章模板。
- `scripts/sync-content.js` — 内容分离同步脚本（当前实际退化为自动提交）。
- `scripts/load-env.js` — 自写 .env 解析器。
- `scripts/update-anime.mjs` — 番剧数据抓取的调度器；`update-bilibili.mjs`、`update-bangumi.mjs` 是两个抓取实现。
- `.env`、`.env.example` — 环境变量（含 `BILI_SESSDATA`、内容仓库配置）。
- `.gitignore` — 忽略 `/content/`、生成 JSON、`myself.*` 的位置。
- `docs/CONTENT_REPOSITORY.md`、`docs/CONTENT_SEPARATION.md` — 内容分离的设计文档（与实际状态有出入）。
