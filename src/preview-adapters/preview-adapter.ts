import { HeadingsPlugin } from "src/plugins/processors/headings-plugin";
import { IProcessPlugin } from "src/plugins/processors/interface";
import { BaseAdapter } from "src/preview-adapters/base-adapter";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class PreviewAdapter extends BaseAdapter {
	protected getAdapterName(): string {
		return "预览";
	}

	protected plugins: IProcessPlugin[] = [
		new HeadingsPlugin(),
	]

}
