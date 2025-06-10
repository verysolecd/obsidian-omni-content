import {toPng} from "html-to-image";
import {Tokens} from "marked";
import {MarkdownView, Notice} from "obsidian";
import {wxUploadImage} from "../weixin-api";
import {WeixinCodeFormatter} from "./weixin-code-formatter";
import {GetCallout} from "./callouts";
import {Extension} from "./extension";
import {MathRendererQueue} from "./math";

export class CardDataManager {
	private cardData: Map<string, string>;
	private static instance: CardDataManager;

	private constructor() {
		this.cardData = new Map<string, string>();
	}

	// 静态方法，用于获取实例
	public static getInstance(): CardDataManager {
		if (!CardDataManager.instance) {
			CardDataManager.instance = new CardDataManager();
		}
		return CardDataManager.instance;
	}

	public setCardData(id: string, cardData: string) {
		this.cardData.set(id, cardData);
	}

	public cleanup() {
		this.cardData.clear();
	}

	public restoreCard(html: string) {
		for (const [key, value] of this.cardData.entries()) {
			const exp = `<section[^>]*\\sdata-id="${key}"[^>]*>(.*?)<\\/section>`;
			const regex = new RegExp(exp, "gs");
			if (!regex.test(html)) {
				console.error("未能正确替换公众号卡片");
			}
			html = html.replace(regex, value);
		}
		return html;
	}
}

const MermaidSectionClassName = "note-mermaid";
const MermaidImgClassName = "note-mermaid-img";

export class CodeRenderer extends Extension {
	getName(): string {
		return "CodeRenderer";
	}

	showLineNumber: boolean;
	mermaidIndex: number;

	async prepare() {
		this.mermaidIndex = 0;
	}

	static srcToBlob(src: string) {
		const base64 = src.split(",")[1];
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray], {type: "image/png"});
	}

	static async uploadMermaidImages(root: HTMLElement, token: string) {
		const imgs = root.querySelectorAll("." + MermaidImgClassName);
		for (let img of imgs) {
			const src = img.getAttribute("src");
			if (!src) continue;
			if (src.startsWith("http")) continue;
			const blob = CodeRenderer.srcToBlob(img.getAttribute("src")!);
			const name = img.id + ".png";
			const res = await wxUploadImage(blob, name, token);
			if (res.errcode != 0) {
				const msg = `上传图片失败: ${res.errcode} ${res.errmsg}`;
				new Notice(msg);
				console.error(msg);
				continue;
			}
			const url = res.url;
			img.setAttribute("src", url);
		}
	}

	codeRenderer(code: string, infostring: string | undefined): string {
		console.log("codeRenderer", {code, infostring});

		const lang = (infostring || "").match(/^\S*/)?.[0];
		code = code.replace(/\n$/, "") + "\n";

		// 如果启用了微信代码格式化，直接返回微信格式
		if (this.settings.enableWeixinCodeFormat) {
			if (lang) {
				return WeixinCodeFormatter.formatCodeForWeixin(code, lang);
			} else {
				return WeixinCodeFormatter.formatPlainCodeForWeixin(code);
			}
		}

		if (this.settings.lineNumber) {
			const lines = code.split("\n");

			let liItems = "";
			let count = 1;
			while (count < lines.length) {
				liItems = liItems + `<li>${count}</li>`;
				count = count + 1;
			}

			// Create a code-section with both line numbers and code content side by side
			const codeContent = !lang
				? `<pre><code>${code}</code></pre>`
				: `<pre><code class="hljs language-${lang}">${code}</code></pre>`;

			return (
				'<section class="code-section">'
				// + '<div class="line-numbers"><ul>' + liItems + '</ul></div>'
				+ '<div class="code-content">' + codeContent + '</div>'
				+ '</section>\n'
			);
		} else {
			// No line numbers, simpler structure
			if (!lang) {
				return '<section class="code-section"><pre><code>' + code + '</code></pre></section>\n';
			}

			return '<section class="code-section"><pre><code class="hljs language-' + lang + '">' + code + '</code></pre></section>\n';
		}
	}

	static getMathType(lang: string | null) {
		if (!lang) return null;
		let l = lang.toLowerCase();
		l = l.trim();
		if (l === "am" || l === "asciimath") return "asciimath";
		if (l === "latex" || l === "tex") return "latex";
		return null;
	}

	parseCard(htmlString: string) {
		const id = /data-id="([^"]+)"/;
		const headimgRegex = /data-headimg="([^"]+)"/;
		const nicknameRegex = /data-nickname="([^"]+)"/;
		const signatureRegex = /data-signature="([^"]+)"/;

		const idMatch = htmlString.match(id);
		const headimgMatch = htmlString.match(headimgRegex);
		const nicknameMatch = htmlString.match(nicknameRegex);
		const signatureMatch = htmlString.match(signatureRegex);

		return {
			id: idMatch ? idMatch[1] : "",
			headimg: headimgMatch ? headimgMatch[1] : "",
			nickname: nicknameMatch ? nicknameMatch[1] : "公众号名称",
			signature: signatureMatch ? signatureMatch[1] : "公众号介绍",
		};
	}

	renderCard(token: Tokens.Code) {
		const {id, headimg, nickname, signature} = this.parseCard(token.text);
		if (id === "") {
			return "<span>公众号卡片数据错误，没有id</span>";
		}
		CardDataManager.getInstance().setCardData(id, token.text);
		return `<section data-id="${id}" class="note-mpcard-wrapper"><div class="note-mpcard-content"><img class="note-mpcard-headimg" width="54" height="54" src="${headimg}"></img><div class="note-mpcard-info"><div class="note-mpcard-nickname">${nickname}</div><div class="note-mpcard-signature">${signature}</div></div></div><div class="note-mpcard-foot">公众号</div></section>`;
	}

	renderMermaid(token: Tokens.Code) {
		try {
			const meraidIndex = this.mermaidIndex;
			const containerId = `mermaid-${meraidIndex}`;
			const imgId = `meraid-img-${meraidIndex}`;
			this.mermaidIndex += 1;
			const failElement = "<span>mermaid渲染失败</span>";
			let container: HTMLElement | null = null;
			const currentFile = this.app.workspace.getActiveFile();
			const leaves = this.app.workspace.getLeavesOfType("markdown");
			for (let leaf of leaves) {
				const markdownView = leaf.view as MarkdownView;
				if (markdownView.file?.path === currentFile?.path) {
					container = markdownView.containerEl;
				}
			}
			if (container) {
				const containers = container.querySelectorAll(".mermaid");
				if (containers.length < meraidIndex) {
					return failElement;
				}
				const root = containers[meraidIndex];
				toPng(root as HTMLElement)
					.then((dataUrl) => {
						this.callback.updateElementByID(
							containerId,
							`<img id="${imgId}" class="${MermaidImgClassName}" src="${dataUrl}"></img>`
						);
					})
					.catch((error) => {
						console.error("oops, something went wrong!", error);
						this.callback.updateElementByID(
							containerId,
							failElement
						);
					});
				return `<section id="${containerId}" class="${MermaidSectionClassName}">渲染中</section>`;
			} else {
				console.error("container is null");
				return failElement;
			}
		} catch (error) {
			console.error(error.message);
			return "<span>mermaid渲染失败</span>";
		}
	}

	renderAdCallout(token: Tokens.Code) {
		try {
			// 确保 lang 存在
			if (!token.lang) {
				return this.codeRenderer(token.text, token.lang);
			}

			// 提取 callout 类型（去掉 'ad-' 前缀）
			const calloutType = token.lang.substring(3).toLowerCase();

			// 提取标题 - 默认使用 callout 类型作为标题
			let title = calloutType.charAt(0).toUpperCase() + calloutType.slice(1).toLowerCase();

			// 解析第一行内容
			const lines = token.text.split('\n');
			const firstLine = lines[0].trim();

			// 检查是否有自定义标题
			// 关键逻辑：只有当第一行是空或者第一行有内容但后面跟了一个空行时，才记为是标题
			let hasCustomTitle = false;

			// 空白行判定标准：第一行后跟空白行或没有内容
			if ((lines.length > 1 && lines[1].trim() === '') || firstLine === '') {
				// 这种情况下不将第一行内容作为标题
				hasCustomTitle = false;
			} else if (firstLine !== '') {
				// 如果有一个非空项开头，并且第二行不是空白行，这表明这是内容，不是标题
				hasCustomTitle = true; // 第一行是标题
				title = firstLine;
			}

			// 处理内容
			let content;
			if (hasCustomTitle) {
				// 如果第一行是标题，从第二行开始是内容
				content = lines.slice(1).join('\n').trim();
			} else {
				// 如果没有标题，全部都是内容
				content = token.text.trim();
			}
			const body = this.marked.parser(this.marked.lexer(content));

			// 获取 callout 样式信息
			const info = GetCallout(calloutType);
			if (!info) {
				return this.codeRenderer(token.text, token.lang);
			}

			// 生成 callout HTML
			return `<section class="ad ${info.style}"><section class="ad-title-wrap"><span class="ad-icon">${info.icon}</span><span class="ad-title">${title}<span></section><section class="ad-content">${body}</section></section>`;
		} catch (error) {
			console.error('Error rendering ad callout:', error);
			return this.codeRenderer(token.text, token.lang);
		}
	}

	markedExtension() {
		return {
			extensions: [
				{
					name: "code",
					level: "block",
					renderer: (token: Tokens.Code) => {
						// 处理 ad-xxx 语法的 callout
						if (token.lang && token.lang.startsWith("ad-")) {
							return this.renderAdCallout(token);
						}

						// 其他代码块处理逻辑
						if (this.settings.isAuthKeyVaild()) {
							const type = CodeRenderer.getMathType(
								token.lang ?? ""
							);
							if (type) {
								return MathRendererQueue.getInstance().render(
									token,
									false,
									type,
									this.callback
								);
							}
							if (
								token.lang &&
								token.lang.trim().toLocaleLowerCase() ==
								"mermaid"
							) {
								return this.renderMermaid(token);
							}
						}
						if (
							token.lang &&
							token.lang.trim().toLocaleLowerCase() == "mpcard"
						) {
							return this.renderCard(token);
						}
						return this.codeRenderer(token.text, token.lang);
					},
				},
			],
		};
	}
}
