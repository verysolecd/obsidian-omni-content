import {Marked} from "marked";
import {App, Vault} from "obsidian";
import {NMPSettings} from "src/settings";
import AssetsManager from "../assets";
import {CalloutRenderer} from "./callouts";
import {CodeRenderer} from "./code";
import {CodeHighlight} from "./code-highlight";
import {EmbedBlockMark} from "./embed-block-mark";
import {Extension, MDRendererCallback} from "./extension";
import {FootnoteRenderer} from "./footnote";
import {SVGIcon} from "./icons";
import {LinkRenderer} from "./link";
import {LocalFile} from "./local-file";
import {MathRenderer} from "./math";
import {TextHighlight} from "./text-highlight";
import { logger } from "src/utils";
import { ExtensionManager } from "./extension-manager";

const markedOptions = {
gfm: true,
breaks: true,
mangle: false,   // 禁用自动检测并转换邮箱地址为链接
};

const customRenderer = {
	heading(text: string, level: number, raw: string): string {
		// ignore IDs
		return `<h${level}><span class="prefix"></span><span class="content">${text}</span><span class="suffix"></span></h${level}>`;
	},

	hr(): string {
		return "<hr>";
	},

};

export class MarkedParser {
	extensions: Extension[] = [];
	marked: Marked;
	app: App;
	vault: Vault;

	constructor(app: App, callback: MDRendererCallback) {
		this.app = app;
		this.vault = app.vault;

		const settings = NMPSettings.getInstance();
		const assetsManager = AssetsManager.getInstance();

		this.extensions.push(
			new LocalFile(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CalloutRenderer(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CodeHighlight(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new EmbedBlockMark(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new SVGIcon(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new LinkRenderer(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new FootnoteRenderer(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new TextHighlight(app, settings, assetsManager, callback)
		);
		this.extensions.push(
			new CodeRenderer(app, settings, assetsManager, callback)
		);		
		this.extensions.push(
				new MathRenderer(app, settings, assetsManager, callback)
		);
				
		logger.debug(`初始化了 ${this.extensions.length} 个markdown扩展插件`);
		
		// 设置ExtensionManager实例
		ExtensionManager.getInstance().setParser(this);
	}
	
	/**
	 * 获取所有已注册的扩展插件
	 * @returns 扩展插件数组
	 */
	getExtensions(): Extension[] {
		return [...this.extensions];
	}
	
	/**
	 * 获取所有启用的扩展插件
	 * @returns 启用的扩展插件数组
	 */
	getEnabledExtensions(): Extension[] {
		return this.extensions.filter(ext => ext.isEnabled());
	}
	
	/**
	 * 根据名称获取扩展插件
	 * @param name 插件名称
	 * @returns 扩展插件实例或null
	 */
	getExtensionByName(name: string): Extension | null {
		return this.extensions.find(ext => ext.getName() === name) || null;
	}
	
	/**
	 * 设置扩展插件启用状态
	 * @param name 插件名称
	 * @param enabled 是否启用
	 * @returns 是否成功设置
	 */
	setExtensionEnabled(name: string, enabled: boolean): boolean {
		const extension = this.getExtensionByName(name);
		if (extension) {
			extension.setEnabled(enabled);
			logger.debug(`${enabled ? '启用' : '禁用'}了扩展插件: ${name}`);
			return true;
		}
		logger.warn(`未找到扩展插件: ${name}`);
		return false;
	}

async buildMarked() {
this.marked = new Marked();
if (!this.marked) {
  logger.error("Failed to create Marked instance");
  return;
}
this.marked.use(markedOptions);
		
// 只对启用的扩展应用marked扩展
const enabledExtensions = this.getEnabledExtensions();
logger.debug(`构建marked实例，使用 ${enabledExtensions.length}/${this.extensions.length} 个启用的扩展插件`);

for (const ext of enabledExtensions) {
  if (!ext) {
    logger.warn("Found null extension, skipping");
    continue;
  }
  try {
    const extension = ext.markedExtension();
    if (extension) {
      this.marked.use(extension);
      ext.marked = this.marked;
      await ext.prepare();
    }
  } catch (error) {
    logger.error(`Error applying extension ${ext.getName()}: ${error}`);
  }
}
		this.marked.use({renderer: customRenderer});
	}

	async prepare() {
		// 只对启用的扩展执行prepare
		const enabledExtensions = this.getEnabledExtensions();
		for (const ext of enabledExtensions) {
			await ext.prepare();
		}
	}

	async postprocess(html: string) {
		let result = html;
		// 只对启用的扩展执行postprocess
		const enabledExtensions = this.getEnabledExtensions();
		for (const ext of enabledExtensions) {
			result = await ext.postprocess(result);
		}
		return result;
	}

async parse(content: string) {
if (!this.marked) {
  await this.buildMarked();
  if (!this.marked) {
    logger.error("Marked 解析器初始化失败");
    return "Marked 解析器初始化失败";
  }
}
try {
  await this.prepare();

		// 预处理 Markdown 内容，处理脚注定义
		let processedContent = content;
		const footnoteRenderer = this.extensions.find(ext => ext instanceof FootnoteRenderer) as FootnoteRenderer | undefined;
		if (footnoteRenderer) {
			processedContent = footnoteRenderer.preprocessText(content);
		}

  // 解析处理后的内容
  let html = await this.marked.parse(processedContent);
  html = await this.postprocess(html);

  // 如果有脚注处理器，在发布前确保脚注引用正确
  if (footnoteRenderer) {
    await footnoteRenderer.beforePublish();
  }

  return html;
} catch (error) {
  logger.error("解析Markdown内容时出错:", error);
  return `<div class="error-message">解析Markdown内容时出错: ${error.message}</div>`;
}
	}
}
