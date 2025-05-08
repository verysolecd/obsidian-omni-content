import { logger } from "../utils";
import { CodeBlocksPlugin } from "./code-blocks-plugin";
import { HeadingsPlugin } from "./headings-plugin";
import { ImagesPlugin } from "./images-plugin";
import { ListsPlugin } from "./lists-plugin";
import { PluginManager } from "./plugin-manager";
import { StylesPlugin } from "./styles-plugin";
import { TablesPlugin } from "./tables-plugin";
import { WechatLinkPlugin } from "./wechat-link-plugin";
// 如需使用 BlockquotesPlugin，请取消下面的注释，并在 initializePlugins 中添加它
// import { BlockquotesPlugin } from "./blockquotes-plugin";

/**
 * 初始化并注册所有处理插件
 */
export function initializePlugins(): void {
    logger.info("正在初始化内容处理插件...");

    const pluginManager = PluginManager.getInstance();
    
    // 注册所有可用的插件
    pluginManager.registerPlugins([
        new ImagesPlugin(),
        new WechatLinkPlugin(),
        new HeadingsPlugin(),
        new ListsPlugin(),
        new CodeBlocksPlugin(),
        new TablesPlugin(),
        new StylesPlugin(),
        // 如需启用 BlockquotesPlugin，请取消注释添加
        // new BlockquotesPlugin(),
    ]);

    logger.info(`插件初始化完成，共注册了 ${pluginManager.getPlugins().length} 个插件`);
}

// 导出插件管理器和所有插件类型
export { PluginManager } from "./plugin-manager";
export { BaseProcessPlugin } from "./base-process-plugin";
export type { IProcessPlugin, PluginConfig, PluginMetaConfig } from "./base-process-plugin";

