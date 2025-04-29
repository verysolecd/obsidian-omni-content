/*
 * Copyright (c) 2025 Mark Shawn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { App, Notice } from 'obsidian';
import Handlebars from 'handlebars';
import { logger } from "./utils";

// 定义模板数据类型
export interface TemplateData {
    // 注意：索引类型必须包含所有特定属性类型
    [key: string]: string | string[] | number | boolean | object | undefined;
    epigraph?: string[];
    content?: string;
}

export interface Template {
    name: string;
    path: string;
    content: string;
}

export default class TemplateManager {
    private static instance: TemplateManager;
    private app: App;
    private templates: Map<string, Template> = new Map();
    private templateDir: string;

    private constructor() {}

    public static getInstance(): TemplateManager {
        if (!TemplateManager.instance) {
            TemplateManager.instance = new TemplateManager();
        }
        return TemplateManager.instance;
    }

    public setup(app: App): void {
        this.app = app;
        this.templateDir = `${this.app.vault.configDir}/plugins/omni-content/templates/`;
    }

    // 加载所有模板
    public async loadTemplates(): Promise<void> {
        try {
            const adapter = this.app.vault.adapter;
            const templateExists = await adapter.exists(this.templateDir);
            
            if (!templateExists) throw new Error('模板目录不存在');
            
            const files = await adapter.list(this.templateDir);
            this.templates.clear();
            
            for (const file of files.files) {
                if (file.endsWith('.html')) {
                    const fileName = file.split('/').pop()?.replace('.html', '') || '';
                    const content = await adapter.read(file);
                    
                    this.templates.set(fileName, {
                        name: fileName,
                        path: file,
                        content: content
                    });
                }
            }
            
            logger.info('模板加载完成，共加载', this.templates.size, '个模板');
        } catch (error) {
            console.error('Error loading templates:', error);
            new Notice('加载模板失败！');
        }
    }

    // 获取模板列表
    public getTemplateNames(): string[] {
        return Array.from(this.templates.keys());
    }

    // 获取指定模板
    public getTemplate(name: string): Template | undefined {
        return this.templates.get(name);
    }

    // 应用模板到内容
    public applyTemplate(content: string, templateName: string, meta: TemplateData = {}): string {
        const template = this.templates.get(templateName);
        if (!template) {
            logger.warn(`未找到模板 ${templateName}`);
            return content;
        }
        
        // 确保 meta 中有 epigraph，默认为 ["这篇文章写地贼累！"]
        if (!meta.epigraph) {
            meta.epigraph = ["这篇文章写地贼累！"];
        } else if (!Array.isArray(meta.epigraph)) {
            // 如果 epigraph 不是数组，转换为数组
            meta.epigraph = [meta.epigraph];
        }
        
        // 使用 Handlebars 渲染模板
        
        // 在传递数据时，要确保 content 不会被 meta 中的同名属性覆盖
        const templateData = {
            ...meta,  // 先展开 meta
            content   // 再设置 content，优先级更高
        };
        
        // 预编译模板，可提高性能
        const compiledTemplate = Handlebars.compile(template.content, { noEscape: true }); // noEscape 参数避免 HTML 转义
        
        // 注册一些常用的辅助函数
        Handlebars.registerHelper('isFirst', function(options) {
            return options.data.first ? options.fn(this) : options.inverse(this);
        });
        
        Handlebars.registerHelper('isLast', function(options) {
            return options.data.last ? options.fn(this) : options.inverse(this);
        });
        
        const data = compiledTemplate(templateData, {
            data: {  // 这里可以传递一些额外的上下文数据
                root: templateData
            }
        });
        
        logger.debug('使用模板数据渲染:', { templateName, templateData });
        return data;
    }
    
    // 创建新模板
    public async createTemplate(name: string, content: string): Promise<void> {
        try {
            const fileName = `${name}.html`;
            const filePath = `${this.templateDir}${fileName}`;
            
            await this.app.vault.adapter.write(filePath, content);
            
            this.templates.set(name, {
                name: name,
                path: filePath,
                content: content
            });
            
            new Notice(`模板 ${name} 创建成功！`);
        } catch (error) {
            console.error('Error creating template:', error);
            new Notice('创建模板失败！');
        }
    }

    // 删除模板
    public async deleteTemplate(name: string): Promise<void> {
        try {
            const template = this.templates.get(name);
            if (!template) {
                new Notice(`模板 ${name} 不存在！`);
                return;
            }
            
            await this.app.vault.adapter.remove(template.path);
            this.templates.delete(name);
            
            new Notice(`模板 ${name} 删除成功！`);
        } catch (error) {
            console.error('Error deleting template:', error);
            new Notice('删除模板失败！');
        }
    }
}
