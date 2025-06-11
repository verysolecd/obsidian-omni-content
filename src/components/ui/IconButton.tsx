import React from "react";

interface IconButtonProps {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  className = "toolbar-button",
  children,
  disabled = false,
}) => {
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};