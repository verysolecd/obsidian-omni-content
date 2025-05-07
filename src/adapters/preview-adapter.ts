import { CardDataManager } from "../markdown/code";
import { NMPSettings } from "../settings";
import { logger } from "../utils";
import { ContentAdapter } from "./content-adapter";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class PreviewAdapter implements ContentAdapter {
	// 保存设置实例以在其他方法中使用
	private currentSettings: NMPSettings;

	constructor() {
		// 初始化时获取设置单例
		this.currentSettings = NMPSettings.getInstance();
	}

	/**
	 * 适配预览内容
	 * @param html 原始HTML内容
	 * @param settings 插件设置
	 * @returns 适配后的HTML内容
	 */
	adaptContent(html: string, _settings: NMPSettings): string {
		logger.debug("应用预览适配器处理HTML");

		// 预览模式下的默认处理，主要是恢复代码卡片
		let processedHtml = CardDataManager.getInstance().restoreCard(html);

		processedHtml = this.processHeadings(processedHtml);

		return processedHtml;
	}

	/**
	 * 处理样式，确保符合微信公众号的样式限制
	 */
	/**
	 * 处理二级标题，根据设置决定是否为标题添加序号
	 * 当启用时，将序号作为标题的内容插入
	 */
	private processHeadings(html: string): string {
		try {
			// 如果用户关闭了二级标题序号功能，直接返回原始 HTML
			if (!this.currentSettings.enableHeadingNumber) {
				logger.debug("二级标题序号功能已关闭，不添加序号");
				return html;
			}

			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 获取所有二级标题
			const h2Elements = doc.querySelectorAll("h2");
			if (h2Elements.length === 0) {
				return html; // 没有h2标题，直接返回
			}

			logger.debug(`处理 ${h2Elements.length} 个二级标题，添加序号`);

			// 为每个h2标题添加序号
			h2Elements.forEach((h2, index) => {
				// 格式化编号为两位数 01, 02, 03...
				const number = (index + 1).toString().padStart(2, "0");

				// 检查标题是否已有内容结构
				const prefixSpan = h2.querySelector(".prefix");
				const contentSpan = h2.querySelector(".content");

				// 如果标题包含prefix/content/suffix结构，则在content内插入序号
				if (contentSpan) {
					// 创建序号元素
					const numberSpan = document.createElement("span");
					numberSpan.setAttribute("leaf", "");

					// 设置样式
					numberSpan.setAttribute("style", "font-size: 48px; ");
					numberSpan.textContent = number;

					// 将序号添加到标题内容开头
					const wrapper = document.createElement("span");
					wrapper.setAttribute("textstyle", "");
					wrapper.appendChild(numberSpan);

					// 添加换行
					const breakElement = document.createElement("br");

					// 插入到内容容器的开头
					contentSpan.insertBefore(
						breakElement,
						contentSpan.firstChild
					);
					contentSpan.insertBefore(wrapper, contentSpan.firstChild);

					// 将备注文本居中
					h2.style.textAlign = "center";
				} else {
					// 如果标题没有特定结构，直接添加到标题开头
					// 保存原始内容
					const originalContent = h2.innerHTML;

					// 创建序号HTML
					const numberHtml = `<span textstyle="" style="font-size: 48px; text-decoration: underline; margin-bottom: 96px !important">${number}</span><br>`;

					// 替换原标题内容，序号后面跟原内容
					h2.innerHTML = numberHtml + originalContent;

					// 将标题居中
					h2.style.textAlign = "center";
				}
			});

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理二级标题序号时出错:", error);
			return html;
		}
	}
}
