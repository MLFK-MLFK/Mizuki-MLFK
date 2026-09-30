# 07 · 样式体系

这一块回答三个问题：样式写在哪个文件里、谁的优先级更高、改一处会连带影响哪里。
本项目同时用 Tailwind CSS v4、Stylus、原生 CSS 和组件内 `<style>` 四种写法，还叠了 swup 换页、明暗主题、色相滑块、宽屏根字号缩放四套运行时机制，所以「改个颜色」常常不止改一处。

- 你要加一个页面或组件、不确定样式该放哪 → 先看第 1、3、4 节。
- 你的样式「写了但没生效」或「被别处盖掉」 → 看第 5 节。
- 你要调主题色 / 明暗模式、或想知道 `--hue` 从哪来 → 看第 6 节。
- 你在宽屏上发现 `clamp()` 算出的大小和预期对不上 → 看第 7 节，这是本仓库最容易踩的坑。
- 你要动起始页（站点根 `/`） → 看第 9 节，改之前先读完。
- 有几处「源码里找不到引用、却似乎被打包」的样式 → 见文末的「尚未核实的问题」。

---

## 1. 四种写法各管什么

| 写法 | 用途 | 本仓库的实际例子 |
| --- | --- | --- |
| Tailwind 工具类 | 组件的**布局、间距、响应式**，写在 `.astro` / `.svelte` 的 `class` 里 | `src/layouts/Layout.astro:164` 的 `bg-[var(--page-bg)] text-[14px] md:text-[16px]` |
| `@layer components` 里的语义类 | 复用度高、带 `@apply` 的**组件级类**（`.card-base`、`.btn-plain`、`.float-panel`） | `src/styles/main.css:244-511` |
| 原生 CSS（`src/styles/*.css`） | 需要复杂选择器／伪元素／`@keyframes`，Tailwind 类写不顺的地方 | `src/styles/toc.css`、`transition.css`、`banner.css` |
| Stylus（`.styl`） | 两种场景：全局变量分发 + 组件内样式 | 全局：`src/styles/variables.styl`；组件内：`src/components/common/FloatingButton.astro:29` 的 `<style lang="stylus">` |
| 组件内 `<style>`（Scoped） | 只服务于单个组件、不需要跨组件复用的规则；Astro 会加 `data-astro-cid-*` 作用域 | `src/components/comment/Twikoo.astro:154` |

**Stylus 的价值在于「能算、能循环」**：`src/styles/variables.styl:16-23` 定义了一个 Stylus 函数 `define(vars)`，用 `for key, value in vars` 遍历一张映射表，把「亮色值 / 暗色值」成对写法的变量一次性展开成 `:root` 与 `:root.dark` 两套规则（`src/styles/variables.styl:25-100`）。这种「一个变量名、两个值」的表格无法用原生 CSS 直接表达。

**什么时候别用 Tailwind 类硬编码颜色**：本仓库大量使用 `bg-(--card-bg)`、`text-(--primary)` 这类语法（`src/styles/main.css:245`、`:328`、`:340`、`:395`、`:450`），把 CSS 变量塞进工具类，而不是把颜色硬编码进 `@theme`。改一个 `variables.styl` 里的变量就能全站变色，这是刻意的设计。

---

## 2. Tailwind CSS v4：没有配置文件，全部在 CSS 里声明

接入方式是 **Vite 插件**，不是 PostCSS 插件：

- `astro.config.mjs:7` 引入 `@tailwindcss/vite`，`astro.config.mjs:222` 在 `vite.plugins` 里挂上 `tailwindcss()`。
- 仓库根目录 **没有** `tailwind.config.js` / `tailwind.config.ts`（`ls` 可见只有 `postcss.config.mjs`、`svelte.config.js`）。这是 v4 的默认形态：配置写在 CSS 里。
- `postcss.config.mjs:1-8` 只挂了 `postcss-import` 与 `postcss-nesting`，用于处理 `@import` 和嵌套写法（供那些不走 Tailwind 入口的独立 CSS 用），**不参与** Tailwind 主题。

入口 CSS 是 `src/styles/main.css`，由 `src/layouts/Layout.astro:14` 静态导入。它承担了 v3 时代 `tailwind.config.js` 的全部职责：

| v3 配置项 | 在 v4 里的位置 | 内容 |
| --- | --- | --- |
| 插件 | `src/styles/main.css:16` | `@plugin "@tailwindcss/typography"` |
| `darkMode: 'class'` | `src/styles/main.css:18` | `@custom-variant dark (&:where(.dark, .dark *));` |
| `theme.extend` | `src/styles/main.css:21-27` | `@theme { --font-sans / --breakpoint-md / -lg / -xl }` |
| `content` 扫描 | 无需声明 | v4 自动扫描项目源码 |

**为什么第一个非注释行必须是 `@import "tailwindcss";`**（`src/styles/main.css:1`）：Tailwind v4 在该指令处展开出 `theme / base(Preflight) / components / utilities` 四层，并声明层顺序；后面的项目样式才有统一的层叠基线可依赖。同一文件里紧跟其后的是 6 个项目样式 `@import`（`src/styles/main.css:4,6,8,9,11,13`），它们都是**无层级（unlayered）**的普通 CSS —— 见第 5 节，这决定了它们的优先级天然高于 Tailwind 的 `@layer` 内容。

### 字体声明在 main.css 顶部

`src/styles/main.css:29-44` 用两条 `@font-face` 引入两个自托管字体，`font-display: swap` 避免阻塞：

- `ZenMaruGothic-Medium`（`/assets/font/ZenMaruGothic-Medium.ttf`，`src/styles/main.css:30-35`）
- `萝莉体 第二版`（`/assets/font/loli.ttf`，`src/styles/main.css:38-44`）

字体文件由构建脚本压缩后复制到 `dist/`（`src/layouts/partials/HeadTags.astro:95-96` 的注释说明了这一点，所以它不在 head 里做 preload，避免 404）。注意「JetBrains Mono Variable」**不只**在起始页的等宽字体栈里出现（`src/styles/landing/landing.css:80` 的 `--lp-font-mono`），代码块字体栈里也用它：`src/styles/markdown.css:42`、`src/styles/expressive-code.css:22`、`src/styles/encrypted-content.css:42`，以及 `astro.config.mjs:133` 的 `codeFontFamily`。它还**有**对应的 `@font-face`：`src/components/misc/Markdown.astro:3` 直接 `import "@fontsource-variable/jetbrains-mono"`，由 Vite 打进包里，所以代码块能真用上这个字体，不是靠系统字体兜底。

### 构建层的 CSS 产包选项

`astro.config.mjs:252-259` 显式设置了 Vite 的 CSS 行为，这决定了各页 CSS 的拆分与内联粒度：

| 选项 | 值 | 作用 |
| --- | --- | --- |
| `cssCodeSplit` | `true`（`astro.config.mjs:256`） | CSS 按入口分块，各页只带自己用到的样式 |
| `cssMinify` | `"esbuild"`（`astro.config.mjs:257`） | 用 esbuild 压缩 CSS |
| `inlineStylesheets` | `"auto"`（`astro.config.mjs:259`） | 小型 CSS 直接内联进 HTML，减少请求 |

配套地，`astro.config.mjs:63` 的 swup `containers:["main"]` 与 `astro.config.mjs:68` 的 `updateHead: process.env.NODE_ENV === "production"` 意味着：**生产环境**下 swup 换页会替换 `<head>`，页面切换时头部样式会跟着更新；开发环境则不换，避免反复替换 `<style>` 导致偶发样式丢失（`src/layouts/partials/HeadTags.astro:189-194` 有针对 dev 的额外处理注释）。

---

## 3. 一条 CSS 是怎么进到页面里的

Astro 按组件/页面静态导入收集 CSS，`Layout.astro` 是最上游的汇合点。

```
Layout.astro:14-19
  ├── main.css:1   @import "tailwindcss"
  │     ├── main.css:4  albums.css
  │     ├── main.css:6  anime.css
  │     ├── main.css:8  transition.css → :1 _transition-vars.css
  │     ├── main.css:9  animation-enhancements.css
  │     ├── main.css:11 gradient-buttons.css
  │     └── main.css:13 banner.css
  ├── mobile-navbar.css
  ├── wallpaper-navbar-transparent.css
  ├── fancybox-custom.css
  ├── expressive-code.css
  └── panel-animations.css
```

其余样式从各自的组件进入：

| 样式文件 | 被谁导入 |
| --- | --- |
| `src/styles/toc.css` | `src/components/widgets/card-toc/CardTOC.astro:8` |
| `src/styles/markdown.css`、`expressive-code.css`、`encrypted-content.css`、`markdown-extend.styl` | `src/components/features/auth/Encryptor.astro:2-5` |
| `src/styles/anime.css` | `src/pages/anime.astro:2`（与 `main.css:6` 重复导入一次） |
| `src/styles/landing/landing.css` | `src/pages/index.astro:10` |

`Encryptor.astro` 值得单独说：它是 `src/pages/posts/[...slug].astro:31` 静态导入的，所以 **markdown.css / markdown-extend.styl / encrypted-content.css 会随每一篇普通文章一起加载**，并不只在加密文章里生效。`.custom-md` 正文样式（`src/styles/markdown.css:3`）就是这么到文章页的。

### 按需 / 动态加载的样式

有两条样式不是构建期静态进包的，而是运行时按需注入：

- KaTeX：`src/scripts/handlers/scroll-handler.ts:81-85` 的 `checkKatex()` 发现页面里存在 `.katex` 时，才 `import("katex/dist/katex.css")`（`src/scripts/handlers/scroll-handler.ts:83`）。
- Fancybox：`src/scripts/handlers/fancybox-handler.ts:65` 在初始化灯箱时 `await import("@fancyapps/ui/dist/fancybox/fancybox.css")`。

### 组件内 `<style>` 的边界

`Layout.astro:248-256` 有一个 `is:global` 的 `<style>` 块，开头写 `@reference "../styles/main.css";`。`@reference` 是 Tailwind v4 指令：让这个独立 CSS 块能 `@apply` 主样式表的工具类与变量，但**不重复输出**主样式表。凡是写在 `main.css` 之外、又要用 `@apply` 的 CSS 文件，开头都要有 `@reference "tailwindcss";`（`src/styles/markdown.css:1`、`scrollbar.css:1`、`expressive-code.css:1`、`twikoo.css:6`、`photoswipe.css:1`、`encrypted-content.css:1`）。组件内 `<style>` 也照此办理（`src/components/organisms/navigation/NavMenuPanel.astro:150`、`DropdownMenu.astro:129`、`src/components/features/posts/PostPage.astro:191`）。

---

## 4. `src/styles/` 职责表

共 24 个文件，另有 `landing/landing.css` 1 个（见第 9 节）。

| 文件 | 一句话职责 |
| --- | --- |
| `main.css` | Tailwind 入口 + 全局组件类（`.card-base`/`.btn-*`/`.float-panel`/spoiler/文章列表布局） |
| `variables.styl` | 全站 CSS 变量真源：hue 派生的明暗两套色板 |
| `transition.css` | swup 换页过渡类（`.transition-main` 等）+ View Transitions 主题淡入淡出 |
| `_transition-vars.css` | 过渡动画的 CSS 变量默认值（时长/缓动/位移/错落），JS 会覆盖 |
| `toc.css` | 目录条目、层级缩进、活动指示器 |
| `markdown.css` | `.custom-md` 正文：锚点、链接、代码、表格、KaTeX |
| `markdown-extend.styl` | 提示框（admonition）的标题配色与 SVG 图标 |
| `banner.css` | Banner 文本/轮播/水波纹 + 桌面端 TOC 侧栏位置 |
| `scrollbar.css` | OverlayScrollbars 手柄尺寸与配色映射 |
| `animation-enhancements.css` | `.animate` / `.xxx-animate` 入场动画与 `prefers-reduced-motion` |
| `mobile-navbar.css` | 导航栏透明/滚动状态，以 1280px 为界分桌面/移动写两套 |
| `wallpaper-navbar-transparent.css` | 全屏壁纸模式下的导航栏 token 与状态变量 |
| `mobile-transition-fix.css` | 移动端换页闪烁/性能（`@media max-width:768px` 的 GPU 加速） |
| `mobile-post-list-fix.css` | 移动端文章列表初始化前隐藏防闪（`#post-list-container:not(.js-initialized)`） |
| `widget-responsive.css` | 侧栏组件响应式布局 |
| `panel-animations.css` | `.float-panel` 浮层面板进出动画 |
| `gradient-buttons.css` | `.btn-gradient` 渐变按钮 |
| `anime.css` | 追番页网格/容器查询（`container-type: inline-size`） |
| `albums.css` | 相册卡片动画与瀑布流 |
| `expressive-code.css` | 代码块按钮、Mermaid 全屏按钮配色 |
| `encrypted-content.css` | `#decrypted-content` 解密后与 markdown.css 对齐 |
| `twikoo.css` | Twikoo 评论区样式（唯一允许 `!important` 的文件，见 `docs/rule/04-css-style-guide.md:21`） |
| `photoswipe.css` | PhotoSwipe 灯箱按钮 |
| `fancybox-custom.css` | Fancybox 灯箱容器配色与工具栏 |

**必须优先读的 8 个**：`main.css`、`variables.styl`、`transition.css` + `_transition-vars.css`、`toc.css`、`markdown.css`、`banner.css`、`scrollbar.css`、`animation-enhancements.css`。

---

## 5. 层叠与优先级：谁盖谁

1. **分层与命名**：Tailwind 用 `@layer components` 放语义类（`src/styles/main.css:76` 开始，到 `:511` 结束），BEM 风格的修饰符用双横线（`.lp-card--half`，`src/styles/landing/landing.css:957`）。修饰符必须排在基类**之后** —— 两者都是单类选择器 `(0,1,0)`，靠源码顺序决胜（`src/styles/landing/landing.css:955-956` 有明确注释）。
2. **无层级 CSS 会盖住 Tailwind**：`src/styles/main.css:4-13` 导入的 `banner.css`、`albums.css` 等是 unlayered，而未加 `@layer` 的普通 CSS 在层叠中**优先于** `@layer` 内容。所以 banner 相关样式能盖住 Tailwind 工具类，无需 `!important`。想被 Tailwind 工具类覆盖的规则，就写进 `@layer components`。
3. **`!important` 的唯一特许**：只允许在 `src/styles/twikoo.css`（第三方评论样式），理由与示例见 `docs/rule/04-css-style-guide.md:21` 的「Twikoo 评论区样式」小节：Twikoo 由 JS 动态注入、内部选择器优先级高、影响范围隔离在评论区。其余地方用 `!important` 会被 review 挡下（`src/styles/main.css:252-270` 里那几处是历史遗留的壁纸模式覆盖）。

---

## 6. 明暗模式、主题色与 `--hue` 的来龙去脉

### 主题类名挂在哪里

`dark` 加在 `<html>`（`document.documentElement`）上，**不是** `<body>`。

- 首帧前由 `src/layouts/partials/HeadTags.astro:114-125` 的内联脚本读取 `localStorage.theme` 并 `classList.add("dark")`，避免闪白。
- 默认值来自 `src/constants/constants.ts:20`：`DEFAULT_THEME = DARK_MODE`，即**默认是深色**。
- 变体声明是 `src/styles/main.css:18` 的 `@custom-variant dark (&:where(.dark, .dark *))`：`.dark` 自身和其后代都命中 `dark:` 前缀。`&:where(...)` 的零特异度写法让 `dark:` 工具类不额外抬高优先级。
- 原生 CSS 里则写 `:root.dark` 或 `.dark`（`src/styles/main.css:67`、`src/styles/variables.styl:20`、`src/styles/landing/landing.css:98`）。

### `--hue` 从哪来、到哪去

这是本仓库最「散」的一条链，按时间顺序：

| 阶段 | 位置 | 行为 |
| --- | --- | --- |
| 构建期默认值 | `src/config.ts:36-39` | `themeColor.hue: 345`（粉） |
| 首帧注入 | `src/layouts/partials/HeadTags.astro:136-137` | 读 `localStorage.hue`，没有就用配置值，写进 `documentElement.style.setProperty("--hue", hue)` |
| 运行期读取 | `src/utils/setting-utils.ts:21-24` | `getHue()` 先看 `localStorage.hue`，没有才 `getDefaultHue()` |
| 运行期写入 | `src/utils/setting-utils.ts:26-33` | `setHue()` 同时写 `localStorage` 与 `:root` 的 `--hue`（设置面板拖动色相滑块时走这里） |
| 派生色 | `src/styles/variables.styl:25-100` | 所有颜色统一写成 `oklch(L C var(--hue))`，由 `define(vars)` 分发到 `:root` 与 `:root.dark` |

**反直觉点**：`src/utils/setting-utils.ts:11-19` 的 `getDefaultHue()` 兜底值是字符串 `"250"`，而配置真值是 345。当 `#config-carrier` 不存在、或它的 `dataset.hue` 为假值时才会走兜底（`getDefaultHue` 优先读 `dataset.hue`），属于异常路径，但两边数值不一致。

### `variables.styl` 里容易漏掉的两处

除了那张 `define({...})` 大表，文件里还有两段直接写死的规则：

- `src/styles/variables.styl:11-13`：`:root` 上定义 `--radius-large: 1rem` 与 `--content-delay: 150ms`，它们不在 `define` 表里，是全局固定值（`.card-base` 的圆角就取自 `--radius-large`）。
- `src/styles/variables.styl:102-111`：按 `body` 是否带 `.wallpaper-transparent` 覆盖 `--card-bg-transparent`。非全屏壁纸模式下让它等于 `--card-bg`（不透明），全屏壁纸模式下才给它真正的半透明值（亮色 `rgba(255,255,255,0.8)`、暗色 `rgba(23,23,23,0.8)`）。

### `src/scripts/theme-optimizer.js` 做什么

它**不负责切换主题**，而是切换**期间**的性能优化器。`ThemeOptimizer` 用 MutationObserver 监听 `<html>` 的 class 变化（`src/scripts/theme-optimizer.js:351`，同时读 `.is-theme-transitioning` 与 `.use-view-transition`，见 `:360-363`），一旦发现 `.is-theme-transitioning` 被加上，`optimizeThemeSwitch()`（`:381-398`）依次：

1. `disableHeavyAnimations()`（`:400-454`）：往 `<head>` 插一张 `#theme-optimizer-temp` 临时样式表（`:401-405`），关掉重型元素（`.float-panel`、`#navbar`、`.widget`、`.post-card`、`.custom-md`）的过渡与动画，加 `contain: layout style paint`，并临时隐藏代码块；
2. `hideOffscreenHeavyElements()`（`:456-480`）：把视口外（含 200px 边距）的重型元素设 `contentVisibility = "hidden"`；
3. `forceCompositing()`（`:482-499`）：给 `.expressive-code`、`.post-card`、`.widget`、`#navbar` 加 `translateZ(0)` 与 `will-change: transform`，强制合成层。

若本次切换用的是 View Transitions API（`.use-view-transition`），它在 `:386-388` 直接 return，跳过全部优化，交给浏览器。CSS 侧的对应规则在 `src/styles/main.css:138-235`，注意它们几乎都带 `:not(.use-view-transition)` 守卫 —— 两套保护不能同时生效。`theme-optimizer.js` 由 `src/layouts/Layout.astro:334-336` 全局加载。

### 过渡时长：CSS 默认值会被运行期改写

`src/styles/_transition-vars.css:6-12` 在 `:root` 上给出一组默认值（`--transition-duration: 120ms`、缓动、位移 `1.5rem`、错落 `35ms`），但 `src/scripts/effects/transition-effect.ts:20-35` 的 `applyConfig()` 会用 `src/scripts/core/swup-config.ts:58-64` 的 `TRANSITION_CONFIG`（同样 `duration: 120`）在运行期覆盖这几个变量。**要调时长就改 `TRANSITION_CONFIG`，改 CSS 没用**。`_transition-vars.css:14-20` 与 `:22-27` 还分别处理了 `prefers-reduced-motion` 与小屏的默认值。

---

## 7. 根字号缩放陷阱（宽屏上 `clamp()` 会整体缩水）

**规则在哪**：`src/layouts/partials/HeadTags.astro:148-186`，这是从 `MainGridLayout` 搬进 Head 的首帧脚本，配置在 `src/config.ts:66-69`（`pageScaling.enable: true`，`targetWidth: 2000`）。

**它做什么**：

1. 触屏设备、竖屏、或 `innerWidth <= 1280` → 清空行内字号，不缩放（`src/layouts/partials/HeadTags.astro:159-162`）。
2. 否则 `scale = clientWidth / 2000`（`:164-166`），上限 1（`:167-169`），下限 0.85（`:170-172`）。
3. `document.documentElement.style.fontSize = scale * 100 + "%"`（`:173`）。

**结论**：在桌面非触屏、横屏下——

| 视口宽度 | 根字号 | 效果 |
| --- | --- | --- |
| ≤ 1280px | 不设置（走 `Layout.astro:164` 的 `text-[16px]`） | 正常 |
| 1281–1700px | 85% | 所有 `rem` 整体缩水 15% |
| 1700–2000px | 85%–100% 线性 | 越宽越接近原值 |
| ≥ 2000px | **恒为 100%** | 正常 |

注意最后一档：`clientWidth >= 2000` 时 `scale` 被 clamp 到 1，写进去的值恒为 `"100%"`，**不会**被清空（清空只发生在触屏/竖屏/窄屏分支）。

**为什么是陷阱**：`clamp()` 的上限大多写成 `rem`（例如 `src/styles/landing/landing.css:516-519` 的 `min(Xvw, Yvh)`、`:1994` 的 `clamp(0.6rem, 1.6vh, 1.1rem)`）。当根字号被压到 85%，这些 `rem` 上限会一起乘以 0.85，于是「我明明写了 `1.1rem`」在 1440px 宽的屏幕上只有 `0.935rem`。`vw`/`vh`/`px` 不受影响，所以混用单位时体感会不一致。

**怎么验证**：在浏览器 devtools 里切到 1440px 宽（非触屏），执行

```js
getComputedStyle(document.documentElement).fontSize; // 期望 "13.6px"（16 * 0.85）
document.documentElement.style.fontSize;             // "85%"
```

再把宽度拖到 2100px，`style.fontSize` 会变成 `"100%"`。

**怎么规避**：给宽屏专门写 `@media (min-width: 1281px)` 覆盖，或把关键尺寸写成 `vw/vh`，或在 JS 里读 `documentElement` 的实际字号再换算。别假设 `1rem === 16px`。

---

## 8. 响应式断点约定与移动端文件

**Tailwind 断点是改过的**，不是默认值（`src/styles/main.css:21-27`）：

| 前缀 | 本仓库值 | Tailwind 默认值（提醒） |
| --- | --- | --- |
| `md:` | 768px | 768px |
| `lg:` | **1280px** | 1024px |
| `xl:` | **1920px** | 1280px |

所以写 `lg:is-home`、`lg:` 之类的类时要按 **1280px** 想，而不是 1024px。原生 CSS 里的事实约定也是这一套：手写 `@media` 几乎只用 `max-width: 768px` / `min-width: 768px`（`src/styles/main.css:475`、`:582`）、`min-width: 1280px` / `max-width: 1279px`（`src/styles/mobile-navbar.css:13`、`:24`），再加一个 480px 小屏档（`src/styles/mobile-navbar.css:149`）。

**一个具体的坑**：`src/styles/widget-responsive.css:7-11` 定义了一套 `--breakpoint-mobile/tablet/desktop` 自定义属性，但 **CSS 变量不能用在媒体查询里**，那套变量在本文件里也确实没用 —— 它的媒体查询全是硬编码的 767px（`src/styles/widget-responsive.css:73,85,124,137`）。照抄会踩坑。

各移动端文件分别修什么：

| 文件 | 修的问题 | 当前是否被导入 |
| --- | --- | --- |
| `mobile-navbar.css` | 导航栏在透明/滚动/首页三种状态下的背景（亮暗各一套，1280px 分界） | 是，`src/layouts/Layout.astro:15` |
| `mobile-transition-fix.css` | 手机换页闪烁：给动画元素加 GPU 加速、把换页位移动画缩到 200ms、超小屏再缩 | 源码中未发现 `import` |
| `mobile-post-list-fix.css` | 文章列表初始化闪烁：`#post-list-container:not(.js-initialized) { opacity: 0 }`，等 JS 加类后再显示 | 源码中未发现 `import` |
| `widget-responsive.css` | 侧栏组件在不同宽度下的间距/高度 | 源码中未发现 `import` |

（「未发现 import」是对当前工作区全仓搜索的结论，但构建产物里是否真有它，见文末「尚未核实的问题」。）

---

## 9. 起始页独立样式 `src/styles/landing/landing.css`

约 2050 行，是仓库里最大的单个样式文件，服务于站点根 `/`（`src/pages/index.astro:66` 的 `#lp-root.lp`）。

**作用域前缀**：所有规则收在 **`.lp`** 之下，少数几条用 `body:has(#lp-root)` 反选 Layout 塞进来的浮层：

- `src/styles/landing/landing.css:19-26` 是 `.lp` 的 token 起点；
- `src/styles/landing/landing.css:144-148` 把 `body` 钉死 `100svh` 并 `overflow: hidden`（因为 `Layout.astro:212` 的 `<body class="min-h-screen">` 在移动端会多出一截可滚动空白）；
- `src/styles/landing/landing.css:154-156` 关掉 `.top-gradient-highlight`（否则深色下顶部糊一层白雾）；
- `src/styles/landing/landing.css:87-95` 用 `height: 100svh` + flex 把整页锁成一屏，内部尺寸一律 `min(Xvw, Yvh)`，所以窗口变矮时等比收缩。

**`--lp-*` 变量时间轴**：这是一套自成体系的 token，与 `variables.styl` 的主色板**没有命名重叠**，只有色相借用了站点的 `--hue`（`src/styles/landing/landing.css:23`）：

```css
--lp-h: var(--hue, var(--lp-hue, 345));    /* landing.css:23，优先运行时 --hue */
--lp-accent: oklch(0.62 0.19 var(--lp-h)); /* landing.css:24，深色下在 :100 覆盖 */
```

时间轴本身由 `src/styles/landing/landing.css:1441-1468` 的四个变量驱动，再在 `:1883-1885` 与 `:1892-1904` 被两条选择器改写：

| 变量 | 默认值 | 位置 | 跳过时 |
| --- | --- | --- | --- |
| `--lp-exit` | `4.4s` | `landing.css:1443` | `0s`（`:1893`） |
| `--lp-exit-dur` | `0.6s` | `landing.css:1444` | `0.26s`（`:1894`） |
| `--lp-stage-out` | `4.02s` | `landing.css:1445` | `0s`（`:1895`） |
| `--lp-stage-out-dur` | `0.38s` | `landing.css:1446` | `0.16s`（`:1898`） |
| `--lp-intro-delay` | `0s`（开屏时 `4.32s`，`:1884`） | `landing.css:76` | `0s`（`:1904`） |

跳过路径不碰动画，只改变量：`src/scripts/landing/index.ts:517-541` 监听 `wheel` 与 `keydown`（`Tab` 放行），命中后往 `<html>` 写 `data-lp-intro-done`，`landing.css:1892-1904` 那两条选择器把整条时间轴归零。**不使用 pointerdown 跳过**：因为开屏遮罩 `.lp-splash` 现在 `pointer-events: auto`（`landing.css:1457`），点击被遮罩吃掉，就不会「盲点穿透到帘子底下早已渲染好的按钮/卡片上当场跳走」（见 `landing.css:1452-1456` 与 `src/scripts/landing/index.ts:494-516` 的注释，两处是一体的）。片尾靠两条 0.01s 空动画在固定时刻拨开关（`landing.css:1466-1477`），不靠 JS 删节点。

**为什么不能和主样式表混着改**：

1. **全局作用域**：它是一份普通 `.css`（不是 `<style scoped>`），只靠 `.lp` 前缀隔离。往里加一条不带 `.lp` 的选择器，会直接污染全站。
2. **单屏约束**：整页高度恒等于 `100svh`，任何加高都会顶出滚动条或压掉 Bento 卡片。改动要用 `min(Xvw, Yvh)`，并检查 `src/styles/landing/landing.css:1915` 起的 `max-width: 767px` 与 `:1990-1996` 的 `max-height` 断点。
3. **它有自己的明暗覆盖**：`:root.dark .lp`（`src/styles/landing/landing.css:98-138`）覆盖了整套 token，主样式表的 `--card-bg` 之类在这里基本不用，混用会导致明暗下颜色不一致。
4. 该文件顶部注释（`src/styles/landing/landing.css:1-15`）仍写着「只被 `src/pages/start.astro` 引入」，而实际入口已是 `src/pages/index.astro:10`（起始页从 `/start/` 挪到了 `/`）。以代码为准。

---

## 10. 反直觉清单（改代码前先看）

- 全站没有 `tailwind.config.js`，找不到配置文件不是丢文件了，配置在 `main.css` 里。
- `lg:` 是 **1280px**，不是 1024px；`xl:` 是 1920px。
- 1281–1700px 宽度下 `1rem < 16px`（根字号 85%），所有 `rem` 的 `clamp()` 上限跟着缩水；≥2000px 恒为 100%。
- `dark` 类在 `<html>` 上，不在 `<body>`；默认主题是**深色**（`src/constants/constants.ts:20`）。
- `!important` 只许用在 `src/styles/twikoo.css`。
- 起始页的所有选择器都在 `.lp` 下，但 `landing.css` 里也有 `body:has(#lp-root)` 这类全局反选，删 `.lp` 前缀不等于不会影响别处。
- 起始页开屏**不能点击跳过**（只有滚轮/按键），遮罩 `pointer-events: auto` 是故意的，别「顺手」改回 `none`。
- `markdown.css` 不是在文章页直接导入的，它跟着 `Encryptor.astro` 一起进包；找正文样式别去 `posts/[...slug].astro` 里翻。
- 过渡时长写在 `TRANSITION_CONFIG`（`src/scripts/core/swup-config.ts:58-64`），改 `_transition-vars.css` 不生效。
- `variables.styl` 是构建期展开；`--hue`、`--banner-height-extend`、根字号是运行期由 JS 写 CSS 变量/行内样式。改 `variables.styl` 要重新构建，改 `--hue` 立即生效。
- 首帧脚本必须 `is:inline`：`src/layouts/partials/HeadTags.astro:102-103` 与 `src/pages/index.astro:57` 的脚本用 `is:inline` 保证在首帧前跑，普通 `<script>` 会被打包成 `defer`，主题/开屏会闪一下。

---

## 尚未核实的问题

以下几处无法凭当前工作区源码定论，动手前先用构建产物或 devtools 确认：

1. **「无 import 却被打包」的几个样式**：`src/styles/variables.styl`、`twikoo.css`、`widget-responsive.css`、`mobile-post-list-fix.css` 在当前源码里搜不到任何静态或动态 `import`；同为无 import 的 `scrollbar.css`、`photoswipe.css`、`mobile-transition-fix.css` 也一样搜不到。有构建产物显示前四个被打包并全站链接、后三个完全没有，但这与「零引用」相互矛盾，本次没有重新构建来复现，**真正机制未能核实**（曾怀疑 `import.meta.glob` 无扩展名过滤，但全仓未发现针对样式的 glob）。改这几个文件前，先用构建产物确认它到底有没有上屏。
2. **`variables.styl` 的编译入口**：它是 Stylus，理论上必须被某个 Astro/JS 模块导入才会编译。实际入口未定位。

---

## 相关文件

- `src/styles/main.css` — Tailwind v4 入口：`@import`、`@plugin`、`@custom-variant dark`、`@theme` 断点、`@font-face`、`@layer components` 全局组件类。
- `src/styles/variables.styl` — 全站 CSS 变量真源，`define(vars)` 把明暗两套色板按 `--hue` 展开。
- `src/styles/transition.css` — swup 换页过渡类与 View Transitions 主题动画，导入 `_transition-vars.css`。
- `src/styles/_transition-vars.css` — 过渡变量默认值，运行期被 `transition-effect.ts` 覆盖。
- `src/styles/toc.css` — 目录条目/层级/活动指示器。
- `src/styles/markdown.css` — `.custom-md` 正文（锚点、链接、代码、表格、KaTeX）。
- `src/styles/markdown-extend.styl` — 提示框（admonition）配色与图标。
- `src/styles/banner.css` — Banner 与桌面端 TOC 侧栏布局。
- `src/styles/scrollbar.css` — OverlayScrollbars 手柄尺寸与配色。
- `src/styles/animation-enhancements.css` — 入场动画类与 reduced-motion。
- `src/styles/mobile-navbar.css` — 导航栏透明/滚动状态，1280px 分界。
- `src/styles/widget-responsive.css` — 侧栏组件响应式布局（内含一套不能用于媒体查询的断点变量）。
- `src/styles/landing/landing.css` — 起始页全部样式，`.lp` 作用域 + `--lp-*` 时间轴。
- `src/layouts/Layout.astro` — 页面外壳，导入 main.css 等 6 个样式，`<body>`/`<html>` 的类与字号，`@reference` 的全局 `<style>`。
- `src/layouts/partials/HeadTags.astro` — 首帧主题/hue 注入、`--banner-height-extend`、根字号缩放脚本（`:148-186`）。
- `src/pages/index.astro` — 起始页入口，导入 `landing.css`，注入 `--lp-hue` 与 `data-lp-intro`。
- `src/scripts/landing/index.ts` — 起始页逻辑：跳过、时钟、视差，只改变量不碰动画。
- `src/scripts/theme-optimizer.js` — 主题切换期间的性能优化（临时样式表、隐藏屏外元素、强制合成层）。
- `src/scripts/effects/transition-effect.ts` — 运行期把 `TRANSITION_CONFIG` 写进 `--transition-*` 变量。
- `src/scripts/core/swup-config.ts` — `TRANSITION_CONFIG`（过渡时长的真源）。
- `src/scripts/handlers/scroll-handler.ts` — 按需注入 KaTeX CSS（`:83`）。
- `src/components/features/auth/Encryptor.astro` — 导入 markdown / encrypted-content / markdown-extend / expressive-code。
- `src/components/widgets/card-toc/CardTOC.astro` — 导入 `toc.css`。
- `src/config.ts` — `themeColor.hue`（`:36-39`）与 `pageScaling`（`:66-69`）配置。
- `src/constants/constants.ts` — `DEFAULT_THEME`（`:20`）与 `PAGE_WIDTH`（`:31`）。
- `src/utils/setting-utils.ts` — 运行期读写 `--hue`（`getHue`/`setHue`）。
- `docs/rule/04-css-style-guide.md` — 仓库既有的 CSS 规范，含 `!important` 的唯一例外说明。
