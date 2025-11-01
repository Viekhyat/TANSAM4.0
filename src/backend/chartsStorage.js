// Simple in-memory storage for dynamic charts
class ChartsStorage {
  constructor() {
    this.charts = new Map();
    this.idCounter = 1;
  }

  generateId() {
    return `chart_${Date.now()}_${this.idCounter++}`;
  }

  create(chartData) {
    const id = chartData.id || this.generateId();
    const chartType = chartData.type || chartData.chartType || "line";
    const chart = {
      id,
      title: chartData.title || "Untitled Chart",
      type: chartType,
      chartType: chartType, // Include both for compatibility
      dataSource: chartData.dataSource,
      dimension: chartData.dimension || "2d",
      xField: chartData.xField,
      yField: chartData.yField,
      createdAt: chartData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.charts.set(id, chart);
    return chart;
  }

  get(id) {
    return this.charts.get(id);
  }

  getAll() {
    return Array.from(this.charts.values());
  }

  update(id, chartData) {
    const existing = this.charts.get(id);
    if (!existing) {
      throw new Error("Chart not found");
    }
    // Ensure chartType is synced with type if provided
    const chartType = chartData.type || chartData.chartType || existing.type;
    const updated = {
      ...existing,
      ...chartData,
      id, // Ensure ID doesn't change
      type: chartType,
      chartType: chartType, // Include both for compatibility
      updatedAt: new Date().toISOString()
    };
    this.charts.set(id, updated);
    return updated;
  }

  delete(id) {
    return this.charts.delete(id);
  }
}

export default new ChartsStorage();
