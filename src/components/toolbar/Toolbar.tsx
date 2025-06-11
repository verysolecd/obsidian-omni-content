import React from "react";
import { BrandSection } from "./BrandSection";
import { ActionButtons } from "./ActionButtons";
import { StyleSettings } from "./StyleSettings";
import { PluginAccordion, ExtensionAccordion } from "./PluginAccordion";
import { Accordion } from "../ui/Accordion";
import { NMPSettings } from "../../settings";
import { ExtensionManager } from "../../remark-plugins/extension-manager";
import { PluginManager } from "../../rehype-plugins";

interface ToolbarProps {
  settings: NMPSettings;
  onRefresh: () => void;
  onCopy: () => void;
  onDistribute: () => void;
  onTemplateChange: (template: string) => void;
  onThemeChange: (theme: string) => void;
  onHighlightChange: (highlight: string) => void;
  onThemeColorToggle: (enabled: boolean) => void;
  onThemeColorChange: (color: string) => void;
  onRenderArticle: () => void;
  onSaveSettings: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  settings,
  onRefresh,
  onCopy,
  onDistribute,
  onTemplateChange,
  onThemeChange,
  onHighlightChange,
  onThemeColorToggle,
  onThemeColorChange,
  onRenderArticle,
  onSaveSettings,
}) => {
  const handleAccordionToggle = (sectionId: string, isExpanded: boolean) => {
    if (isExpanded) {
      if (!settings.expandedAccordionSections.includes(sectionId)) {
        settings.expandedAccordionSections.push(sectionId);
      }
    } else {
      const index = settings.expandedAccordionSections.indexOf(sectionId);
      if (index > -1) {
        settings.expandedAccordionSections.splice(index, 1);
      }
    }
    onSaveSettings();
  };

  // 获取Remark插件（原扩展）
  const extensionManager = ExtensionManager.getInstance();
  const extensions = extensionManager.getExtensions();

  // 获取Rehype插件
  const pluginManager = PluginManager.getInstance();
  const plugins = pluginManager.getPlugins();

  return (
    <div
      className="preview-toolbar modern-toolbar"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* 品牌区域 */}
      <BrandSection />

      {/* 工具栏内容 */}
      <div
        className="toolbar-container"
        style={{ flex: "1", overflowY: "auto" }}
      >
        <div
          className="toolbar-content toolbar-vertical"
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "10px",
          }}
        >
          {/* 操作按钮组 */}
          <ActionButtons
            onRefresh={onRefresh}
            onCopy={onCopy}
            onDistribute={onDistribute}
          />

          {/* 手风琴容器 */}
          <div
            className="accordion-container"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
          >
            {/* 样式设置 */}
            {settings.showStyleUI && (
              <Accordion
                title="样式设置"
                sectionId="accordion-样式设置"
                expandedSections={settings.expandedAccordionSections}
                onToggle={handleAccordionToggle}
              >
                <StyleSettings
                  settings={settings}
                  onTemplateChange={onTemplateChange}
                  onThemeChange={onThemeChange}
                  onHighlightChange={onHighlightChange}
                  onThemeColorToggle={onThemeColorToggle}
                  onThemeColorChange={onThemeColorChange}
                />
              </Accordion>
            )}

            {/* Remark 插件 */}
            <Accordion
              title="Remark 插件"
              sectionId="accordion-remark-插件"
              expandedSections={settings.expandedAccordionSections}
              onToggle={handleAccordionToggle}
            >
              <div className="remark-plugins-container" style={{ width: "100%" }}>
                {extensions.length > 0 ? (
                  extensions.map((extension) => {
                    if (extension && typeof extension.getName === "function") {
                      const extensionName = extension.getName();
                      return (
                        <ExtensionAccordion
                          key={extensionName}
                          extension={extension}
                          extensionName={extensionName}
                          expandedSections={settings.expandedAccordionSections}
                          onToggle={handleAccordionToggle}
                          onRenderArticle={onRenderArticle}
                        />
                      );
                    }
                    return null;
                  })
                ) : (
                  <p className="no-plugins-message">未找到任何Remark插件</p>
                )}
              </div>
            </Accordion>

            {/* Rehype 插件 */}
            <Accordion
              title="Rehype 插件"
              sectionId="accordion-rehype-插件"
              expandedSections={settings.expandedAccordionSections}
              onToggle={handleAccordionToggle}
            >
              <div className="rehype-plugins-container" style={{ width: "100%" }}>
                {plugins.length > 0 ? (
                  plugins.map((plugin) => {
                    if (plugin && typeof plugin.getName === "function") {
                      const pluginName = plugin.getName();
                      return (
                        <PluginAccordion
                          key={pluginName}
                          plugin={plugin}
                          pluginName={pluginName}
                          expandedSections={settings.expandedAccordionSections}
                          onToggle={handleAccordionToggle}
                          onRenderArticle={onRenderArticle}
                        />
                      );
                    }
                    return null;
                  })
                ) : (
                  <p className="no-plugins-message">未找到任何Rehype插件</p>
                )}
              </div>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
};