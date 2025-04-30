/*
 * Copyright (c) 2025 Mark Shawn
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
import { LinkDescriptionMode } from "src/settings";

export class LinkRenderer extends Extension {
    // 存储链接信息：URL和描述文本
    allLinks: {href: string, text: string}[] = [];
    // 存储需要转换为脚注的链接
    footnoteLinks: {href: string, text: string}[] = [];
    
    async prepare() {
       this.allLinks = [];
       this.footnoteLinks = [];
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
        // 如果没有脚注链接，直接返回原始 HTML
        if (this.footnoteLinks.length === 0) {
            return html;
        }
        
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
                    // 保存所有链接
                    this.allLinks.push({href: token.href, text: token.text});
                    
                    // 判断是否需要转换为脚注
                    const shouldFootnote = this.shouldConvertToFootnote(token.href);
                    
                    // 如果不需要转换为脚注，直接返回普通链接
                    if (!shouldFootnote) {
                        return `<a href="${token.href}">${token.text}</a>`;
                    }
                    
                    // 需要转换为脚注，添加到脚注链接列表
                    this.footnoteLinks.push({href: token.href, text: token.text});
                    
                    // 返回脚注形式的链接
                    const text = this.settings.linkDescriptionMode === LinkDescriptionMode.Empty ? "" : token.text;
                    return `<a>${text}<sup>[${this.footnoteLinks.length}]</sup></a>`;
                }
            }]
        }
    }
}
