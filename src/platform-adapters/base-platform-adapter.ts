import {logger} from "../utils";
import {ArticleContent, DistributionResult, PlatformAuth, PlatformType} from "./types";

/**
 * 平台适配器接口 - 负责处理平台特定的发布逻辑
 */
export interface IPlatformAdapter {
	/**
	 * 平台类型
	 */
	readonly type: PlatformType;

	/**
	 * 平台名称
	 */
	readonly name: string;

	/**
	 * 平台图标 (SVG字符串)
	 */
	readonly icon: string;

	/**
	 * 检查认证信息是否有效
	 * @param auth 平台认证信息
	 */
	isAuthValid(auth: PlatformAuth): boolean;

	/**
	 * 发布文章到平台
	 * @param content 文章内容
	 * @param auth 平台认证信息
	 */
	publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult>;

	/**
	 * 保存文章为草稿（可选实现）
	 * @param content 文章内容
	 * @param auth 平台认证信息
	 */
	saveDraft?(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult>;

	/**
	 * 格式化文章内容以符合平台要求（可选实现）
	 * @param content 原始文章内容
	 */
	formatContent?(content: ArticleContent): ArticleContent;
}

/**
 * 基础平台适配器抽象类 - 提供平台发布能力的基础实现
 */
export abstract class BasePlatformAdapter implements IPlatformAdapter {
	/**
	 * 平台类型 - 子类必须实现
	 */
	abstract readonly type: PlatformType;

	/**
	 * 平台名称 - 子类必须实现
	 */
	abstract readonly name: string;

	/**
	 * 平台图标 - 子类必须实现
	 */
	abstract readonly icon: string;

	/**
	 * 检查认证信息是否有效 - 子类必须实现
	 */
	abstract isAuthValid(auth: PlatformAuth): boolean;

	/**
	 * 发布文章到平台 - 子类必须实现
	 */
	abstract publish(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult>;

	/**
	 * 保存为草稿 - 默认实现调用发布方法
	 * 子类可以覆盖此方法提供特定平台的草稿保存逻辑
	 */
	async saveDraft(content: ArticleContent, auth: PlatformAuth): Promise<DistributionResult> {
		logger.info(`平台 ${this.name} 使用默认草稿保存方法`);
		return this.publish(content, auth);
	}

	/**
	 * 格式化文章内容 - 默认实现直接返回原内容
	 * 子类可以覆盖此方法提供特定平台的内容格式化逻辑
	 */
	formatContent(content: ArticleContent): ArticleContent {
		return content;
	}

	/**
	 * 创建分发结果对象
	 * @param success 是否成功
	 * @param message 结果消息
	 * @param data 额外数据
	 */
	protected createResult(success: boolean, message: string, data?: Record<string, unknown>): DistributionResult {
		return {
			success,
			platformType: this.type,
			message,
			data
		};
	}

	/**
	 * 创建错误结果对象
	 * @param error 错误对象
	 * @param message 自定义错误消息
	 */
	protected createErrorResult(error: unknown, message?: string): DistributionResult {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = message || `操作失败: ${errorObj.message || "未知错误"}`;
		
		return {
			success: false,
			platformType: this.type,
			message: errorMessage,
			error: errorObj
		};
	}
}
