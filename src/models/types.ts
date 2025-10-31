export type ID = string;

export type ChartKind = "bar" | "line" | "area" | "scatter" | "pie" | "donut" | "radar";

/**
 * Matches the persisted chart structure used across the app. `spec` is optional
 * and included for compatibility with the provided interface contract.
 */
export interface Chart {
  id: ID;
  title: string;
  datasetId: ID;
  chartType: ChartKind;
  mappings: Record<string, any>;
  options: Record<string, any>;
  spec?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  id: ID;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPlacement {
  id: ID;
  dashboardId: ID;
  chartId: ID;
  x: number;
  y: number;
  w: number;
  h: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

