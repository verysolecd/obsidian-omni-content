

import { NMPSettings } from "../settings";
import { logger } from "../utils";

/**
 * 内容适配器接口 - 负责将HTML内容适配到不同平台的格式要求
 */
export interface ContentAdapter {
  /**
   * 适配内容方法
   * @param html 原始HTML内容
   * @param settings 插件设置
   * @returns 适配后的HTML内容
   */
  adaptContent(html: string, settings: NMPSettings): string;
}

/**
 * 适配器工厂 - 负责创建适合不同平台的适配器实例
 */
export class ContentAdapterFactory {
  private static adapters: Map<string, ContentAdapter> = new Map();

  /**
   * 注册一个适配器
   * @param platform 平台名称
   * @param adapter 适配器实例
   */
  static registerAdapter(platform: string, adapter: ContentAdapter): void {
    logger.info(`注册平台适配器: ${platform}`);
    this.adapters.set(platform.toLowerCase(), adapter);
  }

  /**
   * 获取适合指定平台的适配器
   * @param platform 平台名称
   * @returns 对应的适配器实例，如果未找到则返回预览适配器
   */
  static getAdapter(platform: string): ContentAdapter {
    platform = platform.toLowerCase();
    const adapter = this.adapters.get(platform);
    
    if (adapter) {
      logger.debug(`使用 ${platform} 平台适配器`);
      return adapter;
    }
    
    logger.warn(`未找到 ${platform} 平台的适配器，使用默认预览适配器`);
    return this.adapters.get('preview') || this.adapters.values().next().value;
  }
  
  /**
   * 获取所有已注册的适配器
   * @returns 适配器Map
   */
  static getRegisteredAdapters(): Map<string, ContentAdapter> {
    return new Map(this.adapters);
  }
}
