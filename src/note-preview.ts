import {
	apiVersion,
	EventRef,
	ItemView,
	Notice,
	Platform,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { FRONT_MATTER_REGEX, VIEW_TYPE_NOTE_PREVIEW } from "src/constants";
import { IProcessPlugin } from "src/rehype-plugins/base-process";

import AssetsManager from "./assets";
import InlineCSS from "./inline-css";
import { CardDataManager } from "./remark-plugins/code";
import { MDRendererCallback } from "./remark-plugins/extension";
import { ExtensionManager } from "./remark-plugins/extension-manager";
import type { Extension, ExtensionMetaConfig } from "./remark-plugins/extension";
import { LocalImageManager } from "./remark-plugins/local-file";
import { MarkedParser } from "./remark-plugins/parser";
// 移除平台适配器导入，使用插件管理器替代
import { initializePlugins, PluginManager } from "./rehype-plugins";
import { NMPSettings } from "./settings";
import TemplateManager from "./template-manager";
import { logger, uevent } from "./utils";
import {
	DraftArticle,
	wxBatchGetMaterial,
	wxGetToken,
	wxUploadImage,
} from "./weixin-api";

export class NotePreview extends ItemView implements MDRendererCallback {
	mainDiv: HTMLDivElement;
	toolbar: HTMLDivElement;
	renderDiv: HTMLDivElement;
	articleDiv: HTMLDivElement;
	styleEl: HTMLElement;
	coverEl: HTMLInputElement;
	useDefaultCover: HTMLInputElement;
	useLocalCover: HTMLInputElement;
	msgView: HTMLDivElement;
	pluginListEl: HTMLDivElement;
	listeners: EventRef[];
	container: Element;
	settings: NMPSettings;
	assetsManager: AssetsManager;
	articleHTML: string;
	title: string;
	currentAppId: string;
	markedParser: MarkedParser;
	// 已移除平台类型，使用统一的插件管理

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.settings = NMPSettings.getInstance();
		this.assetsManager = AssetsManager.getInstance();
		this.markedParser = new MarkedParser(this.app, this);

		initializePlugins();
	}

	get currentTheme() {
		return this.settings.defaultStyle;
	}

	get currentHighlight() {
		return this.settings.defaultHighlight;
	}

	get workspace() {
		return this.app.workspace;
	}

	/**
	 * 构建工具栏
	 * @param parent 父容器元素
	 */
	buildToolbar(parent: HTMLDivElement) {
		// 创建专业化的工具栏
		this.toolbar = parent.createDiv({ cls: "preview-toolbar" });
		this.toolbar.addClasses(["modern-toolbar"]);
		this.toolbar.setAttribute(
			"style",
			"display: flex; flex-direction: column; height: 100%; overflow: hidden;"
		);

		// 1. 构建品牌区域
		this.buildBrandSection();

		// 2. 创建主工具栏容器
		const toolbarContainer = this.toolbar.createDiv({
			cls: "toolbar-container",
		});
		toolbarContainer.setAttribute("style", "flex: 1; overflow-y: auto;");

		// 3. 创建工具栏内容区域 - 单列垂直布局
		const toolbarContent = toolbarContainer.createDiv({
			cls: "toolbar-content toolbar-vertical",
		});
		toolbarContent.setAttribute(
			"style",
			"display: flex; flex-direction: column; padding: 10px;"
		);

		// 10. 构建操作按钮组
		this.buildActionButtons(toolbarContent);

		// 5. 构建手风琴组件容器
		const accordionContainer = toolbarContent.createDiv({
			cls: "accordion-container",
		});
		// 为手风琴容器添加基础样式
		accordionContainer.setAttr(
			"style",
			"width: 100%; display: flex; flex-direction: column; gap: 5px;"
		);

		// 8. 如果启用了样式UI，构建样式相关设置组件
		if (this.settings.showStyleUI) {
			this.buildBasicAccordionSection(
				accordionContainer,
				"样式设置",
				() => {
					const container = document.createElement("div");
					this.buildTemplateSelector(container);
					this.buildThemeSelector(container);
					this.buildHighlightSelector(container);
					this.buildThemeColorSelector(container);
					return container;
				}
			);
		}

		// 9. 构建Remark插件手风琴
		this.buildBasicAccordionSection(accordionContainer, "Remark 插件", () => {
			const container = document.createElement("div");
			this.buildRemarkPluginSection(container);
			return container;
		});

		// 10. 构建Rehype插件手风琴
		this.buildBasicAccordionSection(accordionContainer, "Rehype 插件", () => {
			const container = document.createElement("div");
			this.buildRehypePluginSection(container);
			return container;
		});

		// 11. 创建消息视图，但将其放在工具栏之外
		this.buildMsgView(parent);
	}

	getViewType() {
		return VIEW_TYPE_NOTE_PREVIEW;
	}

	getIcon() {
		return "clipboard-paste";
	}

	getDisplayText() {
		return "笔记预览";
	}

	async onOpen() {
		this.buildUI();
		this.listeners = [
			this.workspace.on("active-leaf-change", () => this.update()),
		];

		this.renderMarkdown();
		uevent("open");
	}

	async onClose() {
		this.listeners.forEach((listener) => this.workspace.offref(listener));
		uevent("close");
	}

	async update() {
		LocalImageManager.getInstance().cleanup();
		CardDataManager.getInstance().cleanup();
		this.renderMarkdown();
	}

	errorContent(error: any) {
		return (
			"<h1>渲染失败!</h1><br/>" +
			'如需帮助请前往&nbsp;&nbsp;<a href="https://github.com/sunbooshi/omni-content/issues">https://github.com/sunbooshi/omni-content/issues</a>&nbsp;&nbsp;反馈<br/><br/>' +
			"如果方便，请提供引发错误的完整Markdown内容。<br/><br/>" +
			"<br/>Obsidian版本：" +
			apiVersion +
			"<br/>错误信息：<br/>" +
			`${error}`
		);
	}

	async renderMarkdown() {
		this.articleDiv.innerHTML = await this.getArticleContent();
	}

	/**
	 * 只渲染文章内容，不更新工具栏
	 * 用于插件配置变更时快速更新预览
	 */
	async renderArticleOnly() {
		// 重新构建marked实例以应用remark插件状态变更
		this.markedParser.buildMarked();
		
		this.articleDiv.innerHTML = await this.getArticleContent();
		logger.debug("仅渲染文章内容，跳过工具栏更新");
	}

	async copyArticle() {
		const content = await this.getArticleContent();

		// 调试：分析最终的HTML内容
		console.log("=== 复制内容分析 ===");
		console.log("完整HTML长度:", content.length);
		
		// 提取代码块部分进行分析
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, "text/html");
		const codeBlocks = doc.querySelectorAll("pre, pre code, section.code-section");
		
		console.log("找到代码块数量:", codeBlocks.length);
		
		codeBlocks.forEach((block, index) => {
			console.log(`--- 代码块 ${index + 1} ---`);
			console.log("标签名:", block.tagName);
			console.log("类名:", block.className);
			console.log("内联样式:", block.getAttribute("style"));
			console.log("内容预览:", block.innerHTML.substring(0, 200));
			console.log("父元素:", block.parentElement?.tagName, block.parentElement?.className);
			console.log("父元素样式:", block.parentElement?.getAttribute("style"));
			
			// 详细分析换行符
			const html = block.innerHTML;
			const lines = html.split('\n');
			console.log("总行数:", lines.length);
			console.log("各行内容（带引号显示空行）:");
			lines.forEach((line, i) => {
				if (i < 5) { // 只显示前5行
					console.log(`  行${i}: "${line}"`);
				}
			});
			
			// 检查是否有高亮span元素
			const highlightSpans = block.querySelectorAll('[class*="hljs-"]');
			console.log("高亮span数量:", highlightSpans.length);
			if (highlightSpans.length > 0) {
				console.log("第一个高亮span:", highlightSpans[0].outerHTML.substring(0, 100));
			}
		});

		// 复制到剪贴板
		await navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([content], { type: "text/html" }),
			}),
		]);

		new Notice(`已复制到剪贴板！`);
	}

	/**
	 * 更新CSS变量 - 直接修改DOM中的CSS变量
	 * 这是让主题色变更立即生效的关键
	 */
	updateCSSVariables() {
		const noteContainer = this.articleDiv?.querySelector(
			".note-to-mp"
		) as HTMLElement;
		if (!noteContainer) {
			console.log("找不到.note-to-mp容器，无法更新CSS变量");
			return;
		}

		// 根据启用状态决定是否设置主题色变量
		if (this.settings.enableThemeColor) {
			// 设置自定义主题色
			noteContainer.style.setProperty(
				"--primary-color",
				this.settings.themeColor || "#7852ee"
			);
			console.log(`应用自定义主题色：${this.settings.themeColor}`);
		} else {
			// 删除自定义主题色，恢复使用主题文件中的颜色
			noteContainer.style.removeProperty("--primary-color");
			console.log("恢复使用主题文件中的颜色");
		}

		// 额外强制更新列表标记的样式
		const listItems = noteContainer.querySelectorAll("li");
		listItems.forEach((item) => {
			// 触发微小的样式变化来强制浏览器重绘
			(item as HTMLElement).style.display = "list-item";
		});
	}

	/**
	 * 包装文章内容并应用模板
	 * @param article 原始文章HTML
	 * @returns 包装和应用模板后的HTML
	 */
	wrapArticleContent(article: string): string {
		let className = "note-to-mp";

		let html = `<section class="${className}" id="article-section">${article}</section>`;

		// 检查是否需要应用模板
		if (this.settings.useTemplate) {
			logger.info("应用模板：", this.settings.defaultTemplate);
			try {
				const templateManager = TemplateManager.getInstance();
				// 获取文档元数据
				const file = this.app.workspace.getActiveFile();
				const meta: Record<
					string,
					string | string[] | number | boolean | object | undefined
				> = {};
				if (file) {
					const metadata = this.app.metadataCache.getFileCache(file);
					Object.assign(meta, metadata?.frontmatter);
				}
				logger.debug("传递至模板的元数据:", meta);

				html = templateManager.applyTemplate(
					html,
					this.settings.defaultTemplate,
					meta
				);
			} catch (error) {
				logger.error("应用模板失败", error);
				new Notice("应用模板失败，请检查模板设置！");
			}
		}

		return html;
	}

	setStyle(css: string) {
		this.styleEl.empty();
		this.styleEl.appendChild(document.createTextNode(css));
	}

	/**
	 * 获取适配指定平台的文章内容
	 * @param platform 目标平台，默认为 'preview' 预览模式
	 * @param sourceHtml 可选的源HTML内容，如果不提供则使用当前articleDiv的内容
	 * @returns 适配后的文章HTML内容
	 */
	async getArticleContent() {
		try {
			// 获取当前激活的文件内容
			const af = this.app.workspace.getActiveFile();
			let md = "";
			if (af && af.extension.toLocaleLowerCase() === "md") {
				md = await this.app.vault.adapter.read(af.path);
				this.title = af.basename;
			} else {
				md = "没有可渲染的笔记或文件不支持渲染";
			}

			// 移除前端内容
			if (md.startsWith("---")) {
				md = md.replace(FRONT_MATTER_REGEX, "");
			}

			// 解析 Markdown 为 HTML
			let articleHTML = await this.markedParser.parse(md);
			// logger.debug(colors.green("HTML (parsed): "), articleHTML);

			// 包装文章内容
			articleHTML = this.wrapArticleContent(articleHTML);
			// logger.debug(colors.green("HTML (wrapped): "), articleHTML);

			// 使用插件管理器处理HTML内容
			const pluginManager = PluginManager.getInstance();
			articleHTML = pluginManager.processContent(
				articleHTML,
				this.settings
			);
			// logger.debug(colors.green("HTML (final processed): "), articleHTML);
			return articleHTML;
		} catch (error) {
			logger.error("获取文章内容时出错:", error);
			return `<div class="error-message">渲染内容时出错: ${error.message}</div>`;
		}
	}

	getCSS() {
		// 获取主题和高亮样式
		const theme = this.assetsManager.getTheme(this.currentTheme);
		const highlight = this.assetsManager.getHighlight(
			this.currentHighlight
		);
		const customCSS = this.settings.useCustomCss
			? this.assetsManager.customCSS
			: "";

		// 根据用户选择决定是否注入主题色变量
		let themeColorCSS = "";

		// 当用户启用自定义主题色时，注入变量
		if (this.settings.enableThemeColor) {
			themeColorCSS = `
:root {
  --primary-color: ${this.settings.themeColor || "#7852ee"};
  --theme-color-light: ${this.settings.themeColor || "#7852ee"}aa;
}
`;
		}

		// 确保highlight和theme存在，否则使用默认值
		const highlightCss = highlight?.css || "";
		const themeCss = theme?.css || "";

		return `${themeColorCSS}

${InlineCSS}

${highlightCss}

${themeCss}

${customCSS}`;
	}

	buildMsgView(parent: HTMLDivElement) {
		// Add a reference to parent for debugging purposes
		const parentExists = parent && parent.isConnected;
		logger.debug(
			`Building message view with parent connected: ${parentExists}`
		);

		// Create message view as a direct child of main container for proper z-index stacking
		this.msgView = this.container.createDiv({ cls: "msg-view" });
		// Ensure message view appears on top of both columns
		this.msgView.setAttribute(
			"style",
			"position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000; display: none;"
		);
		const title = this.msgView.createDiv({ cls: "msg-title" });
		title.id = "msg-title";
		title.innerText = "加载中...";
		const okBtn = this.msgView.createEl(
			"button",
			{ cls: "msg-ok-btn" },
			async (button) => {}
		);
		okBtn.id = "msg-ok-btn";
		okBtn.innerText = "确定";
		okBtn.onclick = async () => {
			this.msgView.setAttr("style", "display: none;");
		};
	}

	showLoading(msg: string) {
		const title = this.msgView.querySelector("#msg-title") as HTMLElement;
		title!.innerText = msg;
		const btn = this.msgView.querySelector("#msg-ok-btn") as HTMLElement;
		btn.setAttr("style", "display: none;");
		this.msgView.setAttr("style", "display: flex;");
	}

	showMsg(msg: string) {
		const title = this.msgView.querySelector("#msg-title") as HTMLElement;
		title!.innerText = msg;
		const btn = this.msgView.querySelector("#msg-ok-btn") as HTMLElement;
		btn.setAttr("style", "display: block;");
		this.msgView.setAttr("style", "display: flex;");
	}

	async buildUI() {
		this.container = this.containerEl.children[1];
		this.container.empty();

		// Create main container with flex layout for dual columns
		this.mainDiv = this.container.createDiv({ cls: "note-preview" });
		this.mainDiv.setAttribute(
			"style",
			"display: flex; flex-direction: row; height: 100%; width: 100%; overflow: hidden;"
		);

		// 明确创建左侧渲染区域
		this.renderDiv = this.mainDiv.createDiv({ cls: "render-div" });
		this.renderDiv.id = "render-div";
		this.renderDiv.setAttribute(
			"style",
			"order: 0; -webkit-user-select: text; user-select: text; padding: 10px; flex: 1; overflow: auto; border-right: 1px solid var(--background-modifier-border);"
		);
		this.styleEl = this.renderDiv.createEl("style");
		this.styleEl.setAttr("title", "omni-content-style");
		this.setStyle(this.getCSS());
		this.articleDiv = this.renderDiv.createEl("div");

		// 创建可拖动的分隔条，明确放在中间位置
		const resizer = this.mainDiv.createDiv({ cls: "column-resizer" });
		resizer.setAttribute(
			"style",
			"order: 1; width: 5px; background-color: var(--background-modifier-border); cursor: col-resize; opacity: 0.7; transition: opacity 0.2s; z-index: 10;"
		);
		resizer.addEventListener("mouseenter", () => {
			resizer.style.opacity = "1";
		});
		resizer.addEventListener("mouseleave", () => {
			resizer.style.opacity = "0.7";
		});

		// Add drag functionality
		let startX: number, startWidth: number;
		const startDrag = (e: MouseEvent) => {
			startX = e.clientX;
			startWidth = parseInt(getComputedStyle(this.renderDiv).width, 10);
			document.documentElement.addEventListener("mousemove", doDrag);
			document.documentElement.addEventListener("mouseup", stopDrag);
		};

		const doDrag = (e: MouseEvent) => {
			const newWidth = startWidth + e.clientX - startX;
			const containerWidth = this.mainDiv.getBoundingClientRect().width;
			const minWidth = 200; // 渲染区域的最小宽度
			const maxWidth = containerWidth - 250; // 最大宽度（保留至少250px给工具栏）

			if (newWidth > minWidth && newWidth < maxWidth) {
				// 设置渲染区域的固定宽度
				this.renderDiv.style.flex = "0 0 " + newWidth + "px";
				logger.debug(
					`调整渲染区域宽度: ${newWidth}px, 容器总宽度: ${containerWidth}px`
				);
			}
		};

		const stopDrag = () => {
			document.documentElement.removeEventListener("mousemove", doDrag);
			document.documentElement.removeEventListener("mouseup", stopDrag);
		};

		resizer.addEventListener("mousedown", startDrag);

		// 明确创建右侧工具栏容器 - 使用flex: 1让其能跟随调整
		const toolbarContainer = this.mainDiv.createDiv({
			cls: "toolbar-container",
		});
		toolbarContainer.setAttribute(
			"style",
			"order: 2; flex: 1; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; background-color: var(--background-secondary-alt); border-left: 1px solid var(--background-modifier-border);"
		);

		// Build toolbar in the right column
		this.buildToolbar(toolbarContainer);
	}

	updateStyle(styleName: string) {
		this.settings.defaultStyle = styleName;
		this.saveSettingsToPlugin();
		this.setStyle(this.getCSS());
	}

	updateHighLight(styleName: string) {
		this.settings.defaultHighlight = styleName;
		this.saveSettingsToPlugin();
		this.setStyle(this.getCSS());
	}

	getMetadata() {
		let res: DraftArticle = {
			title: "",
			author: undefined,
			digest: undefined,
			content: "",
			content_source_url: undefined,
			cover: undefined,
			thumb_media_id: "",
			need_open_comment: undefined,
			only_fans_can_comment: undefined,
			pic_crop_235_1: undefined,
			pic_crop_1_1: undefined,
		};
		const file = this.app.workspace.getActiveFile();
		if (!file) return res;
		const metadata = this.app.metadataCache.getFileCache(file);
		if (metadata?.frontmatter) {
			const frontmatter = metadata.frontmatter;
			res.title = frontmatter["标题"];
			res.author = frontmatter["作者"];
			res.digest = frontmatter["摘要"];
			res.content_source_url = frontmatter["原文地址"];
			res.cover = frontmatter["封面"];
			res.thumb_media_id = frontmatter["封面素材ID"];
			res.need_open_comment = frontmatter["打开评论"] ? 1 : undefined;
			res.only_fans_can_comment = frontmatter["仅粉丝可评论"]
				? 1
				: undefined;
			if (frontmatter["封面裁剪"]) {
				res.pic_crop_235_1 = "0_0_1_0.5";
				res.pic_crop_1_1 = "0_0.525_0.404_1";
			}
		}
		return res;
	}

	async uploadVaultCover(name: string, token: string) {
		const LocalFileRegex = /^!\[\[(.*?)\]\]/;
		const matches = name.match(LocalFileRegex);
		let fileName = "";
		if (matches && matches.length > 1) {
			fileName = matches[1];
		} else {
			fileName = name;
		}
		const vault = this.app.vault;
		const file = this.assetsManager.searchFile(fileName) as TFile;
		if (!file) {
			throw new Error("找不到封面文件: " + fileName);
		}
		const fileData = await vault.readBinary(file);

		return await this.uploadCover(new Blob([fileData]), file.name, token);
	}

	async uploadLocalCover(token: string) {
		const fileInput = this.coverEl;
		if (!fileInput.files || fileInput.files.length === 0) {
			throw new Error("请选择封面文件");
		}
		const file = fileInput.files[0];
		if (!file) {
			throw new Error("请选择封面文件");
		}

		return await this.uploadCover(file, file.name, token);
	}

	async uploadCover(data: Blob, filename: string, token: string) {
		const res = await wxUploadImage(data, filename, token, "image");
		if (res.media_id) {
			return res.media_id;
		}
		console.error("upload cover fail: " + res.errmsg);
		throw new Error("上传封面失败: " + res.errmsg);
	}

	async getDefaultCover(token: string) {
		const res = await wxBatchGetMaterial(token, "image");
		if (res.item_count > 0) {
			return res.item[0].media_id;
		}
		return "";
	}

	async getToken() {
		const res = await wxGetToken(
			this.settings.authKey,
			this.currentAppId,
			this.getSecret() || ""
		);
		if (res.status != 200) {
			const data = res.json;
			this.showMsg("获取token失败: " + data.message);
			return "";
		}
		const token = res.json.token;
		if (token === "") {
			this.showMsg("获取token失败: " + res.json.message);
		}
		return token;
	}

	getSecret() {
		for (const wx of this.settings.wxInfo) {
			if (wx.appid === this.currentAppId) {
				return wx.secret.replace("SECRET", "");
			}
		}
	}

	updateElementByID(id: string, html: string): void {
		const el = document.getElementById(id);
		if (el) {
			el.innerHTML = html;
		}
	}

	/**
	 * 打开分发对话框
	 */
	openDistributionModal(): void {
		// todo
		// const article = this.getArticleContent();
		// if (!article) {
		// 	new Notice("请先渲染文章内容");
		// 	return;
		// }
		// const modal = new DistributionModal(this.app, article);
		// modal.open();
	}

	/**
	 * 构建基础手风琴部分
	 * @param container 父容器
	 * @param title 标题
	 * @param contentBuilder 内容生成函数
	 * @returns 创建的手风琴元素
	 */
	private buildBasicAccordionSection(
		container: HTMLElement,
		title: string,
		contentBuilder: () => HTMLElement
	): HTMLElement {
		// 创建唯一标识符，用于状态存储
		const sectionId = `accordion-${title
			.replace(/\s+/g, "-")
			.toLowerCase()}`;

		// 创建手风琴包装器
		const accordion = container.createDiv({ cls: "accordion-section" });
		accordion.setAttr("id", sectionId);
		accordion.setAttr(
			"style",
			"margin-bottom: 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);"
		);

		// 创建标题栏
		const header = accordion.createDiv({ cls: "accordion-header" });
		header.setAttr(
			"style",
			"padding: 12px 16px; cursor: pointer; background-color: var(--background-secondary); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid transparent; transition: background-color 0.2s, border-color 0.2s;"
		);
		// 鼠标悬停效果
		header.addEventListener("mouseenter", () => {
			header.style.backgroundColor = "var(--background-secondary-alt)";
		});
		header.addEventListener("mouseleave", () => {
			header.style.backgroundColor = "var(--background-secondary)";
		});

		const titleEl = header.createDiv({
			cls: "accordion-title",
			text: title,
		});
		titleEl.setAttr("style", "font-weight: 500; font-size: 14px;");

		// 创建展开/收缩图标
		const icon = header.createDiv({ cls: "accordion-icon" });
		icon.setAttr("style", "transition: transform 0.3s;");
		icon.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

		// 创建内容区域
		const content = accordion.createDiv({ cls: "accordion-content" });
		content.setAttr("style", "padding: 0 10px; transition: 0.3s ease-out;");

		// 生成并添加内容
		const contentEl = contentBuilder();
		content.appendChild(contentEl);

		// 检查设置中是否存储了扩展状态
		const shouldExpand =
			this.settings.expandedAccordionSections.includes(sectionId);

		// 添加点击事件
		header.addEventListener("click", () => {
			// 切换展开/收缩状态
			const isExpanded =
				content.style.display !== "none" &&
				content.style.display !== "";

			if (isExpanded) {
				// 收起内容区域
				content.style.display = "none";
				icon.style.transform = "rotate(0deg)";
				// 移除标题栏的激活状态
				header.style.borderBottomColor = "transparent";

				// 从设置中移除该部分
				const index =
					this.settings.expandedAccordionSections.indexOf(sectionId);
				if (index > -1) {
					this.settings.expandedAccordionSections.splice(index, 1);
					this.saveSettingsToPlugin();
				}
			} else {
				// 展开内容区域
				content.style.display = "block";
				content.style.padding = "16px"; // 使用单一的padding值更简洁
				icon.style.transform = "rotate(180deg)";
				// 添加标题栏的激活状态
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				// 添加到设置中
				if (
					!this.settings.expandedAccordionSections.includes(sectionId)
				) {
					this.settings.expandedAccordionSections.push(sectionId);
					this.saveSettingsToPlugin();
				}
			}
		});

		// 根据保存的设置或默认规则来设置初始状态
		window.setTimeout(() => {
			// 默认隐藏所有内容
			content.style.display = "none";

			// 如果应该展开（设置中有记录或者是第一个部分）
			if (
				shouldExpand ||
				(container.querySelectorAll(".accordion-section").length ===
					1 &&
					this.settings.expandedAccordionSections.length === 0)
			) {
				// 展开内容区域
				content.style.display = "block";
				content.style.padding = "16px";
				icon.style.transform = "rotate(180deg)";
				// 添加标题栏的激活状态
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				// 记录展开状态
				logger.debug(`初始化手风琴组件展开状态: ${sectionId}`);

				// 如果还没有添加到设置中，则添加
				if (
					!this.settings.expandedAccordionSections.includes(sectionId)
				) {
					this.settings.expandedAccordionSections.push(sectionId);
					this.saveSettingsToPlugin();
				}
			}
		}, 0);

		return accordion;
	}

	/**
	 * 添加键盘导航事件到select元素
	 * @param selectEl select元素
	 */
	private addKeyboardNavigation(selectEl: HTMLSelectElement) {
		selectEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();

				const options = selectEl.options;
				const currentIndex = selectEl.selectedIndex;

				if (
					e.key === "ArrowDown" &&
					currentIndex < options.length - 1
				) {
					selectEl.selectedIndex = currentIndex + 1;
				} else if (e.key === "ArrowUp" && currentIndex > 0) {
					selectEl.selectedIndex = currentIndex - 1;
				}

				// 触发change事件，确保选择变更后的回调被执行
				selectEl.dispatchEvent(new Event("change"));
			}
		});
	}

	/**
	 * 保存设置到插件的持久化存储
	 * 更优雅的方式来处理设置持久化
	 */
	private saveSettingsToPlugin(): void {
		// todo: 这个好像没用
		uevent("save-settings");

		// 使用类型断言来解决 TypeScript 类型错误
		const plugin = (this.app as any).plugins.plugins["omni-content"];
		if (plugin) {
			logger.debug("正在保存设置到持久化存储");
			plugin.saveSettings();
		}
	}

	/**
	 * 构建Remark插件显示区域
	 * @param container 容器元素
	 */
	private buildRemarkPluginSection(container: HTMLElement): void {
		// 创建Remark插件容器
		const remarkContainer = container.createDiv({
			cls: "remark-plugins-container",
		});
		remarkContainer.setAttr("style", "width: 100%;");

		// 获取Remark插件（原扩展）
		const extensionManager = ExtensionManager.getInstance();
		const extensions = extensionManager.getExtensions();

		if (extensions.length > 0) {
			extensions.forEach((extension) => {
				if (extension && typeof extension.getName === "function") {
					const extensionName = extension.getName();
					// 为每个扩展创建手风琴组件
					this.buildExtensionAccordion(
						remarkContainer,
						extension,
						extensionName
					);
				}
			});
		} else {
			remarkContainer.createEl("p", {
				text: "未找到任何Remark插件",
				cls: "no-plugins-message"
			});
		}
	}

	/**
	 * 构建Rehype插件显示区域
	 * @param container 容器元素
	 */
	private buildRehypePluginSection(container: HTMLElement): void {
		// 创建Rehype插件容器
		const rehypeContainer = container.createDiv({
			cls: "rehype-plugins-container",
		});
		rehypeContainer.setAttr("style", "width: 100%;");

		// 获取Rehype插件
		const pluginManager = PluginManager.getInstance();
		const plugins = pluginManager.getPlugins();

		if (plugins.length > 0) {
			plugins.forEach((plugin: IProcessPlugin) => {
				if (plugin && typeof plugin.getName === "function") {
					const pluginName = plugin.getName();
					// 为每个插件创建手风琴组件
					this.buildPluginAccordion(
						rehypeContainer,
						plugin,
						pluginName
					);
				}
			});
		} else {
			rehypeContainer.createEl("p", {
				text: "未找到任何Rehype插件",
				cls: "no-plugins-message"
			});
		}
	}

	/**
	 * 构建手风琴组件
	 * @param container 父容器
	 * @param plugin 插件实例
	 * @param pluginName 插件名称
	 */
	private buildPluginAccordion(
		container: HTMLElement,
		plugin: IProcessPlugin,
		pluginName: string
	): void {
		// 创建唯一标识符，用于状态存储
		const pluginId = `plugin-${pluginName
			.replace(/\s+/g, "-")
			.toLowerCase()}`;

		// 创建手风琴包装器
		const accordion = container.createDiv({ cls: "accordion-section" });
		// 添加唯一ID属性便于识别
		accordion.setAttr("id", pluginId);
		accordion.setAttr(
			"style",
			"margin-bottom: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;"
		);

		// 创建标题栏
		const header = accordion.createDiv({ cls: "accordion-header" });
		header.setAttr(
			"style",
			"padding: 10px; cursor: pointer; background-color: var(--background-secondary); display: flex; justify-content: space-between; align-items: center;"
		);

		// 创建标题和控制区域的容器
		const headerLeft = header.createDiv({ cls: "accordion-header-left" });
		headerLeft.setAttr(
			"style",
			"display: flex; align-items: center; gap: 10px;"
		);

		// 创建启用/禁用开关
		const enableSwitch = headerLeft.createEl("label", {
			cls: "switch small",
		});
		enableSwitch.setAttr(
			"style",
			"margin-right: 8px; min-width: 36px; height: 18px;"
		);

		// 阻止开关点击事件冒泡到手风琴标题
		enableSwitch.addEventListener("click", (event) => {
			event.stopPropagation();
		});

		const enableInput = enableSwitch.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});

		// 设置启用状态
		enableInput.checked = plugin.isEnabled();

		// 添加开关状态变化事件
		enableInput.addEventListener("change", (event) => {
			const isEnabled = (event.target as HTMLInputElement).checked;

			// 更新插件状态
			plugin.setEnabled(isEnabled);

			// 重新渲染内容
			this.renderArticleOnly();

			// 显示操作成功通知
			new Notice(
				`已${isEnabled ? "启用" : "禁用"}${plugin.getName()}插件`
			);
		});

		// 添加滑块
		const slider = enableSwitch.createEl("span", { cls: "slider round" });
		slider.setAttr("style", "height: 18px; width: 36px;");

		// 添加标题
		headerLeft.createDiv({ cls: "accordion-title", text: pluginName });

		// 添加插件配置项
		// 从插件读取元配置和当前配置值
		// 元配置定义控件类型、标题等
		const pluginMetaConfig = plugin.getMetaConfig();
		const pluginCurrentConfig = plugin.getConfig();
		const configEntries = Object.entries(pluginMetaConfig);
		const hasConfigOptions = configEntries.length > 0;

		if (!hasConfigOptions) return;

		// 创建展开/收缩图标
		const icon = header.createDiv({ cls: "accordion-icon" });
		icon.setAttr("style", "transition: transform 0.3s;");
		icon.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

		// 创建内容区域
		const content = accordion.createDiv({ cls: "accordion-content" });
		content.setAttr("style", "padding: 0 10px; transition: 0.3s ease-out;");

		// 构建插件配置区域
		const configContainer = content.createDiv({
			cls: "plugin-config-container",
		});
		configContainer.setAttr(
			"style",
			"display: flex; flex-direction: column; gap: 10px;"
		);

		// 检查设置中是否存储了扩展状态
		const shouldExpand =
			this.settings.expandedAccordionSections.includes(pluginId);

		configEntries.forEach(([key, meta]) => {
			const configItem = configContainer.createDiv({
				cls: "plugin-config-item",
			});
			configItem.setAttr(
				"style",
				"display: flex; justify-content: space-between; align-items: center;"
			);

			// 添加配置项标题
			const configTitle = configItem.createDiv({
				cls: "plugin-config-title",
			});
			configTitle.textContent = meta.title;

			// 添加配置项控件
			const configControl = configItem.createDiv({
				cls: "plugin-config-control",
			});
			let switchEl, switchInput, selectEl: HTMLSelectElement;
			const currentValue = pluginCurrentConfig[key];

			switch (meta.type) {
				case "switch":
					switchEl = configControl.createEl("label", {
						cls: "switch",
					});
					switchInput = switchEl.createEl("input", {
						attr: {
							type: "checkbox",
						},
					});
					switchInput.checked = !!currentValue;
					switchEl.createEl("span", { cls: "slider round" });
					break;
				case "select":
					selectEl = configControl.createEl("select", {
						cls: "plugin-config-select",
					});
					// 防止 options 为 undefined 的情况
					if (meta.options && meta.options.length > 0) {
						meta.options.forEach((option) => {
							const optionEl = selectEl.createEl("option", {
								value: option.value,
								text: option.text,
							});
							if (option.value === currentValue) {
								optionEl.selected = true;
							}
						});
					} else {
						// 如果没有选项，添加一个默认选项
						selectEl.createEl("option", {
							value: "",
							text: "无选项",
						});
					}
					break;
				default:
					break;
			}

			// 添加事件监听器
			configControl.addEventListener("change", (event) => {
				// 获取控件的当前值
				let value: string | boolean;
				const target = event.target as HTMLElement;

				if (meta.type === "switch") {
					value = (target as HTMLInputElement).checked;
				} else if (meta.type === "select") {
					value = (target as HTMLSelectElement).value;
				} else {
					return;
				}

				// 更新插件配置 - 使用对象格式
				plugin.updateConfig({ [key]: value });

				// 只重新渲染文章内容，不更新工具栏，提高响应速度
				this.renderArticleOnly();

				// 显示成功提示
				new Notice(`已更新${plugin.getName()}插件设置`);
			});
		});

		// 标题栏点击事件 - 控制折叠展开
		header.addEventListener("click", () => {
			// 切换展开/收缩状态 - 使用display属性判断
			const isExpanded =
				content.style.display !== "none" &&
				content.style.display !== "";

			if (isExpanded) {
				// 收起内容区域
				content.style.display = "none";
				icon.style.transform = "rotate(0deg)";
				header.style.borderBottomColor = "transparent";

				// 从设置中移除该部分
				const index =
					this.settings.expandedAccordionSections.indexOf(pluginId);
				if (index > -1) {
					this.settings.expandedAccordionSections.splice(index, 1);
					this.saveSettingsToPlugin();
				}
			} else {
				// 展开内容区域
				content.style.display = "block";
				content.style.padding = "16px";
				icon.style.transform = "rotate(180deg)";
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				// 添加到设置中
				if (
					!this.settings.expandedAccordionSections.includes(pluginId)
				) {
					this.settings.expandedAccordionSections.push(pluginId);
					this.saveSettingsToPlugin();
				}
			}
		});

		// 根据保存的设置来设置初始状态
		window.setTimeout(() => {
			// 默认隐藏内容
			content.style.display = "none";

			if (shouldExpand) {
				// 如果应该展开，则设置显示状态
				content.style.display = "block";
				content.style.padding = "16px";
				icon.style.transform = "rotate(180deg)";
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				logger.debug(`初始化插件手风琴展开: ${pluginId}`);
			}
		}, 0);
	}


	/**
	 * 构建手风琴组件
	 * @param container 父容器
	 * @param extension 扩展实例
	 * @param extensionName 扩展名称
	 */
	private buildExtensionAccordion(
		container: HTMLElement,
		extension: Extension,
		extensionName: string
	): void {
		// 创建唯一标识符，用于状态存储
		const extensionId = `extension-${extensionName
			.replace(/\s+/g, "-")
			.toLowerCase()}`;

		// 创建手风琴包装器
		const accordion = container.createDiv({ cls: "accordion-section" });
		// 添加唯一ID属性便于识别
		accordion.setAttr("id", extensionId);
		accordion.setAttr(
			"style",
			"margin-bottom: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;"
		);

		// 创建标题栏
		const header = accordion.createDiv({ cls: "accordion-header" });
		header.setAttr(
			"style",
			"padding: 10px; cursor: pointer; background-color: var(--background-secondary); display: flex; justify-content: space-between; align-items: center;"
		);

		// 创建标题和控制区域的容器
		const headerLeft = header.createDiv({ cls: "accordion-header-left" });
		headerLeft.setAttr(
			"style",
			"display: flex; align-items: center; gap: 10px;"
		);

		// 创建启用/禁用开关
		const enableSwitch = headerLeft.createEl("label", {
			cls: "switch small",
		});
		enableSwitch.setAttr(
			"style",
			"margin-right: 8px; min-width: 36px; height: 18px;"
		);

		// 阻止开关点击事件冒泡到手风琴标题
		enableSwitch.addEventListener("click", (event) => {
			event.stopPropagation();
		});

		const enableInput = enableSwitch.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});

		// 设置启用状态
		enableInput.checked = extension.isEnabled();

		// 添加开关状态变化事件
		enableInput.addEventListener("change", (event) => {
			const isEnabled = (event.target as HTMLInputElement).checked;

			// 更新扩展状态
			extension.setEnabled(isEnabled);

			// 重新渲染内容
			this.renderArticleOnly();

			// 显示操作成功通知
			new Notice(
				`已${isEnabled ? "启用" : "禁用"}${extension.getName()}插件`
			);
		});

		// 添加滑块
		const slider = enableSwitch.createEl("span", { cls: "slider round" });
		slider.setAttr("style", "height: 18px; width: 36px;");

		// 添加标题
		headerLeft.createDiv({ cls: "accordion-title", text: extensionName });

		// 添加扩展配置项
		// 从扩展读取元配置和当前配置值
		// 元配置定义控件类型、标题等
		const extensionMetaConfig = extension.getMetaConfig();
		const extensionCurrentConfig = extension.getConfig();
		const configEntries = Object.entries(extensionMetaConfig);
		const hasConfigOptions = configEntries.length > 0;

		if (!hasConfigOptions) return;

		// 创建展开/收缩图标
		const icon = header.createDiv({ cls: "accordion-icon" });
		icon.setAttr("style", "transition: transform 0.3s;");
		icon.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

		// 创建内容区域
		const content = accordion.createDiv({ cls: "accordion-content" });
		content.setAttr("style", "padding: 0 10px; transition: 0.3s ease-out;");

		// 构建扩展配置区域
		const configContainer = content.createDiv({
			cls: "extension-config-container",
		});
		configContainer.setAttr(
			"style",
			"display: flex; flex-direction: column; gap: 10px;"
		);

		// 检查设置中是否存储了扩展状态
		const shouldExpand =
			this.settings.expandedAccordionSections.includes(extensionId);

		configEntries.forEach(([key, metaValue]) => {
			const meta = metaValue as ExtensionMetaConfig[string];
			const configItem = configContainer.createDiv({
				cls: "extension-config-item",
			});
			configItem.setAttr(
				"style",
				"display: flex; justify-content: space-between; align-items: center;"
			);

			// 添加配置项标题
			const configTitle = configItem.createDiv({
				cls: "extension-config-title",
			});
			configTitle.textContent = meta.title;

			// 添加配置项控件
			const configControl = configItem.createDiv({
				cls: "extension-config-control",
			});
			let switchEl, switchInput, selectEl: HTMLSelectElement;
			const currentValue = extensionCurrentConfig[key];

			switch (meta.type) {
				case "switch":
					switchEl = configControl.createEl("label", {
						cls: "switch",
					});
					switchInput = switchEl.createEl("input", {
						attr: {
							type: "checkbox",
						},
					});
					switchInput.checked = !!currentValue;
					switchEl.createEl("span", { cls: "slider round" });
					break;
				case "select":
					selectEl = configControl.createEl("select", {
						cls: "extension-config-select",
					});
					// 防止 options 为 undefined 的情况
					if (meta.options && meta.options.length > 0) {
						meta.options.forEach((option: any) => {
							const optionEl = selectEl.createEl("option", {
								value: option.value,
								text: option.text,
							});
							if (option.value === currentValue) {
								optionEl.selected = true;
							}
						});
					} else {
						// 如果没有选项，添加一个默认选项
						selectEl.createEl("option", {
							value: "",
							text: "无选项",
						});
					}
					break;
				default:
					break;
			}

			// 添加事件监听器
			configControl.addEventListener("change", (event) => {
				// 获取控件的当前值
				let value: string | boolean;
				const target = event.target as HTMLElement;

				if (meta.type === "switch") {
					value = (target as HTMLInputElement).checked;
				} else if (meta.type === "select") {
					value = (target as HTMLSelectElement).value;
				} else {
					return;
				}

				// 更新扩展配置 - 使用对象格式
				extension.updateConfig({ [key]: value });

				// 只重新渲染文章内容，不更新工具栏，提高响应速度
				this.renderArticleOnly();

				// 显示成功提示
				new Notice(`已更新${extension.getName()}插件设置`);
			});
		});

		// 标题栏点击事件 - 控制折叠展开
		header.addEventListener("click", () => {
			// 切换展开/收缩状态 - 使用display属性判断
			const isExpanded =
				content.style.display !== "none" &&
				content.style.display !== "";

			if (isExpanded) {
				// 收起内容区域
				content.style.display = "none";
				icon.style.transform = "rotate(0deg)";
				header.style.borderBottomColor = "transparent";

				// 从设置中移除该部分
				const index =
					this.settings.expandedAccordionSections.indexOf(extensionId);
				if (index > -1) {
					this.settings.expandedAccordionSections.splice(index, 1);
					this.saveSettingsToPlugin();
				}
			} else {
				// 展开内容区域
				content.style.display = "block";
				content.style.padding = "16px";
				icon.style.transform = "rotate(180deg)";
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				// 添加到设置中
				if (
					!this.settings.expandedAccordionSections.includes(extensionId)
				) {
					this.settings.expandedAccordionSections.push(extensionId);
					this.saveSettingsToPlugin();
				}
			}
		});

		// 根据保存的设置来设置初始状态
		window.setTimeout(() => {
			// 默认隐藏内容
			content.style.display = "none";

			if (shouldExpand) {
				// 如果应该展开，则设置显示状态
				content.style.display = "block";
				content.style.padding = "16px";
				icon.style.transform = "rotate(180deg)";
				header.style.borderBottomColor =
					"var(--background-modifier-border)";

				logger.debug(`初始化插件手风琴展开: ${extensionId}`);
			}
		}, 0);
	}

	/**
	 * 构建品牌区域
	 */
	private buildBrandSection(): void {
		// 创建品牌区域容器
		const brandSection = this.toolbar.createDiv({
			cls: "brand-section",
		});
		brandSection.setAttribute(
			"style",
			"flex: 0 0 auto; padding: 16px; background: linear-gradient(135deg, var(--background-secondary-alt) 0%, var(--background-secondary) 100%); border-bottom: 1px solid var(--background-modifier-border); "
		);

		// 创建品牌区域内容容器
		const brandContent = brandSection.createDiv({
			cls: "brand-content",
		});
		brandContent.setAttribute(
			"style",
			"display: flex; align-items: center; justify-content: space-between; width: 100%;"
		);

		// 创建左侧品牌包装器
		const brandLeftSide = brandContent.createDiv({
			cls: "brand-left-side",
		});
		brandLeftSide.setAttribute(
			"style",
			"display: flex; align-items: center;"
		);

		// 创建 Logo 区域
		const logoContainer = brandLeftSide.createDiv({
			cls: "logo-container",
		});
		logoContainer.setAttribute(
			"style",
			"width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #6b46c1 0%, #4a6bf5 100%); border-radius: 8px; margin-right: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"
		);

		// 添加 Logo 内容 - 简单的 "O" 字母
		logoContainer.innerHTML = `
			<div style="color: white; font-weight: bold; font-size: 20px; font-family: 'Arial Black', sans-serif;">O</div>
		`;

		// 创建品牌名称和版本号容器
		const titleContainer = brandLeftSide.createDiv({
			cls: "title-container",
		});
		titleContainer.setAttribute(
			"style",
			"display: flex; flex-direction: column;"
		);

		// 创建品牌标题
		const brandTitle = titleContainer.createDiv({
			cls: "preview-title",
			text: "Omnient",
		});
		brandTitle.setAttribute(
			"style",
			"font-size: 18px; font-weight: bold; background: linear-gradient(90deg, #6b46c1 0%, #4a6bf5 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);"
		);

		// 创建版本号包装器
		const versionContainer = titleContainer.createDiv({
			cls: "version-container",
		});
		versionContainer.setAttribute(
			"style",
			"display: flex; align-items: center; margin-top: 2px;"
		);

		// 添加版本标记
		const versionBadge = versionContainer.createDiv({
			cls: "version-badge",
		});
		versionBadge.setAttribute(
			"style",
			"padding: 1px 6px; font-size: 11px; font-weight: bold; color: white; background: linear-gradient(90deg, #4a6bf5 0%, #6b46c1 100%); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); line-height: 1.4;"
		);
		versionBadge.textContent = "V0.3.0";

		// 创建平台名称
		const brandName = brandContent.createDiv({ cls: "brand-name" });
		brandName.innerHTML = "手工川智能创作平台";
		brandName.setAttribute(
			"style",
			"font-size: 14px; background: linear-gradient(90deg, #4f6ef2 0%, #8a65d9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding: 4px 10px; border: 1px solid rgba(106, 106, 240, 0.3); border-radius: 12px; font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);"
		);
	}

	/**
	 * 构建模板选择器
	 * @param container 工具栏内容容器
	 */
	private buildTemplateSelector(container: HTMLElement): void {
		const templateGroup = container.createDiv({ cls: "toolbar-group" });
		const templateLabel = templateGroup.createDiv({ cls: "toolbar-label" });
		templateLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></path><polyline points="16 6 12 2 8 6"/></svg><span>模板</span>';

		const templateManager = TemplateManager.getInstance();
		const templates = templateManager.getTemplateNames();

		const templateWrapper = templateGroup.createDiv({
			cls: "select-wrapper",
		});
		const templateSelect = templateWrapper.createEl("select", {
			cls: "toolbar-select",
		});

		// 添加"不使用模板"选项
		const emptyOption = templateSelect.createEl("option");
		emptyOption.value = "";
		emptyOption.text = "不使用模板";
		emptyOption.selected = !this.settings.useTemplate;

		// 添加模板选项
		templates.forEach((template: string) => {
			const op = templateSelect.createEl("option");
			op.value = template;
			op.text = template;
			op.selected =
				this.settings.useTemplate &&
				template === this.settings.defaultTemplate;
		});

		templateSelect.onchange = async () => {
			if (templateSelect.value === "") {
				this.settings.useTemplate = false;
				this.settings.lastSelectedTemplate = "";
			} else {
				this.settings.useTemplate = true;
				this.settings.defaultTemplate = templateSelect.value;
				this.settings.lastSelectedTemplate = templateSelect.value;
			}

			logger.debug(
				`保存模板选择到设置: ${this.settings.lastSelectedTemplate}`
			);

			// 保存设置
			this.saveSettingsToPlugin();

			// 重新渲染以应用模板
			await this.renderMarkdown();
		};

		// 添加键盘导航
		this.addKeyboardNavigation(templateSelect);
	}

	/**
	 * 构建主题选择器
	 * @param container 工具栏内容容器
	 */
	private buildThemeSelector(container: HTMLElement): void {
		const styleGroup = container.createDiv({ cls: "toolbar-group" });

		const styleLabel = styleGroup.createDiv({ cls: "toolbar-label" });
		styleLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l16-10z"></path></svg><span>主题</span>';

		const selectWrapper = styleGroup.createDiv({
			cls: "select-wrapper",
		});
		const selectBtn = selectWrapper.createEl("select", {
			cls: "toolbar-select",
		});

		selectBtn.onchange = async () => {
			this.settings.defaultStyle = selectBtn.value;
			this.saveSettingsToPlugin();
			this.setStyle(this.getCSS());
		};

		for (let s of this.assetsManager.themes) {
			const op = selectBtn.createEl("option");
			op.value = s.className;
			op.text = s.name;
			op.selected = s.className == this.settings.defaultStyle;
		}

		// 添加键盘导航
		this.addKeyboardNavigation(selectBtn);
	}

	/**
	 * 构建代码高亮选择器
	 * @param container 工具栏内容容器
	 */
	private buildHighlightSelector(container: HTMLElement): void {
		// 代码高亮设置
		const highlightGroup = container.createDiv({
			cls: "toolbar-group",
		});

		const highlightLabel = highlightGroup.createDiv({
			cls: "toolbar-label",
		});
		highlightLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><span>代码高亮</span>';

		const highlightWrapper = highlightGroup.createDiv({
			cls: "select-wrapper",
		});
		const highlightStyleBtn = highlightWrapper.createEl("select", {
			cls: "toolbar-select",
		});

		highlightStyleBtn.onchange = async () => {
			this.settings.defaultHighlight = highlightStyleBtn.value;
			this.saveSettingsToPlugin();
			this.setStyle(this.getCSS());
		};

		for (let s of this.assetsManager.highlights) {
			const op = highlightStyleBtn.createEl("option");
			op.value = s.name;
			op.text = s.name;
			op.selected = s.name == this.settings.defaultHighlight;
		}

		// 添加键盘导航
		this.addKeyboardNavigation(highlightStyleBtn);
	}

	/**
	 * 构建主题色选择器
	 * @param container 工具栏内容容器
	 */
	private buildThemeColorSelector(container: HTMLElement): void {
		// 主题色组
		const colorGroup = container.createDiv({ cls: "toolbar-group" });

		const colorLabel = colorGroup.createDiv({ cls: "toolbar-label" });
		colorLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l16-10z"></path></svg><span>主题色</span>';

		// 选择器容器
		const colorControlWrapper = colorGroup.createDiv({
			cls: "color-control-wrapper",
		});

		// 添加开关选项
		const enableSwitch = colorControlWrapper.createDiv({
			cls: "enable-switch",
		});

		// 创建开关按钮
		const toggleSwitch = enableSwitch.createEl("label", { cls: "switch" });
		const toggleInput = toggleSwitch.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});
		toggleInput.checked = this.settings.enableThemeColor;
		toggleSwitch.createEl("span", { cls: "slider round" });

		// 开关文本
		const toggleText = enableSwitch.createEl("span", {
			cls: "toggle-text",
			text: this.settings.enableThemeColor
				? "启用自定义色"
				: "使用主题色",
		});

		// 颜色选择器容器
		const colorWrapper = colorControlWrapper.createDiv({
			cls: "color-picker-wrapper",
			attr: {
				style: this.settings.enableThemeColor ? "" : "opacity: 0.5;",
			},
		});

		// 创建颜色选择器
		const colorPicker = colorWrapper.createEl("input", {
			cls: "toolbar-color-picker",
			attr: {
				type: "color",
				value: this.settings.themeColor || "#7852ee",
				disabled: !this.settings.enableThemeColor,
			},
		});

		// 添加颜色预览
		const colorPreview = colorWrapper.createDiv({ cls: "color-preview" });
		colorPreview.style.backgroundColor =
			this.settings.themeColor || "#7852ee";

		// 开关事件
		toggleInput.onchange = async () => {
			this.settings.enableThemeColor = toggleInput.checked;
			toggleText.textContent = this.settings.enableThemeColor
				? "启用自定义色"
				: "使用主题色";

			// 更新颜色选择器的禁用状态
			colorPicker.disabled = !this.settings.enableThemeColor;
			colorWrapper.style.opacity = this.settings.enableThemeColor
				? "1"
				: "0.5";

			this.saveSettingsToPlugin();

			// 强制更新CSS变量
			this.updateCSSVariables();

			// 重新渲染文档
			await this.renderMarkdown();
		};

		// 颜色拖动时实时更新效果 (不保存设置)
		colorPicker.oninput = () => {
			const newColor = colorPicker.value;
			// 仅更新预览颜色和样式变量，不保存设置
			colorPreview.style.backgroundColor = newColor;

			// 临时更新主题色并强制更新CSS变量
			const originalColor = this.settings.themeColor;
			this.settings.themeColor = newColor; // 临时更新为新颜色
			this.updateCSSVariables(); // 更新变量应用到DOM
			this.settings.themeColor = originalColor; // 还原设置，因为还没有保存
		};

		// 颜色选择完成后保存设置
		colorPicker.onchange = async () => {
			const newColor = colorPicker.value;
			this.settings.themeColor = newColor;
			colorPreview.style.backgroundColor = newColor;
			this.saveSettingsToPlugin();

			// 强制更新CSS变量
			this.updateCSSVariables();

			// 在选择完成后重新渲染一次，确保所有内容都已更新
			await this.renderMarkdown();
		};
	}

	/**
	 * 构建操作按钮组
	 * @param container 工具栏内容容器
	 */
	/**
	 * 构建二级标题设置控件，包括序号和分隔符换行设置
	 * @param container 工具栏内容容器
	 */
	private buildHeadingNumberSettings(container: HTMLElement): void {
		// 创建设置组
		const headingGroup = container.createDiv({ cls: "toolbar-group" });

		// 创建标签
		const headingLabel = headingGroup.createDiv({ cls: "toolbar-label" });
		headingLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"></path><path d="M6 20h12"></path><path d="M6 4h12"></path><path d="M9 9h.01"></path><path d="M9 17h.01"></path></svg><span>二级标题设置</span>';

		// 创建控件容器
		const headingControlWrapper = headingGroup.createDiv({
			cls: "setting-control-wrapper",
		});

		// 创建开关选项
		const enableSwitch = headingControlWrapper.createDiv({
			cls: "enable-switch",
		});

		// 创建开关按钮
		const toggleSwitch = enableSwitch.createEl("label", { cls: "switch" });
		const toggleInput = toggleSwitch.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});
		toggleInput.checked = this.settings.enableHeadingNumber;

		toggleSwitch.createEl("span", { cls: "slider round" });

		// 开关文本
		const toggleText = enableSwitch.createEl("span", {
			cls: "toggle-text",
			text: this.settings.enableHeadingNumber
				? "启用序号 (01.)"
				: "禁用序号",
		});

		// 开关事件
		toggleInput.onchange = async () => {
			this.settings.enableHeadingNumber = toggleInput.checked;
			toggleText.textContent = this.settings.enableHeadingNumber
				? "启用序号 (01.)"
				: "禁用序号";

			// 保存设置
			this.saveSettingsToPlugin();

			// 重新渲染以应用新设置
			await this.renderMarkdown();
		};

		// 添加分隔符换行设置
		const delimiterGroup = headingControlWrapper.createDiv({
			cls: "enable-switch delimiter-switch",
		});

		// 添加间距样式
		delimiterGroup.style.marginTop = "8px";

		// 创建分隔符换行开关按钮
		const delimiterToggleSwitch = delimiterGroup.createEl("label", {
			cls: "switch",
		});
		const delimiterToggleInput = delimiterToggleSwitch.createEl("input", {
			attr: {
				type: "checkbox",
			},
		});
		delimiterToggleInput.checked =
			this.settings.enableHeadingDelimiterBreak;

		delimiterToggleSwitch.createEl("span", { cls: "slider round" });

		// 开关文本
		const delimiterToggleText = delimiterGroup.createEl("span", {
			cls: "toggle-text",
			text: this.settings.enableHeadingDelimiterBreak
				? "分隔符换行 (逗号后换行)"
				: "禁用分隔符换行",
		});

		// 分隔符换行开关事件
		delimiterToggleInput.onchange = async () => {
			this.settings.enableHeadingDelimiterBreak =
				delimiterToggleInput.checked;
			delimiterToggleText.textContent = this.settings
				.enableHeadingDelimiterBreak
				? "分隔符换行 (逗号后换行)"
				: "禁用分隔符换行";

			// 保存设置
			this.saveSettingsToPlugin();

			// 重新渲染以应用新设置
			await this.renderMarkdown();
		};
	}

	private buildActionButtons(container: HTMLElement): void {
		// 操作按钮组
		const actionGroup = container.createDiv({ cls: "toolbar-group" });
		// 刷新按钮
		const refreshBtn = actionGroup.createEl("button", {
			cls: "toolbar-button refresh-button",
		});
		refreshBtn.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>刷新</span>';

		refreshBtn.onclick = async () => {
			this.setStyle(this.getCSS());
			await this.renderMarkdown();
			uevent("refresh");
		};

		// 复制按钮
		if (Platform.isDesktop) {
			const copyBtn = actionGroup.createEl("button", {
				cls: "toolbar-button copy-button",
			});
			copyBtn.innerHTML =
				'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>复制</span>';

			copyBtn.onclick = async () => {
				await this.copyArticle();
				uevent("copy");
			};
		}

		// 分发按钮
		const distributeBtn = actionGroup.createEl("button", {
			cls: "toolbar-button distribute-button",
		});
		distributeBtn.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><span>分发</span>';

		distributeBtn.onclick = async () => {
			this.openDistributionModal();
			uevent("distribute");
		};
	}
}
