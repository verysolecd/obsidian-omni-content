declare global {
  interface Window {
    mermaidRenderPromises: Promise<void>[];
    mermaid: {
      initialize: (config: any) => void;
      init: (config: any | undefined, nodes: string) => Promise<void>;
    };
    mermaidConfig: {
      startOnLoad: boolean;
      securityLevel: string;
      theme: string;
      fontSize?: number;
      fontFamily?: string;
      themeVariables?: {
        primaryColor?: string;
        primaryTextColor?: string;
        primaryBorderColor?: string;
        lineColor?: string;
        textColor?: string;
        [key: string]: string | undefined;
      };
      flowchart?: {
        htmlLabels?: boolean;
        curve?: string;
      };
      pie?: {
        textPosition?: number;
      };
      sequence?: {
        useMaxWidth?: boolean;
      };
      gantt?: {
        useMaxWidth?: boolean;
      };
    };
  }
}

export {};
