import {BaseProcessPlugin} from "src/plugins/base-process-plugin";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 链接处理插件 - 根据设置将链接转换为脚注或其他格式
 */
export class WechatLinkPlugin extends BaseProcessPlugin {
	getName(): string {
		return "微信链接处理插件";
	}

	process(html: string, settings: NMPSettings): string {
		// 如果不需要处理链接，直接返回
		if (settings.linkFootnoteMode === "none") {
			return html;
		}

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有链接
			const links = doc.querySelectorAll("a");
			const footnotes: string[] = [];

			links.forEach((link) => {
				const href = link.getAttribute("href");
				if (!href) return;

				// 检查是否已经是脚注格式的链接
				// 1. 检查是否已经是脚注引用（如 #fn-123）
				const isFootnoteRef = href.startsWith('#fn-');
				
				// 2. 检查是否是脚注中的返回链接（如 #fnref-123）
				const isFootnoteBackRef = href.startsWith('#fnref-');
				
				// 3. 检查是否是服务于脚注系统的链接
				const parentIsSup = link.parentElement?.tagName === 'SUP';
				const hasFootnoteClass = link.classList.contains('footnote-ref') || 
										link.classList.contains('footnote-backref');
				
				// 如果已经是脚注相关的链接，去除a标签但保留上标效果
				if (isFootnoteRef || isFootnoteBackRef || hasFootnoteClass || parentIsSup) {
					logger.debug("Processing footnote link, removing a tag but keeping sup:", href);
					
					if (parentIsSup) {
						// 如果父元素是sup，保留sup但去除a标签
						const supElement = link.parentElement;
						const linkText = link.textContent;
						link.replaceWith(linkText || '');
						
						// 确保还是sup样式
						if (supElement && linkText) {
							supElement.textContent = linkText;
						}
					} else {
						// 直接将自身转为上标
						const supElement = document.createElement('sup');
						supElement.textContent = link.textContent || '';
						link.replaceWith(supElement);
					}
					return;
				}

				// 判断是否需要转换此链接
				const shouldConvert = !href.includes("weixin.qq.com");

				if (shouldConvert) {
					// 创建脚注标记
					const footnoteRef = document.createElement("sup");
					footnoteRef.textContent = `[${footnotes.length + 1}]`;
					footnoteRef.style.color = "#3370ff";

					// 替换链接为脚注引用
					link.after(footnoteRef);

					// 根据设置决定脚注内容格式
					let footnoteContent = "";
					if (settings.linkDescriptionMode === "raw") {
						footnoteContent = `[${footnotes.length + 1}] ${
							link.textContent
						}: ${href}`;
					} else {
						footnoteContent = `[${footnotes.length + 1}] ${href}`;
					}

					footnotes.push(footnoteContent);

					// 移除链接标签，保留内部文本
					const linkText = link.textContent;
					link.replaceWith(linkText || "");
				}
			});

			// 如果有脚注，添加到文档末尾
			if (footnotes.length > 0) {
				const hr = document.createElement("hr");
				const footnoteSection = document.createElement("section");
				footnoteSection.style.fontSize = "14px";
				footnoteSection.style.color = "#888";
				footnoteSection.style.marginTop = "30px";

				footnotes.forEach((note) => {
					const p = document.createElement("p");
					p.innerHTML = note;
					footnoteSection.appendChild(p);
				});

				doc.body.appendChild(hr);
				doc.body.appendChild(footnoteSection);
			}

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理链接时出错:", error);
			return html;
		}
	}
}
