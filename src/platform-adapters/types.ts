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
    data?: Record<string, unknown>;  // 平台返回的数据
}

/**
 * 分发任务状态
 */
export enum DistributionTaskStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

/**
 * 分发任务
 */
export interface DistributionTask {
    id: string;
    platformType: PlatformType;
    content: ArticleContent;
    status: DistributionTaskStatus;
    result?: DistributionResult;
    createdAt: Date;
    completedAt?: Date;
}
