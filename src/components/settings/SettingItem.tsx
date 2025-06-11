import React from "react";

interface SettingItemProps {
  name: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingItem: React.FC<SettingItemProps> = ({
  name,
  description,
  children,
}) => {
  return (
    <div
      className="setting-item"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 0",
        borderBottom: "1px solid var(--background-modifier-border)",
      }}
    >
      <div className="setting-item-info">
        <div
          className="setting-item-name"
          style={{
            fontWeight: "500",
            marginBottom: description ? "4px" : "0",
          }}
        >
          {name}
        </div>
        {description && (
          <div
            className="setting-item-description"
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div className="setting-item-control">{children}</div>
    </div>
  );
};