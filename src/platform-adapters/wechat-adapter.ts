import { CodeBlocksPlugin } from "src/plugins/code-blocks-plugin";
import { HeadingsPlugin } from "src/plugins/headings-plugin";
import { ImagesPlugin } from "src/plugins/images-plugin";
import { LinksPlugin } from "src/plugins/links-plugin";
import { ListsPlugin } from "src/plugins/lists-plugin";
import { StylesPlugin } from "src/plugins/styles-plugin";
import { TablesPlugin } from "src/plugins/tables-plugin";
// BlockquotesPlugin导入但未使用，在注释中提到了它但目前不启用
// import {BlockquotesPlugin} from "src/plugins/processors/blockquotes-plugin";
import { IProcessPlugin } from "src/plugins/interface";
import { BaseAdapter } from "src/platform-adapters/base-adapter";

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
