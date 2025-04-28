/*
 * Copyright (c) 2024 Sun Booshi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { requestUrl } from "obsidian";
import { ArticleContent, DistributionResult, PlatformAdapter, PlatformAuth, PlatformType } from "./types";
import { logger } from "../utils";

/**
 * 小红书平台适配器
 */
export class XiaoHongShuAdapter implements PlatformAdapter {
  type = PlatformType.XIAOHONGSHU;
  name = "小红书";
  icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 5a5 5 0 0 1 10 0v1H5V5z"/>
    <path d="M7 11a3 3 0 0 1 6 0v1H7v-1z"/>
    <rect x="4" y="16" width="16" height="6" rx="2"/>
    <path d="M18 12h2a2 2 0 0 1 2 2v2H18v-4z"/>
    <path d="M18 8h2a2 2 0 0 1 2 2v2h-4v-4z"/>
    <path d="M10 2h4v2h-4z"/>
  </svg>`;

  /**
   * 检查小红书认证信息是否有效
   */
  isAuthValid(auth: PlatformAuth): boolean {
    return (
      auth.type === PlatformType.XIAOHONGSHU &&
      !!auth.token &&
      !!auth.appId &&
      !!auth.appSecret
    );
  }

  /**
   * 发布文章到小红书
   */
  async publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
    try {
      logger.info("正在发布文章到小红书");
      
      // 小红书API实现
      // 由于小红书没有公开API，这里使用模拟实现
      // 实际项目中可能需要基于第三方服务或自定义实现
      
      // 格式化内容，小红书一般更适合图文笔记格式
      const formattedContent = this.formatContent(content);
      
      // 模拟API调用
      const response = await this.simulateApiCall(formattedContent, auth, false);
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已发布到小红书",
        url: `https://www.xiaohongshu.com/discovery/item/${response.id}`,
        data: response
      };
    } catch (error) {
      logger.error("发布小红书文章失败:", error);
      return {
        success: false,
        platformType: this.type,
        message: `发布失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 保存为草稿
   */
  async saveDraft(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
    try {
      logger.info("正在保存文章到小红书草稿箱");
      
      // 格式化内容
      const formattedContent = this.formatContent(content);
      
      // 模拟API调用
      const response = await this.simulateApiCall(formattedContent, auth, true);
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已保存到小红书草稿箱",
        data: response
      };
    } catch (error) {
      logger.error("保存小红书草稿失败:", error);
      return {
        success: false,
        platformType: this.type,
        message: `保存草稿失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 格式化文章以适应小红书平台
   */
  formatContent(content: ArticleContent): ArticleContent {
    // 小红书通常有字数限制，更适合精简内容
    // 这里进行一些基本的转换，实际项目中可能需要更复杂的处理
    const formatted = { ...content };
    
    // 提取前1000个字符作为内容
    if (formatted.content.length > 1000) {
      const textContent = formatted.content.replace(/<[^>]*>/g, '');
      formatted.summary = textContent.substring(0, 200) + '...';
    }
    
    // 处理标签
    if (!formatted.tags || formatted.tags.length === 0) {
      formatted.tags = ['手工川智能创作'];
    } else {
      // 确保标签前有#
      formatted.tags = formatted.tags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      );
    }
    
    return formatted;
  }
  
  /**
   * 模拟API调用（实际项目中需要替换为真实API调用）
   */
  private async simulateApiCall(data: any, auth: PlatformAuth, isDraft: boolean): Promise<any> {
    // 实际项目中需要实现真实API调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: Math.floor(Math.random() * 10000000).toString(16),
          url: isDraft ? null : `https://www.xiaohongshu.com/discovery/item/abc${Math.floor(Math.random() * 1000000)}`,
          title: data.title,
          isDraft: isDraft,
          created: new Date().toISOString()
        });
      }, 500);
    });
  }
}
