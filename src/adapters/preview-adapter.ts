import { CardDataManager } from "../markdown/code";
import { applyCSS, logger } from "../utils";
import { BaseAdapter } from "./content-adapter";
import colors from "colors";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class PreviewAdapter extends BaseAdapter {
  protected getAdapterName(): string {
    return "预览";
  }

  protected process(html: string): string {
    // 预览模式下的默认处理，主要是恢复代码卡片并处理标题
    let processedHtml = CardDataManager.getInstance().restoreCard(html);
    processedHtml = this.processHeadings(processedHtml);
    
    return processedHtml;
  }
  
  /**
   * 重写基类的 applyStyles 方法，预览模式使用 applyCSS 工具函数
   * @param html HTML内容
   * @param css CSS样式字符串
   * @returns 应用样式后的HTML内容
   */
  public applyStyles(html: string, css: string): string {
    try {
      // 创建临时DOM元素
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);
      
      // 使用 applyCSS 工具函数应用样式
      applyCSS(tempDiv, css);
      
      // 获取处理后的HTML并清理临时元素
      const result = tempDiv.innerHTML;
      document.body.removeChild(tempDiv);
      
      logger.info(colors.blue("已应用预览样式"));
      return result;
    } catch (error) {
      logger.error("应用预览样式时出错:", error);
      return html;
    }
  }
}