/**
 * Extension管理器使用示例
 * 
 * 本文件展示如何在前端UI中使用ExtensionManager来控制markdown扩展插件
 */

import { ExtensionManager } from './extension-manager';
import type { ExtensionConfig } from './extension';
import { logger } from 'src/utils';

/**
 * 示例：获取插件状态并显示在UI中
 */
export function displayExtensionStatus() {
    const manager = ExtensionManager.getInstance();
    const summary = manager.getExtensionsSummary();
    
    logger.info("当前所有插件状态:");
    summary.forEach(plugin => {
        logger.info(`${plugin.name}: ${plugin.enabled ? '✅启用' : '❌禁用'}`);
    });
    
    return summary;
}

/**
 * 示例：切换插件启用状态
 */
export function toggleExtension(extensionName: string): boolean {
    const manager = ExtensionManager.getInstance();
    const extension = manager.getExtensionByName(extensionName);
    
    if (!extension) {
        logger.error(`插件不存在: ${extensionName}`);
        return false;
    }
    
    const currentStatus = extension.isEnabled();
    const newStatus = !currentStatus;
    
    const success = manager.setExtensionEnabled(extensionName, newStatus);
    if (success) {
        logger.info(`${extensionName} ${newStatus ? '已启用' : '已禁用'}`);
    }
    
    return success;
}

/**
 * 示例：批量配置常用插件组合
 */
export function applyPresetConfiguration(preset: 'minimal' | 'full' | 'writing'): void {
    const manager = ExtensionManager.getInstance();
    
    const presets = {
        // 最小配置：只保留基础功能
        minimal: {
            'LocalFile': true,
            'LinkRenderer': true,
            'TextHighlight': false,
            'CodeHighlight': false,
            'CodeRenderer': false,
            'CalloutRenderer': false,
            'MathRenderer': false,
            'SVGIcon': false,
            'FootnoteRenderer': false,
            'EmbedBlockMark': false
        },
        // 完整配置：启用所有功能
        full: {
            'LocalFile': true,
            'LinkRenderer': true,
            'TextHighlight': true,
            'CodeHighlight': true,
            'CodeRenderer': true,
            'CalloutRenderer': true,
            'MathRenderer': true,
            'SVGIcon': true,
            'FootnoteRenderer': true,
            'EmbedBlockMark': true
        },
        // 写作配置：适合写作场景
        writing: {
            'LocalFile': true,
            'LinkRenderer': true,
            'TextHighlight': true,
            'CodeHighlight': false,
            'CodeRenderer': false,
            'CalloutRenderer': true,
            'MathRenderer': false,
            'SVGIcon': false,
            'FootnoteRenderer': true,
            'EmbedBlockMark': true
        }
    };
    
    const config = presets[preset];
    const result = manager.batchUpdateExtensionsEnabled(config);
    
    logger.info(`应用 ${preset} 预设配置完成:`);
    logger.info(`成功: ${result.success.join(', ')}`);
    if (result.failed.length > 0) {
        logger.warn(`失败: ${result.failed.join(', ')}`);
    }
}

/**
 * 示例：获取单个插件的详细配置
 */
export function inspectExtension(extensionName: string): {
    name: string;
    enabled: boolean;
    config: ExtensionConfig | null;
    metaConfig: any;
} | null {
    const manager = ExtensionManager.getInstance();
    const extension = manager.getExtensionByName(extensionName);
    
    if (!extension) {
        logger.error(`插件不存在: ${extensionName}`);
        return null;
    }
    
    const info = {
        name: extension.getName(),
        enabled: extension.isEnabled(),
        config: extension.getConfig(),
        metaConfig: extension.getMetaConfig()
    };
    
    logger.info(`插件 ${extensionName} 详细信息:`, info);
    return info;
}

/**
 * 示例：更新插件自定义配置
 */
export function updateExtensionConfig(extensionName: string, newConfig: Partial<ExtensionConfig>): boolean {
    const manager = ExtensionManager.getInstance();
    const currentConfig = manager.getExtensionConfig(extensionName);
    
    if (!currentConfig) {
        logger.error(`无法获取插件配置: ${extensionName}`);
        return false;
    }
    
    const updatedConfig = manager.updateExtensionConfig(extensionName, {
        ...currentConfig,
        ...newConfig
    });
    
    if (updatedConfig) {
        logger.info(`更新 ${extensionName} 配置成功:`, updatedConfig);
        return true;
    }
    
    return false;
}

/**
 * 示例：生成插件状态报告
 */
export function generateExtensionReport(): {
    total: number;
    enabled: number;
    disabled: number;
    extensions: Array<{
        name: string;
        status: 'enabled' | 'disabled';
        hasCustomConfig: boolean;
    }>;
} {
    const manager = ExtensionManager.getInstance();
    const summary = manager.getExtensionsSummary();
    
    const report = {
        total: summary.length,
        enabled: summary.filter(ext => ext.enabled).length,
        disabled: summary.filter(ext => !ext.enabled).length,
        extensions: summary.map(ext => ({
            name: ext.name,
            status: ext.enabled ? 'enabled' as const : 'disabled' as const,
            hasCustomConfig: Object.keys(ext.config).length > 1 // 除了enabled之外还有其他配置
        }))
    };
    
    logger.info("插件状态报告:", report);
    return report;
}

// 导出便捷函数
export const ExtensionUtils = {
    displayStatus: displayExtensionStatus,
    toggle: toggleExtension,
    applyPreset: applyPresetConfiguration,
    inspect: inspectExtension,
    updateConfig: updateExtensionConfig,
    generateReport: generateExtensionReport
};
