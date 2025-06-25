import {BaseProcess} from "src/rehype-plugins/base-process";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";
import {toPng} from "html-to-image";
import {Notice} from "obsidian";
import {wxUploadImage} from "../weixin-api";

/**
 * 微信公众号卡片数据管理器
 */
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

	public restoreCard(html: string): string {
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

/**
 * 代码块处理插件 - 处理微信公众号中的代码格式和行号显示
 */
export class CodeBlocks extends BaseProcess {
    getName(): string {
        return "代码块处理插件";
    }

    /**
     * 将base64图片转换为Blob对象
     * @param src base64图片数据
     * @returns Blob对象
     */
    static srcToBlob(src: string): Blob {
        const base64 = src.split(",")[1];
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], {type: "image/png"});
    }

    /**
     * 上传Mermaid图片到微信公众号
     * @param root HTML根元素
     * @param token 微信API令牌
     */
    static async uploadMermaidImages(root: HTMLElement, token: string): Promise<void> {
        const imgs = root.querySelectorAll("." + MermaidImgClassName);
        for (let img of imgs) {
            const src = img.getAttribute("src");
            if (!src) continue;
            if (src.startsWith("http")) continue;
            const blob = CodeBlocks.srcToBlob(img.getAttribute("src")!);
            const name = img.id + ".png";
            const res = await wxUploadImage(blob, name, 'image', token);
            if (res.errcode !== 0) {
                const msg = `上传图片失败: ${res.errcode} ${res.errmsg}`;
                new Notice(msg);
                console.error(msg);
                continue;
            }
            const url = res.url;
            img.setAttribute("src", url);
        }
    }

    /**
     * 获取插件配置的元数据
     * @returns 插件配置的元数据
     */
    getMetaConfig() {
        return {
            codeWrap: {
                type: "switch" as const,
                title: "代码换行"
            }
        };
    }

    /**
     * 获取代码换行配置
     * @returns 是否启用代码换行
     */
    private getCodeWrapConfig(): boolean {
        return this._config.codeWrap as boolean ?? false; // 默认为false（不换行）
    }

    /**
     * 将highlight.js的类样式转换为内联样式，以支持微信编辑器
     * @param codeElement 代码元素
     */
    private convertHighlightToInlineStyles(codeElement: HTMLElement): void {
        // 定义highlight.js类到颜色的映射（基于常见主题）
        const hljs_color_map: Record<string, string> = {
            'hljs-comment': '#999999',           // 注释 - 灰色
            'hljs-quote': '#999999',             // 引用 - 灰色
            'hljs-keyword': '#0000ff',           // 关键字 - 蓝色
            'hljs-selector-tag': '#0000ff',      // 标签选择器 - 蓝色
            'hljs-addition': '#008000',          // 添加 - 绿色
            'hljs-number': '#0080ff',            // 数字 - 蓝色
            'hljs-string': '#008000',            // 字符串 - 绿色
            'hljs-meta': '#008000',              // 元数据 - 绿色
            'hljs-literal': '#008000',           // 字面量 - 绿色
            'hljs-doctag': '#008000',            // 文档标签 - 绿色
            'hljs-regexp': '#008000',            // 正则表达式 - 绿色
            'hljs-title': '#ff0000',             // 标题 - 红色
            'hljs-section': '#ff0000',           // 章节 - 红色
            'hljs-name': '#ff0000',              // 名称 - 红色
            'hljs-selector-id': '#ff0000',       // ID选择器 - 红色
            'hljs-selector-class': '#ff0000',    // 类选择器 - 红色
            'hljs-attribute': '#ff8000',         // 属性 - 橙色
            'hljs-attr': '#ff8000',              // 属性简写 - 橙色
            'hljs-variable': '#ff8000',          // 变量 - 橙色
            'hljs-template-variable': '#ff8000', // 模板变量 - 橙色
            'hljs-type': '#ff8000',              // 类型 - 橙色
            'hljs-symbol': '#800080',            // 符号 - 紫色
            'hljs-bullet': '#800080',            // 列表符号 - 紫色
            'hljs-built_in': '#800080',          // 内建 - 紫色
            'hljs-builtin-name': '#800080',      // 内建名称 - 紫色
            'hljs-link': '#0000ff',              // 链接 - 蓝色
            'hljs-emphasis': 'font-style: italic', // 强调 - 斜体
            'hljs-strong': 'font-weight: bold',    // 加粗 - 粗体
            'hljs-formula': '#800080',           // 公式 - 紫色
            'hljs-punctuation': '#333333',       // 标点符号 - 深灰色
        };

        // 查找所有包含hljs类的span元素
        const highlightSpans = codeElement.querySelectorAll('[class*="hljs-"]');
        
        highlightSpans.forEach((span: Element) => {
            const htmlSpan = span as HTMLElement;
            const className = htmlSpan.className;
            
            // 查找匹配的hljs类
            for (const [hljs_class, color] of Object.entries(hljs_color_map)) {
                if (className.includes(hljs_class)) {
                    if (color.includes(':')) {
                        // 处理特殊样式（如斜体、粗体）
                        htmlSpan.setAttribute('style', color);
                    } else {
                        // 处理颜色样式
                        htmlSpan.setAttribute('style', `color: ${color}`);
                    }
                    break;
                }
            }
        });

        logger.debug(`转换了 ${highlightSpans.length} 个高亮元素为内联样式`);
        
        // 转换空格为不间断空格以保持缩进
        this.preserveIndentation(codeElement);
    }

    /**
     * 将代码中的空格转换为不间断空格，以在微信编辑器中保持缩进
     * @param codeElement 代码元素
     */
    private preserveIndentation(codeElement: HTMLElement): void {
        // 彻底重构换行逻辑，避免微信编辑器的自动换行转换
        let html = codeElement.innerHTML.trim();
        
        // 按行分割，然后重新手动构建
        const lines = html.split('\n');
        
        // 处理每一行
        const processedLines = lines.map((line, index) => {
            // 替换行首空格为不间断空格
            const processedLine = line.replace(/^( {2,})/, (match) => {
                return '&nbsp;'.repeat(match.length);
            });
            
            // 如果是第一行（比如 {），不在前面加<br>
            if (index === 0) {
                return processedLine;
            }
            
            // 其他行前面加<br>来换行
            return '<br>' + processedLine;
        });
        
        // 组合所有行，不使用\n分隔符
        const result = processedLines.join('');
        
        codeElement.innerHTML = result;
        logger.debug("已重构换行逻辑，避免微信编辑器自动转换");
    }

    process(html: string, settings: NMPSettings): string {
        try {
            // 首先处理微信公众号卡片恢复
            html = CardDataManager.getInstance().restoreCard(html);

            // 如果启用了微信代码格式化，跳过此插件的其他处理
            if (settings.enableWeixinCodeFormat) {
                logger.debug("微信代码格式化已启用，跳过代码块处理插件");
                return html;
            }

            // 调试：记录传入的HTML结构
            logger.debug("CodeBlocks插件接收到的HTML:", html.substring(0, 500));

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // 查找所有代码块 - 包括各种可能的嵌套结构
            const codeBlocks = doc.querySelectorAll("pre code, section.code-section pre code, .code-content pre code");
            
            // 获取代码换行配置
            const enableCodeWrap = this.getCodeWrapConfig();

            codeBlocks.forEach((codeBlock) => {
                const pre = codeBlock.parentElement;
                if (!pre) return;

                // 移除语言标识和复制按钮
                const languageElements = pre.querySelectorAll(".language-label, .copy-button, .code-language, .language-selector");
                languageElements.forEach(el => el.remove());

                // 首先检查是否已经有高亮标记
                let hasHighlight = codeBlock.classList.contains('hljs') || 
                                    codeBlock.innerHTML.includes('<span class="hljs-') ||
                                    codeBlock.innerHTML.includes('class="hljs-');
                
                // 应用基础的微信样式（对所有代码块都应用）
                pre.style.background = "#f8f8f8";
                pre.style.borderRadius = "4px";
                pre.style.padding = "16px";
                pre.style.overflow = "auto";
                pre.style.fontSize = "14px";
                pre.style.lineHeight = "1.5";

                // 初始化语法高亮
                const codeElement = codeBlock as HTMLElement;
                if (window.hljs && !hasHighlight) {
                    window.hljs.highlightElement(codeElement);
                    hasHighlight = true; // 更新高亮状态
                }

                if (hasHighlight) {
                    // 如果有高亮，应用基础样式并转换高亮为内联样式
                    logger.debug("检测到代码高亮，转换高亮样式为内联样式以支持微信");
                    this.convertHighlightToInlineStyles(codeBlock as HTMLElement);
                    return;
                }

                // 对没有高亮的代码块进行完整处理
                logger.debug("处理无高亮代码块，应用完整样式和功能");
                
                // 根据配置设置代码换行
                if (enableCodeWrap) {
                    // 启用换行的样式
                    const wrapStyles = "white-space: pre-wrap !important; word-break: break-all !important; overflow-x: visible !important; word-wrap: break-word !important;";
                    pre.setAttribute("style", pre.getAttribute("style") + "; " + wrapStyles);
                    (codeBlock as HTMLElement).setAttribute("style", (codeBlock as HTMLElement).getAttribute("style") + "; " + wrapStyles);
                } else {
                    // 禁用换行的样式 - 加强版
                    const noWrapStyles = "white-space: pre !important; word-break: normal !important; overflow-x: auto !important; word-wrap: normal !important; text-wrap: nowrap !important; overflow-wrap: normal !important;";
                    pre.setAttribute("style", pre.getAttribute("style") + "; " + noWrapStyles);
                    (codeBlock as HTMLElement).setAttribute("style", ((codeBlock as HTMLElement).getAttribute("style") || "") + "; " + noWrapStyles);
                }

                // 处理行号显示
                if (settings.lineNumber) {
                    const lines = codeBlock.innerHTML.split("\n");
                    const numberedLines = lines
                        .map((line, index) => `<span class="line-number">${index + 1}</span>${line}`)
                        .join("\n");

                    // 添加行号样式
                    const style = document.createElement("style");
                    style.textContent = `
                      .line-number {
                        display: inline-block;
                        width: 2em;
                        text-align: right;
                        padding-right: 1em;
                        margin-right: 1em;
                        color: #999;
                        border-right: 1px solid #ddd;
                      }
                    `;
                    pre.appendChild(style);

                    // 更新代码块内容
                    codeBlock.innerHTML = numberedLines;
                }
            });

            const result = doc.body.innerHTML;
            // 调试：记录处理后的HTML结构
            logger.debug("CodeBlocks插件处理后的HTML:", result.substring(0, 500));
            return result;
        } catch (error) {
            logger.error("处理代码块时出错:", error);
            return html;
        }
    }
}