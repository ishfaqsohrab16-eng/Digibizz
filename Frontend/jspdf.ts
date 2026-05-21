import { jsPDF } from "jspdf";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: {
      head?: any[][];
      body?: any[][];
      [key: string]: any;
    }) => void;
    save: (filename: string) => void;
  }

  const jsPDF: {
    new (): jsPDF;
  };
}

declare module "jspdf-autotable" {
  interface AutoTablePlugin {
    (jspdf: any): any;
  }
  const plugin: AutoTablePlugin;
}

export {};
