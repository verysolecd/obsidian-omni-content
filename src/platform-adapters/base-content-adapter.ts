import {IProcessPlugin} from "src/plugins/base-process-plugin";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 内容适配器接口 - 负责将HTML内容适配到不同平台的格式要求
 */
export interface IContentAdapter {
	/**
	 * 适配内容方法
	 * @param html 原始HTML内容
	 * @param settings 插件设置
	 * @returns 适配后的HTML内容
	 */
	adaptContent(html: string, settings: NMPSettings): string;
}

/**
 * 基础内容适配器抽象类 - 提供对HTML内容的处理能力
 */
export abstract class BaseContentAdapter implements IContentAdapter {
	// 插件列表
	protected plugins: IProcessPlugin[] = [];

	// 保存设置实例以在其他方法中使用
	protected currentSettings: NMPSettings;

	constructor() {
		// 初始化时获取设置单例
		this.currentSettings = NMPSettings.getInstance();
	}

	/**
	 * 适配内容 - 模板方法
	 * @param html 原始HTML内容
	 * @param settings 插件设置
	 * @returns 适配后的HTML内容
	 */
	adaptContent(html: string, settings: NMPSettings): string {
		logger.debug(`应用${this.getAdapterName()}适配器处理HTML`);

		// 更新当前设置
		this.currentSettings = settings;

		// 调用子类实现的处理方法
		let processedHtml = this.preprocess(html);
		processedHtml = this.process(processedHtml);
		processedHtml = this.postprocess(processedHtml);

		logger.debug(`${this.getAdapterName()}适配处理完成`);
		return processedHtml;
	}

	/**
	 * 添加处理插件
	 * @param plugin 要添加的插件
	 * @returns 当前适配器实例，支持链式调用
	 */
	public addPlugin(plugin: IProcessPlugin): BaseContentAdapter {
		logger.debug(`添加处理插件: ${plugin.getName()}`);
		this.plugins.push(plugin);
		return this;
	}

	/**
	 * 批量添加处理插件
	 * @param plugins 要添加的插件数组
	 * @returns 当前适配器实例，支持链式调用
	 */
	public addPlugins(plugins: IProcessPlugin[]): BaseContentAdapter {
		plugins.forEach(plugin => this.addPlugin(plugin));
		return this;
	}

	/**
	 * 移除处理插件
	 * @param pluginName 要移除的插件名称
	 * @returns 当前适配器实例，支持链式调用
	 */
	public removePlugin(pluginName: string): BaseContentAdapter {
		this.plugins = this.plugins.filter(plugin => plugin.getName() !== pluginName);
		logger.debug(`移除处理插件: ${pluginName}`);
		return this;
	}

	/**
	 * 清空所有插件
	 * @returns 当前适配器实例，支持链式调用
	 */
	public clearPlugins(): BaseContentAdapter {
		this.plugins = [];
		logger.debug("清空所有处理插件");
		return this;
	}

	/**
	 * 获取适配器名称 - 子类必须实现
	 */
	protected abstract getAdapterName(): string;

	/**
	 * 预处理HTML - 子类可以覆盖
	 */
	protected preprocess(html: string): string {
		return html;
	}

	/**
	 * 处理HTML - 默认实现为应用所有插件
	 */
	protected process(html: string): string {
		logger.debug(`开始处理内容，使用 ${this.plugins.length} 个插件`);

		// 通过插件链依次处理HTML内容
		return this.plugins.reduce((processedHtml, plugin) => {
			logger.debug(`应用插件: ${plugin.getName()}`);
			return plugin.process(processedHtml, this.currentSettings);
		}, html);
	}

	/**
	 * 后处理HTML - 子类可以覆盖
	 */
	protected postprocess(html: string): string {
		return html;
	}
}
