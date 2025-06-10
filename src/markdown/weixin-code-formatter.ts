import hljs from "highlight.js";

/**
 * 微信公众号代码格式化器
 * 将代码转换为微信公众号编辑器兼容的格式
 */
export class WeixinCodeFormatter {
    /**
     * 将highlight.js的类名映射到微信格式
     */
    private static readonly CLASS_MAP: { [key: string]: string } = {
        'hljs-keyword': 'code-snippet__keyword',
        'hljs-string': 'code-snippet__string', 
        'hljs-number': 'code-snippet__number',
        'hljs-comment': 'code-snippet__comment',
        'hljs-attr': 'code-snippet__attr',
        'hljs-name': 'code-snippet__attr',
        'hljs-property': 'code-snippet__attr',
        'hljs-punctuation': 'code-snippet__punctuation',
        'hljs-title': 'code-snippet__title',
        'hljs-function': 'code-snippet__function',
        'hljs-variable': 'code-snippet__variable',
        'hljs-type': 'code-snippet__type',
        'hljs-built_in': 'code-snippet__built_in',
        'hljs-operator': 'code-snippet__operator',
        'hljs-literal': 'code-snippet__literal',
        'hljs-meta': 'code-snippet__meta',
        'hljs-tag': 'code-snippet__keyword',
        'hljs-attribute': 'code-snippet__attr'
    };

    /**
     * 转换highlight.js的输出为微信格式
     */
    private static convertHighlightedCode(highlightedCode: string): string {
        // 替换hljs-类名为微信格式的类名
        let result = highlightedCode;
        
        Object.entries(this.CLASS_MAP).forEach(([hljsClass, weixinClass]) => {
            const regex = new RegExp(`class="${hljsClass}"`, 'g');
            result = result.replace(regex, `class="${weixinClass}"`);
        });

        return result;
    }

    /**
     * 处理JSON特殊字符，为其添加对应的微信样式类
     */
    private static enhanceJsonSyntax(code: string): string {
        return code
            // 处理字符串中的引号和冒号
            .replace(/"([^"]*)"(\s*:)/g, '<span class="code-snippet__attr">"$1"</span><span class="code-snippet__punctuation">$2</span>')
            // 处理字符串值
            .replace(/:\s*"([^"]*)"/g, ': <span class="code-snippet__string">"$1"</span>')
            // 处理标点符号
            .replace(/([{}[\],])/g, '<span class="code-snippet__punctuation">$1</span>')
            // 清理重叠的span标签
            .replace(/<span class="code-snippet__punctuation"><span class="code-snippet__punctuation">/g, '<span class="code-snippet__punctuation">')
            .replace(/<\/span><\/span>/g, '</span>');
    }

    /**
     * 格式化代码为微信公众号编辑器格式
     */
    public static formatCodeForWeixin(code: string, language?: string): string {
        // 移除代码末尾的换行符
        const cleanCode = code.replace(/\n$/, '');
        let processedHtml = '';

        // 使用highlight.js进行语法高亮
        try {
            if (language && hljs.getLanguage(language)) {
                const result = hljs.highlight(cleanCode, { language });
                processedHtml = this.convertHighlightedCode(result.value);
            } else {
                const result = hljs.highlightAuto(cleanCode);
                processedHtml = this.convertHighlightedCode(result.value);
            }
        } catch (err) {
            console.warn('Highlight.js error:', err);
            processedHtml = this.escapeHtml(cleanCode);
        }

        // 如果是JSON，进行额外的语法增强
        if (language === 'json') {
            processedHtml = this.enhanceJsonSyntax(processedHtml);
        }

        // 按行分割并构建最终结构
        const lines = processedHtml.split('\n');
        const codeElements = lines.map(line => {
            if (line.trim() === '') {
                return '<code><span leaf=""><br class="ProseMirror-trailingBreak"></span></code>';
            }
            return `<code><span leaf="">${line}</span></code>`;
        });

        return `<section class="code-snippet__js"><pre class="code-snippet__js code-snippet code-snippet_nowrap" data-lang="${language || 'text'}">${codeElements.join('')}</pre></section>`;
    }

    /**
     * 简化版本，用于纯文本代码块
     */
    public static formatPlainCodeForWeixin(code: string): string {
        const cleanCode = code.replace(/\n$/, '');
        
        const lines = cleanCode.split('\n');
        const codeElements = lines.map(line => {
            if (line.trim() === '') {
                return '<code><span leaf=""><br class="ProseMirror-trailingBreak"></span></code>';
            }
            // 对于纯文本，需要进行HTML转义
            const escapedLine = this.escapeHtml(line);
            return `<code><span leaf="">${escapedLine}</span></code>`;
        });

        return `<section class="code-snippet__js"><pre class="code-snippet__js code-snippet code-snippet_nowrap" data-lang="text">${codeElements.join('')}</pre></section>`;
    }

    /**
     * HTML转义，只转义必要的字符
     */
    private static escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;'
        };
        return text.replace(/[&<>]/g, m => map[m]);
    }
}
