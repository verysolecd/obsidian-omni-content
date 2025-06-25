import {BaseProcess} from "src/rehype-plugins/base-process";
import {NMPSettings} from "src/settings";
import {logger} from "src/utils";

/**
 * 图片处理插件 - 处理微信公众号中的图片格式
 */
export class Images extends BaseProcess {
	getName(): string {
		return "图片处理插件";
	}

	async process(html: string, settings: NMPSettings): Promise<string> {
		// 微信公众号图片需要特定处理
		// 1. 添加data-src属性
		// 2. 确保图片有正确的样式和对齐方式
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 查找所有图片元素
			const images = doc.querySelectorAll("img");

			const uploadQueue = [];

			

// 统一处理所有图片
for (const img of images) {
    try {
        const src = img.getAttribute("src");
        if (!src) continue;

        // 本地图片转base64
        if (!src.startsWith('http') && !src.startsWith('data:')) {
            try {
                const fileData = await settings.vault.adapter.readBinary(src);
                const base64 = Buffer.from(fileData).toString('base64');
                const mimeType = Images.getMimeType(src);
                img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            } catch (error) {
                logger.error(`本地图片转换失败 [${src}]:`, error);
                continue;
            }
        }
        
        // 统一设置data-src属性
        img.setAttribute("data-src", src);

        // 优化上传队列添加逻辑
        if (settings.autoUploadWxImages && !uploadQueue.some(q => q.originalPath === src)) {
            uploadQueue.push({
                element: img,
                originalPath: src
            });
        }

        // 合并样式设置
        img.style.cssText = img.hasAttribute("style") 
            ? img.getAttribute("style") + ";max-width: 100%; height: auto;" 
            : "max-width: 100%; height: auto;";

        // 优化父元素居中逻辑
        const parent = img.parentElement;
        if (parent && parent.tagName !== "CENTER" && parent.style.textAlign !== "center") {
            parent.style.textAlign = "center";
        }
    }
}


					// 设置图片默认样式
					if (!img.hasAttribute("style")) {
						img.setAttribute(
							"style",
							"max-width: 100%; height: auto;"
						);
					}

					// 确保图片居中显示
					const parent = img.parentElement;
					if (parent && parent.tagName !== "CENTER") {
						parent.style.textAlign = "center";
					}
				}
			});
			// 转回字符串
			// 上传标记处理
const uploadMarkers = doc.createElement('script');
uploadMarkers.textContent = `window._wxImages = ${JSON.stringify(Array.from(images).map(img => img.getAttribute('data-src')))}`;
doc.body.appendChild(uploadMarkers);
// 执行图片上传
if (settings.autoUploadWxImages && settings.wxToken) {
    logger.info(`开始批量上传图片，共 ${uploadQueue.length} 张`);
    
    for (const [index, item] of uploadQueue.entries()) {
        try {
            logger.debug(`正在上传图片 [${index + 1}/${uploadQueue.length}]: ${item.originalPath}`);
            const fileData = await settings.vault.adapter.readBinary(item.originalPath);
            const blob = new Blob([fileData], {type: Images.getMimeType(item.originalPath)});
            const res = await wxUploadImage(
                blob, 
                item.originalPath.split('/').pop() || 'image.png', 
                'image', 
                settings.wxToken
            );
            
            if (res.errcode === 0) {
                item.element.setAttribute('src', res.url);
                logger.info(`图片上传成功: ${item.originalPath}`);
            } else {
                logger.warn(`图片上传失败 [${res.errmsg}]: ${item.originalPath}`);
            }
        } catch (error) {
            logger.error(`微信图片上传失败 [${item.originalPath}]:`, error);
        }
    }
}

// 添加上传元数据
doc.body.setAttribute('data-wx-upload-images', JSON.stringify(
    uploadQueue.map(item => item.originalPath)
));

// MIME类型检测
private static getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'svg': 'image/svg+xml'
    };
    return typeMap[ext] || 'application/octet-stream';
}

return doc.body.innerHTML;
		} catch (error) {
			logger.error("处理图片时出错:", error);
			return html;
		}
	}
}