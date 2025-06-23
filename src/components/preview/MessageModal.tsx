import React from "react";

interface MessageModalProps {
  isVisible: boolean;
  title: string;
  showOkButton: boolean;
  onClose: () => void;
  // 新增取消按钮回调和显示控制属性
  showCancelButton?: boolean; 
  onCancel?: () => void; 
  children?: React.ReactNode;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isVisible,
  title,
  showOkButton,
  onClose,
  showCancelButton = false, // 默认不显示取消按钮
  onCancel,
  children
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="msg-view"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--background-primary)",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          minWidth: "300px",
          textAlign: "center",
        }}
      >
        <div
          className="msg-title"
          style={{
            marginBottom: showOkButton || showCancelButton ? "16px" : "0",
            fontSize: "16px",
            fontWeight: "500",
          }}
        >
          {title}
        </div>
        {showOkButton && (
          <button
            className="msg-ok-btn"
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--interactive-accent)",
              color: "var(--text-on-accent)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: showCancelButton ? "10px" : "0"
            }}
            onClick={onClose}
          >
            确定
          </button>
        )}
        {showCancelButton && (
          <button
            className="msg-cancel-btn"
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--interactive-accent)",
              color: "var(--text-on-accent)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={onCancel}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
};