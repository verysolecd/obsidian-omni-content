import React, { useState, useEffect } from "react";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  sectionId: string;
  expandedSections: string[];
  onToggle: (sectionId: string, isExpanded: boolean) => void;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultExpanded = false,
  sectionId,
  expandedSections,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(
    expandedSections.includes(sectionId) || defaultExpanded
  );

  useEffect(() => {
    setIsExpanded(expandedSections.includes(sectionId));
  }, [expandedSections, sectionId]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle(sectionId, newExpanded);
  };

  return (
    <div
      id={sectionId}
      className="accordion-section"
      style={{
        marginBottom: "12px",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "6px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        className="accordion-header"
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          backgroundColor: "var(--background-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: isExpanded ? "1px solid var(--background-modifier-border)" : "1px solid transparent",
          transition: "background-color 0.2s, border-color 0.2s",
        }}
        onClick={handleToggle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--background-secondary-alt)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--background-secondary)";
        }}
      >
        <div
          className="accordion-title"
          style={{ fontWeight: "500", fontSize: "14px" }}
        >
          {title}
        </div>
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
      </div>
      {isExpanded && (
        <div
          className="accordion-content"
          style={{
            padding: "16px",
            transition: "0.3s ease-out",
            display: "block",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};