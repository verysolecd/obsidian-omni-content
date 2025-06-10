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

const markedOptiones = {
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
		// this.extensions.push(
		// 	new CalloutRenderer(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new CodeHighlight(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new EmbedBlockMark(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new SVGIcon(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new LinkRenderer(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new FootnoteRenderer(app, settings, assetsManager, callback)
		// );
		// this.extensions.push(
		// 	new TextHighlight(app, settings, assetsManager, callback)
		// );
		this.extensions.push(
			new CodeRenderer(app, settings, assetsManager, callback)
		);
		if (settings.isAuthKeyVaild()) {
			this.extensions.push(
				new MathRenderer(app, settings, assetsManager, callback)
			);
		}
	}

	async buildMarked() {
		this.marked = new Marked();
		this.marked.use(markedOptiones);
		for (const ext of this.extensions) {
			this.marked.use(ext.markedExtension());
			ext.marked = this.marked;
			await ext.prepare();
		}
		this.marked.use({renderer: customRenderer});
	}

	async prepare() {
		this.extensions.forEach(async (ext) => await ext.prepare());
	}

	async postprocess(html: string) {
		let result = html;
		for (const ext of this.extensions) {
			result = await ext.postprocess(result);
		}
		return result;
	}

	async parse(content: string) {
		if (!this.marked) await this.buildMarked();
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
	}
}
