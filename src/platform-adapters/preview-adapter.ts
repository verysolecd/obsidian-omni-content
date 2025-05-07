import { HeadingsPlugin } from "src/plugins/headings-plugin";
import { IProcessPlugin } from "src/plugins/interface";
import { BaseAdapter } from "src/platform-adapters/base-adapter";

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
