/*
 * Copyright (c) 2024 Sun Booshi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { Tokens, MarkedExtension } from "marked";
import { Extension } from "./extension";

export class LinkRenderer extends Extension {
    // 存储链接信息：URL和描述文本
    allLinks: {href: string, text: string}[] = [];
    
    async prepare() {
       this.allLinks = [];
    }

    // 检查是否为微信链接
    isWechatLink(href: string): boolean {
        return href.indexOf('https://mp.weixin.qq.com/mp') === 0 ||
               href.indexOf('https://mp.weixin.qq.com/s') === 0;
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
        if (this.settings.linkStyle !== 'footnote'
            || this.allLinks.length == 0) {
            return html;
        }
        
        const links = this.allLinks.map((link, i) => {
            // 根据设置决定是否显示链接描述
            if (this.settings.linkDescriptionMode === 'description' && link.text && link.text !== link.href) {
                return `<li>${link.href} - ${link.text}</li>`;
            } else {
                return `<li>${link.href}</li>`;
            }
        });
        return `${html}<seciton class="footnotes"><hr><ol>${links.join('')}</ol></section>`;
    }

    markedExtension(): MarkedExtension {
        return {
            extensions: [{
                name: 'link',
                level: 'inline',
                renderer: (token: Tokens.Link) => {
                    // 如果链接文本就是链接本身，或者是微信链接并且不应该转换
                    const isWxLink = this.isWechatLink(token.href);
                    const shouldFootnote = this.shouldConvertToFootnote(token.href);
                    
                    // 链接文本就是链接本身，或者是不需要转换的微信链接
                    if (token.text.indexOf(token.href) === 0 || 
                        (isWxLink && !shouldFootnote)) {
                        return `<a href="${token.href}">${token.text}</a>`;
                    }
                    
                    // 保存链接信息
                    this.allLinks.push({href: token.href, text: token.text});
                    
                    // 根据链接样式决定展示方式
                    if (this.settings.linkStyle === 'footnote') {
                        return `<a>${token.text}<sup>[${this.allLinks.length}]</sup></a>`;
                    } else {
                        return `<a>${token.text}[${token.href}]</a>`;
                    }
                }
            }]
        }
    }
}
