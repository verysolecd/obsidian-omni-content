import React from "react";

export const BrandSection: React.FC = () => {
  return (
    <div
      className="brand-section"
      style={{
        flex: "0 0 auto",
        padding: "16px",
        background: "linear-gradient(135deg, var(--background-secondary-alt) 0%, var(--background-secondary) 100%)",
        borderBottom: "1px solid var(--background-modifier-border)",
      }}
    >
      <div
        className="brand-content"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          className="brand-left-side"
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            className="logo-container"
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #6b46c1 0%, #4a6bf5 100%)",
              borderRadius: "8px",
              marginRight: "12px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                color: "white",
                fontWeight: "bold",
                fontSize: "20px",
                fontFamily: "'Arial Black', sans-serif",
              }}
            >
              O
            </div>
          </div>
          <div
            className="title-container"
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="preview-title"
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                background: "linear-gradient(90deg, #6b46c1 0%, #4a6bf5 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              }}
            >
              Omnient
            </div>
            <div
              className="version-container"
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: "2px",
              }}
            >
              <div
                className="version-badge"
                style={{
                  padding: "1px 6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "white",
                  background: "linear-gradient(90deg, #4a6bf5 0%, #6b46c1 100%)",
                  borderRadius: "10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                  lineHeight: "1.4",
                }}
              >
                V0.3.0
              </div>
            </div>
          </div>
        </div>
        <div
          className="brand-name"
          style={{
            fontSize: "14px",
            background: "linear-gradient(90deg, #4f6ef2 0%, #8a65d9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            padding: "4px 10px",
            border: "1px solid rgba(106, 106, 240, 0.3)",
            borderRadius: "12px",
            fontWeight: "600",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          手工川智能创作平台
        </div>
      </div>
    </div>
  );
};