import {NMPSettings} from "src/settings";
import {logger} from "src/utils";
import {App} from "obsidian";

// 为 window 接口扩展，添加 app 属性
declare global {
    interface Window {
        app: App;
    }
}

// 定义插件类型接口
interface ObsidianPlugin {
    saveSettings: () => Promise<void>;
}

// 插件管理器类型
interface PluginManager {
    plugins: {
        [key: string]: ObsidianPlugin;
    };
}

/**
 * 插件配置接口 - 定义插件配置的基本结构
 */
export interface PluginConfig extends Partial<NMPSettings> {
    [key: string]: any;
    // 基础设置
    enabled?: boolean;
}

/**
 * 插件元配置选项接口 - 用于定义选择器控件的选项
 */
export interface PluginMetaConfigOption {
	value: string;
	text: string;
}

/**
 * 单个配置项元配置接口 - 定义控件类型、标题等元数据
 */
export interface PluginMetaConfigItem {
	type: "switch" | "select" | "text" | "number";
	title: string;
	options?: PluginMetaConfigOption[];
}

/**
 * 插件元配置接口 - 定义插件配置的UI交互所需数据结构
 */
export interface PluginMetaConfig {
	[key: string]: PluginMetaConfigItem;
}

/**
 * 微信处理插件接口 - 定义处理HTML内容的插件接口
 */
export interface IProcessPlugin {
	/**
	 * 获取插件名称
	 * @returns 插件名称
	 */
	getName(): string;

	/**
	 * 处理HTML内容
	 * @param html 待处理的HTML内容
	 * @param settings 当前设置
	 * @returns 处理后的HTML内容
	 */
process(html: string, settings: NMPSettings | PluginConfig): string;

	/**
	 * 获取插件配置
	 * @returns 插件的当前配置
	 */
	getConfig(): PluginConfig;

	/**
	 * 更新插件配置
	 * @param config 新的配置对象
	 * @returns 更新后的配置
	 */
	updateConfig(config: PluginConfig): PluginConfig;
	
	/**
	 * 获取插件配置的元数据
	 * 包含控件类型、标题、选项等UI交互相关信息
	 * @returns 插件配置的元数据
	 */
	getMetaConfig(): PluginMetaConfig;
	
	/**
	 * 检查插件是否启用
	 * @returns 插件是否启用
	 */
	isEnabled(): boolean;
	
	/**
	 * 设置插件启用状态
	 * @param enabled 是否启用
	 */
	setEnabled(enabled: boolean): void;
}

/**
 * 基础插件类，提供通用功能
 */
export abstract class BaseProcess implements IProcessPlugin {
	/**
	 * 插件配置数据
	 */
	protected _config: PluginConfig = {
		enabled: true // 默认启用
	};
	
	/**
	 * 插件构造函数
	 */
	constructor(enabled=true) {
		this._config = {enabled}
		// 从设置中加载插件配置
		this.loadConfigFromSettings();
	}
	
	/**
	 * 从用户设置中加载插件配置
	 */
	private loadConfigFromSettings(): void {
		try {
			const settings = NMPSettings.getInstance();
			const pluginName = this.getName();
			
			// 如果设置中有该插件的配置，使用它
			if (settings.pluginsConfig && settings.pluginsConfig[pluginName]) {
				this._config = { ...this._config, ...settings.pluginsConfig[pluginName] };
				logger.debug(`从设置中加载了 ${pluginName} 插件配置:`, this._config);
			}
		} catch (error) {
			logger.error(`加载插件配置失败:`, error);
		}
	}
	
	/**
	 * 保存插件配置到用户设置
	 */
	private saveConfigToSettings(): void {
		try {
			const settings = NMPSettings.getInstance();
			const pluginName = this.getName();
			
			// 初始化存储如果不存在
			if (!settings.pluginsConfig) {
				settings.pluginsConfig = {};
			}
			
			// 更新插件配置
			settings.pluginsConfig[pluginName] = { ...this._config };
			logger.debug(`已保存 ${pluginName} 插件配置到全局设置:`, this._config);
			
			// 触发设置保存
			const app = window.app;
			if (app) {
				try {
					// 使用类型断言安全地访问插件管理器
					const pluginManager = app as unknown as { plugins: PluginManager };
					if (pluginManager.plugins) {
						const plugin = pluginManager.plugins.plugins["omni-content"];
						if (plugin && typeof plugin.saveSettings === "function") {
							plugin.saveSettings();
							logger.debug(`已触发插件的 saveSettings 方法`);
						}
					}
				} catch (e) {
					logger.error(`触发设置保存时出错:`, e);
				}
			}
		} catch (error) {
			logger.error(`保存插件配置失败:`, error);
		}
	}

	/**
	 * 获取主题色
	 */
	protected getThemeColor(settings: NMPSettings): string {
		// 动态获取当前主题颜色
		let themeAccentColor: string;

		// 如果启用了自定义主题色，使用用户设置的颜色
		if (settings.enableThemeColor) {
			themeAccentColor = settings.themeColor || "#7852ee";
			logger.debug("使用自定义主题色：", themeAccentColor);
		} else {
			// 从当前激活的DOM中获取实际使用的主题颜色
			try {
				// 尝试从文档中获取计算后的CSS变量值
				const testElement = document.createElement("div");
				testElement.style.display = "none";
				testElement.className = "note-to-mp";
				document.body.appendChild(testElement);

				// 获取计算后的样式
				const computedStyle = window.getComputedStyle(testElement);
				const primaryColor = computedStyle
					.getPropertyValue("--primary-color")
					.trim();

				logger.debug("获取到的主题色：", primaryColor);
				if (primaryColor) {
					themeAccentColor = primaryColor;
				} else {
					// 如果无法获取，默认使用紫色
					themeAccentColor = "#7852ee";
				}

				// 清理测试元素
				document.body.removeChild(testElement);
			} catch (e) {
				// 如果出错，回退到默认值
				themeAccentColor = "#7852ee";
				logger.error("无法获取主题色变量，使用默认值", e);
			}
		}

		return themeAccentColor;
	}

	/**
	 * 获取插件配置
	 * @returns 插件的当前配置
	 */
	getConfig(): PluginConfig {
		return { ...this._config };
	}

	/**
	 * 更新插件配置
	 * @param config 新的配置对象
	 * @returns 更新后的配置
	 */
	updateConfig(config: PluginConfig): PluginConfig {
		// 合并新的配置到当前配置
		this._config = {
			...this._config,
			...config
		};
		
		logger.debug(`更新了插件配置:`, this._config);
		
		// 将更新后的配置保存到设置中
		this.saveConfigToSettings();
		
		return this._config;
	}
	
	/**
	 * 获取插件配置的元数据
	 * 包含控件类型、标题、选项等UI交互相关信息
	 * @returns 插件配置的元数据
	 */
	getMetaConfig(): PluginMetaConfig {
		// 默认返回空元配置，子类可以重写该方法以提供特定的元配置
		return {};
	}

	/**
	 * 插件名称，子类必须实现
	 */
	abstract getName(): string;

	/**
	 * 处理HTML内容，子类必须实现
	 */
abstract process(html: string, settings: NMPSettings | PluginConfig): string;
	
	/**
	 * 检查插件是否启用
	 * @returns 插件是否启用
	 */
	isEnabled(): boolean {
		// 如果没有设置enabled属性，默认为启用状态
		return this._config.enabled !== false;
	}
	
	/**
	 * 设置插件启用状态
	 * @param enabled 是否启用
	 */
	setEnabled(enabled: boolean): void {
		this._config.enabled = enabled;
		this.saveConfigToSettings();
		logger.debug(`插件 ${this.getName()} 的启用状态已更改为: ${enabled}`);
	}
}
