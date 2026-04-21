import type { Song } from "./types";

export const STORAGE_KEY_VOLUME = "music-player-volume";

export const DEFAULT_VOLUME = 0.7;

export const LOCAL_PLAYLIST: Song[] = [
	{
		id: 1,
		title: "浮遊大陸アルジェス -Introduction-",
		artist: "Falcom Sound Team J.D.K.",
		cover: "assets/music/cover/1.webp",
		url: "assets/music/url/1.mp3",
		duration: 0,
	},
	{
		id: 2,
		title: "Musa",
		artist: "Active Planets",
		cover: "assets/music/cover/2.webp",
		url: "assets/music/url/2.mp3",
		duration: 240,
	},
	{
		id: 3,
		title: "雾 缀じた街 ふたつのかげ",
		artist: "Porkkana",
		cover: "assets/music/cover/3.webp",
		url: "assets/music/url/3.mp3",
		duration: 180,
	},
];

export const DEFAULT_SONG: Song = {
	title: "Sample Song",
	artist: "Sample Artist",
	cover: "/favicon/favicon.ico",
	url: "",
	duration: 0,
	id: 0,
};

export const DEFAULT_METING_API =
	"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
export const DEFAULT_METING_ID = "14164869977";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export const ERROR_DISPLAY_DURATION = 3000;
export const SKIP_ERROR_DELAY = 1000;
