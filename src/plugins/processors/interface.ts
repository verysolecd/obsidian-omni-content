import {NMPSettings} from "src/settings";

/**
 * 微信处理插件接口 - 定义处理HTML内容的插件接口
 */
export interface IProcessPlugin {
	/**
	 * 处理HTML内容
	 * @param html 待处理的HTML内容
	 * @param settings 当前设置
	 * @returns 处理后的HTML内容
	 */
	process(html: string, settings: NMPSettings): string;

	/**
	 * 获取插件名称
	 * @returns 插件名称
	 */
	getName(): string;
}
