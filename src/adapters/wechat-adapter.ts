import {CardDataManager} from "../markdown/code";
import {NMPSettings} from "../settings";
import {logger} from "../utils";
import {ContentAdapter} from "./content-adapter";

/**
 * 微信公众号适配器 - 处理微信公众号特定的格式要求
 */
export class WeChatAdapter implements ContentAdapter {
	/**
	 * 适配微信公众号内容
	 * @param html 原始HTML内容
	 * @param settings 插件设置
	 * @returns 适配后的HTML内容
	 */
	adaptContent(html: string, settings: NMPSettings): string {
		logger.debug("应用微信公众号适配器处理HTML");

		let processedHtml = html;

		// 微信特定处理开始

		// 1. 处理图片（微信要求图片有特定的数据属性）
		processedHtml = this.processImages(processedHtml);

		// 2. 处理链接（根据设置转换为脚注或其他格式）
		processedHtml = this.processLinks(processedHtml, settings);

		// 3. 处理列表（微信公众号对列表有特殊要求）
		// processedHtml = this.processLists(processedHtml);

		// 4. 处理代码块（确保代码显示正确）
		processedHtml = this.processCodeBlocks(processedHtml, settings);

		// 5. 确保表格正确显示
		processedHtml = this.processTables(processedHtml);

		// 6. 处理微信公众号中的字体和样式限制
		processedHtml = this.processStyles(processedHtml);

		// 最后，恢复代码卡片
		processedHtml = CardDataManager.getInstance().restoreCard(processedHtml);

		logger.debug("微信适配处理完成");
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
			const doc = parser.parseFromString(html, 'text/html');

			// 查找所有图片元素
			const images = doc.querySelectorAll('img');

			images.forEach(img => {
				const src = img.getAttribute('src');
				if (src) {
					// 设置data-src属性，微信编辑器需要
					img.setAttribute('data-src', src);

					// 设置图片默认样式
					if (!img.hasAttribute('style')) {
						img.setAttribute('style', 'max-width: 100%; height: auto;');
					}

					// 确保图片居中显示
					const parent = img.parentElement;
					if (parent && parent.tagName !== 'CENTER') {
						parent.style.textAlign = 'center';
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
	private processLinks(html: string, settings: NMPSettings): string {
		// 如果不需要处理链接，直接返回
		if (settings.linkFootnoteMode === 'none') {
			return html;
		}

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			// 查找所有链接
			const links = doc.querySelectorAll('a');
			const footnotes: string[] = [];

			links.forEach(link => {
				const href = link.getAttribute('href');
				if (!href) return;

				// 判断是否需要转换此链接
				const shouldConvert = settings.linkFootnoteMode === 'all' ||
					(settings.linkFootnoteMode === 'non-wx' && !href.includes('weixin.qq.com'));

				if (shouldConvert) {
					// 创建脚注标记
					const footnoteRef = document.createElement('sup');
					footnoteRef.textContent = `[${footnotes.length + 1}]`;
					footnoteRef.style.color = '#3370ff';

					// 替换链接为脚注引用
					link.after(footnoteRef);

					// 根据设置决定脚注内容格式
					let footnoteContent = '';
					if (settings.linkDescriptionMode === 'raw') {
						footnoteContent = `[${footnotes.length + 1}] ${link.textContent}: ${href}`;
					} else {
						footnoteContent = `[${footnotes.length + 1}] ${href}`;
					}

					footnotes.push(footnoteContent);

					// 移除链接标签，保留内部文本
					const linkText = link.textContent;
					link.replaceWith(linkText || '');
				}
			});

			// 如果有脚注，添加到文档末尾
			if (footnotes.length > 0) {
				const hr = document.createElement('hr');
				const footnoteSection = document.createElement('section');
				footnoteSection.style.fontSize = '14px';
				footnoteSection.style.color = '#888';
				footnoteSection.style.marginTop = '30px';

				footnotes.forEach(note => {
					const p = document.createElement('p');
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
	private processCodeBlocks(html: string, settings: NMPSettings): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			// 查找所有代码块
			const codeBlocks = doc.querySelectorAll('pre code');

			codeBlocks.forEach(codeBlock => {
				// 确保代码块有正确的微信样式
				const pre = codeBlock.parentElement;
				if (pre) {
					pre.style.background = '#f8f8f8';
					pre.style.borderRadius = '4px';
					pre.style.padding = '16px';
					pre.style.overflow = 'auto';
					pre.style.fontSize = '14px';
					pre.style.lineHeight = '1.5';

					// 处理行号显示
					if (settings.lineNumber) {
						const lines = codeBlock.innerHTML.split('\n');
						const numberedLines = lines.map((line, index) =>
							`<span class="line-number">${index + 1}</span>${line}`
						).join('\n');

						// 添加行号样式
						const style = document.createElement('style');
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
			const doc = parser.parseFromString(html, 'text/html');

			// 查找所有表格
			const tables = doc.querySelectorAll('table');

			tables.forEach(table => {
				// 确保表格有正确的微信样式
				table.style.borderCollapse = 'collapse';
				table.style.width = '100%';
				table.style.marginBottom = '20px';

				// 处理表头
				const thead = table.querySelector('thead');
				if (thead) {
					const headerCells = thead.querySelectorAll('th');
					headerCells.forEach(cell => {
						cell.style.backgroundColor = '#f2f2f2';
						cell.style.padding = '8px';
						cell.style.borderBottom = '2px solid #ddd';
						cell.style.textAlign = 'left';
						cell.style.fontWeight = 'bold';
					});
				}

				// 处理表格单元格
				const cells = table.querySelectorAll('td');
				cells.forEach((cell, index) => {
					cell.style.padding = '8px';
					cell.style.border = '1px solid #ddd';
					cell.style.textAlign = 'left';

					// 隔行变色
					if (index % 2 === 0) {
						const row = cell.parentElement;
						if (row) {
							row.style.backgroundColor = '#f9f9f9';
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
			const doc = parser.parseFromString(html, 'text/html');
			
			// 首先添加特殊标记来跟踪列表层级关系
			this.markListHierarchy(doc);
			
			// 将列表转换为微信兼容的格式
			const processedContent = this.transformListsForWeChat(doc);
			
			return processedContent;
		} catch (error) {
			logger.error("处理列表时出错:", error);
			return html;
		}
	}
	
	/**
	 * 递归处理列表项及其子列表
	 * @param list 当前列表元素
	 * @param isOrdered 是否为有序列表
	 * @param level 嵌套级别（用于样式调整）
	 */
	/**
	 * 标记列表层级关系，添加特殊属性来跟踪列表项的父子关系
	 * @param doc 文档对象
	 */
	private markListHierarchy(doc: Document): void {
		// 首先标记所有列表项的元素ID和父元素ID
		let itemId = 0;
		
		// 查找所有顶层列表
		const topLists = Array.from(doc.querySelectorAll('ul, ol')).filter(list => {
			const parent = list.parentElement;
			return !parent || (parent.tagName !== 'LI' && !parent.closest('li > ul, li > ol'));
		});
		
		// 递归标记列表项
		const markListItems = (listElement: Element, parentId: string | null = null, level = 0) => {
			const isOrdered = listElement.tagName === 'OL';
			const listItems = listElement.querySelectorAll(':scope > li');
			
			// 标记列表类型和层级
			listElement.setAttribute('data-wx-list-level', level.toString());
			listElement.setAttribute('data-wx-list-type', isOrdered ? 'ordered' : 'unordered');
			
			// 遍历列表项
			listItems.forEach((item, index) => {
				// 给每个列表项分配唯一ID
				const currentId = `li-${itemId++}`;
				item.setAttribute('data-wx-id', currentId);
				
				// 记录父子关系
				if (parentId) {
					item.setAttribute('data-wx-parent-id', parentId);
				}
				
				// 记录子列表类型属性
				item.setAttribute('data-wx-list-level', level.toString());
				item.setAttribute('data-wx-list-index', index.toString());
				item.setAttribute('data-wx-list-type', isOrdered ? 'ordered' : 'unordered');
				
				// 处理嵌套列表
				const nestedLists = item.querySelectorAll(':scope > ul, :scope > ol');
				if (nestedLists.length > 0) {
					// 记录该项有子列表
					item.setAttribute('data-wx-has-sublist', 'true');
					
					// 递归处理子列表
					nestedLists.forEach(nestedList => {
						markListItems(nestedList, currentId, level + 1);
					});
				}
			});
		};
		
		// 为每个顶层列表标记层级关系
		topLists.forEach(list => markListItems(list));
	}
	
	/**
	 * 将列表项的内容包裹在 section 标签内，这是微信编辑器的特殊需求
	 */
	/**
	 * 将标记过的列表转换为微信格式
	 * @param doc 原始文档
	 * @returns 适合微信编辑器的 HTML 内容
	 */
	private transformListsForWeChat(doc: Document): string {
		// 先找到所有列表
		const allLists = doc.querySelectorAll('ul, ol');
		
		// 首先处理所有列表项的内容，将内容包裹进 section
		const allListItems = doc.querySelectorAll('li');
		allListItems.forEach(item => {
			this.wrapListItemContentInSection(item);
		});
		
		// 对所有列表应用微信样式
		allLists.forEach(list => {
			// 获取层级信息
			const level = parseInt(list.getAttribute('data-wx-list-level') || '0');
			const isOrdered = list.getAttribute('data-wx-list-type') === 'ordered';
			
			// 设置列表样式
			(list as HTMLElement).style.margin = level === 0 ? '8px 0' : `8px 0 8px ${level * 2}em`;
			(list as HTMLElement).style.paddingLeft = level === 0 ? '20px' : '0';
			(list as HTMLElement).style.listStylePosition = 'outside';
			
			// 根据层级设置列表标记样式
			if (isOrdered) {
				switch (level) {
					case 0: (list as HTMLElement).style.listStyleType = 'decimal'; break; // 数字
					case 1: (list as HTMLElement).style.listStyleType = 'lower-alpha'; break; // 小写字母
					case 2: (list as HTMLElement).style.listStyleType = 'lower-roman'; break; // 小写罗马数字
					default: (list as HTMLElement).style.listStyleType = 'decimal'; // 默认数字
				}
			} else {
				switch (level) {
					case 0: (list as HTMLElement).style.listStyleType = 'disc'; break; // 实心圆
					case 1: (list as HTMLElement).style.listStyleType = 'circle'; break; // 空心圆
					case 2: (list as HTMLElement).style.listStyleType = 'square'; break; // 方块
					default: (list as HTMLElement).style.listStyleType = 'disc'; // 默认实心圆
				}
			}
			
			// 添加微信特有的类
			list.classList.add('list-paddingleft-1');
			
			// 处理列表项
			const items = list.querySelectorAll(':scope > li');
			items.forEach(item => {
				// 设置列表项样式
				(item as HTMLElement).style.margin = '6px 0';
				(item as HTMLElement).style.textIndent = '0';
				
				// 设置列表项标记样式
				if (isOrdered) {
					switch (level) {
						case 0: (item as HTMLElement).style.listStyleType = 'decimal'; break; // 数字
						case 1: (item as HTMLElement).style.listStyleType = 'lower-alpha'; break; // 小写字母
						case 2: (item as HTMLElement).style.listStyleType = 'lower-roman'; break; // 小写罗马数字
						default: (item as HTMLElement).style.listStyleType = 'decimal'; // 默认数字
					}
				} else {
					switch (level) {
						case 0: (item as HTMLElement).style.listStyleType = 'disc'; break; // 实心圆
						case 1: (item as HTMLElement).style.listStyleType = 'circle'; break; // 空心圆
						case 2: (item as HTMLElement).style.listStyleType = 'square'; break; // 方块
						default: (item as HTMLElement).style.listStyleType = 'disc'; // 默认实心圆
					}
				}
			});
		});
		
		// 重新排序嵌套列表，确保它们以正确的顺序显示
		this.reorderNestedLists(doc);
		
		// 移除所有临时标记属性
		doc.querySelectorAll('[data-wx-id], [data-wx-parent-id], [data-wx-list-level], [data-wx-list-type], [data-wx-list-index], [data-wx-has-sublist]')
			.forEach(el => {
				el.removeAttribute('data-wx-id');
				el.removeAttribute('data-wx-parent-id');
				el.removeAttribute('data-wx-list-level');
				el.removeAttribute('data-wx-list-type');
				el.removeAttribute('data-wx-list-index');
				el.removeAttribute('data-wx-has-sublist');
			});
		
		return doc.body.innerHTML;
	}
	
	/**
	 * 重新排序嵌套列表，保证层级关系正确
	 * @param doc 文档对象
	 */
	private reorderNestedLists(doc: Document): void {
		// 找到所有具有子列表的列表项
		const itemsWithSublists = Array.from(doc.querySelectorAll('li[data-wx-has-sublist]'));
		
		// 按层级从低到高排序，确保我们先处理深层列表
		itemsWithSublists.sort((a, b) => {
			const levelA = parseInt(a.getAttribute('data-wx-list-level') || '0');
			const levelB = parseInt(b.getAttribute('data-wx-list-level') || '0');
			return levelB - levelA; // 降序排列，先处理深层的
		});
		
		// 处理每个具有子列表的项
		itemsWithSublists.forEach(item => {
			const parentId = item.getAttribute('data-wx-id');
			if (!parentId) return;
			
			// 找到该项的所有子列表
			const childLists = Array.from(doc.querySelectorAll(`ul[data-wx-parent-id="${parentId}"], ol[data-wx-parent-id="${parentId}"]`));
			if (childLists.length === 0) return;
			
			// 查找该列表项所属的列表
			const parentList = item.parentElement;
			if (!parentList) return;
			
			// 使用正确的层级关系重新布局列表
			this.rebuildListStructure(item, childLists, parentList);
		});
	}
	
	/**
	 * 重建列表结构，保证子列表正确放置
	 * @param parentItem 父列表项
	 * @param childLists 子列表数组
	 * @param parentList 父列表元素
	 */
	private rebuildListStructure(parentItem: Element, childLists: Element[], parentList: Element): void {
		// 获取父项的索引
		const itemIndex = Array.from(parentList.children).indexOf(parentItem);
		
		// 确保列表是有序的
		childLists.sort((a, b) => {
			const indexA = parseInt(a.getAttribute('data-wx-list-index') || '0');
			const indexB = parseInt(b.getAttribute('data-wx-list-index') || '0');
			return indexA - indexB;
		});
		
		// 在当前位置处理所有子列表
		let insertionPoint = itemIndex + 1;
		childLists.forEach(childList => {
			// 如果在指定的位置有节点，就插入到该节点前面
			if (parentList.children[insertionPoint]) {
				parentList.insertBefore(childList, parentList.children[insertionPoint]);
			} else {
				// 否则新增到最后
				parentList.appendChild(childList);
			}
			insertionPoint++;
		});
	}
	
	/**
	 * 将列表项的内容包裹在 section 标签内，这是微信编辑器的特殊需求
	 */
	private wrapListItemContentInSection(listItem: Element): void {
		// 已经有 section 就不需要再包裹
		if (listItem.querySelector(':scope > section')) {
			return;
		}
		
		// 创建 section 元素
		const section = document.createElement('section');
		
		// 将除了嵌套列表外的内容移动到 section 内
		while (listItem.firstChild) {
			const child = listItem.firstChild;
			
			// 如果是嵌套列表，我们不移动它，留到后面处理
			if (child.nodeName === 'UL' || child.nodeName === 'OL') {
				break;
			}
			
			// 将非列表内容移动到 section
			section.appendChild(child);
		}
		
		// 确保内容非空
		if (!section.hasChildNodes()) {
			// 如果没有内容（可能只有嵌套列表），添加一个空白字符
			const span = document.createElement('span');
			span.setAttribute('leaf', '');
			span.textContent = '\u00a0'; // 不断行空格
			section.appendChild(span);
		} else {
			// 确保所有文本节点都包裹在 span 元素内
			Array.from(section.childNodes).forEach(child => {
				if (child.nodeType === Node.TEXT_NODE) {
					const span = document.createElement('span');
					span.setAttribute('leaf', '');
					span.textContent = child.textContent || '';
					child.replaceWith(span);
				}
			});
		}
		
		// 将包裹好的 section 添加到列表项的开头
		listItem.prepend(section);
	}
	
	/**
	 * 处理样式，确保符合微信公众号的样式限制
	 */
	private processStyles(html: string): string {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			// 处理字体大小和样式
			const elements = doc.querySelectorAll('*');
			elements.forEach(el => {
				// 需要将 Element 类型转换为 HTMLElement 才能访问 style 属性
				const htmlEl = el as HTMLElement;
				const style = window.getComputedStyle(htmlEl);

				// 微信公众号支持的字体比较有限
				if (style.fontFamily) {
					htmlEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif';
				}

				// 处理过大或过小的字体
				const fontSize = parseInt(style.fontSize);
				if (fontSize > 40) {
					htmlEl.style.fontSize = '40px';
				} else if (fontSize < 12 && htmlEl.tagName !== 'SUP' && htmlEl.tagName !== 'SUB') {
					htmlEl.style.fontSize = '12px';
				}
			});

			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理样式时出错:", error);
			return html;
		}
	}
}
