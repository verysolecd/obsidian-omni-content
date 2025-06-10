import {Marked, MarkedExtension} from "marked";
import {App, Vault} from "obsidian";
import {NMPSettings} from "src/settings";
import AssetsManager from "../assets";
import { logger } from "src/utils";

export interface MDRendererCallback {
	settings: NMPSettings;

	updateElementByID(id: string, html: string): void;
}

/**
 * 插件配置接口 - 简化版本，用于Extension系统
 */
export interface ExtensionConfig {
	enabled?: boolean;
	[key: string]: string | number | boolean | null | undefined;
}

/**
 * Extension元配置项接口
 */
export interface ExtensionMetaConfigItem {
	type: "switch" | "select" | "text" | "number";
	title: string;
	options?: { value: string; text: string }[];
}

/**
 * Extension元配置接口
 */
export interface ExtensionMetaConfig {
	[key: string]: ExtensionMetaConfigItem;
}

export abstract class Extension {
	app: App;
	vault: Vault;
	assetsManager: AssetsManager
	settings: NMPSettings;
	callback: MDRendererCallback;
	marked: Marked;
	
	/**
	 * 插件配置数据
	 */
	protected _config: ExtensionConfig = {
		enabled: true // 默认启用
	};

	constructor(app: App, settings: NMPSettings, assetsManager: AssetsManager, callback: MDRendererCallback) {
		this.app = app;
		this.vault = app.vault;
		this.settings = settings;
		this.assetsManager = assetsManager;
		this.callback = callback;
		
		// 从设置中加载插件配置
		this.loadConfigFromSettings();
	}
	
	/**
	 * 获取插件名称 - 子类必须实现
	 */
	abstract getName(): string;
	
	/**
	 * 获取插件配置的元数据 - 子类可以重写
	 */
	getMetaConfig(): ExtensionMetaConfig {
		return {
			enabled: {
				type: "switch",
				title: "启用插件"
			}
		};
	}
	
	/**
	 * 获取插件配置
	 */
	getConfig(): ExtensionConfig {
		return { ...this._config };
	}
	
	/**
	 * 更新插件配置
	 */
	updateConfig(config: ExtensionConfig): ExtensionConfig {
		this._config = { ...this._config, ...config };
		this.saveConfigToSettings();
		return this.getConfig();
	}
	
	/**
	 * 检查插件是否启用
	 */
	isEnabled(): boolean {
		return this._config.enabled !== false;
	}
	
	/**
	 * 设置插件启用状态
	 */
	setEnabled(enabled: boolean): void {
		this._config.enabled = enabled;
		this.saveConfigToSettings();
	}
	
	/**
	 * 从用户设置中加载插件配置
	 */
	private loadConfigFromSettings(): void {
		try {
			const pluginName = this.getName();
			
			// 如果设置中有该插件的配置，使用它
			if (this.settings.pluginsConfig && this.settings.pluginsConfig[pluginName]) {
				this._config = { ...this._config, ...this.settings.pluginsConfig[pluginName] };
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
			const pluginName = this.getName();
			
			// 确保pluginsConfig对象存在
			if (!this.settings.pluginsConfig) {
				this.settings.pluginsConfig = {};
			}
			
			// 保存当前插件配置
			this.settings.pluginsConfig[pluginName] = this.getConfig();
			logger.debug(`保存了 ${pluginName} 插件配置:`, this._config);
		} catch (error) {
			logger.error(`保存插件配置失败:`, error);
		}
	}

	async prepare() {
		return;
	}

	async postprocess(html: string) {
		return html;
	}

	async beforePublish() {
	}

	async cleanup() {
		return;
	}

	abstract markedExtension(): MarkedExtension
}
