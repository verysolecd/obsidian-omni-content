import {wxKeyInfo} from './weixin-api';
import { logger } from './utils';
import { PlatformType } from 'src/types';

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
	// ===== 样式和UI基础设置 =====
	/** 默认样式 */
	defaultStyle?: string;
	/** 默认高亮样式 */
	defaultHighlight?: string;
	/** 是否显示样式UI */
	showStyleUI?: boolean;
	/** 是否使用自定义CSS */
	useCustomCss?: boolean;
	/** 是否显示行号 */
	lineNumber?: boolean;
	/** 是否启用微信代码格式化 */
	enableWeixinCodeFormat?: boolean;

	// ===== 链接相关设置 =====
	/** 链接样式 */
	linkStyle?: string;
	/** 链接描述模式 */
	linkDescriptionMode?: LinkDescriptionMode;
	/** 嵌入样式 */
	embedStyle?: string;

	// ===== 数学公式相关 =====
	/** 数学公式渲染方式 */
	math?: string;

	// ===== 模板相关设置 =====
	/** 是否使用模板 */
	useTemplate?: boolean;
	/** 默认模板 */
	defaultTemplate?: string;

	// ===== 主题相关设置 =====
	/** 主题颜色 */
	themeColor?: string;
	/** 是否启用自定义主题色 */
	enableThemeColor?: boolean;

	// ===== 标题设置 =====
	/** 是否启用标题编号 */
	enableHeadingNumber?: boolean;
	/** 是否启用标题分隔符自动换行 */
	enableHeadingDelimiterBreak?: boolean;

	// ===== 认证和外部服务 =====
	/** 认证密钥 */
	authKey?: string;
	/** 微信公众号名称 */
	wxName?: string;
	/** 微信公众号 appid */
	wxAppId?: string;
	/** 微信公众号 secret */
	wxSecret?: string;
	/** 分发服务配置 */
	distributionConfig?: DistributionConfig | null;
	
	// ===== 插件配置 =====
	/** 插件配置存储 */
	pluginsConfig?: Record<string, Record<string, any>>;
}

// 定义分发服务配置类型
interface DistributionConfig {
	[platform: string]: {
		enabled?: boolean;
		[key: string]: unknown;
	};
}

export class NMPSettings implements SettingsData {
  // interface SettingsData
	defaultStyle: string = 'obsidian-light';
	defaultHighlight: string = '默认';
	showStyleUI: boolean = true;
	linkDescriptionMode: LinkDescriptionMode = LinkDescriptionMode.Empty;
	embedStyle: string = 'quote';
	lineNumber: boolean = true;
	enableWeixinCodeFormat: boolean = false;
	authKey: string = '';
	useCustomCss: boolean = false;
	wxName: string = '';
	wxAppId: string = '';
	wxSecret: string = '';
	math: string = 'latex';
	useTemplate: boolean = false;
	defaultTemplate: string = 'default';
	themeColor: string = '#7852ee';
	enableThemeColor: boolean = false;
	distributionConfig: DistributionConfig | null = null;
	enableHeadingNumber: boolean = true;
	enableHeadingDelimiterBreak: boolean = true;
	expandedAccordionSections: string[] = [];
	lastSelectedPlatform: string = "";
	lastSelectedTemplate: string = "";
	expireat: Date | null = null;
	pluginsConfig: Record<string, Record<string, any>> = {};
	wxinfo: string = '';

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
				(this as Record<string, unknown>)[key] = value;
			}
		});

		logger.info("返回设置: ", this);
		return this;
	}

	// 静态方法用于加载设置（保持向后兼容性）
	public static loadSettings(data: SettingsData): NMPSettings {
		return NMPSettings.getInstance().loadSettings(data);
	}

	// 获取所有设置
	getAllSettings(): Record<string, unknown> {
		// 创建一个设置对象的浅拷贝，排除内部使用的属性
		const settingsObj: Record<string, unknown> = {};
		Object.entries(this).forEach(([key, value]) => {
			// 排除某些不需要导出的属性
			if (!['instance', 'expireat'].includes(key)) {
				settingsObj[key] = value;
			}
		});
		return settingsObj;
	}

	// 静态方法获取所有设置（保持向后兼容性）
	public static allSettings(): Record<string, unknown> {
		return NMPSettings.getInstance().getAllSettings();
	}

}