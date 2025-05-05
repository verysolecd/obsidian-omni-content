

import {
	App,
	TextAreaComponent,
	PluginSettingTab,
	Setting,
	Notice,
	sanitizeHTMLToDom,
	FileSystemAdapter,
} from "obsidian";
import OmniContentPlugin from "./main";
import { wxGetToken, wxEncrypt } from "./weixin-api";
import { cleanMathCache } from "./markdown/math";
import { LinkDescriptionMode, LinkFootnoteMode, NMPSettings } from "./settings";
import TemplateManager from "./template-manager";
import { DistributionService, PlatformType } from "./distribution";
import { logger } from "./utils";

export class OmniContentSettingTab extends PluginSettingTab {
	plugin: OmniContentPlugin;
	wxInfo: string;
	wxTextArea: TextAreaComponent | null;
	settings: NMPSettings;

	constructor(app: App, plugin: OmniContentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = NMPSettings.getInstance();
		this.wxInfo = this.parseWXInfo();
	}

	displayWXInfo(txt: string) {
		this.wxTextArea?.setValue(txt);
	}

	parseWXInfo() {
		const wxInfo = this.settings.wxInfo;
		if (wxInfo.length == 0) {
			return "";
		}

		let res = "";
		for (let wx of wxInfo) {
			res += `${wx.name}|${wx.appid}|********\n`;
		}
		return res;
	}

	async clear() {
		this.settings.wxInfo = [];
		await this.plugin.saveSettings();
		this.wxInfo = "";
		this.displayWXInfo("");
	}

	display() {
		const { containerEl } = this;

		containerEl.empty();

		this.wxInfo = this.parseWXInfo();

		new Setting(containerEl).setName("默认样式").addDropdown((dropdown) => {
			const styles = this.plugin.assetsManager.themes;
			for (let s of styles) {
				dropdown.addOption(s.className, s.name);
			}
			dropdown.setValue(this.settings.defaultStyle);
			dropdown.onChange(async (value) => {
				this.settings.defaultStyle = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl).setName("代码高亮").addDropdown((dropdown) => {
			const styles = this.plugin.assetsManager.highlights;
			for (let s of styles) {
				dropdown.addOption(s.name, s.name);
			}
			dropdown.setValue(this.settings.defaultHighlight);
			dropdown.onChange(async (value) => {
				this.settings.defaultHighlight = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName("在工具栏展示样式选择")
			.setDesc("建议在移动端关闭，可以增大文章预览区域")
			.addToggle((toggle) => {
				toggle.setValue(this.settings.showStyleUI);
				toggle.onChange(async (value) => {
					this.settings.showStyleUI = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("链接转换脚注模式")
			.setDesc("控制哪些链接应该转换为脚注")
			.addDropdown((dropdown) => {
				dropdown.addOption("none", "都不转换");
				dropdown.addOption("all", "所有链接转换");
				dropdown.addOption("non-wx", "仅非微信链接转换");
				dropdown.setValue(this.settings.linkFootnoteMode);
				dropdown.onChange(async (value) => {
					this.settings.linkFootnoteMode = value as LinkFootnoteMode;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("脚注链接描述模式")
			.setDesc("控制脚注中链接的展示形式")
			.addDropdown((dropdown) => {
				dropdown.addOption("empty", "不显示描述");
				dropdown.addOption("description", "显示链接描述");
				dropdown.setValue(this.settings.linkDescriptionMode);
				dropdown.onChange(async (value) => {
					this.settings.linkDescriptionMode =
						value as LinkDescriptionMode;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("文件嵌入展示样式")
			.addDropdown((dropdown) => {
				dropdown.addOption("quote", "引用");
				dropdown.addOption("content", "正文");
				dropdown.setValue(this.settings.embedStyle);
				dropdown.onChange(async (value) => {
					this.settings.embedStyle = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("数学公式语法")
			.addDropdown((dropdown) => {
				dropdown.addOption("latex", "latex");
				dropdown.addOption("asciimath", "asciimath");
				dropdown.setValue(this.settings.math);
				dropdown.onChange(async (value) => {
					this.settings.math = value;
					cleanMathCache();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setName("显示代码行号").addToggle((toggle) => {
			toggle.setValue(this.settings.lineNumber);
			toggle.onChange(async (value) => {
				this.settings.lineNumber = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName("获取更多主题")
			.addButton((button) => {
				button.setButtonText("下载");
				button.onClick(async () => {
					button.setButtonText("下载中...");
					await this.plugin.assetsManager.downloadThemes();
					button.setButtonText("下载完成");
				});
			})
			.addButton((button) => {
				button.setIcon("folder-open");
				button.onClick(async () => {
					await this.plugin.assetsManager.openAssets();
				});
			});

		new Setting(containerEl).setName("清空主题").addButton((button) => {
			button.setButtonText("清空");
			button.onClick(async () => {
				await this.plugin.assetsManager.removeThemes();
				this.settings.resetStyelAndHighlight();
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName("CSS代码片段")
			.addToggle((toggle) => {
				toggle.setValue(this.settings.useCustomCss);
				toggle.onChange(async (value) => {
					this.settings.useCustomCss = value;
					await this.plugin.saveSettings();
				});
			})
			.addButton((button) => {
				button.setIcon("refresh-ccw");
				button.onClick(async () => {
					await this.plugin.assetsManager.loadCustomCSS();
					new Notice("刷新成功");
				});
			})
			.addButton((button) => {
				button.setIcon("folder-open");
				button.onClick(async () => {
					await this.plugin.assetsManager.openAssets();
				});
			});

		// 模板设置部分
		containerEl.createEl("h2", { text: "模板设置" });

		new Setting(containerEl)
			.setName("使用模板")
			.setDesc("启用后，将使用模板来包装渲染的内容")
			.addToggle((toggle) => {
				toggle.setValue(this.settings.useTemplate);
				toggle.onChange(async (value) => {
					this.settings.useTemplate = value;
					await this.plugin.saveSettings();
				});
			});

		// 获取模板列表并显示下拉框
		const templateManager = TemplateManager.getInstance();
		const templates = templateManager.getTemplateNames();

		new Setting(containerEl)
			.setName("默认模板")
			.setDesc("选择默认使用的模板")
			.addDropdown((dropdown) => {
				// 添加模板选项
				templates.forEach((template) => {
					dropdown.addOption(template, template);
				});

				// 如果没有默认模板选项，但有模板列表，则设置第一个为默认
				if (
					templates.length > 0 &&
					!templates.includes(this.settings.defaultTemplate)
				) {
					this.settings.defaultTemplate = templates[0];
				}

				// 设置当前值
				if (templates.includes(this.settings.defaultTemplate)) {
					dropdown.setValue(this.settings.defaultTemplate);
				}

				dropdown.onChange(async (value) => {
					this.settings.defaultTemplate = value;
					await this.plugin.saveSettings();
				});
			});

		// 添加管理模板的按钮
		new Setting(containerEl)
			.setName("管理模板")
			.setDesc("创建、编辑或删除模板")
			.addButton((button) => {
				button.setButtonText("打开模板文件夹").onClick(() => {
					// 打开模板文件夹
					try {
						const { shell } = require("electron");
						const path = require("path");
						const adapter = this.app.vault.adapter as FileSystemAdapter;
						const vaultRoot = adapter.getBasePath();
						const templatesPath = `${this.app.vault.configDir}/plugins/obsidian-omni-content/templates/`;
						const dst = path.join(vaultRoot, templatesPath);
						shell.openPath(dst);
					} catch (error) {
						console.error("打开模板文件夹失败:", error);
						new Notice("打开模板文件夹失败！");
					}
				});
			})
			.addButton((button) => {
				button.setButtonText("重新加载模板").onClick(async () => {
					await templateManager.loadTemplates();
					new Notice("模板重新加载完成！");
					// 刷新设置界面
					this.display();
				});
			});

		// === 内容分发设置 ===
		containerEl.createEl("h2", { text: "内容分发设置" });
		containerEl.createEl("p", { 
			text: "配置各平台的认证信息，以便将内容分发到对应平台。",
			cls: "setting-item-description"
		});

		// 初始化分发服务
		const distributionService = DistributionService.getInstance();

		// 加载现有配置
		const distributionConfig = this.settings.distributionConfig || {};
		if (!this.settings.distributionConfig) {
			this.settings.distributionConfig = {};
		}

		// 微信公众号平台配置
		const wxConfig = distributionConfig[PlatformType.WECHAT] || {};
		const wxAuthSection = containerEl.createDiv({ cls: "platform-auth-section" });
		wxAuthSection.createEl("h3", { text: "微信公众号" });
		wxAuthSection.createEl("p", { 
			text: "使用上方公众号配置，无需重复输入。",
			cls: "setting-item-description" 
		});

		new Setting(wxAuthSection)
			.setName("启用微信公众号分发")
			.addToggle(toggle => {
				toggle.setValue(wxConfig.enabled || false);
				toggle.onChange(async (value) => {
					if (!distributionConfig[PlatformType.WECHAT]) {
						distributionConfig[PlatformType.WECHAT] = {};
					}
					distributionConfig[PlatformType.WECHAT].enabled = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
					logger.info("已更新微信公众号分发设置");
				});
			});

		// 知乎平台配置
		const zhihuConfig = distributionConfig[PlatformType.ZHIHU] || {};
		const zhihuAuthSection = containerEl.createDiv({ cls: "platform-auth-section" });
		zhihuAuthSection.createEl("h3", { text: "知乎" });

		new Setting(zhihuAuthSection)
			.setName("启用知乎分发")
			.addToggle(toggle => {
				toggle.setValue(zhihuConfig.enabled || false);
				toggle.onChange(async (value) => {
					if (!distributionConfig[PlatformType.ZHIHU]) {
						distributionConfig[PlatformType.ZHIHU] = {};
					}
					distributionConfig[PlatformType.ZHIHU].enabled = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
					logger.info("已更新知乎分发设置");
				});
			});

		new Setting(zhihuAuthSection)
			.setName("知乎 Cookie")
			.setDesc("从浏览器复制的知乎登录态 Cookie 字符串")
			.addTextArea(text => {
				text.setValue(zhihuConfig.cookie || "");
				text.inputEl.style.minHeight = "80px";
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.ZHIHU]) {
						distributionConfig[PlatformType.ZHIHU] = {};
					}
					distributionConfig[PlatformType.ZHIHU].cookie = value;
					distributionConfig[PlatformType.ZHIHU].token = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

		// 小红书平台配置
		const xhsConfig = distributionConfig[PlatformType.XIAOHONGSHU] || {};
		const xhsAuthSection = containerEl.createDiv({ cls: "platform-auth-section" });
		xhsAuthSection.createEl("h3", { text: "小红书" });

		new Setting(xhsAuthSection)
			.setName("启用小红书分发")
			.addToggle(toggle => {
				toggle.setValue(xhsConfig.enabled || false);
				toggle.onChange(async (value) => {
					if (!distributionConfig[PlatformType.XIAOHONGSHU]) {
						distributionConfig[PlatformType.XIAOHONGSHU] = {};
					}
					distributionConfig[PlatformType.XIAOHONGSHU].enabled = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
					logger.info("已更新小红书分发设置");
				});
			});

		new Setting(xhsAuthSection)
			.setName("小红书 Cookie")
			.setDesc("从浏览器复制的小红书登录态 Cookie 字符串")
			.addTextArea(text => {
				text.setValue(xhsConfig.cookie || "");
				text.inputEl.style.minHeight = "80px";
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.XIAOHONGSHU]) {
						distributionConfig[PlatformType.XIAOHONGSHU] = {};
					}
					distributionConfig[PlatformType.XIAOHONGSHU].cookie = value;
					distributionConfig[PlatformType.XIAOHONGSHU].token = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

		// Twitter平台配置
		const twitterConfig = distributionConfig[PlatformType.TWITTER] || {};
		const twitterAuthSection = containerEl.createDiv({ cls: "platform-auth-section" });
		twitterAuthSection.createEl("h3", { text: "Twitter" });

		new Setting(twitterAuthSection)
			.setName("启用Twitter分发")
			.addToggle(toggle => {
				toggle.setValue(twitterConfig.enabled || false);
				toggle.onChange(async (value) => {
					if (!distributionConfig[PlatformType.TWITTER]) {
						distributionConfig[PlatformType.TWITTER] = {};
					}
					distributionConfig[PlatformType.TWITTER].enabled = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
					logger.info("已更新Twitter分发设置");
				});
			});

		new Setting(twitterAuthSection)
			.setName("Twitter API Key")
			.setDesc("Twitter API 开发者密钥")
			.addText(text => {
				text.setValue(twitterConfig.apiKey || "");
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.TWITTER]) {
						distributionConfig[PlatformType.TWITTER] = {};
					}
					distributionConfig[PlatformType.TWITTER].apiKey = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

		new Setting(twitterAuthSection)
			.setName("Twitter API Secret")
			.setDesc("Twitter API 开发者密钥")
			.addText(text => {
				text.setValue(twitterConfig.apiSecret || "");
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.TWITTER]) {
						distributionConfig[PlatformType.TWITTER] = {};
					}
					distributionConfig[PlatformType.TWITTER].apiSecret = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

		new Setting(twitterAuthSection)
			.setName("Twitter Access Token")
			.setDesc("Twitter API 访问令牌")
			.addText(text => {
				text.setValue(twitterConfig.accessToken || "");
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.TWITTER]) {
						distributionConfig[PlatformType.TWITTER] = {};
					}
					distributionConfig[PlatformType.TWITTER].accessToken = value;
					distributionConfig[PlatformType.TWITTER].token = value;
					this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

		new Setting(twitterAuthSection)
			.setName("Twitter Access Token Secret")
			.setDesc("Twitter API 访问令牌密钥")
			.addText(text => {
				text.setValue(twitterConfig.accessTokenSecret || "");
				text.onChange(async (value) => {
					if (!distributionConfig[PlatformType.TWITTER]) {
						distributionConfig[PlatformType.TWITTER] = {};
					}
					distributionConfig[PlatformType.TWITTER].accessTokenSecret = value;
						this.settings.distributionConfig = distributionConfig;
					await this.plugin.saveSettings();
					distributionService.loadConfig(distributionConfig);
				});
			});

	}
}
