# Markdown扩展插件管理系统

## 概述

本系统为remark扩展提供了类似于rehype插件管理器的前端UI控制功能，支持动态启用/禁用插件、配置管理等。

## 核心特性

- ✅ 插件启用/禁用控制
- ✅ 插件配置管理
- ✅ 自动保存到settings
- ✅ 统一管理API
- ✅ 向后兼容

## 使用方法

### 基础用法

```typescript
import { ExtensionManager } from 'src/markdown';

// 获取管理器实例
const manager = ExtensionManager.getInstance();

// 获取所有插件信息
const extensions = manager.getExtensionsSummary();
console.log(extensions);

// 启用/禁用插件
manager.setExtensionEnabled('CodeHighlight', false);
manager.setExtensionEnabled('MathRenderer', true);

// 批量更新插件状态
manager.batchUpdateExtensionsEnabled({
    'CodeHighlight': false,
    'LocalFile': true,
    'CalloutRenderer': false
});
```

### 插件配置管理

```typescript
// 获取插件配置
const config = manager.getExtensionConfig('CodeRenderer');

// 更新插件配置
manager.updateExtensionConfig('CodeRenderer', {
    enabled: true,
    showLineNumbers: false,
    theme: 'dark'
});

// 获取插件UI元数据
const metaConfig = manager.getExtensionMetaConfig('CodeRenderer');
```

### 前端UI集成示例

```typescript
// 获取插件列表用于UI渲染
const extensionsSummary = manager.getExtensionsSummary();

extensionsSummary.forEach(plugin => {
    console.log(`插件: ${plugin.name}`);
    console.log(`状态: ${plugin.enabled ? '启用' : '禁用'}`);
    console.log(`配置:`, plugin.config);
    console.log(`UI元数据:`, plugin.metaConfig);
});
```

## 扩展自定义插件

要创建支持UI控制的新扩展插件：

```typescript
import { Extension, ExtensionMetaConfig } from 'src/markdown';

export class MyCustomExtension extends Extension {
    getName(): string {
        return "MyCustomExtension";
    }
    
    // 可选：自定义UI配置
    getMetaConfig(): ExtensionMetaConfig {
        return {
            enabled: {
                type: "switch",
                title: "启用我的插件"
            },
            customOption: {
                type: "select",
                title: "自定义选项",
                options: [
                    { value: "option1", text: "选项1" },
                    { value: "option2", text: "选项2" }
                ]
            }
        };
    }
    
    markedExtension(): MarkedExtension {
        // 实现标记扩展逻辑
        return {
            // ...
        };
    }
}
```

## 注意事项

1. **重新构建**: 插件启用状态变更后，需要重新调用 `buildMarked()` 才能生效
2. **自动保存**: 所有配置变更会自动保存到用户设置中
3. **向后兼容**: 现有代码无需修改即可正常工作
4. **性能**: 禁用的插件不会参与marked构建和后处理，提升性能

## API参考

### ExtensionManager

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `getInstance()` | 获取单例实例 | - | ExtensionManager |
| `getExtensions()` | 获取所有插件 | - | Extension[] |
| `getEnabledExtensions()` | 获取启用的插件 | - | Extension[] |
| `getExtensionByName(name)` | 根据名称获取插件 | name: string | Extension \| null |
| `setExtensionEnabled(name, enabled)` | 设置插件启用状态 | name: string, enabled: boolean | boolean |
| `getExtensionsSummary()` | 获取插件状态摘要 | - | PluginSummary[] |
| `batchUpdateExtensionsEnabled(updates)` | 批量更新插件状态 | updates: Record<string, boolean> | UpdateResult |

### Extension基类新增方法

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `getName()` | 获取插件名称 | - | string |
| `isEnabled()` | 检查是否启用 | - | boolean |
| `setEnabled(enabled)` | 设置启用状态 | enabled: boolean | void |
| `getConfig()` | 获取插件配置 | - | ExtensionConfig |
| `updateConfig(config)` | 更新插件配置 | config: ExtensionConfig | ExtensionConfig |
| `getMetaConfig()` | 获取UI元数据 | - | ExtensionMetaConfig |
