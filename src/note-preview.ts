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
import { PreviewAdapterFactory, initializeContentAdapters } from "./platform-adapters";
import AssetsManager from "./assets";
import InlineCSS from "./inline-css";
import { CardDataManager } from "./markdown/code";
import { MDRendererCallback } from "./markdown/extension";
import { LocalImageManager } from "./markdown/local-file";
import { MarkedParser } from "./markdown/parser";
import { NMPSettings } from "./settings";
import TemplateManager from "./template-manager";
import { logger, uevent } from "./utils";
import {
	DraftArticle,
	wxBatchGetMaterial,
	wxGetToken,
	wxUploadImage,
} from "./weixin-api";
import colors from "colors";

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
	listeners: EventRef[];
	container: Element;
	settings: NMPSettings;
	assetsManager: AssetsManager;
	articleHTML: string;
	title: string;
	currentAppId: string;
	markedParser: MarkedParser;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.settings = NMPSettings.getInstance();
		this.assetsManager = AssetsManager.getInstance();
		this.markedParser = new MarkedParser(this.app, this);
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

		// 1. 构建品牌区域
		this.buildBrandSection();

		// 2. 创建主工具栏容器
		const toolbarContainer = this.toolbar.createDiv({
			cls: "toolbar-container",
		});

		// 3. 创建工具栏内容区域 - 单列垂直布局
		const toolbarContent = toolbarContainer.createDiv({
			cls: "toolbar-content toolbar-vertical",
		});

		// 4. 构建各功能模块
		this.buildTemplateSelector(toolbarContent);

		// 6. 如果启用了样式UI，构建样式相关选项
		if (this.settings.showStyleUI) {
			this.buildThemeSelector(toolbarContent);
			this.buildHighlightSelector(toolbarContent);
			this.buildThemeColorSelector(toolbarContent);
		}

		// 5. 构建二级标题序号设置
		this.buildHeadingNumberSettings(toolbarContent);

		// 7. 构建操作按钮组
		this.buildActionButtons(toolbarContent);

		// 8. 创建消息视图，但将其放在工具栏之外
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

		// 初始化内容适配器
		initializeContentAdapters();

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
		this.articleDiv.innerHTML = await this.getArticleContent("preview");
	}

	async copyArticle(platform = "wechat") {
		const content = await this.getArticleContent(platform);

		// 复制到剪贴板
		await navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([content], { type: "text/html" }),
			}),
		]);

		new Notice(`已复制到剪贴板，请去平台：${platform}！`);
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
	async getArticleContent(platform = "preview") {
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
			logger.info(colors.green("HTML (parsed): "), articleHTML);

			// 包装文章内容
			articleHTML = this.wrapArticleContent(articleHTML);
			logger.info(colors.green("HTML (wrapped): "), articleHTML);

			// 获取适配器
			const adapter = PreviewAdapterFactory.getAdapter(platform);
			articleHTML = adapter.adaptContent(articleHTML, this.settings);
			logger.info(colors.green("HTML (final processed): "), articleHTML);
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
		// 使用类型断言来解决 TypeScript 类型错误
		const plugin = (this.app as any).plugins.plugins["omni-content"];
		if (plugin) {
			logger.debug("正在保存设置到持久化存储");
			plugin.saveSettings();
		}
	}

	/**
	 * 构建品牌区域
	 */
	private buildBrandSection(): void {
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
	}

	/**
	 * 构建模板选择器
	 * @param container 工具栏内容容器
	 */
	private buildTemplateSelector(container: HTMLElement): void {
		const templateGroup = container.createDiv({ cls: "toolbar-group" });
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
			op.selected =
				this.settings.useTemplate &&
				template === this.settings.defaultTemplate;
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
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 20 3 3 3-3"></path><path d="m9 4 3-3 3 3"></path><path d="M14 8 8 14"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg><span>主题色</span>';

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
