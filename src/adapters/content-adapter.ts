import { NMPSettings } from "../settings";
import { logger } from "../utils";

/**
 * 内容适配器接口 - 负责将HTML内容适配到不同平台的格式要求
 */
export interface ContentAdapter {
  /**
   * 适配内容方法
   * @param html 原始HTML内容
   * @param settings 插件设置
   * @returns 适配后的HTML内容
   */
  adaptContent(html: string, settings: NMPSettings): string;
}

// 添加基础适配器抽象类
export abstract class BaseAdapter implements ContentAdapter {
  // 保存设置实例以在其他方法中使用
  protected currentSettings: NMPSettings;

  constructor() {
    // 初始化时获取设置单例
    this.currentSettings = NMPSettings.getInstance();
  }

  /**
   * 适配内容 - 模板方法
   * @param html 原始HTML内容
   * @param settings 插件设置
   * @returns 适配后的HTML内容
   */
  adaptContent(html: string, settings: NMPSettings): string {
    logger.debug(`应用${this.getAdapterName()}适配器处理HTML`);

    // 更新当前设置
    this.currentSettings = settings;

    // 调用子类实现的处理方法
    let processedHtml = this.preprocess(html);
    processedHtml = this.process(processedHtml);
    processedHtml = this.postprocess(processedHtml);

    logger.debug(`${this.getAdapterName()}适配处理完成`);
    return processedHtml;
  }

  /**
   * 获取适配器名称 - 子类必须实现
   */
  protected abstract getAdapterName(): string;

  /**
   * 预处理HTML - 子类可以覆盖
   */
  protected preprocess(html: string): string {
    return html;
  }

  /**
   * 处理HTML - 子类必须实现
   */
  protected abstract process(html: string): string;

  /**
   * 后处理HTML - 子类可以覆盖
   */
  protected postprocess(html: string): string {
    return html;
  }

  /**
   * 处理二级标题，根据设置决定是否为标题添加序号
   * 当启用时，将序号作为标题的内容插入
   */
  protected processHeadings(html: string): string {
    try {
      // 如果用户关闭了二级标题序号功能，直接返回原始 HTML
      if (!this.currentSettings.enableHeadingNumber) {
        logger.debug("二级标题序号功能已关闭，不添加序号");
        return html;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // 获取所有二级标题
      const h2Elements = doc.querySelectorAll("h2");
      if (h2Elements.length === 0) {
        return html; // 没有h2标题，直接返回
      }

      logger.debug(`处理 ${h2Elements.length} 个二级标题，添加序号`);

      // 为每个h2标题添加序号
      h2Elements.forEach((h2, index) => {
        // 格式化编号为两位数 01, 02, 03...
        const number = (index + 1).toString().padStart(2, "0");

        // 检查标题是否已有内容结构
        const contentSpan = h2.querySelector(".content");

        // 如果标题包含prefix/content/suffix结构，则在content内插入序号
        if (contentSpan) {
          // 创建序号元素
          const numberSpan = document.createElement("span");
          numberSpan.setAttribute("leaf", "");

          // 设置样式
          numberSpan.setAttribute("style", "font-size: 48px; ");
          numberSpan.textContent = number;

          // 将序号添加到标题内容开头
          const wrapper = document.createElement("span");
          wrapper.setAttribute("textstyle", "");
          wrapper.appendChild(numberSpan);

          // 添加换行
          const breakElement = document.createElement("br");

          // 插入到内容容器的开头
          contentSpan.insertBefore(breakElement, contentSpan.firstChild);
          contentSpan.insertBefore(wrapper, contentSpan.firstChild);

          // 将备注文本居中
          h2.style.textAlign = "center";
        } else {
          // 如果标题没有特定结构，直接添加到标题开头
          // 保存原始内容
          const originalContent = h2.innerHTML;

          // 创建序号HTML
          const numberHtml = `<span textstyle="" style="font-size: 48px; text-decoration: underline; margin-bottom: 96px !important">${number}</span><br>`;

          // 替换原标题内容，序号后面跟原内容
          h2.innerHTML = numberHtml + originalContent;

          // 将标题居中
          h2.style.textAlign = "center";
        }
      });

      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理二级标题序号时出错:", error);
      return html;
    }
  }

  /**
   * 获取主题色
   */
  protected getThemeColor(): string {
    // 动态获取当前主题颜色
    let themeAccentColor: string;
    
    // 如果启用了自定义主题色，使用用户设置的颜色
    if (this.currentSettings.enableThemeColor) {
      themeAccentColor = this.currentSettings.themeColor || "#7852ee";
      logger.debug("使用自定义主题色：", themeAccentColor);
    } else {
      // 从当前激活的DOM中获取实际使用的主题颜色
      try {
        // 尝试从文档中获取计算后的CSS变量值
        const testElement = document.createElement('div');
        testElement.style.display = 'none';
        testElement.className = 'note-to-mp';
        document.body.appendChild(testElement);
        
        // 获取计算后的样式
        const computedStyle = window.getComputedStyle(testElement);
        const primaryColor = computedStyle.getPropertyValue('--primary-color').trim();
        
        logger.debug("获取到的主题色：", primaryColor);
        if (primaryColor) {
          themeAccentColor = primaryColor;
        } else {
          // 如果无法获取，默认使用紫色
          themeAccentColor = '#7852ee';
        }
        
        // 清理测试元素
        document.body.removeChild(testElement);
      } catch (e) {
        // 如果出错，回退到默认值
        themeAccentColor = '#7852ee';
        logger.error('无法获取主题色变量，使用默认值', e);
      }
    }

    return themeAccentColor;
  }
}

/**
 * 适配器工厂 - 负责创建适合不同平台的适配器实例
 */
export class ContentAdapterFactory {
	private static adapters: Map<string, ContentAdapter> = new Map();

	/**
	 * 注册一个适配器
	 * @param platform 平台名称
	 * @param adapter 适配器实例
	 */
	static registerAdapter(platform: string, adapter: ContentAdapter): void {
		logger.info(`注册平台适配器: ${platform}`);
		this.adapters.set(platform.toLowerCase(), adapter);
	}

	/**
	 * 获取适合指定平台的适配器
	 * @param platform 平台名称
	 * @returns 对应的适配器实例，如果未找到则返回预览适配器
	 */
	static getAdapter(platform: string): ContentAdapter {
		platform = platform.toLowerCase();
		const adapter = this.adapters.get(platform);

		if (adapter) {
			logger.debug(`使用 ${platform} 平台适配器`);
			return adapter;
		}

		logger.warn(`未找到 ${platform} 平台的适配器，使用默认预览适配器`);
		return this.adapters.get('preview') || this.adapters.values().next().value;
	}

	/**
	 * 获取所有已注册的适配器
	 * @returns 适配器Map
	 */
	static getRegisteredAdapters(): Map<string, ContentAdapter> {
		return new Map(this.adapters);
	}
}