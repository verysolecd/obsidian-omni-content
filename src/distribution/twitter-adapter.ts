

import { requestUrl } from "obsidian";
import { ArticleContent, DistributionResult, PlatformAdapter, PlatformAuth, PlatformType } from "./types";
import { logger } from "../utils";

/**
 * 推特平台适配器
 */
export class TwitterAdapter implements PlatformAdapter {
  type = PlatformType.TWITTER;
  name = "推特";
  icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
  </svg>`;

  /**
   * 检查推特认证信息是否有效
   */
  isAuthValid(auth: PlatformAuth): boolean {
    return (
      auth.type === PlatformType.TWITTER &&
      !!auth.token &&
      !!auth.appId &&
      !!auth.appSecret
    );
  }

  /**
   * 发布文章到推特
   */
  async publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
    try {
      logger.info("正在发布文章到推特");
      
      // 推特API实现
      // 格式化内容，推特有字数限制
      const formattedContent = this.formatContent(content);
      
      // 模拟API调用
      const response = await this.simulateApiCall(formattedContent, auth);
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已发布到推特",
        url: `https://twitter.com/user/status/${response.id}`,
        data: response
      };
    } catch (error) {
      logger.error("发布推特失败:", error);
      return {
        success: false,
        platformType: this.type,
        message: `发布失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 格式化文章以适应推特平台
   */
  formatContent(content: ArticleContent): ArticleContent {
    // 推特有280字符限制，需要进行内容精简
    const formatted = { ...content };
    
    // 提取纯文本内容
    const textContent = formatted.content.replace(/<[^>]*>/g, '');
    
    // 构建推文内容：标题 + 简短描述 + 标签
    let tweetText = formatted.title;
    
    // 添加简短描述
    if (textContent.length > 0) {
      const description = textContent.substring(0, 180);
      tweetText += "\n\n" + description + (textContent.length > 180 ? "..." : "");
    }
    
    // 添加标签
    if (formatted.tags && formatted.tags.length > 0) {
      const hashTags = formatted.tags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .slice(0, 3) // 限制标签数量
        .join(' ');
      
      tweetText += "\n\n" + hashTags;
    }
    
    // 添加链接（如果有）
    if (formatted.url) {
      tweetText += "\n" + formatted.url;
    }
    
    // 确保不超过280字符
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + "...";
    }
    
    formatted.content = tweetText;
    return formatted;
  }
  
  /**
   * 模拟API调用（实际项目中需要替换为真实API调用）
   */
  private async simulateApiCall(data: any, auth: PlatformAuth): Promise<any> {
    // 实际项目中需要实现真实API调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: Math.floor(Math.random() * 10000000000000),
          text: data.content,
          created_at: new Date().toISOString()
        });
      }, 500);
    });
  }
}
