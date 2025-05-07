import {BaseContentAdapter} from "src/platform-adapters/base-content-adapter";
import {IProcessPlugin} from "src/plugins/base-process-plugin";
import { HeadingsPlugin } from "src/plugins/headings-plugin";

/**
 * 预览模式适配器 - 用于OmniContent内部预览的正常渲染
 */
export class DefaultContentAdapter extends BaseContentAdapter {
	protected getAdapterName(): string {
		return "预览";
	}

	protected plugins: IProcessPlugin[] = [
		new HeadingsPlugin(),
	]

}
