import {App, Plugin, PluginManifest, WorkspaceLeaf} from "obsidian";
import {VIEW_TYPE_NOTE_PREVIEW} from "src/constants";
import AssetsManager from "./assets";
import {NotePreview} from "./note-preview";
import {OmniContentSettingTab} from "./setting-tab";
import {NMPSettings} from "./settings";
import TemplateManager from "./template-manager";
import {logger, setVersion, uevent} from "./utils";

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

	onunload() {
	}

	async loadSettings() {
		NMPSettings.loadSettings(await this.loadData());
	}

	async saveSettings() {
		// 确保 settings 已初始化
		if (!this.settings) {
			this.settings = NMPSettings.getInstance();
			console.warn("Settings was undefined in saveSettings, initialized it");
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
		const {workspace} = this.app;

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
