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

import { Plugin, WorkspaceLeaf, App, PluginManifest } from "obsidian";
import { NotePreview, VIEW_TYPE_NOTE_PREVIEW } from "./note-preview";
import { NMPSettings } from "./settings";
import { OmniContentSettingTab } from "./setting-tab";
import AssetsManager from "./assets";
import TemplateManager from "./template-manager";
import { setVersion, uevent, logger } from "./utils";
import { DistributionService } from "./distribution";

export default class OmniContentPlugin extends Plugin {
	settings: NMPSettings;
	assetsManager: AssetsManager;
	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		AssetsManager.setup(app, manifest);
		this.assetsManager = AssetsManager.getInstance();
	}

	async onload() {
		console.log("Loading OmniContent");
		setVersion(this.manifest.version);
		uevent("load");
		await this.loadSettings();
		await this.assetsManager.loadAssets();

		// 初始化模板管理器
		const templateManager = TemplateManager.getInstance();
		templateManager.setup(this.app);
		await templateManager.loadTemplates();

		// 初始化分发服务
		const distributionService = DistributionService.getInstance();
		distributionService.setup(this.app);

		// 加载分发服务配置
		const distributionConfig = this.settings
			? this.settings.distributionConfig
			: null;
		if (distributionConfig) {
			distributionService.loadConfig(distributionConfig);
			logger.info("分发服务配置已加载");
		}

		this.registerView(
			VIEW_TYPE_NOTE_PREVIEW,
			(leaf) => new NotePreview(leaf)
		);

		const ribbonIconEl = this.addRibbonIcon('clipboard-paste', '复制到公众号', () => {
				this.activateView();
			}
		);
		ribbonIconEl.addClass('omnicontent-plugin-ribbon-class');

		this.addCommand({
			id: "open-note-preview",
			name: "复制到公众号",
			callback: () => {
				this.activateView();
			},
		});

		this.addSettingTab(new OmniContentSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		NMPSettings.loadSettings(await this.loadData());
	}

	async saveSettings() {
		// 确保 settings 已初始化
		if (!this.settings) {
			this.settings = NMPSettings.getInstance();
			console.warn("Settings was undefined in saveSettings, initialized it");
		}
		
		// 保存分发服务配置
		try {
			const distributionService = DistributionService.getInstance();
			const distributionConfig = distributionService.saveConfig();
			this.settings.distributionConfig = distributionConfig;
		} catch (error) {
			console.error("Error while saving distribution config:", error);
		}

		// 保存所有设置
		try {
			await this.saveData(NMPSettings.allSettings());
			console.debug("Settings saved successfully");
		} catch (error) {
			console.error("Error while saving settings:", error);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOTE_PREVIEW);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({
				type: VIEW_TYPE_NOTE_PREVIEW,
				active: true,
			});
		}

		if (leaf) workspace.revealLeaf(leaf);
	}
}
