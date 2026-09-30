export const PAGE_SIZE = 8;

/**
 * 文章列表（分页首页）的路径。
 *
 * 站点根 "/" 让给了起始页（开屏动画 + 「进入」按钮），原来的首页 ——
 * 那个分页文章列表，src/pages/home/[...page].astro —— 挪到了这里，
 * 翻页就是 /home/2/、/home/3/。
 *
 * 凡是判断「这是不是首页」的地方都必须用这个常量，别再写 "/"：
 * 改这一处，Layout / Navbar / MainGridLayout / swup 钩子 / 移动端 TOC
 * 会一起跟着走。写死的 "/" 现在指的是起始页，语义完全变了。
 */
export const HOME_PATH = "/home/";

export const LIGHT_MODE = "light",
	DARK_MODE = "dark";
// 从未选择过主题的访客（localStorage 无 "theme" 键）默认使用夜间模式。
// 这是全站唯一的默认主题真源：首帧脚本、主题切换按钮、swup 换页同步都从这里取值。
export const DEFAULT_THEME = DARK_MODE;

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 3.5;

// Page width: rem
export const PAGE_WIDTH = 90;

// Category constants
export const UNCATEGORIZED = "uncategorized";

// Wallpaper mode constants
export const WALLPAPER_BANNER = "banner";
export const WALLPAPER_FULLSCREEN = "fullscreen";
export const WALLPAPER_NONE = "none";
