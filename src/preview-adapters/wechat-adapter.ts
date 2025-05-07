import { NMPSettings } from "../settings";
import { applyCSS, logger } from "../utils";
import { BaseAdapter, IBaseAdapter } from "src/preview-adapters/base-adapter";
import colors from "colors";

/**
 * 微信公众号适配器 - 处理微信公众号特定的格式要求
 */
export class WeChatAdapter extends BaseAdapter {
	
	protected getAdapterName(): string {
		return "微信公众号";
	}

	protected process(html: string): string {
		
		let processedHtml = html;

		// 针对微信的专门处理
		processedHtml = this.processImages(processedHtml);
		processedHtml = this.processLinks(processedHtml);
		processedHtml = this.processHeadings(processedHtml);
		// processedHtml = this.processBlockquotes(processedHtml);
		processedHtml = this.processLists(processedHtml);
		processedHtml = this.processCodeBlocks(processedHtml);
		processedHtml = this.processTables(processedHtml);
		processedHtml = this.processStyles(processedHtml);

		return processedHtml;
	}

	/**
	 * 处理图片，添加微信所需的属性
	 */
	private processImages(html: string): string {
		// 微信公众号图片需要特定处理
		// 1. 添加data-src属性
		// 2. 确保图片有正确的样式和对齐方式
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有图片元素
			const images = doc.querySelectorAll("img");

			images.forEach((img) => {
				const src = img.getAttribute("src");
				if (src) {
					// 设置data-src属性，微信编辑器需要
					img.setAttribute("data-src", src);

					// 设置图片默认样式
					if (!img.hasAttribute("style")) {
						img.setAttribute(
							"style",
							"max-width: 100%; height: auto;"
						);
					}

					// 确保图片居中显示
					const parent = img.parentElement;
					if (parent && parent.tagName !== "CENTER") {
						parent.style.textAlign = "center";
					}
				}
			});
			// 转回字符串
			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理图片时出错:", error);
			return html;
		}
	}

	/**
	 * 处理链接，根据设置转换为脚注或其他格式
	 */
	private processLinks(html: string): string {
		// 如果不需要处理链接，直接返回
		if (this.currentSettings.linkFootnoteMode === "none") {
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

				// 判断是否需要转换此链接
				const shouldConvert =
					this.currentSettings.linkFootnoteMode === "all" ||
					(this.currentSettings.linkFootnoteMode === "non-wx" &&
						!href.includes("weixin.qq.com"));

				if (shouldConvert) {
					// 创建脚注标记
					const footnoteRef = document.createElement("sup");
					footnoteRef.textContent = `[${footnotes.length + 1}]`;
					footnoteRef.style.color = "#3370ff";

					// 替换链接为脚注引用
					link.after(footnoteRef);

					// 根据设置决定脚注内容格式
					let footnoteContent = "";
					if (this.currentSettings.linkDescriptionMode === "raw") {
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

	/**
	 * 处理代码块，确保在微信中正确显示
	 */
	private processCodeBlocks(html: string): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有代码块
			const codeBlocks = doc.querySelectorAll("pre code");

			codeBlocks.forEach((codeBlock) => {
				// 确保代码块有正确的微信样式
				const pre = codeBlock.parentElement;
				if (pre) {
					pre.style.background = "#f8f8f8";
					pre.style.borderRadius = "4px";
					pre.style.padding = "16px";
					pre.style.overflow = "auto";
					pre.style.fontSize = "14px";
					pre.style.lineHeight = "1.5";

					// 处理行号显示
					if (this.currentSettings.lineNumber) {
						const lines = codeBlock.innerHTML.split("\n");
						const numberedLines = lines
							.map(
								(line, index) =>
									`<span class="line-number">${
										index + 1
									}</span>${line}`
							)
							.join("\n");

						// 添加行号样式
						const style = document.createElement("style");
						style.textContent = `
              .line-number {
                display: inline-block;
                width: 2em;
                text-align: right;
                padding-right: 1em;
                margin-right: 1em;
                color: #999;
                border-right: 1px solid #ddd;
              }
            `;
						pre.appendChild(style);

						// 更新代码块内容
						codeBlock.innerHTML = numberedLines;
					}
				}
			});

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理代码块时出错:", error);
			return html;
		}
	}

	/**
	 * 处理表格，确保在微信中正确显示
	 */
	private processTables(html: string): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有表格
			const tables = doc.querySelectorAll("table");

			tables.forEach((table) => {
				// 确保表格有正确的微信样式
				table.style.borderCollapse = "collapse";
				table.style.width = "100%";
				table.style.marginBottom = "20px";

				// 处理表头
				const thead = table.querySelector("thead");
				if (thead) {
					const headerCells = thead.querySelectorAll("th");
					headerCells.forEach((cell) => {
						cell.style.backgroundColor = "#f2f2f2";
						cell.style.padding = "8px";
						cell.style.borderBottom = "2px solid #ddd";
						cell.style.textAlign = "left";
						cell.style.fontWeight = "bold";
					});
				}

				// 处理表格单元格
				const cells = table.querySelectorAll("td");
				cells.forEach((cell, index) => {
					cell.style.padding = "8px";
					cell.style.border = "1px solid #ddd";
					cell.style.textAlign = "left";

					// 隔行变色
					if (index % 2 === 0) {
						const row = cell.parentElement;
						if (row) {
							row.style.backgroundColor = "#f9f9f9";
						}
					}
				});
			});

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理表格时出错:", error);
			return html;
		}
	}

	/**
	 * 处理列表，确保嵌套列表在微信中正确显示
	 * 微信公众号编辑器对嵌套列表支持不好，需要特殊处理
	 */
	private processLists(html: string): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 找到所有的列表
			const allLists = Array.from(doc.querySelectorAll("ul, ol"));
			if (allLists.length === 0) {
				return html; // 没有列表，直接返回
			}

			// 找到所有顶级列表（不在其他列表内的列表）
			const topLevelLists = allLists.filter((list) => {
				const parent = list.parentElement;
				return (
					parent &&
					parent.tagName !== "LI" &&
					parent.tagName !== "UL" &&
					parent.tagName !== "OL"
				);
			});

			// 创建一个新容器来接收转换后的列表
			const container = document.createElement("div");

			const themeAccentColor = this.getThemeColor();

			// 处理每个顶级列表
			for (const list of topLevelLists) {
				// 转换原列表为微信兼容格式
				const newList = this.transformList(
					list as HTMLUListElement,
					0,
					themeAccentColor
				);

				// 找到原列表的位置
				const parent = list.parentElement;
				if (parent) {
					// 使用转换后的列表替换原列表
					parent.replaceChild(newList, list);
				} else {
					// 添加到容器
					container.appendChild(newList);
				}
			}

			// 如果有直接添加到容器的列表，返回容器内容
			if (container.children.length > 0) {
				return container.innerHTML;
			}

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理列表时出错:", error);
			return html;
		}
	}

	/**
	 * 处理引用块（blockquote），确保在微信中正确显示
	 * 微信公众号编辑器对blockquote有固定样式，需要强制设置样式以覆盖
	 */
	private processBlockquotes(html: string): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 获取主题色
			const themeColor = this.getThemeColor();

			// 获取所有引用块
			const blockquotes = doc.querySelectorAll("blockquote");
			if (blockquotes.length === 0) {
				return html; // 没有引用块，直接返回
			}

			// 逻辑处理每个引用块
			blockquotes.forEach((blockquote) => {
				// 重新设置引用块的样式，强制覆盖微信默认样式
				blockquote.setAttribute(
					"style",
					`
					padding-left: 10px !important; 
					border-left: 3px solid ${themeColor} !important; 
					color: rgba(0, 0, 0, 0.6) !important; 
					font-size: 15px !important; 
					padding-top: 4px !important; 
					margin: 1em 0 !important; 
					text-indent: 0 !important;
				`
				);

				// 处理引用块内的段落
				const paragraphs = blockquote.querySelectorAll("p");
				paragraphs.forEach((p) => {
					// 确保段落的文本颜色与引用块一致
					p.style.color = "rgba(0, 0, 0, 0.6)";
					p.style.margin = "0";
				});
			});

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理引用块时出错:", error);
			return html;
		}
	}

	protected getThemeColor() {
		// 获取设置
		const settings = NMPSettings.getInstance();

		// 动态获取当前主题颜色
		let themeAccentColor: string;

		// 如果启用了自定义主题色，使用用户设置的颜色
		if (settings.enableThemeColor) {
			themeAccentColor = settings.themeColor || "#7852ee";
			logger.debug("使用自定义主题色：", themeAccentColor);
		} else {
			// 从当前激活的DOM中获取实际使用的主题颜色
			// 尝试获取主题的primary-red变量
			try {
				// 尝试从文档中获取计算后的CSS变量值
				const testElement = document.createElement("div");
				testElement.style.display = "none";
				testElement.className = "note-to-mp";
				document.body.appendChild(testElement);

				// 获取计算后的样式
				const computedStyle = window.getComputedStyle(testElement);
				// todo: 可否实现复制后保留原样式
				const primaryColor = computedStyle
					.getPropertyValue("--primary-color")
					.trim();
				// || computedStyle.getPropertyValue('--primary-red').trim();

				logger.debug("获取到的主题色：", primaryColor);
				if (primaryColor) {
					themeAccentColor = primaryColor;
				} else {
					// 如果无法获取，默认使用手工川主题的红色
					themeAccentColor = "#E31937";
				}

				// 清理测试元素
				document.body.removeChild(testElement);
			} catch (e) {
				// 如果出错，回退到默认值
				themeAccentColor = "#E31937";
				logger.error("无法获取主题色变量，使用默认值", e);
			}

			logger.debug("使用主题中的颜色：", themeAccentColor);
		}

		return themeAccentColor;
	}

	/**
	 * 转换列表为微信兼容格式
	 * @param list 要转换的列表元素
	 */
	private transformList(
		list: HTMLUListElement | HTMLOListElement,
		level = 0,
		themeAccentColor = ""
	): HTMLUListElement {
		const isOrdered = list.tagName.toLowerCase() === "ol";

		// 创建新的微信格式列表
		const newList = document.createElement(isOrdered ? "ol" : "ul");

		// 设置微信所需的列表样式
		newList.className = "list-paddingleft-1";

		// 获取设置
		const settings = NMPSettings.getInstance();

		// 针对不同级别设置不同的样式
		let listStyleType;
		if (isOrdered) {
			listStyleType = "decimal"; // 数字导航符号
		} else {
			switch (level) {
				case 0:
					listStyleType = "square";
					break; // 外层列表用空心圆
				case 1:
					listStyleType = "disc";
					break; // 中间层用实心圆
				default:
					listStyleType = "circle";
					break; // 最内层用方块
			}
		}

		// 微信文章中的列表设置
		newList.style.listStyleType = listStyleType;
		newList.style.padding = "0 0 0 1em";
		newList.style.margin = "0.5em 0";

		// 添加自定义属性，用于在处理列表项时应用颜色
		// newList.setAttribute('data-theme-color', themeAccentColor);

		// 存储嵌套列表，稍后处理
		interface NestedListInfo {
			parentItem: HTMLLIElement;
			list: HTMLUListElement | HTMLOListElement;
		}
		const nestedLists: NestedListInfo[] = [];

		// 处理列表项
		const listItems = Array.from(list.querySelectorAll(":scope > li"));
		for (const item of listItems) {
			// 创建新的列表项
			const newItem = document.createElement("li");

			// 查找并存储任何嵌套列表
			const childLists = Array.from(
				item.querySelectorAll(":scope > ul, :scope > ol")
			);
			for (const childList of childLists) {
				nestedLists.push({
					parentItem: newItem,
					list: childList as HTMLUListElement | HTMLOListElement,
				});
				// 从原列表项中移除嵌套列表
				childList.remove();
			}

			// 为列表项符号设置颜色
			// 无论是否启用了自定义主题色，都需要设置颜色
			// 否则微信公众号中的列表标记将始终为默认黑色
			newItem.style.color = themeAccentColor; // 这会影响列表符号的颜色

			// 创建微信格式的内容容器
			const section = document.createElement("section");
			section.style.color = "#222222"; // 内容恢复为默认文本颜色

			// 获取列表项的文本内容
			section.innerHTML = item.innerHTML;

			// 添加到新列表项
			newItem.appendChild(section);
			newList.appendChild(newItem);
		}

		// 处理嵌套列表
		for (const { parentItem, list: childList } of nestedLists) {
			// 递归转换子列表
			const newChildList = this.transformList(
				childList,
				level + 1,
				themeAccentColor
			);

			// 在父列表项后添加嵌套列表直接作为父列表的子元素
			// 注意：微信编辑器要求嵌套列表不要放在父列表项内部
			const parentIndex = Array.from(newList.children).indexOf(
				parentItem
			);
			if (
				parentIndex !== -1 &&
				parentIndex < newList.children.length - 1
			) {
				newList.insertBefore(
					newChildList,
					newList.children[parentIndex + 1]
				);
			} else {
				newList.appendChild(newChildList);
			}
		}

		return newList;
	}

	/**
	 * 重写基类的 applyStyles 方法，为微信配置内联样式
	 * @param html HTML内容
	 * @param css CSS样式字符串 【css 只是个摆设，它直接从 html 拿的】
	 * @returns 应用样式后的HTML内容
	 */
	public processStyles(html: string): string {
		try {
			// 创建临时DOM元素
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;
			document.body.appendChild(tempDiv);

			// 添加样式元素
			const styleEl = document.createElement('style');
			styleEl.textContent = '';
			tempDiv.appendChild(styleEl);
			logger.info(colors.yellow("为微信内容添加样式元素"));

			// 获取所有非样式元素
			const allElements = tempDiv.querySelectorAll("*:not(style)");
			logger.info(colors.yellow("处理微信样式元素数量:"), allElements.length);

			// 应用计算样式到每个元素
			for (let i = 0; i < allElements.length; i++) {
				const el = allElements[i] as HTMLElement;
				const computedStyle = window.getComputedStyle(el);
				let inlineStyles = "";

				// 提取关键样式属性
				const properties = [
					"color",
					"background-color",
					"font-family",
					"font-size",
					"font-weight",
					"text-align",
					"line-height",
					"margin",
					"padding",
					"border",
					"border-radius",

					// todo: 不知道加这个有没有效果 （参考： [微信公众号图文 HTML/CSS 支持情况解析](https://www.axtonliu.ai/newsletters/ai-2/posts/wechat-article-html-css-support)）
					"position",
				];

				for (const prop of properties) {
					const value = computedStyle.getPropertyValue(prop);
					if (value && value !== "" && value !== "none") {
						// 微信公众号支持的字体比较有限
						if (prop === "font-family") {
							inlineStyles += `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif; `;
							continue;
						}

						// 处理过大或过小的字体
						if (prop === "font-size") {
							const fontSize = parseInt(value);
							if (fontSize > 40) {
								inlineStyles += `font-size: 40px; `;
								continue;
							} else if (fontSize < 12 && el.tagName !== "SUP" && el.tagName !== "SUB") {
								inlineStyles += `font-size: 12px; `;
								continue;
							}
						}

						inlineStyles += `${prop}: ${value}; `;
					}
				}

				// 应用内联样式
				if (inlineStyles) {
					const existingStyle = el.getAttribute("style") || "";
					el.setAttribute("style", existingStyle + inlineStyles);
				}
			}

			// 移除所有 style 标签，微信不支持
			const styleElements = tempDiv.querySelectorAll('style');
			styleElements.forEach(el => el.remove());

			// 获取处理后的HTML并清理临时元素
			const result = tempDiv.innerHTML;
			document.body.removeChild(tempDiv);

			logger.info(colors.yellow("应用内联样式后的微信内容:"), result.substring(0, 200) + "...");
			return result;
		} catch (error) {
			logger.error("应用微信样式时出错:", error);
			return html;
		}
	}


}
