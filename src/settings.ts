
import {wxKeyInfo} from './weixin-api';
import { logger } from './utils';

export enum LinkFootnoteMode {
	None = 'none',
	All = 'all',
	NonWx = 'non-wx'
}

export enum LinkDescriptionMode {
	Empty = 'empty',
	Raw = 'raw'
}

// 接口定义所有设置项，方便类型检查
interface SettingsData {
	defaultStyle?: string;
	linkStyle?: string;
	linkDescriptionMode?: LinkDescriptionMode;
	embedStyle?: string;
	showStyleUI?: boolean;
	lineNumber?: boolean;
	defaultHighlight?: string;
	authKey?: string;
	wxInfo?: { name: string, appid: string, secret: string }[];
	math?: string;
	useCustomCss?: boolean;
	useTemplate?: boolean;
	defaultTemplate?: string;
	themeColor?: string;
	enableThemeColor?: boolean;
	distributionConfig?: any;
	enableHeadingNumber?: boolean;
	enableHeadingDelimiterBreak?: boolean;
}

export class NMPSettings implements SettingsData {
	// 存储设置属性
	defaultStyle: string = 'obsidian-light';
	defaultHighlight: string = '默认';
	showStyleUI: boolean = true;
	// 控制脚注中链接的展示形式：empty-为空，description-为链接的描述
	linkDescriptionMode: LinkDescriptionMode = LinkDescriptionMode.Empty;
	embedStyle: string = 'quote';
	lineNumber: boolean = true;
	authKey: string = '';
	useCustomCss: boolean = false;
	wxInfo: { name: string, appid: string, secret: string }[] = [];
	math: string = 'latex';
	// 模板相关设置
	useTemplate: boolean = false;
	defaultTemplate: string = 'default';
	// 主题色设置
	themeColor: string = '#7852ee';
	// 是否启用自定义主题色（如果不启用，则使用CSS文件中定义的颜色）
	enableThemeColor: boolean = false;
	// 分发服务相关设置
	distributionConfig: any = null;
	// 二级标题设置
	enableHeadingNumber: boolean = true;
	// 二级标题分隔符换行设置（遇到逗号等符号自动换行）
	enableHeadingDelimiterBreak: boolean = true;
	// 保存UI状态 - 展开的手风琴部分ID数组
	expandedAccordionSections: string[] = [];
	// 上次选择的平台类型，用于刷新后恢复
	lastSelectedPlatform: string = "";
	// 上次选择的模板，用于刷新后恢复模板选择状态
	lastSelectedTemplate: string = "";
	expireat: Date | null = null;

	// 单例实例
	private static instance: NMPSettings;

	// 获取单例实例
	public static getInstance(): NMPSettings {
		if (!NMPSettings.instance) {
			logger.info("创建NMPSettings实例");
			NMPSettings.instance = new NMPSettings();
		}
		logger.info("返回NMPSettings实例");
		return NMPSettings.instance;
	}

	// 私有构造函数 - 所有默认值已通过属性初始化
	private constructor() {}

	// 重置样式和高亮设置
	resetStyelAndHighlight(): void {
		this.defaultStyle = 'obsidian-light';
		this.defaultHighlight = '默认';
	}

	// 加载设置（改为实例方法）
	loadSettings(data: SettingsData): NMPSettings {
		logger.info("加载设置: ", data);
		if (!data) return this;

		// 使用更简洁的方式加载设置
		Object.entries(data).forEach(([key, value]) => {
			// 只更新非undefined的值
			if (value !== undefined && key in this) {
				(this as any)[key] = value;
			}
		});

		this.getExpiredDate();
		logger.info("返回设置: ", this);
		return this;
	}

	// 静态方法用于加载设置（保持向后兼容性）
	public static loadSettings(data: SettingsData): NMPSettings {
		return NMPSettings.getInstance().loadSettings(data);
	}

	// 获取所有设置
	getAllSettings(): Record<string, any> {
		// 创建一个设置对象的浅拷贝，排除内部使用的属性
		const settingsObj: Record<string, any> = {};
		Object.entries(this).forEach(([key, value]) => {
			// 排除某些不需要导出的属性
			if (!['instance', 'expireat', 'expandedAccordionSections', 'lastSelectedPlatform', 'lastSelectedTemplate'].includes(key)) {
				settingsObj[key] = value;
			}
		});
		return settingsObj;
	}

	// 静态方法获取所有设置（保持向后兼容性）
	public static allSettings(): Record<string, any> {
		return NMPSettings.getInstance().getAllSettings();
	}

	// 获取过期日期
	getExpiredDate(): void {
		if (this.authKey.length === 0) return;
		wxKeyInfo(this.authKey).then((res) => {
			if (res.status === 200) {
				this.expireat = new Date(res.json.expireat);
			}
		})
	}

	isAuthKeyVaild() {
		if (this.authKey.length == 0) return false;
		if (this.expireat == null) return false;
		return this.expireat > new Date();
	}
}
