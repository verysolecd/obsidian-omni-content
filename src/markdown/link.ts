import {MarkedExtension, Tokens} from "marked";
import {LinkDescriptionMode} from "../settings";
import {Extension} from "./extension";
import { logger } from "../utils";

export class LinkRenderer extends Extension {
	// 存储链接信息：URL、描述文本和位置信息
	allLinks: { href: string, text: string, position: number }[] = [];
	// 存储需要转换为脚注的链接
	footnoteLinks: { href: string, text: string, position: number }[] = [];
	// 当前处理位置计数器
	currentPosition = 0;

	async prepare() {
		this.allLinks = [];
		this.footnoteLinks = [];
		this.currentPosition = 0;
	}

	// 检查是否为微信链接
	isWechatLink(href: string): boolean {
		return href.indexOf('https://mp.weixin.qq.com/mp') === 0 ||
			href.indexOf('https://mp.weixin.qq.com/s') === 0 ||
			href.indexOf('https://mmbiz.qpic.cn') === 0;
	}

	// 检查链接是否应该转为脚注
	shouldConvertToFootnote(href: string): boolean {
		const mode = this.settings.linkFootnoteMode;

		// 根据设置决定是否应该转换为脚注
		if (mode === 'none') {
			return false;
		} else if (mode === 'all') {
			return true;
		} else if (mode === 'non-wx') {
			// 只有非微信链接才转为脚注
			return !this.isWechatLink(href);
		}

		return false;
	}

	async postprocess(html: string) {
		// 如果没有脚注链接，直接返回原始 HTML
		if (this.footnoteLinks.length === 0) {
			return html;
		}

		// 按原始文档位置排序链接
		this.footnoteLinks.sort((a, b) => a.position - b.position);
		// 记录日志 - 此项目的logger实现可能有问题，先注释掉
		// console.debug("排序后的脚注链接:", this.footnoteLinks);

		// 生成简化的脚注列表，确保序号能正常显示
		const links = this.footnoteLinks.map((link, i) => {
			// 简化 HTML 结构，让浏览器正确处理 li 元素
			return `<li>${link.text}<br>
            <span class="footnote-url">${link.href}</span></li>`;
		});

		// 添加脚注部分，简化结构
		return `${html}<section class="footnotes">
            <hr>
            <ol>${links.join('')}</ol>
        </section>`;
	}

	markedExtension(): MarkedExtension {
		return {
			extensions: [{
				name: 'link',
				level: 'inline',
				renderer: (token: Tokens.Link) => {
					logger.debug("Link renderer called for:", token.href);

					// 记录当前位置并递增
					const position = this.currentPosition++;
					
					// 保存所有链接（带位置信息）
					this.allLinks.push({
						href: token.href, 
						text: token.text, 
						position: position
					});

					// 判断是否需要转换为脚注
					const shouldFootnote = this.shouldConvertToFootnote(token.href);

					// 如果不需要转换为脚注，直接返回普通链接
					if (!shouldFootnote) {
						return `<a href="${token.href}">${token.text}</a>`;
					}

					// 需要转换为脚注，添加到脚注链接列表（带位置信息）
					this.footnoteLinks.push({
						href: token.href, 
						text: token.text, 
						position: position
					});

					// 返回脚注形式的链接
					const text = this.settings.linkDescriptionMode === LinkDescriptionMode.Empty ? "" : token.text;
					return `<a>${text}<sup>[${this.footnoteLinks.length}]</sup></a>`;
				}
			}]
		}
	}
}
