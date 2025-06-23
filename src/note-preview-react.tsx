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
import { CardDataManager } from "./rehype-plugins/code-blocks";
import { MDRendererCallback } from "./remark-plugins/extension";
import { ExtensionManager } from "./remark-plugins/extension-manager";
import type { Extension, ExtensionMetaConfig } from "./remark-plugins/extension";
import { LocalImageManager } from "./remark-plugins/local-file";
import { MarkedParser } from "./remark-plugins/parser";
import { initializePlugins, PluginManager } from "./rehype-plugins";
import { NMPSettings } from "./settings";
import TemplateManager from "./template-manager";
import { logger, uevent } from "./utils";
import {
	DraftArticle,
	wxBatchGetMaterial,
	wxGetToken,
	wxUploadImage,
	wxAddDraft,
} from "./weixin-api";
import { NotePreviewComponent, ReactRenderer } from "./components/preview/NotePreviewComponent";
import { MessageModal } from "./components/preview/MessageModal";

export class NotePreviewReact extends ItemView implements MDRendererCallback {
	container: HTMLElement;
	settings: NMPSettings;
	assetsManager: AssetsManager;
	articleHTML: string;
	title: string;
	currentAppId: string;
	markedParser: MarkedParser;
	listeners: EventRef[];
	reactRenderer: ReactRenderer;

	showPublishModal: boolean = false;
	isPublishing: boolean = false;
	publishResult: string = "";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.settings = NMPSettings.getInstance();
		this.assetsManager = AssetsManager.getInstance();
		this.markedParser = new MarkedParser(this.app, this);
		this.reactRenderer = new ReactRenderer();

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
		this.reactRenderer.unmount();
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
		this.isRendering = true; // 开始渲染，设置状态为 true
		this.articleHTML = await this.getArticleContent();
		// 等待所有 Mermaid 图表首次渲染完成
		if (window.mermaidRenderPromises && window.mermaidRenderPromises.length > 0) {
			await Promise.all(window.mermaidRenderPromises);
		}
		
		// 处理 Mermaid 图表渲染结果
		if (this.articleHTML && document.getElementById('article-section')) {
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = this.articleHTML;
			const mermaidElements = document.querySelectorAll('.note-mermaid svg');
			const mermaidContainers = tempDiv.querySelectorAll('.mermaid');
			
			mermaidContainers.forEach((container, index) => {
				const svg = mermaidElements[index];
				if (svg) {
					container.innerHTML = svg.outerHTML;
					container.classList.remove('mermaid');
					container.classList.add('note-mermaid-rendered');
				}
			});
			
			this.articleHTML = tempDiv.innerHTML;
		}
		
		this.isRendering = false; // 渲染完成，设置状态为 false
		this.updateReactComponent();
	}

	async handlePublishToWeixinDraft() {
		if (this.isRendering) return; // 渲染期间不允许发布

		this.isPublishing = true;
		this.publishResult = "";
		this.updateReactComponent();

		try {
			// 直接使用已渲染的 HTML 内容
			const title = this.title || "无标题";
			const content = this.articleHTML || "";

			// 获取封面 media_id（可根据实际需求调整）
			const token = this.settings.wxToken;
			let thumb_media_id = await this.getDefaultCover(token);
			if (!thumb_media_id) thumb_media_id = "";

			const draft = {
				title,
				content,
				thumb_media_id,
			};

			const res = await wxAddDraft(draft);

			if (res.status === 200 && res.json && !res.json.errcode) {
				this.publishResult = "上传草稿成功！";
			} else {
				this.publishResult = `上传失败：${res.json?.errmsg || `HTTP错误 ${res.status}` || '未知错误'}`;
			}
		} catch (e: any) {
			this.publishResult = `上传异常：${e?.message || e}`;
		}

		this.isPublishing = false;
		this.updateReactComponent();
	}

	async copyArticle() {
		if (this.isRendering) return; // 渲染期间不允许复制

		try {
			// 获取所有已渲染的 mermaid 图表
			const mermaidElements = document.querySelectorAll('.note-mermaid svg');
			const content = this.articleHTML;

			// 创建一个临时容器来处理内容
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = content;

			// 找到所有 mermaid 容器
			const mermaidContainers = tempDiv.querySelectorAll('.mermaid');

			// 用实际渲染的 SVG 替换 mermaid 语法
			mermaidContainers.forEach((container, index) => {
				const svg = mermaidElements[index];
				if (svg) {
					container.innerHTML = svg.outerHTML;
					container.classList.remove('mermaid'); // 移除 mermaid 类，防止重复渲染
				}
			});

			// 复制处理后的内容到剪贴板
			await navigator.clipboard.write([
				new ClipboardItem({
					"text/html": new Blob([tempDiv.innerHTML], { type: "text/html" }),
				}),
			]);

			new Notice(`已复制到剪贴板！`);
		} catch (error) {
			console.error("复制内容时出错:", error);
			new Notice("复制失败，请查看控制台获取详细错误信息");
		}
	}

	updateCSSVariables() {
		// 在React组件中处理CSS变量更新
		const noteContainer = document.querySelector(
			".note-to-mp"
		) as HTMLElement;
		if (!noteContainer) {
			console.log("找不到.note-to-mp容器，无法更新CSS变量");
			return;
		}

		if (this.settings.enableThemeColor) {
			noteContainer.style.setProperty(
				"--primary-color",
				this.settings.themeColor || "#7852ee"
			);
			console.log(`应用自定义主题色：${this.settings.themeColor}`);
		} else {
			noteContainer.style.removeProperty("--primary-color");
			console.log("恢复使用主题文件中的颜色");
		}

		const listItems = noteContainer.querySelectorAll("li");
		listItems.forEach((item) => {
			(item as HTMLElement).style.display = "list-item";
		});
	}

	wrapArticleContent(article: string): string {
		let className = "note-to-mp";
		let html = `<section class="${className}" id="article-section">${article}</section>`;

		if (this.settings.useTemplate) {
			logger.info("应用模板：", this.settings.defaultTemplate);
			try {
				const templateManager = TemplateManager.getInstance();
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

	async getArticleContent() {
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

			let articleHTML = await this.markedParser.parse(md);
			articleHTML = this.wrapArticleContent(articleHTML);

			const pluginManager = PluginManager.getInstance();
			articleHTML = pluginManager.processContent(
				articleHTML,
				this.settings
			);
			return articleHTML;
		} catch (error) {
			logger.error("获取文章内容时出错:", error);
			return `<div class="error-message">渲染内容时出错: ${error.message}</div>`;
		}
	}

	getCSS() {
		const theme = this.assetsManager.getTheme(this.currentTheme);
		const highlight = this.assetsManager.getHighlight(
			this.currentHighlight
		);
		const customCSS = this.settings.useCustomCss
			? this.assetsManager.customCSS
			: "";

		let themeColorCSS = "";

		if (this.settings.enableThemeColor) {
			themeColorCSS = `
:root {
  --primary-color: ${this.settings.themeColor || "#7852ee"};
  --theme-color-light: ${this.settings.themeColor || "#7852ee"}aa;
}
`;
		}

		const highlightCss = highlight?.css || "";
		const themeCss = theme?.css || "";

		return `${themeColorCSS}

${InlineCSS}

${highlightCss}

${themeCss}

${customCSS}`;
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
		// 这个功能在React版本中需要重新实现
		throw new Error("本地封面上传功能需要在React组件中重新实现");
	}

	async uploadCover(data: Blob, filename: string, token: string) {
		const res = await wxUploadImage(data, filename, token);
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

	// async getToken() {
	// 	const res = await wxGetToken();
		
	// 	// 检查是否有错误
	// 	if (res.error) {
	// 		// 通过React组件显示消息
	// 		return "";
	// 	}
		
	// 	// 正常情况下处理
	// 	if (res.status === 200 && res.json && res.json.access_token) {
	// 		return res.json.access_token;
	// 	} else {
	// 		// 通过React组件显示消息
	// 		return "";
	// 	}
	// }


	updateElementByID(id: string, html: string): void {
		const el = document.getElementById(id);
		if (el) {
			el.innerHTML = html;
		}
	}

	openDistributionModal(): void {
		this.showPublishModal = true;
		this.updateReactComponent();
	}

	async buildUI() {
		this.container = this.containerEl.children[1] as HTMLElement;
		this.container.empty();

		// 渲染React组件
		this.updateReactComponent();
	}

	private updateReactComponent() {
		const publishModal = this.showPublishModal && (
			<MessageModal
				isVisible={true}
				title={this.isPublishing ? "正在上传草稿..." : (this.publishResult ? this.publishResult : "确定发布到公众号草稿箱吗？")}
				showOkButton={!this.isPublishing}
				onClose={() => {
					if (this.isPublishing) return;
					if (this.publishResult) {
						this.showPublishModal = false;
						this.publishResult = "";
						this.updateReactComponent();
					} else {
						// 用户点击“确定”
						this.handlePublishToWeixinDraft();
					}
				}}
				// 显示取消按钮
				showCancelButton={!this.isPublishing} 
				onCancel={() => {
					this.showPublishModal = false;
					this.updateReactComponent();
				}}
			/>
		);
		const component = (
			<NotePreviewComponent
				settings={this.settings}
				articleHTML={this.articleHTML || ""}
				cssContent={this.getCSS()}
				isRendering={this.isRendering} // 传递渲染状态
				onRefresh={async () => {
					await this.renderMarkdown();
					uevent("refresh");
				}}
				onCopy={async () => {
					await this.copyArticle();
					uevent("copy");
				}}
				onDistribute={async () => {
					this.openDistributionModal();
					uevent("distribute");
				}}
				onTemplateChange={async (template: string) => {
					if (template === "") {
						this.settings.useTemplate = false;
						this.settings.lastSelectedTemplate = "";
					} else {
						this.settings.useTemplate = true;
						this.settings.defaultTemplate = template;
						this.settings.lastSelectedTemplate = template;
					}
					this.saveSettingsToPlugin();
					await this.renderMarkdown();
				}}
				onThemeChange={async (theme: string) => {
					this.settings.defaultStyle = theme;
					this.saveSettingsToPlugin();
					this.updateReactComponent();
				}}
				onHighlightChange={async (highlight: string) => {
					this.settings.defaultHighlight = highlight;
					this.saveSettingsToPlugin();
					this.updateReactComponent();
				}}
				onThemeColorToggle={async (enabled: boolean) => {
					this.settings.enableThemeColor = enabled;
					this.saveSettingsToPlugin();
					await this.renderMarkdown();
				}}
				onThemeColorChange={async (color: string) => {
					this.settings.themeColor = color;
					this.saveSettingsToPlugin();
					await this.renderMarkdown();
				}}
				onRenderArticle={async () => {
					await this.renderArticleOnly();
				}}
				onSaveSettings={() => {
					this.saveSettingsToPlugin();
				}}
				onUpdateCSSVariables={() => {
					this.updateCSSVariables();
				}}
				publishModal={publishModal}
			/>
		);

		if (this.reactRenderer.root) {
			this.reactRenderer.update(component);
		} else {
			this.reactRenderer.mount(this.container, component);
		}
	}

	private saveSettingsToPlugin(): void {
		uevent("save-settings");
		const plugin = (this.app as any).plugins.plugins["omni-content"];
		if (plugin) {
			logger.debug("正在保存设置到持久化存储");
			plugin.saveSettings();
		}
	}
}
export function registerExtension(
	extension: Extension,
	meta: ExtensionMetaConfig
): void {
	ExtensionManager.getInstance().registerExtension(extension, meta);
}