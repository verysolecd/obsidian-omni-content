import {BaseProcessPlugin} from "src/plugins/base-process-plugin";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 代码块处理插件 - 处理微信公众号中的代码格式和行号显示
 */
export class CodeBlocksPlugin extends BaseProcessPlugin {
    getName(): string {
        return "代码块处理插件";
    }

    process(html: string, settings: NMPSettings): string {
        try {
            // 如果启用了微信代码格式化，跳过此插件的处理
            if (settings.enableWeixinCodeFormat) {
                logger.debug("微信代码格式化已启用，跳过代码块处理插件");
                return html;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // 查找所有代码块
            const codeBlocks = doc.querySelectorAll("pre code");

            codeBlocks.forEach((codeBlock) => {
                // 确保代码块有正确的微信样式
                const pre = codeBlock.parentElement;
                if (pre) {
                    pre.style.background = "#f8f8f8";
                    pre.style.borderRadius = "4px";
                    pre.style.padding = "16px";
                    pre.style.overflow = "auto";
                    pre.style.fontSize = "14px";
                    pre.style.lineHeight = "1.5";

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
                }
            });

            return doc.body.innerHTML;
        } catch (error) {
            logger.error("处理代码块时出错:", error);
            return html;
        }
    }
}
