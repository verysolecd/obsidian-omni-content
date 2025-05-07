import {App} from "obsidian";
import {logger} from "../utils";
import {ArticleContent, DistributionResult, DistributionTask, DistributionTaskStatus, PlatformAuth, PlatformType} from "./types";
import {IPlatformAdapter} from "src/platform-adapters/base-platform-adapter";

/**
 * 平台服务 - 管理内容分发到多个平台的核心服务
 * 负责平台适配器的注册、管理及内容发布流程
 */
export class PlatformService {
    private static instance: PlatformService;
    private adapters: Map<PlatformType, IPlatformAdapter> = new Map();
    private platformAuths: Map<PlatformType, PlatformAuth> = new Map();
    private tasks: DistributionTask[] = [];
    private app: App;

    private constructor() {
        // 私有构造函数，确保单例模式
    }

    /**
     * 获取平台服务单例
     */
    public static getInstance(): PlatformService {
        if (!PlatformService.instance) {
            PlatformService.instance = new PlatformService();
        }
        return PlatformService.instance;
    }

    /**
     * 初始化平台服务
     */
    public setup(app: App): void {
        this.app = app;
        logger.info("平台服务初始化完成");
    }

    /**
     * 注册平台适配器
     * @param adapter 平台适配器实例
     */
    public registerAdapter(adapter: IPlatformAdapter): void {
        this.adapters.set(adapter.type, adapter);
        logger.info(`已注册平台适配器: ${adapter.name}`);
    }

    /**
     * 批量注册平台适配器
     * @param adapters 平台适配器实例数组
     */
    public registerAdapters(adapters: IPlatformAdapter[]): void {
        adapters.forEach(adapter => this.registerAdapter(adapter));
        logger.info(`批量注册了 ${adapters.length} 个平台适配器`);
    }

    /**
     * 获取所有已注册的平台适配器
     */
    public getAdapters(): IPlatformAdapter[] {
        return Array.from(this.adapters.values());
    }

    /**
     * 获取特定平台的适配器
     * @param type 平台类型
     */
    public getAdapter(type: PlatformType): IPlatformAdapter | undefined {
        return this.adapters.get(type);
    }

    /**
     * 设置平台认证信息
     * @param auth 平台认证信息
     */
    public setPlatformAuth(auth: PlatformAuth): void {
        this.platformAuths.set(auth.type, auth);
    }

    /**
     * 获取平台认证信息
     * @param type 平台类型
     */
    public getPlatformAuth(type: PlatformType): PlatformAuth | undefined {
        return this.platformAuths.get(type);
    }

    /**
     * 获取所有配置了认证信息的可用平台
     */
    public getConfiguredPlatforms(): PlatformAuth[] {
        return Array.from(this.platformAuths.values())
            .filter(auth => auth.enabled);
    }

    /**
     * 发布文章到指定平台
     * @param content 文章内容
     * @param platformType 平台类型
     */
    public async publishToPlatform(
        content: ArticleContent,
        platformType: PlatformType
    ): Promise<DistributionResult> {
        const adapter = this.adapters.get(platformType);
        const auth = this.platformAuths.get(platformType);

        // 检查适配器是否存在
        if (!adapter) {
            logger.error(`未找到平台适配器: ${platformType}`);
            return {
                success: false,
                platformType,
                message: `未找到平台适配器: ${platformType}`
            };
        }

        // 检查认证信息是否有效
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
            
            // 格式化内容（如果适配器提供了此方法）
            const formattedContent = adapter.formatContent ? 
                adapter.formatContent(content) : content;
            
            // 发布内容
            const result = await adapter.publish(formattedContent, auth);

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
            
            const errorObj = error instanceof Error ? error : new Error(String(error));
            task.result = {
                success: false,
                platformType,
                message: `发布失败: ${errorObj.message || "未知错误"}`,
                error: errorObj
            };
            task.completedAt = new Date();

            return task.result;
        }
    }

    /**
     * 保存为平台草稿
     * @param content 文章内容
     * @param platformType 平台类型
     */
    public async saveDraft(
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

        if (!adapter.saveDraft) {
            logger.warn(`平台 ${adapter.name} 不支持保存草稿功能`);
            return {
                success: false,
                platformType,
                message: `平台 ${adapter.name} 不支持保存草稿功能`
            };
        }

        try {
            logger.info(`开始保存草稿到平台: ${adapter.name}`);
            
            // 格式化内容（如果适配器提供了此方法）
            const formattedContent = adapter.formatContent ? 
                adapter.formatContent(content) : content;
                
            const result = await adapter.saveDraft(formattedContent, auth);
            logger.info(`保存草稿到平台 ${adapter.name} ${result.success ? '成功' : '失败'}: ${result.message}`);
            
            return result;
        } catch (error) {
            logger.error(`保存草稿到平台 ${adapter.name} 发生异常:`, error);
            
            const errorObj = error instanceof Error ? error : new Error(String(error));
            return {
                success: false,
                platformType,
                message: `保存草稿失败: ${errorObj.message || "未知错误"}`,
                error: errorObj
            };
        }
    }

    /**
     * 发布到多个平台
     * @param content 文章内容
     * @param platformTypes 平台类型数组
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
     * @param limit 限制数量
     */
    public getRecentTasks(limit: number = 10): DistributionTask[] {
        return this.tasks
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }

    /**
     * 获取任务详情
     * @param taskId 任务ID
     */
    public getTask(taskId: string): DistributionTask | undefined {
        return this.tasks.find(task => task.id === taskId);
    }

    /**
     * 生成任务ID
     */
    private generateTaskId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }
}
