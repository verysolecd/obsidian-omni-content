import {BaseProcessPlugin} from "src/plugins/base-process-plugin";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";
import colors from "colors";

/**
 * 样式处理插件 - 为微信公众号内容应用内联样式
 * 由于微信编辑器对外部CSS支持有限，需要将关键样式内联到HTML元素上
 */
export class StylesPlugin extends BaseProcessPlugin {
    getName(): string {
        return "样式处理插件";
    }

    process(html: string, settings: NMPSettings): string {
        try {
            // 创建临时DOM元素
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv);

            // 添加样式元素
            const styleEl = document.createElement('style');
            styleEl.textContent = '';
            tempDiv.appendChild(styleEl);
            logger.debug("为微信内容添加样式元素");

            // 获取所有非样式元素
            const allElements = tempDiv.querySelectorAll("*:not(style)");
            logger.debug(`处理微信样式元素数量: ${allElements.length}`);

            // 应用计算样式到每个元素
            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i] as HTMLElement;
                const computedStyle = window.getComputedStyle(el);
                let inlineStyles = "";

                // 提取关键样式属性
                const properties = [
                    "color",
                    "background-color",
                    "font-family",
                    "font-size",
                    "font-weight",
                    "text-align",
                    "line-height",
                    "margin",
                    "padding",
                    "border",
                    "border-radius",
                    "position" // 微信公众号支持position属性
                ];

                for (const prop of properties) {
                    const value = computedStyle.getPropertyValue(prop);
                    if (value && value !== "" && value !== "none") {
                        // 微信公众号支持的字体比较有限
                        if (prop === "font-family") {
                            inlineStyles += `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif; `;
                            continue;
                        }

                        // 处理过大或过小的字体
                        if (prop === "font-size") {
                            const fontSize = parseInt(value);
                            if (fontSize > 40) {
                                inlineStyles += `font-size: 40px; `;
                                continue;
                            } else if (fontSize < 12 && el.tagName !== "SUP" && el.tagName !== "SUB") {
                                inlineStyles += `font-size: 12px; `;
                                continue;
                            }
                        }

                        inlineStyles += `${prop}: ${value}; `;
                    }
                }

                // 应用内联样式
                if (inlineStyles) {
                    const existingStyle = el.getAttribute("style") || "";
                    el.setAttribute("style", existingStyle + inlineStyles);
                }
            }

            // 移除所有 style 标签，微信不支持
            const styleElements = tempDiv.querySelectorAll('style');
            styleElements.forEach(el => el.remove());

            // 获取处理后的HTML并清理临时元素
            const result = tempDiv.innerHTML;
            document.body.removeChild(tempDiv);

            logger.debug(`应用内联样式后的微信内容: ${result.substring(0, 100)}...`);
            return result;
        } catch (error) {
            logger.error("应用微信样式时出错:", error);
            return html;
        }
    }
}
