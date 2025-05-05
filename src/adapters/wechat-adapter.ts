

import { CardDataManager } from "../markdown/code";
import { NMPSettings } from "../settings";
import { logger } from "../utils";
import { ContentAdapter } from "./content-adapter";

/**
 * 微信公众号适配器 - 处理微信公众号特定的格式要求
 */
export class WeChatAdapter implements ContentAdapter {
  /**
   * 适配微信公众号内容
   * @param html 原始HTML内容
   * @param settings 插件设置
   * @returns 适配后的HTML内容
   */
  adaptContent(html: string, settings: NMPSettings): string {
    logger.debug("应用微信公众号适配器处理HTML");
    
    let processedHtml = html;
    
    // 微信特定处理开始
    
    // 1. 处理图片（微信要求图片有特定的数据属性）
    processedHtml = this.processImages(processedHtml);
    
    // 2. 处理链接（根据设置转换为脚注或其他格式）
    processedHtml = this.processLinks(processedHtml, settings);
    
    // 3. 处理代码块（确保代码显示正确）
    processedHtml = this.processCodeBlocks(processedHtml, settings);
    
    // 4. 确保表格正确显示
    processedHtml = this.processTables(processedHtml);
    
    // 5. 处理微信公众号中的字体和样式限制
    processedHtml = this.processStyles(processedHtml);
    
    // 最后，恢复代码卡片
    processedHtml = CardDataManager.getInstance().restoreCard(processedHtml);
    
    logger.debug("微信适配处理完成");
    return processedHtml;
  }
  
  /**
   * 处理图片，添加微信所需的属性
   */
  private processImages(html: string): string {
    // 微信公众号图片需要特定处理
    // 1. 添加data-src属性
    // 2. 确保图片有正确的样式和对齐方式
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 查找所有图片元素
      const images = doc.querySelectorAll('img');
      
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          // 设置data-src属性，微信编辑器需要
          img.setAttribute('data-src', src);
          
          // 设置图片默认样式
          if (!img.hasAttribute('style')) {
            img.setAttribute('style', 'max-width: 100%; height: auto;');
          }
          
          // 确保图片居中显示
          const parent = img.parentElement;
          if (parent && parent.tagName !== 'CENTER') {
            parent.style.textAlign = 'center';
          }
        }
      });
      
      // 转回字符串
      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理图片时出错:", error);
      return html;
    }
  }
  
  /**
   * 处理链接，根据设置转换为脚注或其他格式
   */
  private processLinks(html: string, settings: NMPSettings): string {
    // 如果不需要处理链接，直接返回
    if (settings.linkFootnoteMode === 'none') {
      return html;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 查找所有链接
      const links = doc.querySelectorAll('a');
      const footnotes: string[] = [];
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // 判断是否需要转换此链接
        const shouldConvert = settings.linkFootnoteMode === 'all' || 
          (settings.linkFootnoteMode === 'non-wx' && !href.includes('weixin.qq.com'));
        
        if (shouldConvert) {
          // 创建脚注标记
          const footnoteRef = document.createElement('sup');
          footnoteRef.textContent = `[${footnotes.length + 1}]`;
          footnoteRef.style.color = '#3370ff';
          
          // 替换链接为脚注引用
          link.after(footnoteRef);
          
          // 根据设置决定脚注内容格式
          let footnoteContent = '';
          if (settings.linkDescriptionMode === 'raw') {
            footnoteContent = `[${footnotes.length + 1}] ${link.textContent}: ${href}`;
          } else {
            footnoteContent = `[${footnotes.length + 1}] ${href}`;
          }
          
          footnotes.push(footnoteContent);
          
          // 移除链接标签，保留内部文本
          const linkText = link.textContent;
          link.replaceWith(linkText || '');
        }
      });
      
      // 如果有脚注，添加到文档末尾
      if (footnotes.length > 0) {
        const hr = document.createElement('hr');
        const footnoteSection = document.createElement('section');
        footnoteSection.style.fontSize = '14px';
        footnoteSection.style.color = '#888';
        footnoteSection.style.marginTop = '30px';
        
        footnotes.forEach(note => {
          const p = document.createElement('p');
          p.innerHTML = note;
          footnoteSection.appendChild(p);
        });
        
        doc.body.appendChild(hr);
        doc.body.appendChild(footnoteSection);
      }
      
      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理链接时出错:", error);
      return html;
    }
  }
  
  /**
   * 处理代码块，确保在微信中正确显示
   */
  private processCodeBlocks(html: string, settings: NMPSettings): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 查找所有代码块
      const codeBlocks = doc.querySelectorAll('pre code');
      
      codeBlocks.forEach(codeBlock => {
        // 确保代码块有正确的微信样式
        const pre = codeBlock.parentElement;
        if (pre) {
          pre.style.background = '#f8f8f8';
          pre.style.borderRadius = '4px';
          pre.style.padding = '16px';
          pre.style.overflow = 'auto';
          pre.style.fontSize = '14px';
          pre.style.lineHeight = '1.5';
          
          // 处理行号显示
          if (settings.lineNumber) {
            const lines = codeBlock.innerHTML.split('\n');
            const numberedLines = lines.map((line, index) => 
              `<span class="line-number">${index + 1}</span>${line}`
            ).join('\n');
            
            // 添加行号样式
            const style = document.createElement('style');
            style.textContent = `
              .line-number {
                display: inline-block;
                width: 2em;
                text-align: right;
                padding-right: 1em;
                margin-right: 1em;
                color: #999;
                border-right: 1px solid #ddd;
              }
            `;
            pre.appendChild(style);
            
            // 更新代码块内容
            codeBlock.innerHTML = numberedLines;
          }
        }
      });
      
      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理代码块时出错:", error);
      return html;
    }
  }

  /**
   * 处理表格，确保在微信中正确显示
   */
  private processTables(html: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 查找所有表格
      const tables = doc.querySelectorAll('table');
      
      tables.forEach(table => {
        // 确保表格有正确的微信样式
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.marginBottom = '20px';
        
        // 处理表头
        const thead = table.querySelector('thead');
        if (thead) {
          const headerCells = thead.querySelectorAll('th');
          headerCells.forEach(cell => {
            cell.style.backgroundColor = '#f2f2f2';
            cell.style.padding = '8px';
            cell.style.borderBottom = '2px solid #ddd';
            cell.style.textAlign = 'left';
            cell.style.fontWeight = 'bold';
          });
        }
        
        // 处理表格单元格
        const cells = table.querySelectorAll('td');
        cells.forEach((cell, index) => {
          cell.style.padding = '8px';
          cell.style.border = '1px solid #ddd';
          cell.style.textAlign = 'left';
          
          // 隔行变色
          if (index % 2 === 0) {
            const row = cell.parentElement;
            if (row) {
              row.style.backgroundColor = '#f9f9f9';
            }
          }
        });
      });
      
      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理表格时出错:", error);
      return html;
    }
  }
  
  /**
   * 处理样式，确保符合微信公众号的样式限制
   */
  private processStyles(html: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 处理字体大小和样式
      const elements = doc.querySelectorAll('*');
      elements.forEach(el => {
        // 需要将 Element 类型转换为 HTMLElement 才能访问 style 属性
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        
        // 微信公众号支持的字体比较有限
        if (style.fontFamily) {
          htmlEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif';
        }
        
        // 处理过大或过小的字体
        const fontSize = parseInt(style.fontSize);
        if (fontSize > 40) {
          htmlEl.style.fontSize = '40px';
        } else if (fontSize < 12 && htmlEl.tagName !== 'SUP' && htmlEl.tagName !== 'SUB') {
          htmlEl.style.fontSize = '12px';
        }
      });
      
      return doc.body.innerHTML;
    } catch (error) {
      logger.error("处理样式时出错:", error);
      return html;
    }
  }
}
