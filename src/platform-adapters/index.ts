import {PreviewAdapterFactory} from "src/platform-adapters/adapter-factory";
import {logger} from "../utils";
import {DefaultContentAdapter} from "src/platform-adapters/default-content-adapter";
import {WeChatAdapter} from "./wechat-adapter";
import { PlatformType } from "./types";

/**
 * 初始化并注册所有内容适配器
 */
export function initializeContentAdapters(): void {
	logger.info("正在初始化内容适配器...");

	// 注册预览适配器（默认适配器）
	PreviewAdapterFactory.registerAdapter(PlatformType.DEFAULT, new DefaultContentAdapter());

	// 注册微信公众号适配器
	PreviewAdapterFactory.registerAdapter(PlatformType.WECHAT, new WeChatAdapter());

	// 可以在这里注册更多平台的适配器

	logger.info("内容适配器初始化完成");
}

// 导出所有适配器和工厂
export {type IContentAdapter} from "src/platform-adapters/base-content-adapter";
export {type IPlatformAdapter} from "src/platform-adapters/base-platform-adapter";
export {DefaultContentAdapter} from "src/platform-adapters/default-content-adapter";
export {WeChatAdapter} from "./wechat-adapter";
export {PreviewAdapterFactory} from "src/platform-adapters/adapter-factory";
