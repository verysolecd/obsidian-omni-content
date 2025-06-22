import { BaseProcess, IProcessPlugin, PluginConfig } from "./base-process";
import { logger } from "../utils";

export class PluginManager {
    private static instance: PluginManager;
    private plugins: IProcessPlugin[] = [];
    private pluginKeys: Map<string, string> = new Map();

    private constructor() { }

    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    public registerPlugins(plugins: IProcessPlugin[]): void {
        plugins.forEach(plugin => this.registerPlugin(plugin));
    }

public registerPlugin(plugin: IProcessPlugin): void {
        // 为每个插件生成唯一序号
        const pluginName = plugin.getName();
        const pluginCount = [...this.pluginKeys.values()]
            .filter(key => key.startsWith(pluginName))
            .length;
            
        // 使用计数器确保唯一性，而不是时间戳
        const uniqueKey = `${pluginName}-${pluginCount + 1}`;
        
        this.pluginKeys.set(pluginName, uniqueKey);
        this.plugins.push(plugin);
        logger.debug(`注册插件 ${uniqueKey}`);
    }

    public getPlugins(): IProcessPlugin[] {
        return this.plugins;
    }

    public getPluginKey(name: string): string {
        return this.pluginKeys.get(name) || name;
    }

    public processContent(content: string, config: PluginConfig): string {
        let result = content;
        for (const plugin of this.plugins) {
            try {
                result = plugin.process(result, config);
            } catch (error) {
                logger.error(`插件 ${plugin.getName()} 处理内容时出错:`, error);
            }
        }
        return result;
    }
}
