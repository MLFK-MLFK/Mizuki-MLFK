import { existsSync } from "node:fs";
import { join } from "node:path";

import { navBarConfig, siteConfig } from "@/config";
import { HOME_PATH } from "@/constants/constants";
import { LinkPresets } from "@/constants/link-presets";
import type { NavBarConfig, NavBarLink, SiteConfig } from "@/types/config";

/**
 * 起始页「快捷入口」的链接来源。
 *
 * 原先这里是 LandingBento.astro 里手写的一个四项数组，和 config.ts 的
 * navBarConfig 并行维护 —— 结果它悄悄过期了：`featurePages` 把「项目」和
 * 「日记」关掉之后，卡片上的链接还指着 /projects/ 和 /diary/，点进去是 404。
 *
 * 现在改成从 navBarConfig 推导，并且只保留「点进去真能打开」的站内入口。
 * 于是以后在 navBarConfig 里加一项，起始页会自动跟着出现；关掉某个
 * featurePages，起始页也会自动摘掉 —— 不用再回来改这里。
 *
 * 这个模块依赖 node:fs，只能在构建期跑。Astro 的 frontmatter 就是构建期，
 * 不会被打进客户端 bundle；但别从客户端脚本里 import 它。
 */

type FeatureFlag = keyof SiteConfig["featurePages"];

/**
 * 路径 → featurePages 里的开关名。
 *
 * 为什么非要有这张表：被 featurePages 关掉的页面**不会**变成 404，
 * 而是照常构建成一个跳 /404/ 的空壳（实测 /projects/index.html 只有 291 字节），
 * 所以「src/pages 下有没有这个文件」查不出问题，必须显式看开关。
 */
const FEATURE_PAGE_FLAG: Record<string, FeatureFlag> = {
	"/anime/": "anime",
	"/diary/": "diary",
	"/friends/": "friends",
	"/projects/": "projects",
	"/skills/": "skills",
	"/timeline/": "timeline",
	"/albums/": "albums",
	"/devices/": "devices",
};

/**
 * 站内路径是否真的能打开。
 *
 * 两道检查缺一不可：
 *   1. featurePages 开关 —— 挡掉「文件在、但内容是跳 404 的空壳」那种
 *   2. src/pages 下有无对应文件 —— 挡掉 navBarConfig 里指向不存在页面的项
 *      （当前配置里「关于我」和「关于」都指向 /content/，而这个页面不存在）
 */
export function isReachablePage(href: string): boolean {
	const flag = FEATURE_PAGE_FLAG[href];
	if (flag && !siteConfig.featurePages[flag]) return false;

	const slug = href.replace(/^\/+|\/+$/g, "");
	if (!slug) return true; // 首页永远在

	const pages = join(process.cwd(), "src", "pages");
	return (
		existsSync(join(pages, `${slug}.astro`)) ||
		existsSync(join(pages, slug, "index.astro"))
	);
}

/**
 * 把 navBarConfig 摊平成一层给「快捷入口」卡用。
 *
 * 三个取舍：
 *   - 外链不收 —— 这张卡本来就并列渲染 profileConfig.links 那一排外链，
 *     再收一遍就重复了
 *   - 列表首页不收 —— 上方那个大「进入」按钮干的就是这件事。
 *     注意现在要排的是 HOME_PATH（/home/），不是 "/"：起始页占了根路径之后，
 *     LinkPreset.Home 的 url 跟着变成了 /home/，再按 "/" 排就一个都排不掉。
 *   - 父项打不开时仍然往下递归 —— 否则一个坏掉的父菜单会连带干掉它下面
 *     能用的子项（当前「关于我」指向不存在的 /content/，但它的子项「相册」
 *     是好的）
 */
export function getQuickLinks(): NavBarLink[] {
	const out: NavBarLink[] = [];
	const seen = new Set<string>();

	const walk = (items: NavBarConfig["links"]): void => {
		for (const item of items) {
			// navBarConfig 里可以混用 LinkPreset 枚举值和手写的链接对象，
			// 解析方式与 Navbar.astro:30-33 保持一致
			const link = typeof item === "number" ? LinkPresets[item] : item;

			const usable =
				!link.external &&
				link.url !== HOME_PATH &&
				!seen.has(link.url) &&
				isReachablePage(link.url);

			if (usable) {
				seen.add(link.url);
				out.push({ name: link.name, url: link.url, icon: link.icon });
			}

			// 父项被丢掉时也要往下走 —— 别用一个坏掉的父菜单连带干掉好用的子项
			if (link.children?.length) walk(link.children);
		}
	};

	walk(navBarConfig.links);
	return out;
}
