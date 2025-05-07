import { CodeBlocksPlugin } from "src/plugins/processors/code-blocks-plugin";
import { HeadingsPlugin } from "src/plugins/processors/headings-plugin";
import { ImagesPlugin } from "src/plugins/processors/images-plugin";
import { LinksPlugin } from "src/plugins/processors/links-plugin";
import { ListsPlugin } from "src/plugins/processors/lists-plugin";
import { StylesPlugin } from "src/plugins/processors/styles-plugin";
import { TablesPlugin } from "src/plugins/processors/tables-plugin";
// BlockquotesPlugin导入但未使用，在注释中提到了它但目前不启用
// import {BlockquotesPlugin} from "src/plugins/processors/blockquotes-plugin";
import { IProcessPlugin } from "src/plugins/processors/interface";
import { BaseAdapter } from "src/preview-adapters/base-adapter";

/**
 * 微信公众号适配器 - 处理微信公众号特定的格式要求
 * 采用插件模式设计，可以灵活添加或移除处理步骤
 */
export class WeChatAdapter extends BaseAdapter {

	protected getAdapterName(): string {
		return "微信公众号";
	}

	protected plugins: IProcessPlugin[] = [		
		new ImagesPlugin(),
		new LinksPlugin(),
		new HeadingsPlugin(),
		new ListsPlugin(),
		new CodeBlocksPlugin(),
		new TablesPlugin(),
		new StylesPlugin()
		// 目前默认不启用 BlockquotesPlugin，如需启用请取消导入注释并添加到此处
	]
}
