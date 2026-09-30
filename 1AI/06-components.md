# 06 · 组件体系

`src/components/` 是全仓库最大的一块：259 个文件、9 个目录。这篇笔记讲清四件事——目录到底怎么分层（和 `docs/rule/` 里写的并不一致）、单个组件的文件组织与导出、组件之间靠什么通信、以及新写一个组件到底要动哪些文件。凡是要改 `src/components/` 下的文件、往侧栏接一个小部件、或想复用现成原子组件之前，都应该先翻这篇。

文中路径都相对仓库根目录，行号是写这篇时真实读到的位置。

内容从「目录怎么分层」讲到「运行时怎么装配」，最后给一份逐步清单和一份反直觉清单。如果你只关心某一件事：改单个组件看第二、三节，接侧栏小部件看第七、十节，排查水合报错看第六节。

## 一、目录分层：实际是 9 个目录，没有顶层 `molecules/`

`docs/rule/01-component-architecture.md:14` 画的是教科书式的原子设计链路：

```
atoms (原子) → molecules (分子) → organisms (有机体) → pages (页面)
```

文档对各层的定义在 `docs/rule/01-component-architecture.md:67`（molecules 小节，`:72` 写「由 2-5 个原子组件组合」）、`:124`（organisms）、`:150`（widgets，定义成「介于分子和有机体之间」）；`docs/rule/03-file-organization-architecture.md:98` 的完整目录树里也画了 `molecules/`。

**但 `src/components/` 下根本没有 `molecules/` 目录。** 实际有 9 个目录，加顶层 `src/components/index.ts` 正好 259 个文件：

| 目录 | 文件数 | 真实职责 | 代表组件（源码位置） |
|------|-------|---------|---------------------|
| `atoms/` | 34 | 无业务逻辑、只吃 props 的最小 UI 单元 | `src/components/atoms/Image/Image.astro`（被 8 处跨层复用）、`src/components/atoms/typewriter-text/TypewriterText.astro` |
| `common/` | 1 | 跨层共用的「准原子」展示件，比 atoms 稍重但没业务 | `src/components/common/FloatingButton.astro`（被 `src/components/control/BackToHome.astro:2`、`src/components/control/BackToTop.astro:2`、`src/components/features/toc/FloatingTOC.astro:6` 三处复用） |
| `control/` | 14 | 页面级控件：主题、布局、进度条、回顶、悬浮控制条 | `src/components/control/ThemeSwitch.svelte`、`src/components/control/FloatingControls.astro` |
| `features/` | 106 | 按业务域聚合的功能组件集合，22 个子目录 | `src/components/features/posts/PostCard.astro`、`src/components/features/toc/` |
| `layout/` | 4 | 站点骨架：横幅、左右侧栏容器 | `src/components/layout/SidebarColumn.astro`、`src/components/layout/RightSideBar.astro` |
| `misc/` | 14 | 不好归类但全局共用的组件与工具 | `src/components/misc/ListContainer.astro`、`src/components/misc/ConfigCarrier.astro` |
| `organisms/` | 8 | 由下层组件装配出的区块 | `src/components/organisms/navigation/Navbar.astro`、`src/components/organisms/footer/Footer.astro` |
| `widgets/` | 73 | 侧栏 / 悬浮的「可开关小部件」，多数由 `config.ts` 决定显隐 | `src/components/widgets/calendar/`、`src/components/widgets/music-player/` |
| `comment/` | 4 | 评论系统适配壳（Twikoo / Giscus），见第八节 | `src/components/comment/Twikoo.astro` |

**放什么、不放什么的经验规则**（从代码反推，不是文档抄的）：

- `atoms/` 只收「给 props 就渲染」的东西。边界例子：`src/components/atoms/Badge/Badge.svelte` 只有 `value`/`class` 两个 prop；`src/components/atoms/tag-chip/TagChip.svelte:9` 已经能接受 `<Snippet>`。凡是需要读 `siteConfig`、`await` 内容集合、或发网络请求的，一律不许进 `atoms/`。
- `control/` 是**正在被淘汰的层**。`src/components/control/index.ts:6-7` 明确写着「These are legacy wrapper components. For new development, prefer atoms/Button with appropriate variants.」；`src/components/control/ButtonLink.astro:8` 也重复了这句。新按钮别再往这里加。
- `widgets/` 的目录名**就是**配置里 `sidebarLayoutConfig.components` 用的字符串名（`profile`、`calendar`、`music-sidebar`……），二者靠 `src/components/layout/SidebarColumn.astro:44` 的 `componentMap` 手工对上。往 `widgets/` 加目录意味着配置侧也要同步改，见第七节。
- `widgets/toc/` 是**弃用壳**：`src/components/widgets/toc/index.ts:1-9` 说它只是包装器，真正的 TOC 在 `features/toc/`，且明说「此包装器将在下一个主要版本中删除」。`src/components/widgets/common/index.ts:1-13` 里重导出的 `Badge`/`Chip`/`TagChip` 同样标了 `@deprecated`，指向 `atoms/` 对应组件。
- `atoms/Icon/` 目录**有间接消费者**：`src/components/misc/Icon.astro:11-12` 是它的向后兼容包装器（`import BaseIcon from "../atoms/Icon/Icon.astro"`、`import type { IconProps } from "../atoms/Icon/types"`）。真正没人用的是 `src/components/atoms/Icon/index.ts:1` 这个 barrel，以及走它的导入。图标实际主要走 `astro-icon/components`（44 个 `.astro` 文件）和 `@iconify/svelte`（24 个 `.svelte` 文件），这与 `docs/rule/07-icon-usage-specification.md:1-19` 的「`.astro` 用 astro-icon、`.svelte` 用 @iconify/svelte」一致，注意两种写法的属性名不同（`name` vs `icon`）。

> 与文档的出入（以代码为准）：`molecules/` 层在顶层不存在；「widgets 是介于分子和有机体之间」的说法在这里没意义，因为 `widgets/` 是**按配置驱动的侧栏装配位**，不是复杂度层级。`docs/rule/03-file-organization-architecture.md:124-126` 把 `Profile.astro`、`Calendar.astro` 画成 `widgets/` 下的单文件，实际两者都是目录：`widgets/profile/` 里只有纯 Astro 的 `Profile.astro` + `index.ts`，**没有 Svelte 主体**；只有 calendar 才是 Astro 壳 + Svelte 主体（`widgets/calendar/Calendar.astro` + `Calendar.svelte`）。

## 二、单个组件的文件组织：主文件 + barrel + types

绝大多数「正经」组件目录长这样（以 Button 为例）：

```
src/components/atoms/Button/
├── Button.astro      # 主组件
├── index.ts          # barrel
└── types.ts          # Props 类型
```

### barrel 的两种写法

单组件目录（`src/components/atoms/Button/index.ts:1-2`）：

```ts
export { default as Button } from "./Button.astro";
export * from "./types";
```

多层目录逐级再汇总：`src/components/atoms/index.ts:1-11` 把 11 个子目录各 `export *` 一遍；`src/components/index.ts:1-29` 又在上层汇总一次（atoms + features 若干 + organisms + widgets 若干）。

**关键真相：上层 barrel 实际上没人 import。** 全仓库搜不到 `from "@/components"`、`from "../components"`、`from "@components"` 这类导入，所以 `src/components/index.ts` 这层是**只读的目录索引**，不是运行时入口。同理，`atoms/Button/index.ts`、`atoms/Badge/index.ts` 这些单组件 barrel 也没有外部消费者——消费者一律深链到 `.astro`/`.svelte` 本体（`src/components/features/posts/PostCard.astro:10` 写的是 `from "../../atoms/Image/Image.astro"`）。

真正**被用起来**的 barrel 有两类：

1. **同目录 `./types`**：全仓库出现 61 次，是最高频的用法（类型集中一处，组件和消费者都从 `./types` 取）。
2. **feature / organism / widget 级 barrel**：给 `src/pages/` 用，例如 `src/pages/albums.astro:3` 的 `import { AlbumCard } from "@components/features/albums"`、`src/components/layout/SidebarColumn.astro:2` 的 `import { SidebarTOC } from "@components/features/toc"`。

**barrel 不是硬性约定。** 有 5 个目录有组件却没有 `index.ts`：`common/`、`features/devices/`、`features/friends/`、`features/landing/`、`widgets/feed/`。下面第十节的清单里要按「你是不是给 pages / 跨层复用」来决定补不补 barrel。

### types.ts 与三种 props 写法

同一仓库并存三种给 props 标类型的写法，都合法：

| 写法 | 例子 | 备注 |
|------|------|------|
| 内联 `interface Props` + `const {...} = Astro.props` | `src/components/misc/ListContainer.astro:4-11` | `.astro` 中 65 个文件含 `interface Props`（62 个 `interface Props {` + 3 个 `interface Props extends`） |
| 从 `./types` 导入 + `: XProps = Astro.props` | `src/components/atoms/Button/Button.astro:2` 与 `:10` | 类型单独放 `types.ts` |
| 从 `./types` 导入 + `Astro.props as XProps` | `src/components/features/section-title/SectionTitle.astro:9`、`src/components/features/posts/PostCard.astro:14` | 断言式，无默认值解构 |

类型文件命名也有两种：`types.ts`（多数）和 `types/toc.ts` / `types/calendar.ts`（TOC、Calendar 这种重型子系统，让 `types.ts` 退化成一行兼容转发，见 `src/components/widgets/calendar/types.ts:1-2`）。

## 三、路径别名与导入风格

别名定义在 `tsconfig.json:17-25`：

| 别名 | 指向 | 使用情况 |
|------|------|---------|
| `@components/*` | `src/components/*` | 组件，76 次 |
| `@assets/*` | `src/assets/*` | `tsconfig.json:20`，**全仓库 0 次使用** |
| `@constants/*` | `src/constants/*` | 4 次 |
| `@utils/*` | `src/utils/*` | 18 次 |
| `@i18n/*` | `src/i18n/*` | 36 次（最高频，`i18nKey` / `translation` 到处用） |
| `@layouts/*` | `src/layouts/*` | 15 次 |
| `@/*` | `src/*` | 兜底，含 `@/config` 21 次、`@/utils` 29 次、`@/constants` 11 次 |

按上述别名前缀合计约 248 次。注意 `@layouts/*` 指向 `src/layouts/`，**不是** `src/components/layout/`——两者同名不同物，是新人最容易搞混的一对。

实测导入风格（`src/` 全量）：

| 风格 | 次数 | 结论 |
|------|------|------|
| 相对路径（`./` `../`） | 610 | 绝对主流 |
| 别名（`@components/`、`@/*` 等） | 约 248 | 次要 |
| 其中 `src/components/` 内部：相对 vs 别名 | 462 vs 146 | 约 3:1，组件内部**优先相对** |
| `@components/` vs `@/components/` | 76 vs 8 | 同义别名，前者更常用 |

真实结论：**组件内部（同目录、相邻目录）几乎都写相对路径**（`src/components/layout/SidebarColumn.astro:8-16` 从 `../widgets/...` 逐个相对引入，却用 `@components/features/toc` 引入跨层的 toc，是典型混搭）；**跨层、跨 feature 时用 `@components/...` 别名**。文档没硬性规定，现状就是「就近相对，跨层别名」。

## 四、组件间通信与状态

### 4.1 Props 约定

- Astro → Astro：标准 `Astro.props`，默认值写在解构里（`src/components/atoms/Button/Button.astro:5-9`）。
- Astro → Svelte：Astro 端把服务端算好的数据当 props 传下去，Svelte 端用 `$props()` 接。典型：`src/components/widgets/calendar/Calendar.astro:15-41` 在构建期用 `i18n()` 算好 12 个月名、7 个星期名、年后缀，再通过 `client:visible` 传给 `src/components/widgets/calendar/Calendar.svelte:31-37`。Calendar.svelte 走 props 注入只是这一处的样板；仓库里多数 Svelte 组件其实直接 `import { i18n } from "@i18n/translation"`（如 `src/components/control/LayoutSwitch.svelte:3`、`src/components/features/archive/ArchivePanel.svelte:3`、`src/components/organisms/navigation/Search.svelte:3`）。
- 回调也是 props：Svelte 里把函数当普通 prop 传，用简写 `{onclick}`（`src/components/widgets/music-player/atoms/PlayButton.svelte:4-18`），命名统一用 `onXxx`（`src/components/widgets/music-player/organisms/MiniPlayer.svelte:12-29` 一口气接了 `onCoverClick`/`onInfoClick`/`onHideClick`/`onExpandClick`）。

### 4.2 Slot

Astro 的 slot 用得很克制，全仓库只有 7 个组件用了 `<slot`：

- 命名 slot 只出现一次：`src/components/widgets/common/WidgetLayout.astro:33` 定义了 `<slot name="title-icon" />`，默认内容走 `:44` 的 `<slot />`。这是「统一小部件外壳」的复用点——所有 `widgets/*` 都套 `WidgetLayout`（如 `src/components/widgets/categories/Categories.astro:29-48`）。
- 页面级命名 slot：`src/layouts/Layout.astro:185` 的 `<slot name="head" />`，由页面用 `<Fragment slot="head">` 填充（`src/pages/index.astro:48`）。

### 4.3 事件：靠 window / document 自定义事件，不靠框架

**没有 `createEventDispatcher`**（全仓库 0 次）。跨层、跨框架（Astro ↔ Svelte）的通信一律走 DOM 事件：

| 事件名 | 派发方 | 监听方 | 用途 |
|--------|-------|--------|------|
| `layoutChange` | `src/components/control/LayoutSwitch.svelte:30`、`src/scripts/anime-layout-handler.ts:189` | `src/components/features/posts/PostPage.astro:120`、`src/pages/anime.astro:316`、`src/scripts/right-sidebar-layout.js:21` | 列表 / 网格布局切换 |
| `music-sidebar:state` | `src/stores/musicPlayerStore.ts:575` | `src/components/widgets/music-sidebar/SidebarMusicClient.svelte:25`、`src/components/control/FloatingControls.astro:427` | 播放器状态广播给侧栏部件和悬浮控制条 |
| `password:unlock` / `password:error` / `password:loading` / `password:clear-error` | `src/components/features/auth/PasswordModal.svelte:13-18`、`src/components/features/auth/PasswordProtection.astro:82-93` | 对方文件互相监听 | 密码解锁流程 |
| `pagefindready` / `pagefindloaderror` | `src/components/organisms/navigation/Navbar.astro:301`、`:309` | `src/components/organisms/navigation/Search.svelte:167-171` | Pagefind 搜索就绪 |
| `mermaid:render:start` / `mermaid:render:done` | 外部脚本 | `src/components/control/FloatingControls.astro:428-432` | 悬浮控件让位 |

此外大量组件监听 swup / Astro 的生命周期事件（`astro:page-load`、`swup:contentReplaced`、`swup:enable`、`popstate`）。跨页导航时组件不会重新挂载，**任何只写在 `onMount` / `DOMContentLoaded` 里的初始化都必须在这些事件里再跑一遍**——`src/components/control/BackToHome.astro:51-52`、`src/components/features/posts/CategoryBar.astro:287-291` 都是这么补的。

### 4.4 Svelte 5 runes 与遗留写法

项目是 Svelte 5，主用 runes：`$props()` 37 处、`$state(...)` 31 处、`$derived(...)` 16 处、`$effect(...)` 3 处。`src/components/widgets/calendar/Calendar.svelte` 是最完整的样板：`$props()`（`:37`）、多个 `$state`（`:40-58`）、`$derived` 算网格和可见文章（`:60-112`）。事件属性主用现代写法（`onclick=`）。

但**仍有若干文件是 Svelte 4 写法**，改它们时要注意。按语法拆开数：

- `export let` 定义 props：5 个文件——`src/components/control/LayoutSwitch.svelte`、`src/components/features/archive/ArchivePanel.svelte`、`src/components/features/pio/Pio.svelte`、`src/components/features/settings/DisplaySettings.svelte`、`src/components/misc/SharePoster.svelte`。
- `$:` 响应式：3 个文件——`LayoutSwitch.svelte`、`src/components/control/MusicFabButton.svelte`、`DisplaySettings.svelte`。
- `on:` 绑事件：全仓库仅 5 处——`src/components/control/LayoutSwitch.svelte:175`（`on:click`）、`src/components/control/LayoutSwitch.svelte:183`（`on:animationend`）、`src/components/control/MusicFabButton.svelte:42`、`src/components/features/settings/DisplaySettings.svelte:48`、`src/components/widgets/music-player/MusicPlayer.svelte:199`。

并集是 7 个文件。注意 `MusicFabButton.svelte` **没有** `export let`（它只有 `let state` + `$:`，属另一种遗留），别把它算进 export let 那一类。

### 4.5 `musicPlayerStore` 不是 Svelte store

`src/stores/musicPlayerStore.ts` 名字骗人：它 **不 import `svelte/store`**（全仓库 `svelte/store` 0 次），而是一个手写单例类 `class MusicPlayerStore`（`:47`），自己维护 `listeners` 集合、提供 `subscribe()`（`:97`）和快照 `getState()`（`:89`）。

两条消费路径并存，要分清楚：

- `MusicPlayer.svelte` / `MusicFabButton.svelte` 走 **类订阅**：`musicPlayerStore.subscribe(...)` 放在 `onMount` 里（`src/components/widgets/music-player/MusicPlayer.svelte:184-189`），状态存进普通变量、靠 Svelte 重新渲染。因此这些组件里**没有 `$state`**。
- `SidebarMusicClient.svelte` 走 **window 事件**：`let state = $state(...)`（`src/components/widgets/music-sidebar/SidebarMusicClient.svelte:14`），在 `onMount` 里 `window.addEventListener("music-sidebar:state", ...)`（`:25`）。但注意它**不是纯事件消费**——同一文件还直接 import 并对 store 调 `getState()`/`toggle()`（`:5`、`:14`、`:38`）。广播方在 `src/stores/musicPlayerStore.ts:565-580` 的 `broadcastState()`。

**另外 `src/components/widgets/music-player/hooks/*.ts`（`useAudioPlayer` / `usePlayerState` / `useVolumeControl` / `useKeyboardShortcuts` / `usePlaylist`）是死代码**：除 `useVolumeControl.ts:2` 引用了 `useAudioPlayer` 的**类型**外，全仓库没有一处 import 它们。状态早已搬到 `src/stores/musicPlayerStore.ts`。

## 五、三个重型子系统的输入输出边界

### 5.1 `widgets/music-player/` —— 唯一严格三级分层的子系统

`atoms/`（10 个 `.svelte`，无 `index.ts`）→ `molecules/`（4 个）→ `organisms/`（3 个）+ 顶层 `MusicPlayer.svelte` 装配，是 `docs/rule/01-component-architecture.md:247` 「复杂组件子目录」范式的**唯一真实落地**。

| 层 | 文件 | 边界 |
|----|------|------|
| 顶层 | `MusicPlayer.svelte` | 唯一持有 store 订阅；决定渲染 `default` 还是 `fab` 形态（`:19-23`） |
| organisms | `MiniPlayer` / `PlayerBar` / `Playlist` | `MiniPlayer.svelte:12-15` 全是 `onXxx` 回调，自己不碰 store |
| molecules | `PlayerControls` / `ProgressControl` / `TrackDisplay` / `VolumeControl` | 只组装 atoms（`PlayerBar.svelte:7-10`） |
| atoms | `CoverImage` / `ModeButton` / `NextButton` / `PlayButton` / `PlaylistItem` / `PrevButton` / `ProgressBar` / `TrackInfo` / `VolumeButton` / `VolumeSlider` | 纯展示 + 单一回调（`PlayButton.svelte:4-10`） |

输入：所有数据来自 `musicPlayerStore.getState()` 的快照或广播；输出：所有动作回到 `musicPlayerStore.xxx()`。**子组件没有独立状态**。`FabMusicPanel.svelte` 是 FAB 形态的壳。

### 5.2 `widgets/calendar/` —— Astro 壳 + Svelte 主体 + 构建期/运行期分工

- 输入边界一：`src/components/widgets/calendar/Calendar.astro:15-41` **构建期**算出 `monthNames` / `weekDays` / `yearSuffix`（用 `i18n()`，当时 `window` 不存在），当 props 注入。
- 输入边界二：`src/components/widgets/calendar/Calendar.svelte:117` 在 `onMount` 后 `fetch("/api/calendar-data.json")`——数据来自 `src/pages/api/calendar-data.json.ts`，不内联进组件。
- 子组件在 `components/`（`CalendarGrid` / `CalendarHeader` / `MonthPicker` / `PostList` / `SelectionPanel` / `YearPicker`），barrel 在 `src/components/widgets/calendar/components/index.ts:1-6`。
- 逻辑在 `hooks/useCalendar.ts`（`getFirstDayOfMonth` / `processPostsData` / `getCurrentPostId` 等纯函数，`src/components/widgets/calendar/hooks/useCalendar.ts:8` 起）。**注意 `utils/calendarUtils.ts` 是重复的死代码**——函数与 `hooks/useCalendar.ts` 重叠，且无任何 importer。
- 类型在 `types/calendar.ts`，`types.ts` 只做转发。

### 5.3 `features/toc/` —— 三套并存实现，Web Component 驱动

TOC 是历史包袱最重的一块，新人必须知道「同一件事有好几份实现」：

| 位置 | 形态 | 用途 |
|------|------|------|
| `src/components/features/toc/SidebarTOC.astro` | **Web Component**：`<table-of-contents>`，`class TableOfContents extends HTMLElement`（`:39`），`customElements.define` 在 `:341` | 侧栏目录，IntersectionObserver 高亮 |
| `src/components/features/toc/MobileTOC.svelte` | Svelte 5 移动端抽屉 | 移动端目录 + 首页文章列表 |
| `src/components/features/toc/FloatingTOC.astro` | Astro 悬浮按钮 | 复用 `common/FloatingButton` |

- 工具：`utils/toc-utils.ts`（`extractHeadings` / `generateTOCItems` / `scrollToHeading`）、`utils/toc-calculator.ts`、`utils/japanese-katakana.ts`。
- hooks：`hooks/useMobileTOC.ts`（移动端 DOM 抓取 + 配置读取）、`hooks/useFloatingTOC.ts`、`hooks/useTocHighlight.ts`、`hooks/useTocNavigation.ts`、`hooks/useTocScroll.ts`。
- 类型**两份重复**：`src/components/features/toc/types.ts:8` 和 `src/components/features/toc/types/toc.ts:5` 都定义了 `TOCItem`；barrel 只从 `types/toc` 导出（`src/components/features/toc/index.ts:18-25`），`types.ts` 那份无人引用。
- `generateTOCItems` 本身也有三份（`hooks/useMobileTOC.ts:30`、`utils/toc-utils.ts:49`、`utils/toc-calculator.ts:41` 的别名 `calcTOCItems`）。

一个典型陷阱：`src/components/features/toc/index.ts:1-6` 的注释说「Svelte 组件（MobileTOC）请从原始位置导入：`@components/MobileTOC.svelte`」——**这个路径不存在**，真实位置是 `src/components/features/toc/MobileTOC.svelte`，`Navbar.astro:13` 也是按相对路径引的。

## 六、客户端指令与水合

`config.ts` 里**没有**任何 `client:` 指令——水合只能在 `.astro` 模板里写。全仓库共 14 处：

| 指令 | 组件（位置） | 为什么这么选 |
|------|-------------|-------------|
| `client:load` | `PasswordModal`（`src/components/features/auth/PasswordProtection.astro:23`） | 全仓库唯一一处；解锁交互必须立刻可用 |
| `client:idle` | `MusicPlayer`（`src/layouts/Layout.astro:238`）、`MusicFabButton`（`src/components/control/FloatingControls.astro:23`） | 音频核心与 FAB 不阻塞首屏，浏览器空闲再挂 |
| `client:visible` | `Pio`（`src/layouts/Layout.astro:241`）、`CalendarWidget`（`src/components/widgets/calendar/Calendar.astro:49`）、`SharePoster`（`src/components/features/posts/ShareCard.astro:66`） | 进入视口才加载，省首屏 |
| `client:only="svelte"` | `Search`/`MobileTOC`/`LayoutSwitch`/`WallpaperSwitch`/`ThemeSwitch`/`DisplaySettings`（`src/components/organisms/navigation/Navbar.astro:98,101,107,115,117,123`）、`SidebarMusicClient`（`src/components/widgets/music-sidebar/MusicSidebarWidget.astro:18`）、`ArchivePanel`（`src/pages/archive.astro:49`） | 组件在服务端会碰 `window` / `localStorage` / `import.meta.env`，SSR 会炸；`client:only` 禁止服务端渲染（道理同 `docs/rule/06-sidebar-widget-dev.md:165-177` 的 Q4） |

规律：**只有「一定会在浏览器里读 window / 首次交互前无需存在」的 Svelte 组件才用 `client:only`**；能 SSR 的一律给 `client:idle`/`visible`。`Search.svelte:130` 甚至在渲染逻辑里判 `import.meta.env.PROD`，这也是它必须 `client:only` 的原因之一。

## 七、侧栏小部件的装配与运行时

这是组件体系里最容易被文档带偏的一块。注册链路是「配置 → widgetManager → SidebarColumn → componentMap」。

### 7.1 配置侧

- `src/config.ts:493` 的 `sidebarLayoutConfig` 是总入口：`properties`（`:495` 起）逐项声明每个组件的 `position`（`top`/`sticky`）、动画延迟、响应式折叠；`components.left` / `components.right` / `components.drawer`（`:586-596`）分别给出左栏、右栏、抽屉要装哪些组件、按什么顺序。
- `src/types/config.ts:368-380` 定义 `WidgetComponentType` 联合类型（`profile`/`announcement`/`categories`/`tags`/`toc`/`card-toc`/`music-player`/`music-sidebar`/`pio`/`site-stats`/`calendar`/`custom`）；`:382-393` 定义 `WidgetComponentConfig`；`:392` 的 `customProps` 用来给组件塞额外 props。

### 7.2 运行时选择逻辑：`widget-manager.ts` 里活的是哪些方法

`src/utils/widget-manager.ts` 顶部那份 `WIDGET_COMPONENT_MAP`（`:11-23`）**是过期的死表**：`:19` 的 `pio` 指向并不存在的 `../components/widget/Pio.astro`（目录名是单数 `widget`），表里也没有 `music-sidebar`；它的唯一消费者 `getComponentPath`（`:184-186`）全仓库无人调用。**注册组件请认 `SidebarColumn.astro` 的 `componentMap`，不要动这张表。**

真正在驱动渲染的 API 是：

| 方法 | 位置 | 作用 |
|------|------|------|
| `getComponentsByPosition(position, sidebar, deviceType)` | `:49-88` | 主入口。手机端强制改走 `drawer`；平板端右侧直接返回空、左侧在自身无组件时借用 `right`；再按 `properties` 里的 `position` 过滤 |
| `getAnimationDelay` | `:95-108` | 按 `defaultAnimation` 算错峰延迟 |
| `getComponentClass` / `getComponentStyle` | `:115-144` / `:151-166` | 拼 class 与内联 style |
| `isCollapsed` | `:173-178` | 按 `responsive.collapseThreshold` 判断是否折叠 |
| `shouldShowSidebar` | `:192-207` | 该设备侧栏是否有内容 |
| `getBreakpoints` | `:212-214` | 响应式断点 |

`src/utils/widget-renderer.ts:43-68` 的 `buildComponentProps` 把 `class`/`style`/`customProps`（以及 TOC 需要的 `headings`）铺开成组件 props。

### 7.3 渲染侧：`SidebarColumn.astro` 是唯一注册表

- `src/components/layout/SidebarColumn.astro:44-55` 的 `componentMap` 是**全仓库唯一的组件注册表**。`:82-95` 的 `renderComponent` 拿 `componentMap[component.type]` 查组件，查不到就返回 `null`（静默忽略），这正是漏注册时「配置了却不显示」的原因。
- `src/components/layout/RightSideBar.astro:14-23` 是**真正的薄壳**：只把 `side="right"` 和 `headings` 转发给 `SidebarColumn`。
- **但 `src/components/widgets/sidebar/SideBar.astro` 不是薄壳。** 它 176 行，除了转发 `side="left"`（`:36-45`），还自己调 `widgetManager.getComponentsByPosition` 四次（`:14-33`），并把断点、`shouldShowSidebar`、有无组件的布尔值通过 `define:vars` 注入下面的脚本（`:69-78`），再内联一段 100 行的 `SidebarManager`（`:80-176`）。

### 7.4 `SideBar.astro` 里那段 SidebarManager 做什么

它只处理左栏在浏览器里的**响应式显隐**，是注册 `componentMap` 之外的运行时行为：

- 构造时 `updateResponsiveDisplay()`（`:139-169`）按 `window.innerWidth` 与断点把 `--sidebar-{device}-display` 设成 `block`/`none`；
- 监听 `resize` 重算；
- 挂 swup 的 `content:replace`（`:104-135`，`setTimeout(..., 100)` 在 `:134`）——因为 swup 换页后 `<main>` 被替换，显隐状态要重新施加。
- 用 `__mizukiSidebarManagerInitialized` 全局标志（`:80`、`:169-175`）防重复初始化。

`src/components/widgets/sidebar/index.ts` 只有一行导出，也是薄壳。

### 7.5 `WidgetLayout.astro` 与它的 Web Component 折叠

`src/components/widgets/common/WidgetLayout.astro` 是所有侧栏小部件的统一外壳，被 `announcement` / `calendar` / `card-toc` / `categories` / `music-sidebar` / `site-stats` / `tags` 七个子目录使用：

- 它自定义了一个原生 Web Component `<widget-layout>`（`:19-24` 使用，`:69-91` 定义并 `customElements.define`）。折叠靠 `.collapse-wrapper`（`:40`）加 CSS 变量控制：`<style define:vars={{ collapsedHeight }}>`（`:63`）把高度写进 `.collapsed`。
- 折叠按钮逻辑在 Web Component 构造函数里（`:71-85`）：`data-is-collapsed="true"` 时给 `.expand-btn` 绑点击，展开即移掉 `collapsed` 并隐藏按钮自身。
- 标题走默认渲染（`:26-36`），命名 slot 只有 `title-icon`（`:33`），正文走默认 `<slot />`（`:44`）。
- 注意：`src/components/widgets/common/AccordionDrawer.svelte` 是**另一个独立组件**（用 CSS `grid-template-rows: 0fr → 1fr` 做展开动画，`:19-37`），它服务于 `widgets/music-sidebar/components/SidebarPlaylist.svelte`，**不是** `WidgetLayout` 的折叠实现。别把两者混为一谈。

### 7.6 加一个侧栏小部件的正确步骤

文档 `docs/rule/06-sidebar-widget-dev.md:86-124` 说要去 `SideBar.astro` 和 `RightSideBar.astro` 各自改一份 `componentMap`——**这在当前代码里已经过期**。真相是：

1. 在 `src/types/config.ts:368-380` 的 `WidgetComponentType` 里加字符串字面量（不改这里，`config.ts` 会 TS 报错）。
2. 在 `src/config.ts` 的 `sidebarLayoutConfig` 里配置：`properties`（`:495` 起）和 `components.left/right/drawer`（`:586-596`）。
3. **只在 `src/components/layout/SidebarColumn.astro:44-55` 的 `componentMap` 里注册一次**。左栏、右栏、抽屉现在都走这个文件——「左右栏各注册一遍」的坑已经被架构消掉了。
4. `widgets/` 的目录名要能被 `componentMap` 的 key 与配置的类型字符串对上。
5. 需要额外 props 时，加进 `WidgetComponentConfig.customProps`（`src/types/config.ts:392`），渲染时由 `buildComponentProps` 铺开。

## 八、评论系统的接入方式

`src/components/comment/` 是把 Twikoo / Giscus 包成 Astro 组件的适配层：

- **入口是 `index.astro`，不是 `index.ts`。** 四个页面直接 `import Comment from "@components/comment/index.astro"`：`src/pages/about.astro:2`、`src/pages/friends.astro:2`、`src/pages/posts/[...slug].astro:4`、`src/pages/[...permalink].astro:10`。这个命名反常（`index.astro` 同时充当目录入口和聚合组件），但这就是现状。
- `src/components/comment/index.astro:10-31` 在构建期决定用哪家：先看 `commentConfig.enable`，再看 `commentConfig.system`（`twikoo`/`giscus`，缺省时回退到 `twikoo`），最后叠加单篇文章的 `post.data.comment`（默认 `true`）。`:34-42` 据此只渲染 Twikoo 或 Giscus 之一。
- `commentConfig` 定义在 `src/config.ts:428`（`enable`、`system`、`twikoo.envId`、`giscus` 各字段），对应类型在 `src/types/config.ts:279-305`。
- `Giscus.astro:16` 与 `Twikoo.astro:19` 都用 `is:inline` + `define:vars` 把配置传给内联脚本，并用 `IntersectionObserver`（`rootMargin` 200px）懒加载：Giscus 注入 `https://giscus.app/client.js`，Twikoo 注入本地 `/assets/js/twikoo.all.min.js`。两者都挂了 swup 的 `content:replace` 重初始化，Giscus 还额外用 `MutationObserver` 跟主题明暗同步。
- `src/components/comment/index.ts:1-2` 把 `index.astro` 导出成 `CommentIndex`、把 `Twikoo.astro` 导出成 `Twikoo`——但**没有任何消费者用它**，页面一律深链 `index.astro`。这与第二节「单组件 barrel 基本无人用」是同一个现象。

## 九、构建配置与样式边界

### 9.1 决定组件能用什么能力的集成

`astro.config.mjs:54-163` 的 `integrations` 决定了组件在源码里能直接用哪些东西：

| 集成 | 位置 | 对组件的影响 |
|------|------|-------------|
| `swup(...)` | `:60-107` | 跨页换页，组件必须处理生命周期事件（4.3 节）；起始页 `/` 与 `#lp-root` 被 `ignore` 排除在 swup 之外 |
| `icon()` | `:108` | `astro-icon` 让 `.astro` 能用 `import { Icon } from "astro-icon/components"` |
| `svelte({ preprocess: vitePreprocess() })` | `:156-158` | 让 `.svelte` 组件参与构建，是 `client:*` 水合的前提 |
| `expressiveCode` / `mdx` / `sitemap` / `sentry` / `spotlightjs` | `:109-162`（`oddmisc` 见 `:55-59`） | 分别提供代码块、MDX、站点地图、错误上报、主题壳等能力 |
| `tailwindcss()`（vite 插件） | `:222` | 组件里大量 Tailwind 原子类（`card-base`、`gap-4` 等）来自这里 |

注意 **Pagefind 不在 `astro.config.mjs` 里**，它不是集成：`package.json:16` 的 build 脚本在 `astro build` 之后跑 `pagefind --site dist` 生成索引。所以搜索组件与索引之间只能靠 window 事件（`pagefindready`）衔接，而不是靠集成注入。

### 9.2 样式：Astro scoped `<style>` + 全局 CSS 变量

- 组件内样式默认写在 `<style>` 里，Astro 会做 scoped 哈希，**不污染全局**。
- 全局主题 token 在 `src/styles/variables.styl`（如 `:26` 定义 `--primary`），公共类在 `src/styles/main.css`（如 `:244` 的 `.card-base`）。组件样式里直接用 `var(--primary)` 这类变量对接主题，而不是硬编码颜色。
- 需要把「构建期算出的值」带进样式时，用 `<style define:vars={{...}}>`：`src/components/widgets/common/WidgetLayout.astro:63` 就把 `collapsedHeight` 注入 CSS 变量。
- 需要把「构建期算出的值」带进内联脚本时，用 `<script is:inline define:vars={{...}}>`：除 `ConfigCarrier`、`SideBar`、`WidgetLayout` 外，`src/components/features/posts/PostCard.astro`、`src/components/layout/Banner.astro`、`src/components/widgets/profile/Profile.astro` 等都这么干。组件里 `is:inline` 共出现在 20 个文件、`define:vars` 共出现在 17 个文件。
- 反直觉：`src/components/widgets/sidebar/SideBar.astro:47-65` 那几条媒体查询**不是给左栏自己用的**，而是给 `--sidebar-*-display` 提供默认值，真正改值的是 7.4 节的内联脚本。

## 十、新写一个组件：逐步清单

### 10.1 普通组件

1. 定层。纯 UI → `atoms/`；有业务 → `features/<域>/`；要装进侧栏 → `widgets/<名>/`；站点骨架 → `layout/`。
2. 建目录 `<Name>/`，主文件用 PascalCase：`.astro`（默认，可 SSR、能用 `astro-icon`）或 `.svelte`（需要客户端交互 / runes）。
3. 若 props 超过 3 个或会被复用，拆 `types.ts` 放 `XxxProps`（参照 `src/components/atoms/Button/types.ts:1`）。
4. 主组件里写 `interface Props`（或 `: XProps = Astro.props`）。
5. 加 `index.ts`：`export { default as Xxx } from "./Xxx.astro"; export * from "./types";`（照抄 `src/components/atoms/Button/index.ts:1-2`）。
6. **按需同步 barrel**：
   - 被 `src/pages/` 或跨层引用 → 在对应 feature/organism 级 barrel 里 `export`（如 `src/components/features/page-header/index.ts`，被 `src/pages/about.astro:3` 消费）。
   - 父目录的汇总 `index.ts`（如新 atom → `src/components/atoms/index.ts`）可加可不加；顶层 `src/components/index.ts` 本来就没人 import，加只是保持目录索引完整。
7. 需要客户端交互的 Svelte 组件：在**引用它的 `.astro`** 上补 `client:idle` / `client:visible` / `client:only="svelte"`（第六节选型表）。
8. 图标：`.astro` 里 `import { Icon } from "astro-icon/components"` 用 `name`；`.svelte` 里 `import Icon from "@iconify/svelte"` 用 `icon`。**两者属性名不同，别混。**

### 10.2 侧栏小部件

在普通组件基础上，按 7.6 节做三步配置 + 一次 `componentMap` 注册。改完务必跑 `npx astro check`。

## 十一、反直觉清单

1. **顶层 `molecules/` 不存在**；唯一的 `molecules/` 在 `widgets/music-player/molecules/`。
2. **barrel 基本没人用**，尤其是单组件目录的 `index.ts` 和 `comment/index.ts`；消费要么深链 `.astro`，要么走 feature 级 barrel。
3. **`@layouts` ≠ `components/layout`**。
4. **`musicPlayerStore` 不是 Svelte store**，没有 `writable`/`$store` 自动订阅。两条消费路径（类订阅 vs window 事件）别用混，`SidebarMusicClient` 其实两条都用了。
5. **`music-player/hooks/*.ts` 是死代码**，别照着它写新 state。
6. **`widgets/calendar/utils/calendarUtils.ts`、`features/toc/types.ts` 是重复死代码**，改 Calendar / TOC 前先确认改的是活的那份（`hooks/useCalendar.ts`、`types/toc.ts`）。
7. **侧栏注册只有一处**（`SidebarColumn.astro:44`），`RightSideBar` 是薄壳；但 **`SideBar.astro` 不是薄壳**，它还带响应式显隐脚本。
8. **`widgets/toc/`、`widgets/common/` 的 Badge/Chip/TagChip、`control/` 的 ButtonLink/ButtonTag 都是 `@deprecated`**，新代码别引用。
9. **`client:only` 不是随便加的**，是给会在 SSR 触碰 `window` 的组件兜底。
10. **Pagefind 不是 Astro 集成**，是 build 后的 CLI 步骤；搜索就绪只能靠 window 事件。
11. **改组件后要跑 `npx astro check`**，能一次性抓出 props 类型对不上、barrel 断裂。

## 十二、构建期与运行期边界

- Astro frontmatter（`---` 之间）是**构建期**：可以 `await getCategoryList()`（`src/components/widgets/categories/Categories.astro:9`）、可以用 `node:fs`。`src/components/features/landing/nav-links.ts:1` 直接 `import { existsSync } from "node:fs"`，`:20-21` 的注释专门警告「这个模块依赖 node:fs，只能在构建期跑……别从客户端脚本里 import 它」。
- `<script>`（默认）会被打包并 defer；`<script is:inline>` 不打包、原样插进 HTML，用于首帧必须执行的逻辑。`src/pages/index.astro:50-63` 用 `is:inline` 在首帧前置校验并写入 `data-lp-intro`——注释明确说「必须是 `is:inline`，普通 `<script>` 会 defer，赶不上首帧」。
- 配置从服务端传到客户端**只有一条窄通道**：`src/components/misc/ConfigCarrier.astro:15-33` 用 `is:inline` + `define:vars` 把 TOC 三项配置写进 `window.siteConfig`，供 `src/components/features/toc/hooks/useMobileTOC.ts:177-182` 读取。前端能读到的 `window.siteConfig` 目前**只有 TOC 配置**。
- 反直觉：`src/stores/musicPlayerStore.ts:11` 从 `@/config` 引入 `musicPlayerConfig`，而 store 会被打进客户端 bundle（`SidebarMusicClient` 引它），所以 `config.ts` 会随音乐播放器一起进客户端。

## 相关文件

- `src/components/index.ts` —— 顶层汇总 barrel，实际无人 import。
- `src/components/atoms/index.ts` —— atoms 汇总 barrel，逐个 `export *` 子目录。
- `src/components/atoms/Button/{Button.astro,index.ts,types.ts}` —— 单组件目录三件套的标准样板。
- `src/components/atoms/Badge/Badge.svelte` / `src/components/atoms/tag-chip/TagChip.svelte` —— Svelte 5 `$props()` 用法的原子组件样例。
- `src/components/atoms/Image/Image.astro` —— 被 8 处跨层复用的最高频原子。
- `src/components/common/FloatingButton.astro` —— `common/` 层唯一成员，被 control 与 toc 复用的悬浮按钮外壳。
- `src/components/control/index.ts` —— 整个 control 层标为 deprecated，指明改用 `atoms/Button`。
- `src/components/control/LayoutSwitch.svelte` —— 遗留 Svelte 4 写法 + 派发 `layoutChange` 窗口事件。
- `src/components/control/MusicFabButton.svelte` —— 无 `export let`，用普通 `let` + `$:` 的另一种遗留写法。
- `src/components/control/FloatingControls.astro` —— 悬浮控件装配，监听 `music-sidebar:state` / mermaid 事件。
- `src/components/layout/SidebarColumn.astro` —— **侧栏组件唯一注册表** `componentMap` 所在处，左右栏共用。
- `src/components/layout/RightSideBar.astro` —— 真正的薄壳，只把 `side` 转发给 `SidebarColumn`。
- `src/components/widgets/sidebar/SideBar.astro` —— 左栏，含 `SidebarManager` 响应式显隐内联脚本，**不是薄壳**。
- `src/components/widgets/common/WidgetLayout.astro` —— 所有侧栏小部件的统一外壳（命名 slot + 原生 Web Component 折叠）。
- `src/components/widgets/common/AccordionDrawer.svelte` —— 独立的 Svelte 抽屉动画组件，服务于 music-sidebar，与 WidgetLayout 无关。
- `src/components/widgets/music-player/MusicPlayer.svelte` —— 播放器顶层装配，类订阅 store。
- `src/components/widgets/music-player/{atoms,molecules,organisms}/*` —— 唯一落地的三级分层。
- `src/components/widgets/music-sidebar/SidebarMusicClient.svelte` —— 通过 window 事件 + store 调用消费播放器状态。
- `src/components/widgets/calendar/Calendar.astro` / `Calendar.svelte` / `hooks/useCalendar.ts` —— Astro 壳 + Svelte 主体 + 运行期 fetch 的范例。
- `src/components/features/toc/SidebarTOC.astro` —— Web Component 形式的侧栏目录。
- `src/components/features/toc/MobileTOC.svelte` / `hooks/useMobileTOC.ts` —— 移动端目录，三套实现之一。
- `src/components/features/toc/types/toc.ts` 与 `types.ts` —— 类型重复定义，barrel 只认前者。
- `src/components/features/landing/*` —— 最新的 feature 目录，无 barrel，构建期数据 + 外部脚本驱动。
- `src/components/misc/ConfigCarrier.astro` —— 服务端配置写入 `window.siteConfig` 的唯一通道。
- `src/components/misc/Icon.astro` —— `atoms/Icon` 的向后兼容包装器，`misc/` 里图标类杂项的代表。
- `src/components/misc/IconifyLoader.astro` / `Markdown.astro` / `License.astro` —— 全局图标预加载、正文容器（带 `data-pagefind-body`）、许可信息展示。
- `src/components/misc/poster/*` 与 `src/components/misc/utils/poster-renderer.ts` —— 文章海报的画布绘制逻辑与渲染入口。
- `src/components/comment/index.astro` —— 评论聚合入口（命名反常），被 4 个页面直接深链。
- `src/components/comment/{Giscus,Twikoo}.astro` —— 两家评论系统适配壳，`is:inline` + IntersectionObserver 懒加载。
- `src/stores/musicPlayerStore.ts` —— 手写单例，非 Svelte store，广播 `music-sidebar:state`。
- `src/utils/widget-manager.ts` / `src/utils/widget-renderer.ts` —— 侧栏组件的选择、排序、props 组装；含过期未用的 `WIDGET_COMPONENT_MAP`。
- `src/types/config.ts` —— `WidgetComponentType` / `WidgetComponentConfig` / `SidebarLayoutConfig` 定义处。
- `src/config.ts` —— `sidebarLayoutConfig`（`:493` 起）、左/右/抽屉组件清单（`:586` 起）、`commentConfig`（`:428`）。
- `astro.config.mjs` —— 集成清单，决定组件能用的构建期/客户端能力。
- `tsconfig.json` —— 路径别名定义。
- `docs/rule/01-component-architecture.md` / `03-file-organization-architecture.md` —— 分层与目录规范（含已过期的 `molecules/` 描述）。
- `docs/rule/06-sidebar-widget-dev.md` —— 侧栏接入指南（componentMap 位置已过期，需按本文 7.6 节修正）。
- `docs/rule/07-icon-usage-specification.md` —— 图标用法（astro-icon vs @iconify/svelte）。
