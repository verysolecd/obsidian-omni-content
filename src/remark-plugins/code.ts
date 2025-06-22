import {Tokens} from "marked";
import {MarkdownView, Notice} from "obsidian";
import {wxUploadImage} from "../weixin-api";
import {WeixinCodeFormatter} from "./weixin-code-formatter";
import {GetCallout} from "./callouts";
import {Extension} from "./extension";
import {MathRendererQueue} from "./math";
import {CardDataManager} from "../rehype-plugins/code-blocks";

declare global {
    interface Window {
        mermaidRenderPromises: Promise<void>[];
        mermaid: {
            initialize: (config: any) => void;
            init: (config: any | undefined, nodes: string) => Promise<void>;
        };
        mermaidConfig: {
            startOnLoad: boolean;
            securityLevel: string;
            theme: string;
            fontSize?: number;
            fontFamily?: string;
            themeVariables?: {
                primaryColor?: string;
                primaryTextColor?: string;
                primaryBorderColor?: string;
                lineColor?: string;
                textColor?: string;
                nodeBorder?: string;
                mainBkg?: string;
                nodeTextColor?: string;
                edgeLabelBackground?: string;
                clusterBkg?: string;
                titleColor?: string;
                edgeColor?: string;
            };
            flowchart?: {
                htmlLabels?: boolean;
                curve?: string;
                nodeSpacing?: number;
                rankSpacing?: number;
                padding?: number;
                useMaxWidth?: boolean;
                diagramPadding?: number;
                labelPosition?: string;
                verticalLabelPosition?: string;
            };
            pie?: {
                textPosition?: number;
                useWidth?: boolean;
                useMaxWidth?: boolean;
                labelOffset?: number;
            };
            sequence?: {
                useMaxWidth?: boolean;
                useWidth?: boolean;
            };
        };
    }
}

const MermaidSectionClassName = "note-mermaid";

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

        // 特殊处理mermaid图表
        if (lang?.toLowerCase() === 'mermaid') {
            return `<pre><code class="hljs language-${lang}">${code}</code></pre>`;
        }

        // 普通代码块不应用语法高亮
        if (this.settings.lineNumber) {
            const lines = code.split("\n");
            let liItems = "";
            let count = 1;
            while (count < lines.length) {
                liItems = liItems + `<li>${count}</li>`;
                count = count + 1;
            }

            return (
                '<section class="code-section">'
                + '<div class="code-content"><pre><code>' + code + '</code></pre></div>'
                + '</section>'
            );
        } else {
            return '<section class="code-section"><pre><code>' + code + '</code></pre></section>';
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

            if (typeof window.mermaid === 'undefined') {
                console.error("mermaid not initialized");
                return failElement;
            }

            if (!window.mermaidConfig) {
                const isDarkMode = document.body.classList.contains('theme-dark');
                window.mermaidConfig = {
                    startOnLoad: true,
                    securityLevel: 'loose',
                    theme: isDarkMode ? 'dark' : 'default',
                    fontSize: 14,
                    fontFamily: 'var(--default-font)',
                    themeVariables: isDarkMode ? {
                        // 深色主题配置
                        primaryColor: '#3b7b6c',
                        primaryTextColor: '#ffffff',
                        primaryBorderColor: '#3b7b6c',
                        lineColor: '#3b7b6c',
                        textColor: '#ffffff',
                        nodeBorder: '#3b7b6c',
                        mainBkg: '#2d2d2d',
                        nodeTextColor: '#ffffff',
                        edgeLabelBackground: '#2d2d2d',
                        clusterBkg: '#2d2d2d',
                        titleColor: '#ffffff',
                        edgeColor: '#3b7b6c'
                    } : {
                        // 浅色主题配置
                        primaryColor: '#3b7b6c',
                        primaryTextColor: '#333333',
                        primaryBorderColor: '#3b7b6c',
                        lineColor: '#3b7b6c',
                        textColor: '#333333',
                        nodeBorder: '#3b7b6c',
                        mainBkg: '#ffffff',
                        nodeTextColor: '#333333',
                        edgeLabelBackground: '#ffffff',
                        clusterBkg: '#ffffff',
                        titleColor: '#333333',
                        edgeColor: '#3b7b6c'
                    },
                    pie: {
                        textPosition: 0.75,
                        useWidth: true,
                        useMaxWidth: true,
                        labelOffset: 0.5
                    },
                    flowchart: {
                        htmlLabels: true,
                        curve: 'basis',
                        nodeSpacing: 50,
                        rankSpacing: 50,
                        padding: 10,
                        useMaxWidth: true,
                        diagramPadding: 20,
                        labelPosition: 'center',
                        verticalLabelPosition: 'middle'
                    },
                    sequence: {
                        useMaxWidth: true,
                        useWidth: true
                    }
                };
                window.mermaid.initialize(window.mermaidConfig);
            }

            if (!window.mermaidRenderPromises) {
                window.mermaidRenderPromises = [];
            }

            const renderPromise = new Promise<void>((resolve) => {
                setTimeout(async () => {
                    try {
                        const config = {
                            ...window.mermaidConfig,
                            themeVariables: {
                                ...window.mermaidConfig.themeVariables,
                                primaryColor: '#3b7b6c',
                                primaryTextColor: '#333',
                                primaryBorderColor: '#3b7b6c',
                                lineColor: '#3b7b6c',
                                textColor: '#333'
                            }
                        };
                        await window.mermaid.init(config, `#${containerId}`);
                        
                        const container = document.getElementById(containerId);
                        if (container) {
                            const svg = container.querySelector('svg');
                            if (svg) {
                                // 获取原始尺寸
                                const bbox = svg.getBBox();
                                // 添加额外的边距，特别是为了图例
                                const padding = {
                                    top: 20,
                                    right: 100, // 为图例留出更多空间
                                    bottom: 20,
                                    left: 20
                                };
                                
                                // 设置新的viewBox，包含padding
                                const viewBoxWidth = bbox.width + padding.left + padding.right;
                                const viewBoxHeight = bbox.height + padding.top + padding.bottom;
                                svg.setAttribute('viewBox', `-${padding.left} -${padding.top} ${viewBoxWidth} ${viewBoxHeight}`);
                                
                                // 设置容器样式
                                svg.style.maxWidth = '800px'; // 限制最大宽度
                                svg.style.width = '100%';
                                svg.style.height = 'auto';
                                svg.style.fontSize = '14px';
                                svg.style.margin = '0 auto'; // 居中显示
                                svg.style.display = 'block';
                                
                                // 调整文本样式
                                // 直接设置SVG元素的样式
                                const isDarkMode = document.body.classList.contains('theme-dark');
                                const textColor = isDarkMode ? '#ffffff' : '#333333';
                                const bgColor = isDarkMode ? '#2d2d2d' : '#ffffff';
                                
                                // 设置所有图形元素的样式
                                svg.querySelectorAll('path').forEach(path => {
                                    const pathElement = path as SVGPathElement;
                                    const currentStroke = pathElement.getAttribute('stroke');
                                    if (currentStroke === '#000' || currentStroke === '#000000' || currentStroke === 'black') {
                                        pathElement.setAttribute('stroke', '#3b7b6c');
                                        pathElement.style.stroke = '#3b7b6c';
                                    }
                                    pathElement.setAttribute('stroke-width', '2');
                                    pathElement.style.strokeWidth = '2px';
                                    
                                    // 如果是箭头，确保正确设置
                                    const markerEnd = pathElement.getAttribute('marker-end');
                                    if (markerEnd) {
                                        // 解析并替换marker引用，使用灰绿色
                                        const markerUrl = markerEnd.match(/url\((.*?)\)/)?.[1] || '';
                                        const newMarkerEnd = `url(${markerUrl.replace(/black|#7852ee/, '#3b7b6c')})`;
                                        pathElement.setAttribute('marker-end', newMarkerEnd);
                                    }
                                });

                                // 设置箭头标记的颜色和属性
                                svg.querySelectorAll('marker').forEach(marker => {
                                    const markerElement = marker as SVGMarkerElement;
                                    markerElement.setAttribute('stroke', '#3b7b6c');
                                    markerElement.setAttribute('fill', '#3b7b6c');
                                    markerElement.style.stroke = '#3b7b6c';
                                    markerElement.style.fill = '#3b7b6c';
                                    
                                    // 设置marker的viewBox和基本属性
                                    markerElement.setAttribute('viewBox', '0 0 10 10');
                                    markerElement.setAttribute('refX', '9');
                                    markerElement.setAttribute('refY', '5');
                                    markerElement.setAttribute('markerWidth', '10');
                                    markerElement.setAttribute('markerHeight', '10');
                                    markerElement.setAttribute('orient', 'auto-start-reverse');
                                    markerElement.setAttribute('markerUnits', 'userSpaceOnUse');
                                    
                                    // 确保marker内的路径样式正确，使用灰绿色
                                    markerElement.querySelectorAll('path').forEach(path => {
                                        const pathElement = path as SVGPathElement;
                                        pathElement.setAttribute('fill', '#3b7b6c');
                                        pathElement.setAttribute('stroke', '#3b7b6c');
                                        pathElement.style.fill = '#3b7b6c';
                                        pathElement.style.stroke = '#3b7b6c';
                                    });
                                });

                                // 设置所有文本元素的样式
                                // 设置所有文本元素的样式，确保垂直居中
                                const texts = svg.querySelectorAll('text');
                                texts.forEach(text => {
                                    const textElement = text as SVGTextElement;
                                    textElement.style.fontSize = '14px';
                                    textElement.style.fontFamily = 'var(--default-font)';
                                    textElement.setAttribute('fill', textColor);
                                    (textElement as unknown as SVGElement).style.fill = textColor;
                                    
                                    // 检查文本元素的上下文
                                    const isPieChart = !!text.closest('.pie-legend, .pieCircle, .pieOuterText, .pieLabel');
                                    const isFlowchartNode = text.closest('.node, .edgeLabel') !== null;
                                    
                                    if (!isPieChart && isFlowchartNode) {
                                        // 只对流程图的节点应用居中样式
                                        textElement.style.alignmentBaseline = 'middle';
                                        textElement.style.textAlign = 'center';
                                        textElement.style.verticalAlign = 'middle';
                                        textElement.style.lineHeight = 'normal';
                                        textElement.setAttribute('dominant-baseline', 'middle');
                                        textElement.setAttribute('text-anchor', 'middle');
                                        textElement.setAttribute('alignment-baseline', 'middle');
                                        textElement.setAttribute('dy', '0.35em');
                                    }
                                    
                                    if (isPieChart) {
                                        // 饼图文本使用默认对齐方式
                                        textElement.style.alignmentBaseline = 'auto';
                                        textElement.removeAttribute('dominant-baseline');
                                        textElement.removeAttribute('text-anchor');
                                        textElement.removeAttribute('alignment-baseline');
                                        textElement.removeAttribute('dy');
                                    }
                                });

                                (function() {
                                    // 更精确地处理节点中的文本定位
                                    const svgElement = svg as SVGSVGElement;
                                    const nodes = svgElement.querySelectorAll('.node');
                                    nodes.forEach(node => {
                                        const nodeElement = node as SVGGElement;
                                        const rectElement = nodeElement.querySelector('rect, circle, polygon') as SVGGraphicsElement;
                                        const textElement = nodeElement.querySelector('text') as SVGTextElement;

                                        if (rectElement && textElement) {
                                            const bbox = rectElement.getBBox();
                                            
                                            // 设置文本在节点中心
                                            textElement.setAttribute('x', String(bbox.x + bbox.width / 2));
                                            textElement.setAttribute('y', String(bbox.y + bbox.height / 2));
                                            textElement.setAttribute('dy', '0.35em');
                                            textElement.setAttribute('dominant-baseline', 'middle');
                                            textElement.setAttribute('text-anchor', 'middle');
                                            textElement.setAttribute('alignment-baseline', 'middle');

                                            // 修改文本样式以确保垂直居中
                                            textElement.style.textAlign = 'center';
                                            textElement.style.lineHeight = '1';
                                            
                                            // 设置节点边框颜色为灰绿色
                                            rectElement.setAttribute('stroke', '#3b7b6c');
                                            rectElement.style.stroke = '#3b7b6c';
                                            rectElement.style.strokeWidth = '2px';
                                        }
                                    });
                                })();

                                // 处理边缘标签
                                (function() {
                                    const svgElement = svg as SVGSVGElement;
                                    const edgeLabels = svgElement.querySelectorAll('.edgeLabel');
                                    edgeLabels.forEach(label => {
                                        const labelElement = label as SVGGElement;
                                        const text = labelElement.querySelector('text');
                                        if (text) {
                                            text.setAttribute('dominant-baseline', 'middle');
                                            text.setAttribute('text-anchor', 'middle');
                                            text.setAttribute('dy', '0.35em');
                                        }
                                    });
                                })();

                                // 设置节点背景
                                svg.querySelectorAll('rect, circle, polygon').forEach((shape) => {
                                    const shapeElement = shape as SVGGraphicsElement;
                                    if (shapeElement.getAttribute('fill') === '#000000' || shapeElement.getAttribute('fill') === 'black') {
                                        shapeElement.setAttribute('fill', bgColor);
                                        shapeElement.style.fill = bgColor;
                                    }
                                    if (shapeElement.getAttribute('stroke') === '#000000' || shapeElement.getAttribute('stroke') === 'black') {
                                        shapeElement.setAttribute('stroke', '#3b7b6c');
                                        shapeElement.style.stroke = '#3b7b6c';
                                        shapeElement.style.strokeWidth = '2px';
                                    }
                                });

                                // 确保箭头定义正确
                                const defs = svg.querySelector('defs');
                                if (defs) {
                                    const markers = defs.querySelectorAll('marker');
                                    markers.forEach(marker => {
                                        const markerElement = marker as SVGMarkerElement;
                                        markerElement.setAttribute('fill', '#3b7b6c');
                                        markerElement.setAttribute('stroke', '#3b7b6c');
                                        
                                        markerElement.querySelectorAll('path').forEach(path => {
                                            const pathElement = path as SVGPathElement;
                                            pathElement.setAttribute('fill', '#3b7b6c');
                                            pathElement.setAttribute('stroke', '#3b7b6c');
                                            pathElement.style.fill = '#3b7b6c';
                                            pathElement.style.stroke = '#3b7b6c';
                                        });
                                    });
                                }

                                // 确保所有图形元素的边框和填充颜色完全设置
                                svg.querySelectorAll('g').forEach(g => {
                                    if (g.getAttribute('class')?.includes('node')) {
                                        const shapes = g.querySelectorAll('rect, circle, polygon, ellipse');
                                        shapes.forEach(shape => {
                                            const shapeElement = shape as SVGGraphicsElement;
                                            if (!shapeElement.getAttribute('fill') || shapeElement.getAttribute('fill') === 'none') {
                                                shapeElement.setAttribute('fill', bgColor);
                                                shapeElement.style.fill = bgColor;
                                            }
                                            if (!shapeElement.getAttribute('stroke')) {
                                                shapeElement.setAttribute('stroke', '#3b7b6c');
                                                shapeElement.style.stroke = '#3b7b6c';
                                                shapeElement.style.strokeWidth = '2px';
                                            }
                                        });
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
                }, 100);
            });

            window.mermaidRenderPromises.push(renderPromise);
            return `<div id="${containerId}" class="mermaid ${MermaidSectionClassName}">${token.text}</div>`;
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
                        // 处理特殊语言的代码块
                        const lang = token.lang?.trim().toLowerCase();
                        
                        // Callout blocks
                        if (lang?.startsWith("ad-")) {
                            return this.renderAdCallout(token);
                        }
                        
                        // Math blocks
                        const type = CodeRenderer.getMathType(token.lang ?? "");
                        if (type) {
                            return MathRendererQueue.getInstance().render(token, false, type, this.callback);
                        }
                        
                        // Mermaid diagrams
                        if (lang === "mermaid") {
                            return this.renderMermaid(token);
                        }
                        
                        // WeChat Cards
                        if (lang === "mpcard") {
                            return this.renderCard(token);
                        }
                        
                        // Plain code blocks with language tag or copy button
                        const code = token.text.replace(/\n$/, "") + "\n";
                        const copyScript = `onclick="(() => {
                            const codeText = this.closest('section').querySelector('code').textContent;
                            if (navigator.clipboard) {
                                navigator.clipboard.writeText(codeText)
                                    .then(() => {
                                        const oldText = this.textContent;
                                        this.textContent = '已复制';
                                        setTimeout(() => this.textContent = oldText, 2000);
                                    })
                                    .catch(err => {
                                        console.error('复制失败:', err);
                                        fallbackCopy(codeText);
                                    });
                            } else {
                                fallbackCopy(codeText);
                            }
                        })()"`;

                        const fallbackCopy = `
                            function fallbackCopy(text) {
                                const textArea = document.createElement('textarea');
                                textArea.value = text;
                                document.body.appendChild(textArea);
                                textArea.select();
                                try {
                                    document.execCommand('copy');
                                    this.textContent = '已复制';
                                    setTimeout(() => this.textContent = this.getAttribute('data-original-text'), 2000);
                                } catch (err) {
                                    console.error('复制失败:', err);
                                }
                                document.body.removeChild(textArea);
                            }
                        `;
                        
                        const headerStyle = `
                            position: absolute;
                            top: 6px;
                            right: 6px;
                            z-index: 1;
                            display: inline-flex;
                            gap: 8px;
                            padding: 4px;
                            border-radius: 4px;
                        `;
                        
                        const buttonStyle = `
                            cursor: pointer;
                            padding: 2px 8px;
                            font-size: 0.85em;
                            border: 1px solid rgba(200, 200, 200, 0.2);
                            border-radius: 4px;
                            background: rgba(200, 200, 200, 0.1);
                            color: inherit;
                            transition: all 0.2s ease;
                        `;

                        const buttonHoverScript = `
                            onmouseover="this.style.background='var(--primary-color,#E31937)';this.style.color='white';this.style.borderColor='var(--primary-color,#E31937)'"
                            onmouseout="this.style.background='rgba(200, 200, 200, 0.1)';this.style.color='inherit';this.style.borderColor='rgba(200, 200, 200, 0.2)'"
                        `;
                        
                        // 根据是否有语言类型，显示不同的header
                        const header = token.lang 
                            ? `<div style="${headerStyle}">
                                <span style="${buttonStyle}" ${buttonHoverScript} ${copyScript} title="点击复制代码">${token.lang}</span>
                               </div>`
                            : `<div style="${headerStyle}">
                                <button style="${buttonStyle}" ${buttonHoverScript} ${copyScript} title="复制代码">复制</button>
                               </div>`;

                        return `
                        <script>${fallbackCopy}</script>
                        <section style="position:relative;margin:1em 0;">
                            ${header}
                            <div>
                                <pre><code style="display:block;padding:2.5em 0.9em 0.9em 0.9em;">${code}</code></pre>
                            </div>
                        </section>`;
                    },
                },
            ],
        };
    }
}
