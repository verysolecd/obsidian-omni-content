/*
 * Copyright (c) 2025 Mark Shawn
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

import { Marked } from "marked";
import { NMPSettings } from "src/settings";
import { App, Vault } from "obsidian";
import AssetsManager from "../assets";
import { Extension, MDRendererCallback } from "./extension";
import { CalloutRenderer } from "./callouts";
import { CodeHighlight } from "./code-highlight";
import { CodeRenderer } from "./code";
import { EmbedBlockMark } from "./embed-block-mark";
import { SVGIcon } from "./icons";
import { LinkRenderer } from "./link";
import { LocalFile } from "./local-file";
import { MathRenderer } from "./math";
import { TextHighlight } from "./text-highlight";

const markedOptiones = {
	gfm: true,
	breaks: true,
};

const customRenderer = {
	heading(text: string, level: number, raw: string): string {
		// ignore IDs
		return `<h${level}><span class="prefix"></span><span class="content">${text}</span><span class="suffix"></span></h${level}>`;
	},
	hr(): string {
		return "<hr>";
	},
	list(body: string, ordered: boolean, start: number | ""): string {
		const type = ordered ? "ol" : "ul";
		const startatt = ordered && start !== 1 ? ' start="' + start + '"' : "";
		
		// WeChat compatible list rendering
		// Check if we're rendering for WeChat (this will be set before markdown parsing)
		if (isWeChatMode) {
			// Process the body to identify and handle nested lists in WeChat format
			// This will be applied during post-processing phase
			return `<${type}${startatt} class="wechat-list" data-level="1">${body}</${type}>`;
		}
		
		return `<${type}${startatt}>${body}</${type}>`;
	},
	listitem(text: string, task: boolean, checked: boolean): string {
		// Add a marker to identify if this list item contains nested lists
		const hasNestedList = text.includes('<ul') || text.includes('<ol');
		
		if (isWeChatMode && hasNestedList) {
			// For WeChat, we'll extract the nested list in post-processing
			// Mark the list item so we can identify it later
			return `<li data-has-nested="true">${text}</li>`;
		}
		
		return `<li>${text}</li>`;
	},
};

// Flag to indicate if we're rendering for WeChat
let isWeChatMode = false;

// Helper to set rendering mode
export function setWeChatMode(enabled: boolean) {
	isWeChatMode = enabled;
}

export class MarkedParser {
	extensions: Extension[] = [];
	marked: Marked;
	app: App;
	vault: Vault;

	constructor(app: App, callback: MDRendererCallback) {
		this.app = app;
		this.vault = app.vault;

		const settings = NMPSettings.getInstance();
		const assetsManager = AssetsManager.getInstance();

		this.extensions.push(
			new LocalFile(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CalloutRenderer(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CodeHighlight(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new EmbedBlockMark(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new SVGIcon(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new LinkRenderer(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new TextHighlight(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CodeRenderer(app, settings, assetsManager, callback)
		);
		if (settings.isAuthKeyVaild()) {
			this.extensions.push(
				new MathRenderer(app, settings, assetsManager, callback)
			);
		}
	}

	async buildMarked() {
		this.marked = new Marked();
		this.marked.use(markedOptiones);
		for (const ext of this.extensions) {
			this.marked.use(ext.markedExtension());
			ext.marked = this.marked;
			await ext.prepare();
		}
		this.marked.use({ renderer: customRenderer });
	}

	async prepare() {
		this.extensions.forEach(async (ext) => await ext.prepare());
	}

	async postprocess(html: string) {
		let result = html;
		for (const ext of this.extensions) {
			result = await ext.postprocess(result);
		}
		
		// Process WeChat lists if in WeChat mode
		if (isWeChatMode) {
			result = this.processWeChatLists(result);
		}
		
		return result;
	}
	
	/**
	 * Process nested lists to make them compatible with WeChat editor
	 * WeChat requires a specific structure for nested lists to display correctly
	 */
	processWeChatLists(html: string): string {
		// 创建一个临时DOM元素来操作HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = html;
		
		// 处理所有的列表
		this.processListsInContainer(tempDiv, 1);
		
		return tempDiv.innerHTML;
	}
	
	/**
	 * 递归处理容器中的所有列表
	 * @param container - 包含列表的容器元素
	 * @param level - 当前列表层级
	 */
	processListsInContainer(container: HTMLElement, level: number) {
		// 先获取所有的顶级列表
		const lists = container.querySelectorAll(':scope > ul, :scope > ol');
		lists.forEach(list => {
			// 添加微信所需的样式属性
			list.classList.add('list-paddingleft-1');
			list.classList.add('wechat-list');
			list.setAttribute('data-level', level.toString());
			
			// 根据层级设置不同的列表样式
			let listStyleType = 'disc';
			// 缩进量随层级变化
			// 缩小缩进值以解决过多缩进问题
			// const marginLeft = level > 1 ? '0.5em' : '0.7em';
			const marginLeft =  0;
			if (level > 1) {
				listStyleType = 'square';
			}

			list.setAttribute('style', 
				`list-style-type: ${listStyleType}; box-sizing: border-box; ` +
				`-webkit-font-smoothing: antialiased; text-rendering: optimizelegibility; `
				//  +`margin-left: ${marginLeft} !important; padding: 0px !important;`
			);
			
			// 处理列表中的每个项目
			this.processListItems(list as HTMLElement, level);
		});
	}
	
	/**
	 * 处理列表中的各个列表项
	 * @param list - 列表元素
	 * @param level - 当前列表层级
	 */
	processListItems(list: HTMLElement, level: number) {
		// 处理所有的列表项
		const items = list.querySelectorAll(':scope > li');
		
		// 保存需要处理的嵌套列表
		const allNestedLists: {list: HTMLElement, parentItem: HTMLElement, level: number}[] = [];
		
		// 先处理所有列表项的文本部分
		items.forEach(item => {
			// 为列表项添加样式
			item.setAttribute('style', 
				'box-sizing: border-box; -webkit-font-smoothing: antialiased; ' +
				'text-rendering: optimizelegibility;');
			
			// 检查列表项是否包含嵌套列表
			const nestedLists = Array.from(item.querySelectorAll(':scope > ul, :scope > ol'));
			
			// 如果有嵌套列表，收集它们供后面处理
			if (nestedLists.length > 0) {
				nestedLists.forEach(nestedList => {
					// 先保存待处理的嵌套列表
					allNestedLists.push({
						list: nestedList.cloneNode(true) as HTMLElement,
						parentItem: item as HTMLElement,
						level: level + 1
					});
					
					// 从原列表项中移除嵌套列表
					nestedList.remove();
				});
			}
			
			// 准备列表项的文本内容
			let textContent = item.innerHTML;
			
			// 为列表项创建微信所需的结构
			const section = document.createElement('section');
			const span = document.createElement('span');
			span.setAttribute('leaf', '');
			span.innerHTML = textContent.trim();
			
			// 清空列表项并添加格式化的内容
			item.innerHTML = '';
			section.appendChild(span);
			item.appendChild(section);
		});
		
		// 处理所有收集到的嵌套列表
		allNestedLists.forEach(({list: nestedList, parentItem, level: nestedLevel}) => {
			// 为嵌套列表设置样式
			nestedList.setAttribute('style', `
				list-style-type: ${nestedLevel > 1 ? 'square' : 'disc'};
				box-sizing: border-box;
				-webkit-font-smoothing: antialiased;
				text-rendering: optimizelegibility;
				// margin-left: 0px !important;
				// padding: 0px !important;
			`);
			nestedList.classList.add('list-paddingleft-1');
			nestedList.classList.add('wechat-list');
			nestedList.setAttribute('data-level', nestedLevel.toString());
			
			// 递归处理嵌套列表中的列表项
			this.processListItems(nestedList as HTMLElement, nestedLevel);
			
			// 将嵌套列表插入到原列表项后面
			const nextSibling = parentItem.nextElementSibling;
			if (nextSibling) {
				list.insertBefore(nestedList, nextSibling);
			} else {
				list.appendChild(nestedList);
			}
		});
	}

	async parse(content: string) {
		if (!this.marked) await this.buildMarked();
		await this.prepare();
		let html = await this.marked.parse(content);
		html = await this.postprocess(html);
		return html;
	}
}
