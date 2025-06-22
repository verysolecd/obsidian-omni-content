import {Tokens} from "marked";
import {MarkdownView, Notice} from "obsidian";
import {wxUploadImage} from "../weixin-api";
import {WeixinCodeFormatter} from "./weixin-code-formatter";
import {GetCallout} from "./callouts";
import {Extension} from "./extension";
import {MathRendererQueue} from "./math";
import {CardDataManager} from "../rehype-plugins/code-blocks";


const MermaidSectionClassName = "note-mermaid";
const MERMAID_BORDER_COLOR = '#3bcfb0';
const MERMAID_TEXT_COLOR = '#333333';

export class CodeRenderer extends Extension {
getName(): string {
return "CodeRenderer";
}

showLineNumber: boolean;
mermaidIndex: number;

async prepare() {
this.mermaidIndex = 0;
}

codeRenderer(code: string, infostring: string | undefined): string {
const lang = (infostring || "").match(/^\S*/)?.[0];
code = code.replace(/\n$/, "") + "\n";

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

const codeContent = !lang
? `<pre><code>${code}</code></pre>`
: `<pre><code class="hljs language-${lang}">${code}</code></pre>`;

return (
'<section class="code-section">'
+ '<div class="code-content">' + codeContent + '</div>'
+ '</section>'
);
} else {
if (!lang) {
return '<section class="code-section"><pre><code>' + code + '</code></pre></section>';
}
return '<section class="code-section"><pre><code class="hljs language-' + lang + '">' + code + '</code></pre></section>';
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
        const mermaidIndex = this.mermaidIndex;
        const containerId = `mermaid-${mermaidIndex}`;
        this.mermaidIndex += 1;
        const failElement = "<span>mermaid渲染失败</span>";

        // 检查window.mermaid是否已初始化
        if (typeof window.mermaid === 'undefined') {
            console.error("mermaid not initialized");
            return failElement;
        }

        // mermaid基础配置
        const mermaidConfig = {
            startOnLoad: true,
            securityLevel: 'loose',
            theme: 'default',
            fontSize: 14,
            fontFamily: 'var(--default-font)',
            themeVariables: {
                primaryColor: MERMAID_BORDER_COLOR,
                primaryTextColor: MERMAID_TEXT_COLOR,
                primaryBorderColor: MERMAID_BORDER_COLOR,
                lineColor: MERMAID_BORDER_COLOR,
                textColor: MERMAID_TEXT_COLOR,
                nodeBorder: MERMAID_BORDER_COLOR,
                nodeTextColor: MERMAID_TEXT_COLOR,
                edgeTextColor: MERMAID_TEXT_COLOR,
                mainBkg: '#ffffff',
                nodeBkg: '#ffffff',
                clusterBkg: '#ffffff'
            }
        };

        // 确保mermaid已配置
        if (!window.mermaidConfig) {
            window.mermaidConfig = mermaidConfig;
            window.mermaid.initialize(window.mermaidConfig);
        }

        // 将Promise保存到全局对象中
        if (!window.mermaidRenderPromises) {
            window.mermaidRenderPromises = [];
        }

        // 等待图表渲染完成并获取SVG
        const renderPromise = new Promise<void>((resolve) => {
            setTimeout(async () => {
                try {
                    await window.mermaid.init({
                        ...mermaidConfig,
                        startOnLoad: false
                    }, `#${containerId}`);
                    
                    // 获取渲染后的SVG内容
                    const container = document.getElementById(containerId);
                    if (container) {
                        const svg = container.querySelector('svg');
                        if (svg) {
                            // 设置固定尺寸，避免使用auto
                            const bbox = svg.getBBox();
                            const height = Math.max(bbox.height + 40, 200); // 确保最小高度为200px
                            
                            // 清除原有的样式
                            svg.removeAttribute('style');
                            
                            // 使用绝对单位设置尺寸
                            svg.style.width = '100%';
                            svg.style.height = `${height}px`;
                            svg.style.fontSize = '14px';
                            svg.style.overflow = 'visible';
                            
                            // 设置SVG属性
                            svg.setAttribute('width', '100%');
                            svg.setAttribute('height', `${height}`);
                            svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
                            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                            
                            // 调整文本元素的样式
                            const texts = svg.querySelectorAll('text');
                            texts.forEach(text => {
                                text.style.fontSize = '14px';
                                text.style.fontFamily = 'var(--default-font)';
                                text.style.fill = MERMAID_TEXT_COLOR;
                            });

                            // 调整线条和边框颜色
                            const paths = svg.querySelectorAll('path');
                            paths.forEach(path => {
                                if (path.getAttribute('stroke') === '#000' || path.getAttribute('stroke') === 'black') {
                                    path.setAttribute('stroke', MERMAID_BORDER_COLOR);
                                }
                            });
                        }
                    }
                    resolve();
                } catch (err) {
                    console.error("Mermaid init error:", err);
                    this.callback.updateElementByID(containerId, failElement);
                    resolve();
                }
            }, 500); // 增加延时以确保DOM准备就绪
        });

        window.mermaidRenderPromises.push(renderPromise);
        return `<div id="${containerId}" class="mermaid ${MermaidSectionClassName}" style="min-height:200px;">${token.text}</div>`;
    } catch (error) {
        console.error("Mermaid rendering error:", error);
        return "<span>mermaid渲染失败</span>";
    }
}

renderAdCallout(token: Tokens.Code) {
try {
if (!token.lang) {
return this.codeRenderer(token.text, token.lang);
}

const calloutType = token.lang.substring(3).toLowerCase();
let title = calloutType.charAt(0).toUpperCase() + calloutType.slice(1).toLowerCase();
const lines = token.text.split('\n');
const firstLine = lines[0].trim();
let hasCustomTitle = false;

if ((lines.length > 1 && lines[1].trim() === '') || firstLine === '') {
hasCustomTitle = false;
} else if (firstLine !== '') {
hasCustomTitle = true;
title = firstLine;
}

let content;
if (hasCustomTitle) {
content = lines.slice(1).join('\n').trim();
} else {
content = token.text.trim();
}
const body = this.marked.parser(this.marked.lexer(content));

const info = GetCallout(calloutType);
if (!info) {
return this.codeRenderer(token.text, token.lang);
}

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
if (token.lang && token.lang.startsWith("ad-")) {
return this.renderAdCallout(token);
}

if (2>1) {
const type = CodeRenderer.getMathType(token.lang ?? "");
if (type) {
return MathRendererQueue.getInstance().render(token, false, type, this.callback);
}
if (token.lang && token.lang.trim().toLocaleLowerCase() == "mermaid") {
return this.renderMermaid(token);
}
}
if (token.lang && token.lang.trim().toLocaleLowerCase() == "mpcard") {
return this.renderCard(token);
}
return this.codeRenderer(token.text, token.lang);
},
},
],
};
}
}
