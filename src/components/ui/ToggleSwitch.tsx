import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "small" | "normal";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  size = "normal",
  disabled = false,
  onClick,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const sizeStyles = {
    small: {
      minWidth: "36px",
      height: "18px",
      sliderHeight: "18px",
      sliderWidth: "36px",
    },
    normal: {
      minWidth: "50px",
      height: "25px",
      sliderHeight: "25px",
      sliderWidth: "50px",
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <label
      className={`switch ${size}`}
      style={{
        marginRight: "8px",
        ...currentSize,
      }}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <span
        className="slider round"
        style={{
          height: currentSize.sliderHeight,
          width: currentSize.sliderWidth,
        }}
      />
    </label>
  );
};