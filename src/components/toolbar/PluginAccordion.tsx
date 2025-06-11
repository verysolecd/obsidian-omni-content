import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Select, SelectOption } from "../ui/Select";
import { IProcessPlugin } from "../../rehype-plugins/base-process";
import { Extension, ExtensionMetaConfig } from "../../remark-plugins/extension";
import { Notice } from "obsidian";

interface PluginAccordionProps {
  plugin: IProcessPlugin;
  pluginName: string;
  expandedSections: string[];
  onToggle: (sectionId: string, isExpanded: boolean) => void;
  onRenderArticle: () => void;
}

interface ExtensionAccordionProps {
  extension: Extension;
  extensionName: string;
  expandedSections: string[];
  onToggle: (sectionId: string, isExpanded: boolean) => void;
  onRenderArticle: () => void;
}

export const PluginAccordion: React.FC<PluginAccordionProps> = ({
  plugin,
  pluginName,
  expandedSections,
  onToggle,
  onRenderArticle,
}) => {
  const pluginId = `plugin-${pluginName.replace(/\s+/g, "-").toLowerCase()}`;
  const isExpanded = expandedSections.includes(pluginId);
  
  const pluginMetaConfig = plugin.getMetaConfig();
  const pluginCurrentConfig = plugin.getConfig();
  const configEntries = Object.entries(pluginMetaConfig);
  const hasConfigOptions = configEntries.length > 0;

  const handleEnabledChange = (enabled: boolean) => {
    plugin.setEnabled(enabled);
    onRenderArticle();
    new Notice(`已${enabled ? "启用" : "禁用"}${plugin.getName()}插件`);
  };

  const handleConfigChange = (key: string, value: string | boolean) => {
    plugin.updateConfig({ [key]: value });
    onRenderArticle();
    new Notice(`已更新${plugin.getName()}插件设置`);
  };

  const handleToggle = () => {
    onToggle(pluginId, !isExpanded);
  };

  return (
    <div
      id={pluginId}
      className="accordion-section"
      style={{
        marginBottom: "8px",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "4px",
      }}
    >
      <div
        className="accordion-header"
        style={{
          padding: "10px",
          cursor: hasConfigOptions ? "pointer" : "default",
          backgroundColor: "var(--background-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        onClick={hasConfigOptions ? handleToggle : undefined}
      >
        <div
          className="accordion-header-left"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <ToggleSwitch
            checked={plugin.isEnabled()}
            onChange={handleEnabledChange}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="accordion-title">{pluginName}</div>
        </div>
        
        {hasConfigOptions && (
          <div
            className="accordion-icon"
            style={{
              transition: "transform 0.3s",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>
      
      {hasConfigOptions && isExpanded && (
        <div
          className="accordion-content"
          style={{
            padding: "16px",
            transition: "0.3s ease-out",
            display: "block",
          }}
        >
          <div
            className="plugin-config-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {configEntries.map(([key, meta]) => (
              <div
                key={key}
                className="plugin-config-item"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div className="plugin-config-title">{meta.title}</div>
                <div className="plugin-config-control">
                  {meta.type === "switch" ? (
                    <ToggleSwitch
                      checked={!!pluginCurrentConfig[key]}
                      onChange={(value) => handleConfigChange(key, value)}
                    />
                  ) : meta.type === "select" ? (
                    <Select
                      value={String(pluginCurrentConfig[key] || "")}
                      options={meta.options?.map(option => ({
                        value: option.value,
                        text: option.text,
                      })) || []}
                      onChange={(value) => handleConfigChange(key, value)}
                      className="plugin-config-select"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ExtensionAccordion: React.FC<ExtensionAccordionProps> = ({
  extension,
  extensionName,
  expandedSections,
  onToggle,
  onRenderArticle,
}) => {
  const extensionId = `extension-${extensionName.replace(/\s+/g, "-").toLowerCase()}`;
  const isExpanded = expandedSections.includes(extensionId);
  
  const extensionMetaConfig = extension.getMetaConfig();
  const extensionCurrentConfig = extension.getConfig();
  const configEntries = Object.entries(extensionMetaConfig);
  const hasConfigOptions = configEntries.length > 0;

  const handleEnabledChange = (enabled: boolean) => {
    extension.setEnabled(enabled);
    onRenderArticle();
    new Notice(`已${enabled ? "启用" : "禁用"}${extension.getName()}插件`);
  };

  const handleConfigChange = (key: string, value: string | boolean) => {
    extension.updateConfig({ [key]: value });
    onRenderArticle();
    new Notice(`已更新${extension.getName()}插件设置`);
  };

  const handleToggle = () => {
    onToggle(extensionId, !isExpanded);
  };

  return (
    <div
      id={extensionId}
      className="accordion-section"
      style={{
        marginBottom: "8px",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "4px",
      }}
    >
      <div
        className="accordion-header"
        style={{
          padding: "10px",
          cursor: hasConfigOptions ? "pointer" : "default",
          backgroundColor: "var(--background-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        onClick={hasConfigOptions ? handleToggle : undefined}
      >
        <div
          className="accordion-header-left"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <ToggleSwitch
            checked={extension.isEnabled()}
            onChange={handleEnabledChange}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="accordion-title">{extensionName}</div>
        </div>
        
        {hasConfigOptions && (
          <div
            className="accordion-icon"
            style={{
              transition: "transform 0.3s",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>
      
      {hasConfigOptions && isExpanded && (
        <div
          className="accordion-content"
          style={{
            padding: "16px",
            transition: "0.3s ease-out",
            display: "block",
          }}
        >
          <div
            className="extension-config-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {configEntries.map(([key, metaValue]) => {
              const meta = metaValue as ExtensionMetaConfig[string];
              return (
                <div
                  key={key}
                  className="extension-config-item"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="extension-config-title">{meta.title}</div>
                  <div className="extension-config-control">
                    {meta.type === "switch" ? (
                      <ToggleSwitch
                        checked={!!extensionCurrentConfig[key]}
                        onChange={(value) => handleConfigChange(key, value)}
                      />
                    ) : meta.type === "select" ? (
                      <Select
                        value={String(extensionCurrentConfig[key] || "")}
                        options={meta.options?.map((option: any) => ({
                          value: option.value,
                          text: option.text,
                        })) || []}
                        onChange={(value) => handleConfigChange(key, value)}
                        className="extension-config-select"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};