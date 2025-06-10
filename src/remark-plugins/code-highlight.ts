import hljs from "highlight.js";
import {MarkedExtension} from "marked";
import {markedHighlight} from "marked-highlight";
import {CodeRenderer} from "./code";
import {Extension} from "./extension";

export class CodeHighlight extends Extension {
	getName(): string {
		return "CodeHighlight";
	}

	markedExtension(): MarkedExtension {
		return markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code, lang, info) {
				console.log("CodeHighlight处理代码:", {lang, codePreview: code.substring(0, 100)});
				
				const type = CodeRenderer.getMathType(lang)
				if (type) return code;
				if (lang && lang.trim().toLocaleLowerCase() == 'mpcard') return code;
				if (lang && lang.trim().toLocaleLowerCase() == 'mermaid') return code;

				if (lang && hljs.getLanguage(lang)) {
					try {
						const result = hljs.highlight(code, {language: lang});
						console.log("CodeHighlight生成高亮HTML:", result.value.substring(0, 200));
						return result.value;
					} catch (err) {
					}
				}

				try {
					const result = hljs.highlightAuto(code);
					console.log("CodeHighlight自动高亮HTML:", result.value.substring(0, 200));
					return result.value;
				} catch (err) {
				}

				return ''; // use external default escaping
			}
		})
	}
}
