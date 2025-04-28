/*
 * Copyright (c) 2025 Mark Shawn
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
 * 知乎平台适配器
 */
export class ZhihuAdapter implements PlatformAdapter {
  type = PlatformType.ZHIHU;
  name = "知乎";
  icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13.04 4.68c-1.35.15-2.58.16-3.51.11-.84-.05-1.38-.1-1.59-.15a.85.85 0 0 1-.52-.3c-.1-.11-.22-.33-.23-.72s.11-.61.22-.73c.1-.12.28-.23.51-.32.5-.17 1.3-.28 2.13-.34.82-.06 1.5-.08 1.97-.09 5.39-.06 9.03 1.49 11 4.79.79 1.32 1.31 2.93 1.59 4.79.29 1.86.34 3.91.09 6.08-2.32-1.65-4.72-2.38-7.13-2.29-1.21.05-2.36.28-3.38.72a7.66 7.66 0 0 0-4.45 4.87c-.15.45-.26.94-.28 1.46a3.95 3.95 0 0 0 .18 1.46c.05-.8.13-1.55.24-2.27.15-.9.33-1.74.58-2.54a11.97 11.97 0 0 1 1.09-2.42c.15-.26.31-.51.47-.76-1.06.55-1.89 1.18-2.54 1.86-.66.69-1.15 1.44-1.52 2.22-.37.79-.58 1.63-.68 2.49-.1.86-.11 1.73-.04 2.58.08.86.25 1.7.51 2.49-4.63-1.09-7.93-3.91-8.31-7.69-.14-1.37-.01-2.82.44-4.24.45-1.42 1.15-2.8 2.16-4.05a14.32 14.32 0 0 1 3.71-3.47c1.46-.98 3.15-1.75 5.09-2.08 1.9-.33 3.93-.33 6.09-.01-.77-1.01-1.88-1.84-3.33-2.45-1.47-.62-3.28-.99-5.45-1.07z"/>
  </svg>`;

  /**
   * 检查知乎认证信息是否有效
   */
  isAuthValid(auth: PlatformAuth): boolean {
    return (
      auth.type === PlatformType.ZHIHU &&
      !!auth.cookies
    );
  }

  /**
   * 发布文章到知乎
   */
  async publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
    try {
      logger.info("正在发布文章到知乎");
      
      // 知乎API实现
      // 这里使用模拟实现，实际项目中需要根据知乎API进行开发
      const articleData = {
        title: content.title,
        content: content.content,
        coverImage: content.coverImage,
        isDraft: false
      };
      
      // 模拟API调用
      const response = await this.simulateApiCall(articleData, auth);
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已发布到知乎",
        url: `https://zhuanlan.zhihu.com/p/${response.id}`,
        data: response
      };
    } catch (error) {
      logger.error("发布知乎文章失败:", error);
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
      logger.info("正在保存文章到知乎草稿箱");
      
      // 知乎API实现
      const articleData = {
        title: content.title,
        content: content.content,
        coverImage: content.coverImage,
        isDraft: true
      };
      
      // 模拟API调用
      const response = await this.simulateApiCall(articleData, auth);
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已保存到知乎草稿箱",
        url: `https://zhuanlan.zhihu.com/p/${response.id}/edit`,
        data: response
      };
    } catch (error) {
      logger.error("保存知乎草稿失败:", error);
      return {
        success: false,
        platformType: this.type,
        message: `保存草稿失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 模拟API调用（实际项目中需要替换为真实API调用）
   */
  private async simulateApiCall(data: any, auth: PlatformAuth): Promise<any> {
    // 实际项目中需要实现真实API调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: Math.floor(Math.random() * 10000000),
          url: "https://zhuanlan.zhihu.com/p/123456789",
          title: data.title,
          created: new Date().toISOString()
        });
      }, 500);
    });
  }
}
