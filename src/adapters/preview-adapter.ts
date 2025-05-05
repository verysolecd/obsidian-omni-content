

import { CardDataManager } from "../markdown/code";
import { NMPSettings } from "../settings";
import { logger } from "../utils";
import { ContentAdapter } from "./content-adapter";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class PreviewAdapter implements ContentAdapter {
  /**
   * 适配预览内容
   * @param html 原始HTML内容
   * @param settings 插件设置
   * @returns 适配后的HTML内容
   */
  adaptContent(html: string, _settings: NMPSettings): string {
    logger.debug("应用预览适配器处理HTML");
    
    // 预览模式下的默认处理，主要是恢复代码卡片
    const processedHtml = CardDataManager.getInstance().restoreCard(html);
    
    return processedHtml;
  }
}
