
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

export class NMPSettings {
	defaultStyle: string;
	defaultHighlight: string;
	showStyleUI: boolean;
	// 控制脚注中链接的展示形式：empty-为空，description-为链接的描述
	linkDescriptionMode: LinkDescriptionMode;
	embedStyle: string;
	lineNumber: boolean;
	authKey: string;
	useCustomCss: boolean;
	wxInfo: { name: string, appid: string, secret: string }[];
	math: string;
	// 模板相关设置
	useTemplate: boolean;
	defaultTemplate: string;
	// 主题色设置
	themeColor: string;
	// 是否启用自定义主题色（如果不启用，则使用CSS文件中定义的颜色）
	enableThemeColor: boolean;
	// 分发服务相关设置
	distributionConfig: any;
	// 二级标题设置
	enableHeadingNumber: boolean;
	// 二级标题分隔符换行设置（遇到逗号等符号自动换行）
	enableHeadingDelimiterBreak: boolean;
	// 保存UI状态 - 展开的手风琴部分ID数组
	expandedAccordionSections: string[] = [];
	// 上次选择的平台类型，用于刷新后恢复
	lastSelectedPlatform: string = "";
	// 上次选择的模板，用于刷新后恢复模板选择状态
	lastSelectedTemplate: string = "";
	expireat: Date | null = null;

	private static instance: NMPSettings;

	// 静态方法，用于获取实例
	public static getInstance(): NMPSettings {
		if (!NMPSettings.instance) {
			logger.info("创建NMPSettings实例");
			NMPSettings.instance = new NMPSettings();
		}
		logger.info("返回NMPSettings实例");
		return NMPSettings.instance;
	}

	private constructor() {
		this.defaultStyle = 'obsidian-light';
		this.defaultHighlight = '默认';
		this.showStyleUI = true;
		this.linkDescriptionMode = LinkDescriptionMode.Empty; // 默认脚注中不显示描述
		this.embedStyle = 'quote';
		this.lineNumber = true;
		this.useCustomCss = false;
		this.authKey = '';
		this.wxInfo = [];
		this.math = 'latex';
		this.useTemplate = false; // 默认不使用模板
		this.defaultTemplate = 'default'; // 默认模板名称
		this.themeColor = '#7852ee'; // 默认主题色为紫色
		this.enableThemeColor = false; // 默认不启用自定义主题色，使用CSS中的颜色
		this.enableHeadingNumber = true; // 默认启用二级标题序号
		this.enableHeadingDelimiterBreak = true; // 默认启用分隔符自动换行
		this.distributionConfig = null; // 分发服务配置
	}

	resetStyelAndHighlight() {
		this.defaultStyle = 'obsidian-light';
		this.defaultHighlight = '默认';
	}

	public static loadSettings(data: any) {
		logger.info("加载设置: ", data);
		if (!data) {
			return
		}
		const {
			defaultStyle,
			linkStyle,
			linkDescriptionMode,
			embedStyle,
			showStyleUI,
			lineNumber,
			defaultHighlight,
			authKey,
			wxInfo,
			math,
			useCustomCss,
			useTemplate,
			defaultTemplate,
			themeColor,
			enableThemeColor,
			distributionConfig,
			enableHeadingNumber,
			enableHeadingDelimiterBreak,
		} = data;

		const settings = NMPSettings.getInstance();
		if (defaultStyle) {
			settings.defaultStyle = defaultStyle;
		}
		if (defaultHighlight) {
			settings.defaultHighlight = defaultHighlight;
		}
		if (showStyleUI !== undefined) {
			settings.showStyleUI = showStyleUI;
		}
		if (linkDescriptionMode) {
			settings.linkDescriptionMode = linkDescriptionMode;
		}
		if (embedStyle) {
			settings.embedStyle = embedStyle;
		}
		if (lineNumber !== undefined) {
			settings.lineNumber = lineNumber;
		}
		if (authKey) {
			settings.authKey = authKey;
		}
		if (wxInfo) {
			settings.wxInfo = wxInfo;
		}
		if (math) {
			settings.math = math;
		}
		if (useCustomCss !== undefined) {
			settings.useCustomCss = useCustomCss;
		}
		if (useTemplate !== undefined) {
			settings.useTemplate = useTemplate;
		}
		if (defaultTemplate) {
			settings.defaultTemplate = defaultTemplate;
		}
		if (themeColor) {
			settings.themeColor = themeColor;
		}
		if (enableThemeColor !== undefined) {
			settings.enableThemeColor = enableThemeColor;
		}
		if (distributionConfig) {
			settings.distributionConfig = distributionConfig;
		}
		if (enableHeadingNumber !== undefined) {
			settings.enableHeadingNumber = enableHeadingNumber;
		}
		if (enableHeadingDelimiterBreak !== undefined) {
			settings.enableHeadingDelimiterBreak = enableHeadingDelimiterBreak;
		}
		settings.getExpiredDate();

		logger.info("返回设置: ", settings);
		return settings;
	}

	public static allSettings() {
		const settings = NMPSettings.getInstance();
		return {
			'defaultStyle': settings.defaultStyle,
			'defaultHighlight': settings.defaultHighlight,
			'showStyleUI': settings.showStyleUI,
			'linkDescriptionMode': settings.linkDescriptionMode,
			'embedStyle': settings.embedStyle,
			'lineNumber': settings.lineNumber,
			'authKey': settings.authKey,
			'wxInfo': settings.wxInfo,
			'math': settings.math,
			'useCustomCss': settings.useCustomCss,
			'useTemplate': settings.useTemplate,
			'defaultTemplate': settings.defaultTemplate,
			'distributionConfig': settings.distributionConfig,
			'themeColor': settings.themeColor,
			'enableThemeColor': settings.enableThemeColor,
			'enableHeadingNumber': settings.enableHeadingNumber,
		}


	}

	getExpiredDate() {
		if (this.authKey.length == 0) return;
		wxKeyInfo(this.authKey).then((res) => {
			if (res.status == 200) {
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
