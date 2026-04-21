// 设备数据配置文件

export interface Device {
	name: string;
	image: string;
	specs: string;
	description: string;
	link: string;
}

// 设备类别类型，支持品牌和自定义类别
export type DeviceCategory = Record<string, Device[]> & {
	自定义?: Device[];
};

export const devicesData: DeviceCategory = {
	PC: [
		{
			name: "Windows 11",
			image: "/images/device/oneplus13t.webp",
			specs: "25H2",
			description:
				"AMD Ryzen 7 9800X3D, 32GB RAM, NVIDIA GeForce RTX 5080 OC",
			link: "https://www.microsoft.com/",
		},
	],
	Router: [
		{
			name: "GL-MT3000",
			image: "/images/device/mt3000.webp",
			specs: "1000Mbps / 2.5G",
			description:
				"Portable WiFi 6 router suitable for business trips and home use.",
			link: "https://www.gl-inet.cn/products/gl-mt3000/",
		},
	],
};
