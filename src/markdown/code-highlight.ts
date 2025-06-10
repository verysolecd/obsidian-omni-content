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
				const type = CodeRenderer.getMathType(lang)
				if (type) return code;
				if (lang && lang.trim().toLocaleLowerCase() == 'mpcard') return code;
				if (lang && lang.trim().toLocaleLowerCase() == 'mermaid') return code;

				if (lang && hljs.getLanguage(lang)) {
					try {
						const result = hljs.highlight(code, {language: lang});
						return result.value;
					} catch (err) {
					}
				}

				try {
					const result = hljs.highlightAuto(code);
					return result.value;
				} catch (err) {
				}

				return ''; // use external default escaping
			}
		})
	}
}
