

import { Marked } from "marked";
import { NMPSettings } from "src/settings";
import { App, Vault } from "obsidian";
import AssetsManager from "../assets";
import { Extension, MDRendererCallback } from "./extension";
import { CalloutRenderer } from "./callouts";
import { CodeHighlight } from "./code-highlight";
import { CodeRenderer } from "./code";
import { EmbedBlockMark } from "./embed-block-mark";
import { SVGIcon } from "./icons";
import { LinkRenderer } from "./link";
import { LocalFile } from "./local-file";
import { MathRenderer } from "./math";
import { TextHighlight } from "./text-highlight";

const markedOptiones = {
	gfm: true,
	breaks: true,
};

const customRenderer = {
	heading(text: string, level: number, raw: string): string {
		// ignore IDs
		return `<h${level}><span class="prefix"></span><span class="content">${text}</span><span class="suffix"></span></h${level}>`;
	},

	hr(): string {
		return "<hr>";
	},

	list(body: string, ordered: boolean, start: number | ""): string {
		const type = ordered ? "ol" : "ul";
		const startatt = ordered && start !== 1 ? ' start="' + start + '"' : "";
		return `<${type}${startatt}>${body}</${type}>`;
	},

	listitem(text: string, task: boolean, checked: boolean): string {
		// Add a marker to identify if this list item contains nested lists
		const hasNestedList = text.includes('<ul') || text.includes('<ol');
		
		if (isWeChatMode && hasNestedList) {
			// For WeChat, we'll extract the nested list in post-processing
			// Mark the list item so we can identify it later
			return `<li data-has-nested="true">${text}</li>`;
		}
		
		return `<li>${text}</li>`;
	},
};

// Flag to indicate if we're rendering for WeChat
let isWeChatMode = false;

// Helper to set rendering mode
export function setWeChatMode(enabled: boolean) {
	isWeChatMode = enabled;
}

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
			new TextHighlight(app, settings, assetsManager, callback)
		);
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
		this.marked.use({ renderer: customRenderer });
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
		let html = await this.marked.parse(content);
		html = await this.postprocess(html);
		return html;
	}
}
