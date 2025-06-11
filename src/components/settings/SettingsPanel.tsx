import React from "react";
import { SettingItem } from "./SettingItem";
import { Select, SelectOption } from "../ui/Select";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { IconButton } from "../ui/IconButton";
import { Notice } from "obsidian";
import { NMPSettings, LinkDescriptionMode } from "../../settings";
import AssetsManager from "../../assets";
import TemplateManager from "../../template-manager";
import { cleanMathCache } from "../../remark-plugins/math";

interface SettingsPanelProps {
  settings: NMPSettings;
  assetsManager: AssetsManager;
  onSaveSettings: () => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  assetsManager,
  onSaveSettings,
}) => {
  const templateManager = TemplateManager.getInstance();
  const templates = templateManager.getTemplateNames();

  // 主题选项
  const themeOptions: SelectOption[] = assetsManager.themes.map((theme) => ({
    value: theme.className,
    text: theme.name,
  }));

  // 高亮选项
  const highlightOptions: SelectOption[] = assetsManager.highlights.map((highlight) => ({
    value: highlight.name,
    text: highlight.name,
  }));

  // 模板选项
  const templateOptions: SelectOption[] = templates.map((template) => ({
    value: template,
    text: template,
  }));

  // 链接描述模式选项
  const linkDescriptionOptions: SelectOption[] = [
    { value: "empty", text: "不显示描述" },
    { value: "description", text: "显示链接描述" },
  ];

  // 文件嵌入样式选项
  const embedStyleOptions: SelectOption[] = [
    { value: "quote", text: "引用" },
    { value: "content", text: "正文" },
  ];

  // 数学公式语法选项
  const mathOptions: SelectOption[] = [
    { value: "latex", text: "latex" },
    { value: "asciimath", text: "asciimath" },
  ];

  const handleThemeChange = async (value: string) => {
    settings.defaultStyle = value;
    await onSaveSettings();
  };

  const handleHighlightChange = async (value: string) => {
    settings.defaultHighlight = value;
    await onSaveSettings();
  };

  const handleShowStyleUIChange = async (value: boolean) => {
    settings.showStyleUI = value;
    await onSaveSettings();
  };

  const handleLinkDescriptionModeChange = async (value: string) => {
    settings.linkDescriptionMode = value as LinkDescriptionMode;
    await onSaveSettings();
  };

  const handleEmbedStyleChange = async (value: string) => {
    settings.embedStyle = value;
    await onSaveSettings();
  };

  const handleMathChange = async (value: string) => {
    settings.math = value;
    cleanMathCache();
    await onSaveSettings();
  };

  const handleLineNumberChange = async (value: boolean) => {
    settings.lineNumber = value;
    await onSaveSettings();
  };

  const handleWeixinCodeFormatChange = async (value: boolean) => {
    settings.enableWeixinCodeFormat = value;
    await onSaveSettings();
  };

  const handleDownloadThemes = async () => {
    await assetsManager.downloadThemes();
    new Notice("主题下载完成");
  };

  const handleOpenAssets = async () => {
    await assetsManager.openAssets();
  };

  const handleClearThemes = async () => {
    await assetsManager.removeThemes();
    settings.resetStyelAndHighlight();
    await onSaveSettings();
    new Notice("主题已清空");
  };

  const handleCustomCssToggle = async (value: boolean) => {
    settings.useCustomCss = value;
    await onSaveSettings();
  };

  const handleRefreshCustomCss = async () => {
    await assetsManager.loadCustomCSS();
    new Notice("刷新成功");
  };

  const handleUseTemplateChange = async (value: boolean) => {
    settings.useTemplate = value;
    await onSaveSettings();
  };

  const handleDefaultTemplateChange = async (value: string) => {
    settings.defaultTemplate = value;
    await onSaveSettings();
  };

  const handleReloadTemplates = async () => {
    await templateManager.loadTemplates();
    new Notice("模板重新加载完成！");
  };

  return (
    <div className="settings-panel" style={{ padding: "20px" }}>
      {/* 基础设置 */}
      <SettingItem name="默认样式">
        <Select
          value={settings.defaultStyle}
          options={themeOptions}
          onChange={handleThemeChange}
        />
      </SettingItem>

      <SettingItem name="代码高亮">
        <Select
          value={settings.defaultHighlight}
          options={highlightOptions}
          onChange={handleHighlightChange}
        />
      </SettingItem>

      <SettingItem
        name="在工具栏展示样式选择"
        description="建议在移动端关闭，可以增大文章预览区域"
      >
        <ToggleSwitch
          checked={settings.showStyleUI}
          onChange={handleShowStyleUIChange}
        />
      </SettingItem>

      <SettingItem
        name="脚注链接描述模式"
        description="控制脚注中链接的展示形式"
      >
        <Select
          value={settings.linkDescriptionMode}
          options={linkDescriptionOptions}
          onChange={handleLinkDescriptionModeChange}
        />
      </SettingItem>

      <SettingItem name="文件嵌入展示样式">
        <Select
          value={settings.embedStyle}
          options={embedStyleOptions}
          onChange={handleEmbedStyleChange}
        />
      </SettingItem>

      <SettingItem name="数学公式语法">
        <Select
          value={settings.math}
          options={mathOptions}
          onChange={handleMathChange}
        />
      </SettingItem>

      <SettingItem name="显示代码行号">
        <ToggleSwitch
          checked={settings.lineNumber}
          onChange={handleLineNumberChange}
        />
      </SettingItem>

      <SettingItem
        name="启用微信代码格式化"
        description="输出符合微信公众号编辑器格式的代码块"
      >
        <ToggleSwitch
          checked={settings.enableWeixinCodeFormat}
          onChange={handleWeixinCodeFormatChange}
        />
      </SettingItem>

      {/* 主题管理 */}
      <SettingItem name="获取更多主题">
        <div style={{ display: "flex", gap: "8px" }}>
          <IconButton onClick={handleDownloadThemes}>下载</IconButton>
          <IconButton onClick={handleOpenAssets}>📁</IconButton>
        </div>
      </SettingItem>

      <SettingItem name="清空主题">
        <IconButton onClick={handleClearThemes}>清空</IconButton>
      </SettingItem>

      <SettingItem name="CSS代码片段">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <ToggleSwitch
            checked={settings.useCustomCss}
            onChange={handleCustomCssToggle}
          />
          <IconButton onClick={handleRefreshCustomCss}>🔄</IconButton>
          <IconButton onClick={handleOpenAssets}>📁</IconButton>
        </div>
      </SettingItem>

      {/* 模板设置 */}
      <h2 style={{ margin: "32px 0 16px 0", fontSize: "18px", fontWeight: "600" }}>
        模板设置
      </h2>

      <SettingItem
        name="使用模板"
        description="启用后，将使用模板来包装渲染的内容"
      >
        <ToggleSwitch
          checked={settings.useTemplate}
          onChange={handleUseTemplateChange}
        />
      </SettingItem>

      {templates.length > 0 && (
        <SettingItem
          name="默认模板"
          description="选择默认使用的模板"
        >
          <Select
            value={settings.defaultTemplate}
            options={templateOptions}
            onChange={handleDefaultTemplateChange}
          />
        </SettingItem>
      )}

      <SettingItem
        name="管理模板"
        description="创建、编辑或删除模板"
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <IconButton onClick={handleOpenAssets}>打开模板文件夹</IconButton>
          <IconButton onClick={handleReloadTemplates}>重新加载模板</IconButton>
        </div>
      </SettingItem>
    </div>
  );
};