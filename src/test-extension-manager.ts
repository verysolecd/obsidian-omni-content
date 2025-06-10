/**
 * ExtensionManager功能测试文件
 * 用于验证remark扩展管理功能是否正常工作
 */

import { ExtensionManager } from './remark-plugins/extension-manager';
import { MarkedParser } from './remark-plugins/parser';
import { logger } from './utils';

/**
 * 测试ExtensionManager基本功能
 */
export function testExtensionManager() {
    logger.info('🧪 开始测试ExtensionManager功能...');
    
    try {
        // 获取管理器实例
        const manager = ExtensionManager.getInstance();
        logger.info('✅ ExtensionManager实例获取成功');
        
        // 测试获取所有扩展
        const allExtensions = manager.getExtensions();
        logger.info(`📋 总扩展数量: ${allExtensions.length}`);
        allExtensions.forEach(ext => {
            logger.info(`  - ${ext.getName()}: ${ext.isEnabled() ? '启用' : '禁用'}`);
        });
        
        // 测试获取启用的扩展
        const enabledExtensions = manager.getEnabledExtensions();
        logger.info(`✅ 启用的扩展数量: ${enabledExtensions.length}`);
        
        // 测试扩展状态摘要
        const summary = manager.getExtensionsSummary();
        logger.info('📊 扩展状态摘要:', summary);
        
        // 测试单个扩展操作
        const firstExtension = allExtensions[0];
        if (firstExtension) {
            const extensionName = firstExtension.getName();
            const originalState = firstExtension.isEnabled();
            
            logger.info(`🔄 测试切换 ${extensionName} 状态...`);
            
            // 切换状态
            const toggleResult = manager.setExtensionEnabled(extensionName, !originalState);
            logger.info(`${toggleResult ? '✅' : '❌'} 状态切换结果: ${toggleResult}`);
            
            // 验证状态变更
            const newState = firstExtension.isEnabled();
            logger.info(`📊 状态验证: ${originalState} -> ${newState}`);
            
            // 恢复原状态
            manager.setExtensionEnabled(extensionName, originalState);
            logger.info(`🔄 已恢复 ${extensionName} 原状态`);
        }
        
        // 测试批量更新
        logger.info('🔄 测试批量更新功能...');
        const batchUpdates = {
            'CodeHighlight': false,
            'MathRenderer': true,
            'CalloutRenderer': true
        };
        
        const batchResult = manager.batchUpdateExtensionsEnabled(batchUpdates);
        logger.info('📊 批量更新结果:', batchResult);
        
        logger.info('✅ ExtensionManager功能测试完成！');
        return true;
        
    } catch (error) {
        logger.error('❌ ExtensionManager测试失败:', error);
        return false;
    }
}

/**
 * 测试MarkedParser与ExtensionManager集成
 */
export function testMarkedParserIntegration(app: any) {
    logger.info('🧪 开始测试MarkedParser集成...');
    
    try {
        // 创建mock callback对象
        const mockCallback = {
            settings: { expandedAccordionSections: [] } as any,
            updateElementByID: (id: string, html: string) => {
                logger.debug(`Mock updateElementByID: ${id}`);
            }
        };
        
        // 创建MarkedParser实例
        const parser = new MarkedParser(app, mockCallback);
        logger.info('✅ MarkedParser实例创建成功');
        
        // 获取ExtensionManager
        const manager = ExtensionManager.getInstance();
        
        // 测试获取启用的扩展
        const enabledExtensions = parser.getEnabledExtensions();
        logger.info(`📋 Parser中启用的扩展数量: ${enabledExtensions.length}`);
        
        // 测试禁用一个扩展后重新构建
        const extensions = manager.getExtensions();
        if (extensions.length > 0) {
            const testExtension = extensions[0];
            const extensionName = testExtension.getName();
            const originalState = testExtension.isEnabled();
            
            logger.info(`🔄 测试禁用 ${extensionName} 并重新构建...`);
            
            // 禁用扩展
            manager.setExtensionEnabled(extensionName, false);
            
            // 重新构建marked实例
            parser.buildMarked();
            
            // 检查启用的扩展数量是否减少
            const newEnabledExtensions = parser.getEnabledExtensions();
            logger.info(`📊 重新构建后启用的扩展数量: ${newEnabledExtensions.length}`);
            
            // 恢复原状态
            manager.setExtensionEnabled(extensionName, originalState);
            parser.buildMarked();
            logger.info(`🔄 已恢复 ${extensionName} 原状态并重新构建`);
        }
        
        logger.info('✅ MarkedParser集成测试完成！');
        return true;
        
    } catch (error) {
        logger.error('❌ MarkedParser集成测试失败:', error);
        return false;
    }
}

/**
 * 测试扩展配置管理
 */
export function testExtensionConfig() {
    logger.info('🧪 开始测试扩展配置管理...');
    
    try {
        const manager = ExtensionManager.getInstance();
        const extensions = manager.getExtensions();
        
        if (extensions.length > 0) {
            const testExtension = extensions[0];
            const extensionName = testExtension.getName();
            
            logger.info(`🔧 测试 ${extensionName} 配置管理...`);
            
            // 获取当前配置
            const currentConfig = manager.getExtensionConfig(extensionName);
            logger.info('📋 当前配置:', currentConfig);
            
            // 获取元配置
            const metaConfig = manager.getExtensionMetaConfig(extensionName);
            logger.info('📋 元配置:', metaConfig);
            
            // 测试配置更新
            const testConfig = { ...currentConfig, testProperty: 'test-value' };
            const updatedConfig = manager.updateExtensionConfig(extensionName, testConfig);
            logger.info('📊 更新后配置:', updatedConfig);
            
            logger.info('✅ 扩展配置管理测试完成！');
        } else {
            logger.warn('⚠️ 没有可测试的扩展');
        }
        
        return true;
        
    } catch (error) {
        logger.error('❌ 扩展配置管理测试失败:', error);
        return false;
    }
}

/**
 * 运行所有测试
 */
export function runAllTests(app?: any) {
    logger.info('🚀 开始运行ExtensionManager完整测试套件...');
    
    const results = {
        basicFunctionality: testExtensionManager(),
        markedParserIntegration: app ? testMarkedParserIntegration(app) : false,
        configManagement: testExtensionConfig()
    };
    
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    logger.info(`📊 测试结果: ${successCount}/${totalCount} 通过`);
    logger.info('详细结果:', results);
    
    if (successCount === totalCount) {
        logger.info('🎉 所有测试通过！ExtensionManager功能正常');
    } else {
        logger.warn('⚠️ 部分测试失败，请检查日志');
    }
    
    return results;
}
