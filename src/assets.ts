import * as zip from "@zip.js/zip.js";
import {App, FileSystemAdapter, Notice, PluginManifest, requestUrl, TAbstractFile} from "obsidian";
import DefaultHighlight from "./default-highlight";
import DefaultTheme from "./default-theme";


export interface Theme {
	name: string
	className: string
	desc: string
	author: string
	css: string
}

export interface Highlight {
	name: string
	url: string
	css: string
}

export default class AssetsManager {
	app: App;
	defaultTheme: Theme = DefaultTheme;
	manifest: PluginManifest;
	themes: Theme[];
	highlights: Highlight[];
	assetsPath: string;
	themesPath: string;
	hilightPath: string;
	customCSS: string = '';
	themeCfg: string;
	hilightCfg: string;
	customCSSPath: string;
	iconsPath: string;
	private static instance: AssetsManager;

	// 静态方法，用于获取实例
	public static getInstance(): AssetsManager {
		if (!AssetsManager.instance) {
			AssetsManager.instance = new AssetsManager();
		}
		return AssetsManager.instance;
	}

	public static setup(app: App, manifest: PluginManifest) {
		AssetsManager.getInstance()._setup(app, manifest);
	}

	private _setup(app: App, manifest: PluginManifest) {
		this.app = app;
		this.manifest = manifest;
		this.assetsPath = this.app.vault.configDir + '/plugins/obsidian-omni-content/assets/';
		this.themesPath = this.assetsPath + 'themes/';
		this.hilightPath = this.assetsPath + 'highlights/';
		this.themeCfg = this.assetsPath + 'themes.json';
		this.hilightCfg = this.assetsPath + 'highlights.json';
		this.customCSSPath = this.assetsPath + 'custom.css';
		this.iconsPath = this.assetsPath + 'icons/';
	}

	private constructor() {

	}

	async loadAssets() {
		await this.loadThemes();
		await this.loadHighlights();
		await this.loadCustomCSS();
	}

	async loadThemes() {
		try {
			if (!await this.app.vault.adapter.exists(this.themeCfg)) {
				new Notice('主题资源未下载，请前往设置下载！');
				this.themes = [this.defaultTheme];
				return;
			}
			const data = await this.app.vault.adapter.read(this.themeCfg);
			if (data) {
				const themes = JSON.parse(data);
				await this.loadCSS(themes);
				this.themes = [this.defaultTheme, ...themes];
			}
		} catch (error) {
			console.error(error);
			new Notice('themes.json解析失败！');
		}
	}

	async loadCSS(themes: Theme[]) {
		try {
			for (const theme of themes) {
				const cssFile = this.themesPath + theme.className + '.css';
				const cssContent = await this.app.vault.adapter.read(cssFile);
				if (cssContent) {
					theme.css = cssContent;
				}
			}
		} catch (error) {
			console.error(error);
			new Notice('读取CSS失败！');
		}
	}

	async loadCustomCSS() {
		try {
			if (!await this.app.vault.adapter.exists(this.customCSSPath)) {
				return;
			}

			const cssContent = await this.app.vault.adapter.read(this.customCSSPath);
			if (cssContent) {
				this.customCSS = cssContent;
			}
		} catch (error) {
			console.error(error);
			new Notice('读取CSS失败！');
		}
	}

	async loadHighlights() {
		try {
			const defaultHighlight = {name: '默认', url: '', css: DefaultHighlight};
			this.highlights = [defaultHighlight];
			if (!await this.app.vault.adapter.exists(this.hilightCfg)) {
				new Notice('高亮资源未下载，请前往设置下载！');
				return;
			}

			const data = await this.app.vault.adapter.read(this.hilightCfg);
			if (data) {
				const items = JSON.parse(data);
				for (const item of items) {
					const cssFile = this.hilightPath + item.name + '.css';
					const cssContent = await this.app.vault.adapter.read(cssFile);
					this.highlights.push({name: item.name, url: item.url, css: cssContent});
				}
			}
		} catch (error) {
			console.error(error);
			new Notice('highlights.json解析失败！');
		}
	}

	async loadIcon(name: string) {
		const icon = this.iconsPath + name + '.svg';
		if (!await this.app.vault.adapter.exists(icon)) {
			return '';
		}
		const iconContent = await this.app.vault.adapter.read(icon);
		if (iconContent) {
			return iconContent;
		}
		return '';
	}

	getTheme(themeName: string) {
		for (const theme of this.themes) {
			if (theme.name === themeName || theme.className === themeName) {
				return theme;
			}
		}
	}

	getHighlight(highlightName: string) {
		for (const highlight of this.highlights) {
			if (highlight.name === highlightName) {
				return highlight;
			}
		}
	}

	getThemeURL() {
		const version = this.manifest.version;
		return `https://github.com/sunbooshi/note-to-mp/releases/download/1.2.0/assets.zip`;
	}

	async downloadThemes() {
		try {
			if (await this.app.vault.adapter.exists(this.themeCfg)) {
				new Notice('主题资源已存在！')
				return;
			}
			const res = await requestUrl(this.getThemeURL());
			const data = res.arrayBuffer;
			await this.unzip(new Blob([data]));
			await this.loadAssets();
			new Notice('主题下载完成！');
		} catch (error) {
			console.error(error);
			await this.removeThemes();
			new Notice('主题下载失败, 请检查网络！');
		}
	}

	async unzip(data: Blob) {
		const zipFileReader = new zip.BlobReader(data);
		const zipReader = new zip.ZipReader(zipFileReader);
		const entries = await zipReader.getEntries();

		if (!await this.app.vault.adapter.exists(this.assetsPath)) {
			this.app.vault.adapter.mkdir(this.assetsPath);
		}

		for (const entry of entries) {
			if (entry.directory) {
				const dirPath = this.assetsPath + entry.filename;
				this.app.vault.adapter.mkdir(dirPath);
			} else {
				const filePath = this.assetsPath + entry.filename;
				const textWriter = new zip.TextWriter();
				if (entry.getData) {
					const data = await entry.getData(textWriter);
					await this.app.vault.adapter.write(filePath, data);
				}
			}
		}

		await zipReader.close();
	}

	async removeThemes() {
		try {
			const adapter = this.app.vault.adapter;
			if (await adapter.exists(this.themeCfg)) {
				await adapter.remove(this.themeCfg);
			}
			if (await adapter.exists(this.hilightCfg)) {
				await adapter.remove(this.hilightCfg);
			}
			if (await adapter.exists(this.themesPath)) {
				await adapter.rmdir(this.themesPath, true);
			}
			if (await adapter.exists(this.hilightPath)) {
				await adapter.rmdir(this.hilightPath, true);
			}
			await this.loadAssets();
			new Notice('清空完成！');
		} catch (error) {
			console.error(error);
			new Notice('清空主题失败！');
		}
	}

	async openAssets() {
		const path = require('path');
		const adapter = this.app.vault.adapter as FileSystemAdapter;
		const vaultRoot = adapter.getBasePath();
		const assets = this.assetsPath;
		if (!await adapter.exists(assets)) {
			await adapter.mkdir(assets);
		}
		const dst = path.join(vaultRoot, assets);
		const {shell} = require('electron');
		shell.openPath(dst);
	}

	searchFile(originPath: string): TAbstractFile | null {
		const resolvedPath = this.resolvePath(originPath);
		const vault = this.app.vault;
		const attachmentFolderPath = vault.config.attachmentFolderPath || '';
		let localPath = resolvedPath;
		let file = null;

		// 然后从根目录查找
		file = vault.getFileByPath(resolvedPath);
		if (file) {
			return file;
		}

		file = vault.getFileByPath(originPath);
		if (file) {
			return file;
		}

		// 先从附件文件夹查找
		if (attachmentFolderPath != '') {
			localPath = attachmentFolderPath + '/' + originPath;
			file = vault.getFileByPath(localPath)
			if (file) {
				return file;
			}

			localPath = attachmentFolderPath + '/' + resolvedPath;
			file = vault.getFileByPath(localPath)
			if (file) {
				return file;
			}
		}

		// 最后查找所有文件
		const files = vault.getAllLoadedFiles();
		for (let f of files) {
			if (f.path.includes(originPath)) {
				return f;
			}
		}

		return null;
	}

	resolvePath(relativePath: string): string {
		const basePath = this.getActiveFileDir();
		if (!relativePath.includes('/')) {
			return relativePath;
		}
		const stack = basePath.split("/");
		const parts = relativePath.split("/");

		stack.pop(); // Remove the current file name (or empty string)

		for (const part of parts) {
			if (part === ".") continue;
			if (part === "..") stack.pop();
			else stack.push(part);
		}
		return stack.join("/");
	}

	getActiveFileDir() {
		const af = this.app.workspace.getActiveFile();
		if (af == null) {
			return '';
		}
		const parts = af.path.split('/');
		parts.pop();
		if (parts.length == 0) {
			return '';
		}
		return parts.join('/');
	}
}
