import React from "react";
import { IconButton } from "../ui/IconButton";
import { Platform } from "obsidian";

interface ActionButtonsProps {
  onRefresh: () => void;
  onCopy: () => void;
  onDistribute: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onRefresh,
  onCopy,
  onDistribute,
}) => {
  return (
    <div className="toolbar-group">
      <IconButton
        onClick={onRefresh}
        className="toolbar-button refresh-button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        <span>刷新</span>
      </IconButton>

      {Platform.isDesktop && (
        <IconButton
          onClick={onCopy}
          className="toolbar-button copy-button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>复制</span>
        </IconButton>
      )}

      <IconButton
        onClick={onDistribute}
        className="toolbar-button distribute-button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>分发</span>
      </IconButton>
    </div>
  );
};