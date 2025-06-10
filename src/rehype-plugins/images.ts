import {BaseProcess} from "src/rehype-plugins/base-process";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 图片处理插件 - 处理微信公众号中的图片格式
 */
export class Images extends BaseProcess {
	getName(): string {
		return "图片处理插件";
	}

	process(html: string, settings: NMPSettings): string {
		// 微信公众号图片需要特定处理
		// 1. 添加data-src属性
		// 2. 确保图片有正确的样式和对齐方式
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有图片元素
			const images = doc.querySelectorAll("img");

			images.forEach((img) => {
				const src = img.getAttribute("src");
				if (src) {
					// 设置data-src属性，微信编辑器需要
					img.setAttribute("data-src", src);

					// 设置图片默认样式
					if (!img.hasAttribute("style")) {
						img.setAttribute(
							"style",
							"max-width: 100%; height: auto;"
						);
					}

					// 确保图片居中显示
					const parent = img.parentElement;
					if (parent && parent.tagName !== "CENTER") {
						parent.style.textAlign = "center";
					}
				}
			});
			// 转回字符串
			return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理图片时出错:", error);
			return html;
		}
	}
}
