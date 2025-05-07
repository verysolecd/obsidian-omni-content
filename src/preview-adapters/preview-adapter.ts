import {BaseAdapter} from "src/preview-adapters/base-adapter";
import {CardDataManager} from "../markdown/code";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class PreviewAdapter extends BaseAdapter {
	protected getAdapterName(): string {
		return "预览";
	}

	protected process(html: string): string {
		// 预览模式下的默认处理，主要是恢复代码卡片并处理标题
		let processedHtml = CardDataManager.getInstance().restoreCard(html);
		processedHtml = this.processHeadings(processedHtml);

		return processedHtml;
	}
}
