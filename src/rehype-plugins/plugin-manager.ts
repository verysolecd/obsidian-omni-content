import { IProcessPlugin } from "src/rehype-plugins/base-process";
import { NMPSettings } from "src/settings";
import { logger } from "src/utils";

/**
 * 插件管理器 - 集中管理所有处理插件
 */
export class PluginManager {
    private static instance: PluginManager;
    private plugins: IProcessPlugin[] = [];

    /**
     * 私有构造函数，确保单例模式
     */
    private constructor() {
        logger.debug("初始化插件管理器");
    }

    /**
     * 获取插件管理器单例
     * @returns 插件管理器实例
     */
    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    /**
     * 注册一个处理插件
     * @param plugin 要注册的插件
     * @returns 当前插件管理器实例，支持链式调用
     */
    public registerPlugin(plugin: IProcessPlugin): PluginManager {
        logger.debug(`注册处理插件: ${plugin.getName()}`);
        this.plugins.push(plugin);
        return this;
    }

    /**
     * 批量注册处理插件
     * @param plugins 要注册的插件数组
     * @returns 当前插件管理器实例，支持链式调用
     */
    public registerPlugins(plugins: IProcessPlugin[]): PluginManager {
        plugins.forEach(plugin => this.registerPlugin(plugin));
        return this;
    }

    /**
     * 移除处理插件
     * @param pluginName 要移除的插件名称
     * @returns 当前插件管理器实例，支持链式调用
     */
    public unregisterPlugin(pluginName: string): PluginManager {
        this.plugins = this.plugins.filter(plugin => plugin.getName() !== pluginName);
        logger.debug(`移除处理插件: ${pluginName}`);
        return this;
    }

    /**
     * 清空所有插件
     * @returns 当前插件管理器实例，支持链式调用
     */
    public clearPlugins(): PluginManager {
        this.plugins = [];
        logger.debug("清空所有处理插件");
        return this;
    }

    /**
     * 获取所有已注册的插件
     * @returns 插件数组
     */
    public getPlugins(): IProcessPlugin[] {
        return [...this.plugins];
    }

    /**
     * 处理HTML内容 - 应用所有启用的插件
     * @param html 原始HTML内容
     * @param settings 插件设置
     * @returns 处理后的HTML内容
     */
    public processContent(html: string, settings: NMPSettings): string {
        logger.debug(`开始处理内容，共有 ${this.plugins.length} 个已注册插件`);

        // 计数器，记录实际应用的插件数量
        let appliedPluginCount = 0;
        
        // 通过插件链依次处理HTML内容
        const result = this.plugins.reduce((processedHtml, plugin) => {
            // 检查插件是否启用
            if (plugin.isEnabled()) {
                logger.debug(`应用插件: ${plugin.getName()}`);
                appliedPluginCount++;
                return plugin.process(processedHtml, settings);
            } else {
                logger.debug(`跳过禁用的插件: ${plugin.getName()}`);
                return processedHtml; // 如果插件禁用，直接返回原内容
            }
        }, html);
        
        logger.debug(`内容处理完成，实际应用了 ${appliedPluginCount} 个插件`);
        return result;
    }
}
