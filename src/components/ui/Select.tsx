import React from "react";

export interface SelectOption {
  value: string;
  text: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  className = "toolbar-select",
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      
      const select = e.currentTarget;
      const currentIndex = select.selectedIndex;
      
      if (e.key === "ArrowDown" && currentIndex < options.length - 1) {
        select.selectedIndex = currentIndex + 1;
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        select.selectedIndex = currentIndex - 1;
      }
      
      // 触发change事件
      select.dispatchEvent(new Event("change"));
    }
  };

  return (
    <select
      className={className}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.text}
        </option>
      ))}
    </select>
  );
};