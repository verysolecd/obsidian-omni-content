import {App, Modal, Notice} from "obsidian";
import {ArticleContent, DistributionService, PlatformAdapter, PlatformType} from "src/distribution";

/**
 * 分发对话框
 */
export class DistributionModal extends Modal {
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
		const {contentEl} = this;
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
		const platformsList = container.createDiv({cls: "platforms-list"});

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

			const iconSpan = label.createSpan({cls: "platform-icon"});
			iconSpan.innerHTML = platform.icon;

			const nameSpan = label.createSpan({cls: "platform-name"});
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

			const statusItem = statusList.createDiv({cls: "status-item"});
			statusItem.addClass("status-pending");

			const nameSpan = statusItem.createSpan({cls: "platform-name"});
			nameSpan.innerHTML = `${adapter.icon} <span>${adapter.name}</span>`;

			const statusSpan = statusItem.createSpan({cls: "status-text"});
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

			const statusItem = statusList.createDiv({cls: "status-item"});
			statusItem.addClass("status-pending");

			const nameSpan = statusItem.createSpan({cls: "platform-name"});
			nameSpan.innerHTML = `${adapter.icon} <span>${adapter.name}</span>`;

			const statusSpan = statusItem.createSpan({cls: "status-text"});
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
		const {contentEl} = this;
		contentEl.empty();
	}
}
