# 08 · 客户端脚本与 Swup

这一块讲的是「浏览器里那半台机器」：Swup 怎样把静态站伪装成 SPA、换页时哪些代码会重跑哪些不会、以及 `src/scripts` 与 `src/utils` 里一堆模块各自负责什么。它是理解「为什么有些 bug 只在点完链接之后才出现」的钥匙 —— 首屏正常、导航一次就坏的现象，九成能在这里找到答案。

需要翻它的场景：新写一段只在特定页面生效的交互、发现监听器在换页后失效、怀疑某段脚本被跑了两次、看到 `swup:contentReplaced` / `astro:page-load` 这类事件名不知道哪个才真的会触发、或者想确认某个工具文件到底还活着没有。行号对应 `master` 分支 `0665e5c`，代码改动后以源码为准。

---

## 1. 先分清构建期与运行期

这个仓库里有两类「工具目录」，只靠名字分不出来，但边界很清楚：

| 目录 | 跑在哪 | 判据 |
| --- | --- | --- |
| `src/scripts/` | 浏览器（少数被 `import` 进 `.astro` 的 `<script>`，多数是模块） | 依赖 `window` / `document`，不参与 SSG 渲染 |
| `src/utils/` | **两者都有** | 被 `.astro` frontmatter 引用的跑在构建期；被 `src/scripts` 或 Svelte 引用的跑在浏览器 |

`src/utils/url-utils.ts` 是典型的跨边界文件：它的 `url()`、`getPostUrl()`、`pathsEqual()` 既被 `.astro` frontmatter 用来生成链接（`src/components/organisms/navigation/Navbar.astro:8`、`src/layouts/Layout.astro:13`），也被运行期的 `src/scripts/core/swup-hooks.ts:7` 引用。**往这个文件里加浏览器专属代码会同时污染构建期**，改之前先确认调用方。

这里还有一个容易被误判的连带关系：`src/utils/permalink-utils.ts` 看起来像纯构建期工具，但它被 `src/utils/url-utils.ts:6` 引用（`import { generatePermalinkSlug } from "./permalink-utils"`），而 `url-utils` 又被运行期脚本引用。按上面的判据，**`permalink-utils` 会被打进客户端包，不属于纯构建期**。真正纯构建期、不会被任何客户端脚本引用的是 `content-utils.ts`、`grid-layout-utils.ts`、`widget-renderer.ts`、`anime-data.ts`、`date-utils.ts`、`post-url.ts` —— 这些可以放心用 `astro:content` 之类的服务端 API。

---

## 2. Swup 是怎么接进来的

接入点只有一处：`astro.config.mjs:60` 的 `swup({...})`。`@swup/astro` 是一个 Astro 集成，它在 `astro:config:setup` 阶段用 `injectScript('page', script)` 把一段初始化脚本塞进每个页面（`node_modules/@swup/astro/dist/index.js:13-15`），脚本由同包的 `buildInitScript`（`node_modules/@swup/astro/dist/script.js:3`）生成。

那段注入脚本**不**直接 `new Swup()`，而是：

1. 把配置里的布尔量翻译成一组「插件是否启用」（`script.js:55-74`）；
2. 用 `serialise()` 把 `ignore` 回调序列化成源码字符串（`script.js:87-107`，见第 4 节）；
3. 生成 `new Swup({...})`（`script.js:118-127`）；
4. 把 swup 钩子桥接成 Astro 风格的自定义事件（`script.js:129-134`）；
5. 若 `globalInstance` 为真，挂 `window.swup = swup`（`script.js:136`）；
6. 用 `onIdleAfterLoad(initSwup)` 在 `window.load` 之后、浏览器空闲时才真正初始化（`script.js:139`）。

第 6 步决定了后面几乎所有时序问题：**首屏 `DOMContentLoaded` 时 `window.swup` 还不存在**。所以任何要注册 swup 钩子的代码都得先判断 `window.swup?.hooks`，否则监听 `swup:enable` 或轮询等待。

### 2.1 客户端要多加载哪些 chunk

注入脚本里有个容易忽略的形态：Swup 与各插件不是通过静态 `import` 引入的，而是被拼成 `import('@swup/astro/client/<包名>')` 的动态 import（`script.js:78-83`），只有 `loadOnIdle` 为假时才改用静态导入（`script.js:112`）。本项目 `loadOnIdle` 用默认值 `true`，所以走的是动态分支（`script.js:115`）：**首帧的网络里根本没有 Swup 及其插件的 chunk**，它们要等 `window.load` 之后的 idle 回调才被下载与求值。这同时也解释了「首屏 `window.swup` 不存在」不只是时序问题，还牵涉到一次额外的网络往返 —— 想抢在 swup 就绪前注册钩子，只能靠事件等待。

`script.js` 用 `@swup/astro/client/*` 转出口的写法是为了让 pnpm 这类严格依赖管理器能顺着导入解析到包（`script.js:76-79` 的注释）。

### 2.2 本项目实际写了哪些选项

`astro.config.mjs:60-70`：

| 选项 | 本项目的值 | 作用 |
| --- | --- | --- |
| `theme` | `false` | 关掉 `@swup/astro` 自带的 fade 主题。默认值是 `'fade'`（`script.js:4`），不写就会额外挂一个 SwupFadeTheme；本项目的过渡动画全在 `src/styles/transition.css` 里自己写，所以必须关掉 |
| `animationClass` | `'transition-swup-'` | 用来拼出 `animationSelector`：`[class*="transition-swup-"]`（`script.js:16`）。swup 会等这些元素上的 CSS 动画播完再收尾。命中的不止一处：`src/layouts/MainGridLayout.astro:215` 的 `<main>`（其类名由 `src/utils/grid-layout-utils.ts:169-170` 的 `mainContentClass` 拼出，内含 `transition-swup-fade`）和 `MainGridLayout.astro:277` 的 `#toc-container` 都有该类；`animationSelector` 是全局查询，两处都会命中。动画定义在 `src/styles/transition.css:42-49` |
| `containers` | `['main']` | **只替换 `<main>` 元素**。内容页的 `<main id="swup-container">` 在 `src/layouts/MainGridLayout.astro:213-215`（深埋在 `#main-grid` 里）；起始页的 `<main id="swup-container">` 在 `src/pages/index.astro:65`（是 `<body>` 的直接子元素）。两边外壳不同，这正是 `ignore` 要绕开的问题 |
| `smoothScrolling` | `false` | 关掉 SwupScrollPlugin。换页后的「滚回顶部」由 `src/scripts/core/swup-hooks.ts:158-161` 自己 `window.scrollTo` |
| `cache` | `true` | 开内存页缓存（预加载插件也要求 `cache` 为真才会挂载，`script.js:18-20`） |
| `preload` | `false` | 传给脚本后被归一成 `{hover:false, visible:false}`，再被判定为「全关」而置 `false`（`script.js:22-31`），于是 SwupPreloadPlugin 根本不挂 |
| `accessibility` | `true` | 挂 SwupA11yPlugin |
| `updateHead` | `process.env.NODE_ENV === 'production'` | 生产环境挂 SwupHeadPlugin；开发环境为 `false`。`src/layouts/partials/HeadTags.astro:190-201` 在 dev 下还会主动把 `window.swup.options.updateHead` 改成 `false`，避免 swup 反复替换 `<head>` 里的样式标签导致样式闪失。生产端的连带后果见第 9 节 |
| `updateBodyClass` | `false` | 关掉 SwupBodyClassPlugin。body 上的 `lg:is-home` / `enable-banner` 由 `swup-hooks.ts:254-263` 手动维护 |
| `globalInstance` | `true` | 挂 `window.swup`。这是全项目的生命线 —— 所有钩子、`navigateToPage()`、`BackToHome` 都靠它 |

没有写、取默认值的选项（`script.js:4`）：`globalInstance=false`、`loadOnIdle=true`、`debug=false`、`forms=false`、`fragments=null`、`morph=false`、`native=false`、`parallel=false`、`progress=false`、`reloadScripts=true`、`routes=false`。其中两个值得单独说：

- **`loadOnIdle` 默认 `true`** → 才有第 2 节说的「swup 在 load 之后空闲时才初始化」。配置里没写，但行为由它决定。
- **`reloadScripts` 默认 `true`** → 挂 SwupScriptsPlugin，它会在换页时重新执行被替换范围内缺 `data-swup-ignore-script` 的 `<script>`。`src/components/layout/Banner.astro:231` 的 `<script is:inline data-swup-ignore-script>` 就是用它来豁免的 —— 轮播图脚本不需要每次换页都重跑。判据细节见第 9 节。

### 2.3 写了也不会透传的三个选项

`@swup/astro` 的 `Options` 接口（`node_modules/@swup/astro/dist/index.d.ts:3-35`）里**没有** `resolveUrl`、`animateHistoryBrowsing`、`skipPopStateHandling`；而 swup 自己的 `Options` 是有的（`node_modules/.pnpm/swup@4.8.3/node_modules/swup/dist/Swup.d.ts:16,43,45`）。`buildInitScript` 只解构它认识的键，这三个写进 `swup({...})` 会被直接丢掉，**不会**出现在 `new Swup` 的参数里。想改只能等实例建好后再动 `window.swup.options.*`（`HeadTags.astro:195` 就是这种写法）。`astro.config.mjs:104-106` 的注释记的正是这件事，源码行为一致。

`skipPopStateHandling` 缺失有一个连带后果：浏览器前进/后退这条路**没有任何配置入口**，只能在 `src/scripts/swup-manager.ts:280-288` 里自己兜底（见第 6.2 节）。

---

## 3. swup v4 的钩子面有多大

在讲 `ignore` 和事件之前，先把 swup 认识的所有钩子摆出来。swup v4 的钩子注册表是固定的 29 个名字（`node_modules/.pnpm/swup@4.8.3/node_modules/swup/dist/Swup.modern.js:1`，`this.hooks = [...]`）：

| 分组 | 钩子名 |
| --- | --- |
| 动画 | `animation:out:start`、`animation:out:await`、`animation:out:end`、`animation:in:start`、`animation:in:await`、`animation:in:end`、`animation:skip` |
| 缓存 | `cache:clear`、`cache:set` |
| 内容 | `content:replace`、`content:scroll` |
| 开关 | `enable`、`disable` |
| 网络 | `fetch:request`、`fetch:error`、`fetch:timeout` |
| 历史 | `history:popstate` |
| 链接 | `link:click`、`link:self`、`link:anchor`、`link:newtab` |
| 页面 | `page:load`、`page:view` |
| 滚动 | `scroll:top`、`scroll:anchor` |
| 访问 | `visit:start`、`visit:transition`、`visit:abort`、`visit:end` |

—— 打开链接新窗口、锚点跳转、换页动画、历史回退这些行为，都能在这些钩子上插一脚，不必只盯着 `content:replace` / `page:view` 两个。`link:click` / `link:self` / `link:anchor` / `link:newtab` 的区别对排查「点链接为什么开了新标签」很有用。

几个默认值和它们的关系（同上文件末尾的默认对象）：

- `linkSelector: "a[href]"` —— swup 代理点击的范围。
- `linkToSelf: "scroll"` —— 点向当前页自身的链接不发起 visit，而是滚动（`this.hooks.callSync("link:self", …)` 分支里判断 `'navigate'===this.options.linkToSelf` 才走 `performNavigation`）。
- `resolveUrl: t => t` —— 默认恒等，不做任何改写。
- `requestHeaders: { "X-Requested-With": "swup", Accept: "text/html, application/xhtml+xml" }` —— 换页 fetch 带的头。
- `skipPopStateHandling: t => t.state?.source !== "swup"` —— 只处理「由 swup 自己写入的历史记录」；不是 swup 写的就跳过（默认就是这条，与第 6.2 节呼应）。
- `animateHistoryBrowsing: false` —— 历史导航默认不播过渡动画。
- `animationScope: "html"`、`native: false`（这两项也没有被 `@swup/astro` 透传，想改同样得走 `window.swup.options`）。

---

## 4. `ignore` 的精确语义

`ignore` 是本块最容易凭印象写错的地方，必须读实现。规则定义在 `node_modules/@swup/astro/dist/script.js:87-107` 生成的 `shouldIgnore()`：

```js
const shouldIgnore = (ignore, url, { el, event }) => {
  if (typeof ignore === "string" && ignore.startsWith("/")) return url.startsWith(ignore);
  if (typeof ignore === "string") return el?.matches(ignore) ?? false;
  if (ignore instanceof RegExp) return ignore.test(url);
  if (typeof ignore === "function") return ignore(url, { el, event });
  if (Array.isArray(ignore)) return ignore.some((i) => shouldIgnore(i, url, { el, event }));
  return false;
};
```

逐条对应成表：

| 你写的形态 | 判定方式 | 容易误解的点 |
| --- | --- | --- |
| 字符串且以 `/` 开头 | `url.startsWith(该串)` | 是**前缀匹配**，不是相等。写 `"/"` 等于忽略全站 |
| 其它字符串 | `el?.matches(该串)`，`el` 不存在时返回 `false` | 字符串被当成 **CSS 选择器**去匹配触发元素，与 URL 无关 |
| `RegExp` | `ignore.test(url)` | `url` 是路径、不含 origin |
| 函数 | `ignore(url, { el, event })` | 见下文参数细节 |
| 数组 | 对每项递归，任一为真即忽略（`some`） | 可混用字符串 / 正则 / 函数 |

两个参数层面的细节：

1. **传给函数的 `url` 是 `pathname + search + hash`。** swup 的 `shouldIgnoreVisit` 先取 `Location.fromUrl()` 的 `pathname+search`，再拼上 `hash`，然后才交给 `ignoreVisit`（`Swup.modern.js:1` 的 `shouldIgnoreVisit`，与 `astro.config.mjs:83` 的注释一致）。
2. **`data-no-swup` 由 swup 的默认 `ignoreVisit` 兜底**，不需要用户写。`script.js:119` 把用户的 `ignore` 用 `||` 接在默认规则后面：`el?.closest('[data-no-swup]') || shouldIgnore(...)`。所以 `src/components/features/landing/LandingHero.astro:108` 的 `data-no-swup` 是生效的。

### 4.1 函数会被序列化，不能闭包

`ignore` 数组里的函数不是直接传引用，而是 `JSON.stringify(value, replacer)` 把函数 `toString()` 成源码字符串（`node_modules/@swup/astro/dist/serialise.js:22-34`），页面里再用 `new Function('return (' + value + ').apply(this, arguments);')` 重建（`serialise.js:43-46`）。**结果是函数拿不到任何外层作用域变量**，只能用形参和全局对象。`document` 是全局，所以 `astro.config.mjs:100` 里直接 `document.getElementById(...)` 是安全的；换成引用配置对象里的常量就会在运行时抛错。

### 4.2 本项目为什么是两条规则

`astro.config.mjs:98-103`：

```js
ignore: [
  (_url) => _url === "/",
  (_url, { el }) =>
    !!document.getElementById("lp-root") || !!el?.closest("#lp-root"),
],
```

两条规则管的是两个方向，缺一不可：

- **第一条管「目的地是起始页」**：内容页里指回 `/` 的链接，当前文档没有 `#lp-root`，只能靠 URL 精确比对拦下。这里**必须写回调、不能用字符串** —— 字符串走 `startsWith`，写 `"/"` 会把全站都忽略掉（`astro.config.mjs:80-83` 的注释就是这个原因）。
- **第二条管「出发地是起始页」**：只要当前文档里存在 `#lp-root`，任何跳转都忽略。后半句的 `el?.closest("#lp-root")` 是显式兜底，而 `document.getElementById("lp-root")` 那一半才是关键 —— 因为 **`swup.navigate()` 不传 `el`**。

### 4.3 `swup.navigate()` 为什么拦得住基础元素规则

`navigate` 的签名里 `el` 是可选 `init` 参数的一部分（`Swup.modern.js:1` 的 `function V(t, e = {}, s = {})` 用 `s.el`；类型见 `node_modules/.pnpm/swup@4.8.3/node_modules/swup/dist/types/modules/navigate.d.ts:30`），调用 `swup.navigate(url)` 时它是 `undefined`。实现开头一句：

```js
if (this.shouldIgnoreVisit(t, { el: s.el, event: s.event }))
  return void window.location.assign(t);
```

因此：

- 基于 `el` 的忽略规则（选择器字符串、`el?.closest(...)` 判断）**拦不住程序化跳转**；
- 但本项目第二条规则里那个「当前文档有没有 `#lp-root`」的检查不依赖 `el`，所以 Pio 看板娘之类走 `window.swup.navigate()` 的组件在起始页上照样被拦下，改走 `window.location.assign(url)`，即整页加载。

对照点击路径：`handleLinkClick` 里查到该忽略就直接 `return`，**不调用 `preventDefault`**（`Swup.modern.js:1` 的 `handleLinkClick`），浏览器因此执行原生整页跳转。这就是 `astro.config.mjs:81-82` 注释说的「命中 ignore 的链接 swup 不会 preventDefault」。

---

## 5. 起始页为什么必须留在 swup 之外

`astro.config.mjs:71-95` 的长注释解释了根因，源码结构可以佐证：

| | 起始页（`/`） | 内容页 |
| --- | --- | --- |
| `<main>` 位置 | `src/pages/index.astro:65`，`<body>` 直接子元素 | `src/layouts/MainGridLayout.astro:213-215`，在 `#main-grid` 内部 |
| 栅格外壳 / 导航条 / 侧栏 | 没有 | 有，且都在 `<main>` 之外 |

因为 `containers: ["main"]` 只换 `<main>`：内容页 → 起始页时新 `<main>` 落进残留的 `#main-grid`；起始页 → 内容页时 `<main>` 落进裸 `<body>`，栅格外壳全丢。两个方向都只能刷新恢复。所以起始页被整个排除在 swup 之外，所有涉及它的跳转都退化成整页加载。

---

## 6. 客户端总装配：`src/scripts/swup-manager.ts`

这是客户端的装配点，被 `src/layouts/Layout.astro:322` 在页面主脚本体里 `initSwupManager()`（`:325`）调用一次。Layout 的这段是**打包后的外部模块**，换页时不会重跑（原因见第 9 节），所以管理器是进程级单例。

### 6.1 职责

- **`SwupManager` 类**（`swup-manager.ts:34`）：构造函数里探测 banner 是否存在（`:44-46`），持有 fancybox / back-to-top / panel 三个处理器单例（`:49-51`）。`init()`（`:57-84`）依次应用过渡配置、初始化面板、Sakura、钩子、返回顶部、Banner、链接预加载，并用 `initialized` 防重入。
- **钩子的注册与销毁时机**（`:107-149`）：如果 `window.swup.hooks` 已存在就立刻 `registerHooks()`（`:126-129`）；否则监听 `swup:enable`（`:132-136`）。由于 swup 走 `loadOnIdle`，首屏基本都会走 else 分支。同时它还在 `DOMContentLoaded` 时单独跑一次 `initFancybox()` / `checkKatex()`（`:139-147`），保证首屏（此时 swup 还没起来）也有灯箱和公式样式。
- **单例与便捷入口**：`getSwupManager()`（`:229-234`）、`initSwupManager()`（`:239-242`）。`destroy()`（`:206-213`）会逐一拆掉处理器，但**全仓库没有任何地方调用它**。

### 6.2 popstate 守卫

`astro.config.mjs` 的 `ignore` 只管点击；浏览器的前进/后退走的是另一条路径。`handlePopState` 只看 `skipPopStateHandling`，**不问 `shouldIgnoreVisit`**（`Swup.modern.js:1` 的 `handlePopState`），而 `@swup/astro` 又没把 `skipPopStateHandling` 透传出来（第 2.3 节）。所以只能自己兜：

```js
const LANDING_PAGE_PATH = /^\/$/;                       // swup-manager.ts:269
function involvesStartPage() {                          // :271-278
  if (LANDING_PAGE_PATH.test(window.location.pathname)) return true;
  return !!document.getElementById("lp-root");
}
window.addEventListener("popstate", () => {             // :280-288
  if (!involvesStartPage()) return;
  window.location.reload();
});
```

时序上够用：`popstate` 触发时 `location` 已经是目标地址，而 swup 的 DOM 替换还在 `await` 之后、尚未发生，所以 `document` 里仍是「旧」页面的外壳 —— 于是用 `pathname` 判断「要去起始页」，用 `#lp-root` 判断「现在还在起始页」，两者任一成立就整页 `reload()`。`reload()` 同步发起，会取消 swup 那次异步 fetch，不会出现换了一半的中间态（`:255-262` 注释）。

**必须是精确匹配 `/`。** 换成 `startsWith("/")` 会把每一次历史导航都判成「涉及起始页」，全站前进后退全部退化成整页刷新（`:264-268` 注释）。这个监听器写在模块顶层，所以在每个页面加载时都会注册一次。

---

## 7. 钩子与常量：`core/swup-config.ts` 与 `core/swup-hooks.ts`

### 7.1 `swup-config.ts`：常量真源

这个文件只有常量和类型，没有逻辑，但很多东西以它为准：

- `BANNER_HEIGHT = 35` / `BANNER_HEIGHT_EXTEND = 30` / `BANNER_HEIGHT_HOME`（`:9-11`）。
- `SWUP_SELECTORS`（`:14-46`）：`contentContainer`、`animationScope: "#main-grid"`、`persistElements`、`bannerWrapper`、`tocWrapper` 等。注意 `animationScope` 与 `persistElements` **定义后在仓库里没有任何引用**，属于预留项。
- `TRANSITION_CONFIG`（`:58-64`）与 `ANIMATION_CONFIG`（`:67-86`）：后者里的 `tocReadyDelay=80`、`heightExtendDelay=150`、`commentInitDelay=250` 被钩子直接使用。
- `THEME_CONFIG`（`:89-106`）：`defaultMode` 复用 `constants.ts` 的 `DEFAULT_THEME`。注释（`:98-100`）解释了为什么必须共用真源：否则首帧内联脚本与 swup 同步会用两套默认值，表现为「首屏暗色、一导航变浅色」。
- `SCROLL_CONFIG`（`:109-118`）：滚动节流 16ms、返回顶部偏移、navbar 隐藏偏移。
- `PERFORMANCE_CONFIG`（`:148-167`）、`getDefaultFancyboxConfig()`（`:202-237`）、`FANCYBOX_SELECTORS`（`:240-249`）。

### 7.2 `swup-hooks.ts`：注册了哪五个钩子

`registerHooks()`（`swup-hooks.ts:72-81`）注册五个 swup 钩子，每个的职责：

| 钩子 | 位置 | 做什么 |
| --- | --- | --- |
| `link:click` | `:87-100` | 把 `--content-delay` 置 0（去掉首屏延迟）；若开启 banner，点击时按滚动位置给 navbar 加 `navbar-hidden` |
| `content:replace` | `:106-121` | 清元素缓存；重新初始化 Fancybox、KaTeX 样式、自定义滚动条；延迟 80ms 重 init TOC；重 init semifull 滚动检测 |
| `visit:start` | `:127-146` | 清理上一页 Fancybox；按目标页是否为 `/home/` 切换 body 的 `lg:is-home`、banner 文字、navbar `data-is-home`、移动端 banner；扩展页面高度；隐藏 TOC |
| `page:view` | `:152-169` | 扩展页面高度；`scrollTo({top:0, behavior:"instant"})`；同步主题；延迟 250ms 派发 `mizuki:page:loaded`（仅当页面有 `#tcomment` / `#giscus-container`） |
| `visit:end` | `:175-185` | 延迟 150ms 收起高度扩展、显示 TOC |

`content:replace` 里的 `clearCache()`（`:65-67`）很关键：元素用 `Map` 缓存（`:43`、`:50-63`），换页后 DOM 已换，不清就会一直操作旧节点。

### 7.3 `pathsEqual` 为什么存在

`visit.to.url` 来自 swup 的 `Location.url`，形如 `/home/`；而常量 `HOME_PATH` 在 `src/constants/constants.ts:14` 写的是 `"/home/"`。两者在**尾斜杠**和**大小写**上不保证一致，所以判断首页要用归一化比较：

```ts
// src/utils/url-utils.ts:16-20
export function pathsEqual(path1: string, path2: string) {
  const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
  const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
  return normalizedPath1 === normalizedPath2;
}
```

它同时去掉**首尾**斜杠并转小写。`swup-hooks.ts:134` 用的就是它。注意 `src/utils/navigation-utils.ts:270-277` 里还有**另一个同名函数**，那个只去尾斜杠、不转小写，而且**全仓库没有任何地方引用它** —— 新人从 IDE 跳转时容易跳错文件，认准 `swup-hooks.ts:7` 的 import。

---

## 8. 生命周期事件清单

### 8.1 哪些事件真的会触发

swup v4 会为**每一个钩子名**派发一个 DOM 事件，名字是 `swup:<钩子名>`，另外每次还额外派发一个 `swup:any`（`Swup.modern.js:1` 的 `dispatchDomEvent`，内容为 `swup:any` + `swup:${hookName}`，`detail.hook` 是钩子名，`bubbles:true`）。所以第 3 节那 29 个钩子，每个都能用 `document.addEventListener("swup:<名字>", …)` 监听。

`@swup/astro` 额外桥接了三个 Astro 风格事件（`script.js:129-134`）：

```js
swup.hooks.before('content:replace', () => dispatch('astro:before-swap'));
swup.hooks.on('content:replace',     () => dispatch('astro:after-swap'));
swup.hooks.on('page:view',           () => dispatch('astro:page-load'));
```

| 事件 | 真伪 | 来源 |
| --- | --- | --- |
| `swup:enable` | 真 | 钩子名 `enable`。swup 构造时 `enable()` 触发，每次整页加载一次 |
| `swup:page:view` | 真 | 钩子名 `page:view`（注意冒号，不是驼峰） |
| `swup:content:replace` | 真 | 钩子名 `content:replace` |
| `swup:any` | 真 | 每个钩子都额外派发一次 |
| `astro:before-swap` | 真 | 桥接自 `content:replace` 的 before |
| `astro:after-swap` | 真 | 桥接自 `content:replace` 的 on |
| `astro:page-load` | 真 | 桥接自 `page:view` |
| `swup:contentReplaced` | **假** | swup v2/v3 的旧名，v4 不再派发；仓库里也无人 `dispatchEvent` |
| `swup:pageView` | **假** | 同上 |

**`astro:page-load` 只在 swup 换页时触发，首次加载不触发** —— 因为它挂在 `page:view` 上，而 `page:view` 只在一次 visit 里被调用。仓库里的正确范式是同时听 `DOMContentLoaded` 和换页事件，例如 `src/scripts/right-sidebar-layout.js:117-121`（首屏初始化）+ `:42-52`（换页重跑）。

### 8.2 谁在听、谁负责清理

| 事件 | 监听者（部分） |
| --- | --- |
| `swup:enable` | `src/scripts/swup-manager.ts:132`、`src/layouts/partials/HeadTags.astro:193`、`src/components/control/ThemeSwitch.svelte:67`、`src/components/comment/Giscus.astro:112`、`src/components/comment/Twikoo.astro:123`、`src/components/control/PageProgressBar/PageProgressBar.astro:55`、`src/scripts/code-collapse.js:363`、`src/scripts/theme-optimizer.js:99`、`src/components/features/toc/MobileTOC.svelte:147`、`src/pages/anime.astro:552` |
| `swup:page:view` | `src/layouts/partials/HeadTags.astro:183`（根字号缩放重算）、`src/layouts/partials/GridScripts.astro:378`（重算壁纸与布局模式） |
| `swup.hooks` 直连 | `src/scripts/core/swup-hooks.ts`、`src/scripts/theme-optimizer.js:71,82,260`、`src/scripts/code-collapse.js:329,341`、`src/layouts/partials/GridScripts.astro:284(animation:out:start),295`、`src/components/widgets/sidebar/SideBar.astro:104`、`src/components/comment/Giscus.astro:107,115`、`src/components/comment/Twikoo.astro:118,126`、`src/components/control/ThemeSwitch.svelte:62,69`、`src/components/control/LayoutSwitch.svelte:126,127`、`src/components/control/PageProgressBar/PageProgressBar.astro:29,38`、`src/components/features/posts/PostPage.astro:153`、`src/components/features/toc/MobileTOC.svelte:114` |
| `astro:page-load` | `src/scripts/landing/index.ts:600`、`src/scripts/right-sidebar-layout.js:42`、`src/components/control/BackToHome.astro:51`、`src/components/control/FloatingControls.astro:424`、`src/components/features/posts/CategoryBar.astro:287`、`src/components/features/toc/FloatingTOC.astro:440`、`src/components/widgets/card-toc/CardTOC.astro:121`、`src/plugins/mermaid-render-script.js:429` |
| `astro:before-swap` | `src/scripts/landing/index.ts:599`（`teardown`）、`src/plugins/mermaid-render-script.js:446,449` |
| `astro:after-swap` | `src/components/widgets/card-toc/CardTOC.astro:125`、`src/components/widgets/feed/FeedInfo.astro:195`、`src/plugins/mermaid-render-script.js:452` |

清理责任分散在各组件自己身上，没有全局注册表。两种典型写法：

- **`landing/index.ts` 的「副作用即返回清理函数」模式**（`:9`、`:556-565`）：`initLanding()` 把每个模块的 cleanup 推进 `activeCleanups`（`:584-590`），`astro:before-swap` 时统一 `teardown()`。这是本仓库最完整的范式，新写重型交互建议照抄。
- **组件自持 `destroy()`**：如 `src/scripts/swup-manager.ts:206`、`src/utils/tocManager.ts:419`（`cleanup()`）、`src/scripts/effects/transition-effect.ts:87`。但钩子监听本身多在首次注册后就再不摘除，靠闭包持有旧节点 —— `swup-hooks.ts` 的 `clearCache()` 就是为抵消这个而存在。

### 8.3 新脚本该挂哪个事件

判断顺序：

1. **只想在整页加载后跑一次（比如一次性初始化）** → 立刻执行，或 `DOMContentLoaded`。这是 Layout 级别脚本的写法。
2. **首屏要跑，且每次换页也要重跑** → 首屏逻辑走 `DOMContentLoaded`/立即执行，换页逻辑挂 `swup.hooks.on("page:view")` 或 `"content:replace"`。**不要只挂 `astro:page-load`**（首屏不触发），也不要用 `swup:contentReplaced` / `swup:pageView`（永不触发）。
3. **想在 DOM 被替换之前做清理** → `astro:before-swap`，或 `swup.hooks.before("content:replace", ...)`。
4. **只想拿到 `window.swup` 引用去注册钩子** → 先判断 `window.swup?.hooks`，没有就监听 `swup:enable`（并像 `theme-optimizer.js:104-113` 那样加一个 2 秒内的轮询兜底，避免事件已经错过）。
5. **换页后需要重新抓取本次新内容里的 DOM** → 用 `content:replace`（更早）或 `page:view`（内容已就位、滚动已复位）。

一个常见错误是写成 `document.addEventListener("DOMContentLoaded", init)` 就以为换页也会重跑 —— **换页不重建 document，`DOMContentLoaded` 不会再发**。另一个错误是只挂 `astro:page-load`，首屏永远不跑。

---

## 9. Astro `<script>` 与 swup 的脚本重放

换页时 swup 只替换 `<main>`，但「脚本会不会重跑」不是一个问题，而是三个问题：脚本放在哪、是哪种 `<script>`、以及 SwupScriptsPlugin 怎么处理它。

### 9.1 打包脚本 vs `is:inline`

| 写法 | 产物 | 换页行为 |
| --- | --- | --- |
| `<script>`（Astro 默认，被 `import` 或内联源码） | 被打包成一个外部模块 `<script type="module" src="/_astro/…js">`，提升到 `<head>` | 模块按 URL 只求值一次，换页不重跑。`Layout.astro:319-325` 的 `initSwupManager()` 就属于这一类，这正是它敢只调用一次的原因 |
| `<script is:inline>` | 原样保留在书写的位置，不打包 | 每次被插入 DOM 都可能重新执行，需自行加 `data-swup-ignore-script` 或幂等守卫 |

### 9.2 SwupScriptsPlugin 的重放规则

`reloadScripts` 默认 `true`（`script.js:4`），于是启用 SwupScriptsPlugin。它 `mount()` 时订阅 `content:replace`，在回调里执行 `runScripts()`（`node_modules/.pnpm/@swup+scripts-plugin@2.1.0_swup@4.8.3/node_modules/@swup/scripts-plugin/dist/index.modern.js:1`）：

- 默认范围 `{ head: true, body: true, optin: false }`，即扫描 `document`，选择器是 `script:not([data-swup-ignore-script])`；
- 命中后逐条创建一个同属性、同文本的新 `<script>` 替换旧节点，从而重新执行；
- `optin: true` 时反过来只重放带 `data-swup-reload-script` 的脚本。

实际后果：**带 `is:inline` 又不带 `data-swup-ignore-script` 的脚本，每次换页都会被重放**；外部模块脚本由于模块映射按 URL 缓存，重复插入不会二次求值。`src/components/layout/Banner.astro:231` 给轮播脚本加了 `data-swup-ignore-script`，正是为了让它只在首屏初始化一次。

### 9.3 生产环境 SwupHeadPlugin 与 `<head>` 的副作用

`updateHead` 只在生产为真（`astro.config.mjs:68`），于是生产开启 SwupHeadPlugin，它在 `content:replace` 的 `before` 阶段对 `<head>` 做差异同步（`node_modules/.pnpm/@swup+head-plugin@2.3.1_swup@4.8.3/node_modules/@swup/head-plugin/dist/index.modern.js:1`）：按 `outerHTML` 比对，移除当前 head 中新页面没有的节点、插入新页面多出来的节点，并把新 `documentElement` 上的 `lang`/`dir` 同步过来。

两个值得留意的点：

- **样式会被换掉。** 每个页面各自的 `<style>`（Astro scoped style）在 `outerHTML` 上通常不同，会被移除再插入，表现为一次样式重算。`HeadTags.astro:190-201` 的 dev 专用覆盖（把 `window.swup.options.updateHead = false`）注释里写的「避免反复替换 head 中的样式标签导致偶发样式丢失」，说的就是这件事 —— 生产端少了这层保护，靠 HeadTags 头部的首帧内联脚本（`HeadTags.astro:102-111`，负责读 `localStorage` 主题、写 `data-theme`、写 `--hue`）来保证首帧观感。该内联脚本对同一站点各页 `outerHTML` 一致，正常情况下不会被差异同步移除重插；一旦某页的 head 结构变化，就有被换掉重跑的风险。
- **`<html>` 的行内样式不受影响。** SwupHeadPlugin 默认只同步 `lang` / `dir` 两个属性，不改 `style`。所以 `HeadTags.astro:148-186` 的 `adjustPageScale()` 往 `document.documentElement.style.fontSize` 写的根字号会一直留着，并在每次 `swup:page:view`（`HeadTags.astro:183`）时重算。注意它的缩放规则是 `scale = clientWidth / targetWidth`，`scale > 1` 钳到 1、`scale < 0.85` 钳到 0.85（`HeadTags.astro:164-173`）—— 1281–1700px 区间会被钳到 0.85，即所有 rem 缩水 15%，排查与视口相关的尺寸问题时要记得这一层。

---

## 10. 起始页运行时 `landing/index.ts`

只被 `src/pages/index.astro:80-83` 的 `<script>` 引入（普通 Astro `<script>`，会被打包），因此不会进入其它页面产物。结构是「工厂函数返回 cleanup」+ `safeInit` 隔离（`:568-574`）+ `teardown` 统一回收（`:556-565`），入口 `initLanding()`（`:576-591`）用 `root.dataset.lpBooted` 防重入，并在模块顶层 `initLanding()` 自启一次（`:593`）。

模块与入口（`:584-590` 的注册顺序即执行顺序）：指针光效（`:25`）、打字机（`:91`）、时钟与问候（`:161`）、进入按钮（磁吸 + 涟漪 + Enter 键，`:244`）、卡片柔光（`:329`）、数字滚动（`:355`，通过 `afterIntro` 推迟到开屏结束，`:466`）、开屏跳过与兜底（`:517`）。

两个值得记的点：

- **开屏跳过只剩滚轮和按键**（`:530-541`），点击跳过被有意删掉，配套把 `.lp-splash` 的 `pointer-events` 翻成 `auto` 挡住穿透（`:494-516` 注释与 `src/styles/landing/landing.css:1457`）。跳过路径把 `--lp-exit` 归零，避免「看得见却点不动」。
- **兜底计时器 `INTRO_MAX_MS = 5700`**（`:445`），取值依据是「内容入场动画最后一帧」而非开屏总时长，因为置位会把 `--lp-intro-delay` 从 4.32s 打回 0s，导致仍在播的动画被硬拽到终点（`:430-444`）。

---

## 11. `src/scripts/` 其余文件职责表

| 文件 | 职责 | 换页如何重跑 |
| --- | --- | --- |
| `handlers/back-to-top-handler.ts` | `BackToTopHandler`（`:18`）：滚动节流（16ms，`swup-config.ts:111`）控制返回顶部按钮显隐、TOC 显隐、navbar 隐藏；`resize` 时算 `--banner-height-extend` | 非 swup 感知；元素引用在 `init()` 时缓存一次，靠全局单例跨页复用 |
| `handlers/fancybox-handler.ts` | `FancyboxHandler`（`:18`）：按需 `import("@fancyapps/ui")`，按三组选择器 `bind`；换页前 `cleanup()` 解绑 | `swup-hooks.ts` 在 `content:replace` 重 init、`visit:start` cleanup |
| `handlers/panel-handler.ts` | `PanelHandler`（`:18`）：给 5 个浮窗（显示设置 / 导航菜单 / 搜索 / 移动 TOC / 壁纸）绑「点外部关闭」，动态 import `panel-manager.js` | 非 swup 感知 |
| `handlers/scroll-handler.ts` | `ScrollHandler`（`:10`）：把 `.katex-display` 包进可横向滚动的容器、按需注入 KaTeX CSS；静态 `throttle()` 工具 | `swup-hooks.ts` 在 `content:replace` 重 init |
| `effects/sakura-effect.ts` | `SakuraEffectHandler`（`:13`）：读 `widgetConfigs.sakura`，用全局 `window.sakuraInitialized` 防重复，调 `sakura-manager.initSakura` | 只在 `init` 时判断一次，页面级持久 |
| `effects/transition-effect.ts` | `TransitionEffect`（`:8`）：把 `TRANSITION_CONFIG` 写成 `--transition-*` CSS 变量 | 单例，`destroyTransitionEffect()` 重置 |
| `theme-optimizer.js` | `ThemeOptimizer`（`:15`）：代码块 IntersectionObserver 分批更新、主题切换期间禁用重型元素动画并临时注入样式表；`window.themeOptimizer` 暴露 | 自己监听 `page:view` / `content:replace`（`:71,:82,:260`），并用 `swup:enable` + 2 秒轮询兜底等待 swup（`:97-114`） |
| `code-collapse.js` | `CodeBlockCollapser`（`:1`）：给无标题的 `.expressive-code` 加折叠按钮，MutationObserver 增量处理 | 自己挂 `page:view` / `content:replace`（`:329,:341`）；注意它还听了一个**永不会触发的** `swup:pageView`（`:43`） |
| `right-sidebar-layout.js` | 网格模式下隐藏右侧栏、调整 `#main-grid` 列宽；`window.rightSidebarLayout` 暴露。被 13 个页面用动态 `import(...)` 引入 | 同时听 `astro:page-load`（`:42`，真）与 `swup:contentReplaced`（`:55`，**假**），靠前者工作 |
| `swup-manager.ts` | 见第 6 节 | 模块顶层 + `swup:enable` |

`src/pages/anime.astro` 的番剧筛选与布局切换逻辑**不在** `src/scripts/` 里，而是内联在该页的 `<script is:inline>` 中：`initAnimeLayout` 与退避重试在 `:267`、`:284-308`，`animeFilterEventListeners` 在 `:323`，筛选器的 `swup.hooks.on` 在 `:539,:542`，等待 swup 的 `swup:enable` 在 `:552`。

---

## 12. `src/utils/` 里的运行时工具

| 文件 | 一句话 | 关键位置 |
| --- | --- | --- |
| `url-utils.ts` | URL/路径工具：`removeFileExtension`、`pathsEqual`（归一化比较）、`url()`（拼 `BASE_URL`）、`getPostUrl` 系列。**构建期与运行期共用**，还连带把 `permalink-utils` 拖进了客户端包 | `:12,:16,:101,:44,:6` |
| `navigation-utils.ts` | 统一跳转入口：`navigateToPage`（优先 `window.swup.navigate`，失败/无 swup 时降级 `location.href`）、`isSwupReady`、`waitForSwup`（等 `swup:enable`，默认 5s 超时）、`preloadPage`、`initLinkPreloading`（IntersectionObserver 预加载） | `:13,:86,:94,:126,:168` |
| `setting-utils.ts` | 主题/色相读写：`getHue`/`setHue`（写 `--hue`）、`applyThemeToDocument`（支持 View Transitions，切换期间加 `is-theme-transitioning`）、`setTheme`/`getStoredTheme`、壁纸模式 | `:11,:21,:26,:35,:146,:151,:155,:162` |
| `tocManager.ts` | `TOCManager`（`:19`）：生成 TOC HTML、IntersectionObserver 跟踪活动标题、指示器位移、平滑滚动。运行期由 `CardTOC.astro` 使用；`init()` 在 `:430`、`cleanup()` 在 `:419`；文件末尾还导出一个 `isPostPage()`（`:438`，用 `includes("/posts/")`，与 `navigation-utils.ts:262` 的 `startsWith` 版本不是同一个） | `:19,:419,:430,:438` |
| `widget-manager.ts` | `WIDGET_COMPONENT_MAP`（`:11`）+ `WidgetManager`（`:29`）：按位置/设备算出侧栏该渲染哪些组件。构建期由 `MainGridLayout.astro` 等使用，类本身无 DOM 依赖 | `:11,:29,:267` |
| `panel-manager.ts` | `PanelManager`（`:13`）：保证同一时刻只有一个浮窗打开，统一过渡（主题切换期间跳过动画），`panelManager` 实例在 `:154` 导出 | `:13,:154` |
| `sakura-manager.ts` | 樱花 Canvas 粒子系统（`Sakura` 类 `:4` + `SakuraManager` 类 `:189`）：`initSakura`/`toggleSakura`/`stopSakura`/`getSakuraStatus` | `:4,:189,:379,:391,:398,:406` |
| `grid-layout-utils.ts` | 纯构建期：`getSidebarPresence`/`calculateGridLayout`/`shouldEnableTransparency` 等，供 `MainGridLayout.astro` 算栅格类名；`mainContentClass` 在 `:169-176` | `:169` |
| `widget-renderer.ts` | 纯构建期：`getComponentStyles`/`buildComponentProps`/`getDeviceType`，供 `SidebarColumn.astro:6` 用 | `:24,:43,:76` |
| `content-utils.ts` / `anime-data.ts` / `date-utils.ts` / `post-url.ts` / `permalink-utils.ts` | 构建期数据工具：文章排序/标签/分类、番剧数据、日期格式化、文章 URL 与 permalink 生成 | `content-utils.ts:45,:64`、`anime-data.ts:45,:97`、`date-utils.ts:3,:8`、`post-url.ts:7`、`permalink-utils.ts:14,:62` |

**注意 `post-url.ts` 虽然被列在这里，但它是死文件**（见第 13 节）。

---

## 13. `src/stores/` 与 Svelte 侧状态

`src/stores/` 只有一个文件：`musicPlayerStore.ts`。它**不是** Svelte 官方 store，而是一个手写的发布订阅类（`:47`）：

- 状态是普通对象 `MusicPlayerState`（`:13-32`）；`getState()` 返回快照（`:89-91`），`subscribe(listener)` 订阅并立即推送一次快照（`:97-103`），每次变更由 `broadcastState()`（`:565-580`）同时通知内存订阅者和 `window` 上的 `music-sidebar:state` 自定义事件。
- 副作用集中在这里：`initialize()`（`:105`）创建唯一的 `Audio` 对象、读 `localStorage` 音量、注册首次交互自动播放兜底、按 `musicPlayerConfig.mode` 拉 meting 播放列表或本地列表。
- Svelte 组件两种接法：`src/components/widgets/music-player/MusicPlayer.svelte:9` 用普通变量 + `subscribe` 手动同步；`src/components/widgets/music-player/FabMusicPanel.svelte:5,13` 用 Svelte 5 runes 的 `$state`。
- 因为 store 是模块级单例，而 swup 只替换 `<main>`、不重载模块，播放状态能跨换页存活。`MusicPlayer` 以 `client:idle` 挂载（`src/layouts/Layout.astro:238`）。

其余 Svelte 组件（`ThemeSwitch.svelte`、`MobileTOC.svelte`、`Search.svelte`、`DisplaySettings.svelte`、`LayoutSwitch.svelte` 等）基本是「组件内局部状态 + 监听 swup 事件」，没有第二个共享 store。它们与外界的通信主要靠两类手段：直接读 `window.swup.hooks`（`ThemeSwitch.svelte:62-70` 的 `content:replace`，`LayoutSwitch.svelte:126-127`），或调用 `navigation-utils` 的 `navigateToPage`（`Search.svelte`、`MobileTOC.svelte`）。

---

## 14. 无人引用的死文件清单

下面这些文件存在，但**全仓库没有任何地方 `import`**，改动它们不会影响线上行为。新人看到别以为是遗漏了调用而「顺手接上去」：

| 文件 | 说明 |
| --- | --- |
| `src/scripts/post-lastmodified.ts` | `initLastModifiedHandler`（`:11`）无人调用。真正每秒刷新 `#modifiedtime` 的是 `src/components/features/posts/LastModified.astro:89-92` 里的内联脚本 |
| `src/scripts/anime-filter-handler.ts` | `initFilterHandler`（`:1`）无人调用；番剧筛选实际内联在 `src/pages/anime.astro:322-554` |
| `src/scripts/anime-layout-handler.ts` | `initAnimeLayoutHandler`（`:6`）/ `initLayoutListener`（`:196`）无人调用；布局逻辑实际内联在 `src/pages/anime.astro:267` 起 |
| `src/utils/animation-utils.ts` | `AnimationManager`（`:13`）自带顶层自动 `init()`（`:271-279`），但文件从未被 import，所以它的 `swup.hooks.on("animation:out:start"/"animation:in:start"/"content:replace")`（`:42,:47,:52`）一次也不会注册 |
| `src/utils/performance-observer.ts` | Core Web Vitals 观察器，`initPerformanceMonitoring`（`:394`）无人调用 |
| `src/utils/responsive-sidebar.ts` | `initSidebarManager`（`:61`）无人调用；断点行为实际由 CSS 变量与 `GridScripts` 完成 |
| `src/utils/post-url.ts` | `buildPostPaths`（`:7`）无人调用 |
| `src/utils/poster-image.ts`、`src/utils/language-utils.ts` | 同样无人 import |
| `src/utils/navigation-utils.ts` 的 `waitForSwup`（`:94`） | 定义存在但没有任何调用方；需要等待 swup 的组件都自己写 `swup:enable` 监听 |
| `src/utils/animation-test.js` | 与 `src/components/misc/AnimationTest.astro` 同名但不是它的依赖，无人引用 |

另外两个「定义了但没人用」的常量：`SWUP_SELECTORS.animationScope` 与 `SWUP_SELECTORS.persistElements`（`src/scripts/core/swup-config.ts:19,22`）。以及 `SwupManager.destroy()`（`src/scripts/swup-manager.ts:206`）也没有调用方。

---

## 15. 本项目特有约定（新人必读）

1. **分层**：`src/components` 下的实际子目录是 `atoms`、`comment`、`common`、`control`、`features`、`layout`、`misc`、`organisms`、`widgets`（**没有 `molecules`**）；`src/scripts` 按 `core` / `handlers` / `effects` / `landing` 分，`core` 只放常量和钩子注册，`handlers` 放具体交互，`effects` 放视觉特效。
2. **barrel 导出**：组件目录大量使用 `index.ts` 汇总导出（`src/components/atoms/index.ts`、`src/components/comment/index.ts` 等），但 **`src/scripts/` 和 `src/utils/` 没有 barrel**，都按具体路径 import。
3. **单例工厂**：几乎每个 handler 都是「类 + `getXxxHandler()` 懒单例 + `initXxx()` 便捷函数」三件套，且导出到 `window`（`window.panelManager`、`window.themeOptimizer`、`window.codeBlockCollapser`、`window.rightSidebarLayout`、`window.sakuraInitialized`）。跨模块通信优先走 `window` 上的实例或自定义事件（`mizuki:page:loaded`、`layoutChange`、`wallpaper-mode-change`、`music-sidebar:state`、`themeOptimizerReady`），而不是 import。
4. **构建期 / 运行期**：见第 1 节。`src/utils` 混装两种，改之前看调用方。
5. **生命周期钩子**：见第 8.3 节。首屏和换页必须分开处理。
6. **常量真源**：首页路径认 `src/constants/constants.ts:14` 的 `HOME_PATH`（值是 `/home/`，**根 `/` 是起始页不是首页**）；默认主题认同文件 `DEFAULT_THEME`。

---

## 16. 新人最容易踩的点（反直觉清单）

1. **`swup:contentReplaced` / `swup:pageView` 永不触发。** 它们是 swup v2/v3 的旧事件名，v4 的 DOM 事件名是 `swup:<带冒号的钩子名>`。仓库里仍有监听者：`src/scripts/right-sidebar-layout.js:55`、`src/scripts/code-collapse.js:43`、`src/components/control/BackToHome.astro:53`、`src/components/features/posts/CategoryBar.astro:291`、`src/components/widgets/card-toc/CardTOC.astro:117`、`src/components/atoms/typewriter-text/TypewriterText.astro:159`。这些监听是死代码，功能靠同一文件里的其它事件兜着。
2. **`astro:page-load` 首屏不触发。** 若某脚本只挂它，第一次进入页面时不会跑。正确的双写范式见第 8.3 节。
3. **`window.swup` 在 `DOMContentLoaded` 时还没有。** 因为 `loadOnIdle` 默认 `true`，swup 在 `window.load` + idle 之后才 `new Swup()`，而且 Swup 与插件的 chunk 也是那时才动态加载的（第 2.1 节）。写「先判断 `window.swup`，否则监听 `swup:enable`」是标准动作。
4. **字符串 `ignore` 以 `/` 开头是前缀匹配。** 写 `"/"` 忽略全站；要精确匹配必须用正则或函数。`ignore` 里的函数会被 `new Function` 重建，**不能闭包**。
5. **`swup.navigate()` 没有 `el`。** 任何靠 `el` 的忽略规则都拦不住程序化跳转 —— 本项目刻意补了一条不依赖 `el` 的规则。
6. **`ignore` 拦得住点击，拦不住前进/后退。** 历史导航由 `handlePopState` 处理，只看 `skipPopStateHandling`，而该选项没被透传，只能自己监听 `popstate`（`swup-manager.ts:280`）。
7. **`preload: false` 让链接预加载整套失效，且失效点在更早的地方。** `swup-manager.ts:167-175` 会在 swup 就绪前调用 `initLinkPreloading()`，而 `navigation-utils.ts:170` 的第一道护栏是 `if (!isSwupReady() || isSlowConnection()) return;` —— 首屏这次调用会直接早退，连 IntersectionObserver 都不会建立。即便侥幸进入，后面 `preloadPage()` 里的 `if (isSwupReady() && window.swup.preload)`（`:132`）也永远为假，因为 `swup.preload` 方法只由 SwupPreloadPlugin 挂载，而 `preload:false` 让该插件没启用。表现同样是「代码在跑，但没有效果」。
8. **两个 `pathsEqual`、三个 `isPostPage`。** `src/utils/url-utils.ts:16`（归一化，实际在用）、`src/utils/navigation-utils.ts:270`（只去尾斜杠，无人用）；`src/utils/navigation-utils.ts:262`、`src/utils/tocManager.ts:438`、`src/components/features/toc/hooks/useTocNavigation.ts:95`。跳转定义时认准 import 源。
9. **换页只替换 `<main>`。** 所以 `#navbar`、`#sidebar`、`.music-player`、`#pio-container` 这些 `<main>` 之外的东西天然存活；而 `<main>` 之内的所有交互（TOC、Fancybox、代码块折叠）都必须显式重新初始化。「Layout 脚本不重跑」也是同一原因 —— 它是打包后的外部模块（第 9.1 节）。
10. **`is:inline` 的脚本每次换页会被重放。** SwupScriptsPlugin 会重新执行缺 `data-swup-ignore-script` 的 `<script>`（第 9.2 节）。写页面级内联脚本时要自带幂等守卫，或加 `data-swup-ignore-script`。
11. **生产环境 swup 会换 `<head>`。** `updateHead` 仅生产为真，样式标签会被差异同步替换；根字号（写 `<html>` 行内 `style`）不受影响，但排查样式闪烁与布局异常时要记得这一层（第 9.3 节）。

---

## 相关文件

- `astro.config.mjs` —— Swup 集成配置和 `ignore` 两条规则的唯一落点。
- `node_modules/@swup/astro/dist/index.js` —— `astro:config:setup` 里 `injectScript` 的接入点。
- `node_modules/@swup/astro/dist/script.js` —— `ignore` 语义、插件启用表、动态 import 组装、`astro:*` 事件桥接的实现。
- `node_modules/@swup/astro/dist/serialise.js` —— 回调序列化，解释「函数不能闭包」。
- `node_modules/@swup/astro/dist/idle.js` —— `onIdleAfterLoad`，解释 swup 何时才初始化。
- `node_modules/.pnpm/swup@4.8.3/node_modules/swup/dist/Swup.modern.js` —— swup 核心：钩子注册表、默认选项、`shouldIgnoreVisit` / `navigate` / `handlePopState` / `handleLinkClick` / `dispatchDomEvent`。
- `node_modules/.pnpm/@swup+scripts-plugin@2.1.0_swup@4.8.3/node_modules/@swup/scripts-plugin/dist/index.modern.js` —— 换页脚本重放规则。
- `node_modules/.pnpm/@swup+head-plugin@2.3.1_swup@4.8.3/node_modules/@swup/head-plugin/dist/index.modern.js` —— 生产环境 head 差异同步。
- `src/scripts/swup-manager.ts` —— 客户端总装配、`swup:enable` 等待、popstate 起始页守卫。
- `src/scripts/core/swup-config.ts` —— 选择器、过渡/动画常量、Fancybox 与性能配置。
- `src/scripts/core/swup-hooks.ts` —— 五个 swup 钩子的全部处理逻辑。
- `src/scripts/handlers/` —— 返回顶部、Fancybox、浮窗、滚动四个处理器。
- `src/scripts/effects/` —— 樱花与过渡变量两个特效模块。
- `src/scripts/theme-optimizer.js` / `code-collapse.js` / `right-sidebar-layout.js` —— 主题切换性能优化、代码块折叠、网格模式侧栏。
- `src/scripts/landing/index.ts` —— 起始页运行时与清理范式。
- `src/utils/url-utils.ts` —— 路径归一化 `pathsEqual` 与 URL 生成，跨构建期/运行期。
- `src/utils/navigation-utils.ts` —— `navigateToPage` 等跳转封装与预加载（注意死函数 `waitForSwup`）。
- `src/utils/setting-utils.ts` —— 主题/色相/壁纸读写。
- `src/utils/tocManager.ts` —— TOC 生成与滚动跟踪。
- `src/utils/panel-manager.ts` / `sakura-manager.ts` / `widget-manager.ts` —— 浮窗、樱花、侧栏组件管理。
- `src/layouts/Layout.astro` —— `initSwupManager()` 调用点与全局脚本挂载位置。
- `src/layouts/MainGridLayout.astro` / `src/pages/index.astro` —— 两种 `<main id="swup-container">` 外壳，解释起始页为何被排除。
- `src/layouts/partials/HeadTags.astro` —— 首帧主题脚本、根字号 clamp、dev 下改 `window.swup.options.updateHead`。
- `src/layouts/partials/GridScripts.astro` —— `swup:page:view` / `content:replace` 的壁纸与布局重算。
- `src/pages/anime.astro` —— 番剧筛选与布局逻辑的实际内联位置。
- `src/components/features/posts/LastModified.astro` —— 真正刷新 `#modifiedtime` 的内联脚本。
- `src/components/layout/Banner.astro` —— `data-swup-ignore-script` 的用法示例。
- `src/stores/musicPlayerStore.ts` —— 唯一的全局状态容器，音乐播放。
- `src/styles/transition.css` —— `transition-swup-*` 动画与 `--transition-*` 变量的消费方。
