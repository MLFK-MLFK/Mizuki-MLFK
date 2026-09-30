# 1AI · 项目上手手册

这是给**下一位接手这个仓库的人**写的。目标：不用翻遍 250 多个组件文件，也能在一小时内
知道这个站怎么跑起来、东西都在哪、以及哪些地方埋着雷。

文档是照着「先跑起来 → 再看全局 → 再钻具体模块」的顺序排的。**不要从 01 顺着读到 13** ——
按下面的路径走更省时间。

---

## 先读这三页

| 顺序 | 文件 | 读完你会知道 |
| --- | --- | --- |
| 1 | [00-quickstart.md](00-quickstart.md) | 怎么跑起来，以及**哪两条命令千万不能敲** |
| 2 | [13-pitfalls-and-troubleshooting.md](13-pitfalls-and-troubleshooting.md) | 前人踩过的坑：自动提交、Swup 陷阱、根字号缩放、仓库里已坏的几处 |
| 3 | [01-architecture.md](01-architecture.md) | 全局地图：技术栈、渲染模型、一次请求的完整链路 |

**如果只读一页，读 [13-pitfalls-and-troubleshooting.md](13-pitfalls-and-troubleshooting.md)。**
里面第一节（两条命令会自动 `git commit`）能直接避免你丢掉未提交的改动。

---

## 30 秒速览

- **是什么**：Astro 6 的纯静态个人博客，主题源自 Mizuki / Fuwari。
  线上域名是 `https://mlfk.pages.dev/`（`src/config.ts:29`），仓库里同时躺着
  `vercel.json` 和 `public/_headers` 两套部署配置 —— 到底以哪套为准，见
  [10-build-and-deploy.md](10-build-and-deploy.md)。
- **怎么跑**：`pnpm install` → `pnpm start`（**不要**用 `pnpm dev`，理由见下）。
- **最重要的约定**：站点根 `/` 是**起始页**（开屏动画），文章列表在 `/home/`。
  代码里判断首页一律用 `src/constants/constants.ts` 的 `HOME_PATH`，不要写死 `"/"`。
- **最大的陷阱**：`pnpm dev` / `pnpm build` 会触发 `predev` / `prebuild` 钩子跑 `scripts/sync-content.js`，
  该脚本结尾执行 `git add .` 加 `git commit` —— **你未提交的改动会被自动提交掉**。
  安全替代：`pnpm start` / `npx astro build` / `pnpm check`。
- **本机没有 Python**，也没有 Playwright 模块。处理 JSON 用 `node -e`。

---

## 全部文档

### 通览

| 文件 | 内容 |
| --- | --- |
| [00-quickstart.md](00-quickstart.md) | 环境、命令、危险命令替代方案、「我要改 X 去哪改」对照表 |
| [01-architecture.md](01-architecture.md) | 技术栈与版本、静态输出 + Swup 无刷新如何共存、岛屿架构、请求链路、分层约定 |
| [02-directory-map.md](02-directory-map.md) | 目录地图：每个目录干什么、`src/components` 八个分层各自放什么 |
| [12-dependencies-and-services.md](12-dependencies-and-services.md) | 外部依赖分类、第三方服务接入点与所需密钥、各服务挂了会怎样 |

### 核心机制

| 文件 | 内容 |
| --- | --- |
| [03-config.md](03-config.md) | `src/config.ts` 全部配置块、`content.config.ts` 的 frontmatter schema、`constants/` |
| [04-routing-and-pages.md](04-routing-and-pages.md) | URL 与源码文件的对应、`/` 与 `/home/` 的分工、分页、permalink、OG 图 |
| [05-layouts-and-shell.md](05-layouts-and-shell.md) | `Layout` / `MainGridLayout` 的职责链、导航条与侧栏、浮动控件 |
| [06-components.md](06-components.md) | 组件分层规范、文件组织范式、组件间通信、三个重型子系统 |
| [07-styling.md](07-styling.md) | Tailwind v4（没有配置文件）、Stylus 变量、主题色体系、根字号缩放陷阱 |
| [08-client-scripts-and-swup.md](08-client-scripts-and-swup.md) | Swup 配置与 `ignore` 语义、生命周期事件、`src/scripts` 与 `src/utils` 职责表 |

### 内容与交付

| 文件 | 内容 |
| --- | --- |
| [09-content-and-data.md](09-content-and-data.md) | 写文章、frontmatter 字段、`src/data/` 结构化数据、内容分离机制的**当前真实状态** |
| [10-build-and-deploy.md](10-build-and-deploy.md) | 完整构建链、Pagefind、字体压缩、Vercel、CI 工作流的实际状态 |
| [11-feature-index.md](11-feature-index.md) | 「站上看到的每个功能，代码在哪」的对照索引 |
| [13-pitfalls-and-troubleshooting.md](13-pitfalls-and-troubleshooting.md) | 踩坑手册 + 「症状 → 先查什么」排查表 |

---

## 这份文档的时效性

写于 2026-10-01，对应 `master` 分支 `37a868d`。文中的 `路径:行号` 都是当时实测的，
文件改动后行号会漂。发现对不上，以源码为准，顺手把这一页也更新掉。

如果要核实某条说法，最快的办法是直接 grep 文档里给的那个路径和行号。

---

## 相关文件

- `../README.md` —— 项目自己的 README（面向访客与使用者，不是面向开发者）
- `../docs/` —— 仓库自带的技术文档，重点是 `docs/rule/` 下的组件与样式规范，与本文档互为补充
