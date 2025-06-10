import { Extension, ExtensionConfig, ExtensionMetaConfig } from "./extension";
import { MarkedParser } from "./parser";
import { logger } from "src/utils";

/**
 * Extension管理器 - 为remark扩展系统提供类似rehype插件管理器的功能
 */
export class ExtensionManager {
    private static instance: ExtensionManager;
    private parser: MarkedParser | null = null;

    /**
     * 私有构造函数，确保单例模式
     */
    private constructor() {
        logger.debug("初始化Extension管理器");
    }

    /**
     * 获取管理器单例
     * @returns Extension管理器实例
     */
    public static getInstance(): ExtensionManager {
        if (!ExtensionManager.instance) {
            ExtensionManager.instance = new ExtensionManager();
        }
        return ExtensionManager.instance;
    }

    /**
     * 设置MarkedParser实例
     * @param parser MarkedParser实例
     */
    public setParser(parser: MarkedParser): void {
        this.parser = parser;
        logger.debug("设置MarkedParser实例到Extension管理器");
    }

    /**
     * 获取所有已注册的扩展插件
     * @returns 扩展插件数组
     */
    public getExtensions(): Extension[] {
        if (!this.parser) {
            logger.warn("MarkedParser实例未设置");
            return [];
        }
        return this.parser.getExtensions();
    }

    /**
     * 获取所有启用的扩展插件
     * @returns 启用的扩展插件数组
     */
    public getEnabledExtensions(): Extension[] {
        if (!this.parser) {
            logger.warn("MarkedParser实例未设置");
            return [];
        }
        return this.parser.getEnabledExtensions();
    }

    /**
     * 根据名称获取扩展插件
     * @param name 插件名称
     * @returns 扩展插件实例或null
     */
    public getExtensionByName(name: string): Extension | null {
        if (!this.parser) {
            logger.warn("MarkedParser实例未设置");
            return null;
        }
        return this.parser.getExtensionByName(name);
    }

    /**
     * 设置扩展插件启用状态
     * @param name 插件名称
     * @param enabled 是否启用
     * @returns 是否成功设置
     */
    public setExtensionEnabled(name: string, enabled: boolean): boolean {
        if (!this.parser) {
            logger.warn("MarkedParser实例未设置");
            return false;
        }
        return this.parser.setExtensionEnabled(name, enabled);
    }

    /**
     * 获取插件配置
     * @param name 插件名称
     * @returns 插件配置或null
     */
    public getExtensionConfig(name: string): ExtensionConfig | null {
        const extension = this.getExtensionByName(name);
        if (extension) {
            return extension.getConfig();
        }
        return null;
    }

    /**
     * 更新插件配置
     * @param name 插件名称
     * @param config 新的配置对象
     * @returns 更新后的配置或null
     */
    public updateExtensionConfig(name: string, config: ExtensionConfig): ExtensionConfig | null {
        const extension = this.getExtensionByName(name);
        if (extension) {
            return extension.updateConfig(config);
        }
        logger.warn(`未找到扩展插件: ${name}`);
        return null;
    }

    /**
     * 获取插件配置的元数据
     * @param name 插件名称
     * @returns 插件配置的元数据或null
     */
    public getExtensionMetaConfig(name: string): ExtensionMetaConfig | null {
        const extension = this.getExtensionByName(name);
        if (extension) {
            return extension.getMetaConfig();
        }
        return null;
    }

    /**
     * 获取插件状态摘要 - 用于前端UI显示
     * @returns 插件状态摘要
     */
    public getExtensionsSummary(): {
        name: string;
        enabled: boolean;
        config: ExtensionConfig;
        metaConfig: ExtensionMetaConfig;
    }[] {
        const extensions = this.getExtensions();
        return extensions.map(ext => ({
            name: ext.getName(),
            enabled: ext.isEnabled(),
            config: ext.getConfig(),
            metaConfig: ext.getMetaConfig()
        }));
    }

    /**
     * 批量更新插件启用状态
     * @param updates 插件状态更新对象 {pluginName: enabled}
     * @returns 更新结果摘要
     */
    public batchUpdateExtensionsEnabled(updates: Record<string, boolean>): {
        success: string[];
        failed: string[];
    } {
        const success: string[] = [];
        const failed: string[] = [];

        Object.entries(updates).forEach(([name, enabled]) => {
            if (this.setExtensionEnabled(name, enabled)) {
                success.push(name);
            } else {
                failed.push(name);
            }
        });

        logger.debug(`批量更新插件状态 - 成功: ${success.length}, 失败: ${failed.length}`);
        return { success, failed };
    }
}
