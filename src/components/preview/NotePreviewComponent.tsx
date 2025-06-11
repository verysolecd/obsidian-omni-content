import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot, Root } from "react-dom/client";
import { Toolbar } from "../toolbar/Toolbar";
import { MessageModal } from "./MessageModal";
import { NMPSettings } from "../../settings";

interface NotePreviewComponentProps {
  settings: NMPSettings;
  articleHTML: string;
  cssContent: string;
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
  onUpdateCSSVariables: () => void;
}

export const NotePreviewComponent: React.FC<NotePreviewComponentProps> = ({
  settings,
  articleHTML,
  cssContent,
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
  onUpdateCSSVariables,
}) => {
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [showOkButton, setShowOkButton] = useState(false);
  const renderDivRef = useRef<HTMLDivElement>(null);
  const styleElRef = useRef<HTMLStyleElement>(null);
  const articleDivRef = useRef<HTMLDivElement>(null);

  // 拖拽调整大小的状态
  const [renderWidth, setRenderWidth] = useState<string>("flex: 1");
  
  // 更新CSS样式
  useEffect(() => {
    if (styleElRef.current) {
      styleElRef.current.textContent = cssContent;
    }
  }, [cssContent]);

  // 更新文章内容
  useEffect(() => {
    if (articleDivRef.current) {
      articleDivRef.current.innerHTML = articleHTML;
      // 应用CSS变量更新
      onUpdateCSSVariables();
    }
  }, [articleHTML, onUpdateCSSVariables]);

  // 显示加载消息
  const showLoading = useCallback((msg: string) => {
    setMessageTitle(msg);
    setShowOkButton(false);
    setIsMessageVisible(true);
  }, []);

  // 显示消息
  const showMsg = useCallback((msg: string) => {
    setMessageTitle(msg);
    setShowOkButton(true);
    setIsMessageVisible(true);
  }, []);

  // 关闭消息
  const closeMessage = useCallback(() => {
    setIsMessageVisible(false);
  }, []);

  // 拖拽调整大小的处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!renderDivRef.current) return;

    const startX = e.clientX;
    const startWidth = renderDivRef.current.getBoundingClientRect().width;

    const handleMouseMove = (e: MouseEvent) => {
      if (!renderDivRef.current) return;
      
      const newWidth = startWidth + e.clientX - startX;
      const containerWidth = renderDivRef.current.parentElement?.getBoundingClientRect().width || 0;
      const minWidth = 200;
      const maxWidth = containerWidth - 250;

      if (newWidth > minWidth && newWidth < maxWidth) {
        setRenderWidth(`0 0 ${newWidth}px`);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div
      className="note-preview"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 左侧渲染区域 */}
      <div
        ref={renderDivRef}
        className="render-div"
        id="render-div"
        style={{
          order: 0,
          WebkitUserSelect: "text",
          userSelect: "text",
          padding: "10px",
          flex: renderWidth,
          overflow: "auto",
          borderRight: "1px solid var(--background-modifier-border)",
        }}
      >
        <style ref={styleElRef} title="omni-content-style">
          {cssContent}
        </style>
        <div ref={articleDivRef} dangerouslySetInnerHTML={{ __html: articleHTML }} />
      </div>

      {/* 可拖动的分隔条 */}
      <div
        className="column-resizer"
        style={{
          order: 1,
          width: "5px",
          backgroundColor: "var(--background-modifier-border)",
          cursor: "col-resize",
          opacity: 0.7,
          transition: "opacity 0.2s",
          zIndex: 10,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
      />

      {/* 右侧工具栏容器 */}
      <div
        className="toolbar-container"
        style={{
          order: 2,
          flex: 1,
          width: "100%",
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          backgroundColor: "var(--background-secondary-alt)",
          borderLeft: "1px solid var(--background-modifier-border)",
        }}
      >
        <Toolbar
          settings={settings}
          onRefresh={onRefresh}
          onCopy={onCopy}
          onDistribute={onDistribute}
          onTemplateChange={onTemplateChange}
          onThemeChange={onThemeChange}
          onHighlightChange={onHighlightChange}
          onThemeColorToggle={onThemeColorToggle}
          onThemeColorChange={onThemeColorChange}
          onRenderArticle={onRenderArticle}
          onSaveSettings={onSaveSettings}
        />
      </div>

      {/* 消息模态框 */}
      <MessageModal
        isVisible={isMessageVisible}
        title={messageTitle}
        showOkButton={showOkButton}
        onClose={closeMessage}
      />
    </div>
  );
};

// 用于渲染React组件到DOM的辅助类
export class ReactRenderer {
  public root: Root | null = null;
  private container: HTMLElement | null = null;

  mount(container: HTMLElement, component: React.ReactElement) {
    this.container = container;
    this.root = createRoot(container);
    this.root.render(component);
  }

  unmount() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.container = null;
  }

  update(component: React.ReactElement) {
    if (this.root) {
      this.root.render(component);
    }
  }
}