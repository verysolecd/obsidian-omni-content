import {IContentAdapter} from "src/platform-adapters/base-content-adapter";
import {logger} from "src/utils";

/**
 * 适配器工厂 - 负责创建适合不同平台的适配器实例
 */
export class PreviewAdapterFactory {
	private static adapters: Map<string, IContentAdapter> = new Map();

	/**
	 * 注册一个适配器
	 * @param platform 平台名称
	 * @param adapter 适配器实例
	 */
	static registerAdapter(platform: string, adapter: IContentAdapter): void {
		logger.info(`注册平台适配器: ${platform}`);
		this.adapters.set(platform.toLowerCase(), adapter);
	}

	/**
	 * 获取适合指定平台的适配器
	 * @param platform 平台名称
	 * @returns 对应的适配器实例，如果未找到则返回预览适配器
	 */
	static getAdapter(platform: string): IContentAdapter {
		platform = platform.toLowerCase();
		const adapter = this.adapters.get(platform);

		if (adapter) {
			logger.debug(`使用 ${platform} 平台适配器`);
			return adapter;
		}

		logger.warn(`未找到 ${platform} 平台的适配器，使用默认预览适配器`);
		return (
			this.adapters.get("preview") || this.adapters.values().next().value
		);
	}

	/**
	 * 获取所有已注册的适配器
	 * @returns 适配器Map
	 */
	static getRegisteredAdapters(): Map<string, IContentAdapter> {
		return new Map(this.adapters);
	}
}
