import {MarkedExtension, Token, Tokens} from "marked";
import {requestUrl} from "obsidian";
import {NMPSettings} from "src/settings";
import {Extension, MDRendererCallback} from "./extension";

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/;
const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

const svgCache = new Map<string, string>();

export function cleanMathCache() {
	svgCache.clear();
}

export class MathRendererQueue {
	private queue: (() => Promise<any>)[] = [];
	private isProcessing: boolean = false;
	private host = 'https://obplugin.sunboshi.tech';
	private static instance: MathRendererQueue;
	private mathIndex: number = 0;

	// 静态方法，用于获取实例
	public static getInstance(): MathRendererQueue {
		if (!MathRendererQueue.instance) {
			MathRendererQueue.instance = new MathRendererQueue();
		}
		return MathRendererQueue.instance;
	}

	private constructor() {
	}

	getMathSVG(expression: string, inline: boolean, type: string, callback: (svg: string) => void) {
		const req = () => {
			return new Promise<void>((resolve, reject) => {
				let path = '';
				if (type === 'asciimath') {
					path = '/math/am';
				} else {
					path = '/math/tex';
				}

				const url = `${this.host}${path}`;
				requestUrl({
					url,
					method: 'POST',
					contentType: 'application/json',
					headers: {
						authkey: NMPSettings.getInstance().authKey
					},
					body: JSON.stringify({
						expression,
						inline
					})
				}).then(res => {
					let svg = ''
					if (res.status === 200) {
						svg = res.text;
					} else {
						console.error('render error: ' + res.json.msg)
						svg = '渲染失败';
					}
					callback(svg);
					resolve();
				}).catch(err => {
					console.log(err.msg);
					const svg = '渲染失败';
					callback(svg);
					resolve();
				})

			})
		}
		this.enqueue(req);
	}

	// 添加请求到队列
	enqueue(request: () => Promise<any>): void {
		this.queue.push(request);
		this.processQueue();
	}

	// 处理队列中的请求
	private async processQueue(): Promise<void> {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;

		while (this.queue.length > 0) {
			const request = this.queue.shift();
			if (request) {
				try {
					await request();
				} catch (error) {
					console.error('Request failed:', error);
				}
			}
		}

		this.isProcessing = false;
	}

	generateId() {
		this.mathIndex += 1;
		return `math-id-${this.mathIndex}`;
	}

	render(token: Tokens.Generic, inline: boolean, type: string, callback: MDRendererCallback) {
		

		const id = this.generateId();
		let svg = '渲染中';
		const expression = token.text;
		if (svgCache.has(token.text)) {
			svg = svgCache.get(expression) as string;
		} else {
			this.getMathSVG(expression, inline, type, (svg: string) => {
				svgCache.set(expression, svg);
				callback.updateElementByID(id, svg);
			})
		}

		let className = inline ? 'inline-math-svg' : 'block-math-svg';
		return `<span id="${id}" class="${className}">${svg}</span>`;
	}
}


export class MathRenderer extends Extension {

	getName(): string {
		return "MathRenderer";
	}

	renderer(token: Tokens.Generic, inline: boolean, type: string = '') {
		if (type === '') {
			type = this.settings.math;
		}
		return MathRendererQueue.getInstance().render(token, inline, type, this.callback);
	}

	markedExtension(): MarkedExtension {
		return {
			extensions: [
				this.inlineMath(),
				this.blockMath()
			]
		}
	}

	inlineMath() {
		return {
			name: 'InlineMath',
			level: 'inline',
			start(src: string) {
				let index;
				let indexSrc = src;

				while (indexSrc) {
					index = indexSrc.indexOf('$');
					if (index === -1) {
						return;
					}

					const possibleKatex = indexSrc.substring(index);

					if (possibleKatex.match(inlineRule)) {
						return index;
					}

					indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
				}
			},
			tokenizer(src: string, tokens: Token[]) {
				const match = src.match(inlineRule);
				if (match) {
					return {
						type: 'InlineMath',
						raw: match[0],
						text: match[2].trim(),
						displayMode: match[1].length === 2
					};
				}
			},
			renderer: (token: Tokens.Generic) => {
				return this.renderer(token, true);
			}
		}
	}

	blockMath() {
		return {
			name: 'BlockMath',
			level: 'block',
			tokenizer(src: string) {
				const match = src.match(blockRule);
				if (match) {
					return {
						type: 'BlockMath',
						raw: match[0],
						text: match[2].trim(),
						displayMode: match[1].length === 2
					};
				}
			},
			renderer: (token: Tokens.Generic) => {
				return this.renderer(token, false);
			}
		};
	}
}