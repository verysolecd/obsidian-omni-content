import {logger} from "../utils";
import {ContentAdapterFactory} from "./content-adapter";
import {PreviewAdapter} from "./preview-adapter";
import {WeChatAdapter} from "./wechat-adapter";
import {ZhihuAdapter} from "./zhihu-adapter";

/**
 * 初始化并注册所有内容适配器
 */
export function initializeContentAdapters(): void {
	logger.info("正在初始化内容适配器...");

	// 注册预览适配器（默认适配器）
	ContentAdapterFactory.registerAdapter('preview', new PreviewAdapter());

	// 注册微信公众号适配器
	ContentAdapterFactory.registerAdapter('wechat', new WeChatAdapter());

	// 注册知乎适配器
	ContentAdapterFactory.registerAdapter('zhihu', new ZhihuAdapter());

	// 可以在这里注册更多平台的适配器

	logger.info("内容适配器初始化完成");
}

// 导出所有适配器和工厂
export {type ContentAdapter, ContentAdapterFactory} from "./content-adapter";
export {PreviewAdapter} from "./preview-adapter";
export {WeChatAdapter} from "./wechat-adapter";
export {ZhihuAdapter} from "./zhihu-adapter";
