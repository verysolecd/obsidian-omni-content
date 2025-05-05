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

import {
	EventRef,
	ItemView,
	Workspace,
	WorkspaceLeaf,
	Notice,
	sanitizeHTMLToDom,
	apiVersion,
	TFile,
	Platform,
	Modal,
	Setting,
	App,
} from "obsidian";
import { applyCSS, uevent, logger } from "./utils";
import { wxUploadImage } from "./weixin-api";
import { LinkFootnoteMode, NMPSettings } from "./settings";
import AssetsManager from "./assets";
import TemplateManager from "./template-manager";
import InlineCSS from "./inline-css";
import {
	DistributionService,
	PlatformAdapter,
	PlatformType,
	ArticleContent,
} from "./distribution";

import {
	wxGetToken,
	wxAddDraft,
	wxBatchGetMaterial,
	DraftArticle,
} from "./weixin-api";
import { MDRendererCallback } from "./markdown/extension";
import { MarkedParser } from "./markdown/parser";
import { LocalImageManager } from "./markdown/local-file";
import { CardDataManager, CodeRenderer } from "./markdown/code";

export const VIEW_TYPE_NOTE_PREVIEW = "note-preview";

/**
 * 分发对话框
 */
class DistributionModal extends Modal {
	private article: string;
	private title: string;
	private platforms: PlatformAdapter[] = [];
	private selectedPlatforms: PlatformType[] = [];
	private distributionService: DistributionService;
	private platformCheckboxes: Map<PlatformType, HTMLInputElement> = new Map();
	private statusContainer: HTMLElement;

	constructor(app: App, article: string) {
		super(app);
		this.article = article;
		this.title = document.title || "无标题文档";
		this.distributionService = DistributionService.getInstance();
		this.platforms = this.distributionService.getAdapters();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("distribution-modal");

		// 标题
		const headerDiv = contentEl.createDiv({
			cls: "distribution-modal-header",
		});
		const titleEl = headerDiv.createEl("h2");
		titleEl.setText("内容分发");
		titleEl.addClass("distribution-modal-title");

		// 平台选择区域
		const selectContainer = contentEl.createDiv({
			cls: "platform-select-container",
		});
		const selectTitle = selectContainer.createEl("h3", {
			text: "选择发布平台",
		});

		// 平台列表
		const platformsContainer = selectContainer.createDiv({
			cls: "platforms-container",
		});
		this.renderPlatformsList(platformsContainer);

		// 分发状态和结果
		this.statusContainer = contentEl.createDiv({
			cls: "distribution-status",
		});

		// 按钮区
		const buttonContainer = contentEl.createDiv({
			cls: "distribution-buttons",
		});

		// 发布按钮
		const publishButton = buttonContainer.createEl("button", {
			cls: "mod-cta distribution-publish-button",
			text: "发布",
		});

		publishButton.addEventListener("click", async () => {
			await this.publishToSelectedPlatforms();
		});

		// 保存草稿按钮
		const draftButton = buttonContainer.createEl("button", {
			cls: "distribution-draft-button",
			text: "保存草稿",
		});

		draftButton.addEventListener("click", async () => {
			await this.saveDraftToSelectedPlatforms();
		});

		// 取消按钮
		const cancelButton = buttonContainer.createEl("button", {
			cls: "distribution-cancel-button",
			text: "取消",
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	/**
	 * 渲染平台列表
	 */
	renderPlatformsList(container: HTMLElement) {
		container.empty();
		this.platformCheckboxes.clear();

		// 可用平台列表
		const platformsList = container.createDiv({ cls: "platforms-list" });

		const configuredPlatforms = this.distributionService
			.getConfiguredPlatforms()
			.map((auth) => auth.type);

		// 如果没有配置平台，显示提示
		if (configuredPlatforms.length === 0) {
			const emptyDiv = platformsList.createDiv({
				cls: "empty-platforms",
			});
			emptyDiv.setText("请在设置中配置平台认证信息");
			return;
		}

		// 添加平台选择项
		for (const platform of this.platforms) {
			// 检查是否配置了此平台
			if (!configuredPlatforms.includes(platform.type)) {
				continue;
			}

			// 创建平台选择项
			const platformItem = platformsList.createDiv({
				cls: "platform-item",
			});

			// 复选框
			const checkbox = platformItem.createEl("input");
			checkbox.type = "checkbox";
			checkbox.id = `platform-${platform.type}`;
			checkbox.dataset.platform = platform.type;

			// 存储复选框引用
			this.platformCheckboxes.set(platform.type, checkbox);

			// 处理选择变更
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedPlatforms.push(platform.type);
				} else {
					this.selectedPlatforms = this.selectedPlatforms.filter(
						(p) => p !== platform.type
					);
				}
			});

			// 平台图标和名称
			const label = platformItem.createEl("label");
			label.htmlFor = checkbox.id;
			label.addClass("platform-label");

			const iconSpan = label.createSpan({ cls: "platform-icon" });
			iconSpan.innerHTML = platform.icon;

			const nameSpan = label.createSpan({ cls: "platform-name" });
			nameSpan.setText(platform.name);

			// 初始选中第一个平台
			if (this.selectedPlatforms.length === 0) {
				checkbox.checked = true;
				this.selectedPlatforms.push(platform.type);
			}
		}
	}

	/**
	 * 发布到所选平台
	 */
	async publishToSelectedPlatforms() {
		if (this.selectedPlatforms.length === 0) {
			new Notice("请选择至少一个发布平台");
			return;
		}

		// 准备文章内容
		const content: ArticleContent = {
			title: this.title,
			content: this.article,
			summary: this.extractSummary(this.article),
		};

		// 显示加载状态
		this.statusContainer.empty();
		this.statusContainer.addClass("active");

		const statusTitle = this.statusContainer.createEl("h3", {
			text: "发布进度",
		});
		const statusList = this.statusContainer.createDiv({
			cls: "status-list",
		});

		// 创建平台状态项
		const statusItems = new Map<PlatformType, HTMLElement>();

		for (const platformType of this.selectedPlatforms) {
			const adapter = this.distributionService.getAdapter(platformType);
			if (!adapter) continue;

			const statusItem = statusList.createDiv({ cls: "status-item" });
			statusItem.addClass("status-pending");

			const nameSpan = statusItem.createSpan({ cls: "platform-name" });
			nameSpan.innerHTML = `${adapter.icon} <span>${adapter.name}</span>`;

			const statusSpan = statusItem.createSpan({ cls: "status-text" });
			statusSpan.setText("准备中...");

			statusItems.set(platformType, statusItem);
		}

		// 逐个平台发布
		for (const platformType of this.selectedPlatforms) {
			const statusItem = statusItems.get(platformType);
			if (!statusItem) continue;

			statusItem.removeClass("status-pending");
			statusItem.addClass("status-processing");
			statusItem.querySelector(".status-text")!.textContent = "发布中...";

			try {
				// 发布到平台
				const result = await this.distributionService.publishToPlatform(
					content,
					platformType
				);

				// 更新状态
				statusItem.removeClass("status-processing");

				if (result.success) {
					statusItem.addClass("status-success");
					statusItem.querySelector(".status-text")!.textContent =
						result.message || "发布成功";

					// 添加链接（如果有）
					if (result.url) {
						const linkEl = statusItem.createEl("a", {
							cls: "result-link",
							text: "查看",
							href: result.url,
						});
						linkEl.target = "_blank";
					}
				} else {
					statusItem.addClass("status-error");
					statusItem.querySelector(".status-text")!.textContent =
						result.message || "发布失败";
				}
			} catch (error) {
				statusItem.removeClass("status-processing");
				statusItem.addClass("status-error");
				statusItem.querySelector(
					".status-text"
				)!.textContent = `发布失败: ${
					error instanceof Error ? error.message : "未知错误"
				}`;
			}
		}

		// 添加完成消息
		const completeDiv = this.statusContainer.createDiv({
			cls: "status-complete",
		});
		completeDiv.setText("发布流程已完成");
	}

	/**
	 * 保存草稿到所选平台
	 */
	async saveDraftToSelectedPlatforms() {
		if (this.selectedPlatforms.length === 0) {
			new Notice("请选择至少一个平台");
			return;
		}

		// 准备文章内容
		const content: ArticleContent = {
			title: this.title,
			content: this.article,
			summary: this.extractSummary(this.article),
		};

		// 显示加载状态
		this.statusContainer.empty();
		this.statusContainer.addClass("active");

		const statusTitle = this.statusContainer.createEl("h3", {
			text: "保存草稿进度",
		});
		const statusList = this.statusContainer.createDiv({
			cls: "status-list",
		});

		// 创建平台状态项
		const statusItems = new Map<PlatformType, HTMLElement>();

		for (const platformType of this.selectedPlatforms) {
			const adapter = this.distributionService.getAdapter(platformType);
			if (!adapter) continue;

			const statusItem = statusList.createDiv({ cls: "status-item" });
			statusItem.addClass("status-pending");

			const nameSpan = statusItem.createSpan({ cls: "platform-name" });
			nameSpan.innerHTML = `${adapter.icon} <span>${adapter.name}</span>`;

			const statusSpan = statusItem.createSpan({ cls: "status-text" });
			statusSpan.setText("准备中...");

			statusItems.set(platformType, statusItem);
		}

		// 逐个平台保存草稿
		for (const platformType of this.selectedPlatforms) {
			const statusItem = statusItems.get(platformType);
			if (!statusItem) continue;

			statusItem.removeClass("status-pending");
			statusItem.addClass("status-processing");
			statusItem.querySelector(".status-text")!.textContent = "保存中...";

			try {
				const adapter =
					this.distributionService.getAdapter(platformType);

				// 检查平台是否支持草稿功能
				if (!adapter || !adapter.saveDraft) {
					statusItem.removeClass("status-processing");
					statusItem.addClass("status-error");
					statusItem.querySelector(".status-text")!.textContent =
						"不支持草稿功能";
					continue;
				}

				// 保存草稿
				const result = await this.distributionService.saveDraft(
					content,
					platformType
				);

				// 更新状态
				statusItem.removeClass("status-processing");

				if (result.success) {
					statusItem.addClass("status-success");
					statusItem.querySelector(".status-text")!.textContent =
						result.message || "保存成功";

					// 添加链接（如果有）
					if (result.url) {
						const linkEl = statusItem.createEl("a", {
							cls: "result-link",
							text: "查看",
							href: result.url,
						});
						linkEl.target = "_blank";
					}
				} else {
					statusItem.addClass("status-error");
					statusItem.querySelector(".status-text")!.textContent =
						result.message || "保存失败";
				}
			} catch (error) {
				statusItem.removeClass("status-processing");
				statusItem.addClass("status-error");
				statusItem.querySelector(
					".status-text"
				)!.textContent = `保存失败: ${
					error instanceof Error ? error.message : "未知错误"
				}`;
			}
		}

		// 添加完成消息
		const completeDiv = this.statusContainer.createDiv({
			cls: "status-complete",
		});
		completeDiv.setText("草稿保存流程已完成");
	}

	/**
	 * 从HTML中提取摘要
	 */
	private extractSummary(html: string): string {
		// 创建临时元素解析HTML
		const tempElement = document.createElement("div");
		tempElement.innerHTML = html;

		// 提取纯文本
		const textContent =
			tempElement.textContent || tempElement.innerText || "";

		// 返回前200个字符作为摘要
		return (
			textContent.substring(0, 200).trim() +
			(textContent.length > 200 ? "..." : "")
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

const FRONT_MATTER_REGEX = /^(---)$.+?^(---)$.+?/ims;

export class NotePreview extends ItemView implements MDRendererCallback {
	workspace: Workspace;
	mainDiv: HTMLDivElement;
	toolbar: HTMLDivElement;
	renderDiv: HTMLDivElement;
	articleDiv: HTMLDivElement;
	styleEl: HTMLElement;
	coverEl: HTMLInputElement;
	useDefaultCover: HTMLInputElement;
	useLocalCover: HTMLInputElement;
	msgView: HTMLDivElement;
	listeners: EventRef[];
	container: Element;
	settings: NMPSettings;
	assetsManager: AssetsManager;
	articleHTML: string;
	title: string;
	currentTheme: string;
	currentHighlight: string;
	currentAppId: string;
	markedParser: MarkedParser;

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
				
				if (e.key === "ArrowDown" && currentIndex < options.length - 1) {
					selectEl.selectedIndex = currentIndex + 1;
				} else if (e.key === "ArrowUp" && currentIndex > 0) {
					selectEl.selectedIndex = currentIndex - 1;
				}
				
				// 触发change事件，确保选择变更后的回调被执行
				selectEl.dispatchEvent(new Event("change"));
			}
		});
	}

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.workspace = this.app.workspace;
		this.settings = NMPSettings.getInstance();
		this.assetsManager = AssetsManager.getInstance();
		this.currentTheme = this.settings.defaultStyle;
		this.currentHighlight = this.settings.defaultHighlight;
		this.markedParser = new MarkedParser(this.app, this);
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

	onAppIdChanged() {
		// 清理上传过的图片
		LocalImageManager.getInstance().cleanup();
		CardDataManager.getInstance().cleanup();
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
		try {
			const af = this.app.workspace.getActiveFile();
			let md = "";
			if (af && af.extension.toLocaleLowerCase() === "md") {
				md = await this.app.vault.adapter.read(af.path);
				this.title = af.basename;
			} else {
				md = "没有可渲染的笔记或文件不支持渲染";
			}
			if (md.startsWith("---")) {
				md = md.replace(FRONT_MATTER_REGEX, "");
			}

			this.articleHTML = await this.markedParser.parse(md);

			this.setArticle(this.articleHTML);
		} catch (e) {
			console.error(e);
			this.setArticle(this.errorContent(e));
		}
	}

	isOldTheme() {
		const theme = this.assetsManager.getTheme(this.currentTheme);
		if (theme) {
			return theme.css.indexOf(".note-to-mp") < 0;
		}
		return false;
	}

	setArticle(article: string) {
		this.articleDiv.empty();
		let className = "note-to-mp";
		// 兼容旧版本样式
		if (this.isOldTheme()) {
			className = this.currentTheme;
		}

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
					if (metadata?.frontmatter) {
						// 将全部前置元数据复制到 meta 对象
						Object.assign(meta, metadata.frontmatter);

						// 特殊处理 epigraph 属性
						if (metadata.frontmatter.epigraph) {
							if (
								typeof metadata.frontmatter.epigraph ===
								"string"
							) {
								meta.epigraph = [metadata.frontmatter.epigraph];
							} else if (
								Array.isArray(metadata.frontmatter.epigraph)
							) {
								meta.epigraph = metadata.frontmatter.epigraph;
							}
						}
					}
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

		// logger.info(`Sanitize input HTML: `, html)
		this.articleDiv.innerHTML = html;
		// const doc = sanitizeHTMLToDom(html);
		// if (doc.firstChild) {
		//     const article = doc.firstChild;
		//     logger.info(`Sanitize output article: `, article)
		//     this.articleDiv.appendChild(article);
		// }
	}

	setStyle(css: string) {
		this.styleEl.empty();
		this.styleEl.appendChild(document.createTextNode(css));
	}

	getArticleSection() {
		return this.articleDiv.querySelector("#article-section") as HTMLElement;
	}

	getArticleContent() {
		// 获取渲染后的内容
		// const content = this.articleDiv.innerHTML;
		// logger.info(`get innerHTML: `, content);
		const html = applyCSS(this.articleDiv, this.getCSS());
		logger.info(`apply css: `, html);
		const processedHtml = CardDataManager.getInstance().restoreCard(html);
		// logger.info(`processed html: `, processedHtml);
		return processedHtml;
	}

	getCSS() {
		try {
			const theme = this.assetsManager.getTheme(this.currentTheme);
			const highlight = this.assetsManager.getHighlight(
				this.currentHighlight
			);
			const customCSS = this.settings.useCustomCss
				? this.assetsManager.customCSS
				: "";
			return `${InlineCSS}\n\n${highlight!.css}\n\n${
				theme!.css
			}\n\n${customCSS}`;
		} catch (error) {
			console.error(error);
			new Notice(
				`获取样式失败${this.currentTheme}|${this.currentHighlight}，请检查主题是否正确安装。`
			);
		}
		return "";
	}

	buildMsgView(parent: HTMLDivElement) {
		this.msgView = parent.createDiv({ cls: "msg-view" });
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

	buildToolbar(parent: HTMLDivElement) {
		// 创建专业化的工具栏
		this.toolbar = parent.createDiv({ cls: "preview-toolbar" });
		this.toolbar.addClasses(["modern-toolbar"]);

		// 添加工具栏顶部品牌区域
		const brandSection = this.toolbar.createDiv({ cls: "brand-section" });

		// 品牌Logo和名称
		const brandLogo = brandSection.createDiv({ cls: "brand-logo" });
		brandLogo.innerHTML = `
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4A6BF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 17L12 22L22 17" stroke="#4A6BF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 12L12 17L22 12" stroke="#4A6BF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		`;

		const brandName = brandSection.createDiv({ cls: "brand-name" });
		brandName.innerHTML = "手工川智能创作平台";

		// 创建主工具栏容器
		const toolbarContainer = this.toolbar.createDiv({
			cls: "toolbar-container",
		});

		// 创建工具栏内容区域
		const toolbarContent = toolbarContainer.createDiv({
			cls: "toolbar-content",
		});

		// 1. 创建左侧区域 - 主要设置
		const leftSection = toolbarContent.createDiv({
			cls: "toolbar-section toolbar-section-left toolbar-vertical",
		});

		// 1.1 模板设置组
		const templateGroup = leftSection.createDiv({ cls: "toolbar-group" });
		const templateLabel = templateGroup.createDiv({ cls: "toolbar-label" });
		templateLabel.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M2 15v-3a2 2 0 0 1 2-2h6"></path><path d="m9 16 3-3 3 3"></path><path d="m9 20 3-3 3 3"></path></svg><span>模板</span>';

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
		templates.forEach((template) => {
			const op = templateSelect.createEl("option");
			op.value = template;
			op.text = template;
			op.selected = this.settings.useTemplate && template === this.settings.defaultTemplate;
		});

		templateSelect.onchange = async () => {
			if (templateSelect.value === "") {
				this.settings.useTemplate = false;
			} else {
				this.settings.useTemplate = true;
				this.settings.defaultTemplate = templateSelect.value;
			}
			
			// 保存设置
			this.saveSettingsToPlugin();
			
			// 重新渲染以应用模板
			await this.renderMarkdown();
		};
		
		// 添加键盘导航
		this.addKeyboardNavigation(templateSelect);
		
		// 1.2 样式设置组
		if (this.settings.showStyleUI) {
			const styleGroup = leftSection.createDiv({ cls: "toolbar-group" });

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
				this.currentTheme = selectBtn.value;
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

			// 代码高亮设置
			const highlightGroup = leftSection.createDiv({
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
				this.currentHighlight = highlightStyleBtn.value;
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

		// 2. 创建右侧区域 - 操作按钮
		const rightSection = toolbarContent.createDiv({
			cls: "toolbar-section toolbar-section-right",
		});

		// 操作按钮组
		const actionGroup = rightSection.createDiv({ cls: "toolbar-group" });

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
				new Notice("复制成功，请到公众号编辑器粘贴。");
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

		// 创建消息视图，但将其放在工具栏之外
		this.buildMsgView(parent);
	}

	async buildUI() {
		this.container = this.containerEl.children[1];
		this.container.empty();

		this.mainDiv = this.container.createDiv({ cls: "note-preview" });
		// this.mainDiv.setAttribute(
		// 	"style",
		// 	"padding: 50px;"
		// );

		this.buildToolbar(this.mainDiv);

		this.renderDiv = this.mainDiv.createDiv({ cls: "render-div" });
		this.renderDiv.id = "render-div";
		this.renderDiv.setAttribute(
			"style",
			"-webkit-user-select: text; user-select: text; padding:10px;"
		);
		this.styleEl = this.renderDiv.createEl("style");
		this.styleEl.setAttr("title", "omni-content-style");
		this.setStyle(this.getCSS());
		this.articleDiv = this.renderDiv.createEl("div");
	}

	/**
	 * 保存设置到插件的持久化存储
	 * 更优雅的方式来处理设置持久化
	 */
	private saveSettingsToPlugin(): void {
		// 使用类型断言来解决 TypeScript 类型错误
		const plugin = (this.app as any).plugins.plugins["omni-content"];
		if (plugin) {
			logger.debug("正在保存设置到持久化存储");
			plugin.saveSettings();
		}
	}

	updateStyle(styleName: string) {
		this.currentTheme = styleName;
		this.settings.defaultStyle = styleName;
		this.saveSettingsToPlugin();
		this.setStyle(this.getCSS());
	}

	updateHighLight(styleName: string) {
		this.currentHighlight = styleName;
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

	async copyArticle() {
		// Enable WeChat compatible mode before rendering
		const { setWeChatMode } = await import('./markdown/parser');
		setWeChatMode(true);
		
		// Re-render with WeChat mode enabled
		await this.renderMarkdown();
		
		// Get the WeChat-formatted content
		const content = this.getArticleContent();

		// Copy to clipboard
		await navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([content], { type: "text/html" }),
			}),
		]);
		
		// Disable WeChat mode and re-render for normal viewing
		setWeChatMode(false);
		await this.renderMarkdown();
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
		const article = this.getArticleContent();
		if (!article) {
			new Notice("请先渲染文章内容");
			return;
		}

		const modal = new DistributionModal(this.app, article);
		modal.open();
	}
}
