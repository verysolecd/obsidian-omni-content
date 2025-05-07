import {CardDataManager} from "../markdown/code";
import {applyCSS, logger} from "../utils";
import {BaseAdapter} from "./content-adapter";
import colors from "colors";

/**
 * 知乎适配器 - 处理知乎平台特定的格式要求
 */
export class ZhihuAdapter extends BaseAdapter {
	/**
	 * 获取适配器名称
	 */
	protected getAdapterName(): string {
		return "知乎";
	}
	
	/**
	 * 处理HTML内容
	 * @param html 原始HTML内容 
	 * @returns 处理后的HTML内容
	 */
	protected process(html: string): string {
		let processedHtml = html;

		// 知乎特定处理开始

		// 1. 处理图片（知乎的图片处理方式可能与微信不同）
		processedHtml = this.processImages(processedHtml);

		// 2. 处理链接（知乎允许直接链接，处理方式与微信不同）
		processedHtml = this.processLinks(processedHtml);

		// 3. 处理代码块（确保代码在知乎上正确显示）
		processedHtml = this.processCodeBlocks(processedHtml);

		// 4. 处理标题
		processedHtml = this.processHeadings(processedHtml);

		// 5. 其他知乎特定处理...

		// 最后，恢复代码卡片
		processedHtml = CardDataManager.getInstance().restoreCard(processedHtml);

		return processedHtml;
	}
	
	/**
	 * 应用样式到HTML内容，知乎版本
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
			
			// 知乎可能需要特定的样式处理，比如代码块、引用等
			// TODO: 添加知乎特定样式处理
			
			// 获取处理后的HTML并清理临时元素
			const result = tempDiv.innerHTML;
			document.body.removeChild(tempDiv);
			
			logger.info(colors.blue("已应用知乎样式"));
			return result;
		} catch (error) {
			logger.error("应用知乎样式时出错:", error);
			return html;
		}
	}

	/**
	 * 处理图片，适配知乎格式
	 */
	private processImages(html: string): string {
		// 实现知乎图片处理逻辑
		return html;
	}

	/**
	 * 处理链接，知乎支持直接链接
	 */
	private processLinks(html: string): string {
		// 知乎链接处理
		return html;
	}

	/**
	 * 处理代码块，确保在知乎中正确显示
	 */
	private processCodeBlocks(html: string): string {
		// 知乎代码块处理
		// 使用 this.currentSettings.defaultHighlight 来决定代码高亮样式
		const highlightStyle = this.currentSettings.defaultHighlight;
		logger.debug(`知乎代码块处理使用高亮样式: ${highlightStyle}`);
		return html;
	}
}
