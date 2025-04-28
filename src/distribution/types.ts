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

/**
 * 分发平台类型
 */
export enum PlatformType {
  WECHAT = 'wechat',       // 微信公众号
  ZHIHU = 'zhihu',         // 知乎
  XIAOHONGSHU = 'xhs',     // 小红书
  TWITTER = 'twitter',     // 推特
  CUSTOM = 'custom'        // 自定义平台
}

/**
 * 文章内容接口
 */
export interface ArticleContent {
  title: string;           // 文章标题
  content: string;         // 文章内容(HTML)
  rawContent?: string;     // 原始内容
  coverImage?: string;     // 封面图片地址或Base64
  summary?: string;        // 摘要
  author?: string;         // 作者名
  tags?: string[];         // 标签
  url?: string;            // 原文链接
  sourceUrl?: string;      // 原文URL
}

/**
 * 平台认证信息
 */
export interface PlatformAuth {
  type: PlatformType;      // 平台类型
  enabled: boolean;        // 是否启用
  name?: string;           // 平台名称(自定义显示)
  token?: string;          // 访问令牌
  appId?: string;          // 应用ID
  appSecret?: string;      // 应用密钥
  username?: string;       // 用户名
  password?: string;       // 密码
  cookies?: string;        // Cookies
  endpoint?: string;       // 自定义API端点
}

/**
 * 分发结果接口
 */
export interface DistributionResult {
  success: boolean;        // 是否成功
  platformType: PlatformType; // 平台类型
  url?: string;            // 发布后的URL
  message?: string;        // 结果消息
  error?: Error;           // 错误信息
  data?: any;              // 平台返回的数据
}

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  type: PlatformType;      // 平台类型
  name: string;            // 平台名称
  icon: string;            // 平台图标(SVG字符串)
  
  // 检查认证信息是否有效
  isAuthValid(auth: PlatformAuth): boolean;
  
  // 发布文章到平台
  publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult>;
  
  // 保存为草稿
  saveDraft?(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult>;
  
  // 格式化文章内容以符合平台要求
  formatContent?(content: ArticleContent): ArticleContent;
}
