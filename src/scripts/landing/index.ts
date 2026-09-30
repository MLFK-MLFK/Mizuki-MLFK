/**
 * 起始页（站点根 /）客户端运行时
 *
 * 只被 src/pages/index.astro 的 <script> 引入，因此不会进入其它页面的产物。
 * 所有副作用都返回一个清理函数，swup 换页（astro:before-swap）时统一回收，
 * 避免 SPA 往返后残留 rAF 循环 / 定时器 / 事件监听。
 */

type Cleanup = () => void;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* -------------------------------------------------------------------------- */
/* 指针光效                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 把指针坐标写进 --lp-px / --lp-py，背景的点阵高亮层与柔光层靠它定位。
 *
 * 背景层是 fixed + pointer-events:none，所以监听挂在 window 上。
 * 坐标写入用 rAF 节流，pointermove 的高频触发不会变成高频样式更新。
 */
function startPointerAura(root: HTMLElement): Cleanup {
	const dotsHot = root.querySelector<HTMLElement>("[data-lp-dots-hot]");
	const spot = root.querySelector<HTMLElement>("[data-lp-spot]");
	if (!dotsHot && !spot) return () => {};

	// 触屏没有真正的指针，不启用，免得首屏一直挂着一块亮斑
	if (window.matchMedia("(hover: none)").matches) return () => {};

	let raf = 0;
	let x = 0;
	let y = 0;
	let primed = false;
	let disposed = false;

	const apply = () => {
		raf = 0;
		if (disposed || !root.isConnected) return;
		root.style.setProperty("--lp-px", `${x.toFixed(1)}px`);
		root.style.setProperty("--lp-py", `${y.toFixed(1)}px`);

		// 视差层（极光 / 墨环 / 点阵）用的是归一化偏移：视口中心为 0，
		// 四角为 ±1。各层在 CSS 里自己乘系数，这里只负责把「指针在哪」
		// 翻译成同一套单位，加层时不用再改 JS。
		const nx = (x / window.innerWidth - 0.5) * 2;
		const ny = (y / window.innerHeight - 0.5) * 2;
		root.style.setProperty("--lp-tilt-x", nx.toFixed(3));
		root.style.setProperty("--lp-tilt-y", ny.toFixed(3));

		// 指针第一次移动前两层保持透明，避免左上角先闪一下
		if (!primed) {
			primed = true;
			if (dotsHot) dotsHot.style.opacity = "1";
			if (spot) spot.style.opacity = "1";
		}
	};

	const onMove = (event: PointerEvent) => {
		x = event.clientX;
		y = event.clientY;
		if (!raf) raf = requestAnimationFrame(apply);
	};

	const onLeave = () => {
		if (dotsHot) dotsHot.style.opacity = "0";
		if (spot) spot.style.opacity = "0";
		primed = false;
	};

	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		cancelAnimationFrame(raf);
		window.removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerleave", onLeave);
	};

	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerleave", onLeave);

	return cleanup;
}

/* -------------------------------------------------------------------------- */
/* 打字机副标题                                                                */
/* -------------------------------------------------------------------------- */

function startTypewriter(root: HTMLElement): Cleanup {
	const element = root.querySelector<HTMLElement>("[data-lp-type]");
	if (!element) return () => {};

	let phrases: string[] = [];
	try {
		const raw = element.dataset.phrases ?? "[]";
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			phrases = parsed.filter((item): item is string => typeof item === "string");
		}
	} catch {
		phrases = [];
	}
	if (phrases.length === 0) return () => {};

	const typeSpeed = Number(element.dataset.speed) || 100;
	const deleteSpeed = Number(element.dataset.deleteSpeed) || 50;
	const pause = Number(element.dataset.pause) || 2000;

	let phraseIndex = 0;
	let charIndex = 0;
	let deleting = false;
	let timer = 0;
	let disposed = false;

	const step = () => {
		if (disposed || !element.isConnected) {
			cleanup();
			return;
		}

		const phrase = phrases[phraseIndex];
		if (!deleting) {
			charIndex += 1;
			element.textContent = phrase.slice(0, charIndex);
			if (charIndex >= phrase.length) {
				deleting = true;
				timer = window.setTimeout(step, pause);
				return;
			}
			timer = window.setTimeout(step, typeSpeed);
			return;
		}

		charIndex -= 1;
		element.textContent = phrase.slice(0, charIndex);
		if (charIndex <= 0) {
			deleting = false;
			phraseIndex = (phraseIndex + 1) % phrases.length;
			timer = window.setTimeout(step, typeSpeed * 2.4);
			return;
		}
		timer = window.setTimeout(step, deleteSpeed);
	};

	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		window.clearTimeout(timer);
	};

	timer = window.setTimeout(step, 700);
	return cleanup;
}

/* -------------------------------------------------------------------------- */
/* 实时时钟 + 问候语                                                           */
/* -------------------------------------------------------------------------- */

function startClock(root: HTMLElement): Cleanup {
	const timeEl = root.querySelector<HTMLElement>("[data-lp-clock-time]");
	const dateEl = root.querySelector<HTMLElement>("[data-lp-clock-date]");
	const greetEl = root.querySelector<HTMLElement>("[data-lp-greet]");
	if (!timeEl || !dateEl) return () => {};

	// data-tz 挂在 [data-lp-clock] 这个容器上（见 LandingBento.astro），
	// 不是挂在 #lp-root 上。原先从 root.dataset.tz 读，永远读到 undefined，
	// 于是一直走兜底值 —— 属性是死的。（还留着一个 [data-lp-clock-zone]
	// 的查询，但模板里根本没有这个元素，属于纯死代码，一并去掉。）
	const clock = root.querySelector<HTMLElement>("[data-lp-clock]");
	const timeZone = clock?.dataset.tz || "Asia/Shanghai";

	const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		timeZone,
	});
	const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short",
		timeZone,
	});
	const hourFormatter = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		hour12: false,
		timeZone,
	});

	let timer = 0;
	let disposed = false;
	let lastGreeting = "";

	const greetingFor = (hour: number): string => {
		if (hour < 5) return "夜深了，早点休息";
		if (hour < 9) return "早上好，新的一天开始了";
		if (hour < 12) return "上午好，今天也要加油";
		if (hour < 14) return "中午好，记得吃午饭";
		if (hour < 18) return "下午好，来杯咖啡吧";
		if (hour < 22) return "晚上好，欢迎回来";
		return "夜安，享受属于自己的时间";
	};

	const tick = () => {
		if (disposed || !root.isConnected) {
			cleanup();
			return;
		}

		const now = new Date();
		timeEl.textContent = timeFormatter.format(now);
		dateEl.textContent = dateFormatter.format(now);

		if (greetEl) {
			const hour = Number.parseInt(hourFormatter.format(now), 10);
			const greeting = greetingFor(Number.isFinite(hour) ? hour : 12);
			if (greeting !== lastGreeting) {
				greetEl.textContent = greeting;
				lastGreeting = greeting;
			}
		}

		timer = window.setTimeout(tick, 1000);
	};

	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		window.clearTimeout(timer);
	};

	tick();
	return cleanup;
}

/* -------------------------------------------------------------------------- */
/* 进入按钮：磁吸 + 水波纹 + 回车键                                            */
/* -------------------------------------------------------------------------- */

function startEnterButton(root: HTMLElement): Cleanup {
	const cta = root.querySelector<HTMLElement>("[data-lp-cta]");
	const inner = root.querySelector<HTMLElement>("[data-lp-cta-inner]");
	const button = root.querySelector<HTMLAnchorElement>("[data-lp-enter]");
	if (!cta || !button) return () => {};

	// 水波纹挂在玻璃片上，不是按钮上。两个原因：
	//   1. 只有玻璃片有 overflow:hidden，涟漪才会被裁成菱形
	//      （挂在按钮上的话，点一下会在页面正中炸开一个 447px 的白圆盘）
	//   2. 玻璃片自己 rotate(45deg) 了，坐标得按它的局部系算
	const glass = button.querySelector<HTMLElement>("[data-lp-glass]");

	const canHover = window.matchMedia("(hover: hover)").matches;
	const reduced = prefersReducedMotion();

	const onMove = (event: PointerEvent) => {
		if (!inner || !canHover || reduced) return;
		const rect = cta.getBoundingClientRect();
		const relX = (event.clientX - rect.left) / rect.width - 0.5;
		const relY = (event.clientY - rect.top) / rect.height - 0.5;
		inner.style.translate = `${relX * 16}px ${relY * 12}px`;
	};

	const onLeave = () => {
		if (!inner) return;
		inner.style.translate = "0px 0px";
	};

	const onPointerDown = (event: PointerEvent) => {
		if (reduced || !glass) return;

		// getBoundingClientRect() 给的是旋转后的外接正方形，边长是 offsetWidth 的 √2 倍；
		// 而 left/top 要的是未旋转的局部坐标。所以：
		//   ① 尺寸用 offsetWidth（布局尺寸，不含 transform）
		//   ② 指针相对外接正方形中心的位移，反向旋转 45° 回到局部系
		//   ③ 参照原点用 clientWidth，不是 offsetWidth —— 绝对定位子元素
		//      的包含块是玻璃片的 padding box，而玻璃片有 1px 描边，
		//      用 offsetWidth 会让每个涟漪都往右下偏 1px。
		const rect = glass.getBoundingClientRect();
		const size = glass.offsetWidth * 2.1;
		const half = glass.clientWidth / 2;

		const dx = event.clientX - (rect.left + rect.width / 2);
		const dy = event.clientY - (rect.top + rect.height / 2);
		const k = Math.SQRT1_2; // cos45° = sin45°
		const localX = dx * k + dy * k;
		const localY = -dx * k + dy * k;

		const ripple = document.createElement("span");
		ripple.className = "lp-ripple";
		ripple.style.width = `${size}px`;
		ripple.style.height = `${size}px`;
		ripple.style.left = `${localX + half}px`;
		ripple.style.top = `${localY + half}px`;
		glass.appendChild(ripple);
		window.setTimeout(() => ripple.remove(), 700);
	};

	const onKeydown = (event: KeyboardEvent) => {
		if (event.key !== "Enter" || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
			return;
		}
		event.preventDefault();
		button.click();
	};

	cta.addEventListener("pointermove", onMove, { passive: true });
	cta.addEventListener("pointerleave", onLeave);
	button.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("keydown", onKeydown);

	return () => {
		cta.removeEventListener("pointermove", onMove);
		cta.removeEventListener("pointerleave", onLeave);
		button.removeEventListener("pointerdown", onPointerDown);
		window.removeEventListener("keydown", onKeydown);
	};
}

/* -------------------------------------------------------------------------- */
/* 卡片：跟随指针的柔光                                                        */
/* -------------------------------------------------------------------------- */

function startCardSpotlight(root: HTMLElement): Cleanup {
	const cards = Array.from(
		root.querySelectorAll<HTMLElement>("[data-lp-spotlight]"),
	);

	const handlers = cards.map((card) => {
		const onMove = (event: PointerEvent) => {
			const rect = card.getBoundingClientRect();
			card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
			card.style.setProperty("--my", `${event.clientY - rect.top}px`);
		};
		card.addEventListener("pointermove", onMove, { passive: true });
		return { card, onMove };
	});

	return () => {
		for (const { card, onMove } of handlers) {
			card.removeEventListener("pointermove", onMove);
		}
	};
}

/* -------------------------------------------------------------------------- */
/* 统计数字滚动                                                                */
/* -------------------------------------------------------------------------- */

function startCountUp(root: HTMLElement): Cleanup {
	const targets = Array.from(
		root.querySelectorAll<HTMLElement>("[data-lp-count]"),
	);
	if (targets.length === 0 || prefersReducedMotion()) return () => {};

	// 先落 0，别让人在第一帧看到 HTML 里写死的终值
	for (const target of targets) {
		target.textContent = "0";
	}

	let stopCounts: Cleanup = () => {};
	// 卡片在开屏期间就已经进入视口了，直接挂 observer 会在帘子后面白跑一遍
	const cancelIntro = afterIntro(() => {
		stopCounts = runCounts(targets);
	});

	return () => {
		cancelIntro();
		stopCounts();
	};
}

/** 真正跑数字的那一半。抽出来是为了让它能被 afterIntro 推迟启动。 */
function runCounts(targets: HTMLElement[]): Cleanup {
	const rafIds = new Set<number>();

	const animate = (element: HTMLElement) => {
		const target = Number(element.dataset.lpCount);
		if (!Number.isFinite(target)) return;

		const duration = 1100;
		const start = performance.now();

		const step = (now: number) => {
			if (!element.isConnected) return;
			const progress = Math.min(1, (now - start) / duration);
			// easeOutExpo：数字先快后慢地收尾
			const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
			element.textContent = String(Math.round(target * eased));
			if (progress < 1) rafIds.add(requestAnimationFrame(step));
		};

		rafIds.add(requestAnimationFrame(step));
	};

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				observer.unobserve(entry.target);
				animate(entry.target as HTMLElement);
			}
		},
		{ threshold: 0.4 },
	);

	for (const target of targets) {
		observer.observe(target);
	}

	return () => {
		observer.disconnect();
		for (const id of rafIds) cancelAnimationFrame(id);
		rafIds.clear();
	};
}

/* -------------------------------------------------------------------------- */
/* 开屏动画：跳过与等待                                                        */
/* -------------------------------------------------------------------------- */

/** 开屏收场时在 <html> 上派发，谁需要「等帘子开了再动」就听它。 */
const INTRO_EVENT = "lp:intro-done";

/** 兜底计时器：没人跳过时，由它在自然时间轴跑完后置位 data-lp-intro-done。
 *
 *  下界不是「开屏动画演完」那 5.00s，而是**内容入场动画最后一帧**：
 *  置位会把 --lp-intro-delay 从 4.32s 打回 0s，而改 animation-delay 会让
 *  已经在跑的动画当场跳到新位置（起算点是固定的，官方行为）。
 *  也就是说，凡是「置位那一刻还没播完」的动画，都会被硬拽到终点 —— 一次可见的跳变。
 *  内容里最晚的一条是 .lp-hint（landing.css:874）：
 *      delay 4.32 + 0.50 = 4.82s，时长 0.8s，收在 5.62s。
 *  所以取 5700：留 80ms 余量，置位时全部动画都已经停在终态，
 *  变量翻转变成一次无副作用的空操作。
 *
 *  改小了 —— 入场被当场拽到终点（那一刻谁在跑谁跳，肉眼可见的一顿）；
 *  改大了 —— 兜底比自然时间轴还晚，afterIntro（时钟滚动那组）白等一截才起步。
 *
 *  跳过路径不走这里：点击/按键/滚轮会立刻 finish()，本来就是要让动画跳。 */
const INTRO_MAX_MS = 5700;

/**
 * 开屏是否还在播。
 *
 * data-lp-intro 由 index.astro 的 head 内联脚本写入，且只在
 * 「非 reduced-motion 且浏览器支持 dataset」时才写 ——
 * 所以这个函数为 true，等价于「屏幕上确实有一块遮罩」。
 */
function isIntroPlaying(): boolean {
	const el = document.documentElement;
	return el.dataset.lpIntro === "on" && el.dataset.lpIntroDone !== "on";
}

/**
 * 把 run 推迟到开屏收场之后再执行（没在播就立刻执行）。
 *
 * 用途是数字滚动这类「一次性、有时长」的动画：卡片在开屏期间就已经
 * 落在视口里了，IntersectionObserver 会立刻触发，等帘子掀开时动画早
 * 跑完，用户只看到一个静止的终值。
 */
function afterIntro(run: () => void): Cleanup {
	if (!isIntroPlaying()) {
		run();
		return () => {};
	}

	const el = document.documentElement;
	let done = false;

	const fire = () => {
		if (done) return;
		done = true;
		el.removeEventListener(INTRO_EVENT, fire);
		window.clearTimeout(timer);
		run();
	};

	el.addEventListener(INTRO_EVENT, fire);
	const timer = window.setTimeout(fire, INTRO_MAX_MS);

	return () => {
		if (done) return;
		done = true;
		el.removeEventListener(INTRO_EVENT, fire);
		window.clearTimeout(timer);
	};
}

/**
 * 开屏跳过：滚轮 / 任意按键可以提前收场。
 *
 * **鼠标点击（含触摸）不再跳过**。原来 window 上挂着 pointerdown → finish，
 * 点哪儿都能把开屏掐掉；现在只留滚轮和按键这两条需要「明确意图」的路径。
 *
 * 但光删监听是不够的，还得配合 landing.css 里 .lp-splash 的 pointer-events:auto：
 * 遮罩过去是 pointer-events:none 的纯装饰，点击会直接穿透到帘子底下 ——
 * 而起始页的内容（「进入」按钮、7 张卡片）其实早就渲染好了，只是被盖住。
 * 于是「盲点一下」正好落在某个链接上，当场跳走，动画一样被打断，
 * 而且比原来更莫名其妙（原来至少还看得见帘子在收）。
 * 所以去掉点击跳过的同时必须把指针挡住 —— 两件事是一体的。
 *
 * 这里只做一件事 —— 往 <html> 写 data-lp-intro-done。
 * landing.css 里那条
 *   html[data-lp-intro="on"][data-lp-intro-done] .lp-splash { --lp-exit: 0s; … }
 *   html[data-lp-intro="on"][data-lp-intro-done] .lp       { --lp-intro-delay: 0s; }
 * 会把帘子退场、舞美淡出、内容入场延迟一起归零。
 *
 * 好处是这里不需要知道时间轴跑到了第几秒，也不需要 setTimeout 去和
 * CSS 动画抢状态 —— 改的是变量，动画自己会跳到对应位置。
 * 帘子落下仍由 animation-fill-mode 负责，不用删节点。
 */
function startIntroSkip(): Cleanup {
	if (!isIntroPlaying()) return () => {};

	const el = document.documentElement;
	let fired = false;

	const finish = () => {
		if (fired) return;
		fired = true;
		el.dataset.lpIntroDone = "on";
		el.dispatchEvent(new CustomEvent(INTRO_EVENT));
	};

	const onKey = (event: KeyboardEvent) => {
		// Tab 留给键盘用户看焦点环，不算跳过
		if (event.key === "Tab") return;
		finish();
	};

	const timer = window.setTimeout(finish, INTRO_MAX_MS);

	// 只剩「滚轮」和「按键」两条主动跳过路径。
	// 点击/触摸那条被有意去掉了 —— 见上面的函数注释。
	window.addEventListener("wheel", finish, { passive: true });
	window.addEventListener("keydown", onKey);

	return () => {
		window.removeEventListener("wheel", finish);
		window.removeEventListener("keydown", onKey);
		window.clearTimeout(timer);
	};
}

/* -------------------------------------------------------------------------- */
/* 启动 / 回收                                                                 */
/* -------------------------------------------------------------------------- */

let activeCleanups: Cleanup[] = [];

function teardown(): void {
	for (const cleanup of activeCleanups) {
		try {
			cleanup();
		} catch {
			/* 单个清理失败不应影响其它模块 */
		}
	}
	activeCleanups = [];
}

/** 单个模块初始化失败不应该连累其它模块（也不应该让整页脚本崩掉）。 */
function safeInit(factory: () => Cleanup): void {
	try {
		activeCleanups.push(factory());
	} catch (error) {
		console.warn("[landing] 模块初始化失败，已跳过：", error);
	}
}

export function initLanding(): void {
	const root = document.getElementById("lp-root");
	if (!root || root.dataset.lpBooted === "1") return;
	root.dataset.lpBooted = "1";

	activeCleanups = [];

	// 跳过要排在第一个：它决定后面几个模块能不能立刻开跑
	safeInit(() => startIntroSkip());
	safeInit(() => startPointerAura(root));
	safeInit(() => startTypewriter(root));
	safeInit(() => startClock(root));
	safeInit(() => startEnterButton(root));
	safeInit(() => startCardSpotlight(root));
	safeInit(() => startCountUp(root));
}

initLanding();

// swup 是 SPA 导航：离开时回收，重新进入起始页时再初始化一次。
// （起始页本身被 astro.config.mjs 的 ignore 挡在 swup 之外，所以这两个事件
//   实际只在「从起始页整页跳走」那一下用到 —— 留着是为了别的入口，
//   比如某个内容页里放一个指回 "/" 的链接。）
document.addEventListener("astro:before-swap", teardown);
document.addEventListener("astro:page-load", initLanding);
