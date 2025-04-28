/*
 * Copyright (c) 2024 Sun Booshi
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
} from "obsidian";
import { applyCSS, uevent, logger } from "./utils";
import { wxUploadImage } from "./weixin-api";
import { LinkFootnoteMode, NMPSettings } from "./settings";
import AssetsManager from "./assets";
import TemplateManager from "./template-manager";
import InlineCSS from "./inline-css";
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
			'如需帮助请前往&nbsp;&nbsp;<a href="https://github.com/sunbooshi/note-to-mp/issues">https://github.com/sunbooshi/note-to-mp/issues</a>&nbsp;&nbsp;反馈<br/><br/>' +
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
				const meta: Record<string, string | string[] | number | boolean | object | undefined> = {};
				if (file) {
					const metadata = this.app.metadataCache.getFileCache(file);
					if (metadata?.frontmatter) {
						// 将全部前置元数据复制到 meta 对象
						Object.assign(meta, metadata.frontmatter);
						
						// 特殊处理 epigraph 属性
						if (metadata.frontmatter.epigraph) {
							if (typeof metadata.frontmatter.epigraph === 'string') {
								meta.epigraph = [metadata.frontmatter.epigraph];
							} else if (Array.isArray(metadata.frontmatter.epigraph)) {
								meta.epigraph = metadata.frontmatter.epigraph;
							}
						}
					}
				}
				
				logger.debug('传递至模板的元数据:', meta);
				
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
		// 创建现代化的工具栏
		this.toolbar = parent.createDiv({ cls: "preview-toolbar" });
		this.toolbar.addClasses(["modern-toolbar"]);
		
		// 创建主工具栏容器
		const toolbarContainer = this.toolbar.createDiv({ cls: "toolbar-container" });
		
		// 1. 创建左侧区域 - 主要设置
		const leftSection = toolbarContainer.createDiv({ cls: "toolbar-section toolbar-section-left" });
		
		// 1.1 模板设置组
		const templateGroup = leftSection.createDiv({ cls: "toolbar-group" });
		const templateLabel = templateGroup.createDiv({ cls: "toolbar-label" });
		templateLabel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M2 15v-3a2 2 0 0 1 2-2h6"></path><path d="m9 16 3-3 3 3"></path><path d="m9 20 3-3 3 3"></path></svg><span>模板</span>';
		
		const templateManager = TemplateManager.getInstance();
		const templates = templateManager.getTemplateNames();
		
		const templateSelect = templateGroup.createEl("select", { cls: "toolbar-select" });
		
		// 添加"不使用模板"选项
		const emptyOption = templateSelect.createEl("option");
		emptyOption.value = "";
		emptyOption.text = "不使用模板";
		emptyOption.selected = !this.settings.useTemplate;
		
		// 添加模板选项
		templates.forEach(template => {
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
			
			// 通过更新静态实例保存设置
			NMPSettings.getInstance();
			
			// 重新渲染以应用模板
			await this.renderMarkdown();
		};

		// 1.2 样式设置组
		if (this.settings.showStyleUI) {
			const styleGroup = leftSection.createDiv({ cls: "toolbar-group" });
			
			const styleLabel = styleGroup.createDiv({ cls: "toolbar-label" });
			styleLabel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l16-10z"></path></svg><span>样式</span>';
			
			const styleControls = styleGroup.createDiv({ cls: "toolbar-controls" });
			
			const selectWrapper = styleControls.createDiv({ cls: "select-wrapper" });
			const selectBtn = selectWrapper.createEl("select", { cls: "toolbar-select" });

			selectBtn.onchange = async () => {
				this.updateStyle(selectBtn.value);
			};

			for (let s of this.assetsManager.themes) {
				const op = selectBtn.createEl("option");
				op.value = s.className;
				op.text = s.name;
				op.selected = s.className == this.settings.defaultStyle;
			}
			
			// 代码高亮设置
			const highlightGroup = leftSection.createDiv({ cls: "toolbar-group" });
			
			const highlightLabel = highlightGroup.createDiv({ cls: "toolbar-label" });
			highlightLabel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><span>代码高亮</span>';
			
			const highlightWrapper = highlightGroup.createDiv({ cls: "select-wrapper" });
			const highlightStyleBtn = highlightWrapper.createEl("select", { cls: "toolbar-select" });

			highlightStyleBtn.onchange = async () => {
				this.updateHighLight(highlightStyleBtn.value);
			};

			for (let s of this.assetsManager.highlights) {
				const op = highlightStyleBtn.createEl("option");
				op.value = s.name;
				op.text = s.name;
				op.selected = s.name == this.settings.defaultHighlight;
			}
		}

		// 2. 创建右侧区域 - 操作按钮
		const rightSection = toolbarContainer.createDiv({ cls: "toolbar-section toolbar-section-right" });
		
		// 操作按钮组
		const actionGroup = rightSection.createDiv({ cls: "toolbar-group" });
		
		// 复制按钮
		if (Platform.isDesktop) {
			const copyBtn = actionGroup.createEl("button", { cls: "toolbar-button copy-button" });
			copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>复制</span>';
			
			copyBtn.onclick = async () => {
				await this.copyArticle();
				new Notice("复制成功，请到公众号编辑器粘贴。");
				uevent("copy");
			};
		}
		
		// 刷新按钮
		const refreshBtn = actionGroup.createEl("button", { cls: "toolbar-button refresh-button" });
		refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>刷新</span>';
		
		refreshBtn.onclick = async () => {
			this.setStyle(this.getCSS());
			await this.renderMarkdown();
			uevent("refresh");
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
		this.styleEl.setAttr("title", "note-to-mp-style");
		this.setStyle(this.getCSS());
		this.articleDiv = this.renderDiv.createEl("div");
	}

	updateStyle(styleName: string) {
		this.currentTheme = styleName;
		this.setStyle(this.getCSS());
	}

	updateHighLight(styleName: string) {
		this.currentHighlight = styleName;
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
			this.getSecret()
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
		const content = this.getArticleContent();

		await navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([content], { type: "text/html" }),
			}),
		]);
	}

	getSecret() {
		for (const wx of this.settings.wxInfo) {
			if (wx.appid === this.currentAppId) {
				return wx.secret.replace("SECRET", "");
			}
		}
		return "";
	}

	updateElementByID(id: string, html: string): void {
		const item = this.articleDiv.querySelector("#" + id) as HTMLElement;
		if (!item) return;
		const doc = sanitizeHTMLToDom(html);
		item.empty();
		if (doc.childElementCount > 0) {
			for (const child of doc.children) {
				item.appendChild(child.cloneNode(true)); // 使用 cloneNode 复制节点以避免移动它
			}
		} else {
			item.innerText = "渲染失败";
		}
	}
}
