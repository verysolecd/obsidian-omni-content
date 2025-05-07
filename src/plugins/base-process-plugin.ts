import {IProcessPlugin} from "src/plugins/interface";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 基础插件类，提供通用功能
 */
export abstract class BaseProcessPlugin implements IProcessPlugin {
	/**
	 * 获取主题色
	 */
	protected getThemeColor(settings: NMPSettings): string {
		// 动态获取当前主题颜色
		let themeAccentColor: string;

		// 如果启用了自定义主题色，使用用户设置的颜色
		if (settings.enableThemeColor) {
			themeAccentColor = settings.themeColor || "#7852ee";
			logger.debug("使用自定义主题色：", themeAccentColor);
		} else {
			// 从当前激活的DOM中获取实际使用的主题颜色
			try {
				// 尝试从文档中获取计算后的CSS变量值
				const testElement = document.createElement("div");
				testElement.style.display = "none";
				testElement.className = "note-to-mp";
				document.body.appendChild(testElement);

				// 获取计算后的样式
				const computedStyle = window.getComputedStyle(testElement);
				const primaryColor = computedStyle
					.getPropertyValue("--primary-color")
					.trim();

				logger.debug("获取到的主题色：", primaryColor);
				if (primaryColor) {
					themeAccentColor = primaryColor;
				} else {
					// 如果无法获取，默认使用紫色
					themeAccentColor = "#7852ee";
				}

				// 清理测试元素
				document.body.removeChild(testElement);
			} catch (e) {
				// 如果出错，回退到默认值
				themeAccentColor = "#7852ee";
				logger.error("无法获取主题色变量，使用默认值", e);
			}
		}

		return themeAccentColor;
	}

	/**
	 * 插件名称，子类必须实现
	 */
	abstract getName(): string;

	/**
	 * 处理HTML内容，子类必须实现
	 */
	abstract process(html: string, settings: NMPSettings): string;
}
