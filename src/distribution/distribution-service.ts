

import { App } from "obsidian";
import { ArticleContent, DistributionResult, PlatformAdapter, PlatformAuth, PlatformType } from "./types";
import { WeChatAdapter } from "./wechat-adapter";
import { ZhihuAdapter } from "./zhihu-adapter";
import { XiaoHongShuAdapter } from "./xiaohongshu-adapter";
import { TwitterAdapter } from "./twitter-adapter";
import { logger } from "../utils";

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

/**
 * 分发服务 - 管理内容分发到多个平台
 */
export class DistributionService {
  private static instance: DistributionService;
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();
  private platformAuths: Map<PlatformType, PlatformAuth> = new Map();
  private tasks: DistributionTask[] = [];
  private app: App;
  
  /**
   * 获取分发服务单例
   */
  public static getInstance(): DistributionService {
    if (!DistributionService.instance) {
      DistributionService.instance = new DistributionService();
    }
    return DistributionService.instance;
  }
  
  /**
   * 初始化分发服务
   */
  public setup(app: App): void {
    this.app = app;
    this.registerAdapters();
    logger.info("分发服务初始化完成");
  }
  
  /**
   * 注册平台适配器
   */
  private registerAdapters(): void {
    // 注册内置适配器
    this.registerAdapter(new WeChatAdapter());
    this.registerAdapter(new ZhihuAdapter());
    this.registerAdapter(new XiaoHongShuAdapter());
    this.registerAdapter(new TwitterAdapter());
    
    logger.info(`已注册 ${this.adapters.size} 个平台适配器`);
  }
  
  /**
   * 注册平台适配器
   */
  public registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }
  
  /**
   * 获取所有已注册的平台适配器
   */
  public getAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * 获取特定平台的适配器
   */
  public getAdapter(type: PlatformType): PlatformAdapter | undefined {
    return this.adapters.get(type);
  }
  
  /**
   * 设置平台认证信息
   */
  public setPlatformAuth(auth: PlatformAuth): void {
    this.platformAuths.set(auth.type, auth);
  }
  
  /**
   * 获取平台认证信息
   */
  public getPlatformAuth(type: PlatformType): PlatformAuth | undefined {
    return this.platformAuths.get(type);
  }
  
  /**
   * 获取所有配置了认证信息的平台
   */
  public getConfiguredPlatforms(): PlatformAuth[] {
    return Array.from(this.platformAuths.values())
      .filter(auth => auth.enabled);
  }
  
  /**
   * 发布文章到指定平台
   */
  public async publishToPlatform(
    content: ArticleContent,
    platformType: PlatformType
  ): Promise<DistributionResult> {
    const adapter = this.adapters.get(platformType);
    const auth = this.platformAuths.get(platformType);
    
    if (!adapter) {
      logger.error(`未找到平台适配器: ${platformType}`);
      return {
        success: false,
        platformType,
        message: `未找到平台适配器: ${platformType}`
      };
    }
    
    if (!auth || !auth.enabled) {
      logger.error(`平台未启用或未配置: ${platformType}`);
      return {
        success: false,
        platformType,
        message: `平台未启用或未配置: ${platformType}`
      };
    }
    
    if (!adapter.isAuthValid(auth)) {
      logger.error(`平台认证信息无效: ${platformType}`);
      return {
        success: false,
        platformType,
        message: `平台认证信息无效: ${platformType}`
      };
    }
    
    // 创建任务
    const task: DistributionTask = {
      id: this.generateTaskId(),
      platformType,
      content,
      status: DistributionTaskStatus.PROCESSING,
      createdAt: new Date()
    };
    
    this.tasks.push(task);
    
    try {
      logger.info(`开始发布到平台: ${adapter.name}`);
      const result = await adapter.publish(content, auth);
      
      // 更新任务状态
      task.status = result.success 
        ? DistributionTaskStatus.COMPLETED 
        : DistributionTaskStatus.FAILED;
      task.result = result;
      task.completedAt = new Date();
      
      logger.info(`发布到平台 ${adapter.name} ${result.success ? '成功' : '失败'}: ${result.message}`);
      return result;
    } catch (error) {
      logger.error(`发布到平台 ${adapter.name} 发生异常:`, error);
      
      // 更新任务状态
      task.status = DistributionTaskStatus.FAILED;
      task.result = {
        success: false,
        platformType,
        message: `发布失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
      task.completedAt = new Date();
      
      return task.result;
    }
  }
  
  /**
   * 保存为平台草稿
   */
  public async saveDraft(
    content: ArticleContent,
    platformType: PlatformType
  ): Promise<DistributionResult> {
    const adapter = this.adapters.get(platformType);
    const auth = this.platformAuths.get(platformType);
    
    if (!adapter) {
      return {
        success: false,
        platformType,
        message: `未找到平台适配器: ${platformType}`
      };
    }
    
    if (!auth || !auth.enabled) {
      return {
        success: false,
        platformType,
        message: `平台未启用或未配置: ${platformType}`
      };
    }
    
    if (!adapter.saveDraft) {
      return {
        success: false,
        platformType,
        message: `平台不支持保存草稿功能: ${platformType}`
      };
    }
    
    try {
      logger.info(`开始保存草稿到平台: ${adapter.name}`);
      const result = await adapter.saveDraft(content, auth);
      logger.info(`保存草稿到平台 ${adapter.name} ${result.success ? '成功' : '失败'}: ${result.message}`);
      return result;
    } catch (error) {
      logger.error(`保存草稿到平台 ${adapter.name} 发生异常:`, error);
      return {
        success: false,
        platformType,
        message: `保存草稿失败: ${error instanceof Error ? error.message : "未知错误"}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 发布到多个平台
   */
  public async publishToMultiplePlatforms(
    content: ArticleContent, 
    platformTypes: PlatformType[]
  ): Promise<Map<PlatformType, DistributionResult>> {
    const results = new Map<PlatformType, DistributionResult>();
    
    for (const type of platformTypes) {
      const result = await this.publishToPlatform(content, type);
      results.set(type, result);
    }
    
    return results;
  }
  
  /**
   * 获取最近的任务列表
   */
  public getRecentTasks(limit: number = 10): DistributionTask[] {
    return this.tasks
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * 保存分发服务配置
   */
  public saveConfig(): any {
    // 将认证信息转换为可序列化格式
    const authsArray = Array.from(this.platformAuths.values());
    return {
      platforms: authsArray
    };
  }
  
  /**
   * 加载分发服务配置
   */
  public loadConfig(config: any): void {
    if (!config || !config.platforms) return;
    
    this.platformAuths.clear();
    
    for (const platform of config.platforms) {
      if (platform.type && this.adapters.has(platform.type as PlatformType)) {
        this.platformAuths.set(platform.type as PlatformType, platform as PlatformAuth);
      }
    }
    
    logger.info(`已加载 ${this.platformAuths.size} 个平台配置`);
  }
}
