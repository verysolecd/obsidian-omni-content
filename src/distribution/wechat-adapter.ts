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

import { ArticleContent, DistributionResult, PlatformAdapter, PlatformAuth, PlatformType } from "./types";
import { DraftArticle, wxAddDraft, wxGetToken, wxUploadImage } from "../weixin-api";
import { logger } from "../utils";

/**
 * 微信公众号平台适配器
 */
export class WeChatAdapter implements PlatformAdapter {
  type = PlatformType.WECHAT;
  name = "微信公众号";
  icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16.25 5.5c.966 0 1.75.784 1.75 1.75s-.784 1.75-1.75 1.75-1.75-.784-1.75-1.75.784-1.75 1.75-1.75zm-8.5 0c.966 0 1.75.784 1.75 1.75s-.784 1.75-1.75 1.75S6 8.216 6 7.25 6.784 5.5 7.75 5.5zm5.5 4.5c2.276 0 4.367.832 5.976 2.207l-7.112 3.846a.75.75 0 0 1-.728 0L4.274 12.207A8.237 8.237 0 0 1 10.25 10c1.025 0 2.011.188 2.913.523A.75.75 0 0 0 13.5 9.75a.75.75 0 0 0-.581-.748 9.735 9.735 0 0 0-2.67-.502c-2.797 0-5.337 1.183-7.129 3.074l8.068 4.265a.75.75 0 0 0 .694.072l.058-.028 8.068-4.309A9.74 9.74 0 0 0 10.25 8.5c-.677 0-1.336.08-1.969.23a.75.75 0 0 0-.56.898.75.75 0 0 0 .898.562 8.25 8.25 0 0 1 1.631-.19z"/>
  </svg>`;

  /**
   * 检查微信认证信息是否有效
   */
  isAuthValid(auth: PlatformAuth): boolean {
    return (
      auth.type === PlatformType.WECHAT &&
      !!auth.token &&
      !!auth.appId &&
      !!auth.appSecret
    );
  }

  /**
   * 发布文章到微信公众号（保存为草稿）
   */
  async publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
    try {
      logger.info("正在发布文章到微信公众号");

      // 获取token
      const tokenRes = await wxGetToken(auth.token!, auth.appId!, auth.appSecret!);
      
      if (tokenRes.status !== 200 || !tokenRes.json.access_token) {
        return {
          success: false,
          platformType: this.type,
          message: "获取微信令牌失败",
          error: new Error(tokenRes.text || "获取微信令牌失败")
        };
      }
      
      const accessToken = tokenRes.json.access_token;
      let thumbMediaId = "";
      
      // 上传缩略图（如果有）
      if (content.coverImage) {
        try {
          // 假设coverImage是base64编码的图片
          const base64Data = content.coverImage.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const blob = new Blob([buffer], { type: "image/jpeg" });
          
          const imageRes = await wxUploadImage(blob, "cover.jpg", accessToken, "thumb");
          
          if (imageRes.media_id) {
            thumbMediaId = imageRes.media_id;
          }
        } catch (error) {
          logger.error("上传微信缩略图失败:", error);
        }
      }
      
      // 创建草稿
      const draftArticle: DraftArticle = {
        title: content.title,
        content: content.content,
        thumb_media_id: thumbMediaId,
        author: content.author || "",
        digest: content.summary || "",
        content_source_url: content.sourceUrl || ""
      };
      
      const draftRes = await wxAddDraft(accessToken, draftArticle);
      
      if (draftRes.status !== 200 || draftRes.json.errcode) {
        return {
          success: false,
          platformType: this.type,
          message: `保存微信草稿失败: ${draftRes.json.errmsg || "未知错误"}`,
          error: new Error(draftRes.json.errmsg || "保存微信草稿失败"),
          data: draftRes.json
        };
      }
      
      return {
        success: true,
        platformType: this.type,
        message: "文章已保存到微信公众号草稿箱",
        data: draftRes.json
      };
    } catch (error) {
      logger.error("发布微信公众号文章失败:", error);
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
    // 微信公众号的发布功能就是保存为草稿
    return this.publish(content, auth);
  }
}
